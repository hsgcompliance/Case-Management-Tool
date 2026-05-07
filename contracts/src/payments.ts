// contracts/src/payments.ts
import { z, TsLike, ISO10 } from "./core";

/* ============================================================================
   Helpers
============================================================================ */

/**
 * Accept either "YYYY-MM-DD" or full ISO string and normalize to ISO10.
 * Anything else => validation error.
 */
const ISO10ish = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return s;
  return s.length >= 10 ? s.slice(0, 10) : s;
}, ISO10);

const PaymentType = z.enum(["monthly", "deposit", "prorated", "service"]);

/* ============================================================================
   Payment schemas
============================================================================ */

/**
 * A single free-form compliance checklist item.
 * Use `key` as a stable machine identifier (e.g. "hmis", "w9_received").
 * `label` is the human-readable display string shown in the UI.
 */
export const ComplianceCheckItem = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  done: z.boolean().default(false),
  doneAt: z.string().nullish(),  // ISO timestamp when marked done
  doneBy: z.string().nullish(),  // uid or display name of who marked it done
});
export type TComplianceCheckItem = z.infer<typeof ComplianceCheckItem>;

/**
 * Flexible compliance checklist attached to a payment.
 * `hmisComplete` / `caseworthyComplete` are the canonical built-in compliance flags read by
 * inbox triggers and the UI. They must stay as first-class boolean fields so that all existing
 * read paths (triggers.ts, inboxCards.tsx, CustomerPaymentsTable.tsx) continue to work.
 * `items` is an optional free-form list for additional custom checklist steps.
 * `status` is a free-form status string (e.g. "approved", "pending", "hold").
 * `note` is a free-form note.
 */
export const PaymentCompliance = z.object({
  hmisComplete: z.boolean().nullish(),
  caseworthyComplete: z.boolean().nullish(),
  items: z.array(ComplianceCheckItem).default([]),
  status: z.string().nullish(),
  note: z.string().nullish(),
});

/**
 * Scheduled/actual payment row stored on an enrollment.
 * NOTE: id is optional because some inbound operations accept "schedule rows" without ids.
 */
export const Payment = z.object({
  id: z.string().optional(),

  // core
  type: PaymentType,
  amount: z.coerce.number(),
  dueDate: ISO10ish, // YYYY-MM-DD
  lineItemId: z.string().nullable().optional(),

  // status
  paid: z.boolean().nullish(),
  paidAt: ISO10ish.nullish(), // if you ever store full timestamps, switch this to TsLike
  paidFromGrant: z.boolean().nullish(),
  void: z.boolean().nullish(),

  // notes / vendor
  note: z.union([z.string(), z.array(z.string())]).nullish(),
  vendor: z.string().nullish(),
  comment: z.string().nullish(),
  notifyCM: z.boolean().nullish(), // used by inbox trigger logic

  // compliance
  compliance: PaymentCompliance.nullish(),
});

export type TPaymentCompliance = z.infer<typeof PaymentCompliance>;
export type TPayment = z.infer<typeof Payment>;

/**
 * Output/payment entity shape (responses + stored canonical schedule rows).
 * Use this for endpoint responses that should always include an id.
 */
export const PaymentEntity = Payment.extend({
  id: z.string().min(1),
});
export type TPaymentEntity = z.infer<typeof PaymentEntity>;

/* ============================================================================
   Spend schemas (enrollment-local)
============================================================================ */

/**
 * Spend entries stored under an enrollment (NOT the global ledger).
 * Back-compat: existing fields remain required where they were before.
 * Future-ready: optional metadata added for cross-linking / migration.
 */
export const SpendSource = z.enum([
  "enrollment", // current default for enrollment-level spends
  "card", // future credit-card feed
  "org", // future org/program-wide spend
  "manual", // admin/manual adjustment
]);

/** Atomic enrollment spend emitted when a payment is marked paid (or reversed). */
export const Spend = z.object({
  id: z.string(),

  // Required
  paymentId: z.string(),
  lineItemId: z.string().nullable(),
  amount: z.coerce.number(), // +spend / -reversal

  // Metadata
  source: SpendSource.optional(),
  orgId: z.string().nullish(),
  grantId: z.string().nullish(),
  enrollmentId: z.string().nullish(),
  customerId: z.string().nullish(),
  caseManagerId: z.string().nullish(),

  paid: z.boolean().nullish(),
  status: z.enum(["paid","unpaid","voided"]).or(z.string()).nullish(),
  voidedAt: TsLike.nullish(),
  reversed: z.boolean().nullish(),
  reversedAt: TsLike.nullish(),
  reversalOf: z.string().nullish(),

  amountCents: z.coerce.number().int().nullish(),
  month: z.string().nullish(), // YYYY-MM

  note: z.union([z.string(), z.array(z.string())]).nullish(),
  ts: TsLike.nullish(),

  by: z
    .object({
      uid: z.string().nullish(),
      email: z.string().nullish(),
      name: z.string().nullish(),
    })
    .partial()
    .nullish(),
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

  paymentSnapshot: z
    .object({
      amount: z.coerce.number().nullish(),
      type: PaymentType.nullish(),
      lineItemId: z.string().nullish(),
      dueDate: ISO10ish.nullish(),
      dueMonth: z.string().nullish(),
      note: z.union([z.string(), z.array(z.string())]).nullish(),
      vendor: z.string().nullish(),
      comment: z.string().nullish(),
    })
    .partial()
    .nullish(),
});

