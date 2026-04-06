//web/src/entities/dialogs/PaymentPaidDialog.tsx
"use client";

/**
 * Payment Paid Dialog — emitted payload (FULL request body)
 *
 * This dialog only collects metadata for marking a payment as paid.
 * It returns a complete payload to the caller via `onSave(payload)`.
 *
 * Payload shape emitted by this dialog:
 * {
 *   note?: string;
 *   vendor?: string;
 *   comment?: string;
 * }
 *
 * Notes:
 * - Fields are trimmed; empty strings are omitted (undefined).
 * - `amount` + `dueDate` are display-only; they are NOT emitted.
 */

import React from "react";
import { Modal } from "@entities/ui/Modal";
import type { ISODate } from "@types";

export type PayMeta = {
  note?: string;
  vendor?: string;
  comment?: string;
};

type Props = {
  open: boolean;
  amount: number;
  dueDate?: ISODate | string | null;
  defaults?: PayMeta;
  onCancel: () => void;
  onSave: (meta: PayMeta) => void;
};

export function PaymentPaidDialog({
  open,
  amount,
  dueDate,
  defaults,
  onCancel,
  onSave,
}: Props) {
  const [note, setNote] = React.useState(defaults?.note || "");
  const [vendor, setVendor] = React.useState(defaults?.vendor || "");
  const [comment, setComment] = React.useState(defaults?.comment || "");

  // Reset state when opened / defaults change
  React.useEffect(() => {
    if (!open) return;
    setNote(defaults?.note || "");
    setVendor(defaults?.vendor || "");
    setComment(defaults?.comment || "");
  }, [open, defaults?.note, defaults?.vendor, defaults?.comment]);

  const fmtUSD = (n: number) =>
    Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <Modal
      tourId="payment-paid-dialog"
      isOpen={open}
      title="Mark payment as paid"
      onClose={onCancel}
      onBeforeClose={() => true}
      widthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2" data-tour="payment-paid-dialog-actions">
          <button className="btn-secondary" onClick={onCancel} data-tour="payment-paid-dialog-cancel">
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() =>
              onSave({
                note: note.trim() || undefined,
                vendor: vendor.trim() || undefined,
                comment: comment.trim() || undefined,
              })
            }
            data-tour="payment-paid-dialog-save"
          >
            Save &amp; Mark Paid
          </button>
        </div>
      }
    >
      <div className="mb-3 text-xs text-slate-600" data-tour="payment-paid-dialog-summary">
        {dueDate ? (
          <>
            For <b>{String(dueDate)}</b> ·{" "}
          </>
        ) : null}
        Amount <b>{fmtUSD(amount)}</b>
      </div>

      <div className="space-y-3" data-tour="payment-paid-dialog-form">
        <label className="block text-sm" data-tour="payment-paid-dialog-note">
          <div className="mb-0.5 text-slate-600">Note</div>
          <input
            className="w-full rounded border px-2 py-1"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            autoFocus
            data-tour="payment-paid-dialog-note-input"
          />
        </label>

        <label className="block text-sm" data-tour="payment-paid-dialog-vendor">
          <div className="mb-0.5 text-slate-600">Vendor</div>
          <input
            className="w-full rounded border px-2 py-1"
            value={vendor}
            onChange={(e) => setVendor(e.currentTarget.value)}
            data-tour="payment-paid-dialog-vendor-input"
          />
        </label>

        <label className="block text-sm" data-tour="payment-paid-dialog-comment">
          <div className="mb-0.5 text-slate-600">Additional comments</div>
          <input
            className="w-full rounded border px-2 py-1"
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
            data-tour="payment-paid-dialog-comment-input"
          />
        </label>
      </div>
    </Modal>
  );
}

export default PaymentPaidDialog;
