// functions/src/core/budgetTotals.ts
// Temporary shared helper for computing grant budget totals from line items.
// We can keep, rename, or inline this later if we decide we don't like it.

import type { BudgetLineItemLike, BudgetTotals } from "@hdb/contracts";

export function toBudgetCents(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromBudgetCents(value: number): number {
  return value / 100;
}

export function sumBudgetField(
  items: Array<Record<string, unknown> | null | undefined>,
  field: string,
): number {
  return fromBudgetCents(
    (Array.isArray(items) ? items : []).reduce(
      (sum, item) => sum + toBudgetCents(item?.[field]),
      0,
    ),
  );
}

/**
 * Given an array of budget line items, compute the canonical totals.
 *
 * - total: sum of amount
 * - spent: sum of spent
 * - projected: sum of projected (unpaid / future commitments)
 * - balance: total - spent
 * - projectedBalance: total - (spent + projected)
 */
export function computeBudgetTotals(
  items: Array<BudgetLineItemLike | null | undefined>
): BudgetTotals {
  const src = Array.isArray(items) ? items : [];

  let totalCents = 0;
  let spentCents = 0;
  let projectedCents = 0;

  for (const raw of src) {
    if (!raw) continue;
    const i: any = raw;
    totalCents += toBudgetCents(i.amount);
    spentCents += toBudgetCents(i.spent);
    projectedCents += toBudgetCents(i.projected);
  }

  const total = fromBudgetCents(totalCents);
  const spent = fromBudgetCents(spentCents);
  const projected = fromBudgetCents(projectedCents);
  const balance = fromBudgetCents(totalCents - spentCents);
  const projectedBalance = fromBudgetCents(totalCents - spentCents - projectedCents);
  const projectedSpend = fromBudgetCents(spentCents + projectedCents);

  return { total, spent, balance, projected, projectedBalance, projectedSpend };
}
