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
  TaskScheduleMeta: () => TaskScheduleMeta
});
module.exports = __toCommonJS(enrollments_exports);

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
var TsLike = TimestampLike;
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

// src/customers.ts
var Population = import_zod2.z.enum(["Youth", "Individual", "Family"]).nullable();
var CustomerStatus = import_zod2.z.enum(["active", "inactive", "deleted"]).nullable();
var CustomerAcuity = import_zod2.z.object({
  templateId: Id.nullish(),
  templateVersion: import_zod2.z.number().int().nullish(),
  submissionId: Id.nullish(),
  score: import_zod2.z.number().nullish(),
  level: import_zod2.z.string().trim().nullish(),
  computedAt: TsLike.nullish(),
  // tolerated during migration / transitional UI
  answers: import_zod2.z.array(import_zod2.z.unknown()).optional()
}).passthrough().nullish();
var CustomerMeta = import_zod2.z.object({
  // Legacy Drive folder link list. Compatibility read order is:
  // customerDrive.folderId -> meta.driveFolderId -> meta.driveFolders[0].id.
  // New structured Drive state should live under customerDrive, not meta.
  driveFolders: import_zod2.z.array(
    import_zod2.z.object({
      id: import_zod2.z.string(),
      // NOTE: gdrive ids aren't your Id shape; keep string
      alias: import_zod2.z.string().trim().nullish().optional(),
      name: import_zod2.z.string().trim().nullish().optional(),
      driveId: import_zod2.z.string().trim().nullish().optional(),
      kind: import_zod2.z.literal("gdrive").default("gdrive")
    })
  ).optional(),
  // Legacy primary folder pointer kept for backward compatibility. Prefer
  // customerDrive.folderId for new resolvers and mirror writes during migration.
  driveFolderId: import_zod2.z.string().nullish(),
  notes: import_zod2.z.string().nullish(),
  // Household / family linking (Customer-Collection-Update). Denormalized
  // pointer to the canonical households/{id} doc this customer belongs to; the
  // member list itself lives on the household doc. Scalar = one primary
  // household per customer. See contracts/src/households.ts.
  householdId: import_zod2.z.string().trim().nullish(),
  householdRelationship: import_zod2.z.string().trim().nullish()
}).passthrough().nullish();
var AssistanceLength = import_zod2.z.object({
  firstDateOfAssistance: ISO10.nullish(),
  lastExpectedDateOfAssistance: ISO10.nullish()
}).passthrough().nullable().optional();
var CustomerOtherContact = import_zod2.z.object({
  uid: Id,
  name: import_zod2.z.string().trim().nullish(),
  role: import_zod2.z.string().trim().nullish().optional()
}).passthrough();
var CustomerInputSchema = import_zod2.z.object({
  id: Id.optional(),
  // org/team (server authoritative)
  orgId: Id.nullish(),
  teamIds: import_zod2.z.array(Id).max(10).optional(),
  // Identity fields
  firstName: import_zod2.z.string().trim().min(1).nullish(),
  lastName: import_zod2.z.string().trim().min(1).nullish(),
  name: import_zod2.z.string().trim().min(1).nullish(),
  // lenient; backend does not enforce ISO10
  dob: import_zod2.z.string().nullish(),
  // case manager binding
  caseManagerId: Id.nullish(),
  caseManagerName: import_zod2.z.string().trim().nullish(),
  secondaryCaseManagerId: Id.nullish(),
  secondaryCaseManagerName: import_zod2.z.string().trim().nullish(),
  otherContacts: import_zod2.z.array(CustomerOtherContact).max(3).optional(),
  contactCaseManagerIds: import_zod2.z.array(Id).max(5).optional(),
  // state (backend coerces/derives coherence)
  status: CustomerStatus.optional(),
  active: import_zod2.z.boolean().optional(),
  enrolled: import_zod2.z.boolean().optional(),
  deleted: import_zod2.z.boolean().optional(),
  // Canonical population + acuity
  population: Population.nullish(),
  assistanceLength: AssistanceLength,
  acuityScore: import_zod2.z.number().nullish(),
  acuity: CustomerAcuity,
  // Simple single-select acuity tier (1–3). Kept top-level (not nested under
  // acuity) so Firestore single-field indexes make it directly queryable.
  tier: import_zod2.z.number().int().min(1).max(3).nullish(),
  // Drive folders + misc metadata. Drive fields here are compatibility
  // fallbacks; new structured Drive state belongs under customerDrive.
  meta: CustomerMeta,
  // Customer workbook integration — persisted separately from meta to keep it top-level queryable
  customerDrive: import_zod2.z.object({
    // Current primary customer folder pointer for Drive/workbook flows.
    folderId: import_zod2.z.string().nullish(),
    folderUrl: import_zod2.z.string().nullish(),
    linkedWorkbooks: import_zod2.z.object({
      tss: import_zod2.z.object({
        spreadsheetId: import_zod2.z.string().nullish(),
        spreadsheetUrl: import_zod2.z.string().nullish(),
        spreadsheetName: import_zod2.z.string().nullish(),
        standardKey: import_zod2.z.string().nullish(),
        linkedEnrollmentId: import_zod2.z.string().nullish(),
        status: import_zod2.z.enum(["linked", "needsReview", "notFound", "error"]).nullish(),
        linkedBy: import_zod2.z.string().nullish(),
        linkedAt: import_zod2.z.string().nullish(),
        updatedAt: import_zod2.z.string().nullish(),
        detectedSheets: import_zod2.z.array(import_zod2.z.string()).nullish(),
        defaultEmbedSheetName: import_zod2.z.string().nullish(),
        defaultSheetGid: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).nullish(),
        progressNotesGid: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).nullish(),
        variant: import_zod2.z.enum(["payer", "nonpayer"]).nullish(),
        lastValidatedAt: import_zod2.z.string().nullish()
      }).passthrough().nullish()
    }).passthrough().nullish()
  }).passthrough().nullish(),
  // server-managed timestamps (accepted but ignored on write)
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional(),
  // alternative display name for search
  alias: import_zod2.z.string().trim().nullish(),
  // tolerated legacy / common fields
  hmisId: import_zod2.z.string().trim().nullish(),
  cwId: import_zod2.z.string().trim().nullish(),
  phone: import_zod2.z.string().nullish(),
  email: import_zod2.z.string().nullish(),
  // keep lenient unless you want z.email()
  address: import_zod2.z.string().nullish()
}).passthrough();
var CustomerEntity = CustomerInputSchema.extend({
  id: Id
}).passthrough();
var CustomerUpsertSchema = CustomerInputSchema.extend({
  enrolled: import_zod2.z.boolean().optional().default(true)
}).passthrough();
var CustomersUpsertBody = import_zod2.z.union([
  CustomerUpsertSchema,
  import_zod2.z.array(CustomerUpsertSchema).min(1)
]);
var CustomersPatchRow = import_zod2.z.object({
  id: Id,
  patch: CustomerInputSchema.partial().passthrough().optional(),
  unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional(),
  coerceNulls: BoolFromLike.optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var CustomersPatchBody = import_zod2.z.union([
  CustomersPatchRow,
  import_zod2.z.array(CustomersPatchRow).min(1)
]);
var CustomersDeleteIdShape = import_zod2.z.object({
  id: IdLike.optional(),
  ids: import_zod2.z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    return v;
  }, import_zod2.z.array(IdLike).min(1).optional()),
  cascade: BoolFromLike.optional()
  // aligns with handler’s cascade behavior
}).passthrough();
var hasIdOrIds = (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0;
var CustomersDeleteIdObj = CustomersDeleteIdShape.refine(
  (v) => hasIdOrIds(v),
  { message: "missing_id_or_ids" }
);
var CustomersDeleteBody = import_zod2.z.union([
  IdLike,
  import_zod2.z.array(IdLike).min(1),
  CustomersDeleteIdObj
]);
var CustomersAdminDeleteIdObj = CustomersDeleteIdShape.omit({ cascade: true }).refine(
  (v) => hasIdOrIds(v),
  { message: "missing_id_or_ids" }
);
var CustomersAdminDeleteBody = import_zod2.z.union([
  IdLike,
  import_zod2.z.array(IdLike).min(1),
  CustomersAdminDeleteIdObj
]);
var CustomersGetQuery = import_zod2.z.object({ id: IdLike }).passthrough();
var ActiveFilter = import_zod2.z.preprocess(
  (v) => {
    if (v === "" || v == null) return "all";
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
    if (Array.isArray(v)) return v[0];
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "" || s === "all" || s === "undefined" || s === "null")
        return "all";
      if (["true", "1", "yes", "y", "active"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
    }
    return "all";
  },
  import_zod2.z.union([import_zod2.z.literal(true), import_zod2.z.literal(false), import_zod2.z.literal("all")])
);
var CustomersListQuery = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  active: ActiveFilter.optional(),
  deleted: import_zod2.z.enum(["exclude", "only", "include"]).optional(),
  caseManagerId: IdLike.optional(),
  contactCaseManagerId: IdLike.optional()
}).passthrough();
var CustomersBackfillNamesBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();
var CustomersBackfillCaseManagerNamesBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();
var CustomersBackfillAssistanceLengthBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();

