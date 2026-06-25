import {
  Id,
  IdLike,
  TsLike,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/formSessions.ts
var formSessions_exports = {};
__export(formSessions_exports, {
  FORM_CONTEXT_KEYS: () => FORM_CONTEXT_KEYS,
  FormPrefillSnapshot: () => FormPrefillSnapshot,
  FormRenderMode: () => FormRenderMode,
  FormSessionCompleteBody: () => FormSessionCompleteBody,
  FormSessionCreateBody: () => FormSessionCreateBody,
  FormSessionEntity: () => FormSessionEntity,
  FormSessionResolveBody: () => FormSessionResolveBody,
  FormSessionSource: () => FormSessionSource,
  FormSessionStatus: () => FormSessionStatus,
  FormSubmissionSnapshot: () => FormSubmissionSnapshot,
  FormWorkflowConfig: () => FormWorkflowConfig,
  FormWorkflowId: () => FormWorkflowId,
  WORKFLOW_CONFIGS: () => WORKFLOW_CONFIGS,
  getWorkflowConfig: () => getWorkflowConfig
});
var FormWorkflowId = z.enum([
  "credit-card-checkout",
  "credit-card-status",
  "customer-prefill",
  "invoice-request"
]);
var FormRenderMode = z.enum(["auto", "custom"]);
var FormSessionStatus = z.enum([
  "created",
  // session minted, not yet opened
  "opened",
  // resolved at least once by the forms surface
  "submitted",
  // a Jotform submission was linked
  "completed",
  // downstream linking/updates finished
  "expired",
  // past expiresAt
  "revoked"
  // manually revoked
]);
var FormSessionSource = z.enum(["main_app", "qr", "direct_link"]);
var FormWorkflowConfig = z.object({
  workflowId: FormWorkflowId,
  /** Jotform form id this workflow renders (empty until configured). */
  jotformFormId: z.string().trim().default(""),
  /** "auto" = render embedded Jotform; "custom" = use a bespoke screen. */
  mode: FormRenderMode.default("auto"),
  /** Auth model for the render link. Currently only signed (tokenized) links. */
  auth: z.literal("signed-link").default("signed-link"),
  /** Context ids that MUST be supplied to createFormSession for this workflow. */
  requiredContext: z.array(z.string()).default([]),
  /** Which context ids get linked onto the resulting submission. */
  linkTo: z.array(z.string()).default([]),
  /** snapshotField -> dotted source path resolved server-side at create time. */
  prefill: z.record(z.string(), z.string()).default({}),
  afterSubmit: z.object({
    linkJotformSubmission: z.boolean().default(true),
    updatePaymentQueueStatus: z.boolean().default(false),
    showStatusPage: z.boolean().default(true)
  }).default({
    linkJotformSubmission: true,
    updatePaymentQueueStatus: false,
    showStatusPage: true
  })
});
var FORM_CONTEXT_KEYS = [
  "customerId",
  "userId",
  "caseManagerId",
  "grantId",
  "paymentQueueId",
  "ledgerItemId",
  "creditCardId"
];
var WORKFLOW_CONFIGS = {
  "credit-card-checkout": {
    workflowId: "credit-card-checkout",
    jotformFormId: "",
    mode: "custom",
    auth: "signed-link",
    requiredContext: ["paymentQueueId"],
    linkTo: ["customerId", "userId", "paymentQueueId", "grantId", "creditCardId"],
    prefill: {
      customerName: "customer.fullName",
      amount: "payment.amount",
      grantName: "grant.name",
      caseManagerName: "caseManager.displayName",
      paymentMonth: "payment.month",
      vendor: "payment.merchant"
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: true,
      showStatusPage: true
    }
  },
  "credit-card-status": {
    workflowId: "credit-card-status",
    jotformFormId: "",
    mode: "custom",
    auth: "signed-link",
    requiredContext: [],
    linkTo: ["creditCardId", "userId"],
    prefill: {},
    afterSubmit: {
      linkJotformSubmission: false,
      updatePaymentQueueStatus: false,
      showStatusPage: true
    }
  },
  "customer-prefill": {
    workflowId: "customer-prefill",
    jotformFormId: "",
    mode: "auto",
    auth: "signed-link",
    requiredContext: ["customerId"],
    linkTo: ["customerId", "userId", "grantId"],
    prefill: {
      customerName: "customer.fullName",
      grantName: "grant.name",
      caseManagerName: "caseManager.displayName"
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: false,
      showStatusPage: true
    }
  },
  "invoice-request": {
    workflowId: "invoice-request",
    jotformFormId: "",
    // Embed the Invoice Requests Jotform directly (no bespoke screen needed).
    mode: "auto",
    auth: "signed-link",
    // Can be launched standalone or from an invoice queue row; nothing required.
    requiredContext: [],
    linkTo: ["customerId", "userId", "grantId", "paymentQueueId"],
    prefill: {
      customerName: "customer.fullName",
      amount: "payment.amount",
      grantName: "grant.name",
      caseManagerName: "caseManager.displayName",
      paymentMonth: "payment.month",
      vendor: "payment.merchant"
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: true,
      showStatusPage: true
    }
  }
};
var FormPrefillSnapshot = z.object({
  customerName: z.string().nullish(),
  grantId: IdLike.nullish(),
  grantName: z.string().nullish(),
  caseManagerName: z.string().nullish(),
  amountCents: z.number().int().nullish(),
  paymentMonth: z.string().nullish(),
  vendor: z.string().nullish(),
  checkoutStatus: z.string().nullish(),
  cardId: IdLike.nullish(),
  cardName: z.string().nullish(),
  /** Current-month credit-card spend total (cents). Null = unavailable. */
  currentMonthCardSpendCents: z.number().int().nullable().optional(),
  monthlyLimitCents: z.number().int().nullable().optional()
}).passthrough();
var FormSubmissionSnapshot = z.object({
  jotformFormId: z.string().nullish(),
  jotformSubmissionId: z.string().nullish(),
  submittedAt: z.string().nullish(),
  amountCents: z.number().int().nullish()
}).passthrough();
var FormSessionEntity = z.object({
  id: Id,
  orgId: Id,
  workflowId: FormWorkflowId,
  status: FormSessionStatus,
  source: FormSessionSource,
  // Linked context (all nullable)
  customerId: Id.nullable(),
  userId: Id.nullable(),
  caseManagerId: Id.nullable(),
  grantId: Id.nullable(),
  paymentQueueId: Id.nullable(),
  ledgerItemId: Id.nullable(),
  creditCardId: Id.nullable(),
  jotformFormId: z.string().nullable(),
  jotformSubmissionId: z.string().nullable(),
  /** sha256(token). Never store the raw token. */
  tokenHash: z.string(),
  expiresAt: TsLike,
  prefillSnapshot: FormPrefillSnapshot.nullable(),
  submissionSnapshot: FormSubmissionSnapshot.nullable(),
  createdByUid: Id.nullable(),
  createdAt: TsLike.nullish(),
  submittedAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var FormSessionCreateBody = z.object({
  workflowId: FormWorkflowId,
  source: FormSessionSource.default("main_app"),
  customerId: IdLike.nullish(),
  userId: IdLike.nullish(),
  caseManagerId: IdLike.nullish(),
  grantId: IdLike.nullish(),
  paymentQueueId: IdLike.nullish(),
  ledgerItemId: IdLike.nullish(),
  creditCardId: IdLike.nullish(),
  /** Optional override; defaults to a server-side TTL. */
  ttlMinutes: z.coerce.number().int().min(1).max(60 * 24 * 30).optional(),
  orgId: IdLike.optional()
}).passthrough();
var FormSessionResolveBody = z.object({
  token: z.string().trim().min(8)
}).passthrough();
var FormSessionCompleteBody = z.object({
  token: z.string().trim().min(8),
  jotformSubmissionId: z.string().trim().nullish(),
  /** Optional normalized payload from the custom render path. */
  submission: z.record(z.string(), z.unknown()).nullish()
}).passthrough();
function getWorkflowConfig(workflowId) {
  return WORKFLOW_CONFIGS[workflowId];
}

export {
  FormWorkflowId,
  FormRenderMode,
  FormSessionStatus,
  FormSessionSource,
  FormWorkflowConfig,
  FORM_CONTEXT_KEYS,
  WORKFLOW_CONFIGS,
  FormPrefillSnapshot,
  FormSubmissionSnapshot,
  FormSessionEntity,
  FormSessionCreateBody,
  FormSessionResolveBody,
  FormSessionCompleteBody,
  getWorkflowConfig,
  formSessions_exports
};
