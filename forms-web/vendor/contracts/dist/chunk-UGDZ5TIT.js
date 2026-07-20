import {
  Payment,
  Spend
} from "./chunk-IZGYUEC2.js";
import {
  TaskScheduleItem,
  TaskStats
} from "./chunk-4O3BPXUB.js";
import {
  Population
} from "./chunk-AGNAOSOI.js";
import {
  BoolFromLike,
  BoolLike,
  GrantIdsLike,
  ISO10,
  Id,
  IdLike,
  Ids,
  JsonObjLike,
  TsLike,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/enrollments.ts
var enrollments_exports = {};
__export(enrollments_exports, {
  Enrollment: () => Enrollment,
  EnrollmentActionHistoryEventType: () => EnrollmentActionHistoryEventType,
  EnrollmentActionHistoryRecord: () => EnrollmentActionHistoryRecord,
  EnrollmentActions: () => EnrollmentActions,
  EnrollmentActionsApplyBody: () => EnrollmentActionsApplyBody,
  EnrollmentClientAllocation: () => EnrollmentClientAllocation,
  EnrollmentCompliance: () => EnrollmentCompliance,
  EnrollmentContinuity: () => EnrollmentContinuity,
  EnrollmentCycleRolloverPreviewItem: () => EnrollmentCycleRolloverPreviewItem,
  EnrollmentGetByIdQuery: () => EnrollmentGetByIdQuery,
  EnrollmentMedicaid: () => EnrollmentMedicaid,
  EnrollmentMedicaidStatus: () => EnrollmentMedicaidStatus,
  EnrollmentProgramAutomation: () => EnrollmentProgramAutomation,
  EnrollmentServiceStatus: () => EnrollmentServiceStatus,
  EnrollmentUnenrollmentReview: () => EnrollmentUnenrollmentReview,
  EnrollmentsAdminDeleteBody: () => EnrollmentsAdminDeleteBody,
  EnrollmentsAdminDeleteResp: () => EnrollmentsAdminDeleteResp,
  EnrollmentsAdminReverseLedgerEntryBody: () => EnrollmentsAdminReverseLedgerEntryBody,
  EnrollmentsAllocationSetBody: () => EnrollmentsAllocationSetBody,
  EnrollmentsBackfillNamesBody: () => EnrollmentsBackfillNamesBody,
  EnrollmentsBulkEnrollBody: () => EnrollmentsBulkEnrollBody,
  EnrollmentsCheckDualQuery: () => EnrollmentsCheckDualQuery,
  EnrollmentsCheckOverlapsQuery: () => EnrollmentsCheckOverlapsQuery,
  EnrollmentsContinuumSummaryQuery: () => EnrollmentsContinuumSummaryQuery,
  EnrollmentsCycleRolloverPreviewBody: () => EnrollmentsCycleRolloverPreviewBody,
  EnrollmentsCycleRolloverRunBody: () => EnrollmentsCycleRolloverRunBody,
  EnrollmentsDeleteBody: () => EnrollmentsDeleteBody,
  EnrollmentsDeleteCoreOutput: () => EnrollmentsDeleteCoreOutput,
  EnrollmentsDeleteResp: () => EnrollmentsDeleteResp,
  EnrollmentsDeleteResultItem: () => EnrollmentsDeleteResultItem,
  EnrollmentsEnrollCustomerBody: () => EnrollmentsEnrollCustomerBody,
  EnrollmentsLinkedProgramsReconcileBody: () => EnrollmentsLinkedProgramsReconcileBody,
  EnrollmentsListQuery: () => EnrollmentsListQuery,
  EnrollmentsMigrateBody: () => EnrollmentsMigrateBody,
  EnrollmentsPatchBody: () => EnrollmentsPatchBody,
  EnrollmentsPatchRow: () => EnrollmentsPatchRow,
  EnrollmentsUndoMigrationBody: () => EnrollmentsUndoMigrationBody,
  EnrollmentsUpsertBody: () => EnrollmentsUpsertBody,
  ScheduleMeta: () => ScheduleMeta,
  ScheduleMetaMigrated: () => ScheduleMetaMigrated,
  ScheduleMetaV1: () => ScheduleMetaV1,
  TaskScheduleMeta: () => TaskScheduleMeta,
  buildEnrollmentClosePreview: () => buildEnrollmentClosePreview,
  enrollmentMonthEnd: () => enrollmentMonthEnd,
  enrollmentPaymentDate: () => enrollmentPaymentDate
});
var EnrollmentCompliance = z.object({
  caseworthyEntryComplete: z.boolean().nullish(),
  caseworthyExitComplete: z.boolean().nullish(),
  hmisEntryComplete: z.boolean().nullish(),
  hmisExitComplete: z.boolean().nullish()
});
var EnrollmentServiceStatus = z.enum(["active", "paused", "expired"]);
var EnrollmentMedicaidStatus = z.enum(["active", "closed"]);
var EnrollmentMedicaid = z.object({
  status: EnrollmentMedicaidStatus.default("active"),
  closedDate: z.string().trim().nullable().optional(),
  reopenedDate: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional()
}).passthrough();
var EnrollmentActions = z.record(z.string(), z.unknown());
var EnrollmentActionHistoryEventType = z.enum([
  "actionChanged",
  "serviceStatusChanged",
  "medicaidStatusChanged",
  "renewalReminderCreated",
  "enrollmentExpired",
  "automationFailed"
]);
var EnrollmentActionHistoryRecord = z.object({
  id: Id.optional(),
  eventType: EnrollmentActionHistoryEventType,
  actionId: z.string().trim().nullable().optional(),
  actorType: z.enum(["user", "system", "automation"]).default("user"),
  actorId: z.string().trim().nullable().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  note: z.string().trim().nullable().optional(),
  createdAt: TsLike.nullish().optional()
}).passthrough();
var EnrollmentActionsApplyBody = z.object({
  enrollmentId: Id,
  actionId: z.string().trim().min(1).optional(),
  value: z.unknown().optional(),
  serviceStatus: EnrollmentServiceStatus.optional(),
  medicaid: EnrollmentMedicaid.partial().optional(),
  note: z.string().trim().nullable().optional()
}).passthrough().refine(
  (v) => !!v.serviceStatus || !!v.medicaid || typeof v.actionId === "string" && Object.prototype.hasOwnProperty.call(v, "value"),
  { message: "missing_action_update" }
);
var ScheduleMetaV1 = z.object({
  version: z.literal(1),
  rentPlans: z.array(
    z.object({
      firstDue: z.string(),
      months: z.string(),
      monthly: z.string(),
      lineItemId: z.string(),
      vendor: z.string().optional(),
      comment: z.string().optional()
    })
  ),
  utilPlans: z.array(
    z.object({
      firstDue: z.string(),
      months: z.string(),
      monthly: z.string(),
      lineItemId: z.string(),
      vendor: z.string().optional(),
      comment: z.string().optional()
    })
  ),
  deposit: z.object({
    enabled: z.boolean(),
    date: z.string(),
    amount: z.string(),
    lineItemId: z.string(),
    vendor: z.string().optional(),
    comment: z.string().optional()
  }).optional(),
  prorated: z.object({
    enabled: z.boolean(),
    date: z.string(),
    amount: z.string(),
    lineItemId: z.string(),
    vendor: z.string().optional(),
    comment: z.string().optional()
  }).optional(),
  services: z.array(
    z.object({
      id: z.string(),
      note: z.string(),
      date: z.string(),
      amount: z.string(),
      lineItemId: z.string(),
      vendor: z.string().optional(),
      comment: z.string().optional()
    })
  ),
  migratedOut: z.object({
    toEnrollmentId: z.string(),
    toGrantId: z.string(),
    cutover: z.string()
  }).nullable().optional(),
  /** ISO timestamp of the last manual projection edit after the initial build. Cleared on full rebuild. */
  editedAt: z.string().optional()
});
var ScheduleMetaMigrated = z.object({
  mode: z.literal("migrated"),
  cutover: z.string(),
  defaultEditMode: z.enum(["keepManual", "rebuildUnpaid"]).optional(),
  fromEnrollmentId: z.string(),
  fromGrantId: z.string(),
  lineItemMapSnapshot: z.record(z.string(), z.string()).optional(),
  migratedOut: z.object({
    toEnrollmentId: z.string(),
    toGrantId: z.string(),
    cutover: z.string()
  }).nullable().optional()
});
var ScheduleMeta = z.union([ScheduleMetaMigrated, ScheduleMetaV1]);
var TaskScheduleMeta = z.object({
  version: z.literal(1),
  defs: z.array(z.unknown()).default([]),
  savedAt: TsLike.nullish().optional()
}).passthrough();
var EnrollmentContinuity = z.object({
  continuumId: Id,
  kind: z.literal("grantCycle").default("grantCycle"),
  previousEnrollmentId: Id.nullable().optional(),
  nextEnrollmentId: Id.nullable().optional(),
  rolloverSource: z.enum(["admin", "migration", "backfill"]).nullish(),
  cutoffDate: ISO10.nullish()
}).passthrough();
var EnrollmentClientAllocation = z.object({
  amount: z.number().min(0).nullable().optional(),
  note: z.string().trim().max(1e3).nullable().optional(),
  updatedAt: TsLike.nullish().optional(),
  updatedBy: z.string().trim().nullable().optional()
}).passthrough();
var EnrollmentProgramAutomation = z.object({
  targetGrantId: Id.nullish(),
  sourceEnrollmentIds: z.array(Id).default([]),
  createdByRule: z.boolean().default(false)
}).passthrough();
var EnrollmentUnenrollmentReview = z.object({
  required: z.boolean().default(false),
  reason: z.string().trim().nullable().optional(),
  sourceEnrollmentIds: z.array(Id).default([]),
  flaggedAt: TsLike.nullish().optional(),
  clearedAt: TsLike.nullish().optional()
}).passthrough();
function enrollmentISO10(value) {
  if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object") {
    const timestamp = value;
    if (typeof timestamp.toDate === "function") return enrollmentISO10(timestamp.toDate());
    if (typeof timestamp.seconds === "number") return new Date(timestamp.seconds * 1e3).toISOString().slice(0, 10);
  }
  return "";
}
function enrollmentPaymentDate(payment) {
  return enrollmentISO10(payment.paidDate || payment.paidAt || payment.dueDate || payment.date);
}
function enrollmentMonthEnd(value) {
  const iso = enrollmentISO10(value);
  if (!iso) return "";
  const [year, month] = iso.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return "";
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
function buildEnrollmentClosePreview(args) {
  const payments = Array.isArray(args.payments) ? args.payments : [];
  const paidDates = payments.filter((payment) => payment.paid === true && payment.void !== true).map(enrollmentPaymentDate).filter(Boolean).sort();
  const lastPaidDate = paidDates.at(-1) || null;
  const closeDate = enrollmentMonthEnd(args.requestedCloseDate || lastPaidDate || args.fallbackDate) || enrollmentMonthEnd(/* @__PURE__ */ new Date());
  const paidAfterClose = payments.filter((payment) => payment.paid === true && payment.void !== true && enrollmentPaymentDate(payment) > closeDate);
  const futureUnpaid = payments.filter((payment) => payment.paid !== true && payment.void !== true && enrollmentPaymentDate(payment) > closeDate);
  const futureUnpaidSet = new Set(futureUnpaid);
  return {
    closeDate,
    lastPaidDate,
    paidAfterClose,
    futureUnpaid,
    futureUnpaidPayments: futureUnpaid,
    retainedPayments: payments.filter((payment) => !futureUnpaidSet.has(payment)),
    canClose: paidAfterClose.length === 0
  };
}
var Enrollment = z.object({
  id: Id,
  grantId: z.string(),
  customerId: z.string(),
  // org/team access (server authoritative)
  orgId: z.string().trim().min(1).nullish(),
  teamIds: z.array(z.string().trim().min(1)).max(10).optional(),
  startDate: z.string().nullable().optional(),
  // YYYY-MM-DD
  endDate: z.string().nullable().optional(),
  migratedFrom: z.object({
    enrollmentId: z.string(),
    grantId: z.string(),
    cutover: z.string(),
    migrationId: z.string().optional()
  }).nullable().optional(),
  migratedTo: z.object({
    enrollmentId: z.string(),
    grantId: z.string(),
    cutover: z.string(),
    migrationId: z.string().optional()
  }).nullable().optional(),
  continuity: EnrollmentContinuity.nullish(),
  clientAllocation: EnrollmentClientAllocation.nullish(),
  programAutomation: EnrollmentProgramAutomation.nullish(),
  unenrollmentReview: EnrollmentUnenrollmentReview.nullish(),
  active: z.boolean().nullable().optional(),
  status: z.enum(["active", "deleted", "closed"]).nullable().optional(),
  deleted: z.boolean().nullable().optional(),
  // Service status is separate from enrollment lifecycle. Medicaid loss can pause service
  // while the enrollment lifecycle remains active for authorization/renewal tracking.
  serviceStatus: EnrollmentServiceStatus.nullable().optional(),
  medicaid: EnrollmentMedicaid.nullish(),
  actions: EnrollmentActions.nullish(),
  // Operational stage (waitlist → tenant, etc.) kept separate from lifecycle status.
  stage: z.enum(["waitlisted", "offered", "tenant", "exited"]).nullable().optional(),
  // First-class priority snapshot for waitlist ordering (computed from an assessment).
  priorityScore: z.number().nullable().optional(),
  priorityLevel: z.string().nullable().optional(),
  priorityAt: TsLike.nullish().optional(),
  priorityTemplateId: z.string().nullable().optional(),
  priorityTemplateVersion: z.number().int().nullable().optional(),
  priorityAssessmentId: z.string().nullable().optional(),
  // Optional generic latest-results cache (templateId → small snapshot)
  latestAssessments: z.record(
    z.string(),
    z.object({
      at: TsLike.nullish().optional(),
      assessmentId: z.string().nullable().optional(),
      templateVersion: z.number().int().nullable().optional(),
      computed: z.record(z.string(), z.unknown()).optional()
    }).passthrough()
  ).nullish().optional(),
  compliance: EnrollmentCompliance.nullish(),
  customerName: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  grantName: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  population: Population.optional(),
  caseManagerId: z.string().nullable().optional(),
  caseManagerName: z.string().nullable().optional(),
  maxAssistanceMonthsAtEnrollment: z.number().int().min(1).max(240).nullable().optional(),
  maxAssistanceCutoffDate: z.string().nullable().optional(),
  // --- Finance (kept here for now; payments & spends also live in dedicated features)
  payments: z.array(Payment).nullable().optional(),
  spends: z.array(Spend).nullable().optional(),
  // --- Tasks (single model for tasks & compliance)
  taskSchedule: z.array(TaskScheduleItem).nullable().optional(),
  taskStats: TaskStats.nullish(),
  scheduleMeta: ScheduleMeta.nullish(),
  taskScheduleMeta: TaskScheduleMeta.nullish(),
  /**
   * Whether to auto-generate the task schedule from grant.tasks when this
   * enrollment is created.  Defaults to true when absent.
   * Set to false to enroll the client without creating managed tasks.
   */
  generateTaskSchedule: z.boolean().default(true),
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike
  // required by convention
});
var EnrollmentGetByIdQuery = z.object({ id: Id }).passthrough();
var EnrollmentsListQuery = z.object({
  active: BoolLike.optional(),
  customerId: Id.optional(),
  grantId: Id.optional(),
  limit: z.union([z.number(), z.string()]).optional(),
  startAfter: z.string().optional(),
  status: z.string().optional()
}).passthrough();
var EnrollmentsBackfillNamesBody = z.object({
  limit: z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: BoolFromLike.optional(),
  dryRun: BoolFromLike.optional()
}).passthrough();
var EnrollmentsUpsertBody = z.union([
  Enrollment.partial(),
  z.array(Enrollment.partial()).min(1)
]);
var EnrollmentsPatchRow = z.object({
  id: Id,
  patch: z.record(z.string(), z.unknown()).optional(),
  unset: z.array(z.string()).optional()
}).refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var EnrollmentsPatchBody = z.union([
  EnrollmentsPatchRow,
  z.array(EnrollmentsPatchRow).min(1)
]);
var EnrollmentDeleteIdObj = z.object({
  id: Id.optional(),
  ids: Ids.optional()
}).refine(
  (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0,
  { message: "missing_id_or_ids" }
);
var EnrollmentsDeleteBody = z.union([
  Id,
  Ids,
  EnrollmentDeleteIdObj.extend({
    voidPaid: z.boolean().optional(),
    hard: z.boolean().optional(),
    unlinkSpends: z.boolean().optional()
  })
]);
var EnrollmentsAdminDeleteBody = z.union([
  Id,
  Ids,
  EnrollmentDeleteIdObj.extend({
    voidPaid: z.boolean().optional(),
    mode: z.enum(["safe", "hard"]).optional(),
    purgeSpends: z.boolean().optional(),
    purgeSubcollections: z.boolean().optional(),
    unlinkSpends: z.boolean().optional()
  })
]);
var EnrollmentsDeleteResultItem = z.object({
  id: z.string(),
  ok: z.literal(true).optional(),
  error: z.string().optional()
});
var EnrollmentsDeleteCoreOutput = z.object({
  ok: z.boolean(),
  results: z.array(EnrollmentsDeleteResultItem)
});
var EnrollmentsDeleteResp = EnrollmentsDeleteCoreOutput.extend({
  deleted: z.literal(true)
});
var EnrollmentsAdminDeleteResp = EnrollmentsDeleteCoreOutput.extend({
  deleted: z.literal(true),
  mode: z.enum(["safe", "hard"]),
  purged: z.object({
    spends: z.number().int().nonnegative(),
    enrollments: z.number().int().nonnegative()
  }).optional(),
  purgeErrors: z.array(z.object({ id: z.string(), error: z.string() })).optional()
});
var EnrollmentsEnrollCustomerBody = z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return v;
    const o = { ...v };
    if (o.grantId == null && o.grant_id != null) o.grantId = o.grant_id;
    if (o.customerId == null && o.clientId != null) o.customerId = o.clientId;
    if (o.customerId == null && o.customer_id != null) o.customerId = o.customer_id;
    return o;
  },
  z.object({
    grantId: IdLike,
    customerId: IdLike,
    extra: JsonObjLike.default({})
  }).passthrough()
);
var EnrollmentsBulkEnrollBody = z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return v;
    const o = { ...v };
    if (o.grantId == null && o.grant_id != null) o.grantId = o.grant_id;
    if (o.customerIds == null && o.clientIds != null) o.customerIds = o.clientIds;
    if (o.perCustomerExtra == null && o.perClientExtra != null) o.perCustomerExtra = o.perClientExtra;
    return o;
  },
  z.object({
    grantId: IdLike,
    customerIds: z.preprocess((v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
      return v;
    }, z.array(IdLike).min(1)),
    // options used by the handler (normalized + defaulted)
    skipIfExists: BoolFromLike.default(true),
    existsMode: z.enum(["nonDeleted", "activeOnly"]).default("nonDeleted"),
    // payloads used by the handler (normalized + defaulted)
    extra: JsonObjLike.default({}),
    perCustomerExtra: z.preprocess((v) => {
      if (v && typeof v === "object") return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }
      return v;
    }, z.record(z.string(), JsonObjLike).default({}))
  }).passthrough()
);
var EnrollmentsCheckOverlapsQuery = z.object({
  customerId: Id.optional(),
  clientId: Id.optional(),
  grantIds: GrantIdsLike.optional(),
  window: z.object({ start: ISO10.optional(), end: ISO10.optional() }).optional(),
  activeOnly: z.boolean().optional()
}).passthrough();
var EnrollmentLikeForDual = z.object({
  customerId: Id.optional(),
  clientId: Id.optional(),
  status: z.string().optional()
}).passthrough();
var EnrollmentsCheckDualQuery = z.object({
  enrollments: z.array(EnrollmentLikeForDual).min(1)
}).passthrough();
var EnrollmentsMigrateBody = z.object({
  enrollmentId: Id,
  toGrantId: Id,
  cutoverDate: ISO10,
  lineItemMap: z.record(z.string(), z.string()).optional(),
  closeSource: z.boolean().optional(),
  moveSpends: z.boolean().optional(),
  moveTasks: z.boolean().optional(),
  preserveTaskIds: z.boolean().optional(),
  movePaidPayments: z.boolean().optional(),
  rebuildScheduleMeta: z.boolean().optional(),
  closeSourceTaskMode: z.enum(["complete", "delete"]).optional(),
  closeSourcePaymentMode: z.enum(["spendUnpaid", "deleteUnpaid", "keep"]).optional()
}).passthrough();
var EnrollmentsContinuumSummaryQuery = z.object({ enrollmentId: Id }).passthrough();
var EnrollmentsAllocationSetBody = z.object({
  enrollmentId: Id,
  amount: z.number().min(0).nullable(),
  note: z.string().trim().max(1e3).nullable().optional()
}).passthrough();
var EnrollmentsCycleRolloverPreviewBody = z.object({
  grantId: Id,
  cutoverDate: ISO10.optional()
}).passthrough();
var EnrollmentCycleRolloverPreviewItem = z.object({
  enrollmentId: Id,
  customerId: Id,
  customerName: z.string().nullable(),
  eligible: z.boolean(),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  futureUnpaidPayments: z.number().int().nonnegative(),
  futureOpenReminders: z.number().int().nonnegative(),
  calculatedAllocation: z.number().nonnegative()
});
var EnrollmentsCycleRolloverRunBody = EnrollmentsCycleRolloverPreviewBody.extend({
  enrollmentIds: z.array(Id).min(1).max(500).optional(),
  confirm: z.literal("ROLLOVER")
});
var EnrollmentsLinkedProgramsReconcileBody = z.object({
  grantIds: z.array(Id).max(50).optional(),
  dryRun: z.boolean().default(true)
}).passthrough();
var EnrollmentsUndoMigrationBody = z.object({
  migrationId: Id
}).passthrough();
var EnrollmentsAdminReverseLedgerEntryBody = z.object({
  ledgerId: Id,
  mode: z.enum(["ledger", "budget", "both"]).optional(),
  note: z.string().optional()
}).passthrough();

