"use client";

// features/caseload-board/BoardColumn.tsx
// A single bucket column in the board grid.
// Accepts HTML5 drag-and-drop events and renders TaskBoardCards.

import React from "react";
import type { BoardBucketConfig, BoardTask, BoardTaskTypeId } from "./types";
import { TaskBoardCard } from "./TaskBoardCard";

interface BoardColumnProps {
  bucket: BoardBucketConfig;
  tasks: BoardTask[];
  taskTypeId: BoardTaskTypeId;
  draggingId: string | null;
  draggingTask: BoardTask | null;
  onDragStart: (task: BoardTask) => void;
  onDragEnd: () => void;
  onDrop: (toBucket: string) => void;
  onOpenTask: (task: BoardTask) => void;
}

export function BoardColumn({
  bucket,
  tasks,
  draggingId,
  draggingTask,
  onDragStart,
  onDragEnd,
  onDrop,
  onOpenTask,
}: BoardColumnProps) {
  const [isDropTarget, setIsDropTarget] = React.useState(false);

  // Only allow drop if the dragged card is from a different bucket
  const canDrop = !!draggingTask && draggingTask.bucketId !== bucket.id;

  return (
    <div
      className={[
        "flex flex-col rounded-xl border transition-colors duration-150",
        isDropTarget && canDrop
          ? "border-blue-400 bg-blue-50/60 shadow-inner"
          : "border-slate-200 bg-slate-50/80",
      ].join(" ")}
      onDragOver={(e) => {
        if (!canDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDropTarget(true);
      }}
      onDragLeave={(e) => {
        // Only clear if leaving the column itself, not a child
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsDropTarget(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDropTarget(false);
        if (canDrop) onDrop(bucket.id);
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span
          className={`text-[11px] font-bold uppercase tracking-widest ${
            bucket.isCompletion ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          {bucket.label}
        </span>
        <span className="text-[10px] font-bold text-slate-400 tabular-nums bg-white border border-slate-200 rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone indicator when drag is active */}
      {isDropTarget && canDrop && (
        <div className="mx-2 mb-1 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 py-1.5 text-center text-xs font-medium text-blue-500 shrink-0">
          Drop here
        </div>
      )}

      {/* Cards scroll area */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-[48px] space-y-2">
        {tasks.length === 0 && !isDropTarget ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">
            Empty
          </div>
        ) : (
          tasks.map((task) => (
            <TaskBoardCard
              key={task.id}
              task={task}
              onOpen={onOpenTask}
              draggingId={draggingId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
}
