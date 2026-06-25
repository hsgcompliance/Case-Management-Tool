"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
module.exports = __toCommonJS(tasks_exports);

// src/core.ts
var import_zod = require("zod");
var import_zod2 = require("zod");
var Id = import_zod.z.string().trim().min(1);
var Ids = import_zod.z.array(Id).min(1);
var IdLike = import_zod.z.preprocess((v) => {
  if (typeof v === "string" || typeof v === "number") return String(v);
  return v;
}, Id);
var GrantIdsLike = import_zod.z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return v;
}, import_zod.z.array(Id).min(1));
var TimestampLike = import_zod.z.union([
  import_zod.z.string(),
  // ISO
  import_zod.z.number(),
  // millis
  import_zod.z.object({ seconds: import_zod.z.number(), nanoseconds: import_zod.z.number() })
  // Firestore JSON-ish
]);
var ISO10 = import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var BoolLike = import_zod.z.union([
  import_zod.z.boolean(),
  import_zod.z.literal("true"),
  import_zod.z.literal("false"),
  import_zod.z.literal(1),
  import_zod.z.literal(0),
  import_zod.z.literal("1"),
  import_zod.z.literal("0")
]);
var BoolFromLike = import_zod.z.preprocess((v) => {
  if (Array.isArray(v)) v = v[0];
  if (v === "" || v === null || v === void 0) return v;
  if (v === true || v === false) return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return v;
}, import_zod.z.boolean());
var JsonObj = import_zod.z.object({}).catchall(import_zod.z.unknown());
var JsonObjLike = import_zod.z.preprocess((v) => {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? parsed : v;
    } catch {
      return v;
    }
  }
  return v;
}, JsonObj);

