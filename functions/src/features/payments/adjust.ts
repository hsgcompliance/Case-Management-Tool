// functions/src/features/payments/adjust.ts
/**
 * Payments Adjust "router"
 *
 * Why this exists:
 * - Spending (ledger) is append-only truth.
 * - Enrollment.spends is a UI-friendly mirror, NOT the authoritative ledger.
 *
 * Two operations:
 *
 * 1) adjustSpend (POST /paymentsAdjustSpend)
 *    - Adjusts a previous spend (amount, lineItemId, dueDate, vendor/comment/note snapshot fields).
 *    - Writes TWO ledger rows:
 *        a) reversal of the ORIGINAL ledger row (negative old amount)
 *        b) new corrected ledger row (positive new amount)
 *    - Updates the enrollment spend record IN PLACE (same spendId) for a clean UX.
 *    - Applies budget deltas immediately, and also sets budget.needsRecalc = true as a guardrail.
 *
 * 2) adjustProjections (POST /paymentsAdjustProjections)
 *    - Deterministic upsert of schedule projections.
 *    - Default behavior: "replaceUnpaid" => keep existing paid payments, replace unpaid with incoming.
 */

import {
  db,
  FieldValue,
  Timestamp,
  secureHandler,
  computeBudgetTotals,
  removeUndefinedDeep,
  makeIdempoKey,
  ensureIdempotent,
  withTxn,
} from "../../core";
import type { Request, Response } from "express";

import { writeLedgerEntry } from "../ledger/service";

import {
  assertOrgAccess,
  requireUid,
  getGrantWindowISO,
  isInGrantWindow,
  ensureMonthlySubtypeTag,
  ensurePaymentIds,
} from "./utils";

import {
  PaymentsAdjustSpendBody,
  PaymentsAdjustProjectionsBody,
} from "./schemas";
import type {
  TPaymentsAdjustSpendBody,
  TPaymentsAdjustProjectionsBody,
} from "./schemas";

// -----------------------------
// Small helpers (local, explicit)
// -----------------------------
const iso10 = (v: any) => String(v || "").slice(0, 10);

