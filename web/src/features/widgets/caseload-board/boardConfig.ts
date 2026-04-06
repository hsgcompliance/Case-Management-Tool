// features/caseload-board/boardConfig.ts
// Config-driven per-task-type bucket definitions.
// Add a new entry here to support a new task family on the board.

import type { InboxDetailKind } from "@hooks/useInboxDetail";
import type { BoardTask, BoardTaskTypeConfig, BoardTaskTypeId } from "./types";

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function isClosed(task: Omit<BoardTask, "bucketId">): boolean {
  return task.isCompleted;
}

function statusIncludes(task: Omit<BoardTask, "bucketId">, ...fragments: string[]): boolean {
  const s = task.status.toLowerCase();
  return fragments.some((f) => s === f || s.includes(f));
}

// ---------------------------------------------------------------------------
// Payment tasks  (source === "payment")
// Buckets: Processing → Paid → Data Entry Complete
// ---------------------------------------------------------------------------

const paymentConfig: BoardTaskTypeConfig = {
  id: "payment",
  label: "Payments",
  icon: "💳",
  sortOrder: 1,
  detailKinds: ["payment"],
  buckets: [
    { id: "processing", label: "Processing" },
    { id: "paid", label: "Paid" },
    { id: "data-entry-complete", label: "Data Entry Complete", isCompletion: true },
  ],
  classifyBucket: (task) => {
    if (isClosed(task) || statusIncludes(task, "done", "closed")) return "data-entry-complete";
    if (statusIncludes(task, "complete") && (task as any).hmisComplete && (task as any).caseworthyComplete) return "data-entry-complete";
    if (statusIncludes(task, "paid", "spent", "posted")) return "paid";
    return "processing";
  },
  allowedTransitions: {
    processing: ["paid", "data-entry-complete"],
    paid: ["processing", "data-entry-complete"],
    "data-entry-complete": ["paid", "processing"],
  },
};

// ---------------------------------------------------------------------------
// Compliance tasks  (source === "paymentcompliance" | "grantcompliance")
// Buckets: Pending → In Review → Approved
// ---------------------------------------------------------------------------

const complianceConfig: BoardTaskTypeConfig = {
  id: "complianceTask",
  label: "Compliance",
  icon: "✔",
  sortOrder: 2,
  detailKinds: ["complianceTask", "grantCompliance"],
  buckets: [
    { id: "pending", label: "Pending" },
    { id: "in-review", label: "In Review" },
    { id: "approved", label: "Approved", isCompletion: true },
  ],
  classifyBucket: (task) => {
    if (isClosed(task) || statusIncludes(task, "approved", "done", "complete")) return "approved";
    const compStatus = String((task.raw as any)?.paymentComplianceStatus || "").toLowerCase();
    if (compStatus === "approved") return "approved";
    if (compStatus || statusIncludes(task, "review", "partial")) return "in-review";
    return "pending";
  },
  allowedTransitions: {
    pending: ["in-review", "approved"],
    "in-review": ["pending", "approved"],
    approved: ["in-review", "pending"],
  },
};

// ---------------------------------------------------------------------------
// Assessment tasks  (bucket/label === "assessment")
// Buckets: Scheduled → In Progress → Complete
// ---------------------------------------------------------------------------

const assessmentConfig: BoardTaskTypeConfig = {
  id: "assessment",
  label: "Assessments",
  icon: "📋",
  sortOrder: 3,
  detailKinds: ["assessment"],
  buckets: [
    { id: "scheduled", label: "Scheduled" },
    { id: "in-progress", label: "In Progress" },
    { id: "complete", label: "Complete", isCompletion: true },
  ],
  classifyBucket: (task) => {
    if (isClosed(task) || statusIncludes(task, "done", "complete", "closed")) return "complete";
    if (statusIncludes(task, "progress", "started", "active")) return "in-progress";
    return "scheduled";
  },
  allowedTransitions: {
    scheduled: ["in-progress", "complete"],
    "in-progress": ["scheduled", "complete"],
    complete: ["in-progress", "scheduled"],
  },
};

// ---------------------------------------------------------------------------
// General enrollment tasks  (source === "task")
// Buckets: Open → Done
// ---------------------------------------------------------------------------

const taskConfig: BoardTaskTypeConfig = {
  id: "task",
  label: "Tasks",
  icon: "✓",
  sortOrder: 4,
  detailKinds: ["task"],
  buckets: [
    { id: "open", label: "Open" },
    { id: "done", label: "Done", isCompletion: true },
  ],
  classifyBucket: (task) => {
    if (isClosed(task) || statusIncludes(task, "done", "complete", "verified", "closed")) return "done";
    return "open";
  },
  allowedTransitions: {
    open: ["done"],
    done: ["open"],
  },
};

