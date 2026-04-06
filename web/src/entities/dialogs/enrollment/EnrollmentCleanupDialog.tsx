//web/src/entities/dialogs/EnrollmentCleanupDialog.tsx
"use client";

/**
 * Enrollment Cleanup Dialog — emitted payload (FULL request body)
 *
 * Spine-safe: this dialog does not call endpoints. It only collects options and emits a payload.
 *
 * Payload emitted by this dialog (caller typically POSTs this to backend):
 * {
 *   clearFutureUnpaid: boolean;      // if true: clear unpaid projections after "today" (unless kept by keepPaymentIds)
 *   deletePastPaid: boolean;         // if true: also delete paid items due on/before "today" (unless kept)
 *   deleteAssessmentIds: string[];   // when deleteAssessments is enabled, list of selected assessment ids to delete
 *   softDeleteEnrollment: boolean;   // soft-delete flag on enrollment
 *   deactivateEnrollment: boolean;   // close enrollment
 *   keepPaymentIds: string[];        // explicit allowlist of payment ids to keep (even if they match delete rules)
 * }
 */

import React from "react";
import { Modal } from "@entities/ui/Modal";
import { safeISODate10, toISODate } from "@lib/date";
import { fmtDateOrDash } from "@lib/formatters";

type PaymentLite = { id?: string; amount?: number; dueDate?: string; paid?: boolean };
type TaskLite = { id: string; type?: string; dueDate?: string; completed?: boolean };

type Defaults = Partial<{
  clearFutureUnpaid: boolean;
  deletePastPaid: boolean;
  deleteAssessments: boolean;
  softDeleteEnrollment: boolean;
  deactivateEnrollment: boolean;
}>;

type ConfirmPayload = {
  clearFutureUnpaid: boolean;
  deletePastPaid: boolean;
  deleteAssessmentIds: string[];
  softDeleteEnrollment: boolean;
  deactivateEnrollment: boolean;
  keepPaymentIds: string[];
};

