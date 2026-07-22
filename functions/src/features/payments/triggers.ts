// functions/src/features/payments/triggers.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { computeGrantLineItemOverCap } from "@hdb/contracts";
import { db, FieldValue, computeBudgetTotals, normId } from "../../core";
import { RUNTIME } from "../../core/env";
import { syncEnrollmentProjectionQueueItems } from "../paymentQueue/service";
import { syncContinuumRentCertReminders } from "../enrollments/continuity";
import {
  changedTopLevelKeys,
  debugTriggerEvent,
  debugWrite,
  deepEqualDeterministic,
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

    const toCents = (row: any | null | undefined) => {
      if (!row) return 0;
      if (Number.isFinite(row.amountCents)) return Number(row.amountCents);
      if (Number.isFinite(row.amount)) return Math.round(Number(row.amount) * 100);
      return 0;
    };

    const bucketFor = (row: any | null | undefined) => {
      if (!isNonEnrollment(row)) return null;
      const grantId = String(row?.grantId || "");
      const lineItemId = String(row?.lineItemId || "");
      if (!grantId || !lineItemId) return null;
      const rowOrgId = row?.orgId ? normId(row.orgId) : null;
      return { grantId, lineItemId, rowOrgId };
    };

    const bucketDeltas = new Map<string, { grantId: string; lineItemId: string; rowOrgId: string | null; deltaCents: number }>();
    const addDelta = (row: any | null | undefined, centsDelta: number) => {
      if (!centsDelta) return;
      const b = bucketFor(row);
      if (!b) return;
      const key = `${b.grantId}::${b.lineItemId}::${b.rowOrgId || ""}`;
      const cur = bucketDeltas.get(key);
      if (cur) {
        cur.deltaCents += centsDelta;
      } else {
        bucketDeltas.set(key, { ...b, deltaCents: centsDelta });
      }
    };

    addDelta(before, -toCents(before));
    addDelta(after, toCents(after));

    const deltas = Array.from(bucketDeltas.values()).filter((x) => !!x.deltaCents);
    if (deltas.length === 0) return;

    const byGrant = new Map<string, Array<{ lineItemId: string; rowOrgId: string | null; deltaCents: number }>>();
    for (const d of deltas) {
      const arr = byGrant.get(d.grantId) || [];
      arr.push({ lineItemId: d.lineItemId, rowOrgId: d.rowOrgId, deltaCents: d.deltaCents });
      byGrant.set(d.grantId, arr);
    }

    for (const [grantId, grantDeltas] of byGrant.entries()) {
      const gref = db.doc(`grants/${grantId}`);
      await db.runTransaction(async (tx) => {
        const gsnap = await tx.get(gref);
        if (!gsnap.exists) return;

        const g: any = gsnap.data() || {};
        const grantOrgId = g?.orgId ? normId(g.orgId) : null;

        const itemsBefore: any[] = Array.isArray(g?.budget?.lineItems)
          ? g.budget.lineItems
          : [];
        const items: any[] = itemsBefore.map((x: any) => ({ ...x }));

        let touched = false;
        for (const deltaRow of grantDeltas) {
          if (deltaRow.rowOrgId && grantOrgId && deltaRow.rowOrgId !== grantOrgId) continue;

          const li = items.find((x: any) => String(x.id) === deltaRow.lineItemId);
          if (!li) continue;
          if (li.locked) continue;

          const delta = deltaRow.deltaCents / 100;
          li.spent = Math.max(0, Number(li.spent || 0) + delta);

          const over = computeGrantLineItemOverCap(g, li);
          if (over != null) li.overCap = over;
          else delete li.overCap;

          touched = true;
        }

        if (!touched) return;

        const baseTotals = computeBudgetTotals(items as any[]);
        const existingTotals =
          g?.budget?.totals && typeof g.budget.totals === "object"
            ? g.budget.totals
            : {};

        const totals = {
          ...existingTotals,
          ...baseTotals,
          remaining: baseTotals.balance,
          projectedSpend: baseTotals.projectedSpend,
        };

        const currentTotals =
          g?.budget?.totals && typeof g.budget.totals === "object"
            ? g.budget.totals
            : {};

        const changedLineItems = !deepEqualDeterministic(itemsBefore, items);
        const changedTotals = !deepEqualDeterministic(currentTotals, totals);
        const changedTotal = Number(g?.budget?.total || 0) !== Number(baseTotals.total || 0);
        if (!changedLineItems && !changedTotals && !changedTotal) return;

        const write = {
          "budget.lineItems": items,
          "budget.total": baseTotals.total,
          "budget.totals": totals,
          "budget.updatedAt": FieldValue.serverTimestamp(),
          "system.lastWriter": FN_LEDGER_WRITE,
          "system.lastWriteAt": FieldValue.serverTimestamp(),
        } as Record<string, unknown>;

        debugWrite({ fn: FN_LEDGER_WRITE, path: gref.path, write });
        tx.update(gref, write);
      });
    }
  }
);