// ---------------------------------------------------------------------------
// Other / standalone tasks  (source === "other" | "unknown")
// Buckets: Open → Done
// ---------------------------------------------------------------------------

const otherConfig: BoardTaskTypeConfig = {
  id: "other",
  label: "Other",
  icon: "•",
  sortOrder: 5,
  detailKinds: ["other", "unknown"],
  buckets: [
    { id: "open", label: "Open" },
    { id: "done", label: "Done", isCompletion: true },
  ],
  classifyBucket: (task) => {
    if (isClosed(task) || statusIncludes(task, "done", "complete", "closed")) return "done";
    return "open";
  },
  allowedTransitions: {
    open: ["done"],
    done: ["open"],
  },
};

// ---------------------------------------------------------------------------
// Customer / CM-assign tasks  (source === "adminenrollment")
// Buckets: Unassigned → Assigned
// ---------------------------------------------------------------------------

const customerConfig: BoardTaskTypeConfig = {
  id: "customer",
  label: "Assign CM",
  icon: "👤",
  sortOrder: 6,
  detailKinds: ["customer"],
  buckets: [
    { id: "unassigned", label: "Unassigned" },
    { id: "assigned", label: "Assigned", isCompletion: true },
  ],
  classifyBucket: (task) => {
    if (isClosed(task) || statusIncludes(task, "done", "complete", "closed")) return "assigned";
    const raw = task.raw as Record<string, unknown>;
    if (String(raw?.assignedToUid || raw?.caseManagerId || "").trim()) return "assigned";
    return "unassigned";
  },
  allowedTransitions: {
    unassigned: ["assigned"],
    assigned: ["unassigned"],
  },
};

// ---------------------------------------------------------------------------
// Grant compliance tasks  (source === "grantcompliance")
// Buckets: Pending → Complete
// ---------------------------------------------------------------------------

const grantComplianceConfig: BoardTaskTypeConfig = {
  id: "grantCompliance",
  label: "Grant Compliance",
  icon: "📑",
  sortOrder: 7,
  detailKinds: [], // claimed by complianceConfig above; this is a fallback entry
  buckets: [
    { id: "pending", label: "Pending" },
    { id: "complete", label: "Complete", isCompletion: true },
  ],
  classifyBucket: (task) => {
    if (isClosed(task) || statusIncludes(task, "done", "complete", "approved", "closed")) return "complete";
    return "pending";
  },
  allowedTransitions: {
    pending: ["complete"],
    complete: ["pending"],
  },
};

// ---------------------------------------------------------------------------
// User verification tasks  (source === "userverification")
// Buckets: Pending → Approved
// ---------------------------------------------------------------------------

const userVerificationConfig: BoardTaskTypeConfig = {
  id: "userVerification",
  label: "User Verification",
  icon: "🔑",
  sortOrder: 8,
  detailKinds: ["userVerification"],
  buckets: [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved", isCompletion: true },
  ],
  classifyBucket: (task) => {
    if (isClosed(task) || statusIncludes(task, "done", "approved", "complete")) return "approved";
    return "pending";
  },
  allowedTransitions: {
    pending: ["approved"],
    approved: ["pending"],
  },
};

// ---------------------------------------------------------------------------
// Ordered registry
// ---------------------------------------------------------------------------

export const BOARD_TASK_TYPE_CONFIGS: BoardTaskTypeConfig[] = [
  paymentConfig,
  complianceConfig,
  assessmentConfig,
  taskConfig,
  otherConfig,
  customerConfig,
  grantComplianceConfig,
  userVerificationConfig,
].sort((a, b) => a.sortOrder - b.sortOrder);

export const BOARD_TASK_TYPE_MAP = new Map<BoardTaskTypeId, BoardTaskTypeConfig>(
  BOARD_TASK_TYPE_CONFIGS.map((c) => [c.id, c])
);

/**
 * Returns the first task type config that claims the given InboxDetailKind.
 * Falls back to `otherConfig` for unmapped kinds.
 */
export function getTaskTypeForKind(kind: InboxDetailKind): BoardTaskTypeConfig {
  for (const config of BOARD_TASK_TYPE_CONFIGS) {
    if (config.detailKinds.includes(kind as never)) return config;
  }
  return otherConfig;
}

export function getBoardTaskTypeConfig(id: BoardTaskTypeId): BoardTaskTypeConfig {
  return BOARD_TASK_TYPE_MAP.get(id) ?? otherConfig;
}
