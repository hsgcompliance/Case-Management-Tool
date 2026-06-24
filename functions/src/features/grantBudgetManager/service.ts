import { db, FieldValue, Timestamp, isoNow, normId } from "../../core";
import type {
  TGrantBudgetManagerLineItem,
  TGrantBudgetManagerLoadResp,
  TGrantBudgetManagerReconcileResp,
  TGrantBudgetManagerRollup,
  TGrantBudgetManagerRow,
  TGrantBudgetManagerSaveResp,
} from "./schemas";
import { recomputeGrantBudgetFromLedger } from "../grants/budgetRecompute";
import { bulkAdjustLedgerEntries } from "../ledger/service";
import {
  createManualProjectionQueueItem,
  patchPaymentQueueItem,
  voidPaymentQueueItems,
} from "../paymentQueue/service";

type ClaimsLike = { uid?: string; email?: string; name?: string; displayName?: string };

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof (value as { seconds?: unknown }).seconds === "number") {
    return new Date(Number((value as { seconds: number }).seconds) * 1000).toISOString();
  }
  return null;
}

function date10(...values: unknown[]): string {
  for (const value of values) {
    const raw = toIso(value) || (typeof value === "string" ? value : "");
    const d = String(raw || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }
  return isoNow().slice(0, 10);
}

function amountFromLedger(row: Record<string, unknown>): number {
  const cents = Number(row.amountCents);
  if (Number.isFinite(cents)) return cents / 100;
  const amount = Number(row.amount);
  return Number.isFinite(amount) ? amount : 0;
}

function amountCents(amount: number): number {
  return Math.round(Number(amount || 0) * 100);
}

function lineItemTypeLabel(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const raw = value as Record<string, unknown>;
    return String(raw.label ?? raw.name ?? raw.id ?? "");
  }
  return "";
}

function sourceUpdatedAt(row: Record<string, unknown>): string | null {
  return toIso(row.updatedAtISO) || toIso(row.updatedAt) || toIso(row.system && (row.system as Record<string, unknown>).lastWriteAt);
}

function changed(row: TGrantBudgetManagerRow): boolean {
  if (row.rowState && row.rowState !== "clean") return true;
  const original = row.original || {};
  return (
    String(row.grantId || "") !== String(original.grantId || "") ||
    String(row.lineItemId || "") !== String(original.lineItemId || "") ||
    String(row.customerId || "") !== String(original.customerId || "") ||
    String(row.caseManagerId || "") !== String(original.caseManagerId || "") ||
    amountCents(Number(row.amount || 0)) !== amountCents(Number(original.amount || 0)) ||
    String(row.date || "") !== String(original.date || "") ||
    String(row.description || "") !== String(original.description || "") ||
    String(row.memo || "") !== String(original.memo || "") ||
    String(row.category || "") !== String(original.category || "") ||
    String(row.vendor || "") !== String(original.vendor || "")
  );
}

function lineItemsForGrant(grantId: string, grant: Record<string, unknown>): TGrantBudgetManagerLineItem[] {
  const budget = (grant.budget && typeof grant.budget === "object" ? grant.budget : {}) as Record<string, unknown>;
  const items = Array.isArray(budget.lineItems) ? budget.lineItems as Record<string, unknown>[] : [];
  return items.map((item) => ({
    grantId,
    id: String(item.id || ""),
    label: String(item.label || item.name || item.id || "Line item"),
    typeLabel: lineItemTypeLabel(item.type),
    budget: Number(item.amount || 0),
    locked: item.locked === true,
  })).filter((item) => item.id);
}

function rollupsFromRows(
  grantDocs: Map<string, Record<string, unknown>>,
  rows: TGrantBudgetManagerRow[],
): TGrantBudgetManagerRollup[] {
  const out: TGrantBudgetManagerRollup[] = [];
  for (const [grantId, grant] of grantDocs) {
    const lineItems = lineItemsForGrant(grantId, grant);
    const grantRows = rows.filter((row) => row.grantId === grantId && row.rowState !== "deleted");
    const totalBudget = lineItems.reduce((sum, item) => sum + Number(item.budget || 0), 0);
    const spent = grantRows.filter((row) => row.sourceType === "ledger").reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const projected = grantRows.filter((row) => row.sourceType !== "ledger").reduce((sum, row) => sum + Number(row.amount || 0), 0);
    out.push({ grantId, lineItemId: null, budget: totalBudget, spent, projected, total: spent + projected, remaining: totalBudget - spent - projected });
    for (const item of lineItems) {
      const scoped = grantRows.filter((row) => row.lineItemId === item.id);
      const liSpent = scoped.filter((row) => row.sourceType === "ledger").reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const liProjected = scoped.filter((row) => row.sourceType !== "ledger").reduce((sum, row) => sum + Number(row.amount || 0), 0);
      out.push({ grantId, lineItemId: item.id, budget: Number(item.budget || 0), spent: liSpent, projected: liProjected, total: liSpent + liProjected, remaining: Number(item.budget || 0) - liSpent - liProjected });
    }
  }
  return out;
}

