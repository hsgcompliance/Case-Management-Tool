//contracts/src/tasks.ts
import { z, TsLike, ISO10 } from "./core";

/** Which desk owns the task right now. */
export const AssignedGroup = z.union([
  z.literal("admin"),
  z.literal("casemanager"),
  z.literal("compliance"),
]);

/**
 * A single reminder/note item.
 *
 * @deprecated Lifecycle fields (`completed`, `completedAt`, `status`, verification, reopen
 * metadata) are kept for old records and screens. New product behavior should treat these as
 * lightweight reminders/notes for customer pages and digest emails, not completion workflow.
 */
export const TaskScheduleItem = z
  .object({
    id: z.string(),

    // NOTE: schedule uses `type` (manual upsert maps title -> type)
    type: z.string().default("Task"),

    dueDate: z.string().optional().default(""), // YYYY-MM-DD when date-based; optional for notes
    dueMonth: z.string().nullish(), // YYYY-MM

    // --- deprecated lifecycle/status fields
    completed: z.boolean().nullish(),
    completedAt: z.string().nullish(),
    completedBy: z.string().nullish(),

    // verified hard-lock
    status: z.string().nullish(), // keep permissive for now ("verified" in prod)
    verified: z.boolean().nullish(),
    verifiedAt: z.string().nullish(),
    verifiedBy: z.string().nullish(),

    // reopen metadata
    reopenedAt: z.string().nullish(),
    reopenedBy: z.string().nullish(),
    reopenReason: z.string().nullish(),

    // --- ownership / routing
    assignedToUid: z.string().nullish(),
    assignedToGroup: AssignedGroup.nullish(),
    assignedAt: z.string().nullish(),
    assignedBy: z.string().nullish(),

    // --- multiparty / linked approvals (optional)
    multiParentId: z.string().nullish(),
    multiStepIndex: z.number().int().nullish(),
    multiStepCount: z.number().int().nullish(),
    multiMode: z.enum(["parallel", "sequential"]).nullish(),

    // --- meta
    notify: z.boolean().nullish(),
    notes: z.string().nullish(),

    // legacy-ish, but keep: older code reads it in carryStatus()
    byUid: z.string().nullish(),

    // UI bucket / grouping
    bucket: z.enum(["task", "assessment", "compliance", "other"]).nullish(),

    // managed tasks from definitions
    defId: z.string().nullish(),
    managed: z.boolean().nullish(),

    // audit-ish (functions already writes these on manual upsert / updateFields)
    createdAt: z.string().nullish(),
    createdBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
  })
  .passthrough();

/** Aggregate stats for quick list UI. */
export const TaskStats = z.object({
  total: z.number().nullable().default(null),
  completed: z.number().nullable().default(null),
  overdue: z.number().nullable().default(null),
  nextDue: z.string().nullable().optional(),
});

export type TTaskScheduleItem = z.infer<typeof TaskScheduleItem>;
export type TTaskStats = z.infer<typeof TaskStats>;
export type TAssignedGroup = z.infer<typeof AssignedGroup>;

/** @deprecated Task completion lifecycle is deprecated; keep for back-compat only. */
export const TasksBulkStatusBody = z.object({
  enrollmentId: z.string(),
  changes: z.array(z.object({
    taskId: z.string(),
    action: z.enum(["complete", "reopen", "verify"]).optional().default("complete"),
    reason: z.string().optional(),
    notes: z.string().optional(),
  }))
  .min(1)
  .max(500),
});

export type TTasksBulkStatusBody = z.infer<typeof TasksBulkStatusBody>;

// --- Task endpoint request bodies (canonical) ---

export const TasksAssignBody = z.object({
  enrollmentId: z.string(),
  taskId: z.string(),
  assign: z.object({
    group: AssignedGroup.nullish().optional(),
    uid: z.string().nullish().optional(),
  }),
});
export type TTasksAssignBody = z.infer<typeof TasksAssignBody>;

