// functions/src/features/inbox/utils.ts
import { db, isoNow } from "../../core";
import { addMonthsUtc, toMonthKey } from "../../core";

/**
 * Synchronously close all open userTasks for an enrollment.
 * Call directly from delete/migrate handlers — do not rely solely on the Firestore trigger,
 * which bails early on hard deletes and runs after the HTTP response.
 */
export async function closeEnrollmentInboxItems(enrollmentId: string): Promise<number> {
  if (!enrollmentId) return 0;
  const snap = await db
    .collection("userTasks")
    .where("enrollmentId", "==", enrollmentId)
    .where("status", "==", "open")
    .get();
  if (snap.empty) return 0;
  const batch = db.batch();
  const now = isoNow();
  snap.forEach((doc) =>
    batch.set(doc.ref, { status: "done", completedAtISO: now, updatedAtISO: now }, { merge: true })
  );
  await batch.commit();
  return snap.size;
}

export function monthKey(d = new Date()) {
  return toMonthKey(d);
}

export function monthAdd(ym: string, delta: number) {
  const base = String(ym || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(base)) return base;

  const shifted = addMonthsUtc(`${base}-01`, delta);
  return toMonthKey(shifted);
}

export const prevMonthKey = (d = new Date()) => monthAdd(monthKey(d), -1);
export const nextMonthKey = (d = new Date()) => monthAdd(monthKey(d), +1);