async function loadGrantDocs(grantIds: string[], orgId: string): Promise<Map<string, Record<string, unknown>>> {
  const refs = grantIds.map((id) => db.collection("grants").doc(id));
  const snaps = refs.length ? await db.getAll(...refs) : [];
  const grants = new Map<string, Record<string, unknown>>();
  for (const snap of snaps) {
    if (!snap.exists) throw new Error(`grant_not_found:${snap.id}`);
    const data = { id: snap.id, ...(snap.data() || {}) } as Record<string, unknown>;
    const grantOrg = normId(data.orgId);
    if (grantOrg && orgId && grantOrg !== orgId) throw new Error(`unauthorized:${snap.id}`);
    grants.set(snap.id, data);
  }
  return grants;
}

async function loadRowsForGrant(grantId: string, grant: Record<string, unknown>): Promise<TGrantBudgetManagerRow[]> {
  const [ledgerSnap, queueSnap] = await Promise.all([
    db.collection("ledger").where("grantId", "==", grantId).get(),
    db.collection("paymentQueue").where("grantId", "==", grantId).where("queueStatus", "==", "pending").get(),
  ]);
  const rows: TGrantBudgetManagerRow[] = [];
  const grantName = String(grant.name || grantId);
  for (const doc of ledgerSnap.docs) {
    const row = { id: doc.id, ...(doc.data() || {}) } as Record<string, unknown>;
    const amount = amountFromLedger(row);
    const date = date10(row.dueDate, row.date, row.createdAt, doc.updateTime);
    const updatedAt = sourceUpdatedAt(row) || toIso(doc.updateTime);
    const normalized: TGrantBudgetManagerRow = {
      rowId: doc.id,
      sourceType: "ledger",
      sourceId: doc.id,
      ledgerItemId: doc.id,
      paymentQueueItemId: null,
      grantId,
      lineItemId: row.lineItemId ? String(row.lineItemId) : null,
      customerId: row.customerId ? String(row.customerId) : null,
      customerName: row.customerNameAtSpend ? String(row.customerNameAtSpend) : null,
      caseManagerId: row.caseManagerId ? String(row.caseManagerId) : null,
      caseManagerName: row.caseManagerNameAtSpend ? String(row.caseManagerNameAtSpend) : null,
      amount,
      date,
      serviceDate: date,
      paymentDate: date,
      description: Array.isArray(row.note) ? row.note.map(String).join(" | ") : String(row.note ?? row.comment ?? ""),
      memo: row.comment ? String(row.comment) : null,
      category: row.lineItemLabelAtSpend ? String(row.lineItemLabelAtSpend) : null,
      vendor: row.vendor ? String(row.vendor) : null,
      status: row.paid === false ? "open" : "posted",
      isWritable: true,
      lockedReason: null,
      rowState: "clean",
      original: { grantId, lineItemId: row.lineItemId ? String(row.lineItemId) : null, customerId: row.customerId ? String(row.customerId) : null, caseManagerId: row.caseManagerId ? String(row.caseManagerId) : null, amount, date, serviceDate: date, paymentDate: date, description: Array.isArray(row.note) ? row.note.map(String).join(" | ") : String(row.note ?? row.comment ?? ""), memo: row.comment ? String(row.comment) : null, category: row.lineItemLabelAtSpend ? String(row.lineItemLabelAtSpend) : null, vendor: row.vendor ? String(row.vendor) : null, status: row.paid === false ? "open" : "posted", updatedAt },
    };
    (normalized as Record<string, unknown>).grantName = grantName;
    rows.push(normalized);
  }
  for (const doc of queueSnap.docs) {
    const row = { id: doc.id, ...(doc.data() || {}) } as Record<string, unknown>;
    const amount = Number(row.amount || 0);
    const date = date10(row.dueDate, row.createdAt, doc.updateTime);
    const updatedAt = sourceUpdatedAt(row) || toIso(doc.updateTime);
    const normalized: TGrantBudgetManagerRow = {
      rowId: doc.id,
      sourceType: "paymentQueue",
      sourceId: doc.id,
      ledgerItemId: row.ledgerEntryId ? String(row.ledgerEntryId) : null,
      paymentQueueItemId: doc.id,
      grantId,
      lineItemId: row.lineItemId ? String(row.lineItemId) : null,
      customerId: row.customerId ? String(row.customerId) : null,
      customerName: row.customer ? String(row.customer) : null,
      caseManagerId: row.caseManagerId ? String(row.caseManagerId) : null,
      caseManagerName: row.caseManagerName ? String(row.caseManagerName) : null,
      amount,
      date,
      serviceDate: date,
      paymentDate: null,
      description: String(row.note ?? row.notes ?? row.purpose ?? row.descriptor ?? ""),
      memo: row.notes ? String(row.notes) : null,
      category: row.expenseType ? String(row.expenseType) : null,
      vendor: row.merchant ? String(row.merchant) : null,
      status: "pending",
      isWritable: true,
      lockedReason: null,
      rowState: "clean",
      original: { grantId, lineItemId: row.lineItemId ? String(row.lineItemId) : null, customerId: row.customerId ? String(row.customerId) : null, caseManagerId: row.caseManagerId ? String(row.caseManagerId) : null, amount, date, serviceDate: date, paymentDate: null, description: String(row.note ?? row.notes ?? row.purpose ?? row.descriptor ?? ""), memo: row.notes ? String(row.notes) : null, category: row.expenseType ? String(row.expenseType) : null, vendor: row.merchant ? String(row.merchant) : null, status: "pending", updatedAt },
    };
    (normalized as Record<string, unknown>).grantName = grantName;
    rows.push(normalized);
  }
  return rows;
}

