// functions/src/features/paymentQueue/schemas.ts
import {z} from '../../core/z';

// ─── PaymentQueueItem ─────────────────────────────────────────────────────────
//
// Firestore document shape for paymentQueue/{itemId}.
// Each document represents one extracted spend line (one CC txn or one invoice
// split).  Multiple docs can share the same baseId (submissionId).
//
// Lifecycle:
//   queueStatus: "pending" → "posted" (after postToLedger) | "void" (after voiding)
//
// Downstream linking fields (grantId, customerId, etc.) start as null and are
// written by patchPaymentQueueItem or postPaymentQueueToLedger.

export const PaymentQueueStatus = z.enum(['pending', 'posted', 'void']);
export type TPaymentQueueStatus = z.infer<typeof PaymentQueueStatus>;

export const InvoiceStatus = z.enum(['pending', 'invoiced', 'void']).nullable();
export const PaymentQueueSource = z.enum(['credit-card', 'invoice', 'projection', 'unknown']);

const SpendExtractionError = z.object({
  code: z.string(),
  message: z.string(),
  fieldId: z.string().optional(),
});

export const PaymentQueueItem = z.object({
  // ── Identity ───────────────────────────────────────────────────────────────
  id: z.string(),
  baseId: z.string(),
  submissionId: z.string(),
  paymentId: z.string().nullable(),
  formId: z.string(),
  formAlias: z.string(),
  formTitle: z.string(),
  schemaVersion: z.number(),
  source: PaymentQueueSource,
  orgId: z.string().nullable(),

  // ── Timing ────────────────────────────────────────────────────────────────
  createdAt: z.string(),
  dueDate: z.string().nullable(),
  month: z.string(),

  // ── Amount ────────────────────────────────────────────────────────────────
  amount: z.number(),
  amountAbs: z.number().optional(),
  direction: z.enum(['charge', 'return']).optional(),
  directionFieldId: z.string().nullable().optional(),
  amountFieldId: z.string().nullable().optional(),
  extractionGroup: z.object({
    kind: z.enum(['purchase', 'return', 'fallback']),
    index: z.number().nullable(),
    orderRange: z.tuple([z.number(), z.number()]).nullable().optional(),
    fieldIds: z.record(z.string(), z.string().nullable()).optional(),
  }).optional(),
  localModified: z.boolean().optional(),
  localModifiedAt: z.string().nullable().optional(),
  localModifiedBy: z.string().nullable().optional(),
  localModifiedFields: z.array(z.string()).optional(),
  localModificationReason: z.string().nullable().optional(),

  // ── Counterparty / vendor ─────────────────────────────────────────────────
  merchant: z.string(),

  // ── Classification ────────────────────────────────────────────────────────
  expenseType: z.string(),
  program: z.string(),
  billedTo: z.string(),
  project: z.string(),
  purchasePath: z.enum(['customer', 'program', '']),

  // ── Credit-card specific ──────────────────────────────────────────────────
  card: z.string(),
  cardBucket: z.enum(['Youth', 'Housing', 'MAD', '']),
  txnNumber: z.number().nullable(),
  purpose: z.string(),

  // ── Invoice specific ──────────────────────────────────────────────────────
  paymentMethod: z.string(),
  serviceType: z.string(),
  otherService: z.string(),
  serviceScope: z.string(),
  wex: z.string(),
  descriptor: z.string(),

  // ── Customer ──────────────────────────────────────────────────────────────
  customer: z.string(),
  customerKey: z.string(),
  purchaser: z.string(),
  email: z.string(),

  // ── Flex tagging ──────────────────────────────────────────────────────────
  isFlex: z.boolean(),
  flexReasons: z.array(z.string()),
  submissionIsFlex: z.boolean(),

  // ── Files ─────────────────────────────────────────────────────────────────
  files: z.array(z.string()),
  files_txn: z.array(z.string()),
  files_uploadAll: z.array(z.string()),
  files_typed: z.object({
    receipt: z.array(z.string()),
    required: z.array(z.string()),
    agenda: z.array(z.string()),
    w9: z.array(z.string()),
  }),

  // ── Notes ─────────────────────────────────────────────────────────────────
  notes: z.string(),
  note: z.string(),

  // ── Raw preservation ──────────────────────────────────────────────────────
  rawStatus: z.string(),
  rawAnswers: z.record(z.string(), z.unknown()),
  rawMeta: z.object({
    id: z.string(),
    form_id: z.string(),
    status: z.string(),
    created_at: z.string(),
    updated_at: z.string().optional(),
  }),

  // ── Downstream linking ────────────────────────────────────────────────────
  // All nullable: CC/invoice items may be program-level (no customer, no enrollment).
  grantId: z.string().nullable(),
  lineItemId: z.string().nullable(),
  customerId: z.string().nullable(),
  enrollmentId: z.string().nullable(),
  creditCardId: z.string().nullable(),
  ledgerEntryId: z.string().nullable(),
  reversalEntryId: z.string().nullable(),

  // ── Invoice workflow ──────────────────────────────────────────────────────
  invoiceStatus: InvoiceStatus,
  invoicedAt: z.string().nullable(),
  invoicedBy: z.string().nullable(),
  invoiceRef: z.string().nullable(),

  // ── Unmatched workflow ────────────────────────────────────────────────────
  okUnassigned: z.boolean(),
  okUnassignedAt: z.string().nullable(),
  okUnassignedBy: z.string().nullable(),
  compliance: z.object({
    hmisComplete: z.boolean().optional(),
    caseworthyComplete: z.boolean().optional(),
  }).optional(),

  // ── Extraction audit ──────────────────────────────────────────────────────
  extractionErrors: z.array(SpendExtractionError),
  extractionPath: z.enum(['hardcoded', 'digest', 'fallback']),

  // ── Queue lifecycle ───────────────────────────────────────────────────────
  queueStatus: PaymentQueueStatus,
  /** ISO timestamp set when voided (submission deleted or manually voided) */
  voidedAt: z.string().nullable(),
  voidedBy: z.string().nullable(),
  /** ISO timestamp set when posted to ledger */
  postedAt: z.string().nullable(),
  postedBy: z.string().nullable(),
  reopenedAt: z.string().nullable(),
  reopenedBy: z.string().nullable(),
  reopenReason: z.string().nullable(),

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAtISO: z.string(),
  updatedAtISO: z.string(),
  system: z.object({
    lastWriter: z.string(),
    lastWriteAt: z.string(),
    extractionVersion: z.number(),
  }),
});

