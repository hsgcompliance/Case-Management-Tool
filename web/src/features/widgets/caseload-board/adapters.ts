// features/caseload-board/adapters.ts
// Maps raw inbox items (from useMyInbox) to BoardTask / BoardState.
// All inbox-specific knowledge is isolated here behind an adapter boundary.

import { getInboxDetailKind, isInboxClosed } from "@hooks/useInboxDetail";
import { BOARD_TASK_TYPE_CONFIGS, getTaskTypeForKind } from "./boardConfig";
import type { BoardBucketId, BoardState, BoardTask, BoardTaskTypeId } from "./types";

// ---------------------------------------------------------------------------
// Single-item mapper
// ---------------------------------------------------------------------------

export function mapInboxItemToBoardTask(item: Record<string, unknown>): BoardTask {
  const kind = getInboxDetailKind(item as any);
  const typeConfig = getTaskTypeForKind(kind);
  const status = String(item?.status ?? "").toLowerCase();
  const isCompleted = isInboxClosed(status);

  // Build partial task first (no bucketId yet) so classifyBucket can inspect it
  const partial: Omit<BoardTask, "bucketId"> = {
    raw: item,
    kind,
    taskTypeId: typeConfig.id,
    id: String(item?.utid ?? item?.id ?? ""),
    title: String(item?.title ?? "Task"),
    subtitle: String(item?.subtitle ?? item?.note ?? item?.notes ?? "") || null,
    dueDate: String(item?.dueDate ?? item?.dueDateISO ?? "") || null,
    status,
    customerId: String(item?.customerId ?? item?.clientId ?? "") || null,
    assignedToUid: String(item?.assignedToUid ?? "") || null,
    isCompleted,
  };

  const bucketId = typeConfig.classifyBucket(partial);
  return { ...partial, bucketId };
}

// ---------------------------------------------------------------------------
// Full board state mapper
// ---------------------------------------------------------------------------

export function mapInboxTasksToBoardState(items: Record<string, unknown>[]): BoardState {
  const board: Partial<Record<BoardTaskTypeId, Record<BoardBucketId, BoardTask[]>>> = {};
  const seenTypeIds = new Set<BoardTaskTypeId>();

  for (const item of items) {
    const task = mapInboxItemToBoardTask(item);

    if (!board[task.taskTypeId]) {
      board[task.taskTypeId] = {};
    }
    const typeBuckets = board[task.taskTypeId]!;
    if (!typeBuckets[task.bucketId]) {
      typeBuckets[task.bucketId] = [];
    }
    typeBuckets[task.bucketId]!.push(task);
    seenTypeIds.add(task.taskTypeId);
  }

  // Active types in display order; include types with only-completed tasks
  const activeTaskTypeIds = BOARD_TASK_TYPE_CONFIGS
    .filter((c) => seenTypeIds.has(c.id))
    .map((c) => c.id);

  return { board, activeTaskTypeIds };
}
