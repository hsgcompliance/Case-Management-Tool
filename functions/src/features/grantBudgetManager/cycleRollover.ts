import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, FieldValue } from "../../core";

type Goal = Record<string, unknown> & { amount?: number; spent?: number; projected?: number; endDate?: string; rolloverApplied?: boolean };
type Behavior = "none" | "rollToNext" | "rollToEnd" | "rebalanceFuture" | "manual";

const cents = (value: unknown) => Math.round(Number(value || 0) * 100);
const dollars = (value: number) => value / 100;

export function applyCycleRollover(goals: Goal[], behavior: Behavior, asOf: string): Goal[] {
  const next = goals.map((goal) => ({ ...goal }));
  for (let index = 0; index < next.length; index += 1) {
    const goal = next[index];
    const endDate = String(goal.endDate || "").slice(0, 10);
    if (goal.rolloverApplied || !endDate || endDate >= asOf) continue;
    const remainder = cents(goal.amount) - cents(goal.spent) - cents(goal.projected);
    const future = next.slice(index + 1);
    if (remainder && future.length && behavior !== "none" && behavior !== "manual") {
      if (behavior === "rollToNext") future[0].amount = dollars(cents(future[0].amount) + remainder);
      if (behavior === "rollToEnd") future[future.length - 1].amount = dollars(cents(future[future.length - 1].amount) + remainder);
      if (behavior === "rebalanceFuture") {
        const base = Math.trunc(remainder / future.length);
        let extra = remainder - base * future.length;
        for (const target of future) {
          const cent = extra > 0 ? 1 : extra < 0 ? -1 : 0;
          extra -= cent;
          target.amount = dollars(cents(target.amount) + base + cent);
        }
      }
    }
    goal.rolloverApplied = true;
    goal.rolloverAppliedOn = asOf;
  }
  return next;
}

export async function runGrantBudgetCycleRollover(asOf = new Date().toISOString().slice(0, 10)) {
  const snapshot = await db.collection("grants").where("active", "==", true).get();
  let updated = 0;
  for (const document of snapshot.docs) {
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(document.ref);
      const grant = current.data() || {};
      const budget = grant.budget && typeof grant.budget === "object" ? grant.budget : {};
      const lineItems = Array.isArray(budget.lineItems) ? budget.lineItems : [];
      let changed = false;
      const nextItems = lineItems.map((lineItem: Record<string, unknown>) => {
        const goals = Array.isArray(lineItem.splitGoals) ? lineItem.splitGoals as Goal[] : [];
        const behavior = String(lineItem.rollForward || "none") as Behavior;
        const nextGoals = applyCycleRollover(goals, behavior, asOf);
        const itemChanged = JSON.stringify(nextGoals) !== JSON.stringify(goals);
        if (itemChanged) changed = true;
        return itemChanged ? { ...lineItem, splitGoals: nextGoals } : lineItem;
      });
      if (!changed) return;
      transaction.update(document.ref, "budget.lineItems", nextItems, "updatedAt", FieldValue.serverTimestamp());
      updated += 1;
    });
  }
  return { reviewed: snapshot.size, updated, asOf };
}

export const grantBudgetCycleRollover = onSchedule(
  { schedule: "15 2 * * *", timeZone: "America/Denver" },
  async () => { await runGrantBudgetCycleRollover(); },
);
