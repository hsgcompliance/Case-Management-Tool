"use client";

import React from "react";
import Modal from "@entities/ui/Modal";
import TaskReassignSelect, { type TaskReassignTarget } from "@entities/selectors/TaskReassignSelect";

type Props = {
  open: boolean;
  title?: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { target: TaskReassignTarget; note: string }) => Promise<void> | void;
};

export default function TaskReassignDialog({
  open,
  title = "Reassign Task",
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const [target, setTarget] = React.useState<TaskReassignTarget>({ kind: "compliance" });
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setTarget({ kind: "compliance" });
    setNote("");
  }, [open]);

  const invalid = target.kind === "cm" && !String(target.cmUid || "").trim();

  return (
    <Modal
      tourId="task-reassign-dialog"
      isOpen={open}
      onClose={onClose}
      title={<span className="text-base font-semibold">{title}</span>}
      footer={
        <div className="flex items-center justify-end gap-2" data-tour="task-reassign-dialog-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting} data-tour="task-reassign-dialog-cancel">
            Cancel
          </button>
          <button
            className="btn btn-sm"
            disabled={submitting || invalid}
            onClick={() => void onSubmit({ target, note: String(note || "").trim() })}
            data-tour="task-reassign-dialog-submit"
          >
            {submitting ? "Applying..." : "Apply Reassign"}
          </button>
        </div>
      }
    >
      <div className="space-y-3" data-tour="task-reassign-dialog-form">
        <TaskReassignSelect value={target} onChange={setTarget} disabled={submitting} tourId="task-reassign-dialog-target" />
        <label className="block" data-tour="task-reassign-dialog-note">
          <div className="mb-1 text-xs text-slate-600" data-tour="task-reassign-dialog-note-label">Note (optional)</div>
          <textarea
            className="w-full rounded border border-slate-300 p-2 text-sm"
            rows={4}
            value={note}
            disabled={submitting}
            onChange={(e) => setNote(e.currentTarget.value)}
            placeholder="Why are you reassigning this task?"
            data-tour="task-reassign-dialog-note-input"
          />
        </label>
      </div>
    </Modal>
  );
}
