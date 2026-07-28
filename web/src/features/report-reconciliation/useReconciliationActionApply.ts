"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toApiError } from "@client/api";
import { usePatchCustomers, useUpsertCustomers } from "@hooks/useCustomers";
import { usePatchPaymentQueueItem, usePostPaymentQueueToLedger, useVoidPaymentQueueItem } from "@hooks/usePaymentQueue";
import { usePaymentsSpend, usePaymentsUpsertProjections } from "@hooks/usePayments";
import { useEnrollmentsPatch } from "@hooks/useEnrollments";
import { qk } from "@hooks/queryKeys";
import type { CustomersPatchReq, CustomersUpsertReq, PaymentsUpsertProjectionsReq } from "@types";
import type { PaymentQueuePatchReq } from "@client/paymentQueue";
import type { ReconciliationActionPreview } from "./reconciliationActions";

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

export type ReconciliationApplyResult = { ok: boolean; message: string; recorded?: boolean };

/**
 * Shared dispatch for every ReconciliationActionPreview kind — the single
 * finding detail view (ActionPreviewList) and the bulk-apply modal both use
 * this so the two surfaces can never drift on what a given action actually
 * does. `skipConfirm` lets the bulk modal show one upfront confirm for the
 * whole batch instead of popping a window.confirm per row.
 */
