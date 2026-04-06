import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue, RUNTIME } from "../../core";

type WorkloadContribution = {
  month: string;
  uid: string | null;
  customerId: string | null;
  total: number;
  open: number;
  done: number;
} | null;

function dueMonthOf(row: any): string {
  const m = String(row?.dueMonth || "").slice(0, 7);
  if (m) return m;
  return String(row?.dueDate || "").slice(0, 7);
}

function statusOf(row: any): "open" | "done" | null {
  const s = String(row?.status || "").toLowerCase();
  if (s === "open") return "open";
  if (s === "done") return "done";
  return null;
}

function contribution(row: any): WorkloadContribution {
  if (!row) return null;
  const month = dueMonthOf(row);
  if (!/^\d{4}-\d{2}$/.test(month)) return null;

  const status = statusOf(row);
  if (!status) return null;

  const uid = String(row?.assignedToUid || "").trim() || null;
  const customerId = String(row?.customerId || row?.clientId || "").trim() || null;

  return {
    month,
    uid,
    customerId,
    total: 1,
    open: status === "open" ? 1 : 0,
    done: status === "done" ? 1 : 0,
  };
}

function keyOf(c: WorkloadContribution): string {
  if (!c) return "";
  return [c.month, c.uid || "_unassigned", c.customerId || "_none", c.open, c.done].join("|");
}

function counterWrite(delta: WorkloadContribution, sign: 1 | -1) {
  if (!delta) return null;
  return {
    total: FieldValue.increment(delta.total * sign),
    open: FieldValue.increment(delta.open * sign),
    done: FieldValue.increment(delta.done * sign),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function applyDelta(delta: WorkloadContribution, sign: 1 | -1) {
  const write = counterWrite(delta, sign);
  if (!delta || !write) return;

  const monthRef = db.collection("metricsTaskWorkload").doc(delta.month);
  const batch = db.batch();

  batch.set(
    monthRef,
    {
      month: delta.month,
      ...write,
    },
    { merge: true }
  );

  if (delta.uid) {
    batch.set(
      monthRef.collection("users").doc(delta.uid),
      {
        uid: delta.uid,
        month: delta.month,
        ...write,
      },
      { merge: true }
    );
  }

  if (delta.customerId) {
    batch.set(
      monthRef.collection("customers").doc(delta.customerId),
      {
        customerId: delta.customerId,
        month: delta.month,
        ...write,
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export const onUserTaskWorkloadMetrics = onDocumentWritten(
  { region: RUNTIME.region, document: "userTasks/{id}" },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const b = contribution(before);
    const a = contribution(after);

    if (keyOf(b) === keyOf(a)) return;

    if (b) await applyDelta(b, -1);
    if (a) await applyDelta(a, +1);
  }
);

