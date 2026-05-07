// functions/src/features/creditCards/refreshBudget.ts
import { db, FieldValue, normId, newBulkWriter } from "../../core";
import { summarizeCreditCards } from "./service";

/**
 * Recomputes budget totals for all cards in an org (or a specific subset) and
 * writes the result back to each creditCards/{id} doc under the `budget` sub-object.
 *
 * Called after jotform sync and from the weekly reconcile so the budget page only
 * needs to read creditCard docs — no on-demand queue/ledger fan-out per page load.
 */
export async function refreshCreditCardBudgets(
  orgId: string,
  opts?: { cardIds?: string[]; updatedBy?: string }
): Promise<void> {
  const normedOrg = normId(orgId);
  // Run the full org-scoped summary (queue queries are org-scoped anyway,
  // so a per-card version wouldn't save reads).
  const result = await summarizeCreditCards(normedOrg, {});
  const targetIds = opts?.cardIds?.length ? new Set(opts.cardIds) : null;
  const updatedBy = opts?.updatedBy || "sync";

  const writer = newBulkWriter(2);
  for (const item of result.items) {
    if (targetIds && !targetIds.has(item.id)) continue;
    writer.set(
      db.collection("creditCards").doc(item.id),
      {
        budget: {
          month: item.month,
          lastMonth: item.lastMonth,
          monthlyLimitCents: item.monthlyLimitCents,
          spentCents: item.spentCents,
          remainingCents: item.remainingCents,
          usagePct: item.usagePct,
          entryCount: item.entryCount,
          lastMonthSpentCents: item.lastMonthSpentCents,
          lastMonthEntryCount: item.lastMonthEntryCount,
          budgetUpdatedAt: FieldValue.serverTimestamp(),
          budgetUpdatedBy: updatedBy,
        },
      },
      { merge: true },
    );
  }
  await writer.close();
}

/**
 * Refreshes budgets for every org that has at least one credit card.
 * Used by the weekly reconcile which doesn't have a single orgId.
 */
export async function refreshAllCreditCardBudgets(): Promise<void> {
  const snap = await db.collection("creditCards").select("orgId").get();
  const orgIds = new Set(
    snap.docs.map((d) => normId((d.data() || {}).orgId || "")).filter(Boolean)
  );
  for (const orgId of orgIds) {
    await refreshCreditCardBudgets(orgId, { updatedBy: "reconcile" });
  }
}