export function useReconciliationActionApply(onApplied?: () => void) {
  const patchCustomers = usePatchCustomers();
  const upsertCustomers = useUpsertCustomers();
  const patchQueueItem = usePatchPaymentQueueItem();
  const postQueueItem = usePostPaymentQueueToLedger();
  const postSchedulePayment = usePaymentsSpend();
  const extendSchedule = usePaymentsUpsertProjections();
  const voidQueueItem = useVoidPaymentQueueItem();
  const enrollmentsPatch = useEnrollmentsPatch();
  const queryClient = useQueryClient();
  const [runningId, setRunningId] = React.useState("");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.customers.root }),
      queryClient.invalidateQueries({ queryKey: qk.dashboard.root }),
      queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
      queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
      queryClient.invalidateQueries({ queryKey: qk.enrollments.root }),
    ]);
    onApplied?.();
  };

  const apply = async (
    action: ReconciliationActionPreview,
    opts?: {
      skipConfirm?: boolean;
      /**
       * Fields to merge over `action.patch` before dispatch — how the Adjust
       * modal (ReconciliationAdjustModal) lets an operator edit a proposed
       * write before applying it. Only meaningful for kinds whose backend
       * endpoint actually accepts the edited field (currently
       * `extend_schedule`'s `payments` array and `patch_queue_amount`'s
       * `amount`/`amountAbs` — `paymentsSpend`/`paymentQueuePostToLedger`
       * have no editable fields at all, so post_schedule_payment/
       * post_queue_payment ignore this).
       */
      overridePatch?: Record<string, unknown>;
    },
  ): Promise<ReconciliationApplyResult> => {
    // No live write path exists for task creation yet — chosen as a path,
    // but only recorded (visible in the submit summary), not applied.
    if (action.kind === "create_payment_review_task") {
      return { ok: true, recorded: true, message: "Recorded for manual follow-up — task creation isn't wired to a live write yet." };
    }
    if (!action.executable) return { ok: false, message: "Action is not executable." };
    setRunningId(action.id);
    try {
      if (action.kind === "push_hmis_id" || action.kind === "push_cw_id" || action.kind === "push_dob") {
        if (!action.targetId || !action.patch) throw new Error("Customer patch action is missing its target or patch.");
        await patchCustomers.mutateAsync({ id: action.targetId, patch: action.patch } as CustomersPatchReq);
        await refresh();
        return { ok: true, message: `${action.label} applied.` };
      }
      if (action.kind === "create_customer") {
        if (!action.create) throw new Error("Create customer action is missing its payload.");
        await upsertCustomers.mutateAsync([action.create] as CustomersUpsertReq);
        await refresh();
        return { ok: true, message: "Customer created." };
      }
      if (action.kind === "patch_enrollment_dates" || action.kind === "patch_enrollment_compliance") {
        if (!action.targetId || !action.patch) throw new Error("Enrollment patch action is missing its target or patch.");
        await enrollmentsPatch.mutateAsync([{ id: action.targetId, patch: action.patch }]);
        await refresh();
        return { ok: true, message: `${action.label} applied.` };
      }
      if (action.kind === "post_queue_payment") {
        if (!action.targetId) throw new Error("Queue post action is missing its target.");
        if (
          !opts?.skipConfirm &&
          !window.confirm(`Post this queue item to the ledger (mark paid)?\n\nCurrent: ${action.currentValue}\nProposed: ${action.proposedValue}`)
        ) {
          return { ok: false, message: "Cancelled." };
        }
        await postQueueItem.mutateAsync({ id: action.targetId });
        await refresh();
        return { ok: true, message: "Queue item posted to ledger." };
      }
      if (action.kind === "post_schedule_payment") {
        const enrollmentId = textValue((action.patch as Record<string, unknown> | undefined)?.enrollmentId);
        const paymentId = textValue((action.patch as Record<string, unknown> | undefined)?.paymentId);
        if (!enrollmentId || !paymentId) throw new Error("Schedule payment action is missing its enrollment/payment id.");
        if (
          !opts?.skipConfirm &&
          !window.confirm(`Mark this scheduled payment paid and create its ledger entry?\n\nCurrent: ${action.currentValue}\nProposed: ${action.proposedValue}`)
        ) {
          return { ok: false, message: "Cancelled." };
        }
        await postSchedulePayment.mutateAsync({ body: { enrollmentId, paymentId, reverse: false, forceSync: false } });
        await refresh();
        return { ok: true, message: "Scheduled payment marked paid and posted to ledger." };
      }
      if (action.kind === "extend_schedule") {
        const patch = { ...(action.patch as Record<string, unknown> | undefined), ...(opts?.overridePatch ?? {}) };
        const payments = patch.payments;
        if (!action.targetId || !Array.isArray(payments)) throw new Error("Extend schedule action is missing its target or payments array.");
        // The Adjust modal's own Apply button already shows the edited rows
        // and is itself the confirm step — don't also pop a window.confirm
        // built from the now-stale original proposedValue text.
        if (
          !opts?.skipConfirm &&
          !opts?.overridePatch &&
          !window.confirm(`Extend this enrollment's schedule?\n\nCurrent: ${action.currentValue}\nProposed: ${action.proposedValue}`)
        ) {
          return { ok: false, message: "Cancelled." };
        }
        await extendSchedule.mutateAsync({ body: { enrollmentId: action.targetId, payments } as PaymentsUpsertProjectionsReq });
        await refresh();
        return { ok: true, message: "Schedule extended with the missing months (unpaid)." };
      }
      if (action.kind === "patch_queue_amount") {
        if (!action.targetId || !action.patch) throw new Error("Queue amount action is missing its target or patch.");
        const patch = { ...action.patch, ...(opts?.overridePatch ?? {}) };
        await patchQueueItem.mutateAsync({ id: action.targetId, body: patch as PaymentQueuePatchReq });
        await refresh();
        return { ok: true, message: "Queue amount updated." };
      }
      if (action.kind === "void_queue_payment") {
        if (!action.targetId) throw new Error("Queue void action is missing its target.");
        if (
          !opts?.skipConfirm &&
          !window.confirm("Void this scheduled payment? Only proceed if it is confirmed cancelled — the uploaded report may simply not cover it.")
        ) {
          return { ok: false, message: "Cancelled." };
        }
        await voidQueueItem.mutateAsync({ id: action.targetId, body: { reason: "reconciliation: no report evidence" } });
        await refresh();
        return { ok: true, message: "Queue item voided." };
      }
      return { ok: false, message: `No handler for action kind "${action.kind}".` };
    } catch (error) {
      // Uses the same collision-aware error extraction as the rest of the
      // app (e.g. CustomerCard/EnrollmentsTab) so a real
      // monthly_schedule_collision from extend_schedule/post_schedule_payment
      // surfaces its actionable recommendation instead of a bare error code.
      return { ok: false, message: toApiError(error, `Failed to apply ${action.label}.`).error };
    } finally {
      setRunningId("");
    }
  };

  const busy =
    patchCustomers.isPending ||
    upsertCustomers.isPending ||
    patchQueueItem.isPending ||
    postQueueItem.isPending ||
    postSchedulePayment.isPending ||
    extendSchedule.isPending ||
    voidQueueItem.isPending ||
    enrollmentsPatch.isPending ||
    Boolean(runningId);

  return { apply, busy, runningId };
}