/** @deprecated Task completion lifecycle is deprecated; keep for back-compat only. */
export const TasksUpdateStatusBody = z.object({
  enrollmentId: z.string(),
  taskId: z.string(),
  action: z.enum(["complete", "reopen", "verify"]).optional().default("complete"),
  reason: z.string().optional(),
  notes: z.string().optional(),
});
export type TTasksUpdateStatusBody = z.infer<typeof TasksUpdateStatusBody>;

export const TasksRescheduleBody = z.union([
  z.object({
    enrollmentId: z.string(),
    taskId: z.string(),
    newDueDate: z.string(), // YYYY-MM-DD
  }),
  z.object({
    enrollmentId: z.string(),
    taskIds: z.array(z.string()).min(1).max(500),
    shiftDays: z.number().int().min(-3660).max(3660),
  }),
]);
export type TTasksRescheduleBody = z.infer<typeof TasksRescheduleBody>;

export const TasksUpsertManualBody = z.object({
  enrollmentId: z.string(),
  task: z.object({
    id: z.string().optional(),
    title: z.string().min(1).default("Reminder"),
    notes: z.string().optional(),
    dueDate: z.string().optional().default(""), // optional for note/reminder mode
    bucket: z.enum(["task", "assessment", "compliance", "other"]).optional().default("task"),
    notify: z.boolean().optional().default(true),
  }),
});
export type TTasksUpsertManualBody = z.infer<typeof TasksUpsertManualBody>;

export const TasksListQuery = z.object({
  enrollmentId: z.string().optional(),
  enrollmentIds: z.array(z.string()).optional(),
  dueMonth: z.string().optional(), // YYYY-MM
  status: z.enum(["open", "done", "verified"]).optional(),
  bucket: z.enum(["task", "assessment", "compliance", "other"]).optional(),
  assigneeUid: z.string().optional(),
  assigneeGroup: AssignedGroup.optional(),
  notify: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(200),
});
export type TTasksListQuery = z.infer<typeof TasksListQuery>;

export const TasksListItem = z.object({
  id: z.string(), // `${enrollmentId}__${taskId}`
  taskId: z.string(),
  enrollmentId: z.string(),
  customerId: z.string().nullable(),
  grantId: z.string().nullable(),

  title: z.string(),
  note: z.string(),
  bucket: z.enum(["task", "assessment", "compliance", "other"]).nullable(),
  defId: z.string().nullable(),
  managed: z.boolean(),

  multiParentId: z.string().nullable(),
  multiStepIndex: z.number().nullable(),
  multiStepCount: z.number().nullable(),
  multiMode: z.enum(["parallel", "sequential"]).nullable(),

  dueDate: z.string().optional().default(""),
  dueMonth: z.string().nullable(),
  /** @deprecated Use reminder visibility/notify fields instead of workflow status. */
  status: z.enum(["open", "done", "verified"]).optional().default("open"),
  notify: z.boolean().optional().default(true),

  assignedToUid: z.string().nullable(),
  assignedToGroup: AssignedGroup.nullable(),
  assignedAt: z.string().nullable().optional(),
});
export type TTasksListItem = z.infer<typeof TasksListItem>;

export const TasksAdminRegenerateForGrantBody = z.object({
  grantId: z.string(),
  activeOnly: z.boolean().optional().default(true),
  keepManual: z.boolean().optional().default(true),
  mode: z.enum(["replaceManaged", "mergeManaged"]).optional().default("replaceManaged"),
  preserveCompletedManaged: z.boolean().optional().default(true),
  pinCompletedManaged: z.boolean().optional().default(true),
  pageSize: z.number().int().min(1).max(1000).optional().default(200),
  dryRun: z.boolean().optional().default(false),
});
export type TTasksAdminRegenerateForGrantBody = z.infer<typeof TasksAdminRegenerateForGrantBody>;