export async function loadGrantBudgetManager(orgId: string, grantIds: string[]): Promise<TGrantBudgetManagerLoadResp> {
  const ids = Array.from(new Set(grantIds.map((id) => String(id || "").trim()).filter(Boolean)));
  const grants = await loadGrantDocs(ids, orgId);
  const lineItems = Array.from(grants.entries()).flatMap(([grantId, grant]) => lineItemsForGrant(grantId, grant));
  const rows = (await Promise.all(Array.from(grants.entries()).map(([grantId, grant]) => loadRowsForGrant(grantId, grant)))).flat();
  const rollups = rollupsFromRows(grants, rows);
  return { ok: true, grants: Array.from(grants.values()), lineItems, rows, rollups, loadedAt: isoNow() };
}

function validateLineItem(grants: Map<string, Record<string, unknown>>, row: TGrantBudgetManagerRow): string | null {
  const grant = grants.get(row.grantId);
  if (!grant) return "invalid_grant";
  if (!row.lineItemId) return "grant_lineitem_pair_required";
  const li = lineItemsForGrant(row.grantId, grant).find((item) => item.id === row.lineItemId);
  if (!li) return "invalid_line_item";
  if (li.locked) return "locked_line_item";
  return null;
}

async function isStale(row: TGrantBudgetManagerRow): Promise<boolean> {
  const originalUpdatedAt = row.original?.updatedAt ? String(row.original.updatedAt) : "";
  if (!originalUpdatedAt || row.sourceType === "newProjection") return false;
  const collection = row.sourceType === "ledger" ? "ledger" : "paymentQueue";
  const id = row.sourceType === "ledger" ? row.ledgerItemId || row.sourceId : row.paymentQueueItemId || row.sourceId;
  if (!id) return true;
  const snap = await db.collection(collection).doc(id).get();
  if (!snap.exists) return true;
  const current = sourceUpdatedAt(snap.data() || {}) || toIso(snap.updateTime) || "";
  return !!current && current !== originalUpdatedAt;
}

