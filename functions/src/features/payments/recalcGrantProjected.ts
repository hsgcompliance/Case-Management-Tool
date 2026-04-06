// functions/src/features/payments/recalcGrantProjected.ts
/**
 * Full recompute projected/spent per lineItem.
 * POST /paymentsRecalcGrantProjected
 * Body: { grantId, effectiveFrom?, activeOnly?, source?, dryRun? }
 *
 * - projected = sum of unpaid enrollment payments w/ lineItemId (ALL TYPES)
 * - projectedInWindow = same, but dueDate within grant window
 * - spent:
 *    source=1 (default): recompute from /ledger (authoritative)
 *    source=2: recompute from enrollments' paid payments (legacy fallback)
 *
 * Notes:
 * - We intentionally DO NOT filter by effectiveFromISO here. Defaulting effectiveFrom
 *   to "today" would break correctness if used as a filter. Keep it as metadata only.
 * - Ledger rows are treated as append-only truth: reversals are negative amounts.
 */

import {
  computeBudgetTotals,
  toDateOnly,
  db,
  FieldValue,
  secureHandler,
  normId,
} from "../../core";
import type { Request, Response } from "express";

import { assertOrgAccessMaybe, getGrantWindowISO, isInGrantWindow } from "./utils";
import type { GrantWindowISO } from "./utils";

import { PaymentsRecalcGrantProjectedBody } from "./schemas";
import type { TPaymentsRecalcGrantProjectedBody } from "./schemas";

type RecalcOpts = {
  effectiveFromISO: string; // metadata only
  activeOnly: boolean;
  source: 1 | 2; // 1=ledger authoritative, 2=enrollment legacy
};

const todayISO = (v?: any) => toDateOnly(v || new Date());

const hasActiveFields = (e: any) =>
  Object.prototype.hasOwnProperty.call(e || {}, "active") ||
  Object.prototype.hasOwnProperty.call(e || {}, "enrolled") ||
  Object.prototype.hasOwnProperty.call(e || {}, "status");

const isActiveEnrollment = (e: any) =>
  e?.enrolled === true ||
  e?.active === true ||
  String(e?.status || "").toLowerCase() === "active";