export const TasksAdminRegenerateForGrantResultItem = z
  .object({
    enrollmentId: z.string(),
    ok: z.boolean(),
    total: z.number().optional(),
    closed: z.boolean().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export type TTasksAdminRegenerateForGrantResultItem = z.infer<
  typeof TasksAdminRegenerateForGrantResultItem
>;

// --- OtherTasks endpoints ---
const OtherGroup = AssignedGroup;

export const TasksOtherCreateBody = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  dueDate: z.string().optional(),
  dueMonth: z.string().optional(),
  notify: z.boolean().optional().default(true),
  assign: z.object({
    group: OtherGroup.nullish(),
    uids: z.array(z.string()).max(20).nullish(),
  }).optional(),
});
export type TTasksOtherCreateBody = z.infer<typeof TasksOtherCreateBody>;

export const TasksOtherUpdateBody = z.object({
  id: z.string(),
  patch: z.object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(2000).optional(),
    dueDate: z.union([ISO10, z.literal(""), z.null()]).optional(),
    notify: z.boolean().optional(),
  }),
});
export type TTasksOtherUpdateBody = z.infer<typeof TasksOtherUpdateBody>;

export const TasksOtherAssignBody = z.object({
  id: z.string(),
  assign: z.object({
    group: OtherGroup.nullish(),
    uids: z.array(z.string()).max(20).nullish(),
  }),
});
export type TTasksOtherAssignBody = z.infer<typeof TasksOtherAssignBody>;

export const TasksOtherStatusBody = z.object({
  id: z.string(),
  /** @deprecated Other-task completion lifecycle is deprecated; keep for back-compat only. */
  action: z.enum(["complete", "reopen"]).optional().default("complete"),
});
export type TTasksOtherStatusBody = z.infer<typeof TasksOtherStatusBody>;

export const TasksOtherListMyQuery = z.object({
  month: z.string().optional(), // YYYY-MM
  includeGroup: z.union([z.literal("true"), z.literal("false")]).optional(),
});
export type TTasksOtherListMyQuery = z.infer<typeof TasksOtherListMyQuery>;

// --- Endpoint payloads (canonical) ---

export const TasksUpdateFieldsBody = z.object({
  enrollmentId: z.string(),
  taskId: z.string(),
  patch: z.object({
    notify: z.boolean().optional(),
    notes: z.string().optional(),
    type: z.string().optional(),
    bucket: z.enum(["task", "assessment", "compliance", "other"]).optional(),
  }),
});
export type TTasksUpdateFieldsBody = z.infer<typeof TasksUpdateFieldsBody>;

export const TasksDeleteBody = z.object({
  enrollmentId: z.string(),
  taskId: z.string().optional(),
  all: z.union([z.boolean(), z.string(), z.number()]).optional(),
});
export type TTasksDeleteBody = z.infer<typeof TasksDeleteBody>;

// NOTE: task defs are currently untyped in functions (z.any). Keep them unknown in contracts for parity.
const TaskDefUnknown = z.unknown();

export const TasksGenerateScheduleWriteBody = z.object({
  enrollmentId: z.string().optional(),
  enrollmentIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  keepManual: z.boolean().optional().default(true),
  mode: z.enum(["replaceManaged", "mergeManaged"]).optional().default("replaceManaged"),
  preserveCompletedManaged: z.boolean().optional().default(true),
  pinCompletedManaged: z.boolean().optional().default(true),
  taskDef: z.union([TaskDefUnknown, z.array(TaskDefUnknown)]).optional(),
  taskDefs: z.array(TaskDefUnknown).optional(),
  replaceTaskDefPrefixes: z.array(z.string()).optional().default([]),
});
export type TTasksGenerateScheduleWriteBody = z.infer<typeof TasksGenerateScheduleWriteBody>;

export const TasksGenerateScheduleWriteResult = z.object({
  enrollmentId: z.string(),
  ok: z.boolean(),
  total: z.number().optional(),
  error: z.string().optional(),
  note: z.string().optional(),
  closed: z.boolean().optional(),
});
export type TTasksGenerateScheduleWriteResult = z.infer<typeof TasksGenerateScheduleWriteResult>;
