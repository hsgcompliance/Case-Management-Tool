// functions/src/features/payments/recalcFuture.ts
/**
 * POST /paymentsRecalculateFuture
 * Reprices *future, unpaid* MONTHLY payments.
 *
 * Modes:
 *  - Single enrollment: { enrollmentId, newMonthlyAmount, ... }
 *    -> applies budget delta IN THE SAME TRANSACTION (atomic)
 *  - Grant bulk:        { grantId, newMonthlyAmount, ... }
 *    -> updates enrollments, then runs authoritative budget recompute
 *       (prevents drift + reduces grant-doc contention)
 *
 * Notes:
 *  - Uses canonical request schema from contracts (via ./schemas).
 *  - Hardens date + id filtering:
 *      * If projectionIds provided => ONLY touch payments with an id in that set.
 *      * Invalid dueDate => skip (do not modify).
 *      * Missing lineItemId => skip (don’t drift budgets silently).
 */

import { computeBudgetTotals, toDateOnly, db, FieldValue, secureHandler } from "../../core";
import type { Request, Response } from "express";

import { assertOrgAccess, assertOrgAccessMaybe, requireUid } from "./utils";
import { PaymentsRecalculateFutureReq } from "./schemas";

// TODO: replace this import path/name with your real recalc function.
// The intent is: one shared function used by both endpoint + internal calls.
import { recalcGrantProjectedForGrant } from "./recalcGrantProjected";

// Helpers
const todayISO = () => toDateOnly(new Date());
const isMonthly = (p: any) => String(p?.type || "").toLowerCase() === "monthly";

/**
 * dueDate rules:
 *  - missing/blank dueDate => treat as future (defensive)
 *  - invalid dueDate => SKIP (do not modify)
 *  - valid => compare ISO10 strings (UTC)
 */
function isFutureDue(p: any, fromISO: string) {
  const raw = p?.dueDate;
  const hasField = raw != null && String(raw).trim() !== "";
  if (!hasField) return true;

  const iso = toDateOnly(raw);
  if (!iso) return false; // invalid dueDate => skip
  return iso >= fromISO;
}

function computeDeltaAndUpdateList(
  payments: any[],
  newMonthlyAmount: number,
  opts: { ids?: Set<string>; li?: string | null; fromISO: string }
) {
  const ids = opts.ids;
  const liFilter = opts.li ? String(opts.li) : null;

  let deltaByLI: Record<string, number> = {};

  const next = (payments || []).map((p) => {
    if (!isMonthly(p)) return p;
    if (p?.paid) return p;

    // If caller provided projectionIds, ONLY touch items that have an id AND are in the set.
    if (ids) {
      const pid = p?.id ? String(p.id) : "";
      if (!pid || !ids.has(pid)) return p;
    }

    if (!isFutureDue(p, opts.fromISO)) return p;

    // lineItem filter (and a consistency guard: monthly without LI is budget-unsafe)
    const li = String(p?.lineItemId || "");
    if (liFilter && li !== liFilter) return p;
    if (!li) return p;

    const before = Number(p?.amount || 0) || 0;
    const after = Number(newMonthlyAmount);

    deltaByLI[li] = (deltaByLI[li] || 0) + (after - before);
    return { ...p, amount: after };
  });

  return { next, deltaByLI };
}

async function applyBudgetDeltaInTxn(
  tx: FirebaseFirestore.Transaction,
  user: any,
  grantId: string,
  deltaByLI: Record<string, number>
) {
  if (!Object.keys(deltaByLI).length) return;

  const gRef = db.collection("grants").doc(grantId);
  const gSnap = await tx.get(gRef);
  if (!gSnap.exists) throw new Error("Grant not found");
  const grant: any = gSnap.data() || {};
  assertOrgAccessMaybe(user, grant);

  const items = Array.isArray(grant?.budget?.lineItems) ? grant.budget.lineItems.slice() : [];
  const byId: Record<string, any> = Object.fromEntries(items.map((li: any) => [String(li.id), li]));

  for (const [k, d] of Object.entries(deltaByLI)) {
    const li = byId[String(k)];
    if (!li) throw new Error(`Unknown lineItemId: ${k}`);
    if (li.locked) throw new Error(`Line item locked: ${k}`);
    li.projected = Math.max(0, Number(li.projected || 0) + Number(d || 0));
  }

  const baseTotals = computeBudgetTotals(items as any[]);

  const existingTotals =
    grant?.budget?.totals && typeof grant.budget.totals === "object"
      ? grant.budget.totals
      : {};

  const nextTotals = {
    ...existingTotals,         // preserve window totals etc
    ...baseTotals,             // update base fields (balance/remaining/etc)
    remaining: baseTotals.balance, // keep legacy mapping consistent
  };

  tx.update(gRef, {
    "budget.lineItems": items,
    "budget.total": baseTotals.total,
    "budget.totals": nextTotals,
    "budget.updatedAt": FieldValue.serverTimestamp(),

    // single-enrollment delta update cannot safely recompute window totals
    "budget.needsRecalc": true,
    "budget.needsRecalcAt": FieldValue.serverTimestamp(),
  });
}

