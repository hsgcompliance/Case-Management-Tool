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

// src/payments.ts
var payments_exports = {};
__export(payments_exports, {
  ComplianceCheckItem: () => ComplianceCheckItem,
  Payment: () => Payment,
  PaymentCompliance: () => PaymentCompliance,
  PaymentCompliancePatch: () => PaymentCompliancePatch,
  PaymentEntity: () => PaymentEntity,
  PaymentProjectionInput: () => PaymentProjectionInput,
  PaymentRentCert: () => PaymentRentCert,
  PaymentsAdjustProjectionsBody: () => PaymentsAdjustProjectionsBody,
  PaymentsAdjustSpendBody: () => PaymentsAdjustSpendBody,
  PaymentsBulkCopyScheduleBody: () => PaymentsBulkCopyScheduleBody,
  PaymentsDeleteRowsBody: () => PaymentsDeleteRowsBody,
  PaymentsDeleteRowsResp: () => PaymentsDeleteRowsResp,
  PaymentsGenerateProjectionsBody: () => PaymentsGenerateProjectionsBody,
  PaymentsRecalcGrantProjectedBody: () => PaymentsRecalcGrantProjectedBody,
  PaymentsRecalcGrantProjectedResp: () => PaymentsRecalcGrantProjectedResp,
  PaymentsRecalculateFutureGrantReq: () => PaymentsRecalculateFutureGrantReq,
  PaymentsRecalculateFutureReq: () => PaymentsRecalculateFutureReq,
  PaymentsRecalculateFutureResp: () => PaymentsRecalculateFutureResp,
  PaymentsRecalculateFutureSingleReq: () => PaymentsRecalculateFutureSingleReq,
  PaymentsRentCertSetBody: () => PaymentsRentCertSetBody,
  PaymentsSpendBody: () => PaymentsSpendBody,
  PaymentsUpdateComplianceBody: () => PaymentsUpdateComplianceBody,
  PaymentsUpdateGrantBudgetBody: () => PaymentsUpdateGrantBudgetBody,
  PaymentsUpsertProjectionsBody: () => PaymentsUpsertProjectionsBody,
  RentCertStatus: () => RentCertStatus,
  RentCertToggle: () => RentCertToggle,
  Spend: () => Spend,
  SpendSource: () => SpendSource
});
module.exports = __toCommonJS(payments_exports);

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
  rentCert: PaymentRentCert.nullish()
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
  rentCert: PaymentRentCert.nullish()
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
var PaymentsUpdateGrantBudgetBody = PaymentsRecalcGrantProjectedBody;
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ComplianceCheckItem,
  Payment,
  PaymentCompliance,
  PaymentCompliancePatch,
  PaymentEntity,
  PaymentProjectionInput,
  PaymentRentCert,
  PaymentsAdjustProjectionsBody,
  PaymentsAdjustSpendBody,
  PaymentsBulkCopyScheduleBody,
  PaymentsDeleteRowsBody,
  PaymentsDeleteRowsResp,
  PaymentsGenerateProjectionsBody,
  PaymentsRecalcGrantProjectedBody,
  PaymentsRecalcGrantProjectedResp,
  PaymentsRecalculateFutureGrantReq,
  PaymentsRecalculateFutureReq,
  PaymentsRecalculateFutureResp,
  PaymentsRecalculateFutureSingleReq,
  PaymentsRentCertSetBody,
  PaymentsSpendBody,
  PaymentsUpdateComplianceBody,
  PaymentsUpdateGrantBudgetBody,
  PaymentsUpsertProjectionsBody,
  RentCertStatus,
  RentCertToggle,
  Spend,
  SpendSource
});
