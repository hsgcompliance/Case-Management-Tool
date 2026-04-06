// functions/src/core/budgetTotals.ts
// Temporary shared helper for computing grant budget totals from line items.
// We can keep, rename, or inline this later if we decide we don't like it.

import type { BudgetLineItemLike, BudgetTotals } from "@hdb/contracts";

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

  let total = 0;
  let spent = 0;
  let projected = 0;

  for (const raw of src) {
    if (!raw) continue;
    const i: any = raw;
    total += Number(i.amount || 0) || 0;
    spent += Number(i.spent || 0) || 0;
    projected += Number(i.projected || 0) || 0;
  }

  const balance = total - spent;
  const projectedBalance = total - (spent + projected);
  const projectedSpend = spent + projected;

  return { total, spent, balance, projected, projectedBalance, projectedSpend };
}
