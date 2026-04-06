"use client";

// features/caseload-board/TaskDetailModal.tsx
// Modal overlay that shows the full task detail card for a selected board task.
// Reuses InboxDetailCardRouter (same renderer as the Inbox tool).
// Includes MoveBucketActions so users can change bucket without dragging.

import React from "react";
import { Modal } from "@entities/ui/Modal";
import { InboxDetailCardRouter } from "@entities/detail-card/inboxCards";
import { useInboxTaskRegistry } from "@entities/tasks/inboxTaskRegistry";
import { MoveBucketActions } from "./MoveBucketActions";
import type { BoardTask, BoardTaskTypeConfig, MoveBucketPayload } from "./types";

interface TaskDetailModalProps {
  task: BoardTask | null;
  isOpen: boolean;
  onClose: () => void;
  onMoveBucket: (payload: MoveBucketPayload) => void;
  typeConfig: BoardTaskTypeConfig | null;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onMoveBucket,
  typeConfig,
}: TaskDetailModalProps) {
  const registry = useInboxTaskRegistry();

  const actions = React.useMemo(() => {
    if (!task) return undefined;
    return registry.resolve(task.raw as any);
  }, [task, registry]);

  const anyPending = Object.values(registry.pending).some(Boolean);

  const handleMoveBucket = (payload: MoveBucketPayload) => {
    onMoveBucket(payload);
    onClose();
  };

  if (!task || !typeConfig) return null;

  const currentBucketLabel =
    typeConfig.buckets.find((b) => b.id === task.bucketId)?.label ?? task.bucketId;

  return (
    <Modal
      isOpen={isOpen}
      title={task.title}
      onClose={onClose}
      widthClass="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between w-full gap-3">
          {/* Move-bucket buttons */}
          <MoveBucketActions
            task={task}
            typeConfig={typeConfig}
            onMove={handleMoveBucket}
            disabled={anyPending}
          />
          <button className="btn btn-secondary btn-sm shrink-0 ml-auto" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Current board position badge */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Board position:</span>
          <span className="font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
            {typeConfig.label}
          </span>
          <span>›</span>
          <span className="font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
            {currentBucketLabel}
          </span>
        </div>

        {/*
          Existing detail card renderer.
          All card-specific logic (payment toggles, compliance checklist, CM assignment, etc.)
          is inherited from InboxDetailCardRouter — zero duplication.
        */}
        <InboxDetailCardRouter
          item={task.raw as any}
          extras={{
            onSaveNote: actions?.canSaveNote ? actions.saveNote : undefined,
            onUpdateCompliance: actions?.canUpdateCompliance
              ? actions.updateCompliance
              : undefined,
            onMarkPaid: actions?.canMarkPaid ? actions.markPaid : undefined,
            onAutoClose: onClose,
          }}
        />

        {/*
          TODO: Reserved areas for future modal interactions:
          ──────────────────────────────────────────────────
          - Reassign to another case manager (TaskReassignSelect)
          - Note thread / timestamped history
          - Linked payment detail / ledger view
          - Jotform submission inline viewer
          - Full audit trail / status change history
          - Enrollment quick-links (already partially via DetailQuickLinks)
        */}
      </div>
    </Modal>
  );
}
