"use client";

// features/caseload-board/useBoardState.ts
// Data layer for the CaseLoad Board.
// Pulls from the same useMyInbox cache as the Inbox tool.
// Applies optimistic bucket overrides locally while TODO backend mutations are wired.

import React from "react";
import { useMyInbox } from "@hooks/useInbox";
import { toApiError } from "@client/api";
import { useInboxTaskRegistry } from "@entities/tasks/inboxTaskRegistry";
import { toast } from "@lib/toast";
import type {
  BoardState,
  BoardTask,
  BoardTaskTypeId,
  CaseLoadBoardFilterState,
  MoveBucketPayload,
} from "./types";
import { mapInboxTasksToBoardState } from "./adapters";

export function useBoardData(filters: CaseLoadBoardFilterState) {
  const registry = useInboxTaskRegistry();

  // Re-uses the same query key as InboxMain — shares the cache, no duplicate fetch
  const inboxQ = useMyInbox(
    { month: filters.month, includeOverdue: true, includeGroup: true },
    { staleTime: 30_000 }
  );

  // Local optimistic overrides: taskId → new bucketId
  const [optimisticBuckets, setOptimisticBuckets] = React.useState<Record<string, string>>({});

  // Clear optimistic state when the month changes
  React.useEffect(() => {
    setOptimisticBuckets({});
  }, [filters.month]);

  // Map server inbox items to board state
  const serverState = React.useMemo<BoardState>(() => {
    const items = (inboxQ.data ?? []) as Record<string, unknown>[];
    return mapInboxTasksToBoardState(items);
  }, [inboxQ.data]);

  // Merge optimistic overrides on top of server state
  const boardState = React.useMemo<BoardState>(() => {
    if (Object.keys(optimisticBuckets).length === 0) return serverState;

    // Shallow-copy bucket arrays so we don't mutate server state
    const board: BoardState["board"] = {};
    for (const [typeId, buckets] of Object.entries(serverState.board)) {
      (board as Record<string, unknown>)[typeId] = {};
      for (const [bucketId, tasks] of Object.entries(buckets)) {
        (board as any)[typeId][bucketId] = [...tasks];
      }
    }

    // Apply each optimistic move
    for (const [taskId, newBucketId] of Object.entries(optimisticBuckets)) {
      for (const typeId of Object.keys(board) as BoardTaskTypeId[]) {
        const typeBuckets = (board as any)[typeId] as Record<string, BoardTask[]>;
        for (const bucketId of Object.keys(typeBuckets)) {
          const idx = typeBuckets[bucketId].findIndex((t) => t.id === taskId);
          if (idx >= 0) {
            const [moved] = typeBuckets[bucketId].splice(idx, 1);
            if (!typeBuckets[newBucketId]) typeBuckets[newBucketId] = [];
            typeBuckets[newBucketId].push({ ...moved, bucketId: newBucketId });
          }
        }
      }
    }

    return { ...serverState, board };
  }, [serverState, optimisticBuckets]);

  const rollback = React.useCallback((taskId: string) => {
    setOptimisticBuckets((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }, []);

  const moveBucket = React.useCallback(async (payload: MoveBucketPayload) => {
    if (payload.fromBucket === payload.toBucket) return;

    // Optimistic local update — instantly moves card in UI
    setOptimisticBuckets((prev) => ({ ...prev, [payload.taskId]: payload.toBucket }));

    try {
      const actions = registry.resolve(payload.task.raw as any);
      const { taskTypeId, toBucket, fromBucket } = payload;

      if (taskTypeId === "payment") {
        if (toBucket === "paid") {
          // Mark payment as received
          await actions.markPaid?.(true);
        } else if (fromBucket === "paid" && toBucket === "processing") {
          // Unmark paid
          await actions.markPaid?.(false);
        } else if (toBucket === "data-entry-complete") {
          // Mark both HMIS and CW complete
          await actions.updateCompliance?.({ hmisComplete: true, caseworthyComplete: true });
        }
      } else if (taskTypeId === "complianceTask") {
        if (toBucket === "approved") {
          await actions.complete?.();
        } else if (toBucket === "pending" || toBucket === "in-review") {
          await actions.reopen?.();
        }
      } else if (taskTypeId === "task" || taskTypeId === "assessment") {
        if (toBucket === "done" || toBucket === "complete") {
          await actions.complete?.();
        } else if (toBucket === "open" || toBucket === "scheduled" || toBucket === "in-progress") {
          await actions.reopen?.();
        }
      } else if (taskTypeId === "other") {
        if (toBucket === "done") await actions.complete?.();
        else await actions.reopen?.();
      }
    } catch (e: any) {
      rollback(payload.taskId);
      const msg = toApiError(e, "Move failed.").error;
      toast(msg, { type: "error" });
    }
  }, [registry, rollback]);

  return {
    boardState,
    isLoading: inboxQ.isLoading,
    isFetching: inboxQ.isFetching,
    moveBucket,
    refetch: inboxQ.refetch,
  };
}
