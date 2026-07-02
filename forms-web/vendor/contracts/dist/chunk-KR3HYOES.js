import {
  ISO10,
  TsLike,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

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
var ISO10ish = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return s;
  return s.length >= 10 ? s.slice(0, 10) : s;
}, ISO10);
var PaymentType = z.enum(["monthly", "deposit", "prorated", "service", "arrears"]);
var ComplianceCheckItem = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  done: z.boolean().default(false),
  doneAt: z.string().nullish(),
  // ISO timestamp when marked done
  doneBy: z.string().nullish()
  // uid or display name of who marked it done
});
var PaymentCompliance = z.object({
  hmisComplete: z.boolean().nullish(),
  caseworthyComplete: z.boolean().nullish(),
  items: z.array(ComplianceCheckItem).default([]),
  status: z.string().nullish(),
  note: z.string().nullish()
});
var RentCertStatus = z.enum(["due", "completed", "effective"]);
var PaymentRentCert = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["calculated", "manual"]).default("calculated"),
  taskIds: z.array(z.string()).default([]),
  status: RentCertStatus.default("due")
}).passthrough();
var Payment = z.object({
  id: z.string().optional(),
  // core
  type: PaymentType,
  amount: z.coerce.number(),
  dueDate: ISO10ish,
  // YYYY-MM-DD
  lineItemId: z.string().nullable().optional(),
  // status
  paid: z.boolean().nullish(),
  paidAt: ISO10ish.nullish(),
  // if you ever store full timestamps, switch this to TsLike
  paidFromGrant: z.boolean().nullish(),
  void: z.boolean().nullish(),
  // notes / vendor
  note: z.union([z.string(), z.array(z.string())]).nullish(),
  vendor: z.string().nullish(),
  comment: z.string().nullish(),
  notifyCM: z.boolean().nullish(),
  // used by inbox trigger logic
  // compliance
  compliance: PaymentCompliance.nullish(),
  rentCert: PaymentRentCert.nullish()
});
var PaymentEntity = Payment.extend({
  id: z.string().min(1)
});
var SpendSource = z.enum([
  "enrollment",
  // current default for enrollment-level spends
  "card",
  // future credit-card feed
  "org",
  // future org/program-wide spend
  "manual"
  // admin/manual adjustment
]);
var Spend = z.object({
  id: z.string(),
  // Required
  paymentId: z.string(),
  lineItemId: z.string().nullable(),
  amount: z.coerce.number(),
  // +spend / -reversal
  // Metadata
  source: SpendSource.optional(),
  orgId: z.string().nullish(),
  grantId: z.string().nullish(),
  enrollmentId: z.string().nullish(),
  customerId: z.string().nullish(),
  caseManagerId: z.string().nullish(),
  paid: z.boolean().nullish(),
  status: z.enum(["paid", "unpaid", "voided"]).or(z.string()).nullish(),
  voidedAt: TsLike.nullish(),
  reversed: z.boolean().nullish(),
  reversedAt: TsLike.nullish(),
  reversalOf: z.string().nullish(),
  amountCents: z.coerce.number().int().nullish(),
  month: z.string().nullish(),
  // YYYY-MM
  note: z.union([z.string(), z.array(z.string())]).nullish(),
  ts: TsLike.nullish(),
  by: z.object({
    uid: z.string().nullish(),
    email: z.string().nullish(),
    name: z.string().nullish()
  }).partial().nullish(),
  byUid: z.string().nullish(),
  byName: z.string().nullish(),
  migratedFromSpendId: z.string().nullish(),
  migratedReversalOf: z.string().nullish(),
  customerNameAtSpend: z.string().nullish(),
  grantNameAtSpend: z.string().nullish(),
  lineItemLabelAtSpend: z.string().nullish(),
  paymentLabelAtSpend: z.string().nullish(),
  dueDate: ISO10ish.nullish(),
  date: ISO10ish.nullish(),
  paymentSnapshot: z.object({
    amount: z.coerce.number().nullish(),
    type: PaymentType.nullish(),
    lineItemId: z.string().nullish(),
    dueDate: ISO10ish.nullish(),
    dueMonth: z.string().nullish(),
    note: z.union([z.string(), z.array(z.string())]).nullish(),
    vendor: z.string().nullish(),
    comment: z.string().nullish()
  }).partial().nullish()
});
var PaymentsGenerateProjectionsBody = z.object({
  startDate: ISO10ish,
  months: z.coerce.number().int().positive(),
  monthlyAmount: z.coerce.number().positive(),
  deposit: z.coerce.number().nonnegative().optional()
});
var PaymentsRecalculateFutureSingleReq = z.object({
  enrollmentId: z.string().min(1),
  newMonthlyAmount: z.coerce.number().positive(),
  projectionIds: z.array(z.string().min(1)).max(2e3).optional(),
  lineItemId: z.string().min(1).optional(),
  effectiveFrom: ISO10ish.optional(),
  // inclusive
  dryRun: z.boolean().optional()
});
var PaymentsRecalculateFutureGrantReq = z.object({
  grantId: z.string().min(1),
  newMonthlyAmount: z.coerce.number().positive(),
  lineItemId: z.string().min(1).optional(),
  effectiveFrom: ISO10ish.optional(),
  // inclusive
  dryRun: z.boolean().optional()
});
var PaymentsRecalculateFutureReq = z.union([
  PaymentsRecalculateFutureSingleReq,
  PaymentsRecalculateFutureGrantReq
]);
var PaymentsRecalcGrantProjectedBody = z.object({
  grantId: z.string().min(1),
  effectiveFrom: ISO10ish.optional(),
  // metadata only
  activeOnly: z.boolean().optional().default(true),
  // Ledger is the authoritative spend source. Accept only source=1.
  source: z.literal(1).optional().default(1),
  dryRun: z.boolean().optional()
});
var PaymentsAdjustSpendBody = z.object({
  enrollmentId: z.string().min(1),
  spendId: z.string().min(1).optional(),
  // optional; backend resolves via paymentId if absent/stale
  paymentId: z.string().min(1).optional(),
  // alternative to spendId for subcollection lookup
  patch: z.object({
    amount: z.union([z.number(), z.string()]).optional(),
    type: PaymentType.optional(),
    lineItemId: z.string().min(1).optional(),
    dueDate: ISO10ish.optional(),
    // normalized to ISO10
    note: z.union([z.string(), z.array(z.string())]).optional(),
    vendor: z.union([z.string(), z.null()]).optional(),
    comment: z.union([z.string(), z.null()]).optional()
  }).default({}),
  reason: z.string().optional()
});
var PaymentProjectionInput = z.object({
  id: z.string().optional(),
  type: PaymentType,
  amount: z.coerce.number(),
  lineItemId: z.string().min(1),
  dueDate: ISO10ish.optional(),
  date: ISO10ish.optional(),
  // legacy alias accepted on input
  paid: z.boolean().nullish(),
  paidAt: ISO10ish.nullish(),
  // if you ever store full timestamps, switch this to TsLike
  paidFromGrant: z.boolean().nullish(),
  note: z.union([z.string(), z.array(z.string())]).nullish(),
  vendor: z.string().nullish(),
  comment: z.string().nullish(),
  compliance: PaymentCompliance.nullish(),
  rentCert: PaymentRentCert.nullish()
}).superRefine((v, ctx) => {
  const hasDue = !!v.dueDate;
  const hasDate = !!v.date;
  if (!hasDue && !hasDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "PaymentProjectionInput requires dueDate or date",
      path: ["dueDate"]
    });
  }
  if (!Number.isFinite(Number(v.amount)) || Number(v.amount) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "amount must be a positive number",
      path: ["amount"]
    });
  }
});
var PaymentsAdjustProjectionsBody = z.object({
  enrollmentId: z.string().min(1),
  payments: z.array(PaymentProjectionInput).default([]),
  replaceUnpaid: z.boolean().optional().default(true)
});
var PaymentsBulkCopyScheduleBody = z.object({
  sourceEnrollmentId: z.string().min(1),
  targetEnrollmentIds: z.array(z.string().min(1)).min(1),
  mode: z.enum(["replace", "merge"]).optional().default("replace"),
  includeTypes: z.array(z.string().min(1)).optional().nullable(),
  anchorByStartDate: z.boolean().optional().default(true)
});
var PaymentsSpendBody = z.object({
  enrollmentId: z.string().min(1),
  paymentId: z.string().min(1),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  reverse: z.boolean().optional().default(false),
  forceSync: z.boolean().optional().default(false),
  vendor: z.string().optional(),
  comment: z.string().optional()
});
var PaymentCompliancePatch = PaymentCompliance.partial();
var PaymentsUpdateComplianceBody = z.object({
  enrollmentId: z.string().min(1),
  paymentId: z.string().min(1),
  // patch semantics: allow partial updates (also allows nullish because base schema does)
  patch: PaymentCompliancePatch
});
var RentCertToggle = z.enum(["notDue", "due", "completed", "effective"]);
var PaymentsRentCertSetBody = z.object({
  enrollmentId: z.string().min(1),
  paymentId: z.string().min(1),
  status: RentCertToggle.optional(),
  dueDate: ISO10ish.nullish()
});
var PaymentsDeleteRowsBody = z.object({
  enrollmentId: z.string().min(1),
  paymentIds: z.array(z.string().min(1)).max(500).optional(),
  deleteAll: z.boolean().optional().default(false),
  preservePaid: z.boolean().optional().default(true),
  updateBudgets: z.boolean().optional().default(false),
  removeSpends: z.boolean().optional().default(true),
  reverseLedger: z.boolean().optional().default(true)
});
var PaymentsUpdateGrantBudgetBody = PaymentsRecalcGrantProjectedBody;
var PaymentsUpsertProjectionsBody = z.object({
  enrollmentId: z.string().min(1),
  payments: z.array(PaymentProjectionInput).default([])
});
var PaymentsRecalculateFutureResp = z.union([
  z.object({
    mode: z.literal("single"),
    fromISO: ISO10ish,
    dryRun: z.boolean(),
    id: z.string(),
    payments: z.array(Payment).optional(),
    deltaByLI: z.record(z.string(), z.number()).optional(),
    noChange: z.literal(true).optional(),
    preview: z.object({
      deltaByLI: z.record(z.string(), z.number()),
      willUpdate: z.boolean()
    }).optional(),
    sample: z.array(Payment).optional()
  }),
  z.object({
    mode: z.literal("grant"),
    fromISO: ISO10ish,
    dryRun: z.boolean(),
    grantId: z.string(),
    stats: z.object({
      touched: z.number(),
      noChange: z.number(),
      errors: z.number()
    }),
    summaries: z.array(z.object({
      enrollmentId: z.string(),
      deltaByLI: z.record(z.string(), z.number())
    }))
  })
]);
var PaymentsRecalcGrantProjectedResp = z.object({
  totals: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()),
  dryRun: z.boolean(),
  effectiveFromISO: ISO10ish,
  activeOnly: z.boolean(),
  source: z.literal(1)
});
var PaymentsDeleteRowsResp = z.object({
  ok: z.boolean(),
  enrollmentId: z.string(),
  deletedPaymentIds: z.array(z.string()),
  skippedPaidIds: z.array(z.string()).optional(),
  reversedSpendIds: z.array(z.string()).optional(),
  removedSpendSubdocIds: z.array(z.string()).optional(),
  counts: z.object({
    deletedPayments: z.number().int().nonnegative(),
    skippedPaid: z.number().int().nonnegative(),
    reversedSpends: z.number().int().nonnegative(),
    removedSpendSubdocs: z.number().int().nonnegative()
  })
});

export {
  ComplianceCheckItem,
  PaymentCompliance,
  RentCertStatus,
  PaymentRentCert,
  Payment,
  PaymentEntity,
  SpendSource,
  Spend,
  PaymentsGenerateProjectionsBody,
  PaymentsRecalculateFutureSingleReq,
  PaymentsRecalculateFutureGrantReq,
  PaymentsRecalculateFutureReq,
  PaymentsRecalcGrantProjectedBody,
  PaymentsAdjustSpendBody,
  PaymentProjectionInput,
  PaymentsAdjustProjectionsBody,
  PaymentsBulkCopyScheduleBody,
  PaymentsSpendBody,
  PaymentCompliancePatch,
  PaymentsUpdateComplianceBody,
  RentCertToggle,
  PaymentsRentCertSetBody,
  PaymentsDeleteRowsBody,
  PaymentsUpdateGrantBudgetBody,
  PaymentsUpsertProjectionsBody,
  PaymentsRecalculateFutureResp,
  PaymentsRecalcGrantProjectedResp,
  PaymentsDeleteRowsResp,
  payments_exports
};
