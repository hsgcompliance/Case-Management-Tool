import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue, RUNTIME } from "../../core";

type TaskKind = "assessment" | "compliance" | "other";

function monthKeysUTC() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const cur = `${y}-${String(m + 1).padStart(2, "0")}`;
  const n = new Date(Date.UTC(y, m + 1, 1));
  const next = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
  return { cur, next };
}

function classifyTaskKind(row: any): TaskKind {
  const src = String(row?.source || "").toLowerCase();
  const bucket = String(row?.bucket || "").toLowerCase();
  const group = String(row?.assignedToGroup || "").toLowerCase();
  const title = String(row?.title || "").toLowerCase();

  if (src === "payment" || src === "paymentcompliance" || group === "compliance") {
    return "compliance";
  }
  if (src === "other" || bucket === "other") return "other";
  if (bucket === "assessment" || title.includes("assessment")) return "assessment";
  return "other";
}

function contribution(row: any): {
  uid: string | null;
  thisMonth: number;
  nextMonth: number;
  kind: TaskKind;
} | null {
  const uid = String(row?.assignedToUid || "").trim() || null;
  if (!uid) return null;

  const status = String(row?.status || "").toLowerCase();
  if (status && status !== "open") return null;

  const dueMonth = String(row?.dueMonth || "").slice(0, 7);
  if (!dueMonth) return null;

  const { cur, next } = monthKeysUTC();
  const thisMonth = dueMonth === cur ? 1 : 0;
  const nextMonth = dueMonth === next ? 1 : 0;
  if (!thisMonth && !nextMonth) return null;

  return {
    uid,
    thisMonth,
    nextMonth,
    kind: classifyTaskKind(row),
  };
}

async function applyUserDelta(
  uid: string,
  delta: {
    thisMonth: number;
    nextMonth: number;
    kind: TaskKind;
  },
  sign: 1 | -1
) {
  const dm = delta.thisMonth * sign;
  const dn = delta.nextMonth * sign;
  if (!dm && !dn) return;

  const ref = db.collection("userExtras").doc(uid);
  const write: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    "taskMetrics.updatedAt": FieldValue.serverTimestamp(),
  };

  if (dm) {
    write["taskMetrics.openThisMonth"] = FieldValue.increment(dm);
    write[`taskMetrics.byType.${delta.kind}.thisMonth`] = FieldValue.increment(dm);
  }
  if (dn) {
    write["taskMetrics.openNextMonth"] = FieldValue.increment(dn);
    write[`taskMetrics.byType.${delta.kind}.nextMonth`] = FieldValue.increment(dn);
  }

  await ref.set(write, { merge: true });
}

export const onUserTaskMetrics = onDocumentWritten(
  { region: RUNTIME.region, document: "userTasks/{id}" },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const b = contribution(before);
    const a = contribution(after);

    if (
      b?.uid === a?.uid &&
      b?.kind === a?.kind &&
      (b?.thisMonth || 0) === (a?.thisMonth || 0) &&
      (b?.nextMonth || 0) === (a?.nextMonth || 0)
    ) {
      return;
    }

    if (b?.uid) await applyUserDelta(b.uid, b, -1);
    if (a?.uid) await applyUserDelta(a.uid, a, +1);
  }
);