export type TSpend = z.infer<typeof Spend>;
export type TSpendSource = z.infer<typeof SpendSource>;

/* ============================================================================
   Request bodies
============================================================================ */

// ---------------- Generate Projections ----------------
export const PaymentsGenerateProjectionsBody = z.object({
  startDate: ISO10ish,
  months: z.coerce.number().int().positive(),
  monthlyAmount: z.coerce.number().positive(),
  deposit: z.coerce.number().nonnegative().optional(),
});
export type TPaymentsGenerateProjectionsBody = z.infer<
  typeof PaymentsGenerateProjectionsBody
>;

// ---------------- Recalculate Future ----------------
export const PaymentsRecalculateFutureSingleReq = z.object({
  enrollmentId: z.string().min(1),
  newMonthlyAmount: z.coerce.number().positive(),
  projectionIds: z.array(z.string().min(1)).max(2000).optional(),
  lineItemId: z.string().min(1).optional(),
  effectiveFrom: ISO10ish.optional(), // inclusive
  dryRun: z.boolean().optional(),
});

export const PaymentsRecalculateFutureGrantReq = z.object({
  grantId: z.string().min(1),
  newMonthlyAmount: z.coerce.number().positive(),
  lineItemId: z.string().min(1).optional(),
  effectiveFrom: ISO10ish.optional(), // inclusive
  dryRun: z.boolean().optional(),
});

export const PaymentsRecalculateFutureReq = z.union([
  PaymentsRecalculateFutureSingleReq,
  PaymentsRecalculateFutureGrantReq,
]);

export type TPaymentsRecalculateFutureSingleReq = z.infer<
  typeof PaymentsRecalculateFutureSingleReq
>;
export type TPaymentsRecalculateFutureGrantReq = z.infer<
  typeof PaymentsRecalculateFutureGrantReq
>;
export type TPaymentsRecalculateFutureReq = z.infer<
  typeof PaymentsRecalculateFutureReq
>;

// ---------------- Recalc Grant Projected ----------------
export const PaymentsRecalcGrantProjectedBody = z.object({
  grantId: z.string().min(1),
  effectiveFrom: ISO10ish.optional(), // metadata only
  activeOnly: z.boolean().optional().default(true),
  source: z.union([z.literal(1), z.literal(2)]).optional().default(1),
  dryRun: z.boolean().optional(),
});

export type TPaymentsRecalcGrantProjectedBody = z.infer<
  typeof PaymentsRecalcGrantProjectedBody
>;

// ---------------- Adjust Spend ----------------
export const PaymentsAdjustSpendBody = z.object({
  enrollmentId: z.string().min(1),
  spendId: z.string().min(1).optional(),   // optional; backend resolves via paymentId if absent/stale
  paymentId: z.string().min(1).optional(), // alternative to spendId for subcollection lookup

  patch: z
    .object({
      amount: z.union([z.number(), z.string()]).optional(),
      lineItemId: z.string().min(1).optional(),
      dueDate: ISO10ish.optional(), // normalized to ISO10
      note: z.union([z.string(), z.array(z.string())]).optional(),
      vendor: z.union([z.string(), z.null()]).optional(),
      comment: z.union([z.string(), z.null()]).optional(),
    })
    .default({}),

  reason: z.string().optional(),
});
export type TPaymentsAdjustSpendBody = z.infer<typeof PaymentsAdjustSpendBody>;

// ---------------- Adjust Projections ----------------
// Projection input is a *schedule row* (obligation). We allow either dueDate or legacy date.
export const PaymentProjectionInput = z
  .object({
    id: z.string().optional(),

    type: PaymentType,
    amount: z.coerce.number(),
    lineItemId: z.string().min(1),

    dueDate: ISO10ish.optional(),
    date: ISO10ish.optional(), // legacy alias accepted on input

    paid: z.boolean().nullish(),
    paidAt: ISO10ish.nullish(), // if you ever store full timestamps, switch this to TsLike
    paidFromGrant: z.boolean().nullish(),

    note: z.union([z.string(), z.array(z.string())]).nullish(),
    vendor: z.string().nullish(),
    comment: z.string().nullish(),

    compliance: PaymentCompliance.nullish(),
  })
  .superRefine((v, ctx) => {
    const hasDue = !!v.dueDate;
    const hasDate = !!v.date;
    if (!hasDue && !hasDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PaymentProjectionInput requires dueDate or date",
        path: ["dueDate"],
      });
    }
    if (!Number.isFinite(Number(v.amount)) || Number(v.amount) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "amount must be a positive number",
        path: ["amount"],
      });
    }
  });

export type TPaymentProjectionInput = z.infer<typeof PaymentProjectionInput>;

