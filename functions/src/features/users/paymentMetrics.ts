import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue, RUNTIME } from "../../core";

type PaymentDelta = {
  uid: string;
  unpaidThisMonth: number;
  unpaidNextMonth: number;
  unpaidTotal: number;
  amountThisMonth: number;
  amountNextMonth: number;
  amountTotal: number;
};

function monthKeysUTC() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const cur = `${y}-${String(m + 1).padStart(2, "0")}`;
  const n = new Date(Date.UTC(y, m + 1, 1));
  const next = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
  return { cur, next };
}

function summarizeEnrollment(row: any): PaymentDelta | null {
  const uid = String(row?.caseManagerId || "").trim();
  if (!uid) return null;

  const { cur, next } = monthKeysUTC();
  const out: PaymentDelta = {
    uid,
    unpaidThisMonth: 0,
    unpaidNextMonth: 0,
    unpaidTotal: 0,
    amountThisMonth: 0,
    amountNextMonth: 0,
    amountTotal: 0,
  };

  const payments = Array.isArray(row?.payments) ? row.payments : [];
  for (const p of payments) {
    if (p?.paid === true) continue;
    const dueMonth = String(p?.dueMonth || p?.dueDate || "").slice(0, 7);
    const amt = Number(p?.amount || 0);
    const safeAmt = Number.isFinite(amt) ? amt : 0;
    out.unpaidTotal += 1;
    out.amountTotal += safeAmt;
    if (dueMonth === cur) {
      out.unpaidThisMonth += 1;
      out.amountThisMonth += safeAmt;
    } else if (dueMonth === next) {
      out.unpaidNextMonth += 1;
      out.amountNextMonth += safeAmt;
    }
  }
  return out;
}

async function applyUserPaymentDelta(delta: PaymentDelta, sign: 1 | -1) {
  if (
    !delta.unpaidThisMonth &&
    !delta.unpaidNextMonth &&
    !delta.unpaidTotal &&
    !delta.amountThisMonth &&
    !delta.amountNextMonth &&
    !delta.amountTotal
  ) {
    return;
  }

  const ref = db.collection("userExtras").doc(delta.uid);
  await ref.set(
    {
      updatedAt: FieldValue.serverTimestamp(),
      "paymentMetrics.updatedAt": FieldValue.serverTimestamp(),
      "paymentMetrics.unpaidThisMonth": FieldValue.increment(delta.unpaidThisMonth * sign),
      "paymentMetrics.unpaidNextMonth": FieldValue.increment(delta.unpaidNextMonth * sign),
      "paymentMetrics.unpaidTotal": FieldValue.increment(delta.unpaidTotal * sign),
      "paymentMetrics.amountThisMonth": FieldValue.increment(delta.amountThisMonth * sign),
      "paymentMetrics.amountNextMonth": FieldValue.increment(delta.amountNextMonth * sign),
      "paymentMetrics.amountTotal": FieldValue.increment(delta.amountTotal * sign),
    },
    { merge: true },
  );
}

export const onUserPaymentMetrics = onDocumentWritten(
  { region: RUNTIME.region, document: "customerEnrollments/{id}" },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const b = summarizeEnrollment(before);
    const a = summarizeEnrollment(after);

    if (
      b?.uid === a?.uid &&
      (b?.unpaidThisMonth || 0) === (a?.unpaidThisMonth || 0) &&
      (b?.unpaidNextMonth || 0) === (a?.unpaidNextMonth || 0) &&
      (b?.unpaidTotal || 0) === (a?.unpaidTotal || 0) &&
      (b?.amountThisMonth || 0) === (a?.amountThisMonth || 0) &&
      (b?.amountNextMonth || 0) === (a?.amountNextMonth || 0) &&
      (b?.amountTotal || 0) === (a?.amountTotal || 0)
    ) {
      return;
    }

    if (b?.uid) await applyUserPaymentDelta(b, -1);
    if (a?.uid) await applyUserPaymentDelta(a, +1);
  },
);
