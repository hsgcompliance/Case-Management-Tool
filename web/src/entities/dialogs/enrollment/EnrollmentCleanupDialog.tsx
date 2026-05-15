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
      title={`${isAdminDelete ? "Permanently delete" : "Delete"} enrollment — ${enrollmentLabel}`}
      onClose={onCancel}
      onBeforeClose={() => true}
      widthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={isAdminDelete ? "btn-danger" : "btn-primary"}
            onClick={() => onConfirm({ voidPaid, unlinkSpends })}
          >
            {isAdminDelete ? "Delete permanently" : "Delete"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">
          {isAdminDelete
            ? "This will permanently remove the enrollment and cannot be undone."
            : "This will soft-delete the enrollment."}
          {" "}Choose what to do with associated spend records:
        </p>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={voidPaid}
            onChange={(e) => setVoidPaid(e.currentTarget.checked)}
          />
          <span>
            <span className="font-medium">Reverse paid rows</span>
            <span className="ml-1 text-slate-500">— create ledger reversals for any paid spend items</span>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={unlinkSpends}
            onChange={(e) => setUnlinkSpends(e.currentTarget.checked)}
          />
          <span>
            <span className="font-medium">Unlink CC / Invoice spends from grant</span>
            <span className="ml-1 text-slate-500">— removes grant attribution from credit card and invoice payment queue items (submissions are kept)</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

export default EnrollmentCleanupDialog;