// --------- small safe helpers ----------
function toCents(val: any): number {
  if (val == null) return 0;
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function ledgerAmountCents(row: any): number {
  if (!row) return 0;
  if (Number.isFinite(Number(row.amountCents))) return Number(row.amountCents);
  if (Number.isFinite(Number(row.amount))) return Math.round(Number(row.amount) * 100);
  return 0;
}

/** Decide if a ledger row counts toward grant window. */
function isLedgerInWindow(row: any, win: GrantWindowISO): boolean {
  // Prefer explicit dueDate; fallback to date; fallback to ts.
  const d =
    toDateOnly(row?.dueDate) ||
    toDateOnly(row?.date) ||
    toDateOnly(row?.ts?.toDate ? row.ts.toDate() : row?.ts) ||
    "";

  if (!d) return false;
  return isInGrantWindow(d, win);
}

/**
 * Helper used by bulk recalcFuture:
 * - makes recalcFuture “compatible” without importing the HTTP handler
 * - keeps defaults consistent with the endpoint
 */
export async function recalcGrantProjectedForGrant(args: {
  grantId: string;
  user?: any;
  activeOnly?: boolean;
  source?: 1 | 2;
  effectiveFromISO?: string;
  dryRun?: boolean;
}) {
  const effectiveFromISO = args.effectiveFromISO || toDateOnly(new Date());
  const activeOnly = args.activeOnly ?? true;
  const source = args.source ?? 1;
  const dryRun = args.dryRun ?? false;

  return recalcProjectedForGrant(
    args.grantId,
    { effectiveFromISO, activeOnly, source },
    args.user,
    dryRun
  );
}

/** Core recompute used by both HTTP + scheduler */
export async function recalcProjectedForGrant(
  grantId: string,
  opts: RecalcOpts,
  user?: any,
  dryRun = false
) {
  const warnings: string[] = [];

  // --- load grant ---
  const gRef = db.collection("grants").doc(grantId);
  const gSnap = await gRef.get();
  if (!gSnap.exists) throw new Error("Grant not found");

  const grant: any = gSnap.data() || {};
  assertOrgAccessMaybe(user, grant);

  const win = getGrantWindowISO(grant);

  // Preserve existing line item order and non-budget fields
  const originalLineItems: any[] = Array.isArray(grant?.budget?.lineItems)
    ? grant.budget.lineItems.slice()
    : [];

  const grantOrgNorm = grant?.orgId ? normId(grant.orgId) : null;

  // Initialize accumulator per LI
  const accById: Record<
    string,
    { projectedCents: number; projectedWinCents: number; spentCents: number; spentWinCents: number }
  > = {};

  // Working LI map (objects we will write back)
  const liById: Record<string, any> = {};

  for (const li of originalLineItems) {
    const id = String(li?.id || "");
    if (!id) continue;

    liById[id] = {
      ...li,
      projected: 0,
      projectedInWindow: 0,
      spent: 0,
      spentInWindow: 0,
    };

    accById[id] = {
      projectedCents: 0,
      projectedWinCents: 0,
      spentCents: 0,
      spentWinCents: 0,
    };
  }

  // --------- Pass 1: projected from unpaid enrollment payments ----------
  const enrollSnap = await db
    .collection("customerEnrollments")
    .where("grantId", "==", grantId)
    .get();

  for (const doc of enrollSnap.docs) {
    const e: any = doc.data() || {};

    // Cross-org safety (should be impossible, but don’t trust)
    const eOrgNorm = e?.orgId ? normId(e.orgId) : null;
    if (eOrgNorm && grantOrgNorm && eOrgNorm !== grantOrgNorm) {
      warnings.push(`Skipped cross-org enrollment ${doc.id} (enrollment org != grant org)`);
      continue;
    }

    if (opts.activeOnly && hasActiveFields(e) && !isActiveEnrollment(e)) continue;

    const payments: any[] = Array.isArray(e?.payments) ? e.payments : [];
    for (const p of payments) {
      const liId = String(p?.lineItemId || "");
      if (!liId) continue;

      const acc = accById[liId];
      if (!acc) {
        warnings.push(`Enrollment payment references unknown lineItemId: ${liId}`);
        continue;
      }

      const amtCents = toCents(p?.amount);
      if (!amtCents) continue;

      const dueISO = toDateOnly(p?.dueDate || p?.date);

      // projected policy = all unpaid obligations
      if (!p?.paid) {
        acc.projectedCents += amtCents;
        if (dueISO && isInGrantWindow(dueISO, win)) {
          acc.projectedWinCents += amtCents;
        }
      }

      // legacy spent path: paid payments in enrollment (NOT authoritative)
      // HARDEN: only count if paidFromGrant is not explicitly false
      if (opts.source === 2 && p?.paid) {
        const fromGrant = p?.paidFromGrant;
        const countAsSpend = fromGrant === undefined || fromGrant === null || fromGrant === true;

        if (countAsSpend) {
          acc.spentCents += amtCents;
          if (dueISO && isInGrantWindow(dueISO, win)) {
            acc.spentWinCents += amtCents;
          }
        }
      }
    }
  }

  // --------- Pass 2: spent from ledger if source=1 (authoritative) ----------
  if (opts.source === 1) {
    const ledSnap = await db
      .collection("ledger")
      .where("grantId", "==", grantId)
      .get();

    for (const doc of ledSnap.docs) {
      const row: any = doc.data() || {};
      const liId = String(row?.lineItemId || "");
      if (!liId) continue;

      const acc = accById[liId];
      if (!acc) {
        warnings.push(`Ledger row references unknown lineItemId: ${liId}`);
        continue;
      }

      // Integrity guard (match onLedgerWrite trigger behavior)
      const rowOrgNorm = row?.orgId ? normId(row.orgId) : null;
      if (rowOrgNorm && grantOrgNorm && rowOrgNorm !== grantOrgNorm) {
        warnings.push(`Skipped cross-org ledger row ${doc.id} (row org != grant org)`);
        continue;
      }

      const amtCents = ledgerAmountCents(row); // reversals are negative already
      if (!amtCents) continue;

      acc.spentCents += amtCents;
      if (isLedgerInWindow(row, win)) {
        acc.spentWinCents += amtCents;
      }
    }
  }

  // --------- materialize numeric fields onto line items ----------
  const lineItemsOut: any[] = originalLineItems.map((li) => {
    const id = String(li?.id || "");
    const base = liById[id];
    if (!base) return li; // preserve any weird items as-is

    const acc = accById[id] || {
      projectedCents: 0,
      projectedWinCents: 0,
      spentCents: 0,
      spentWinCents: 0,
    };

    // Guard against negative spends (data corruption / partial reversals)
    let spentCents = acc.spentCents;
    let spentWinCents = acc.spentWinCents;
    if (spentCents < 0) {
      warnings.push(`LineItem ${id} spent went negative (${spentCents}); clamped to 0`);
      spentCents = 0;
    }
    if (spentWinCents < 0) {
      warnings.push(`LineItem ${id} spentInWindow went negative (${spentWinCents}); clamped to 0`);
      spentWinCents = 0;
    }

    base.projected = Math.max(0, acc.projectedCents) / 100;
    base.projectedInWindow = Math.max(0, acc.projectedWinCents) / 100;
    base.spent = spentCents / 100;
    base.spentInWindow = spentWinCents / 100;

    return base;
  });

  // Over-cap bookkeeping per LI (based on total, not windowed)
  for (const li of lineItemsOut as any[]) {
    const capNow = Number(li?.amount || 0);
    const overNow = Math.max(
      0,
      (Number(li?.spent || 0) + Number(li?.projected || 0)) - capNow
    );
    if (overNow > 0) li.overCap = overNow;
    else delete li.overCap;
  }

  const baseTotals = computeBudgetTotals(lineItemsOut as any[]);

  const projectedInWindow = (lineItemsOut as any[]).reduce(
    (s, i: any) => s + Number(i?.projectedInWindow || 0),
    0
  );
  const spentInWindow = (lineItemsOut as any[]).reduce(
    (s, i: any) => s + Number(i?.spentInWindow || 0),
    0
  );

  const totals: any = {
    ...baseTotals,
    projectedSpend: baseTotals.projectedSpend,
    projectedInWindow,
    spentInWindow,
    windowBalance: Number(baseTotals.total || 0) - spentInWindow,
    windowProjectedBalance:
      Number(baseTotals.total || 0) - (spentInWindow + projectedInWindow),
    // legacy compat: remaining previously == balance
    remaining: baseTotals.balance,
  };

  if (!dryRun) {
    await gRef.update({
      "budget.lineItems": lineItemsOut,
      "budget.total": baseTotals.total,
      "budget.totals": totals,
      "budget.updatedAt": FieldValue.serverTimestamp(),

      // clear drift flags if present
      "budget.needsRecalc": false,
      "budget.needsRecalcAt": null,
      "budget.lastRecalcAt": FieldValue.serverTimestamp(),
      "budget.lastRecalcSource": opts.source,
    });
  }

  return { totals, lineItems: lineItemsOut, warnings };
}

/** POST /paymentsRecalcGrantProjected */
export async function paymentsRecalcGrantProjectedHandler(req: Request, res: Response) {
  const parsed = PaymentsRecalcGrantProjectedBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });

  const { grantId, effectiveFrom, activeOnly, source, dryRun } =
    parsed.data as TPaymentsRecalcGrantProjectedBody;

  const effectiveFromISO = todayISO(effectiveFrom);

  try {
    const user: any = (req as any)?.user || null;

    const out = await recalcProjectedForGrant(
      grantId,
      { effectiveFromISO, activeOnly, source},
      user,
      !!dryRun
    );

    return res.status(200).json({
      ok: true,
      totals: out.totals,
      warnings: out.warnings || [],
      dryRun: !!dryRun,
      effectiveFromISO,
      activeOnly,
      source,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to recalc grant projected",
    });
  }
}

export const paymentsRecalcGrantProjected = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsRecalcGrantProjectedHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