export function EnrollmentCleanupDialog({
  open,
  enrollmentLabel,
  payments,
  assessments,
  defaults,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  enrollmentLabel: string;
  payments: PaymentLite[];
  assessments: TaskLite[];
  defaults?: Defaults;
  onCancel: () => void;
  onConfirm: (opts: ConfirmPayload) => void;
}) {
  const today10 = React.useMemo(() => toISODate(new Date()), []);

  const [clearFutureUnpaid, setClearFutureUnpaid] = React.useState<boolean>(
    defaults?.clearFutureUnpaid ?? true,
  );
  const [deletePastPaid, setDeletePastPaid] = React.useState<boolean>(defaults?.deletePastPaid ?? false);
  const [deleteAssessments, setDeleteAssessments] = React.useState<boolean>(
    defaults?.deleteAssessments ?? false,
  );
  const [softDeleteEnrollment, setSoftDeleteEnrollment] = React.useState<boolean>(
    defaults?.softDeleteEnrollment ?? true,
  );
  const [deactivateEnrollment, setDeactivateEnrollment] = React.useState<boolean>(
    defaults?.deactivateEnrollment ?? false,
  );

  // Per-item toggles
  const allPaymentIds = React.useMemo(
    () => (payments || []).filter((p) => !!p.id).map((p) => String(p.id)),
    [payments],
  );
  const allAssessmentIds = React.useMemo(() => (assessments || []).map((a) => String(a.id)), [assessments]);

  const [keepPaymentIds, setKeepPaymentIds] = React.useState<string[]>(allPaymentIds);
  const [selectedAssessmentIds, setSelectedAssessmentIds] = React.useState<string[]>(allAssessmentIds);

  // Reset when opened (and when lists change between openings)
  React.useEffect(() => {
    if (!open) return;

    setClearFutureUnpaid(defaults?.clearFutureUnpaid ?? true);
    setDeletePastPaid(defaults?.deletePastPaid ?? false);
    setDeleteAssessments(defaults?.deleteAssessments ?? false);
    setSoftDeleteEnrollment(defaults?.softDeleteEnrollment ?? true);
    setDeactivateEnrollment(defaults?.deactivateEnrollment ?? false);

    setKeepPaymentIds(allPaymentIds);
    setSelectedAssessmentIds(allAssessmentIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    defaults?.clearFutureUnpaid,
    defaults?.deletePastPaid,
    defaults?.deleteAssessments,
    defaults?.softDeleteEnrollment,
    defaults?.deactivateEnrollment,
    allPaymentIds.join(","),
    allAssessmentIds.join(","),
  ]);

  const toggleKeepPayment = (id?: string) => {
    const pid = String(id || "");
    if (!pid) return;
    setKeepPaymentIds((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));
  };

  const toggleAssessment = (id: string) => {
    const tid = String(id);
    setSelectedAssessmentIds((s) => (s.includes(tid) ? s.filter((x) => x !== tid) : [...s, tid]));
  };

  const futureUnpaidCount = React.useMemo(() => {
    return (payments || []).filter((p) => {
      const d = safeISODate10(p.dueDate) || "";
      return !p.paid && !!d && d > today10;
    }).length;
  }, [payments, today10]);

  const paidPastCount = React.useMemo(() => {
    return (payments || []).filter((p) => {
      const d = safeISODate10(p.dueDate) || "";
      return !!p.paid && (!!d ? d <= today10 : true);
    }).length;
  }, [payments, today10]);

  return (
    <Modal
      isOpen={open}
      title={`Cleanup options — ${enrollmentLabel}`}
      onClose={onCancel}
      onBeforeClose={() => true}
      widthClass="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() =>
              onConfirm({
                clearFutureUnpaid,
                deletePastPaid,
                deleteAssessmentIds: deleteAssessments ? selectedAssessmentIds : [],
                softDeleteEnrollment,
                deactivateEnrollment,
                keepPaymentIds,
              })
            }
          >
            Apply
          </button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Payments */}
        <div className="rounded border p-3">
          <div className="mb-2 font-medium">Payments</div>

          <label className="mb-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={clearFutureUnpaid}
              onChange={(e) => setClearFutureUnpaid(e.currentTarget.checked)}
            />
            <span>
              Clear future unpaid projections{" "}
              <span className="text-slate-500">({futureUnpaidCount})</span>
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={deletePastPaid}
              onChange={(e) => setDeletePastPaid(e.currentTarget.checked)}
            />
            <span>
              Also delete past paid items{" "}
              <span className="text-slate-500">({paidPastCount})</span>
            </span>
          </label>

          <details className="mt-2">
            <summary className="cursor-pointer select-none text-slate-700">
              Select payments to keep/remove
            </summary>

            <div className="mt-2 max-h-40 overflow-auto divide-y">
              {payments.length === 0 ? (
                <div className="px-2 py-1 text-slate-500">No payments</div>
              ) : (
                payments.map((p, idx) => {
                  const id = p.id ? String(p.id) : "";
                  const due10 = fmtDateOrDash(p.dueDate);
                  const amt = Number(p.amount || 0).toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  });
                  const label = `${due10} · ${amt}${p.paid ? " · PAID" : ""}`;
                  const keep = id ? keepPaymentIds.includes(id) : false;

                  return (
                    <label key={id || `${label}_${idx}`} className="flex items-center gap-2 px-2 py-1">
                      <input
                        type="checkbox"
                        checked={keep}
                        onChange={() => toggleKeepPayment(id)}
                        disabled={!id}
                        title={!id ? "This payment has no id; cannot be targeted for keep/remove." : undefined}
                      />
                      <span className="truncate">
                        {label}
                        {!id ? " (no id)" : ""}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Keep list is an allowlist: any checked payment id will be preserved even if it matches deletion rules.
            </div>
          </details>
        </div>

        {/* Tasks/Assessments */}
        <div className="rounded border p-3">
          <div className="mb-2 font-medium">Tasks</div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={deleteAssessments}
              onChange={(e) => setDeleteAssessments(e.currentTarget.checked)}
            />
            <span>Delete selected tasks</span>
          </label>

          {deleteAssessments && (
            <div className="mt-2 max-h-40 overflow-auto divide-y">
              {assessments.length === 0 ? (
                <div className="px-2 py-1 text-slate-500">No tasks</div>
              ) : (
                assessments.map((a) => {
                  const due10 = fmtDateOrDash(a.dueDate);
                  const label = `${due10} · ${a.type || "task"}${a.completed ? " · COMPLETED" : ""}`;
                  const checked = selectedAssessmentIds.includes(String(a.id));

                  return (
                    <label key={a.id} className="flex items-center gap-2 px-2 py-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssessment(a.id)}
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Final */}
        <div className="rounded border p-3">
          <div className="mb-2 font-medium">Final action</div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={softDeleteEnrollment}
              onChange={(e) => setSoftDeleteEnrollment(e.currentTarget.checked)}
            />
            <span>Soft delete enrollment</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={deactivateEnrollment}
              onChange={(e) => setDeactivateEnrollment(e.currentTarget.checked)}
            />
            <span>Deactivate (close) enrollment</span>
          </label>

          <div className="mt-1 text-xs text-slate-500">
            You can choose both: close the enrollment and also mark it deleted for UI lists.
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default EnrollmentCleanupDialog;