// src/payments.ts
var ISO10ish = import_zod2.z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return s;
  return s.length >= 10 ? s.slice(0, 10) : s;
}, ISO10);
var PaymentType = import_zod2.z.enum(["monthly", "deposit", "prorated", "service", "arrears"]);
var ComplianceCheckItem = import_zod2.z.object({
  key: import_zod2.z.string().min(1),
  label: import_zod2.z.string().optional(),
  done: import_zod2.z.boolean().default(false),
  doneAt: import_zod2.z.string().nullish(),
  // ISO timestamp when marked done
  doneBy: import_zod2.z.string().nullish()
  // uid or display name of who marked it done
});
var PaymentCompliance = import_zod2.z.object({
  hmisComplete: import_zod2.z.boolean().nullish(),
  caseworthyComplete: import_zod2.z.boolean().nullish(),
  items: import_zod2.z.array(ComplianceCheckItem).default([]),
  status: import_zod2.z.string().nullish(),
  note: import_zod2.z.string().nullish()
});
var RentCertStatus = import_zod2.z.enum(["due", "completed", "effective"]);
var PaymentRentCert = import_zod2.z.object({
  dueDate: import_zod2.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetPaymentDate: import_zod2.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: import_zod2.z.enum(["calculated", "manual"]).default("calculated"),
  taskIds: import_zod2.z.array(import_zod2.z.string()).default([]),
  status: RentCertStatus.default("due")
}).passthrough();
var Payment = import_zod2.z.object({
  id: import_zod2.z.string().optional(),
  // core
  type: PaymentType,
  amount: import_zod2.z.coerce.number(),
  dueDate: ISO10ish,
  // YYYY-MM-DD
  lineItemId: import_zod2.z.string().nullable().optional(),
  // status
  paid: import_zod2.z.boolean().nullish(),
  paidAt: ISO10ish.nullish(),
  // if you ever store full timestamps, switch this to TsLike
  paidFromGrant: import_zod2.z.boolean().nullish(),
  void: import_zod2.z.boolean().nullish(),
  // notes / vendor
  note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
  vendor: import_zod2.z.string().nullish(),
  comment: import_zod2.z.string().nullish(),
  notifyCM: import_zod2.z.boolean().nullish(),
  // used by inbox trigger logic
  // compliance
  compliance: PaymentCompliance.nullish(),
  rentCert: PaymentRentCert.nullish(),
  /**
   * Sticky "not due": set when an operator clears a rent cert so the
   * calculated continuum sync does not regenerate one for this payment.
   */
  rentCertOptOut: import_zod2.z.boolean().nullish()
});
var PaymentEntity = Payment.extend({
  id: import_zod2.z.string().min(1)
});
var SpendSource = import_zod2.z.enum([
  "enrollment",
  // current default for enrollment-level spends
  "card",
  // future credit-card feed
  "org",
  // future org/program-wide spend
  "manual"
  // admin/manual adjustment
]);
var Spend = import_zod2.z.object({
  id: import_zod2.z.string(),
  // Required
  paymentId: import_zod2.z.string(),
  lineItemId: import_zod2.z.string().nullable(),
  amount: import_zod2.z.coerce.number(),
  // +spend / -reversal
  // Metadata
  source: SpendSource.optional(),
  orgId: import_zod2.z.string().nullish(),
  grantId: import_zod2.z.string().nullish(),
  enrollmentId: import_zod2.z.string().nullish(),
  customerId: import_zod2.z.string().nullish(),
  caseManagerId: import_zod2.z.string().nullish(),
  paid: import_zod2.z.boolean().nullish(),
  status: import_zod2.z.enum(["paid", "unpaid", "voided"]).or(import_zod2.z.string()).nullish(),
  voidedAt: TsLike.nullish(),
  reversed: import_zod2.z.boolean().nullish(),
  reversedAt: TsLike.nullish(),
  reversalOf: import_zod2.z.string().nullish(),
  amountCents: import_zod2.z.coerce.number().int().nullish(),
  month: import_zod2.z.string().nullish(),
  // YYYY-MM
  note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
  ts: TsLike.nullish(),
  by: import_zod2.z.object({
    uid: import_zod2.z.string().nullish(),
    email: import_zod2.z.string().nullish(),
    name: import_zod2.z.string().nullish()
  }).partial().nullish(),
  byUid: import_zod2.z.string().nullish(),
  byName: import_zod2.z.string().nullish(),
  migratedFromSpendId: import_zod2.z.string().nullish(),
  migratedReversalOf: import_zod2.z.string().nullish(),
  customerNameAtSpend: import_zod2.z.string().nullish(),
  grantNameAtSpend: import_zod2.z.string().nullish(),
  lineItemLabelAtSpend: import_zod2.z.string().nullish(),
  paymentLabelAtSpend: import_zod2.z.string().nullish(),
  dueDate: ISO10ish.nullish(),
  date: ISO10ish.nullish(),
  paymentSnapshot: import_zod2.z.object({
    amount: import_zod2.z.coerce.number().nullish(),
    type: PaymentType.nullish(),
    lineItemId: import_zod2.z.string().nullish(),
    dueDate: ISO10ish.nullish(),
    dueMonth: import_zod2.z.string().nullish(),
    note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
    vendor: import_zod2.z.string().nullish(),
    comment: import_zod2.z.string().nullish()
  }).partial().nullish()
});
var PaymentsGenerateProjectionsBody = import_zod2.z.object({
  startDate: ISO10ish,
  months: import_zod2.z.coerce.number().int().positive(),
  monthlyAmount: import_zod2.z.coerce.number().positive(),
  deposit: import_zod2.z.coerce.number().nonnegative().optional()
});
var PaymentsRecalculateFutureSingleReq = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  newMonthlyAmount: import_zod2.z.coerce.number().positive(),
  projectionIds: import_zod2.z.array(import_zod2.z.string().min(1)).max(2e3).optional(),
  lineItemId: import_zod2.z.string().min(1).optional(),
  effectiveFrom: ISO10ish.optional(),
  // inclusive
  dryRun: import_zod2.z.boolean().optional()
});
var PaymentsRecalculateFutureGrantReq = import_zod2.z.object({
  grantId: import_zod2.z.string().min(1),
  newMonthlyAmount: import_zod2.z.coerce.number().positive(),
  lineItemId: import_zod2.z.string().min(1).optional(),
  effectiveFrom: ISO10ish.optional(),
  // inclusive
  dryRun: import_zod2.z.boolean().optional()
});
var PaymentsRecalculateFutureReq = import_zod2.z.union([
  PaymentsRecalculateFutureSingleReq,
  PaymentsRecalculateFutureGrantReq
]);
var PaymentsRecalcGrantProjectedBody = import_zod2.z.object({
  grantId: import_zod2.z.string().min(1),
  effectiveFrom: ISO10ish.optional(),
  // metadata only
  activeOnly: import_zod2.z.boolean().optional().default(true),
  // Ledger is the authoritative spend source. Accept only source=1.
  source: import_zod2.z.literal(1).optional().default(1),
  dryRun: import_zod2.z.boolean().optional()
});
var PaymentsAdjustSpendBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  spendId: import_zod2.z.string().min(1).optional(),
  // optional; backend resolves via paymentId if absent/stale
  paymentId: import_zod2.z.string().min(1).optional(),
  // alternative to spendId for subcollection lookup
  patch: import_zod2.z.object({
    amount: import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).optional(),
    type: PaymentType.optional(),
    lineItemId: import_zod2.z.string().min(1).optional(),
    dueDate: ISO10ish.optional(),
    // normalized to ISO10
    note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).optional(),
    vendor: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.null()]).optional(),
    comment: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.null()]).optional()
  }).default({}),
  reason: import_zod2.z.string().optional()
});
var PaymentProjectionInput = import_zod2.z.object({
  id: import_zod2.z.string().optional(),
  type: PaymentType,
  amount: import_zod2.z.coerce.number(),
  lineItemId: import_zod2.z.string().min(1),
  dueDate: ISO10ish.optional(),
  date: ISO10ish.optional(),
  // legacy alias accepted on input
  paid: import_zod2.z.boolean().nullish(),
  paidAt: ISO10ish.nullish(),
  // if you ever store full timestamps, switch this to TsLike
  paidFromGrant: import_zod2.z.boolean().nullish(),
  note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
  vendor: import_zod2.z.string().nullish(),
  comment: import_zod2.z.string().nullish(),
  compliance: PaymentCompliance.nullish(),
  rentCert: PaymentRentCert.nullish(),
  rentCertOptOut: import_zod2.z.boolean().nullish()
}).superRefine((v, ctx) => {
  const hasDue = !!v.dueDate;
  const hasDate = !!v.date;
  if (!hasDue && !hasDate) {
    ctx.addIssue({
      code: import_zod2.z.ZodIssueCode.custom,
      message: "PaymentProjectionInput requires dueDate or date",
      path: ["dueDate"]
    });
  }
  if (!Number.isFinite(Number(v.amount)) || Number(v.amount) <= 0) {
    ctx.addIssue({
      code: import_zod2.z.ZodIssueCode.custom,
      message: "amount must be a positive number",
      path: ["amount"]
    });
  }
});
var PaymentsAdjustProjectionsBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  payments: import_zod2.z.array(PaymentProjectionInput).default([]),
  replaceUnpaid: import_zod2.z.boolean().optional().default(true)
});
var PaymentsBulkCopyScheduleBody = import_zod2.z.object({
  sourceEnrollmentId: import_zod2.z.string().min(1),
  targetEnrollmentIds: import_zod2.z.array(import_zod2.z.string().min(1)).min(1),
  mode: import_zod2.z.enum(["replace", "merge"]).optional().default("replace"),
  includeTypes: import_zod2.z.array(import_zod2.z.string().min(1)).optional().nullable(),
  anchorByStartDate: import_zod2.z.boolean().optional().default(true)
});
var PaymentsSpendBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  paymentId: import_zod2.z.string().min(1),
  note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).optional(),
  reverse: import_zod2.z.boolean().optional().default(false),
  forceSync: import_zod2.z.boolean().optional().default(false),
  vendor: import_zod2.z.string().optional(),
  comment: import_zod2.z.string().optional()
});
var PaymentCompliancePatch = PaymentCompliance.partial();
var PaymentsUpdateComplianceBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  paymentId: import_zod2.z.string().min(1),
  // patch semantics: allow partial updates (also allows nullish because base schema does)
  patch: PaymentCompliancePatch
});
var RentCertToggle = import_zod2.z.enum(["notDue", "due", "completed", "effective"]);
var PaymentsRentCertSetBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  paymentId: import_zod2.z.string().min(1),
  status: RentCertToggle.optional(),
  dueDate: ISO10ish.nullish()
});
var PaymentsDeleteRowsBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  paymentIds: import_zod2.z.array(import_zod2.z.string().min(1)).max(500).optional(),
  deleteAll: import_zod2.z.boolean().optional().default(false),
  preservePaid: import_zod2.z.boolean().optional().default(true),
  updateBudgets: import_zod2.z.boolean().optional().default(false),
  removeSpends: import_zod2.z.boolean().optional().default(true),
  reverseLedger: import_zod2.z.boolean().optional().default(true)
});
var PaymentsUpsertProjectionsBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  payments: import_zod2.z.array(PaymentProjectionInput).default([])
});
var PaymentsRecalculateFutureResp = import_zod2.z.union([
  import_zod2.z.object({
    mode: import_zod2.z.literal("single"),
    fromISO: ISO10ish,
    dryRun: import_zod2.z.boolean(),
    id: import_zod2.z.string(),
    payments: import_zod2.z.array(Payment).optional(),
    deltaByLI: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.number()).optional(),
    noChange: import_zod2.z.literal(true).optional(),
    preview: import_zod2.z.object({
      deltaByLI: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.number()),
      willUpdate: import_zod2.z.boolean()
    }).optional(),
    sample: import_zod2.z.array(Payment).optional()
  }),
  import_zod2.z.object({
    mode: import_zod2.z.literal("grant"),
    fromISO: ISO10ish,
    dryRun: import_zod2.z.boolean(),
    grantId: import_zod2.z.string(),
    stats: import_zod2.z.object({
      touched: import_zod2.z.number(),
      noChange: import_zod2.z.number(),
      errors: import_zod2.z.number()
    }),
    summaries: import_zod2.z.array(import_zod2.z.object({
      enrollmentId: import_zod2.z.string(),
      deltaByLI: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.number())
    }))
  })
]);
var PaymentsRecalcGrantProjectedResp = import_zod2.z.object({
  totals: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()),
  warnings: import_zod2.z.array(import_zod2.z.string()),
  dryRun: import_zod2.z.boolean(),
  effectiveFromISO: ISO10ish,
  activeOnly: import_zod2.z.boolean(),
  source: import_zod2.z.literal(1)
});
var PaymentsDeleteRowsResp = import_zod2.z.object({
  ok: import_zod2.z.boolean(),
  enrollmentId: import_zod2.z.string(),
  deletedPaymentIds: import_zod2.z.array(import_zod2.z.string()),
  skippedPaidIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  reversedSpendIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  removedSpendSubdocIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  counts: import_zod2.z.object({
    deletedPayments: import_zod2.z.number().int().nonnegative(),
    skippedPaid: import_zod2.z.number().int().nonnegative(),
    reversedSpends: import_zod2.z.number().int().nonnegative(),
    removedSpendSubdocs: import_zod2.z.number().int().nonnegative()
  })
});

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

