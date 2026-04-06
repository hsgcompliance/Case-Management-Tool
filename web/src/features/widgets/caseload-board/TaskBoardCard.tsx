"use client";

// features/caseload-board/TaskBoardCard.tsx
// Compact card shown inside a board column. Draggable. Click opens detail modal.

import React from "react";
import { fmtDateOrDash } from "@lib/formatters";
import type { BoardTask } from "./types";

interface TaskBoardCardProps {
  task: BoardTask;
  onOpen: (task: BoardTask) => void;
  draggingId: string | null;
  onDragStart: (task: BoardTask) => void;
  onDragEnd: () => void;
}

export function TaskBoardCard({
  task,
  onOpen,
  draggingId,
  onDragStart,
  onDragEnd,
}: TaskBoardCardProps) {
  const isDragging = draggingId === task.id;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !task.isCompleted && !!task.dueDate && task.dueDate < today;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(task);
      }}
      aria-label={`Task: ${task.title}`}
      className={[
        "cursor-pointer select-none rounded-lg border bg-white px-3 py-2.5 shadow-sm",
        "hover:border-slate-300 hover:shadow-md transition-all duration-150",
        isDragging ? "opacity-40 scale-95" : "opacity-100",
        task.isCompleted ? "bg-slate-50" : "",
        isOverdue ? "border-l-[3px] border-l-rose-400 border-slate-200" : "border-slate-200",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Title */}
      <div
        className={`text-sm font-medium leading-snug truncate ${
          task.isCompleted ? "text-slate-400 line-through" : "text-slate-800"
        }`}
      >
        {task.title}
      </div>

      {/* Subtitle / notes */}
      {task.subtitle && (
        <div className="mt-0.5 text-xs text-slate-500 truncate">{task.subtitle}</div>
      )}

      {/* Footer metadata row */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {task.dueDate && (
          <span
            className={`text-[10px] font-semibold tabular-nums ${
              isOverdue ? "text-rose-600" : "text-slate-400"
            }`}
          >
            {isOverdue ? "⚠ " : ""}
            {fmtDateOrDash(task.dueDate)}
          </span>
        )}

        {task.isCompleted && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
            Done
          </span>
        )}

        {/* Customer ID chip — intentionally brief; full name not always available here */}
        {task.customerId && !task.isCompleted && (
          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[90px]">
            {task.customerId}
          </span>
        )}
      </div>
    </div>
  );
}
