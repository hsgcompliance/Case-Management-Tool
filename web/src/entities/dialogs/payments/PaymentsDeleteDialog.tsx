"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import type { ReqOf } from "@types";

type Scope = "selected" | "allEnrollment";

type SelectedPaymentLite = {
  enrollmentId: string;
  paymentId: string;
  paid?: boolean | null;
  amount?: number | null;
  dueDate?: string | null;
};

type Props = {
  open: boolean;
  selected: SelectedPaymentLite | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (body: ReqOf<"paymentsDeleteRows">) => void;
};

export default function PaymentsDeleteDialog({
  open,
  selected,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [scope, setScope] = React.useState<Scope>("selected");
  const [preservePaid, setPreservePaid] = React.useState(true);
  const [updateBudgets, setUpdateBudgets] = React.useState(false);
  const [removeSpends, setRemoveSpends] = React.useState(true);
  const [reverseLedger, setReverseLedger] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setScope("selected");
    setPreservePaid(Boolean(selected?.paid));
    setUpdateBudgets(false);
    setRemoveSpends(true);
    setReverseLedger(true);
    setError(null);
  }, [open, selected]);

  const submit = () => {
    setError(null);
    const enrollmentId = String(selected?.enrollmentId || "").trim();
    const paymentId = String(selected?.paymentId || "").trim();
    if (!enrollmentId) return setError("No enrollment selected.");
    if (scope === "selected" && !paymentId) return setError("No payment selected.");
    onConfirm({
      enrollmentId,
      ...(scope === "allEnrollment"
        ? { deleteAll: true }
        : { deleteAll: false, paymentIds: [paymentId] }),
      preservePaid,
      updateBudgets,
      removeSpends,
      reverseLedger,
    });
  };

  return (
    <Modal
      isOpen={open}
      title="Delete Payments"
      onClose={onCancel}
      widthClass="max-w-xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="text-xs text-slate-600">
            {updateBudgets ? "Will write compensating ledger reversals for paid spends and remove enrollment spend docs." : "Deletes payment rows only (plus spend docs if selected)."}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="btn btn-sm" onClick={submit} disabled={busy}>
              {busy ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        {error ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</div> : null}

        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <div className="font-medium text-slate-900">Scope</div>
          <label className="mt-2 flex items-center gap-2">
            <input type="radio" name="delete-payments-scope" checked={scope === "selected"} onChange={() => setScope("selected")} />
            <span>Delete selected payment</span>
          </label>
          <label className="mt-1 flex items-center gap-2">
            <input type="radio" name="delete-payments-scope" checked={scope === "allEnrollment"} onChange={() => setScope("allEnrollment")} />
            <span>Delete all payments in this enrollment</span>
          </label>
        </div>

        <div className="rounded border border-slate-200 p-3">
          <div className="font-medium text-slate-900">Options</div>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={preservePaid} onChange={(e) => setPreservePaid(e.currentTarget.checked)} />
              <span>Preserve paid payments (Don&apos;t delete already paid rows)</span>
            </label>
            {/*Shouldn't budgets automatically be updated from ledger reversals?*/}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={updateBudgets} onChange={(e) => setUpdateBudgets(e.currentTarget.checked)} />
              <span>Update budgets for deleted paid rows</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={removeSpends} onChange={(e) => setRemoveSpends(e.currentTarget.checked)} />
              <span>Remove enrollment spend subdocs + embedded spends for deleted payments</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={reverseLedger} onChange={(e) => setReverseLedger(e.currentTarget.checked)} disabled={!updateBudgets} />
              <span>Write reversal ledger entries (only when updating budgets)</span>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
