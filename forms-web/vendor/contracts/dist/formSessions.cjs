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
module.exports = __toCommonJS(formSessions_exports);

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

// src/formSessions.ts
var FormWorkflowId = import_zod2.z.enum([
  "credit-card-checkout",
  "credit-card-status",
  "customer-prefill",
  "invoice-request"
]);
var FormRenderMode = import_zod2.z.enum(["auto", "custom"]);
var FormSessionStatus = import_zod2.z.enum([
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
var FormSessionSource = import_zod2.z.enum(["main_app", "qr", "direct_link"]);
var FormWorkflowConfig = import_zod2.z.object({
  workflowId: FormWorkflowId,
  /** Jotform form id this workflow renders (empty until configured). */
  jotformFormId: import_zod2.z.string().trim().default(""),
  /** "auto" = render embedded Jotform; "custom" = use a bespoke screen. */
  mode: FormRenderMode.default("auto"),
  /** Auth model for the render link. Currently only signed (tokenized) links. */
  auth: import_zod2.z.literal("signed-link").default("signed-link"),
  /** Context ids that MUST be supplied to createFormSession for this workflow. */
  requiredContext: import_zod2.z.array(import_zod2.z.string()).default([]),
  /** Which context ids get linked onto the resulting submission. */
  linkTo: import_zod2.z.array(import_zod2.z.string()).default([]),
  /** snapshotField -> dotted source path resolved server-side at create time. */
  prefill: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).default({}),
  afterSubmit: import_zod2.z.object({
    linkJotformSubmission: import_zod2.z.boolean().default(true),
    updatePaymentQueueStatus: import_zod2.z.boolean().default(false),
    showStatusPage: import_zod2.z.boolean().default(true)
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
var FormPrefillSnapshot = import_zod2.z.object({
  customerName: import_zod2.z.string().nullish(),
  grantId: IdLike.nullish(),
  grantName: import_zod2.z.string().nullish(),
  caseManagerName: import_zod2.z.string().nullish(),
  amountCents: import_zod2.z.number().int().nullish(),
  paymentMonth: import_zod2.z.string().nullish(),
  vendor: import_zod2.z.string().nullish(),
  checkoutStatus: import_zod2.z.string().nullish(),
  cardId: IdLike.nullish(),
  cardName: import_zod2.z.string().nullish(),
  /** Current-month credit-card spend total (cents). Null = unavailable. */
  currentMonthCardSpendCents: import_zod2.z.number().int().nullable().optional(),
  monthlyLimitCents: import_zod2.z.number().int().nullable().optional()
}).passthrough();
var FormSubmissionSnapshot = import_zod2.z.object({
  jotformFormId: import_zod2.z.string().nullish(),
  jotformSubmissionId: import_zod2.z.string().nullish(),
  submittedAt: import_zod2.z.string().nullish(),
  amountCents: import_zod2.z.number().int().nullish()
}).passthrough();
var FormSessionEntity = import_zod2.z.object({
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
  jotformFormId: import_zod2.z.string().nullable(),
  jotformSubmissionId: import_zod2.z.string().nullable(),
  /** sha256(token). Never store the raw token. */
  tokenHash: import_zod2.z.string(),
  expiresAt: TsLike,
  prefillSnapshot: FormPrefillSnapshot.nullable(),
  submissionSnapshot: FormSubmissionSnapshot.nullable(),
  createdByUid: Id.nullable(),
  createdAt: TsLike.nullish(),
  submittedAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var FormSessionCreateBody = import_zod2.z.object({
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
  ttlMinutes: import_zod2.z.coerce.number().int().min(1).max(60 * 24 * 30).optional(),
  orgId: IdLike.optional()
}).passthrough();
var FormSessionResolveBody = import_zod2.z.object({
  token: import_zod2.z.string().trim().min(8)
}).passthrough();
var FormSessionCompleteBody = import_zod2.z.object({
  token: import_zod2.z.string().trim().min(8),
  jotformSubmissionId: import_zod2.z.string().trim().nullish(),
  /** Optional normalized payload from the custom render path. */
  submission: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish()
}).passthrough();
function getWorkflowConfig(workflowId) {
  return WORKFLOW_CONFIGS[workflowId];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FORM_CONTEXT_KEYS,
  FormPrefillSnapshot,
  FormRenderMode,
  FormSessionCompleteBody,
  FormSessionCreateBody,
  FormSessionEntity,
  FormSessionResolveBody,
  FormSessionSource,
  FormSessionStatus,
  FormSubmissionSnapshot,
  FormWorkflowConfig,
  FormWorkflowId,
  WORKFLOW_CONFIGS,
  getWorkflowConfig
});
