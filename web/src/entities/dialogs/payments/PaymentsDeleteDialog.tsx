"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Modal } from "@entities/ui/Modal";
import type { ReqOf } from "@types";

const GrantBudgetStrip = dynamic(
  () => import("@entities/grants/GrantBudgetStrip").then((m) => m.GrantBudgetStrip),
  { ssr: false, loading: () => <div className="h-10 animate-pulse rounded bg-slate-100" /> },
);

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
  grantId?: string | null;
  onCancel: () => void;
  onConfirm: (body: ReqOf<"paymentsDeleteRows">) => void;
};

export default function PaymentsDeleteDialog({
  open,
  selected,
  busy = false,
  grantId,
  onCancel,
  onConfirm,
}: Props) {
  const [scope, setScope] = React.useState<Scope>("selected");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setScope("selected");
    setError(null);
  }, [open, selected]);

  const submit = () => {
    setError(null);
    const enrollmentId = String(selected?.enrollmentId || "").trim();
    const paymentId = String(selected?.paymentId || "").trim();
    if (!enrollmentId) return setError("No enrollment selected.");
    if (scope === "selected" && !paymentId) return setError("No payment selected.");
    const deletingSelectedPaidPayment = scope === "selected" && selected?.paid === true;
    onConfirm({
      enrollmentId,
      ...(scope === "allEnrollment"
        ? { deleteAll: true }
        : { deleteAll: false, paymentIds: [paymentId] }),
      // Paid deletion is one safe operation: reverse ledger, remove spend
      // mirrors, and update budgets together. Bulk scope intentionally leaves
      // paid history alone and deletes only unpaid projections.
      preservePaid: !deletingSelectedPaidPayment,
      updateBudgets: deletingSelectedPaidPayment,
      removeSpends: true,
      reverseLedger: deletingSelectedPaidPayment,
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
            {scope === "selected" && selected?.paid
              ? "The paid spend will be reversed, its spend records removed, and the grant budget recalculated."
              : "Unpaid projections and their related spend records will be removed; paid history is preserved."}
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

        {grantId && <GrantBudgetStrip grantId={grantId} />}

        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <div className="font-medium text-slate-900">Scope</div>
          <label className="mt-2 flex items-center gap-2">
            <input type="radio" name="delete-payments-scope" checked={scope === "selected"} onChange={() => setScope("selected")} />
            <span>Delete selected payment</span>
          </label>
          <label className="mt-1 flex items-center gap-2">
            <input type="radio" name="delete-payments-scope" checked={scope === "allEnrollment"} onChange={() => setScope("allEnrollment")} />
            <span>Delete all unpaid payments in this enrollment</span>
          </label>
        </div>

        <div className="rounded border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          Budget and ledger cleanup is automatic. Paid payment rows cannot be deleted without a compensating ledger reversal.
        </div>
      </div>
    </Modal>
  );
}
