//web/src/entities/dialogs/enrollment/EnrollmentCleanupDialog.tsx
"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";

export type EnrollmentCleanupOptions = {
  voidPaid: boolean;
  unlinkSpends: boolean;
};

export function EnrollmentCleanupDialog({
  open,
  enrollmentLabel,
  isAdminDelete,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  enrollmentLabel: string;
  isAdminDelete?: boolean;
  onCancel: () => void;
  onConfirm: (opts: EnrollmentCleanupOptions) => void;
}) {
  const [voidPaid, setVoidPaid] = React.useState(false);
  const [unlinkSpends, setUnlinkSpends] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    setVoidPaid(false);
    setUnlinkSpends(true);
  }, [open]);

  return (
    <Modal
      isOpen={open}
      title={`${isAdminDelete ? "Permanently delete" : "Clean up"} enrollment - ${enrollmentLabel}`}
      onClose={onCancel}
      onBeforeClose={() => true}
      widthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`${isAdminDelete ? "btn-danger" : "btn-primary"} btn-sm`}
            onClick={() => onConfirm({ voidPaid, unlinkSpends })}
          >
            {isAdminDelete ? "Delete permanently" : "Clean up enrollment"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
          {isAdminDelete
            ? "This permanently removes the enrollment and cannot be undone."
            : "This soft-deletes the enrollment and keeps a recoverable record."}
          {" "}Choose how to handle associated spend records.
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50">
          <input
            type="checkbox"
            className="mt-1"
            checked={voidPaid}
            onChange={(e) => setVoidPaid(e.currentTarget.checked)}
          />
          <span>
            <span className="block font-medium text-slate-900">Reverse paid rows</span>
            <span className="block text-xs text-slate-500">Create ledger reversals for paid spend items. Leave off for a normal cleanup.</span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50">
          <input
            type="checkbox"
            className="mt-1"
            checked={unlinkSpends}
            onChange={(e) => setUnlinkSpends(e.currentTarget.checked)}
          />
          <span>
            <span className="block font-medium text-slate-900">Unlink CC / invoice spends from grant</span>
            <span className="block text-xs text-slate-500">Default: remove grant attribution from payment queue items while keeping submissions.</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

export default EnrollmentCleanupDialog;