// src/enrollments.ts
var EnrollmentCompliance = import_zod2.z.object({
  caseworthyEntryComplete: import_zod2.z.boolean().nullish(),
  caseworthyExitComplete: import_zod2.z.boolean().nullish(),
  hmisEntryComplete: import_zod2.z.boolean().nullish(),
  hmisExitComplete: import_zod2.z.boolean().nullish()
});
var EnrollmentServiceStatus = import_zod2.z.enum(["active", "paused", "expired"]);
var EnrollmentMedicaidStatus = import_zod2.z.enum(["active", "closed"]);
var EnrollmentMedicaid = import_zod2.z.object({
  status: EnrollmentMedicaidStatus.default("active"),
  closedDate: import_zod2.z.string().trim().nullable().optional(),
  reopenedDate: import_zod2.z.string().trim().nullable().optional(),
  note: import_zod2.z.string().trim().nullable().optional()
}).passthrough();
var EnrollmentActions = import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown());
var EnrollmentActionHistoryEventType = import_zod2.z.enum([
  "actionChanged",
  "serviceStatusChanged",
  "medicaidStatusChanged",
  "renewalReminderCreated",
  "enrollmentExpired",
  "automationFailed"
]);
var EnrollmentActionHistoryRecord = import_zod2.z.object({
  id: Id.optional(),
  eventType: EnrollmentActionHistoryEventType,
  actionId: import_zod2.z.string().trim().nullable().optional(),
  actorType: import_zod2.z.enum(["user", "system", "automation"]).default("user"),
  actorId: import_zod2.z.string().trim().nullable().optional(),
  before: import_zod2.z.unknown().optional(),
  after: import_zod2.z.unknown().optional(),
  note: import_zod2.z.string().trim().nullable().optional(),
  createdAt: TsLike.nullish().optional()
}).passthrough();
var EnrollmentActionsApplyBody = import_zod2.z.object({
  enrollmentId: Id,
  actionId: import_zod2.z.string().trim().min(1).optional(),
  value: import_zod2.z.unknown().optional(),
  serviceStatus: EnrollmentServiceStatus.optional(),
  medicaid: EnrollmentMedicaid.partial().optional(),
  note: import_zod2.z.string().trim().nullable().optional()
}).passthrough().refine(
  (v) => !!v.serviceStatus || !!v.medicaid || typeof v.actionId === "string" && Object.prototype.hasOwnProperty.call(v, "value"),
  { message: "missing_action_update" }
);
var ScheduleMetaV1 = import_zod2.z.object({
  version: import_zod2.z.literal(1),
  rentPlans: import_zod2.z.array(
    import_zod2.z.object({
      firstDue: import_zod2.z.string(),
      months: import_zod2.z.string(),
      monthly: import_zod2.z.string(),
      lineItemId: import_zod2.z.string(),
      vendor: import_zod2.z.string().optional(),
      comment: import_zod2.z.string().optional()
    })
  ),
  utilPlans: import_zod2.z.array(
    import_zod2.z.object({
      firstDue: import_zod2.z.string(),
      months: import_zod2.z.string(),
      monthly: import_zod2.z.string(),
      lineItemId: import_zod2.z.string(),
      vendor: import_zod2.z.string().optional(),
      comment: import_zod2.z.string().optional()
    })
  ),
  deposit: import_zod2.z.object({
    enabled: import_zod2.z.boolean(),
    date: import_zod2.z.string(),
    amount: import_zod2.z.string(),
    lineItemId: import_zod2.z.string(),
    vendor: import_zod2.z.string().optional(),
    comment: import_zod2.z.string().optional()
  }).optional(),
  prorated: import_zod2.z.object({
    enabled: import_zod2.z.boolean(),
    date: import_zod2.z.string(),
    amount: import_zod2.z.string(),
    lineItemId: import_zod2.z.string(),
    vendor: import_zod2.z.string().optional(),
    comment: import_zod2.z.string().optional()
  }).optional(),
  services: import_zod2.z.array(
    import_zod2.z.object({
      id: import_zod2.z.string(),
      note: import_zod2.z.string(),
      date: import_zod2.z.string(),
      amount: import_zod2.z.string(),
      lineItemId: import_zod2.z.string(),
      vendor: import_zod2.z.string().optional(),
      comment: import_zod2.z.string().optional()
    })
  ),
  migratedOut: import_zod2.z.object({
    toEnrollmentId: import_zod2.z.string(),
    toGrantId: import_zod2.z.string(),
    cutover: import_zod2.z.string()
  }).nullable().optional(),
  /** ISO timestamp of the last manual projection edit after the initial build. Cleared on full rebuild. */
  editedAt: import_zod2.z.string().optional()
});
var ScheduleMetaMigrated = import_zod2.z.object({
  mode: import_zod2.z.literal("migrated"),
  cutover: import_zod2.z.string(),
  defaultEditMode: import_zod2.z.enum(["keepManual", "rebuildUnpaid"]).optional(),
  fromEnrollmentId: import_zod2.z.string(),
  fromGrantId: import_zod2.z.string(),
  lineItemMapSnapshot: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
  migratedOut: import_zod2.z.object({
    toEnrollmentId: import_zod2.z.string(),
    toGrantId: import_zod2.z.string(),
    cutover: import_zod2.z.string()
  }).nullable().optional()
});
var ScheduleMeta = import_zod2.z.union([ScheduleMetaMigrated, ScheduleMetaV1]);
var TaskScheduleMeta = import_zod2.z.object({
  version: import_zod2.z.literal(1),
  defs: import_zod2.z.array(import_zod2.z.unknown()).default([]),
  savedAt: TsLike.nullish().optional()
}).passthrough();
var EnrollmentContinuity = import_zod2.z.object({
  continuumId: Id,
  kind: import_zod2.z.literal("grantCycle").default("grantCycle"),
  previousEnrollmentId: Id.nullable().optional(),
  nextEnrollmentId: Id.nullable().optional(),
  rolloverSource: import_zod2.z.enum(["admin", "migration", "backfill"]).nullish(),
  cutoffDate: ISO10.nullish()
}).passthrough();
var EnrollmentClientAllocation = import_zod2.z.object({
  amount: import_zod2.z.number().min(0).nullable().optional(),
  note: import_zod2.z.string().trim().max(1e3).nullable().optional(),
  updatedAt: TsLike.nullish().optional(),
  updatedBy: import_zod2.z.string().trim().nullable().optional()
}).passthrough();
var EnrollmentProgramAutomation = import_zod2.z.object({
  targetGrantId: Id.nullish(),
  sourceEnrollmentIds: import_zod2.z.array(Id).default([]),
  createdByRule: import_zod2.z.boolean().default(false)
}).passthrough();
var EnrollmentUnenrollmentReview = import_zod2.z.object({
  required: import_zod2.z.boolean().default(false),
  reason: import_zod2.z.string().trim().nullable().optional(),
  sourceEnrollmentIds: import_zod2.z.array(Id).default([]),
  flaggedAt: TsLike.nullish().optional(),
  clearedAt: TsLike.nullish().optional()
}).passthrough();
var Enrollment = import_zod2.z.object({
  id: Id,
  grantId: import_zod2.z.string(),
  customerId: import_zod2.z.string(),
  // org/team access (server authoritative)
  orgId: import_zod2.z.string().trim().min(1).nullish(),
  teamIds: import_zod2.z.array(import_zod2.z.string().trim().min(1)).max(10).optional(),
  startDate: import_zod2.z.string().nullable().optional(),
  // YYYY-MM-DD
  endDate: import_zod2.z.string().nullable().optional(),
  migratedFrom: import_zod2.z.object({ enrollmentId: import_zod2.z.string(), grantId: import_zod2.z.string(), cutover: import_zod2.z.string() }).nullable().optional(),
  migratedTo: import_zod2.z.object({ enrollmentId: import_zod2.z.string(), grantId: import_zod2.z.string(), cutover: import_zod2.z.string() }).nullable().optional(),
  continuity: EnrollmentContinuity.nullish(),
  clientAllocation: EnrollmentClientAllocation.nullish(),
  programAutomation: EnrollmentProgramAutomation.nullish(),
  unenrollmentReview: EnrollmentUnenrollmentReview.nullish(),
  active: import_zod2.z.boolean().nullable().optional(),
  status: import_zod2.z.enum(["active", "deleted", "closed"]).nullable().optional(),
  deleted: import_zod2.z.boolean().nullable().optional(),
  // Service status is separate from enrollment lifecycle. Medicaid loss can pause service
  // while the enrollment lifecycle remains active for authorization/renewal tracking.
  serviceStatus: EnrollmentServiceStatus.nullable().optional(),
  medicaid: EnrollmentMedicaid.nullish(),
  actions: EnrollmentActions.nullish(),
  // Operational stage (waitlist → tenant, etc.) kept separate from lifecycle status.
  stage: import_zod2.z.enum(["waitlisted", "offered", "tenant", "exited"]).nullable().optional(),
  // First-class priority snapshot for waitlist ordering (computed from an assessment).
  priorityScore: import_zod2.z.number().nullable().optional(),
  priorityLevel: import_zod2.z.string().nullable().optional(),
  priorityAt: TsLike.nullish().optional(),
  priorityTemplateId: import_zod2.z.string().nullable().optional(),
  priorityTemplateVersion: import_zod2.z.number().int().nullable().optional(),
  priorityAssessmentId: import_zod2.z.string().nullable().optional(),
  // Optional generic latest-results cache (templateId → small snapshot)
  latestAssessments: import_zod2.z.record(
    import_zod2.z.string(),
    import_zod2.z.object({
      at: TsLike.nullish().optional(),
      assessmentId: import_zod2.z.string().nullable().optional(),
      templateVersion: import_zod2.z.number().int().nullable().optional(),
      computed: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).optional()
    }).passthrough()
  ).nullish().optional(),
  compliance: EnrollmentCompliance.nullish(),
  customerName: import_zod2.z.string().nullable().optional(),
  clientName: import_zod2.z.string().nullable().optional(),
  grantName: import_zod2.z.string().nullable().optional(),
  name: import_zod2.z.string().nullable().optional(),
  population: Population.optional(),
  caseManagerId: import_zod2.z.string().nullable().optional(),
  caseManagerName: import_zod2.z.string().nullable().optional(),
  maxAssistanceMonthsAtEnrollment: import_zod2.z.number().int().min(1).max(240).nullable().optional(),
  maxAssistanceCutoffDate: import_zod2.z.string().nullable().optional(),
  // --- Finance (kept here for now; payments & spends also live in dedicated features)
  payments: import_zod2.z.array(Payment).nullable().optional(),
  spends: import_zod2.z.array(Spend).nullable().optional(),
  // --- Tasks (single model for tasks & compliance)
  taskSchedule: import_zod2.z.array(TaskScheduleItem).nullable().optional(),
  taskStats: TaskStats.nullish(),
  scheduleMeta: ScheduleMeta.nullish(),
  taskScheduleMeta: TaskScheduleMeta.nullish(),
  /**
   * Whether to auto-generate the task schedule from grant.tasks when this
   * enrollment is created.  Defaults to true when absent.
   * Set to false to enroll the client without creating managed tasks.
   */
  generateTaskSchedule: import_zod2.z.boolean().default(true),
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike
  // required by convention
});
var EnrollmentGetByIdQuery = import_zod2.z.object({ id: Id }).passthrough();
var EnrollmentsListQuery = import_zod2.z.object({
  active: BoolLike.optional(),
  customerId: Id.optional(),
  grantId: Id.optional(),
  limit: import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).optional(),
  startAfter: import_zod2.z.string().optional(),
  status: import_zod2.z.string().optional()
}).passthrough();
var EnrollmentsBackfillNamesBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: BoolFromLike.optional(),
  dryRun: BoolFromLike.optional()
}).passthrough();
var EnrollmentsUpsertBody = import_zod2.z.union([
  Enrollment.partial(),
  import_zod2.z.array(Enrollment.partial()).min(1)
]);
var EnrollmentsPatchRow = import_zod2.z.object({
  id: Id,
  patch: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).optional(),
  unset: import_zod2.z.array(import_zod2.z.string()).optional()
}).refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var EnrollmentsPatchBody = import_zod2.z.union([
  EnrollmentsPatchRow,
  import_zod2.z.array(EnrollmentsPatchRow).min(1)
]);
var EnrollmentDeleteIdObj = import_zod2.z.object({
  id: Id.optional(),
  ids: Ids.optional()
}).refine(
  (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0,
  { message: "missing_id_or_ids" }
);
var EnrollmentsDeleteBody = import_zod2.z.union([
  Id,
  Ids,
  EnrollmentDeleteIdObj.extend({
    voidPaid: import_zod2.z.boolean().optional(),
    hard: import_zod2.z.boolean().optional(),
    unlinkSpends: import_zod2.z.boolean().optional()
  })
]);
var EnrollmentsAdminDeleteBody = import_zod2.z.union([
  Id,
  Ids,
  EnrollmentDeleteIdObj.extend({
    voidPaid: import_zod2.z.boolean().optional(),
    mode: import_zod2.z.enum(["safe", "hard"]).optional(),
    purgeSpends: import_zod2.z.boolean().optional(),
    purgeSubcollections: import_zod2.z.boolean().optional(),
    unlinkSpends: import_zod2.z.boolean().optional()
  })
]);
var EnrollmentsDeleteResultItem = import_zod2.z.object({
  id: import_zod2.z.string(),
  ok: import_zod2.z.literal(true).optional(),
  error: import_zod2.z.string().optional()
});
var EnrollmentsDeleteCoreOutput = import_zod2.z.object({
  ok: import_zod2.z.boolean(),
  results: import_zod2.z.array(EnrollmentsDeleteResultItem)
});
var EnrollmentsDeleteResp = EnrollmentsDeleteCoreOutput.extend({
  deleted: import_zod2.z.literal(true)
});
var EnrollmentsAdminDeleteResp = EnrollmentsDeleteCoreOutput.extend({
  deleted: import_zod2.z.literal(true),
  mode: import_zod2.z.enum(["safe", "hard"]),
  purged: import_zod2.z.object({
    spends: import_zod2.z.number().int().nonnegative(),
    enrollments: import_zod2.z.number().int().nonnegative()
  }).optional(),
  purgeErrors: import_zod2.z.array(import_zod2.z.object({ id: import_zod2.z.string(), error: import_zod2.z.string() })).optional()
});
var EnrollmentsEnrollCustomerBody = import_zod2.z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return v;
    const o = { ...v };
    if (o.grantId == null && o.grant_id != null) o.grantId = o.grant_id;
    if (o.customerId == null && o.clientId != null) o.customerId = o.clientId;
    if (o.customerId == null && o.customer_id != null) o.customerId = o.customer_id;
    return o;
  },
  import_zod2.z.object({
    grantId: IdLike,
    customerId: IdLike,
    extra: JsonObjLike.default({})
  }).passthrough()
);
var EnrollmentsBulkEnrollBody = import_zod2.z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return v;
    const o = { ...v };
    if (o.grantId == null && o.grant_id != null) o.grantId = o.grant_id;
    if (o.customerIds == null && o.clientIds != null) o.customerIds = o.clientIds;
    if (o.perCustomerExtra == null && o.perClientExtra != null) o.perCustomerExtra = o.perClientExtra;
    return o;
  },
  import_zod2.z.object({
    grantId: IdLike,
    customerIds: import_zod2.z.preprocess((v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
      return v;
    }, import_zod2.z.array(IdLike).min(1)),
    // options used by the handler (normalized + defaulted)
    skipIfExists: BoolFromLike.default(true),
    existsMode: import_zod2.z.enum(["nonDeleted", "activeOnly"]).default("nonDeleted"),
    // payloads used by the handler (normalized + defaulted)
    extra: JsonObjLike.default({}),
    perCustomerExtra: import_zod2.z.preprocess((v) => {
      if (v && typeof v === "object") return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }
      return v;
    }, import_zod2.z.record(import_zod2.z.string(), JsonObjLike).default({}))
  }).passthrough()
);
var EnrollmentsCheckOverlapsQuery = import_zod2.z.object({
  customerId: Id.optional(),
  clientId: Id.optional(),
  grantIds: GrantIdsLike.optional(),
  window: import_zod2.z.object({ start: ISO10.optional(), end: ISO10.optional() }).optional(),
  activeOnly: import_zod2.z.boolean().optional()
}).passthrough();
var EnrollmentLikeForDual = import_zod2.z.object({
  customerId: Id.optional(),
  clientId: Id.optional(),
  status: import_zod2.z.string().optional()
}).passthrough();
var EnrollmentsCheckDualQuery = import_zod2.z.object({
  enrollments: import_zod2.z.array(EnrollmentLikeForDual).min(1)
}).passthrough();
var EnrollmentsMigrateBody = import_zod2.z.object({
  enrollmentId: Id,
  toGrantId: Id,
  cutoverDate: ISO10,
  lineItemMap: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
  closeSource: import_zod2.z.boolean().optional(),
  moveSpends: import_zod2.z.boolean().optional(),
  moveTasks: import_zod2.z.boolean().optional(),
  preserveTaskIds: import_zod2.z.boolean().optional(),
  movePaidPayments: import_zod2.z.boolean().optional(),
  rebuildScheduleMeta: import_zod2.z.boolean().optional(),
  closeSourceTaskMode: import_zod2.z.enum(["complete", "delete"]).optional(),
  closeSourcePaymentMode: import_zod2.z.enum(["spendUnpaid", "deleteUnpaid", "keep"]).optional()
}).passthrough();
var EnrollmentsContinuumSummaryQuery = import_zod2.z.object({ enrollmentId: Id }).passthrough();
var EnrollmentsAllocationSetBody = import_zod2.z.object({
  enrollmentId: Id,
  amount: import_zod2.z.number().min(0).nullable(),
  note: import_zod2.z.string().trim().max(1e3).nullable().optional()
}).passthrough();
var EnrollmentsCycleRolloverPreviewBody = import_zod2.z.object({
  grantId: Id,
  cutoverDate: ISO10.optional()
}).passthrough();
var EnrollmentCycleRolloverPreviewItem = import_zod2.z.object({
  enrollmentId: Id,
  customerId: Id,
  customerName: import_zod2.z.string().nullable(),
  eligible: import_zod2.z.boolean(),
  blockers: import_zod2.z.array(import_zod2.z.string()),
  warnings: import_zod2.z.array(import_zod2.z.string()),
  futureUnpaidPayments: import_zod2.z.number().int().nonnegative(),
  futureOpenReminders: import_zod2.z.number().int().nonnegative(),
  calculatedAllocation: import_zod2.z.number().nonnegative()
});
var EnrollmentsCycleRolloverRunBody = EnrollmentsCycleRolloverPreviewBody.extend({
  enrollmentIds: import_zod2.z.array(Id).min(1).max(500).optional(),
  confirm: import_zod2.z.literal("ROLLOVER")
});
var EnrollmentsLinkedProgramsReconcileBody = import_zod2.z.object({
  grantIds: import_zod2.z.array(Id).max(50).optional(),
  dryRun: import_zod2.z.boolean().default(true)
}).passthrough();
var EnrollmentsUndoMigrationBody = import_zod2.z.object({
  migrationId: Id
}).passthrough();
var EnrollmentsAdminReverseLedgerEntryBody = import_zod2.z.object({
  ledgerId: Id,
  mode: import_zod2.z.enum(["ledger", "budget", "both"]).optional(),
  note: import_zod2.z.string().optional()
}).passthrough();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Enrollment,
  EnrollmentActionHistoryEventType,
  EnrollmentActionHistoryRecord,
  EnrollmentActions,
  EnrollmentActionsApplyBody,
  EnrollmentClientAllocation,
  EnrollmentCompliance,
  EnrollmentContinuity,
  EnrollmentCycleRolloverPreviewItem,
  EnrollmentGetByIdQuery,
  EnrollmentMedicaid,
  EnrollmentMedicaidStatus,
  EnrollmentProgramAutomation,
  EnrollmentServiceStatus,
  EnrollmentUnenrollmentReview,
  EnrollmentsAdminDeleteBody,
  EnrollmentsAdminDeleteResp,
  EnrollmentsAdminReverseLedgerEntryBody,
  EnrollmentsAllocationSetBody,
  EnrollmentsBackfillNamesBody,
  EnrollmentsBulkEnrollBody,
  EnrollmentsCheckDualQuery,
  EnrollmentsCheckOverlapsQuery,
  EnrollmentsContinuumSummaryQuery,
  EnrollmentsCycleRolloverPreviewBody,
  EnrollmentsCycleRolloverRunBody,
  EnrollmentsDeleteBody,
  EnrollmentsDeleteCoreOutput,
  EnrollmentsDeleteResp,
  EnrollmentsDeleteResultItem,
  EnrollmentsEnrollCustomerBody,
  EnrollmentsLinkedProgramsReconcileBody,
  EnrollmentsListQuery,
  EnrollmentsMigrateBody,
  EnrollmentsPatchBody,
  EnrollmentsPatchRow,
  EnrollmentsUndoMigrationBody,
  EnrollmentsUpsertBody,
  ScheduleMeta,
  ScheduleMetaMigrated,
  ScheduleMetaV1,
  TaskScheduleMeta
});
