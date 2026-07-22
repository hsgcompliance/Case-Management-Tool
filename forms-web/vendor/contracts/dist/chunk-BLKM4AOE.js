import {
  ISO10,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/tasks.ts
var tasks_exports = {};
__export(tasks_exports, {
  AssignedGroup: () => AssignedGroup,
  TaskScheduleItem: () => TaskScheduleItem,
  TaskStats: () => TaskStats,
  TasksAdminRegenerateForGrantBody: () => TasksAdminRegenerateForGrantBody,
  TasksAdminRegenerateForGrantResultItem: () => TasksAdminRegenerateForGrantResultItem,
  TasksAssignBody: () => TasksAssignBody,
  TasksBulkStatusBody: () => TasksBulkStatusBody,
  TasksDeleteBody: () => TasksDeleteBody,
  TasksGenerateScheduleWriteBody: () => TasksGenerateScheduleWriteBody,
  TasksGenerateScheduleWriteResult: () => TasksGenerateScheduleWriteResult,
  TasksListItem: () => TasksListItem,
  TasksListQuery: () => TasksListQuery,
  TasksOtherAssignBody: () => TasksOtherAssignBody,
  TasksOtherCreateBody: () => TasksOtherCreateBody,
  TasksOtherListMyQuery: () => TasksOtherListMyQuery,
  TasksOtherStatusBody: () => TasksOtherStatusBody,
  TasksOtherUpdateBody: () => TasksOtherUpdateBody,
  TasksRescheduleBody: () => TasksRescheduleBody,
  TasksUpdateFieldsBody: () => TasksUpdateFieldsBody,
  TasksUpdateStatusBody: () => TasksUpdateStatusBody,
  TasksUpsertManualBody: () => TasksUpsertManualBody
});
var AssignedGroup = z.union([
  z.literal("admin"),
  z.literal("casemanager"),
  z.literal("compliance")
]);
var TaskScheduleItem = z.object({
  id: z.string(),
  // NOTE: schedule uses `type` (manual upsert maps title -> type)
  type: z.string().default("Task"),
  dueDate: z.string().optional().default(""),
  // YYYY-MM-DD when date-based; optional for notes
  dueMonth: z.string().nullish(),
  // YYYY-MM
  // --- deprecated lifecycle/status fields
  completed: z.boolean().nullish(),
  completedAt: z.string().nullish(),
  completedBy: z.string().nullish(),
  // verified hard-lock
  status: z.string().nullish(),
  // keep permissive for now ("verified" in prod)
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
  updatedBy: z.string().nullish()
}).passthrough();
var TaskStats = z.object({
  total: z.number().nullable().default(null),
  completed: z.number().nullable().default(null),
  overdue: z.number().nullable().default(null),
  nextDue: z.string().nullable().optional()
});
var TasksBulkStatusBody = z.object({
  enrollmentId: z.string(),
  changes: z.array(z.object({
    taskId: z.string(),
    action: z.enum(["complete", "reopen", "verify"]).optional().default("complete"),
    reason: z.string().optional(),
    notes: z.string().optional()
  })).min(1).max(500)
});
var TasksAssignBody = z.object({
  enrollmentId: z.string(),
  taskId: z.string(),
  assign: z.object({
    group: AssignedGroup.nullish().optional(),
    uid: z.string().nullish().optional()
  })
});
var TasksUpdateStatusBody = z.object({
  enrollmentId: z.string(),
  taskId: z.string(),
  action: z.enum(["complete", "reopen", "verify"]).optional().default("complete"),
  reason: z.string().optional(),
  notes: z.string().optional()
});
var TasksRescheduleBody = z.union([
  z.object({
    enrollmentId: z.string(),
    taskId: z.string(),
    newDueDate: z.string()
    // YYYY-MM-DD
  }),
  z.object({
    enrollmentId: z.string(),
    taskIds: z.array(z.string()).min(1).max(500),
    shiftDays: z.number().int().min(-3660).max(3660)
  })
]);
var TasksUpsertManualBody = z.object({
  enrollmentId: z.string(),
  task: z.object({
    id: z.string().optional(),
    title: z.string().min(1).default("Reminder"),
    notes: z.string().optional(),
    dueDate: z.string().optional().default(""),
    // optional for note/reminder mode
    bucket: z.enum(["task", "assessment", "compliance", "other"]).optional().default("task"),
    notify: z.boolean().optional().default(true)
  })
});
var TasksListQuery = z.object({
  enrollmentId: z.string().optional(),
  enrollmentIds: z.array(z.string()).optional(),
  dueMonth: z.string().optional(),
  // YYYY-MM
  status: z.enum(["open", "done", "verified"]).optional(),
  bucket: z.enum(["task", "assessment", "compliance", "other"]).optional(),
  assigneeUid: z.string().optional(),
  assigneeGroup: AssignedGroup.optional(),
  notify: z.boolean().optional(),
  limit: z.number().int().min(1).max(1e3).optional().default(200)
});
var TasksListItem = z.object({
  id: z.string(),
  // `${enrollmentId}__${taskId}`
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
  assignedAt: z.string().nullable().optional()
});
var TasksAdminRegenerateForGrantBody = z.object({
  grantId: z.string(),
  activeOnly: z.boolean().optional().default(true),
  keepManual: z.boolean().optional().default(true),
  mode: z.enum(["replaceManaged", "mergeManaged"]).optional().default("replaceManaged"),
  preserveCompletedManaged: z.boolean().optional().default(true),
  pinCompletedManaged: z.boolean().optional().default(true),
  pageSize: z.number().int().min(1).max(1e3).optional().default(200),
  dryRun: z.boolean().optional().default(false)
});
var TasksAdminRegenerateForGrantResultItem = z.object({
  enrollmentId: z.string(),
  ok: z.boolean(),
  total: z.number().optional(),
  closed: z.boolean().optional(),
  error: z.string().optional()
}).passthrough();
var OtherGroup = AssignedGroup;
var TasksOtherCreateBody = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2e3).optional(),
  dueDate: z.string().optional(),
  dueMonth: z.string().optional(),
  notify: z.boolean().optional().default(true),
  customerId: z.string().nullish(),
  assign: z.object({
    group: OtherGroup.nullish(),
    uids: z.array(z.string()).max(20).nullish()
  }).optional()
});
var TasksOtherUpdateBody = z.object({
  id: z.string(),
  patch: z.object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(2e3).optional(),
    dueDate: z.union([ISO10, z.literal(""), z.null()]).optional(),
    notify: z.boolean().optional()
  })
});
var TasksOtherAssignBody = z.object({
  id: z.string(),
  assign: z.object({
    group: OtherGroup.nullish(),
    uids: z.array(z.string()).max(20).nullish()
  })
});
var TasksOtherStatusBody = z.object({
  id: z.string(),
  /** @deprecated Other-task completion lifecycle is deprecated; keep for back-compat only. */
  action: z.enum(["complete", "reopen"]).optional().default("complete")
});
var TasksOtherListMyQuery = z.object({
  month: z.string().optional(),
  // YYYY-MM
  includeGroup: z.union([z.literal("true"), z.literal("false")]).optional()
});
var TasksUpdateFieldsBody = z.object({
  enrollmentId: z.string(),
  taskId: z.string(),
  patch: z.object({
    notify: z.boolean().optional(),
    notes: z.string().optional(),
    type: z.string().optional(),
    bucket: z.enum(["task", "assessment", "compliance", "other"]).optional()
  })
});
var TasksDeleteBody = z.object({
  enrollmentId: z.string(),
  taskId: z.string().optional(),
  all: z.union([z.boolean(), z.string(), z.number()]).optional()
});
var TaskDefUnknown = z.unknown();
var TasksGenerateScheduleWriteBody = z.object({
  enrollmentId: z.string().optional(),
  enrollmentIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  keepManual: z.boolean().optional().default(true),
  mode: z.enum(["replaceManaged", "mergeManaged"]).optional().default("replaceManaged"),
  preserveCompletedManaged: z.boolean().optional().default(true),
  pinCompletedManaged: z.boolean().optional().default(true),
  taskDef: z.union([TaskDefUnknown, z.array(TaskDefUnknown)]).optional(),
  taskDefs: z.array(TaskDefUnknown).optional(),
  replaceTaskDefPrefixes: z.array(z.string()).optional().default([])
});
var TasksGenerateScheduleWriteResult = z.object({
  enrollmentId: z.string(),
  ok: z.boolean(),
  total: z.number().optional(),
  error: z.string().optional(),
  note: z.string().optional(),
  closed: z.boolean().optional()
});

export {
  AssignedGroup,
  TaskScheduleItem,
  TaskStats,
  TasksBulkStatusBody,
  TasksAssignBody,
  TasksUpdateStatusBody,
  TasksRescheduleBody,
  TasksUpsertManualBody,
  TasksListQuery,
  TasksListItem,
  TasksAdminRegenerateForGrantBody,
  TasksAdminRegenerateForGrantResultItem,
  TasksOtherCreateBody,
  TasksOtherUpdateBody,
  TasksOtherAssignBody,
  TasksOtherStatusBody,
  TasksOtherListMyQuery,
  TasksUpdateFieldsBody,
  TasksDeleteBody,
  TasksGenerateScheduleWriteBody,
  TasksGenerateScheduleWriteResult,
  tasks_exports
};
