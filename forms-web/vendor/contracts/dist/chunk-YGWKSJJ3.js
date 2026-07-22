import {
  Boolish,
  ISO10,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

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
var InboxSourceEnum = z.enum([
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
var InboxStatusEnum = z.enum(["open", "done"]);
var InboxAssignedGroupEnum = z.enum(["admin", "casemanager", "compliance"]);
var InboxWorkItemKindEnum = z.enum([
  "task",
  "assessment",
  "compliance",
  "payment",
  "intake",
  "referral",
  "workflow"
]);
var InboxWorkflowRefSchema = z.object({
  type: z.enum(["intake", "referral", "form"]),
  instanceId: z.string().min(1),
  stage: z.string().min(1),
  customerId: z.string().nullish(),
  enrollmentId: z.string().nullish(),
  formId: z.string().nullish()
});
var YYYY_MM = z.string().regex(/^\d{4}-\d{2}$/);
var UrlOrHash = z.union([z.url(), z.literal("#")]);
var InboxDigestTypeSchema = z.enum(["caseload", "budget", "enrollments", "grantPrograms", "caseManagers", "rentalAssistance"]);
var InboxDigestSubRecordSchema = z.object({
  uid: z.string().min(1),
  email: z.email(),
  displayName: z.string().optional(),
  roles: z.array(z.string()),
  topRole: z.string(),
  subs: z.partialRecord(InboxDigestTypeSchema, z.boolean()),
  effective: z.record(InboxDigestTypeSchema, z.boolean()),
  grantProgramIds: z.array(z.string()).optional()
});
var IsoString = z.string().min(1);
var InboxItemSchema = z.object({
  utid: z.string().min(1),
  source: InboxSourceEnum,
  status: InboxStatusEnum,
  enrollmentId: z.string().nullable(),
  clientId: z.string().nullable(),
  grantId: z.string().nullable(),
  sourcePath: z.string().min(1),
  dueDate: ISO10.nullish(),
  // YYYY-MM-DD
  dueMonth: YYYY_MM.nullish(),
  // YYYY-MM
  createdAtISO: IsoString.nullish(),
  updatedAtISO: IsoString.nullish(),
  assignedToUid: z.string().nullable(),
  assignedToGroup: InboxAssignedGroupEnum.nullish(),
  cmUid: z.string().nullable(),
  secondaryCmUid: z.string().nullable().default(null),
  // org scoping / projection
  orgId: z.string().nullish(),
  teamIds: z.array(z.string().min(1)).nullish(),
  notify: z.boolean().nullish(),
  /** Lightweight notification meaning; this does not imply staff performance tracking. */
  workItemKind: InboxWorkItemKindEnum.nullish(),
  workflowRef: InboxWorkflowRefSchema.nullish(),
  title: z.string().default(""),
  subtitle: z.string().nullish(),
  labels: z.array(z.string().min(1)).nullish(),
  /** Backend-owned deep link for workflow-backed reminders. */
  actionUrl: z.url().nullish(),
  actionLabel: z.string().max(120).nullish(),
  completedAtISO: IsoString.nullish()
}).passthrough();
var InboxItemEntitySchema = InboxItemSchema.extend({
  id: z.string().min(1)
});
var InboxListMyQuerySchema = z.object({
  month: YYYY_MM.optional(),
  includeOverdue: Boolish.optional(),
  includeGroup: Boolish.optional()
}).partial();
var InboxTasksDueListQuerySchema = z.object({
  month: YYYY_MM.optional()
}).partial();
var InboxWorkloadListQuerySchema = z.object({
  month: YYYY_MM.optional(),
  assigneeUid: z.string().optional(),
  includeUnassigned: Boolish.optional(),
  limit: z.coerce.number().int().min(1).max(5e3).optional()
}).partial();
var InboxSendInviteBodySchema = z.object({
  to: z.email(),
  name: z.string().trim().optional().default(""),
  resetLink: UrlOrHash.optional().default("#"),
  subject: z.string().trim().optional(),
  html: z.string().trim().optional()
});
var InboxSendMonthlySummaryBodySchema = z.object({
  to: z.email(),
  clientId: z.union([z.string(), z.number()]).transform(String),
  tasksDue: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String).optional(),
      type: z.string().optional(),
      dueDate: z.string().optional(),
      completed: z.boolean().optional(),
      completedAt: z.string().optional()
    })
  ).optional().default([]),
  monthsRemaining: z.number().int().nonnegative().nullable().optional(),
  dashboardLink: UrlOrHash.optional().default("#"),
  subject: z.string().trim().optional(),
  html: z.string().trim().optional()
});
var InboxSendDigestNowBodySchema = z.object({
  digestType: InboxDigestTypeSchema.optional().default("caseload"),
  months: z.array(YYYY_MM).min(1),
  cmUid: z.string().optional(),
  combine: z.boolean().optional().default(false),
  subject: z.string().optional(),
  subjectTemplate: z.string().optional(),
  message: z.string().optional()
});
var InboxScheduleDigestBodySchema = z.object({
  digestType: InboxDigestTypeSchema.optional().default("caseload"),
  months: z.array(YYYY_MM).min(1),
  cmUid: z.string().min(1),
  combine: z.boolean().optional().default(true),
  subject: z.string().optional(),
  subjectTemplate: z.string().optional(),
  message: z.string().optional(),
  sendAt: z.string().datetime()
});
var InboxDigestPreviewQuerySchema = z.object({
  month: YYYY_MM.optional(),
  cmUid: z.string().optional()
});
var InboxMetricsScopeSchema = z.object({
  assignedCount: z.number().int().nonnegative(),
  openCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  completionPct: z.number().nonnegative(),
  // 0-100
  overdueCount: z.number().int().nonnegative(),
  sharedCount: z.number().int().nonnegative(),
  assignedToMeCount: z.number().int().nonnegative()
});
var InboxMetricsMyQuerySchema = z.object({
  month: YYYY_MM.optional()
}).partial();

export {
  InboxSourceEnum,
  InboxStatusEnum,
  InboxAssignedGroupEnum,
  InboxWorkItemKindEnum,
  InboxWorkflowRefSchema,
  InboxDigestTypeSchema,
  InboxDigestSubRecordSchema,
  InboxItemSchema,
  InboxItemEntitySchema,
  InboxListMyQuerySchema,
  InboxTasksDueListQuerySchema,
  InboxWorkloadListQuerySchema,
  InboxSendInviteBodySchema,
  InboxSendMonthlySummaryBodySchema,
  InboxSendDigestNowBodySchema,
  InboxScheduleDigestBodySchema,
  InboxDigestPreviewQuerySchema,
  InboxMetricsScopeSchema,
  InboxMetricsMyQuerySchema,
  inbox_exports
};