export type TPaymentQueueItem = z.infer<typeof PaymentQueueItem>;

// ─── HTTP request bodies ──────────────────────────────────────────────────────

export const PaymentQueueListBody = z.object({
  orgId: z.string().optional(),
  month: z.string().optional(),
  source: PaymentQueueSource.optional(),
  submissionId: z.string().optional(),
  grantId: z.string().optional(),
  customerId: z.string().optional(),
  queueStatus: PaymentQueueStatus.optional(),
  /** If true, return only items where grantId is null and okUnassigned is false */
  unmatched: z.boolean().optional(),
  okUnassigned: z.boolean().optional(),
  isFlex: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  cursor: z.string().optional(),
});
export type TPaymentQueueListBody = z.infer<typeof PaymentQueueListBody>;

export const PaymentQueuePatchBody = z.object({
  amount: z.number().optional(),
  amountAbs: z.number().optional(),
  direction: z.enum(['charge', 'return']).optional(),
  merchant: z.string().optional(),
  expenseType: z.string().optional(),
  program: z.string().optional(),
  purpose: z.string().optional(),
  notes: z.string().optional(),
  note: z.string().optional(),
  card: z.string().optional(),
  cardBucket: z.enum(['Youth', 'Housing', 'MAD', '']).optional(),
  grantId: z.string().nullable().optional(),
  lineItemId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  enrollmentId: z.string().nullable().optional(),
  creditCardId: z.string().nullable().optional(),
  invoiceStatus: InvoiceStatus.optional(),
  invoiceRef: z.string().nullable().optional(),
  okUnassigned: z.boolean().optional(),
  okUnassignedBy: z.string().optional(),
  localModificationReason: z.string().optional(),
});
export type TPaymentQueuePatchBody = z.infer<typeof PaymentQueuePatchBody>;

export const PaymentQueueRecomputeGrantBody = z.object({
  grantId: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
});
export type TPaymentQueueRecomputeGrantBody = z.infer<typeof PaymentQueueRecomputeGrantBody>;

export const PaymentQueuePostToLedgerBody = z.object({
  /** Force a specific ledger entry ID (idempotency) */
  ledgerEntryId: z.string().optional(),
  /** Actor UID doing the posting */
  postedBy: z.string().optional(),
});
export type TPaymentQueuePostToLedgerBody = z.infer<typeof PaymentQueuePostToLedgerBody>;

export const PaymentQueueVoidBody = z.object({
  reason: z.string().optional(),
});
export type TPaymentQueueVoidBody = z.infer<typeof PaymentQueueVoidBody>;

export const PaymentQueueReopenBody = z.object({
  reason: z.string().optional(),
  reopenedBy: z.string().optional(),
  reversalEntryId: z.string().optional(),
});
export type TPaymentQueueReopenBody = z.infer<typeof PaymentQueueReopenBody>;

export const PaymentQueueItemParams = z.object({
  id: z.string().min(1),
});
