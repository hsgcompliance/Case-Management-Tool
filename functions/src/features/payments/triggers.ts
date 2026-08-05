// functions/src/features/payments/triggers.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { recomputeGrantBudgetFromLedger } from "../grants/budgetRecompute";
import { db, FieldValue } from "../../core";
import { RUNTIME } from "../../core/env";
import { syncEnrollmentProjectionQueueItems } from "../paymentQueue/service";
import { syncContinuumRentCertReminders } from "../enrollments/continuity";
import {
  changedTopLevelKeys,
  debugTriggerEvent,
  debugWrite,
  selfWriteMetadataOnly,
} from "../../core/triggerDebug";

const FN_ENROLLMENT_PAYMENTS_CHANGE = "onEnrollmentPaymentsChange";
const FN_LEDGER_WRITE = "onLedgerWrite";

/**
 * Flag grant for projected recompute when payments array changes.
 * Intentionally broad: any change to the payment schedule/amount/paid state
 * can create drift vs. canonical policy; scheduler will reconcile.
 */
export const onEnrollmentPaymentsChange = onDocumentWritten(
  { region: RUNTIME.region, document: "customerEnrollments/{enrollmentId}" },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (!after) return;
    const changedKeys = changedTopLevelKeys(before as any, after as any);
    debugTriggerEvent({
      fn: FN_ENROLLMENT_PAYMENTS_CHANGE,
      event,
      beforeRefPath: event.data?.before?.ref?.path || null,
      afterRefPath: event.data?.after?.ref?.path || null,
      changedKeys,
    });

    if (selfWriteMetadataOnly(FN_ENROLLMENT_PAYMENTS_CHANGE, after, changedKeys)) return;

    const a = Array.isArray(after.payments) ? after.payments : [];
    const b = Array.isArray(before?.payments) ? (before as any).payments : [];

    if (!changedKeys.includes("payments")) return;

    // Order-insensitive signature to avoid false-positive churn on array reordering.
    const sig = (arr: any[]) =>
      arr
        .map((p: any) => {
          const type = String(p?.type || "");
          const due = String(p?.dueDate || p?.date || "").slice(0, 10);
          const li = String(p?.lineItemId || "");
          const cents = Math.round(Number(p?.amount || 0) * 100);
          const paid = p?.paid ? 1 : 0;
          return `${type}|${due}|${li}|${cents}|${paid}`;
        })
        .sort()
        .join(",");

    const changed = a.length !== b.length || sig(a) !== sig(b);
    if (!changed) return;

    const grantId = String(after.grantId || "");
    if (!grantId) return;

    const gRef = db.doc(`grants/${grantId}`);
    const gSnap = await gRef.get();
    const grant = gSnap.exists ? gSnap.data() : null;

    // Flag grant for budget recompute (skip the write if already flagged — no-op).
    if (!((grant as any)?.budget?.needsRecalc === true)) {
      const write = {
        budget: {
          needsRecalc: true,
          needsRecalcAt: FieldValue.serverTimestamp(),
        },
        system: {
          lastWriter: FN_ENROLLMENT_PAYMENTS_CHANGE,
          lastWriteAt: FieldValue.serverTimestamp(),
        },
      };
      debugWrite({ fn: FN_ENROLLMENT_PAYMENTS_CHANGE, path: gRef.path, write });
      await gRef.set(write, { merge: true });
    }

    const enrollmentId = String(event.params.enrollmentId || "");

    // Flag (never silently allow) a payment that just transitioned to paid
    // with no ledger entry backing it. paymentsSpend always writes the
    // ledger entry in the same transaction as the paid:true flip, so a
    // missing ledger entry right after a paid transition means something
    // else set `paid` directly (a bulk/admin script bypassing paymentsSpend
    // is the known culprit — see payment-workflow-hardening docs). This
    // makes that drift visible immediately via `auditFlags` instead of only
    // discoverable months later via manual reconciliation.
    const beforeById = new Map<string, any>(b.map((p: any) => [String(p?.id || ""), p]));
    const newlyPaid = a.filter((p: any) => {
      const id = String(p?.id || "");
      if (!id || p?.paid !== true) return false;
      const priorPayment = beforeById.get(id);
      return !priorPayment || priorPayment.paid !== true;
    });
    if (newlyPaid.length) {
      const ledgerSnap = await db.collection("ledger").where("enrollmentId", "==", enrollmentId).get();
      const backedPaymentIds = new Set(
        ledgerSnap.docs
          .map((d) => d.data() as any)
          .filter((l) => !l.reversalOf && Number(l.amountCents || 0) > 0)
          .map((l) => String(l.paymentId || "")),
      );
      const unbacked = newlyPaid.filter((p: any) => !backedPaymentIds.has(String(p.id)));
      if (unbacked.length) {
        await db.collection("auditFlags").doc().set({
          context: "payment_marked_paid_without_ledger",
          enrollmentId,
          grantId,
          customerId: after.customerId ? String(after.customerId) : null,
          customerName: after.customerName ? String(after.customerName) : null,
          payments: unbacked.map((p: any) => ({ id: p.id, dueDate: p.dueDate || p.date || null, amount: p.amount ?? null, lineItemId: p.lineItemId || null })),
          timestamp: FieldValue.serverTimestamp(),
        });
      }
    }

    // Keep paymentQueue projection items in sync with the enrollment's payment schedule.
    // This is the authoritative sync path — spend.ts and upsertProjections.ts no longer
    // call syncEnrollmentProjectionQueueItems directly; this trigger is the single writer.
    await syncEnrollmentProjectionQueueItems({
      orgId: after.orgId ? String(after.orgId) : null,
      enrollmentId,
      grantId: grantId || null,
      customerId: after.customerId ? String(after.customerId) : null,
      customerName: after.customerName ? String(after.customerName) : null,
      payments: a as Array<Record<string, unknown>>,
    });
    await syncContinuumRentCertReminders(enrollmentId);
  }
);

/**
 * Roll NON-enrollment ledger deltas into grant line item spent.
 * Enrollment spends already update budgets transactionally in spend.ts.
 *
 * Non-enrollment spends will write directly to /ledger.
 * This trigger keeps grant.budget.spent synced to those entries.
 */
export const onLedgerWrite = onDocumentWritten(
  { region: RUNTIME.region, document: "ledger/{entryId}" },
  async (event) => {
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const changedKeys = changedTopLevelKeys(before as any, after as any);
    debugTriggerEvent({
      fn: FN_LEDGER_WRITE,
      event,
      beforeRefPath: event.data?.before?.ref?.path || null,
      afterRefPath: event.data?.after?.ref?.path || null,
      changedKeys,
    });
    if (!after && !before) return;
    const rowAfter = after || {};
    if (selfWriteMetadataOnly(FN_LEDGER_WRITE, rowAfter, changedKeys)) return;

    const isNonEnrollment = (row: any) =>
      row &&
      row.source &&
      String(row.source).toLowerCase() !== "enrollment";

    if (!isNonEnrollment(after) && !isNonEnrollment(before)) return;

    const grantIds = new Set(
      [before, after]
        .filter(isNonEnrollment)
        .map((row) => String(row?.grantId || "").trim())
        .filter(Boolean),
    );
    for (const grantId of grantIds) {
      await recomputeGrantBudgetFromLedger(grantId);
    }
  }
);
