// functions/src/features/enrollments/close.ts
// closeEnrollmentCore: one server-side call replacing the client's previous
// 5-call orchestration (tasksDelete/tasksUpdateStatus, paymentsSpend/
// paymentsDeleteRows, patch, voidProjections). Reuses buildEnrollmentClosePreview
// (unchanged — future-unpaid rows are dropped from payments[], confirmed
// acceptable since both close UIs preview the count first and the grant
// budget resyncs automatically via onEnrollmentPaymentsChange) and the
// task-schedule helpers shared with enrollmentsPatch (closeHelpers.ts).
//
// New: reversePaidAfterClose — when the close date falls before the last
// paid payment, this used to hard-block (`close_date_before_last_paid_payment`).
// Now, if the caller opts in, each paid-after-close payment is reversed via
// the real paymentsSpend reverse path before proceeding.
import {
  db,
  FieldValue,
  secureHandler,
  requireOrg,
  canAccessDoc,
  toDateOnly,
} from "../../core";
import { buildEnrollmentClosePreview } from "@hdb/contracts/enrollments";
import { closeFutureTasksAfterEndDate, deleteFutureTasksAfterEndDate, capEndDateToGrant } from "./closeHelpers";
import { summarize } from "../tasks/utils";
import { paymentsSpendHandler } from "../payments/spend";
import { projectionQueueDocId } from "../paymentQueue/service";
import { EnrollmentsCloseBody, type TEnrollmentsCloseBody } from "./schemas";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calls the real paymentsSpend handler in-process (same pattern as continuity.ts's invokeMigration). */
async function reversePaymentViaSpend(user: Record<string, any>, enrollmentId: string, paymentId: string) {
  let status = 200;
  let payload: any;
  const req = { body: { enrollmentId, paymentId, reverse: true }, user } as any;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: any) { payload = value; return this; },
  } as any;
  await paymentsSpendHandler(req, res);
  if (status >= 400 || payload?.ok === false) {
    throw new Error(String(payload?.error || `reverse_failed_for_${paymentId}`));
  }
  return payload;
}

export async function closeEnrollmentCore(user: Record<string, any>, body: TEnrollmentsCloseBody) {
  requireOrg(user);
  const ref = db.collection("customerEnrollments").doc(body.id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("enrollment_not_found");
  const existing = snap.data() || {};
  if (!canAccessDoc(user, existing)) throw new Error("forbidden");

  let grantEndDate = "";
  if (existing.grantId) {
    const gSnap = await db.collection("grants").doc(String(existing.grantId)).get();
    grantEndDate = String(gSnap.data()?.endDate || "").slice(0, 10);
  }

  const requestedCloseDate = body.closeDate ? String(body.closeDate).slice(0, 10) : null;
  const fallbackDate = toDateOnly(new Date());

  let currentPayments: any[] = Array.isArray(existing.payments) ? existing.payments : [];
  let closePreview = buildEnrollmentClosePreview({
    payments: currentPayments,
    requestedCloseDate,
    fallbackDate,
  });

  const reversedPaymentIds: string[] = [];
  if (closePreview.paidAfterClose.length) {
    if (!body.reversePaidAfterClose) {
      const e: any = new Error("close_date_before_last_paid_payment");
      e.meta = { closeDate: closePreview.closeDate, lastPaidDate: closePreview.lastPaidDate };
      throw e;
    }
    for (const payment of closePreview.paidAfterClose) {
      const paymentId = String((payment as any)?.id || "");
      if (!paymentId) continue;
      await reversePaymentViaSpend(user, body.id, paymentId);
      reversedPaymentIds.push(paymentId);
    }
    // Re-read + recompute against the now-reversed payments — never assume the reversal calls' {ok:true} means the array is what we expect.
    const freshSnap = await ref.get();
    const freshExisting = freshSnap.data() || {};
    currentPayments = Array.isArray(freshExisting.payments) ? freshExisting.payments : [];
    closePreview = buildEnrollmentClosePreview({ payments: currentPayments, requestedCloseDate, fallbackDate });
    if (closePreview.paidAfterClose.length) {
      throw new Error("paid_after_close_reversal_incomplete");
    }
  }

  const closeDate = capEndDateToGrant(closePreview.closeDate, grantEndDate) || closePreview.closeDate;
  const schedule = Array.isArray(existing.taskSchedule) ? existing.taskSchedule : [];
  const taskMode = body.taskMode === "delete" ? "delete" : "complete";
  const taskChange = taskMode === "delete"
    ? deleteFutureTasksAfterEndDate(schedule, closeDate)
    : closeFutureTasksAfterEndDate(schedule, closeDate, String(user?.uid || "system"));

  const removedPaymentIds = currentPayments
    .filter((p: any) => !closePreview.retainedPayments.includes(p))
    .map((p: any) => String(p?.id || ""))
    .filter(Boolean);

  const update: Record<string, unknown> = {
    status: "closed",
    active: false,
    deleted: false,
    endDate: closeDate,
    payments: closePreview.retainedPayments,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (taskChange.changed) {
    update.taskSchedule = taskChange.next;
    update.taskStats = summarize(taskChange.next);
  }

  await ref.set(update, { merge: true });

  // Verify, don't trust: the payments[]/taskSchedule write above is our own
  // and thus trustworthy, but onEnrollmentPaymentsChange's paymentQueue resync
  // is async — poll briefly for the removed payments' projection docs to
  // clear rather than assuming the trigger already ran.
  let queueSyncConfirmed = removedPaymentIds.length === 0;
  if (!queueSyncConfirmed) {
    for (let attempt = 0; attempt < 4 && !queueSyncConfirmed; attempt++) {
      if (attempt > 0) await sleep(750);
      const refs = removedPaymentIds.map((pid) => db.collection("paymentQueue").doc(projectionQueueDocId(body.id, pid)));
      const docs = await db.getAll(...refs);
      queueSyncConfirmed = docs.every((d) => !d.exists || d.data()?.queueStatus !== "pending");
    }
  }

  const verifySnap = await ref.get();
  const verified = verifySnap.data() || {};

  return {
    id: body.id,
    closeDate,
    retainedPaymentsCount: closePreview.retainedPayments.length,
    removedPaymentsCount: removedPaymentIds.length,
    reversedPaymentIds,
    queueSyncConfirmed,
    payments: verified.payments,
  };
}

export const enrollmentsClose = secureHandler(
  async (req, res) => {
    const parsed = EnrollmentsCloseBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const user = (req as any).user || {};
    try {
      const result = await closeEnrollmentCore(user, parsed.data);
      res.status(200).json({ ok: true, ...result });
    } catch (error: any) {
      const message = String(error?.message || error || "close_failed");
      const status = message === "enrollment_not_found" ? 404 : message === "forbidden" ? 403 : 400;
      res.status(status).json({ ok: false, error: message, ...(error?.meta || {}) });
    }
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] },
);