function toCents(val: any): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function normalizeNoteInput(note: unknown): string[] {
  const raw = Array.isArray(note) ? note : note != null ? [note] : [];
  return raw
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

function asMaybeString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

// ------------------------------------
// 1) Adjust a past spend (paid payment)
// ------------------------------------
export async function paymentsAdjustSpendHandler(req: Request, res: Response) {
  const parsed = PaymentsAdjustSpendBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.message });
  }

  const { enrollmentId, spendId, paymentId: paymentIdHint, patch, reason } =
    parsed.data as TPaymentsAdjustSpendBody;

  const user: any = (req as any)?.user || {};
  let uid = "";
  try {
    uid = requireUid(user);
  } catch (e: any) {
    return res
      .status(401)
      .json({ ok: false, error: e?.message || "auth_required" });
  }

  const externalIdempoRaw =
    String((req.headers["idempotency-key"] as any) || "").trim() || null;

  try {
    await withTxn(async (trx) => {
      // ---- load enrollment ----
      const eRef = db.collection("customerEnrollments").doc(enrollmentId);
      const eSnap = await trx.get(eRef);
      if (!eSnap.exists) throw new Error("Enrollment not found");
      const e: any = eSnap.data() || {};
      assertOrgAccess(user, e);

      // ---- resolve spend from subcollection ----
      // spendId may be absent or stale (enrollment.spends[] no longer written after 50-cap fix).
      // Fall back to querying the subcollection by paymentId to find the latest positive, non-reversal spend.
      let spendRef: any = null;
      let spendSnap: any = null;

      if (spendId) {
        const candidateRef = eRef.collection("spends").doc(spendId);
        const candidateSnap = await trx.get(candidateRef);
        if (candidateSnap.exists) {
          spendRef = candidateRef;
          spendSnap = candidateSnap;
        }
      }

      if (!spendSnap) {
        const lookupId = paymentIdHint || "";
        if (!lookupId) throw new Error("Spend not found — provide spendId or paymentId");
        const qs = await trx.get(eRef.collection("spends").where("paymentId", "==", lookupId));
        const eligible = qs.docs
          .filter((d: any) => Number(d.data()?.amount || 0) > 0 && !d.data()?.reversalOf)
          .sort((a: any, b: any) =>
            Number(b.data()?.ts?.toMillis?.() ?? 0) - Number(a.data()?.ts?.toMillis?.() ?? 0)
          )[0];
        if (!eligible) throw new Error("Spend not found");
        spendRef = eligible.ref;
        spendSnap = eligible;
      }

      const oldSpend: any = spendSnap.data() || {};

      // Guardrails: only adjust a positive spend (not a reversal record)
      const oldAmt = Number(oldSpend?.amount || 0);
      const oldAmtCents = Number.isFinite(Number(oldSpend?.amountCents))
        ? Number(oldSpend.amountCents)
        : toCents(oldAmt);

      if (!Number.isFinite(oldAmt) || oldAmt <= 0) {
        throw new Error("Only positive spends can be adjusted (not reversals)");
      }
      if (oldSpend?.reversalOf) {
        throw new Error(
          "Cannot adjust a reversal spend; adjust the original spend instead"
        );
      }

      const paymentId = String(oldSpend?.paymentId || "");
      if (!paymentId) throw new Error("Spend missing paymentId");

      const oldLineItemId = String(oldSpend?.lineItemId || "");
      if (!oldLineItemId) throw new Error("Spend missing lineItemId");

      const oldDueDateISO =
        iso10(oldSpend?.dueDate) || iso10(oldSpend?.paymentSnapshot?.dueDate) || "";
      if (!oldDueDateISO)
        throw new Error("Spend missing dueDate (cannot window correctly)");

      // ---- compute new values ----
      const nextAmount = patch.amount != null ? Number(patch.amount) : oldAmt;
      if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
        throw new Error("Invalid patch.amount");
      }
      const nextAmountCents = toCents(nextAmount);

      const nextLineItemId =
        patch.lineItemId != null ? String(patch.lineItemId) : oldLineItemId;

      const nextDueDateISO =
        patch.dueDate != null ? iso10(patch.dueDate) : oldDueDateISO;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDateISO)) {
        throw new Error("Invalid patch.dueDate (expected YYYY-MM-DD)");
      }

      const nextVendor =
        patch.vendor !== undefined
          ? patch.vendor
          : oldSpend?.paymentSnapshot?.vendor;

      const nextComment =
        patch.comment !== undefined
          ? patch.comment
          : oldSpend?.paymentSnapshot?.comment;

      const oldNoteArr = normalizeNoteInput(oldSpend?.note);
      const patchNoteArr = patch.note != null ? normalizeNoteInput(patch.note) : [];
      const mergedNote = Array.from(
        new Set([
          ...oldNoteArr,
          ...patchNoteArr,
          reason ? `adjust:${String(reason).trim()}` : "",
        ])
      )
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 10);

      // If nothing meaningfully changes, no-op cleanly.
      const noChange =
        nextAmountCents === oldAmtCents &&
        nextLineItemId === oldLineItemId &&
        nextDueDateISO === oldDueDateISO &&
        asMaybeString(nextVendor) === asMaybeString(oldSpend?.paymentSnapshot?.vendor) &&
        asMaybeString(nextComment) === asMaybeString(oldSpend?.paymentSnapshot?.comment) &&
        JSON.stringify(mergedNote) === JSON.stringify(oldNoteArr);

      if (noChange) return;

      // ---- load grant + budget line items ----
      const grantId = String(e.grantId || "");
      if (!grantId) throw new Error("Enrollment missing grantId");

      const gRef = db.collection("grants").doc(grantId);
      const gSnap = await trx.get(gRef);
      if (!gSnap.exists) throw new Error("Grant not found");
      const grant: any = gSnap.data() || {};
      assertOrgAccess(user, grant);

      const lineItems: any[] = Array.isArray(grant?.budget?.lineItems)
        ? grant.budget.lineItems
        : [];

      const oldLI = lineItems.find((x: any) => String(x?.id) === oldLineItemId);
      if (!oldLI) throw new Error(`Line item missing (old): ${oldLineItemId}`);
      if (oldLI.locked) throw new Error(`Line item locked (old): ${oldLineItemId}`);

      const nextLI = lineItems.find((x: any) => String(x?.id) === nextLineItemId);
      if (!nextLI) throw new Error(`Line item missing (new): ${nextLineItemId}`);
      if (nextLI.locked) throw new Error(`Line item locked (new): ${nextLineItemId}`);

      // ---- idempotency (single key gates the whole adjust operation) ----
      const computedKey = makeIdempoKey([
        "paymentsAdjustSpend",
        enrollmentId,
        spendId,
        nextAmountCents,
        nextLineItemId,
        nextDueDateISO,
        asMaybeString(nextVendor) || "",
        asMaybeString(nextComment) || "",
        mergedNote.join("|"),
      ]);

      const idemKey = externalIdempoRaw
        ? makeIdempoKey([computedKey, "hdr", externalIdempoRaw])
        : computedKey;

      const idem = await ensureIdempotent(trx, idemKey, {
        enrollmentId,
        spendId,
        paymentId,
        oldAmountCents: oldAmtCents,
        newAmountCents: nextAmountCents,
        oldLineItemId,
        newLineItemId: nextLineItemId,
        oldDueDate: oldDueDateISO,
        newDueDate: nextDueDateISO,
        byUid: uid,
        externalIdempotencyKey: externalIdempoRaw
          ? externalIdempoRaw.slice(0, 200)
          : null,
      });
      if ((idem as any).already) return;

      // Ensure the paid payment row exists; otherwise the UI will see no visible change
      // even though ledger/spend adjustments were written.
      const embeddedPayments: any[] = Array.isArray(e.payments) ? e.payments : [];
      const paymentIdx = embeddedPayments.findIndex((p: any) => String(p?.id || "") === paymentId);
      if (paymentIdx < 0) {
        throw new Error(`Payment row not found on enrollment for spend.paymentId: ${paymentId}`);
      }
      const prevPay = { ...(embeddedPayments[paymentIdx] || {}) };
      const fallbackCustomerNameAtSpend =
        oldSpend?.customerNameAtSpend ??
        e?.customerName ??
        e?.clientName ??
        null;
      const fallbackPaymentLabelAtSpend =
        oldSpend?.paymentLabelAtSpend ??
        `${nextDueDateISO ? `${nextDueDateISO} · ` : ""}${String(prevPay?.type || oldSpend?.paymentSnapshot?.type || "payment")}`;

      // ---- ledger: write reversal + new corrected entry (append-only truth) ----
      const tsNow = Timestamp.now();

      const reversalLedgerId = `ladj_rev_${idemKey}`;
      const newLedgerId = `ladj_new_${idemKey}`;

      writeLedgerEntry(trx, {
        id: reversalLedgerId,
        source: "adjustment",
        orgId: grant?.orgId ?? null,

        amountCents: -oldAmtCents,
        amount: -(oldAmtCents / 100),

        grantId,
        lineItemId: oldLineItemId,
        enrollmentId,
        paymentId,
        customerId: String(e.customerId || e.clientId || "") || null,
        caseManagerId: oldSpend?.caseManagerId ?? null,

        note: mergedNote.length ? mergedNote : null,
        vendor: asMaybeString(oldSpend?.paymentSnapshot?.vendor),
        comment: asMaybeString(oldSpend?.paymentSnapshot?.comment),
        labels: ["adjustment", `reversalOf:${spendId}`],

        ts: tsNow,
        dueDate: oldDueDateISO,
        month: oldDueDateISO.slice(0, 7),

        origin: {
          app: "hdb",
          baseId: paymentId,
          sourcePath: `customerEnrollments/${enrollmentId}/spends/${spendId}`,
          idempotencyKey: idemKey,
        },

        grantNameAtSpend: oldSpend?.grantNameAtSpend ?? null,
        lineItemLabelAtSpend: oldSpend?.lineItemLabelAtSpend ?? null,
        customerNameAtSpend: fallbackCustomerNameAtSpend,
        paymentLabelAtSpend: oldSpend?.paymentLabelAtSpend ?? fallbackPaymentLabelAtSpend,

        createdAt: tsNow,
        updatedAt: tsNow,
      });

      writeLedgerEntry(trx, {
        id: newLedgerId,
        source: "adjustment",
        orgId: grant?.orgId ?? null,

        amountCents: nextAmountCents,
        amount: nextAmountCents / 100,

        grantId,
        lineItemId: nextLineItemId,
        enrollmentId,
        paymentId,
        customerId: String(e.customerId || e.clientId || "") || null,
        caseManagerId: oldSpend?.caseManagerId ?? null,

        note: mergedNote.length ? mergedNote : null,
        vendor: asMaybeString(nextVendor),
        comment: asMaybeString(nextComment),
        labels: ["adjustment", `adjusted:${spendId}`],

        ts: tsNow,
        dueDate: nextDueDateISO,
        month: nextDueDateISO.slice(0, 7),

        origin: {
          app: "hdb",
          baseId: paymentId,
          sourcePath: `customerEnrollments/${enrollmentId}/spends/${spendId}`,
          idempotencyKey: idemKey,
        },

        grantNameAtSpend: oldSpend?.grantNameAtSpend ?? null,
        lineItemLabelAtSpend:
          nextLI?.label ||
          nextLI?.name ||
          nextLI?.title ||
          nextLI?.code ||
          nextLI?.id ||
          null,
        customerNameAtSpend: fallbackCustomerNameAtSpend,
        paymentLabelAtSpend: oldSpend?.paymentLabelAtSpend ?? fallbackPaymentLabelAtSpend,

        createdAt: tsNow,
        updatedAt: tsNow,
      });

      // ---- enrollment spend: update IN PLACE for a smooth UX ----
      const updatedSpend = removeUndefinedDeep({
        ...oldSpend,

        id: spendId,
        amount: nextAmountCents / 100,
        amountCents: nextAmountCents,
        lineItemId: nextLineItemId,
        dueDate: nextDueDateISO,
        customerNameAtSpend: fallbackCustomerNameAtSpend,
        paymentLabelAtSpend: oldSpend?.paymentLabelAtSpend ?? fallbackPaymentLabelAtSpend,

        note: mergedNote.length ? mergedNote : oldSpend?.note,

        paymentSnapshot: {
          ...(oldSpend?.paymentSnapshot || {}),
          amount: nextAmountCents / 100,
          lineItemId: nextLineItemId,
          dueDate: nextDueDateISO,
          ...(patch.vendor !== undefined ? { vendor: nextVendor } : {}),
          ...(patch.comment !== undefined ? { comment: nextComment } : {}),
          ...(patch.note != null ? { note: mergedNote } : {}),
        },

        ts: tsNow,

        migratedFromSpendId: oldSpend?.migratedFromSpendId ?? null,
      });

      const nextPayments =
        paymentIdx >= 0
          ? (() => {
              const arr = embeddedPayments.slice();
              arr[paymentIdx] = removeUndefinedDeep({
                ...prevPay,
                amount: nextAmountCents / 100,
                lineItemId: nextLineItemId,
                dueDate: nextDueDateISO,
                ...(patch.vendor !== undefined ? { vendor: nextVendor } : {}),
                ...(patch.comment !== undefined ? { comment: nextComment } : {}),
                ...(patch.note != null ? { note: mergedNote } : {}),
              });
              return arr;
            })()
          : embeddedPayments;

      // ---- writes ----
      // Budget spent deltas are handled by the onLedgerWrite trigger which fires on the
      // two adjustment ledger entries written above. We only set needsRecalc here as a
      // guardrail so the weekly reconciler will verify correctness.
      trx.update(gRef, {
        "budget.needsRecalc": true,
        "budget.needsRecalcAt": FieldValue.serverTimestamp(),
      });

      trx.update(eRef, {
        payments: nextPayments,
        updatedAt: FieldValue.serverTimestamp(),
      });

      trx.set(spendRef, updatedSpend, { merge: false });

      const flagRef = db.collection("auditFlags").doc();
      trx.set(flagRef, {
        context: "paymentsAdjustSpend",
        enrollmentId,
        grantId,
        spendId,
        paymentId,
        old: {
          amountCents: oldAmtCents,
          lineItemId: oldLineItemId,
          dueDate: oldDueDateISO,
        },
        next: {
          amountCents: nextAmountCents,
          lineItemId: nextLineItemId,
          dueDate: nextDueDateISO,
        },
        ledger: { reversalLedgerId, newLedgerId },
        byUid: uid,
        ts: tsNow,
      });
    }, "paymentsAdjustSpend");

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[paymentsAdjustSpend] ERROR", err?.message, err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export const paymentsAdjustSpend = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsAdjustSpendHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

