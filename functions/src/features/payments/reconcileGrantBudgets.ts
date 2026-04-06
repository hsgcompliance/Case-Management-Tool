// functions/src/features/payments/reconcileGrantBudgets.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "../../core/admin";
import { toDateOnly } from "../../core"; // 👈 use canonical helper
import { recalcProjectedForGrant } from "./recalcGrantProjected";

export const reconcileGrantBudgets = onSchedule(
  { schedule: "30 3 * * 0", timeZone: "America/Denver" }, // Sundays 3:30am MT
  async () => {
    try {
      const snap = await db
        .collection("grants")
        .where("budget.needsRecalc", "==", true)
        .limit(50)
        .get();

      const effectiveFrom = toDateOnly(new Date());

      for (const doc of snap.docs) {
        const grantId = doc.id;

        await recalcProjectedForGrant(
          grantId,
          { effectiveFromISO: effectiveFrom, activeOnly: true, source: 1 },
          null,
          false
        );
      }
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error(String(err ?? "reconcileGrantBudgets failed"));
    }
  }
);