export const PaymentsAdjustProjectionsBody = z.object({
  enrollmentId: z.string().min(1),
  payments: z.array(PaymentProjectionInput).default([]),
  replaceUnpaid: z.boolean().optional().default(true),
});
export type TPaymentsAdjustProjectionsBody = z.infer<
  typeof PaymentsAdjustProjectionsBody
>;

// ---------------- Bulk Copy Schedule ----------------
/**
 * Copy a source enrollment's payment schedule template to many target enrollments.
 * Matches handler behavior (defaults included).
 */
export const PaymentsBulkCopyScheduleBody = z.object({
  sourceEnrollmentId: z.string().min(1),
  targetEnrollmentIds: z.array(z.string().min(1)).min(1),
  mode: z.enum(["replace", "merge"]).optional().default("replace"),
  includeTypes: z.array(z.string().min(1)).optional().nullable(),
  anchorByStartDate: z.boolean().optional().default(true),
});
export type TPaymentsBulkCopyScheduleBody = z.infer<
  typeof PaymentsBulkCopyScheduleBody
>;

// ---------------- Spend (book / reverse) ----------------
/**
 * Book a spend (or reversal) against a payment.
 * Matches handler behavior (defaults included).
 */
export const PaymentsSpendBody = z.object({
  enrollmentId: z.string().min(1),
  paymentId: z.string().min(1),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  reverse: z.boolean().optional().default(false),
  vendor: z.string().optional(),
  comment: z.string().optional(),
});
export type TPaymentsSpendBody = z.infer<typeof PaymentsSpendBody>;

// ---------------- Update Compliance ----------------
export const PaymentCompliancePatch = PaymentCompliance.partial();
export type TPaymentCompliancePatch = z.infer<typeof PaymentCompliancePatch>;

/**
 * Patch payment.compliance fields on a single payment within an enrollment.
 * Matches /paymentsUpdateCompliance handler.
 */
export const PaymentsUpdateComplianceBody = z.object({
  enrollmentId: z.string().min(1),
  paymentId: z.string().min(1),
  // patch semantics: allow partial updates (also allows nullish because base schema does)
  patch: PaymentCompliancePatch,
});
export type TPaymentsUpdateComplianceBody = z.infer<
  typeof PaymentsUpdateComplianceBody
>;

// ---------------- Delete Rows ----------------
export const PaymentsDeleteRowsBody = z.object({
  enrollmentId: z.string().min(1),
  paymentIds: z.array(z.string().min(1)).max(500).optional(),
  deleteAll: z.boolean().optional().default(false),
  preservePaid: z.boolean().optional().default(true),
  updateBudgets: z.boolean().optional().default(false),
  removeSpends: z.boolean().optional().default(true),
  reverseLedger: z.boolean().optional().default(true),
});
export type TPaymentsDeleteRowsBody = z.infer<typeof PaymentsDeleteRowsBody>;

// ---------------- Update Grant Budget ----------------
/**
 * Thin alias to /paymentsRecalcGrantProjected.
 * Keep separate name to prevent route drift while reusing the same shape.
 */
export const PaymentsUpdateGrantBudgetBody = PaymentsRecalcGrantProjectedBody;
export type TPaymentsUpdateGrantBudgetBody = TPaymentsRecalcGrantProjectedBody;

// ---------------- Upsert Projections ----------------
/**
 * Deterministic upsert of enrollment projections.
 * Accepts schedule rows (allows legacy `date` OR `dueDate` via PaymentProjectionInput).
 */
export const PaymentsUpsertProjectionsBody = z.object({
  enrollmentId: z.string().min(1),
  payments: z.array(PaymentProjectionInput).default([]),
});
export type TPaymentsUpsertProjectionsBody = z.infer<
  typeof PaymentsUpsertProjectionsBody
>;

/* ============================================================================
   Operation result DTOs (responses)
============================================================================ */

// Recalculate Future
export const PaymentsRecalculateFutureResp = z.union([
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
      willUpdate: z.boolean(),
    }).optional(),

    sample: z.array(Payment).optional(),
  }),
  z.object({
    mode: z.literal("grant"),
    fromISO: ISO10ish,
    dryRun: z.boolean(),
    grantId: z.string(),

    stats: z.object({
      touched: z.number(),
      noChange: z.number(),
      errors: z.number(),
    }),

    summaries: z.array(z.object({
      enrollmentId: z.string(),
      deltaByLI: z.record(z.string(), z.number()),
    })),
  }),
]);
export type TPaymentsRecalculateFutureResp = z.infer<typeof PaymentsRecalculateFutureResp>;

// Recalc Grant Projected
export const PaymentsRecalcGrantProjectedResp = z.object({
  totals: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()),
  dryRun: z.boolean(),
  effectiveFromISO: ISO10ish,
  activeOnly: z.boolean(),
  source: z.union([z.literal(1), z.literal(2)]),
});
export type TPaymentsRecalcGrantProjectedResp = z.infer<typeof PaymentsRecalcGrantProjectedResp>;

export const PaymentsDeleteRowsResp = z.object({
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
    removedSpendSubdocs: z.number().int().nonnegative(),
  }),
});
export type TPaymentsDeleteRowsResp = z.infer<typeof PaymentsDeleteRowsResp>;
