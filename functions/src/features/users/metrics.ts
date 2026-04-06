// functions/src/features/users/metrics.ts
import { db, FieldValue } from "../../core";

const usersMetricsRef = db.collection("metrics").doc("users");

export async function bumpActiveCounters(deltaActive: number) {
  // Positive means user moved to active; negative means moved to inactive
  if (!deltaActive) return;
  await usersMetricsRef.set(
    {
      active: FieldValue.increment(deltaActive > 0 ? 1 : -1),
      inactive: FieldValue.increment(deltaActive > 0 ? -1 : 1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function bumpRoleCounts(
  diff: Record<"admin" | "casemanager" | "compliance", number>
) {
  if (!diff) return;
  const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
  for (const [role, n] of Object.entries(diff)) {
    if (!n) continue;
    updates[`role_counts.${role}`] = FieldValue.increment(n);
  }
  await usersMetricsRef.set(updates, { merge: true });
}

export async function markDaily(eventKey: string) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const doc = `users_daily_${yyyy}-${mm}-${dd}`;
  await db
    .collection("metrics")
    .doc(doc)
    .set(
      {
        [eventKey]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}