/** Inner impl so we can reuse for secure wrapper */
export async function paymentsRecalculateFutureHandler(req: Request, res: Response) {
  const parsed = PaymentsRecalculateFutureReq.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });

  const user: any = (req as any)?.user || {};
  try {
    requireUid(user);
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: e?.message || "auth_required" });
  }

  // Branch by payload shape (schema is union)
  if ("enrollmentId" in parsed.data) {
    const { enrollmentId, newMonthlyAmount, projectionIds, lineItemId, effectiveFrom, dryRun = false } = parsed.data;

    const fromISO = toDateOnly(effectiveFrom || todayISO());
    if (!fromISO) return res.status(400).json({ ok: false, error: "invalid_effectiveFrom" });

    const idSet = projectionIds?.length ? new Set(projectionIds.map(String)) : undefined;

    try {
      let result: any = null;

      if (!dryRun) {
        result = await db.runTransaction(async (tx) => {
          const eRef = db.collection("customerEnrollments").doc(enrollmentId);
          const eSnap = await tx.get(eRef);
          if (!eSnap.exists) throw { status: 404, message: "Enrollment not found" };

          const data: any = eSnap.data() || {};
          assertOrgAccess(user, data);

          const payments = Array.isArray(data.payments) ? data.payments : [];
          const { next, deltaByLI } = computeDeltaAndUpdateList(payments, newMonthlyAmount, {
            ids: idSet,
            li: lineItemId || null,
            fromISO,
          });

          if (!Object.keys(deltaByLI).length) {
            return { id: enrollmentId, payments, noChange: true };
          }

          const grantId = String(data.grantId || "");
          if (!grantId) throw new Error("Enrollment missing grantId");

          // Atomic: update grant budget + enrollment in same txn
          await applyBudgetDeltaInTxn(tx, user, grantId, deltaByLI);

          tx.set(eRef, { payments: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          return { id: enrollmentId, payments: next, deltaByLI };
        });
      } else {
        const snap = await db.collection("customerEnrollments").doc(enrollmentId).get();
        if (!snap.exists) throw { status: 404, message: "Enrollment not found" };

        const data: any = snap.data() || {};
        assertOrgAccess(user, data);

        const payments = Array.isArray(data.payments) ? data.payments : [];
        const { next, deltaByLI } = computeDeltaAndUpdateList(payments, newMonthlyAmount, {
          ids: idSet,
          li: lineItemId || null,
          fromISO,
        });

        result = {
          id: enrollmentId,
          preview: { deltaByLI, willUpdate: Object.keys(deltaByLI).length > 0 },
          sample: next.slice(0, 3),
        };
      }

      return res.status(200).json({ ok: true, mode: "single", fromISO, dryRun, ...result });
    } catch (err: any) {
      return res
        .status(err?.status || 500)
        .json({ ok: false, error: err?.message || "Failed to recalc future payments" });
    }
  }

  // Grant-bulk mode (authoritative budget recompute; no delta math)
  const { grantId, newMonthlyAmount, lineItemId, effectiveFrom, dryRun = false } = parsed.data as {
    grantId: string;
    newMonthlyAmount: number;
    lineItemId?: string;
    effectiveFrom?: string;
    dryRun?: boolean;
  };

  const fromISO = toDateOnly(effectiveFrom || todayISO());
  if (!fromISO) return res.status(400).json({ ok: false, error: "invalid_effectiveFrom" });

  try {
    const q = await db.collection("customerEnrollments").where("grantId", "==", grantId).get();
    const ids = q.docs.map((d) => d.id);

    const stats = { touched: 0, noChange: 0, errors: 0 };
    const summaries: Array<{ enrollmentId: string; deltaByLI: Record<string, number> }> = [];

    for (const eid of ids) {
      try {
        if (!dryRun) {
          const out = await db.runTransaction(async (tx) => {
            const eRef = db.collection("customerEnrollments").doc(eid);
            const eSnap = await tx.get(eRef);
            if (!eSnap.exists) return { skip: true };

            const data: any = eSnap.data() || {};
            assertOrgAccess(user, data);

            const payments = Array.isArray(data.payments) ? data.payments : [];
            const { next, deltaByLI } = computeDeltaAndUpdateList(payments, newMonthlyAmount, {
              ids: undefined,
              li: lineItemId || null,
              fromISO,
            });

            if (!Object.keys(deltaByLI).length) return { noChange: true };

            // Enrollment update only
            tx.set(eRef, { payments: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            return { deltaByLI };
          });

          if (out?.noChange) stats.noChange++;
          else if (!out?.skip) {
            stats.touched++;
            summaries.push({ enrollmentId: eid, deltaByLI: out.deltaByLI || {} });
          }
        } else {
          const snap = await db.collection("customerEnrollments").doc(eid).get();
          if (!snap.exists) continue;

          const data: any = snap.data() || {};
          assertOrgAccess(user, data);

          const payments = Array.isArray(data.payments) ? data.payments : [];
          const { deltaByLI } = computeDeltaAndUpdateList(payments, newMonthlyAmount, {
            ids: undefined,
            li: lineItemId || null,
            fromISO,
          });

          if (Object.keys(deltaByLI).length) {
            stats.touched++;
            summaries.push({ enrollmentId: eid, deltaByLI });
          } else {
            stats.noChange++;
          }
        }
      } catch {
        stats.errors++;
      }
    }

    // Authoritative budget recompute after bulk edits (prevents drift)
    if (!dryRun && stats.touched > 0) {
      try {
        await recalcGrantProjectedForGrant({ grantId, user });
      } catch (e: any) {
        return res.status(500).json({
          ok: false,
          error: e?.message || "budget_recalc_failed",
          grantId,
          fromISO,
          dryRun,
          stats,
          summaries,
        });
      }
    }

    return res.status(200).json({ ok: true, mode: "grant", grantId, fromISO, dryRun, stats, summaries });
  } catch (err: any) {
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Failed to recalc future payments (grant)" });
  }
}

export const paymentsRecalculateFuture = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsRecalculateFutureHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
