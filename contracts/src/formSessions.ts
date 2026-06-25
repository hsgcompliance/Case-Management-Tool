// contracts/src/formSessions.ts
// -----------------------------------------------------------------------------
// Form Sessions — a lightweight, separately-deployable Forms surface that shares
// this backend. A form session is a signed/tokenized link to a workflow (credit
// card checkout, status page, customer prefill, …). The main app (or a QR code /
// direct link) creates a session; the Forms app resolves it by token, renders the
// workflow, and links the resulting Jotform submission back to our entities.
//
// Design goals: boring, typed, inspectable, easy to extend. No big abstractions.
// -----------------------------------------------------------------------------
import { z, Id, IdLike, TsLike } from "./core";
import { Ok } from "./http";

/* ───────────────────────── Enums ───────────────────────── */

export const FormWorkflowId = z.enum([
  "credit-card-checkout",
  "credit-card-status",
  "customer-prefill",
  "invoice-request",
]);
export type TFormWorkflowId = z.infer<typeof FormWorkflowId>;

export const FormRenderMode = z.enum(["auto", "custom"]);
export type TFormRenderMode = z.infer<typeof FormRenderMode>;

export const FormSessionStatus = z.enum([
  "created", // session minted, not yet opened
  "opened", // resolved at least once by the forms surface
  "submitted", // a Jotform submission was linked
  "completed", // downstream linking/updates finished
  "expired", // past expiresAt
  "revoked", // manually revoked
]);
export type TFormSessionStatus = z.infer<typeof FormSessionStatus>;

export const FormSessionSource = z.enum(["main_app", "qr", "direct_link"]);
export type TFormSessionSource = z.infer<typeof FormSessionSource>;

/* ───────────────────────── Workflow config ─────────────────────────
 * Static, typed config per workflow. Kept as data (WORKFLOW_CONFIGS) so both the
 * backend and the Forms app read the same source of truth. `prefill` maps a
 * snapshot field name → a dotted source path that the backend resolves at create
 * time (e.g. "customer.fullName", "payment.amount").
 */

export const FormWorkflowConfig = z.object({
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
  afterSubmit: z
    .object({
      linkJotformSubmission: z.boolean().default(true),
      updatePaymentQueueStatus: z.boolean().default(false),
      showStatusPage: z.boolean().default(true),
    })
    .default({
      linkJotformSubmission: true,
      updatePaymentQueueStatus: false,
      showStatusPage: true,
    }),
});
export type TFormWorkflowConfig = z.infer<typeof FormWorkflowConfig>;

/**
 * The known context ids a session can carry. Kept narrow and boring.
 */
export const FORM_CONTEXT_KEYS = [
  "customerId",
  "userId",
  "caseManagerId",
  "grantId",
  "paymentQueueId",
  "ledgerItemId",
  "creditCardId",
] as const;
export type TFormContextKey = (typeof FORM_CONTEXT_KEYS)[number];

/**
 * Canonical workflow definitions. jotformFormId is intentionally blank here and
 * resolved from org config / env at runtime (WORKFLOW_FORM_IDS in the backend
 * service) so we never hardcode form ids in the shared contract. Today the
 * checkout workflow renders the "Credit Card Checkout" form (251590902397160).
 */
export const WORKFLOW_CONFIGS: Record<TFormWorkflowId, TFormWorkflowConfig> = {
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
      vendor: "payment.merchant",
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: true,
      showStatusPage: true,
    },
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
      showStatusPage: true,
    },
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
      caseManagerName: "caseManager.displayName",
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: false,
      showStatusPage: true,
    },
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
      vendor: "payment.merchant",
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: true,
      showStatusPage: true,
    },
  },
};

/* ───────────────────────── Snapshots ─────────────────────────
 * prefillSnapshot is the non-sensitive, render-time data the Forms app shows.
 * Money is in cents to stay consistent with the rest of the system.
 */

export const FormPrefillSnapshot = z
  .object({
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
    monthlyLimitCents: z.number().int().nullable().optional(),
  })
  .passthrough();
export type TFormPrefillSnapshot = z.infer<typeof FormPrefillSnapshot>;

export const FormSubmissionSnapshot = z
  .object({
    jotformFormId: z.string().nullish(),
    jotformSubmissionId: z.string().nullish(),
    submittedAt: z.string().nullish(),
    amountCents: z.number().int().nullish(),
  })
  .passthrough();
export type TFormSubmissionSnapshot = z.infer<typeof FormSubmissionSnapshot>;

/* ───────────────────────── Entity ─────────────────────────
 * Firestore doc: formSessions/{id}. Only tokenHash is stored — the raw token
 * lives in the render URL and is never persisted.
 */

export const FormSessionEntity = z
  .object({
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
    updatedAt: TsLike.nullish(),
  })
  .passthrough();
export type TFormSessionEntity = z.infer<typeof FormSessionEntity>;

/* ───────────────────────── Create (auth: user) ───────────────────────── */

export const FormSessionCreateBody = z
  .object({
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
    orgId: IdLike.optional(),
  })
  .passthrough();
export type TFormSessionCreateBody = z.infer<typeof FormSessionCreateBody>;

export type TFormSessionCreateResp = Ok<{
  formSessionId: string;
  renderUrl: string;
  expiresAt: string;
}>;

/* ───────────────────────── Resolve (auth: public, token-gated) ───────────────────────── */

export const FormSessionResolveBody = z
  .object({
    token: z.string().trim().min(8),
  })
  .passthrough();
export type TFormSessionResolveBody = z.infer<typeof FormSessionResolveBody>;

/** Safe, token-scoped view returned to the Forms surface (no broad data). */
export type TFormSessionResolved = {
  formSessionId: string;
  workflowId: TFormWorkflowId;
  status: TFormSessionStatus;
  renderMode: TFormRenderMode;
  jotformFormId: string | null;
  config: TFormWorkflowConfig;
  prefill: TFormPrefillSnapshot | null;
  context: {
    customerId: string | null;
    grantId: string | null;
    paymentQueueId: string | null;
    creditCardId: string | null;
  };
  jotformSubmissionId: string | null;
  expiresAt: string;
  expired: boolean;
};
export type TFormSessionResolveResp = Ok<{ session: TFormSessionResolved }>;

/* ───────────────────────── Complete / link (auth: public, token-gated) ───────────────────────── */

export const FormSessionCompleteBody = z
  .object({
    token: z.string().trim().min(8),
    jotformSubmissionId: z.string().trim().nullish(),
    /** Optional normalized payload from the custom render path. */
    submission: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();
export type TFormSessionCompleteBody = z.infer<typeof FormSessionCompleteBody>;

export type TFormSessionCompleteResp = Ok<{
  formSessionId: string;
  status: TFormSessionStatus;
  linked: boolean;
}>;

/* ───────────────────────── Helpers ───────────────────────── */

export function getWorkflowConfig(workflowId: TFormWorkflowId): TFormWorkflowConfig {
  return WORKFLOW_CONFIGS[workflowId];
}