export async function saveGrantBudgetManager(
  orgId: string,
  grantIds: string[],
  rows: TGrantBudgetManagerRow[],
  mode: "preview" | "applyOpen" | "applyAll",
  actor: ClaimsLike,
  reason?: string,
): Promise<TGrantBudgetManagerSaveResp> {
  const dryRun = mode === "preview";
  const grants = await loadGrantDocs(grantIds, orgId);
  const changedRows = rows.filter(changed);
  const skipped: Array<{ rowId: string; sourceId?: string | null; reason: string }> = [];
  const failed: Array<{ rowId: string; sourceId?: string | null; error: string }> = [];
  const ledgerItems: Array<Record<string, unknown>> = [];
  let updated = 0;
  let created = 0;
  let removed = 0;
  const affected = new Set<string>();

  for (const row of changedRows) {
    const sourceId = row.sourceId || row.ledgerItemId || row.paymentQueueItemId || null;
    const validation = validateLineItem(grants, row);
    if (validation) { skipped.push({ rowId: row.rowId, sourceId, reason: validation }); continue; }
    if (await isStale(row)) { skipped.push({ rowId: row.rowId, sourceId, reason: "stale_source_row" }); continue; }

    if (row.sourceType === "newProjection" || row.rowState === "new") {
      if (!dryRun) {
        await createManualProjectionQueueItem({
          orgId,
          grantId: row.grantId,
          lineItemId: row.lineItemId || null,
          amount: Number(row.amount || 0),
          dueDate: date10(row.date, row.serviceDate),
          customerId: row.customerId || null,
          customerName: row.customerName || null,
          caseManagerId: row.caseManagerId || null,
          caseManagerName: row.caseManagerName || null,
          vendor: row.vendor || null,
          note: row.description || row.memo || null,
          actorUid: actor.uid || null,
        });
      }
      created += 1;
      affected.add(row.grantId);
      continue;
    }

    if (row.sourceType === "paymentQueue") {
      const id = row.paymentQueueItemId || row.sourceId;
      if (!id) { failed.push({ rowId: row.rowId, sourceId, error: "missing_source" }); continue; }
      if (row.rowState === "deleted") {
        if (!dryRun) removed += await voidPaymentQueueItems(id, actor.uid || undefined);
        else removed += 1;
        affected.add(row.grantId);
        continue;
      }
      if (!dryRun) {
        await patchPaymentQueueItem(id, {
          amount: Number(row.amount || 0),
          grantId: row.grantId,
          lineItemId: row.lineItemId || null,
          customerId: row.customerId || null,
          merchant: row.vendor || undefined,
          notes: row.memo || undefined,
          note: row.description || undefined,
          expenseType: row.category || undefined,
          localModificationReason: reason || "Budget Manager edit",
        }, actor.uid || undefined);
      }
      updated += 1;
      affected.add(row.grantId);
      continue;
    }

    if (row.sourceType === "ledger") {
      const id = row.ledgerItemId || row.sourceId;
      if (!id) { failed.push({ rowId: row.rowId, sourceId, error: "missing_source" }); continue; }
      if (mode === "applyOpen") { skipped.push({ rowId: row.rowId, sourceId, reason: "closed_ledger_apply_open" }); continue; }
      if (row.rowState === "deleted") { skipped.push({ rowId: row.rowId, sourceId, reason: "unsupported_source_action" }); continue; }
      ledgerItems.push({
        entryId: id,
        amount: Number(row.amount || 0),
        grantId: row.grantId,
        lineItemId: row.lineItemId || null,
        customerId: row.customerId || null,
        caseManagerId: row.caseManagerId || null,
        dueDate: date10(row.date, row.paymentDate, row.serviceDate),
        vendor: row.vendor || null,
        comment: row.memo || row.description || null,
        note: row.description || null,
      });
      affected.add(row.grantId);
      updated += 1;
    }
  }

  if (ledgerItems.length && !dryRun) {
    const result = await bulkAdjustLedgerEntries(orgId, ledgerItems as any, {
      reason: reason || "Budget Manager edit",
      user: { uid: actor.uid || null, email: actor.email || null, name: actor.name || actor.displayName || null },
    });
    for (const item of result.skipped) skipped.push({ rowId: item.entryId, sourceId: item.entryId, reason: item.reason });
    for (const item of result.failed) failed.push({ rowId: item.entryId, sourceId: item.entryId, error: item.error });
    for (const grantId of result.affectedGrantIds) affected.add(grantId);
  }

  const grantsRecomputed: string[] = [];
  if (!dryRun) {
    for (const grantId of affected) {
      const res = await recomputeGrantBudgetFromLedger(grantId).catch((err) => {
        failed.push({ rowId: grantId, sourceId: grantId, error: err instanceof Error ? err.message : String(err) });
        return null;
      });
      if (res?.recomputed) grantsRecomputed.push(grantId);
    }
  }
  const loaded = await loadGrantBudgetManager(orgId, grantIds);
  return { ok: true, dryRun, updated, created, removed, skipped, failed, grantsRecomputed, rollups: loaded.rollups };
}

export async function reconcileGrantBudgetManager(orgId: string, grantIds: string[]): Promise<TGrantBudgetManagerReconcileResp> {
  const before = (await loadGrantBudgetManager(orgId, grantIds)).rollups;
  const affectedGrantIds: string[] = [];
  const skipped: Array<{ grantId: string; reason: string }> = [];
  const failed: Array<{ grantId: string; error: string }> = [];
  await loadGrantDocs(grantIds, orgId);
  for (const grantId of grantIds) {
    try {
      const res = await recomputeGrantBudgetFromLedger(grantId);
      if (res.recomputed) affectedGrantIds.push(grantId);
      else skipped.push({ grantId, reason: res.skipped || "not_recomputed" });
    } catch (err) {
      failed.push({ grantId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  const after = (await loadGrantBudgetManager(orgId, grantIds)).rollups;
  return { ok: true, affectedGrantIds, before, after, skipped, failed };
}
