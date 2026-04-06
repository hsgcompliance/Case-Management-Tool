// BEGIN FILE: functions/src/features/tours/service.ts
import { db, isoNow } from "../../core";
import type { TourFlowT } from "./schemas";

const COL = "tours";

export async function getTour(id: string) {
  const snap = await db.collection(COL).doc(id).get();
  return snap.exists ? (snap.data() as TourFlowT) : null;
}

export async function listTours(limit = 100) {
  const snap = await db.collection(COL).orderBy("id").limit(limit).get();
  return snap.docs.map((d) => d.data() as TourFlowT);
}

export async function upsertTour(flow: TourFlowT) {
  await db
    .collection(COL)
    .doc(flow.id)
    .set({ ...flow, updatedAt: isoNow() }, { merge: true });
  return flow.id;
}
// END FILE