// src/tasks.ts
var AssignedGroup = import_zod2.z.union([
  import_zod2.z.literal("admin"),
  import_zod2.z.literal("casemanager"),
  import_zod2.z.literal("compliance")
]);
var TaskScheduleItem = import_zod2.z.object({
  id: import_zod2.z.string(),
  // NOTE: schedule uses `type` (manual upsert maps title -> type)
  type: import_zod2.z.string().default("Task"),
  dueDate: import_zod2.z.string().optional().default(""),
  // YYYY-MM-DD when date-based; optional for notes
  dueMonth: import_zod2.z.string().nullish(),
  // YYYY-MM
  // --- deprecated lifecycle/status fields
  completed: import_zod2.z.boolean().nullish(),
  completedAt: import_zod2.z.string().nullish(),
  completedBy: import_zod2.z.string().nullish(),
  // verified hard-lock
  status: import_zod2.z.string().nullish(),
  // keep permissive for now ("verified" in prod)
  verified: import_zod2.z.boolean().nullish(),
  verifiedAt: import_zod2.z.string().nullish(),
  verifiedBy: import_zod2.z.string().nullish(),
  // reopen metadata
  reopenedAt: import_zod2.z.string().nullish(),
  reopenedBy: import_zod2.z.string().nullish(),
  reopenReason: import_zod2.z.string().nullish(),
  // --- ownership / routing
  assignedToUid: import_zod2.z.string().nullish(),
  assignedToGroup: AssignedGroup.nullish(),
  assignedAt: import_zod2.z.string().nullish(),
  assignedBy: import_zod2.z.string().nullish(),
  // --- multiparty / linked approvals (optional)
  multiParentId: import_zod2.z.string().nullish(),
  multiStepIndex: import_zod2.z.number().int().nullish(),
  multiStepCount: import_zod2.z.number().int().nullish(),
  multiMode: import_zod2.z.enum(["parallel", "sequential"]).nullish(),
  // --- meta
  notify: import_zod2.z.boolean().nullish(),
  notes: import_zod2.z.string().nullish(),
  // legacy-ish, but keep: older code reads it in carryStatus()
  byUid: import_zod2.z.string().nullish(),
  // UI bucket / grouping
  bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).nullish(),
  // managed tasks from definitions
  defId: import_zod2.z.string().nullish(),
  managed: import_zod2.z.boolean().nullish(),
  // audit-ish (functions already writes these on manual upsert / updateFields)
  createdAt: import_zod2.z.string().nullish(),
  createdBy: import_zod2.z.string().nullish(),
  updatedAt: import_zod2.z.string().nullish(),
  updatedBy: import_zod2.z.string().nullish()
}).passthrough();
var TaskStats = import_zod2.z.object({
  total: import_zod2.z.number().nullable().default(null),
  completed: import_zod2.z.number().nullable().default(null),
  overdue: import_zod2.z.number().nullable().default(null),
  nextDue: import_zod2.z.string().nullable().optional()
});
var TasksBulkStatusBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  changes: import_zod2.z.array(import_zod2.z.object({
    taskId: import_zod2.z.string(),
    action: import_zod2.z.enum(["complete", "reopen", "verify"]).optional().default("complete"),
    reason: import_zod2.z.string().optional(),
    notes: import_zod2.z.string().optional()
  })).min(1).max(500)
});
var TasksAssignBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  taskId: import_zod2.z.string(),
  assign: import_zod2.z.object({
    group: AssignedGroup.nullish().optional(),
    uid: import_zod2.z.string().nullish().optional()
  })
});
var TasksUpdateStatusBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  taskId: import_zod2.z.string(),
  action: import_zod2.z.enum(["complete", "reopen", "verify"]).optional().default("complete"),
  reason: import_zod2.z.string().optional(),
  notes: import_zod2.z.string().optional()
});
var TasksRescheduleBody = import_zod2.z.union([
  import_zod2.z.object({
    enrollmentId: import_zod2.z.string(),
    taskId: import_zod2.z.string(),
    newDueDate: import_zod2.z.string()
    // YYYY-MM-DD
  }),
  import_zod2.z.object({
    enrollmentId: import_zod2.z.string(),
    taskIds: import_zod2.z.array(import_zod2.z.string()).min(1).max(500),
    shiftDays: import_zod2.z.number().int().min(-3660).max(3660)
  })
]);
var TasksUpsertManualBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  task: import_zod2.z.object({
    id: import_zod2.z.string().optional(),
    title: import_zod2.z.string().min(1).default("Reminder"),
    notes: import_zod2.z.string().optional(),
    dueDate: import_zod2.z.string().optional().default(""),
    // optional for note/reminder mode
    bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).optional().default("task"),
    notify: import_zod2.z.boolean().optional().default(true)
  })
});
var TasksListQuery = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().optional(),
  enrollmentIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  dueMonth: import_zod2.z.string().optional(),
  // YYYY-MM
  status: import_zod2.z.enum(["open", "done", "verified"]).optional(),
  bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).optional(),
  assigneeUid: import_zod2.z.string().optional(),
  assigneeGroup: AssignedGroup.optional(),
  notify: import_zod2.z.boolean().optional(),
  limit: import_zod2.z.number().int().min(1).max(1e3).optional().default(200)
});
var TasksListItem = import_zod2.z.object({
  id: import_zod2.z.string(),
  // `${enrollmentId}__${taskId}`
  taskId: import_zod2.z.string(),
  enrollmentId: import_zod2.z.string(),
  customerId: import_zod2.z.string().nullable(),
  grantId: import_zod2.z.string().nullable(),
  title: import_zod2.z.string(),
  note: import_zod2.z.string(),
  bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).nullable(),
  defId: import_zod2.z.string().nullable(),
  managed: import_zod2.z.boolean(),
  multiParentId: import_zod2.z.string().nullable(),
  multiStepIndex: import_zod2.z.number().nullable(),
  multiStepCount: import_zod2.z.number().nullable(),
  multiMode: import_zod2.z.enum(["parallel", "sequential"]).nullable(),
  dueDate: import_zod2.z.string().optional().default(""),
  dueMonth: import_zod2.z.string().nullable(),
  /** @deprecated Use reminder visibility/notify fields instead of workflow status. */
  status: import_zod2.z.enum(["open", "done", "verified"]).optional().default("open"),
  notify: import_zod2.z.boolean().optional().default(true),
  assignedToUid: import_zod2.z.string().nullable(),
  assignedToGroup: AssignedGroup.nullable(),
  assignedAt: import_zod2.z.string().nullable().optional()
});
var TasksAdminRegenerateForGrantBody = import_zod2.z.object({
  grantId: import_zod2.z.string(),
  activeOnly: import_zod2.z.boolean().optional().default(true),
  keepManual: import_zod2.z.boolean().optional().default(true),
  mode: import_zod2.z.enum(["replaceManaged", "mergeManaged"]).optional().default("replaceManaged"),
  preserveCompletedManaged: import_zod2.z.boolean().optional().default(true),
  pinCompletedManaged: import_zod2.z.boolean().optional().default(true),
  pageSize: import_zod2.z.number().int().min(1).max(1e3).optional().default(200),
  dryRun: import_zod2.z.boolean().optional().default(false)
});
var TasksAdminRegenerateForGrantResultItem = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  ok: import_zod2.z.boolean(),
  total: import_zod2.z.number().optional(),
  closed: import_zod2.z.boolean().optional(),
  error: import_zod2.z.string().optional()
}).passthrough();
var OtherGroup = AssignedGroup;
var TasksOtherCreateBody = import_zod2.z.object({
  title: import_zod2.z.string().min(1).max(200),
  notes: import_zod2.z.string().max(2e3).optional(),
  dueDate: import_zod2.z.string().optional(),
  dueMonth: import_zod2.z.string().optional(),
  notify: import_zod2.z.boolean().optional().default(true),
  assign: import_zod2.z.object({
    group: OtherGroup.nullish(),
    uids: import_zod2.z.array(import_zod2.z.string()).max(20).nullish()
  }).optional()
});
var TasksOtherUpdateBody = import_zod2.z.object({
  id: import_zod2.z.string(),
  patch: import_zod2.z.object({
    title: import_zod2.z.string().min(1).max(200).optional(),
    notes: import_zod2.z.string().max(2e3).optional(),
    dueDate: import_zod2.z.union([ISO10, import_zod2.z.literal(""), import_zod2.z.null()]).optional(),
    notify: import_zod2.z.boolean().optional()
  })
});
var TasksOtherAssignBody = import_zod2.z.object({
  id: import_zod2.z.string(),
  assign: import_zod2.z.object({
    group: OtherGroup.nullish(),
    uids: import_zod2.z.array(import_zod2.z.string()).max(20).nullish()
  })
});
var TasksOtherStatusBody = import_zod2.z.object({
  id: import_zod2.z.string(),
  /** @deprecated Other-task completion lifecycle is deprecated; keep for back-compat only. */
  action: import_zod2.z.enum(["complete", "reopen"]).optional().default("complete")
});
var TasksOtherListMyQuery = import_zod2.z.object({
  month: import_zod2.z.string().optional(),
  // YYYY-MM
  includeGroup: import_zod2.z.union([import_zod2.z.literal("true"), import_zod2.z.literal("false")]).optional()
});
var TasksUpdateFieldsBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  taskId: import_zod2.z.string(),
  patch: import_zod2.z.object({
    notify: import_zod2.z.boolean().optional(),
    notes: import_zod2.z.string().optional(),
    type: import_zod2.z.string().optional(),
    bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).optional()
  })
});
var TasksDeleteBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  taskId: import_zod2.z.string().optional(),
  all: import_zod2.z.union([import_zod2.z.boolean(), import_zod2.z.string(), import_zod2.z.number()]).optional()
});
var TaskDefUnknown = import_zod2.z.unknown();
var TasksGenerateScheduleWriteBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().optional(),
  enrollmentIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  startDate: import_zod2.z.string().optional(),
  keepManual: import_zod2.z.boolean().optional().default(true),
  mode: import_zod2.z.enum(["replaceManaged", "mergeManaged"]).optional().default("replaceManaged"),
  preserveCompletedManaged: import_zod2.z.boolean().optional().default(true),
  pinCompletedManaged: import_zod2.z.boolean().optional().default(true),
  taskDef: import_zod2.z.union([TaskDefUnknown, import_zod2.z.array(TaskDefUnknown)]).optional(),
  taskDefs: import_zod2.z.array(TaskDefUnknown).optional(),
  replaceTaskDefPrefixes: import_zod2.z.array(import_zod2.z.string()).optional().default([])
});
var TasksGenerateScheduleWriteResult = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  ok: import_zod2.z.boolean(),
  total: import_zod2.z.number().optional(),
  error: import_zod2.z.string().optional(),
  note: import_zod2.z.string().optional(),
  closed: import_zod2.z.boolean().optional()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AssignedGroup,
  TaskScheduleItem,
  TaskStats,
  TasksAdminRegenerateForGrantBody,
  TasksAdminRegenerateForGrantResultItem,
  TasksAssignBody,
  TasksBulkStatusBody,
  TasksDeleteBody,
  TasksGenerateScheduleWriteBody,
  TasksGenerateScheduleWriteResult,
  TasksListItem,
  TasksListQuery,
  TasksOtherAssignBody,
  TasksOtherCreateBody,
  TasksOtherListMyQuery,
  TasksOtherStatusBody,
  TasksOtherUpdateBody,
  TasksRescheduleBody,
  TasksUpdateFieldsBody,
  TasksUpdateStatusBody,
  TasksUpsertManualBody
});
