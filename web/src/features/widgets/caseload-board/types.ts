// features/caseload-board/types.ts
// Core types for the CaseLoad Board feature.

import type { InboxDetailKind } from "@hooks/useInboxDetail";

// ---------------------------------------------------------------------------
// Bucket
// ---------------------------------------------------------------------------

export type BoardBucketId = string;

export interface BoardBucketConfig {
  id: BoardBucketId;
  label: string;
  /** True if this bucket represents a done/completed state. */
  isCompletion?: boolean;
}

// ---------------------------------------------------------------------------
// Task type
// ---------------------------------------------------------------------------

export type BoardTaskTypeId =
  | "payment"
  | "complianceTask"
  | "assessment"
  | "task"
  | "other"
  | "customer"
  | "grantCompliance"
  | "userVerification";

export interface BoardTaskTypeConfig {
  id: BoardTaskTypeId;
  label: string;
  /** Emoji or short text used in the tab strip. */
  icon: string;
  /** Lower number = further left in the tab strip. */
  sortOrder: number;
  /** Which InboxDetailKind values map to this task type group. */
  detailKinds: InboxDetailKind[];
  /** Ordered list of buckets for this task type's board. */
  buckets: BoardBucketConfig[];
  /**
   * Classify a partially-built BoardTask (no bucketId yet) into a bucket.
   * Called once per task during adapter mapping.
   */
  classifyBucket: (task: Omit<BoardTask, "bucketId">) => BoardBucketId;
  /**
   * Allowed drag/move targets per source bucket.
   * If omitted, all cross-bucket moves are permitted.
   */
  allowedTransitions?: Record<BoardBucketId, BoardBucketId[]>;
}

// ---------------------------------------------------------------------------
// Board task
// ---------------------------------------------------------------------------

export interface BoardTask {
  /** The underlying raw inbox item (passed through to InboxDetailCardRouter). */
  raw: Record<string, unknown>;
  /** Resolved InboxDetailKind — drives the detail card renderer. */
  kind: InboxDetailKind;
  /** Current board bucket assignment (may be overridden optimistically). */
  bucketId: BoardBucketId;
  /** Parent task type group. */
  taskTypeId: BoardTaskTypeId;
  /** Stable task ID (utid or id). */
  id: string;
  title: string;
  subtitle: string | null;
  dueDate: string | null;
  status: string;
  customerId: string | null;
  assignedToUid: string | null;
  isCompleted: boolean;
}

// ---------------------------------------------------------------------------
// Move payload
// ---------------------------------------------------------------------------

export interface MoveBucketPayload {
  taskId: string;
  taskTypeId: BoardTaskTypeId;
  fromBucket: BoardBucketId;
  toBucket: BoardBucketId;
  task: BoardTask;
}

// ---------------------------------------------------------------------------
// Board state
// ---------------------------------------------------------------------------

export interface BoardState {
  /** taskTypeId → bucketId → BoardTask[] */
  board: Partial<Record<BoardTaskTypeId, Record<BoardBucketId, BoardTask[]>>>;
  /**
   * Task type IDs that have at least one task — drives which tabs appear.
   * Types with ALL tasks completed still appear; empty types do not.
   */
  activeTaskTypeIds: BoardTaskTypeId[];
}

// ---------------------------------------------------------------------------
// Filter state (used as DashboardToolDefinition filterState)
// ---------------------------------------------------------------------------

export interface CaseLoadBoardFilterState {
  month: string;
  /** Currently selected task type tab. null = first active type. */
  activeTaskTypeId: BoardTaskTypeId | null;
}
