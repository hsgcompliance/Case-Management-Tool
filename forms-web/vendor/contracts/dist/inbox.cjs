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

// src/inbox.ts
var inbox_exports = {};
__export(inbox_exports, {
  InboxAssignedGroupEnum: () => InboxAssignedGroupEnum,
  InboxDigestPreviewQuerySchema: () => InboxDigestPreviewQuerySchema,
  InboxDigestSubRecordSchema: () => InboxDigestSubRecordSchema,
  InboxDigestTypeSchema: () => InboxDigestTypeSchema,
  InboxItemEntitySchema: () => InboxItemEntitySchema,
  InboxItemSchema: () => InboxItemSchema,
  InboxListMyQuerySchema: () => InboxListMyQuerySchema,
  InboxMetricsMyQuerySchema: () => InboxMetricsMyQuerySchema,
  InboxMetricsScopeSchema: () => InboxMetricsScopeSchema,
  InboxScheduleDigestBodySchema: () => InboxScheduleDigestBodySchema,
  InboxSendDigestNowBodySchema: () => InboxSendDigestNowBodySchema,
  InboxSendInviteBodySchema: () => InboxSendInviteBodySchema,
  InboxSendMonthlySummaryBodySchema: () => InboxSendMonthlySummaryBodySchema,
  InboxSourceEnum: () => InboxSourceEnum,
  InboxStatusEnum: () => InboxStatusEnum,
  InboxTasksDueListQuerySchema: () => InboxTasksDueListQuerySchema,
  InboxWorkItemKindEnum: () => InboxWorkItemKindEnum,
  InboxWorkflowRefSchema: () => InboxWorkflowRefSchema,
  InboxWorkloadListQuerySchema: () => InboxWorkloadListQuerySchema
});
module.exports = __toCommonJS(inbox_exports);

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
var Boolish = BoolLike;
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

