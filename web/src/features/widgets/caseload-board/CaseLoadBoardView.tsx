"use client";

// features/caseload-board/CaseLoadBoardView.tsx
// The main board layout:
//   - Horizontal tab strip at the top (task type "carousel")
//   - Board columns below for the active task type ONLY (non-active types are not rendered)
//   - Task detail modal overlay

import React from "react";
import type {
  BoardState,
  BoardTask,
  BoardTaskTypeId,
  CaseLoadBoardFilterState,
  MoveBucketPayload,
} from "./types";
import { BOARD_TASK_TYPE_CONFIGS, getBoardTaskTypeConfig } from "./boardConfig";
import { BoardColumn } from "./BoardColumn";
import { TaskDetailModal } from "./TaskDetailModal";

interface CaseLoadBoardViewProps {
  boardState: BoardState;
  filterState: CaseLoadBoardFilterState;
  onFilterChange: (next: CaseLoadBoardFilterState) => void;
  isLoading: boolean;
  onMoveBucket: (payload: MoveBucketPayload) => void;
}

export function CaseLoadBoardView({
  boardState,
  filterState,
  onFilterChange,
  isLoading,
  onMoveBucket,
}: CaseLoadBoardViewProps) {
  const { activeTaskTypeIds, board } = boardState;

  // Resolve which type tab is active — fall back to first available type
  const activeTypeId: BoardTaskTypeId | null = React.useMemo(() => {
    if (!activeTaskTypeIds.length) return null;
    if (
      filterState.activeTaskTypeId &&
      activeTaskTypeIds.includes(filterState.activeTaskTypeId)
    ) {
      return filterState.activeTaskTypeId;
    }
    return activeTaskTypeIds[0] ?? null;
  }, [activeTaskTypeIds, filterState.activeTaskTypeId]);

  const setActiveType = (id: BoardTaskTypeId) => {
    onFilterChange({ ...filterState, activeTaskTypeId: id });
  };

  // Drag state — only one card can be dragged at a time
  const [draggingTask, setDraggingTask] = React.useState<BoardTask | null>(null);

  // Modal state
  const [modalTask, setModalTask] = React.useState<BoardTask | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const openModal = (task: BoardTask) => {
    setModalTask(task);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    // Brief delay so modal can animate out before clearing task
    setTimeout(() => setModalTask(null), 200);
  };

  const handleDrop = (toBucket: string) => {
    if (!draggingTask || !activeTypeId) return;
    onMoveBucket({
      taskId: draggingTask.id,
      taskTypeId: draggingTask.taskTypeId,
      fromBucket: draggingTask.bucketId,
      toBucket,
      task: draggingTask,
    });
    setDraggingTask(null);
  };

  const activeTypeConfig = activeTypeId ? getBoardTaskTypeConfig(activeTypeId) : null;
  const activeBuckets = activeTypeConfig?.buckets ?? [];
  const activeBoard = activeTypeId ? (board[activeTypeId] ?? {}) : {};

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      {/* ── Tab strip (the "board carousel") ────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pb-0.5">
        {isLoading && !activeTaskTypeIds.length ? (
          // Loading skeleton tabs
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-24 rounded-lg bg-slate-100 animate-pulse shrink-0"
              />
            ))}
          </>
        ) : activeTaskTypeIds.length === 0 ? (
          <div className="text-xs text-slate-400 px-2 py-1.5 italic">
            No tasks found for this month.
          </div>
        ) : (
          BOARD_TASK_TYPE_CONFIGS
            .filter((c) => activeTaskTypeIds.includes(c.id))
            .map((c) => {
              const isActive = c.id === activeTypeId;
              const typeBuckets = board[c.id] ?? {};
              const totalCount = Object.values(typeBuckets).reduce(
                (sum, tasks) => sum + tasks.length,
                0
              );
              const completedCount = Object.entries(typeBuckets)
                .filter(([, tasks]) => tasks.some((t) => t.isCompleted))
                .reduce(
                  (sum, [, tasks]) => sum + tasks.filter((t) => t.isCompleted).length,
                  0
                );
              const allDone = totalCount > 0 && completedCount === totalCount;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveType(c.id)}
                  className={[
                    "shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    isActive
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300",
                  ].join(" ")}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                  <span
                    className={[
                      "tabular-nums rounded-full px-1.5 py-0.5 text-[10px] min-w-[18px] text-center",
                      isActive
                        ? "bg-white/20 text-white"
                        : allDone
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    ].join(" ")}
                  >
                    {totalCount}
                  </span>
                </button>
              );
            })
        )}
      </div>

      {/* ── Board columns — ONLY the active type is rendered ─────────────── */}
      {activeTypeConfig ? (
        <div
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden"
          // Prevent rendering of non-active boards entirely
          key={activeTypeId ?? "empty"}
        >
          <div
            className="flex gap-3 h-full"
            style={{ minWidth: `${Math.max(activeBuckets.length * 260, 520)}px` }}
          >
            {activeBuckets.map((bucket) => (
              <div
                key={bucket.id}
                className="flex-1 min-w-[220px] max-w-[360px] flex flex-col overflow-hidden"
              >
                <BoardColumn
                  bucket={bucket}
                  tasks={activeBoard[bucket.id] ?? []}
                  taskTypeId={activeTypeConfig.id}
                  draggingId={draggingTask?.id ?? null}
                  draggingTask={draggingTask}
                  onDragStart={(task) => setDraggingTask(task)}
                  onDragEnd={() => setDraggingTask(null)}
                  onDrop={handleDrop}
                  onOpenTask={openModal}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        !isLoading && (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Select a task type above to view its board.
          </div>
        )
      )}

      {/* ── Task detail modal ────────────────────────────────────────────── */}
      <TaskDetailModal
        task={modalTask}
        isOpen={modalOpen}
        onClose={closeModal}
        onMoveBucket={(payload) => {
          onMoveBucket(payload);
          closeModal();
        }}
        typeConfig={modalTask ? getBoardTaskTypeConfig(modalTask.taskTypeId) : null}
      />
    </div>
  );
}
