import api from "./api";
import { idemKey } from "@lib/idem";

export type PaymentQueueItem = Record<string, unknown> & {
  id: string;
  submissionId?: string;
  paymentId?: string | null;
  formId?: string;
  formAlias?: string;
  formTitle?: string;
  source?: "credit-card" | "invoice" | "projection" | "unknown";
  dueDate?: string | null;
  month?: string;
  amount?: number;
  amountAbs?: number;
  direction?: "charge" | "return";
  directionFieldId?: string | null;
  amountFieldId?: string | null;
  extractionGroup?: {
    kind: "purchase" | "return" | "fallback";
    index: number | null;
    orderRange?: [number, number] | null;
    fieldIds?: Record<string, string | null>;
  };
  merchant?: string;
  card?: string;
  cardBucket?: string;
  purpose?: string;
  note?: string;
  notes?: string;
  descriptor?: string;
  grantId?: string | null;
  lineItemId?: string | null;
  customerId?: string | null;
  enrollmentId?: string | null;
  creditCardId?: string | null;
  ledgerEntryId?: string | null;
  reversalEntryId?: string | null;
  queueStatus?: "pending" | "posted" | "void";
  createdAt?: string;
  postedAt?: string | null;
  reopenedAt?: string | null;
  rawMeta?: Record<string, unknown>;
  localModified?: boolean;
  localModifiedAt?: string | null;
  localModifiedBy?: string | null;
  localModifiedFields?: string[];
  localModificationReason?: string | null;
};

export type PaymentQueueListReq = {
  orgId?: string;
  month?: string;
  source?: "credit-card" | "invoice" | "projection" | "unknown";
  submissionId?: string;
  grantId?: string;
  customerId?: string;
  queueStatus?: "pending" | "posted" | "void";
  unmatched?: boolean;
  okUnassigned?: boolean;
  isFlex?: boolean;
  limit?: number;
  cursor?: string;
};

export type PaymentQueuePatchReq = {
  amount?: number;
  amountAbs?: number;
  direction?: "charge" | "return";
  merchant?: string;
  expenseType?: string;
  program?: string;
  purpose?: string;
  notes?: string;
  note?: string;
  card?: string;
  cardBucket?: "Youth" | "Housing" | "MAD" | "";
  grantId?: string | null;
  lineItemId?: string | null;
  customerId?: string | null;
  enrollmentId?: string | null;
  creditCardId?: string | null;
  invoiceStatus?: "pending" | "invoiced" | "void" | null;
  invoiceRef?: string | null;
  okUnassigned?: boolean;
  okUnassignedBy?: string;
  localModificationReason?: string;
};

export type PaymentQueuePostReq = {
  ledgerEntryId?: string;
  postedBy?: string;
};

export type PaymentQueueReopenReq = {
  reason?: string;
  reopenedBy?: string;
  reversalEntryId?: string;
};

export type PaymentQueueVoidReq = {
  reason?: string;
};

const PaymentQueue = {
  list: (query: PaymentQueueListReq = {}) =>
    api.get("paymentQueueList", query) as Promise<{
      ok: true;
      items: PaymentQueueItem[];
      count: number;
      hasMore: boolean;
    }>,

  get: (id: string) =>
    api.get("paymentQueueGet", { id }) as Promise<{ ok: true; item: PaymentQueueItem }>,

  patch: (id: string, body: PaymentQueuePatchReq) =>
    api.call("paymentQueuePatch", {
      query: { id },
      body,
      idempotencyKey: idemKey({ scope: "paymentQueue", op: "patch", id, body }),
    }) as Promise<{ ok: true; item: PaymentQueueItem }>,

  postToLedger: (id: string, body: PaymentQueuePostReq = {}) =>
    api.call("paymentQueuePostToLedger", {
      query: { id },
      body: { ...body, id },
      idempotencyKey: idemKey({ scope: "paymentQueue", op: "postToLedger", id, body }),
    }) as Promise<{ ok: true; queueItem: PaymentQueueItem; ledgerEntryId: string }>,

  reopen: (id: string, body: PaymentQueueReopenReq = {}) =>
    api.call("paymentQueueReopen", {
      query: { id },
      body,
      idempotencyKey: idemKey({ scope: "paymentQueue", op: "reopen", id, body }),
    }) as Promise<{ ok: true; queueItem: PaymentQueueItem; reversalEntryId: string }>,

  void: (id: string, body: PaymentQueueVoidReq = {}) =>
    api.call("paymentQueueVoid", {
      query: { id },
      body,
      idempotencyKey: idemKey({ scope: "paymentQueue", op: "void", id, body }),
    }) as Promise<{ ok: true; voided: number }>,

  recomputeGrantAllocations: (body: { grantId: string; dryRun?: boolean }) =>
    api.call("paymentQueueRecomputeGrantAllocations", {
      body,
      idempotencyKey: idemKey({ scope: "paymentQueue", op: "recomputeGrantAllocations", body }),
    }) as Promise<{ ok: true; grantId: string; customers: number; ledgerRows: number; totals: Record<string, number>; dryRun: boolean }>,
};

export default PaymentQueue;