export {
  EnrollmentCompliance,
  EnrollmentServiceStatus,
  EnrollmentMedicaidStatus,
  EnrollmentMedicaid,
  EnrollmentActions,
  EnrollmentActionHistoryEventType,
  EnrollmentActionHistoryRecord,
  EnrollmentActionsApplyBody,
  ScheduleMetaV1,
  ScheduleMetaMigrated,
  ScheduleMeta,
  TaskScheduleMeta,
  EnrollmentContinuity,
  EnrollmentClientAllocation,
  EnrollmentProgramAutomation,
  EnrollmentUnenrollmentReview,
  enrollmentPaymentDate,
  enrollmentMonthEnd,
  buildEnrollmentClosePreview,
  Enrollment,
  EnrollmentGetByIdQuery,
  EnrollmentsListQuery,
  EnrollmentsBackfillNamesBody,
  EnrollmentsUpsertBody,
  EnrollmentsPatchRow,
  EnrollmentsPatchBody,
  EnrollmentsDeleteBody,
  EnrollmentsAdminDeleteBody,
  EnrollmentsDeleteResultItem,
  EnrollmentsDeleteCoreOutput,
  EnrollmentsDeleteResp,
  EnrollmentsAdminDeleteResp,
  EnrollmentsEnrollCustomerBody,
  EnrollmentsBulkEnrollBody,
  EnrollmentsCheckOverlapsQuery,
  EnrollmentsCheckDualQuery,
  EnrollmentsMigrateBody,
  EnrollmentsContinuumSummaryQuery,
  EnrollmentsAllocationSetBody,
  EnrollmentsCycleRolloverPreviewBody,
  EnrollmentCycleRolloverPreviewItem,
  EnrollmentsCycleRolloverRunBody,
  EnrollmentsLinkedProgramsReconcileBody,
  EnrollmentsUndoMigrationBody,
  EnrollmentsAdminReverseLedgerEntryBody,
  enrollments_exports
};