// --------------------------------------------
// 2) Adjust projections (schedule / unpaid only)
// --------------------------------------------
export async function paymentsAdjustProjectionsHandler(req: Request, res: Response) {
  const parsed = PaymentsAdjustProjectionsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.message });
  }

  const { enrollmentId, payments, replaceUnpaid } =
    parsed.data as TPaymentsAdjustProjectionsBody;

  const user: any = (req as any)?.user || {};
  let uid = "";
  try {
    uid = requireUid(user);
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: e?.message || "auth_required" });
  }

  try {
    const out = await db.runTransaction(async (trx) => {
      const eRef = db.collection("customerEnrollments").doc(enrollmentId);
      const eSnap = await trx.get(eRef);
      if (!eSnap.exists) throw new Error("Enrollment not found");

      const e: any = eSnap.data() || {};
      assertOrgAccess(user, e);

      const grantId = String(e.grantId || "");
      if (!grantId) throw new Error("Enrollment missing grantId");

      const gRef = db.collection("grants").doc(grantId);
      const gSnap = await trx.get(gRef);
      if (!gSnap.exists) throw new Error("Grant not found");
      const grant: any = gSnap.data() || {};
      assertOrgAccess(user, grant);

      const win = getGrantWindowISO(grant);

      const oldPayments: any[] = Array.isArray(e.payments) ? e.payments : [];

      const paidOld = oldPayments.filter((p: any) => !!p?.paid);
      const incoming = (payments || []).map((p: any) => ({
        ...p,
        paid: !!p?.paid,
        paidAt: p?.paid ? (p?.paidAt ?? null) : null,
      }));

      const targetList = replaceUnpaid ? [...paidOld, ...incoming] : incoming;

      // Basic validation (kept; contracts also validate, but this catches weird coerces)
      for (const p of targetList) {
        if (!p?.lineItemId || !Number(p?.amount) || !(p?.dueDate || p?.date)) {
          throw new Error("Each payment needs {lineItemId, amount, dueDate}");
        }
      }

      const normalized = targetList.map(ensureMonthlySubtypeTag);
      const withIds = ensurePaymentIds(normalized, oldPayments);

      const sumUnpaidByLI = (arr: any[]) =>
        arr.reduce((m, p) => {
          if (!p?.paid) {
            const k = String(p?.lineItemId || "");
            m[k] = (m[k] || 0) + Number(p?.amount || 0);
          }
          return m;
        }, {} as Record<string, number>);

      const sumUnpaidInWindowByLI = (arr: any[]) =>
        arr.reduce((m, p) => {
          if (!p?.paid && isInGrantWindow(p?.dueDate || p?.date, win)) {
            const k = String(p?.lineItemId || "");
            m[k] = (m[k] || 0) + Number(p?.amount || 0);
          }
          return m;
        }, {} as Record<string, number>);

      const oldUnpaid = sumUnpaidByLI(oldPayments);
      const newUnpaid = sumUnpaidByLI(withIds);

      const oldUnpaidWin = sumUnpaidInWindowByLI(oldPayments);
      const newUnpaidWin = sumUnpaidInWindowByLI(withIds);

      const lineItems: any[] = Array.isArray(grant?.budget?.lineItems)
        ? grant.budget.lineItems
        : [];

      const liById: Record<string, any> = Object.fromEntries(
        lineItems.map((li: any) => [String(li.id), li])
      );

      const touched = new Set([
        ...Object.keys(oldUnpaid),
        ...Object.keys(newUnpaid),
        ...Object.keys(oldUnpaidWin),
        ...Object.keys(newUnpaidWin),
      ]);

      for (const id of touched) {
        const li = liById[id];
        if (!li) throw new Error(`Unknown lineItemId: ${id}`);
        if (li.locked) throw new Error(`Line item locked: ${id}`);

        const prevProjected = Number(li.projected || 0);
        const delta = Number(newUnpaid[id] || 0) - Number(oldUnpaid[id] || 0);
        li.projected = Math.max(0, prevProjected + delta);

        const prevProjectedWin = Number(li.projectedInWindow || 0);
        const deltaWin =
          Number(newUnpaidWin[id] || 0) - Number(oldUnpaidWin[id] || 0);
        li.projectedInWindow = Math.max(0, prevProjectedWin + deltaWin);

        const cap = Number(li.amount || 0);
        const spent = Number(li.spent || 0);
        const overBy = Math.max(0, spent + Number(li.projected || 0) - cap);
        if (overBy > 0) li.overCap = overBy;
        else delete li.overCap;
      }

      const baseTotals = computeBudgetTotals(lineItems as any[]);
      const projectedInWindow = lineItems.reduce(
        (s: number, i: any) => s + Number(i?.projectedInWindow || 0),
        0
      );
      const spentInWindow = lineItems.reduce(
        (s: number, i: any) => s + Number(i?.spentInWindow || 0),
        0
      );

      const existingTotals =
        grant?.budget?.totals && typeof grant.budget.totals === "object"
          ? grant.budget.totals
          : {};

      const totals: any = {
        ...existingTotals,
        ...baseTotals,
        remaining: baseTotals.balance,
        projectedSpend: baseTotals.projectedSpend,
        projectedInWindow,
        spentInWindow,
        windowBalance: Number(baseTotals.total || 0) - spentInWindow,
        windowProjectedBalance:
          Number(baseTotals.total || 0) - (spentInWindow + projectedInWindow),
      };

      trx.update(gRef, {
        "budget.lineItems": lineItems,
        "budget.total": baseTotals.total,
        "budget.totals": totals,
        "budget.updatedAt": FieldValue.serverTimestamp(),

        "budget.needsRecalc": true,
        "budget.needsRecalcAt": FieldValue.serverTimestamp(),
      });

      trx.update(eRef, {
        payments: withIds,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const flagRef = db.collection("auditFlags").doc();
      trx.set(flagRef, {
        context: "paymentsAdjustProjections",
        enrollmentId,
        grantId,
        replaceUnpaid,
        byUid: uid,
        ts: Timestamp.now(),
      });

      return { enrollmentId, payments: withIds };
    });

    return res.status(200).json({ ok: true, ...out });
  } catch (err: any) {
    console.error("[paymentsAdjustProjections] ERROR", err?.message, err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export const paymentsAdjustProjections = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsAdjustProjectionsHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
