"use client";

import React from "react";
import { toast } from "@lib/toast";
import type { ReconciliationActionPreview } from "./reconciliationActions";
import type { ReconciliationApplyResult } from "./useReconciliationActionApply";

/**
 * Action kinds this modal can actually edit before applying — gated to what
 * the underlying backend endpoint accepts as an editable field:
 * `extend_schedule` -> paymentsUpsertProjections' `payments` array,
 * `patch_queue_amount` -> paymentQueuePatch's `amount`/`amountAbs`.
 * `post_schedule_payment`/`post_queue_payment` have no editable field on
 * their endpoints (paymentsSpend/paymentQueuePostToLedger take no date or
 * amount override) so they stay confirm-only, same as before this modal.
 */
export function isAdjustableActionKind(kind: ReconciliationActionPreview["kind"]): boolean {
  return kind === "extend_schedule" || kind === "patch_queue_amount";
}

type ScheduleRowDraft = { id: string; month: string; amount: string };

function scheduleRowsFromAction(action: ReconciliationActionPreview): ScheduleRowDraft[] {
  return (action.editableScheduleRows ?? []).map((row, index) => ({
    id: `${row.month}-${index}`,
    month: row.month,
    amount: (row.amountCents / 100).toFixed(2),
  }));
}

export default function ReconciliationAdjustModal({
  action,
  apply,
  busy,
  onClose,
  onResult,
}: {
  action: ReconciliationActionPreview | null;
  apply: (
    action: ReconciliationActionPreview,
    opts?: { skipConfirm?: boolean; overridePatch?: Record<string, unknown> },
  ) => Promise<ReconciliationApplyResult>;
  busy: boolean;
  onClose: () => void;
  onResult?: (result: ReconciliationApplyResult) => void;
}) {
  const [scheduleRows, setScheduleRows] = React.useState<ScheduleRowDraft[]>([]);
  const [amountDraft, setAmountDraft] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!action) return;
    setScheduleRows(scheduleRowsFromAction(action));
    setAmountDraft(
      action.kind === "patch_queue_amount"
        ? String((action.patch as Record<string, unknown> | undefined)?.amount ?? "")
        : "",
    );
  }, [action]);

  if (!action) return null;

  const updateScheduleRow = (id: string, patch: Partial<ScheduleRowDraft>) => {
    setScheduleRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const removeScheduleRow = (id: string) => {
    setScheduleRows((current) => current.filter((row) => row.id !== id));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      let overridePatch: Record<string, unknown> | undefined;
      if (action.kind === "extend_schedule") {
        const basePayments = Array.isArray((action.patch as Record<string, unknown> | undefined)?.payments)
          ? ((action.patch as Record<string, unknown>).payments as Array<Record<string, unknown>>)
          : [];
        const originalNewCount = action.editableScheduleRows?.length ?? 0;
        const existingPayments = basePayments.slice(0, Math.max(0, basePayments.length - originalNewCount));
        const lineItemId = action.editableScheduleRows?.[0]?.lineItemId;
        const newRows = scheduleRows
          .filter((row) => /^\d{4}-\d{2}$/.test(row.month) && Number(row.amount) > 0)
          .map((row) => ({
            type: "monthly",
            lineItemId,
            amount: Number(row.amount),
            dueDate: `${row.month}-01`,
            paid: false,
          }));
        if (!newRows.length) {
          toast("Add at least one valid month/amount before applying.", { type: "warn" });
          return;
        }
        overridePatch = { payments: [...existingPayments, ...newRows] };
      } else if (action.kind === "patch_queue_amount") {
        const amount = Number(amountDraft);
        if (!Number.isFinite(amount) || amount <= 0) {
          toast("Enter a valid amount.", { type: "warn" });
          return;
        }
        overridePatch = { amount, amountAbs: amount };
      }
      const result = await apply(action, { skipConfirm: true, overridePatch });
      toast(result.message, { type: result.ok ? "success" : "error" });
      onResult?.(result);
      if (result.ok) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Adjust: {action.label}</div>
          <div className="mt-1 text-xs text-slate-500">
            Edit the proposed values below, then apply. This still writes directly to Firestore — nothing here defers or auto-runs.
          </div>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {action.kind === "extend_schedule" ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Months to add</div>
              {scheduleRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    type="month"
                    className="input h-9 flex-1 px-2 text-sm"
                    value={row.month}
                    onChange={(event) => updateScheduleRow(row.id, { month: event.currentTarget.value })}
                  />
                  <span className="text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input h-9 w-32 px-2 text-sm"
                    value={row.amount}
                    onChange={(event) => updateScheduleRow(row.id, { amount: event.currentTarget.value })}
                  />
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => removeScheduleRow(row.id)}>
                    Remove
                  </button>
                </div>
              ))}
              {!scheduleRows.length ? (
                <div className="text-xs text-slate-400">No months left — close this and skip the action instead of applying an empty schedule change.</div>
              ) : null}
            </div>
          ) : null}
          {action.kind === "patch_queue_amount" ? (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input h-9 w-40 px-2 text-sm"
                  value={amountDraft}
                  onChange={(event) => setAmountDraft(event.currentTarget.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
            <div><span className="text-slate-400">Target:</span> {action.target}{action.targetId ? `/${action.targetId}` : ""}</div>
            <div><span className="text-slate-400">Current:</span> {action.currentValue}</div>
          </div>
          {action.warning ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {action.warning}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={disabled}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={disabled}>
            {disabled ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
