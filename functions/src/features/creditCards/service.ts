import { randomUUID as uuid } from "node:crypto";
import {
  db,
  FieldValue,
  withTxn,
  sanitizeNestedObject,
  stripReservedFields,
  normId,
  orgIdFromClaims,
  requireOrg,
  isDev,
  newBulkWriter,
  toMonthKey,
  addMonthsUtc,
  type Claims,
} from "../../core";
import {
  CreditCard,
  CreditCardPatchBody,
  CreditCardUpsertBody,
  TCreditCard,
  TCreditCardsSummaryItem,
  toArray,
} from "./schemas";
import { listVisiblePaymentQueueItemsForOrg } from "../paymentQueue/service";

const RESERVED = new Set<string>([
  "id",
  "orgId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "active",
  "deleted",
]);

function isReserved(k: string) {
  return RESERVED.has(k) || k.startsWith("_");
}

function hasOwn(obj: unknown, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

const cleanExtras = (v: Record<string, unknown> | null | undefined) =>
  v ? sanitizeNestedObject(stripReservedFields(v as Record<string, unknown>)) : null;

function normalizeLimitOverrides(input: unknown) {
  const rows = Array.isArray(input) ? input : [];
  const byMonth = new Map<string, { month: string; limitCents: number }>();
  for (const row of rows as Array<Record<string, unknown>>) {
    const month = String(row?.month || "").trim();
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const limitCents = Math.max(0, Number(row?.limitCents || 0) || 0);
    byMonth.set(month, { month, limitCents });
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function sanitizeCreditCardPatch(patch: Partial<TCreditCard>): Partial<TCreditCard> {
  const out: Partial<TCreditCard> = { ...(patch || {}) };
  for (const k of Object.keys(out)) {
    if (isReserved(k)) delete out[k];
  }
  if ("createdAt" in out) delete out.createdAt;
  if ("updatedAt" in out) delete out.updatedAt;
  if (out.meta !== undefined) out.meta = cleanExtras(out.meta as Record<string, unknown>);
  return out;
}

function assertTargetOrgAllowed(caller: Claims, targetOrg: string) {
  const callerOrg = orgIdFromClaims(caller);
  const t = normId(targetOrg);

  if (callerOrg && normId(callerOrg) !== t && !isDev(caller)) {
    const e = new Error("forbidden_cross_org") as Error & {
      code: number;
      meta?: Record<string, unknown>;
    };
    e.code = 403;
    e.meta = { callerOrg: normId(callerOrg), targetOrg: t };
    throw e;
  }

  if (!callerOrg && !isDev(caller)) {
    requireOrg(caller);
  }
}

function assertDocOrgWritable(
  caller: Claims,
  targetOrg: string,
  doc: { orgId?: unknown } | null | undefined
) {
  const docOrg = normId(doc?.orgId);
  const t = normId(targetOrg);
  if (docOrg && docOrg !== t && !isDev(caller)) {
    const e = new Error("forbidden_org") as Error & {
      code: number;
      meta?: Record<string, unknown>;
    };
    e.code = 403;
    e.meta = { docOrg, targetOrg: t };
    throw e;
  }
}

export function normalizeOne(input: TCreditCard, caller: Claims, targetOrg: string) {
  const parsed = CreditCard.parse(input);
  const id = parsed.id || uuid();
  const status = (parsed.status || "draft") as TCreditCard["status"];
  const active = status === "active";
  const deleted = status === "deleted";
  const cycleType = parsed.cycleType || "calendar_month";
  const statementCloseDay =
    cycleType === "statement_cycle" && Number.isFinite(Number(parsed.statementCloseDay))
      ? Math.max(1, Math.min(31, Number(parsed.statementCloseDay)))
      : null;

  return {
    id,
    orgId: normId(targetOrg),
    kind: "credit_card" as const,
    name: parsed.name,
    code: parsed.code ?? null,
    status,
    active,
    deleted,
    issuer: parsed.issuer ?? null,
    network: parsed.network ?? null,
    last4: parsed.last4 ?? null,
    cycleType,
    statementCloseDay,
    monthlyLimitCents: Math.max(0, Number(parsed.monthlyLimitCents || 0) || 0),
    limitOverrides: normalizeLimitOverrides(parsed.limitOverrides),
    matching: parsed.matching
      ? {
          ...(parsed.matching || {}),
          aliases: Array.isArray(parsed.matching.aliases)
            ? parsed.matching.aliases.map((x) => String(x || "").trim()).filter(Boolean)
            : [],
          cardAnswerValues: Array.isArray(parsed.matching.cardAnswerValues)
            ? parsed.matching.cardAnswerValues.map((x) => String(x || "").trim()).filter(Boolean)
            : [],
          formIds: parsed.matching.formIds || null,
        }
      : null,
    notes: parsed.notes ?? null,
    meta: cleanExtras(parsed.meta as Record<string, unknown> | null | undefined),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function upsertCreditCards(body: unknown, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);
  const items = toArray(CreditCardUpsertBody.parse(body)).map((row) =>
    normalizeOne(row, caller, targetOrg)
  );

  const refs = items.map((row) => db.collection("creditCards").doc(row.id));
  const snaps = await Promise.all(refs.map((r) => r.get()));
  snaps.forEach((snap) => {
    if (!snap.exists) return;
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  for (let i = 0; i < items.length; i += 1) {
    writer.set(refs[i], items[i], { merge: true });
  }
  await writer.close();

  return { ids: items.map((row) => row.id) };
}

export async function patchCreditCards(body: unknown, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const rows = toArray(CreditCardPatchBody.parse(body));
  const ids = rows.map((r) => r.id);
  const refs = ids.map((id) => db.collection("creditCards").doc(id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  snaps.forEach((snap) => {
    if (!snap.exists) {
      const e = new Error("not_found") as Error & { code: number };
      e.code = 404;
      throw e;
    }
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  for (let i = 0; i < rows.length; i += 1) {
    const { id, patch, unset } = rows[i];
    const prev = (snaps[i].data() || {}) as Partial<TCreditCard>;
    const safePatch = sanitizeCreditCardPatch(patch as Partial<TCreditCard>);

    const nextStatus = (safePatch.status ?? prev.status ?? "draft") as TCreditCard["status"];
    const active = nextStatus === "active";
    const deleted = nextStatus === "deleted";
    const nextCycleType = (safePatch.cycleType ?? prev.cycleType ?? "calendar_month") as
      | "calendar_month"
      | "statement_cycle";

    const data: Record<string, unknown> = {
      ...safePatch,
      kind: "credit_card",
      status: nextStatus,
      active,
      deleted,
      cycleType: nextCycleType,
      ...(hasOwn(safePatch, "statementCloseDay")
        ? {
            statementCloseDay:
              nextCycleType === "statement_cycle" && Number.isFinite(Number(safePatch.statementCloseDay))
                ? Math.max(1, Math.min(31, Number(safePatch.statementCloseDay)))
                : null,
          }
        : {}),
      ...(hasOwn(safePatch, "monthlyLimitCents")
        ? { monthlyLimitCents: Math.max(0, Number(safePatch.monthlyLimitCents || 0) || 0) }
        : {}),
      ...(hasOwn(safePatch, "limitOverrides")
        ? { limitOverrides: normalizeLimitOverrides(safePatch.limitOverrides) }
        : {}),
      ...(normId(prev.orgId) ? {} : { orgId: normId(targetOrg) }),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = db.collection("creditCards").doc(id);
    writer.set(ref, data, { merge: true });

    if (Array.isArray(unset) && unset.length) {
      const delMap: Record<string, FirebaseFirestore.FieldValue> = {};
      for (const path of unset) delMap[path] = FieldValue.delete();
      writer.set(ref, delMap, { merge: true });
    }
  }

  await writer.close();
  return { ids };
}

export async function softDeleteCreditCards(ids: string | string[], caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);
  const arr = toArray(ids);
  const snaps = await Promise.all(arr.map((id) => db.collection("creditCards").doc(id).get()));
  snaps.forEach((snap) => {
    if (!snap.exists) {
      const e = new Error("not_found") as Error & { code: number };
      e.code = 404;
      throw e;
    }
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  for (const id of arr) {
    writer.set(
      db.collection("creditCards").doc(id),
      {
        status: "deleted",
        active: false,
        deleted: true,
        updatedAt: FieldValue.serverTimestamp(),
        deletedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await writer.close();
  return { ids: arr, deleted: true as const };
}

export async function hardDeleteCreditCards(ids: string | string[], caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);
  const arr = toArray(ids);
  const snaps = await Promise.all(arr.map((id) => db.collection("creditCards").doc(id).get()));
  snaps.forEach((snap) => {
    if (!snap.exists) return;
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });
  const batch = db.batch();
  for (const id of arr) {
    batch.delete(db.collection("creditCards").doc(id));
  }
  await batch.commit();
  return { ids: arr, deleted: true };
}

export function effectiveLimitCents(card: Record<string, unknown>, month: string) {
  const overrides = Array.isArray(card.limitOverrides) ? (card.limitOverrides as Array<Record<string, unknown>>) : [];
  const override = overrides.find((row) => String(row?.month || "") === month);
  if (override) return Math.max(0, Number(override.limitCents || 0) || 0);
  return Math.max(0, Number(card.monthlyLimitCents || 0) || 0);
}

function normalizedMatchText(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cardMatchTerms(card: Record<string, unknown>): string[] {
  const matching = (card.matching || {}) as Record<string, unknown>;
  const rawTerms = [
    card.id,
    card.name,
    card.code,
    card.last4,
    ...(Array.isArray(matching.aliases) ? matching.aliases : []),
    ...(Array.isArray(matching.cardAnswerValues) ? matching.cardAnswerValues : []),
  ];
  return rawTerms.map(normalizedMatchText).filter(Boolean);
}

function findCreditCardId(cards: Array<Record<string, unknown>>, savedId: unknown, text: string): string {
  const id = String(savedId || "").trim();
  if (id && cards.some((card) => String(card.id || "") === id)) return id;
  const haystack = ` ${normalizedMatchText(text)} `;
  for (const card of cards) {
    const terms = cardMatchTerms(card);
    if (terms.some((term) => haystack.includes(` ${term} `) || (term.length >= 4 && haystack.includes(term)))) {
      return String(card.id || "");
    }
  }
  return "";
}

export function isCardActive(card: Record<string, unknown>): boolean {
  if (card.active === true) return true;
  if (card.active === false) return false;
  const status = String(card.status || "").toLowerCase();
  if (status === "active") return true;
  if (["closed", "deleted", "inactive"].includes(status)) return false;
  return Boolean(card.active);
}

function paymentQueueIdFromSourcePath(value: unknown): string {
  const path = String(value || "").trim();
  const match = path.match(/^paymentQueue\/([^/]+)$/);
  return match ? match[1] : "";
}

function invoiceLooksLikeCreditCardSpend(row: Record<string, unknown>): boolean {
  if (String(row.source || "").toLowerCase() !== "invoice") return false;
  const haystack = [
    row.expenseType,
    row.paymentMethod,
    row.descriptor,
    row.note,
    row.notes,
    row.purpose,
    row.formTitle,
    row.formAlias,
  ].filter(Boolean).join(" ").toLowerCase();
  return /\bcredit\s*card\b|\bcard\s*purchase\b|\bcc\b/.test(haystack);
}

export async function summarizeCreditCards(
  orgId: string,
  query: { id?: string | null; month?: string | null; active?: boolean | string | null }
) {
  const month = String(query.month || toMonthKey(new Date())).slice(0, 7);
  const id = query.id ? String(query.id) : "";
  const activeFilter =
    query.active === true || query.active === "true"
      ? true
      : query.active === false || query.active === "false"
      ? false
      : undefined;

  let cards: Array<Record<string, unknown>> = [];
  if (id) {
    const snap = await db.collection("creditCards").doc(id).get();
    if (snap.exists) cards = [{ id: snap.id, ...(snap.data() || {}) }];
  } else {
    const snap = await db.collection("creditCards").where("orgId", "==", orgId).get();
    cards = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  }

  cards = cards.filter((card) => {
    if (String(card.orgId || "") !== orgId) return false;
    if (activeFilter === undefined) return true;
    return isCardActive(card) === activeFilter;
  });

  const lastMonth = toMonthKey(addMonthsUtc(`${month}-01`, -1));

  const [ledgerSnap, ccThis, ccLast, invThis, invLast] = await Promise.all([
    db.collection("ledger").where("orgId", "==", orgId).where("source", "==", "card").get(),
    listVisiblePaymentQueueItemsForOrg(orgId, { source: "credit-card", month, limit: 1000 } as any),
    listVisiblePaymentQueueItemsForOrg(orgId, { source: "credit-card", month: lastMonth, limit: 1000 } as any),
    listVisiblePaymentQueueItemsForOrg(orgId, { source: "invoice", month, limit: 1000 } as any),
    listVisiblePaymentQueueItemsForOrg(orgId, { source: "invoice", month: lastMonth, limit: 1000 } as any),
  ]);

  type MonthTotals = { spentCents: number; entryCount: number };
  type CardTotals = { this: MonthTotals; last: MonthTotals };
  const byCard = new Map<string, CardTotals>();
  const emptyTotals = (): CardTotals => ({ this: { spentCents: 0, entryCount: 0 }, last: { spentCents: 0, entryCount: 0 } });
  let unassignedSpentCents = 0;
  let unassignedEntryCount = 0;

  const thisQueueItems = [
    ...(ccThis.items || []),
    ...(invThis.items || []).filter((row) => invoiceLooksLikeCreditCardSpend(row as Record<string, unknown>)),
  ];
  const lastQueueItems = [
    ...(ccLast.items || []),
    ...(invLast.items || []).filter((row) => invoiceLooksLikeCreditCardSpend(row as Record<string, unknown>)),
  ];
  const allQueueItems = [...thisQueueItems, ...lastQueueItems];
  const visibleQueueIds = new Set(allQueueItems.map((row) => String(row.id || "")).filter(Boolean));

  for (const doc of ledgerSnap.docs) {
    const row = doc.data() || {};
    const rowMonth = String(row.month || "").slice(0, 7);
    if (rowMonth !== month && rowMonth !== lastMonth) continue;
    const queueId = paymentQueueIdFromSourcePath(((row.origin || {}) as Record<string, unknown>).sourcePath);
    if (queueId && visibleQueueIds.has(queueId)) continue;
    const cents = Number(row.amountCents || Math.round((Number(row.amount || 0) || 0) * 100)) || 0;
    const creditCardId = findCreditCardId(cards, row.creditCardId, [
      row.vendor,
      row.description,
      row.comment,
      Array.isArray(row.note) ? row.note.join(" ") : row.note,
      Array.isArray(row.labels) ? row.labels.join(" ") : "",
    ].filter(Boolean).join(" "));
    if (!creditCardId) {
      unassignedSpentCents += cents;
      unassignedEntryCount += 1;
      continue;
    }
    const hit = byCard.get(creditCardId) || emptyTotals();
    const bucket = rowMonth === month ? hit.this : hit.last;
    bucket.spentCents += cents;
    bucket.entryCount += 1;
    byCard.set(creditCardId, hit);
  }

  for (const [items, bucket] of [[thisQueueItems, "this"], [lastQueueItems, "last"]] as const) {
    for (const row of items) {
      const rawRow = row as Record<string, unknown>;
      if (String(rawRow.queueStatus || "").toLowerCase() === "void") continue;
      const cents = Number(rawRow.amountCents || Math.round((Number(rawRow.amount || 0) || 0) * 100)) || 0;
      const creditCardId = findCreditCardId(cards, row.creditCardId, [
        row.card,
        row.cardBucket,
        row.merchant,
        row.descriptor,
        row.note,
        row.notes,
        row.purpose,
        row.formTitle,
        row.formAlias,
      ].filter(Boolean).join(" "));
      if (String(row.source || "").toLowerCase() === "invoice" && !creditCardId) continue;
      if (!creditCardId) {
        unassignedSpentCents += cents;
        unassignedEntryCount += 1;
        continue;
      }
      const hit = byCard.get(creditCardId) || emptyTotals();
      hit[bucket].spentCents += cents;
      hit[bucket].entryCount += 1;
      byCard.set(creditCardId, hit);
    }
  }

  const items: TCreditCardsSummaryItem[] = cards.map((card) => {
    const creditCardId = String(card.id || "");
    const totals = byCard.get(creditCardId) || emptyTotals();
    const monthlyLimitCents = effectiveLimitCents(card, month);
    const remainingCents = monthlyLimitCents - totals.this.spentCents;
    const usagePct = monthlyLimitCents > 0 ? Math.max(0, Math.min(999, (totals.this.spentCents / monthlyLimitCents) * 100)) : 0;
    return {
      id: creditCardId,
      name: String(card.name || creditCardId || "Credit Card"),
      status: (String(card.status || "draft") as TCreditCard["status"]) || "draft",
      month,
      lastMonth,
      monthlyLimitCents,
      spentCents: totals.this.spentCents,
      remainingCents,
      usagePct,
      entryCount: totals.this.entryCount,
      lastMonthSpentCents: totals.last.spentCents,
      lastMonthEntryCount: totals.last.entryCount,
      cycleType: (String(card.cycleType || "calendar_month") as "calendar_month" | "statement_cycle"),
      statementCloseDay: Number.isFinite(Number(card.statementCloseDay)) ? Number(card.statementCloseDay) : null,
      last4: card.last4 ? String(card.last4) : null,
    };
  });

  items.sort((a, b) => b.usagePct - a.usagePct || a.name.localeCompare(b.name));
  return { items, month, unassignedSpentCents, unassignedEntryCount };
}