// src/inbox.ts
var InboxSourceEnum = import_zod2.z.enum([
  "task",
  "payment",
  "paymentCompliance",
  "userVerification",
  "adminEnrollment",
  "other",
  "jotform",
  "formsIntake",
  "otherTask"
  // back-compat alias written by old trigger versions
]);
var InboxStatusEnum = import_zod2.z.enum(["open", "done"]);
var InboxAssignedGroupEnum = import_zod2.z.enum(["admin", "casemanager", "compliance"]);
var InboxWorkItemKindEnum = import_zod2.z.enum([
  "task",
  "assessment",
  "compliance",
  "payment",
  "intake",
  "referral",
  "workflow"
]);
var InboxWorkflowRefSchema = import_zod2.z.object({
  type: import_zod2.z.enum(["intake", "referral", "form"]),
  instanceId: import_zod2.z.string().min(1),
  stage: import_zod2.z.string().min(1),
  customerId: import_zod2.z.string().nullish(),
  enrollmentId: import_zod2.z.string().nullish(),
  formId: import_zod2.z.string().nullish()
});
var YYYY_MM = import_zod2.z.string().regex(/^\d{4}-\d{2}$/);
var UrlOrHash = import_zod2.z.union([import_zod2.z.url(), import_zod2.z.literal("#")]);
var InboxDigestTypeSchema = import_zod2.z.enum(["caseload", "budget", "enrollments", "grantPrograms", "caseManagers", "rentalAssistance"]);
var InboxDigestSubRecordSchema = import_zod2.z.object({
  uid: import_zod2.z.string().min(1),
  email: import_zod2.z.email(),
  displayName: import_zod2.z.string().optional(),
  roles: import_zod2.z.array(import_zod2.z.string()),
  topRole: import_zod2.z.string(),
  subs: import_zod2.z.partialRecord(InboxDigestTypeSchema, import_zod2.z.boolean()),
  effective: import_zod2.z.record(InboxDigestTypeSchema, import_zod2.z.boolean()),
  grantProgramIds: import_zod2.z.array(import_zod2.z.string()).optional()
});
var IsoString = import_zod2.z.string().min(1);
var InboxItemSchema = import_zod2.z.object({
  utid: import_zod2.z.string().min(1),
  source: InboxSourceEnum,
  status: InboxStatusEnum,
  enrollmentId: import_zod2.z.string().nullable(),
  clientId: import_zod2.z.string().nullable(),
  grantId: import_zod2.z.string().nullable(),
  sourcePath: import_zod2.z.string().min(1),
  dueDate: ISO10.nullish(),
  // YYYY-MM-DD
  dueMonth: YYYY_MM.nullish(),
  // YYYY-MM
  createdAtISO: IsoString.nullish(),
  updatedAtISO: IsoString.nullish(),
  assignedToUid: import_zod2.z.string().nullable(),
  assignedToGroup: InboxAssignedGroupEnum.nullish(),
  cmUid: import_zod2.z.string().nullable(),
  secondaryCmUid: import_zod2.z.string().nullable().default(null),
  // org scoping / projection
  orgId: import_zod2.z.string().nullish(),
  teamIds: import_zod2.z.array(import_zod2.z.string().min(1)).nullish(),
  notify: import_zod2.z.boolean().nullish(),
  /** Lightweight notification meaning; this does not imply staff performance tracking. */
  workItemKind: InboxWorkItemKindEnum.nullish(),
  workflowRef: InboxWorkflowRefSchema.nullish(),
  title: import_zod2.z.string().default(""),
  subtitle: import_zod2.z.string().nullish(),
  labels: import_zod2.z.array(import_zod2.z.string().min(1)).nullish(),
  /** Backend-owned deep link for workflow-backed reminders. */
  actionUrl: import_zod2.z.url().nullish(),
  actionLabel: import_zod2.z.string().max(120).nullish(),
  completedAtISO: IsoString.nullish()
}).passthrough();
var InboxItemEntitySchema = InboxItemSchema.extend({
  id: import_zod2.z.string().min(1)
});
var InboxListMyQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional(),
  includeOverdue: Boolish.optional(),
  includeGroup: Boolish.optional()
}).partial();
var InboxTasksDueListQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional()
}).partial();
var InboxWorkloadListQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional(),
  assigneeUid: import_zod2.z.string().optional(),
  includeUnassigned: Boolish.optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional()
}).partial();
var InboxSendInviteBodySchema = import_zod2.z.object({
  to: import_zod2.z.email(),
  name: import_zod2.z.string().trim().optional().default(""),
  resetLink: UrlOrHash.optional().default("#"),
  subject: import_zod2.z.string().trim().optional(),
  html: import_zod2.z.string().trim().optional()
});
var InboxSendMonthlySummaryBodySchema = import_zod2.z.object({
  to: import_zod2.z.email(),
  clientId: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).transform(String),
  tasksDue: import_zod2.z.array(
    import_zod2.z.object({
      id: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).transform(String).optional(),
      type: import_zod2.z.string().optional(),
      dueDate: import_zod2.z.string().optional(),
      completed: import_zod2.z.boolean().optional(),
      completedAt: import_zod2.z.string().optional()
    })
  ).optional().default([]),
  monthsRemaining: import_zod2.z.number().int().nonnegative().nullable().optional(),
  dashboardLink: UrlOrHash.optional().default("#"),
  subject: import_zod2.z.string().trim().optional(),
  html: import_zod2.z.string().trim().optional()
});
var InboxSendDigestNowBodySchema = import_zod2.z.object({
  digestType: InboxDigestTypeSchema.optional().default("caseload"),
  months: import_zod2.z.array(YYYY_MM).min(1),
  cmUid: import_zod2.z.string().optional(),
  combine: import_zod2.z.boolean().optional().default(false),
  subject: import_zod2.z.string().optional(),
  subjectTemplate: import_zod2.z.string().optional(),
  message: import_zod2.z.string().optional()
});
var InboxScheduleDigestBodySchema = import_zod2.z.object({
  digestType: InboxDigestTypeSchema.optional().default("caseload"),
  months: import_zod2.z.array(YYYY_MM).min(1),
  cmUid: import_zod2.z.string().min(1),
  combine: import_zod2.z.boolean().optional().default(true),
  subject: import_zod2.z.string().optional(),
  subjectTemplate: import_zod2.z.string().optional(),
  message: import_zod2.z.string().optional(),
  sendAt: import_zod2.z.string().datetime()
});
var InboxDigestPreviewQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional(),
  cmUid: import_zod2.z.string().optional()
});
var InboxMetricsScopeSchema = import_zod2.z.object({
  assignedCount: import_zod2.z.number().int().nonnegative(),
  openCount: import_zod2.z.number().int().nonnegative(),
  completedCount: import_zod2.z.number().int().nonnegative(),
  completionPct: import_zod2.z.number().nonnegative(),
  // 0-100
  overdueCount: import_zod2.z.number().int().nonnegative(),
  sharedCount: import_zod2.z.number().int().nonnegative(),
  assignedToMeCount: import_zod2.z.number().int().nonnegative()
});
var InboxMetricsMyQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional()
}).partial();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InboxAssignedGroupEnum,
  InboxDigestPreviewQuerySchema,
  InboxDigestSubRecordSchema,
  InboxDigestTypeSchema,
  InboxItemEntitySchema,
  InboxItemSchema,
  InboxListMyQuerySchema,
  InboxMetricsMyQuerySchema,
  InboxMetricsScopeSchema,
  InboxScheduleDigestBodySchema,
  InboxSendDigestNowBodySchema,
  InboxSendInviteBodySchema,
  InboxSendMonthlySummaryBodySchema,
  InboxSourceEnum,
  InboxStatusEnum,
  InboxTasksDueListQuerySchema,
  InboxWorkItemKindEnum,
  InboxWorkflowRefSchema,
  InboxWorkloadListQuerySchema
});
