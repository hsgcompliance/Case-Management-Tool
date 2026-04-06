"use client";

// features/caseload-board/MoveBucketActions.tsx
// Move-to-bucket action buttons shown inside the task detail modal.

import React from "react";
import type { BoardTask, BoardTaskTypeConfig, MoveBucketPayload } from "./types";

interface MoveBucketActionsProps {
  task: BoardTask;
  typeConfig: BoardTaskTypeConfig;
  onMove: (payload: MoveBucketPayload) => void;
  disabled?: boolean;
}

export function MoveBucketActions({
  task,
  typeConfig,
  onMove,
  disabled,
}: MoveBucketActionsProps) {
  // Determine which buckets are valid targets
  const allowedTargetIds =
    typeConfig.allowedTransitions?.[task.bucketId] ??
    typeConfig.buckets.map((b) => b.id).filter((id) => id !== task.bucketId);

  const targetBuckets = typeConfig.buckets.filter((b) => allowedTargetIds.includes(b.id));

  if (targetBuckets.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500 shrink-0">Move to:</span>
      {targetBuckets.map((bucket) => (
        <button
          key={bucket.id}
          type="button"
          disabled={disabled}
          onClick={() =>
            onMove({
              taskId: task.id,
              taskTypeId: task.taskTypeId,
              fromBucket: task.bucketId,
              toBucket: bucket.id,
              task,
            })
          }
          className={[
            "btn btn-sm",
            bucket.isCompletion ? "btn-success" : "btn-outline",
            disabled ? "opacity-50 cursor-not-allowed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          → {bucket.label}
        </button>
      ))}
    </div>
  );
}
