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

// src/grants.ts
var grants_exports = {};
__export(grants_exports, {
  AgeOperator: () => AgeOperator,
  ConditionalTaskRule: () => ConditionalTaskRule,
  ConditionalTaskRuleType: () => ConditionalTaskRuleType,
  GRANT_PIN_COLORS: () => GRANT_PIN_COLORS,
  Grant: () => Grant,
  GrantBudget: () => GrantBudget,
  GrantBudgetBreakdownValidation: () => GrantBudgetBreakdownValidation,
  GrantBudgetDateRange: () => GrantBudgetDateRange,
  GrantBudgetDisplayLevel: () => GrantBudgetDisplayLevel,
  GrantBudgetItemDisplayConfig: () => GrantBudgetItemDisplayConfig,
  GrantBudgetLineItem: () => GrantBudgetLineItem,
  GrantBudgetRollForwardBehavior: () => GrantBudgetRollForwardBehavior,
  GrantBudgetSplitGoal: () => GrantBudgetSplitGoal,
  GrantBudgetSplitMode: () => GrantBudgetSplitMode,
  GrantBudgetTotals: () => GrantBudgetTotals,
  GrantComplianceConfig: () => GrantComplianceConfig,
  GrantComplianceControl: () => GrantComplianceControl,
  GrantCompliancePreset: () => GrantCompliancePreset,
  GrantCycleLink: () => GrantCycleLink,
  GrantDriveTemplate: () => GrantDriveTemplate,
  GrantDriveTemplateType: () => GrantDriveTemplateType,
  GrantEnrollmentDefaults: () => GrantEnrollmentDefaults,
  GrantEnrollmentLinkRule: () => GrantEnrollmentLinkRule,
  GrantEnrollmentRequirement: () => GrantEnrollmentRequirement,
  GrantEntity: () => GrantEntity,
  GrantFinancialConfig: () => GrantFinancialConfig,
  GrantFinancialConfigPatch: () => GrantFinancialConfigPatch,
  GrantFinancialModel: () => GrantFinancialModel,
  GrantInputSchema: () => GrantInputSchema,
  GrantInvoiceOption: () => GrantInvoiceOption,
  GrantInvoicing: () => GrantInvoicing,
  GrantInvoicingFrequency: () => GrantInvoicingFrequency,
  GrantKind: () => GrantKind,
  GrantLedgerMode: () => GrantLedgerMode,
  GrantLineItemCap: () => GrantLineItemCap,
  GrantLineItemInvoicing: () => GrantLineItemInvoicing,
  GrantLineItemType: () => GrantLineItemType,
  GrantLinking: () => GrantLinking,
  GrantPatchBody: () => GrantPatchBody,
  GrantPinDigest: () => GrantPinDigest,
  GrantPinImportant: () => GrantPinImportant,
  GrantPinInvoice: () => GrantPinInvoice,
  GrantPinRentalAssistance: () => GrantPinRentalAssistance,
  GrantPins: () => GrantPins,
  GrantStatus: () => GrantStatus,
  GrantTaskDefinitions: () => GrantTaskDefinitions,
  GrantUpsertBody: () => GrantUpsertBody,
  GrantsActivityQuery: () => GrantsActivityQuery,
  GrantsAdminClearEnrollmentsBody: () => GrantsAdminClearEnrollmentsBody,
  GrantsAdminClearPaymentsBody: () => GrantsAdminClearPaymentsBody,
  GrantsAdminDeleteBody: () => GrantsAdminDeleteBody,
  GrantsAdminPreviewQuery: () => GrantsAdminPreviewQuery,
  GrantsAdminReconcileBudgetBody: () => GrantsAdminReconcileBudgetBody,
  GrantsDeleteBody: () => GrantsDeleteBody,
  GrantsGetQuery: () => GrantsGetQuery,
  GrantsListQuery: () => GrantsListQuery,
  GrantsPatchBody: () => GrantsPatchBody,
  GrantsPatchRow: () => GrantsPatchRow,
  GrantsUpsertBody: () => GrantsUpsertBody,
  computeGrantLineItemOverCap: () => computeGrantLineItemOverCap,
  extractGoogleDriveFileId: () => extractGoogleDriveFileId,
  getGrantFinancialCapabilities: () => getGrantFinancialCapabilities,
  getGrantLineItemAmountSemantics: () => getGrantLineItemAmountSemantics,
  normalizeGrantComplianceConfig: () => normalizeGrantComplianceConfig,
  normalizeGrantDriveTemplates: () => normalizeGrantDriveTemplates,
  normalizeGrantFinancialConfig: () => normalizeGrantFinancialConfig,
  parseGrantMaxAssistanceMonths: () => parseGrantMaxAssistanceMonths,
  shouldRetainGrantBudget: () => shouldRetainGrantBudget,
  toArray: () => toArray
});
module.exports = __toCommonJS(grants_exports);

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
function toArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

// src/grants.ts
var GrantStatus = import_zod2.z.enum(["active", "draft", "closed", "deleted"]);
var GrantKind = import_zod2.z.enum(["grant", "program"]);
var GrantFinancialModel = import_zod2.z.enum(["budgeted", "billable", "serviceOnly"]);
var GrantLedgerMode = import_zod2.z.enum(["spendDown", "billing", "none"]);
var GrantCompliancePreset = import_zod2.z.enum(["hmisCaseworthy", "custom", "none"]);
var GrantComplianceControl = import_zod2.z.object({
  key: import_zod2.z.string().trim().min(1),
  label: import_zod2.z.string().trim().min(1),
  field: import_zod2.z.string().trim().min(1).optional(),
  type: import_zod2.z.enum(["boolean"]).default("boolean")
}).passthrough();
var GrantComplianceConfig = import_zod2.z.object({
  preset: GrantCompliancePreset.nullable().optional(),
  active: import_zod2.z.array(GrantComplianceControl).optional(),
  inactive: import_zod2.z.array(GrantComplianceControl).optional()
}).passthrough();
var GrantDriveTemplateType = import_zod2.z.enum(["doc", "sheet", "pdf", "other"]);
var DIRECT_DRIVE_ID_RE = /^[-\w]{20,}$/;
function extractGoogleDriveFileId(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  const byDoc = text.match(/\/document\/d\/([-\w]{20,})/i)?.[1];
  const bySheet = text.match(/\/spreadsheets\/d\/([-\w]{20,})/i)?.[1];
  const byFile = text.match(/\/file\/d\/([-\w]{20,})/i)?.[1];
  const byPresentation = text.match(/\/presentation\/d\/([-\w]{20,})/i)?.[1];
  const byOpen = text.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byDoc || bySheet || byFile || byPresentation || byOpen) {
    return byDoc || bySheet || byFile || byPresentation || byOpen || "";
  }
  return DIRECT_DRIVE_ID_RE.test(text) ? text : "";
}
function inferDriveTemplateType(input) {
  const text = String(input || "").toLowerCase();
  if (text.includes("/document/")) return "doc";
  if (text.includes("/spreadsheets/")) return "sheet";
  if (text.includes(".pdf") || text.includes("application/pdf")) return "pdf";
  return "other";
}
function normalizeGrantDriveTemplateInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value;
  const fileUrl = String(raw.fileUrl || raw.url || "").trim();
  const rawFileId = String(raw.fileId || raw.id || "").trim();
  const fileId = extractGoogleDriveFileId(rawFileId) || extractGoogleDriveFileId(fileUrl);
  return {
    ...raw,
    key: String(raw.key || fileId || rawFileId || raw.label || "").trim(),
    label: String(raw.label || raw.name || raw.key || "Template").trim(),
    fileId,
    fileUrl: fileUrl || (rawFileId && rawFileId !== fileId ? rawFileId : raw.fileUrl),
    type: raw.type || inferDriveTemplateType(fileUrl || rawFileId)
  };
}
var GrantDriveTemplate = import_zod2.z.preprocess(
  normalizeGrantDriveTemplateInput,
  import_zod2.z.object({
    key: import_zod2.z.string().trim().min(1).max(100),
    label: import_zod2.z.string().trim().min(1).max(200),
    fileId: import_zod2.z.string().trim().min(3).max(300),
    fileUrl: import_zod2.z.string().trim().max(800).nullish(),
    type: GrantDriveTemplateType.optional().default("other"),
    description: import_zod2.z.string().trim().max(500).nullish(),
    defaultChecked: import_zod2.z.boolean().optional().default(true)
  }).passthrough()
);
function normalizeGrantDriveTemplates(input) {
  const rows = Array.isArray(input) ? input : [];
  return rows.map((row) => GrantDriveTemplate.safeParse(row)).filter((result) => result.success).map((result) => result.data);
}
var GrantFinancialConfig = import_zod2.z.object({
  model: GrantFinancialModel,
  budgetEnabled: import_zod2.z.boolean(),
  billingEnabled: import_zod2.z.boolean(),
  allocationEnabled: import_zod2.z.boolean(),
  ledgerEnabled: import_zod2.z.boolean(),
  ledgerMode: GrantLedgerMode
}).passthrough();
var GrantFinancialConfigPatch = GrantFinancialConfig.partial().passthrough();
var FINANCIAL_CONFIG_DEFAULTS = {
  budgeted: {
    model: "budgeted",
    budgetEnabled: true,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: true,
    ledgerMode: "spendDown"
  },
  billable: {
    model: "billable",
    budgetEnabled: false,
    billingEnabled: true,
    allocationEnabled: false,
    ledgerEnabled: true,
    ledgerMode: "billing"
  },
  serviceOnly: {
    model: "serviceOnly",
    budgetEnabled: false,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: false,
    ledgerMode: "none"
  }
};
var HMIS_CASEWORTHY_COMPLIANCE_CONFIG = {
  preset: "hmisCaseworthy",
  active: [
    {
      key: "caseworthyEntryComplete",
      label: "CW Entry",
      field: "compliance.caseworthyEntryComplete",
      type: "boolean"
    },
    {
      key: "hmisEntryComplete",
      label: "HMIS Entry",
      field: "compliance.hmisEntryComplete",
      type: "boolean"
    }
  ],
  inactive: [
    {
      key: "caseworthyExitComplete",
      label: "CW Exit",
      field: "compliance.caseworthyExitComplete",
      type: "boolean"
    },
    {
      key: "hmisExitComplete",
      label: "HMIS Exit",
      field: "compliance.hmisExitComplete",
      type: "boolean"
    }
  ]
};
function normalizeComplianceControl(value) {
  if (!isPlainObject(value)) return null;
  const key = String(value.key || "").trim();
  const label = String(value.label || key).trim();
  if (!key || !label) return null;
  const field = String(value.field || `compliance.${key}`).trim();
  return {
    ...value,
    key,
    label,
    field,
    type: "boolean"
  };
}
function normalizeComplianceControls(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeComplianceControl(entry)).filter((entry) => !!entry);
}
function grantKindOf(value) {
  return String(value?.kind || "").trim().toLowerCase() === "program" ? "program" : "grant";
}
function parseFinancialModel(value) {
  const parsed = GrantFinancialModel.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function parseLedgerMode(value) {
  const parsed = GrantLedgerMode.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function parseCompliancePreset(value) {
  const parsed = GrantCompliancePreset.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function normalizeGrantFinancialConfig(grant) {
  const raw = isPlainObject(grant?.financialConfig) ? grant.financialConfig : {};
  const legacyAllocationEnabled = isPlainObject(grant?.budget) && grant.budget.allocationEnabled === true;
  const fallbackModel = grantKindOf(grant) === "grant" ? "budgeted" : "serviceOnly";
  const model = parseFinancialModel(raw.model) ?? fallbackModel;
  const defaults = FINANCIAL_CONFIG_DEFAULTS[model];
  const rawLedgerMode = parseLedgerMode(raw.ledgerMode);
  const next = {
    ...defaults,
    model,
    budgetEnabled: typeof raw.budgetEnabled === "boolean" ? raw.budgetEnabled : defaults.budgetEnabled,
    billingEnabled: typeof raw.billingEnabled === "boolean" ? raw.billingEnabled : defaults.billingEnabled,
    allocationEnabled: typeof raw.allocationEnabled === "boolean" ? raw.allocationEnabled : legacyAllocationEnabled || defaults.allocationEnabled,
    ledgerEnabled: typeof raw.ledgerEnabled === "boolean" ? raw.ledgerEnabled : defaults.ledgerEnabled,
    ledgerMode: rawLedgerMode ?? defaults.ledgerMode
  };
  if (next.ledgerMode === "none") next.ledgerEnabled = false;
  if (!next.ledgerEnabled) next.ledgerMode = "none";
  return next;
}
function normalizeGrantComplianceConfig(grant) {
  const raw = isPlainObject(grant?.complianceConfig) ? grant.complianceConfig : {};
  const preset = parseCompliancePreset(raw.preset) ?? "hmisCaseworthy";
  if (preset === "none") {
    return {
      ...raw,
      preset: "none",
      active: normalizeComplianceControls(raw.active),
      inactive: normalizeComplianceControls(raw.inactive)
    };
  }
  if (preset === "hmisCaseworthy" && !Array.isArray(raw.active) && !Array.isArray(raw.inactive)) {
    return HMIS_CASEWORTHY_COMPLIANCE_CONFIG;
  }
  return {
    ...raw,
    preset,
    active: normalizeComplianceControls(raw.active),
    inactive: normalizeComplianceControls(raw.inactive)
  };
}
function getGrantFinancialCapabilities(grant) {
  const config = normalizeGrantFinancialConfig(grant);
  const ledgerEnabled = config.ledgerEnabled && config.ledgerMode !== "none";
  const budgetEnabled = config.budgetEnabled;
  const billingEnabled = config.billingEnabled;
  const allocationEnabled = config.allocationEnabled;
  const drawsDownBudget = ledgerEnabled && config.ledgerMode === "spendDown" && budgetEnabled;
  const usesBillingLedger = ledgerEnabled && config.ledgerMode === "billing";
  return {
    config,
    budgetEnabled,
    billingEnabled,
    allocationEnabled,
    ledgerEnabled,
    ledgerMode: config.ledgerMode,
    drawsDownBudget,
    usesBillingLedger,
    hasFinancialActivity: budgetEnabled || billingEnabled || allocationEnabled || ledgerEnabled
  };
}
function shouldRetainGrantBudget(grant) {
  return getGrantFinancialCapabilities(grant).hasFinancialActivity;
}
function getGrantLineItemAmountSemantics(grant) {
  const capabilities = getGrantFinancialCapabilities(grant);
  const amountIsBudgetAllocation = capabilities.drawsDownBudget;
  return {
    drawsDownBudget: capabilities.drawsDownBudget,
    amountIsBudgetAllocation,
    amountIsBillingReference: capabilities.usesBillingLedger && !amountIsBudgetAllocation,
    amountCreatesOverCap: amountIsBudgetAllocation
  };
}
function computeGrantLineItemOverCap(grant, lineItem) {
  if (!getGrantLineItemAmountSemantics(grant).amountCreatesOverCap) return null;
  const amount = Number(lineItem?.amount || 0);
  const spent = Number(lineItem?.spent || 0);
  const projected = Number(lineItem?.projected || 0);
  if (!Number.isFinite(amount) || !Number.isFinite(spent) || !Number.isFinite(projected)) {
    return null;
  }
  const over = Math.max(0, spent + projected - amount);
  return over > 0 ? over : null;
}
var Num = import_zod2.z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var NullablePositiveInt = import_zod2.z.coerce.number().int().min(1).max(240).nullable();
function parseGrantMaxAssistanceMonths(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1) return null;
    return Math.max(1, Math.min(240, Math.floor(value)));
  }
  const text = String(value || "").trim();
  if (!text) return null;
  const direct = Number(text);
  if (Number.isFinite(direct) && direct >= 1) {
    return Math.max(1, Math.min(240, Math.floor(direct)));
  }
  const match = text.match(/(\d{1,3})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.max(1, Math.min(240, Math.floor(parsed)));
}
var GrantLineItemTypeInput = import_zod2.z.preprocess((v) => {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || ["na", "n/a", "none", "null"].includes(s.toLowerCase())) return null;
    return { label: s };
  }
  if (typeof v === "object") {
    const o = v;
    const raw = String(o.label ?? o.name ?? o.id ?? "").trim();
    if (!raw || ["na", "n/a", "none", "null"].includes(raw.toLowerCase())) return null;
    if (!o.label) return { ...o, label: raw };
  }
  return v;
}, import_zod2.z.object({
  id: import_zod2.z.string().trim().min(1).optional(),
  label: import_zod2.z.string().trim().min(1)
}).passthrough().nullable());
var GrantLineItemType = GrantLineItemTypeInput;
var GrantLineItemCap = import_zod2.z.object({
  /** Hard cap (USD) per enrolled customer for this line item. null = no cap. */
  perCustomerCap: import_zod2.z.number().min(0).nullish(),
  /** Whether the cap is actively enforced (shows warnings / blocks posting when exceeded). */
  capEnabled: import_zod2.z.boolean().default(false)
}).passthrough();
var GrantBudgetSplitMode = import_zod2.z.enum(["none", "fixed", "monthly", "quarterly", "custom"]);
var GrantBudgetRollForwardBehavior = import_zod2.z.enum([
  "none",
  "rollToNext",
  "rollToEnd",
  "rebalanceFuture",
  "manual"
]);
var GrantBudgetDisplayLevel = import_zod2.z.enum(["grant", "lineItem", "split"]);
var GrantBudgetDateRange = import_zod2.z.object({
  startDate: import_zod2.z.string().trim().nullish(),
  endDate: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantBudgetSplitGoal = import_zod2.z.object({
  id: import_zod2.z.string().trim().min(1).optional(),
  label: import_zod2.z.string().trim().nullish(),
  startDate: import_zod2.z.string().trim().nullish(),
  endDate: import_zod2.z.string().trim().nullish(),
  amount: Num,
  spent: Num.optional(),
  projected: Num.optional(),
  balance: Num.optional(),
  projectedBalance: Num.optional(),
  includeAllBudgetItems: import_zod2.z.boolean().optional(),
  notes: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantBudgetItemDisplayConfig = import_zod2.z.object({
  /** Budget card cycle presentation. Missing values preserve the legacy total view. */
  cycleDisplayMode: import_zod2.z.enum(["split", "total"]).optional(),
  /** Explicit digest participation. `appearInDigest` remains a legacy read alias. */
  displayOnDigest: import_zod2.z.boolean().optional(),
  digestDisplayMode: import_zod2.z.enum(["currentCycle", "total", "both"]).optional(),
  showGrantTotal: import_zod2.z.boolean().optional(),
  showLineItemTotal: import_zod2.z.boolean().optional(),
  showSplitGoals: import_zod2.z.boolean().optional(),
  appearInDigest: import_zod2.z.boolean().optional(),
  displayAs: import_zod2.z.enum(["main", "nested"]).optional(),
  mainDisplayLevel: GrantBudgetDisplayLevel.optional(),
  groupUnderParentGrant: import_zod2.z.boolean().optional(),
  expandedByDefault: import_zod2.z.boolean().optional()
}).passthrough();
var GrantBudgetBreakdownValidation = import_zod2.z.object({
  status: import_zod2.z.enum(["ok", "warning"]).default("ok"),
  message: import_zod2.z.string().trim().optional(),
  splitTotal: Num.optional(),
  variance: Num.optional()
}).passthrough();
var GrantInvoiceOption = import_zod2.z.object({
  id: import_zod2.z.string().trim().min(1),
  label: import_zod2.z.string().trim().min(1),
  code: import_zod2.z.string().trim().nullish(),
  template: import_zod2.z.string().trim().nullish(),
  enabled: import_zod2.z.boolean().optional(),
  custom: import_zod2.z.boolean().optional()
}).passthrough();
var GrantLineItemInvoicing = import_zod2.z.object({
  functionalGroup: import_zod2.z.string().trim().nullish(),
  grantCode: import_zod2.z.string().trim().nullish(),
  programCode: import_zod2.z.string().trim().nullish(),
  hmisCode: import_zod2.z.string().trim().nullish(),
  expenseCategories: import_zod2.z.array(GrantInvoiceOption).nullish(),
  descriptionTemplates: import_zod2.z.array(GrantInvoiceOption).nullish()
}).passthrough();
var GrantBudgetLineItem = import_zod2.z.object({
  id: Id.optional(),
  // server fills if missing
  label: import_zod2.z.string().trim().nullish(),
  amount: Num,
  projected: Num,
  spent: Num,
  projectedInWindow: Num.optional(),
  spentInWindow: Num.optional(),
  locked: import_zod2.z.boolean().nullish(),
  /**
   * Open line-item grouping object for reporting across grants.
   * null = uncategorized / N/A. Frontend can add new categories by writing
   * any { id, label } pair; current defaults include Rental Assistance,
   * Program Spending, and Customer Support Service.
   */
  type: GrantLineItemType.nullish(),
  // ── Per-customer cap (optional) ──────────────────────────────────────────
  /** USD cap per enrolled customer on this line item. Only enforced if capEnabled. */
  perCustomerCap: import_zod2.z.number().min(0).nullish(),
  capEnabled: import_zod2.z.boolean().default(false),
  /**
   * Optional planning breakdown under this line item. The line-item amount
   * remains the budget source of truth; split goals are planning windows.
   */
  splitMode: GrantBudgetSplitMode.optional().default("none"),
  rollForward: GrantBudgetRollForwardBehavior.optional().default("none"),
  splitStartDate: import_zod2.z.string().trim().nullish(),
  splitEndDate: import_zod2.z.string().trim().nullish(),
  splitGoals: import_zod2.z.array(GrantBudgetSplitGoal).optional().default([]),
  display: GrantBudgetItemDisplayConfig.nullish(),
  breakdownValidation: GrantBudgetBreakdownValidation.nullish(),
  /** Invoice metadata for this line item. Grant-level invoicing remains legacy read compatibility. */
  invoicing: GrantLineItemInvoicing.nullish()
}).passthrough();
var GrantBudgetTotals = import_zod2.z.object({
  total: Num,
  projected: Num,
  spent: Num,
  balance: Num.optional(),
  projectedBalance: Num.optional(),
  /** spent + projected — total dollars allocated (committed + future obligations) */
  projectedSpend: Num.optional(),
  // compat alias (service writes this)
  remaining: Num.optional(),
  projectedInWindow: Num.optional(),
  spentInWindow: Num.optional(),
  windowBalance: Num.optional(),
  windowProjectedBalance: Num.optional()
}).passthrough();
var GrantBudget = import_zod2.z.object({
  total: Num,
  totals: GrantBudgetTotals.nullish(),
  lineItems: import_zod2.z.array(GrantBudgetLineItem).default([]),
  digestDisplay: import_zod2.z.object({
    showOverallSummary: import_zod2.z.boolean().optional().default(true),
    showGrantTotals: import_zod2.z.boolean().optional().default(true),
    mainDisplayLevel: GrantBudgetDisplayLevel.optional().default("grant"),
    expandNestedRowsByDefault: import_zod2.z.boolean().optional().default(false),
    groupChildrenUnderParentGrant: import_zod2.z.boolean().optional().default(true)
  }).passthrough().nullish(),
  /**
   * When true, this grant/program tracks per-customer allocations and shows
   * the Allocation tab on budget cards and grant detail.
   */
  allocationEnabled: import_zod2.z.boolean().optional(),
  /**
   * Optional grant-level cap per customer (USD across all line items).
   * null = no grant-level cap (line items may still have their own caps).
   */
  perCustomerCap: import_zod2.z.number().min(0).nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var ConditionalTaskRuleType = import_zod2.z.enum(["age", "population", "concurrent_enrollment"]);
var AgeOperator = import_zod2.z.enum([">=", "<=", ">", "<"]);
var ConditionalTaskRule = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  /** Human-readable description of this rule (e.g. "Under 18 — youth compliance") */
  name: import_zod2.z.string().trim().min(1),
  type: ConditionalTaskRuleType,
  // ── Age condition ────────────────────────────────────────────────────────
  /** Comparison operator applied to the enrollee's age in years */
  ageOperator: AgeOperator.optional(),
  /** Age threshold in years */
  ageThreshold: import_zod2.z.number().int().min(0).optional(),
  // ── Concurrent-enrollment condition ──────────────────────────────────────
  /**
   * Grant name (or substring) to match in the enrollee's other active
   * enrollments on the start date.  Case-insensitive substring match.
   */
  programName: import_zod2.z.string().trim().optional(),
  /** Match against customer/enrollment population. Accepts Youth, Individual, or Family. */
  population: import_zod2.z.enum(["Youth", "Individual", "Family"]).optional(),
  populations: import_zod2.z.array(import_zod2.z.enum(["Youth", "Individual", "Family"])).optional(),
  // ── Task definition ──────────────────────────────────────────────────────
  taskName: import_zod2.z.string().trim().min(1),
  taskDescription: import_zod2.z.string().trim().nullish(),
  taskBucket: import_zod2.z.string().trim().default("task"),
  /** Days from enrollment.startDate until the task is due. null → due on start date. */
  dueOffsetDays: import_zod2.z.number().int().nullish(),
  assignToGroup: import_zod2.z.enum(["admin", "compliance", "casemanager"]).default("casemanager"),
  taskNotes: import_zod2.z.string().trim().nullish(),
  /** Optional recurrence for condition-created reminders. Defaults to one-off. */
  kind: import_zod2.z.enum(["one-off", "recurring"]).optional(),
  frequency: import_zod2.z.string().trim().nullish(),
  every: import_zod2.z.number().int().min(1).nullish(),
  dueDate: import_zod2.z.string().trim().nullish(),
  endDate: import_zod2.z.string().trim().nullish(),
  notify: import_zod2.z.boolean().optional()
}).passthrough();
var GrantTaskDefinitions = import_zod2.z.union([
  import_zod2.z.array(import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown())),
  import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown())
]);
var GRANT_PIN_COLORS = ["red", "amber", "emerald", "sky", "violet", "rose", "orange"];
var GrantPinImportant = import_zod2.z.object({
  enabled: import_zod2.z.boolean().default(false),
  label: import_zod2.z.string().trim().nullish(),
  color: import_zod2.z.enum(GRANT_PIN_COLORS).nullish(),
  note: import_zod2.z.string().trim().nullish(),
  pinnedAt: TsLike.nullish(),
  pinnedBy: import_zod2.z.string().trim().nullish(),
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish()
}).passthrough();
var GrantPinDigest = import_zod2.z.object({
  enabled: import_zod2.z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantPinRentalAssistance = import_zod2.z.object({
  enabled: import_zod2.z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantPinInvoice = import_zod2.z.object({
  enabled: import_zod2.z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: import_zod2.z.string().trim().nullish(),
  label: import_zod2.z.string().trim().nullish(),
  note: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantPins = import_zod2.z.object({
  // System pins
  digest: GrantPinDigest.nullish(),
  rentalAssistance: GrantPinRentalAssistance.nullish(),
  invoice: GrantPinInvoice.nullish(),
  // Legacy
  important: GrantPinImportant.nullish()
}).passthrough();
var GrantInvoicingFrequency = import_zod2.z.enum(["monthly", "quarterly", "annually", "on-demand"]);
var GrantInvoicing = import_zod2.z.object({
  /** Grant identifier used on invoices / reimbursement requests */
  grantCode: import_zod2.z.string().trim().nullish(),
  /** Functional group used by invoice/payment exports */
  functionalGroup: import_zod2.z.string().trim().nullish(),
  /** Expense category options this grant can surface in invoice/payment workflows */
  expenseCategories: import_zod2.z.array(GrantInvoiceOption).nullish(),
  /** Description templates this grant can surface in invoice/payment workflows */
  descriptionTemplates: import_zod2.z.array(GrantInvoiceOption).nullish(),
  /** Separate invoice code if the invoicing code differs from the grant code */
  invoiceCode: import_zod2.z.string().trim().nullish(),
  /** Program or funding-source code (e.g. federal program code) */
  programCode: import_zod2.z.string().trim().nullish(),
  /** Contract number with the funder */
  contractNumber: import_zod2.z.string().trim().nullish(),
  /** Vendor or supplier number assigned by the funder */
  vendorNumber: import_zod2.z.string().trim().nullish(),
  /** Name of the funder / grantor agency */
  funder: import_zod2.z.string().trim().nullish(),
  /** Primary contact name at the funder for invoicing */
  funderContact: import_zod2.z.string().trim().nullish(),
  /** Funder contact email */
  funderEmail: import_zod2.z.string().trim().nullish(),
  /** How often invoices are submitted */
  frequency: GrantInvoicingFrequency.nullish(),
  /** Day of month the invoice is due (1–28) */
  dueDayOfMonth: import_zod2.z.number().int().min(1).max(28).nullish(),
  /** Payment terms (e.g. "Net 30", "Net 60") */
  paymentTerms: import_zod2.z.string().trim().nullish(),
  /** Billing address (free-form) */
  billingAddress: import_zod2.z.string().trim().nullish(),
  /** Submission portal URL or platform name */
  submissionPortal: import_zod2.z.string().trim().nullish(),
  /** Reporting requirements or schedule */
  reportingNotes: import_zod2.z.string().trim().nullish(),
  /** General invoicing notes */
  notes: import_zod2.z.string().trim().nullish(),
  /** Open-ended meta for org-specific invoicing fields */
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish()
}).passthrough();
var GrantEnrollmentDefaults = import_zod2.z.object({
  authorizationMonths: import_zod2.z.number().int().min(1).max(120).nullable().optional(),
  serviceStatus: import_zod2.z.enum(["active", "paused"]).nullable().optional(),
  medicaidStatus: import_zod2.z.enum(["active", "closed"]).nullable().optional()
}).passthrough();
var GrantCycleLink = import_zod2.z.object({
  previousGrantId: Id.nullable().optional(),
  nextGrantId: Id.nullable().optional()
}).passthrough();
var GrantEnrollmentLinkRule = import_zod2.z.object({
  targetGrantId: Id,
  onEnroll: import_zod2.z.literal("ensureActive").default("ensureActive"),
  onAllSourcesClosed: import_zod2.z.literal("flagShouldUnenroll").default("flagShouldUnenroll")
}).passthrough();
var GrantEnrollmentRequirement = import_zod2.z.object({
  operator: import_zod2.z.enum(["all", "any"]).default("all"),
  targetGrantIds: import_zod2.z.array(Id).min(1).max(20),
  behavior: import_zod2.z.literal("warnOnly").default("warnOnly")
}).passthrough();
var GrantLinking = import_zod2.z.object({
  cycle: GrantCycleLink.nullish(),
  /** Enrollment eligibility requirement. Consumers surface warnings only. */
  enrollmentRequirement: GrantEnrollmentRequirement.nullish(),
  /** Legacy enrollment automation rules retained for read compatibility. */
  enrollmentRules: import_zod2.z.array(GrantEnrollmentLinkRule).max(20).default([])
}).passthrough();
var GrantInputSchema = import_zod2.z.object({
  id: Id.optional(),
  name: import_zod2.z.string().trim().min(1),
  status: GrantStatus.optional(),
  active: import_zod2.z.boolean().optional(),
  // server-derived
  deleted: import_zod2.z.boolean().optional(),
  // server-derived
  // server authoritative (but accepted for dev/explicit org targeting)
  orgId: Id.nullish(),
  kind: GrantKind.optional(),
  financialConfig: GrantFinancialConfigPatch.nullish(),
  duration: import_zod2.z.string().trim().nullish().default("1 Year"),
  lengthOfAssistance: import_zod2.z.string().trim().nullish(),
  maxAssistanceMonths: NullablePositiveInt.nullish(),
  // Date | Timestamp | ISO string; server normalizes
  startDate: import_zod2.z.unknown().optional(),
  endDate: import_zod2.z.unknown().optional(),
  // Only allowed when kind="grant" (service enforces)
  budget: GrantBudget.nullish(),
  taskTypes: import_zod2.z.array(import_zod2.z.string().trim()).nullish(),
  tasks: GrantTaskDefinitions.nullish(),
  complianceConfig: GrantComplianceConfig.nullish(),
  driveTemplates: import_zod2.z.array(GrantDriveTemplate).nullish(),
  /** Conditional task rules evaluated on each new enrollment. */
  conditionalTaskRules: import_zod2.z.array(ConditionalTaskRule).nullish(),
  /**
   * Org-visible pins on the grant object itself. Distinct from user-level
   * dashboard/favorite pins (those live in userExtras).
   */
  pins: GrantPins.nullish(),
  /** Optional invoicing metadata: codes, funder contacts, billing details. */
  invoicing: GrantInvoicing.nullish(),
  /** Optional enrollment defaults such as TSS authorization windows. */
  enrollmentDefaults: GrantEnrollmentDefaults.nullish(),
  /** Explicit lifecycle links. Navigation-only related* fields below do not drive automation. */
  linking: GrantLinking.nullish(),
  /** Optional documents expected for payment/invoice processing. */
  invoiceDocuments: import_zod2.z.array(import_zod2.z.string().trim()).nullish(),
  /** Optional internal guidance mapping assistance levels to eligibility criteria. */
  levelOfAssistance: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).nullish(),
  /**
   * Optional relationship hints for reporting/navigation.
   * These are not required for enrollment; enrollments still use grantId/grantName.
   */
  programIds: import_zod2.z.array(IdLike).nullish(),
  fundingGrantIds: import_zod2.z.array(IdLike).nullish(),
  relatedProgramIds: import_zod2.z.array(IdLike).nullish(),
  relatedGrantIds: import_zod2.z.array(IdLike).nullish(),
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var Grant = GrantInputSchema;
var GrantEntity = GrantInputSchema.extend({
  id: Id
}).passthrough();
function stripPatchServerFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const row = { ...value };
  const rawPatch = row.patch;
  if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) return row;
  const patch = { ...rawPatch };
  delete patch.createdAt;
  delete patch.updatedAt;
  delete patch.deletedAt;
  delete patch.active;
  delete patch.deleted;
  delete patch._tags;
  delete patch.system;
  if (patch.budget && typeof patch.budget === "object" && !Array.isArray(patch.budget)) {
    const budget = { ...patch.budget };
    delete budget.createdAt;
    delete budget.updatedAt;
    patch.budget = budget;
  }
  row.patch = patch;
  return row;
}
function stripGrantServerFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const grant = { ...value };
  delete grant.createdAt;
  delete grant.updatedAt;
  delete grant.deletedAt;
  delete grant.active;
  delete grant.deleted;
  delete grant._tags;
  delete grant.system;
  if (grant.budget && typeof grant.budget === "object" && !Array.isArray(grant.budget)) {
    const budget = { ...grant.budget };
    delete budget.createdAt;
    delete budget.updatedAt;
    grant.budget = budget;
  }
  return grant;
}
var GrantsUpsertBody = import_zod2.z.union([
  import_zod2.z.preprocess(stripGrantServerFields, GrantInputSchema),
  import_zod2.z.array(import_zod2.z.preprocess(stripGrantServerFields, GrantInputSchema)).min(1)
]);
var GrantUpsertBody = GrantsUpsertBody;
var GrantsPatchRow = import_zod2.z.preprocess(
  stripPatchServerFields,
  import_zod2.z.object({
    id: Id,
    patch: GrantInputSchema.partial().passthrough(),
    unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
  }).passthrough()
).refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var GrantsPatchBody = import_zod2.z.union([
  GrantsPatchRow,
  import_zod2.z.array(GrantsPatchRow).min(1)
]);
var GrantPatchBody = GrantsPatchBody;
var GrantsDeleteBody = import_zod2.z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  import_zod2.z.union([IdLike, import_zod2.z.array(IdLike).min(1)])
);
var GrantsAdminDeleteBody = GrantsDeleteBody;
var ActiveFilter = import_zod2.z.preprocess(
  (v) => {
    if (v === "" || v == null) return void 0;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
    if (Array.isArray(v)) return v[0];
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "y", "active"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
    }
    return v;
  },
  import_zod2.z.union([import_zod2.z.literal(true), import_zod2.z.literal(false)])
);
var GrantsListQuery = import_zod2.z.object({
  status: import_zod2.z.string().trim().optional(),
  active: import_zod2.z.union([ActiveFilter, BoolLike, import_zod2.z.string()]).optional(),
  kind: import_zod2.z.union([GrantKind, import_zod2.z.string()]).optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  // dev explicit org targeting (matches handler behavior)
  orgId: IdLike.optional()
}).passthrough();
var GrantsGetQuery = import_zod2.z.object({ id: IdLike, orgId: IdLike.optional() }).passthrough();
var GrantsActivityQuery = import_zod2.z.object({
  grantId: IdLike,
  limit: import_zod2.z.coerce.number().int().min(1).max(1e3).optional(),
  cursor: import_zod2.z.string().trim().optional(),
  includeProjected: import_zod2.z.union([BoolLike, import_zod2.z.string()]).optional(),
  orgId: IdLike.optional()
}).passthrough();
var GrantsAdminPreviewQuery = import_zod2.z.object({ grantId: IdLike });
var GrantsAdminClearPaymentsBody = import_zod2.z.object({
  grantId: IdLike,
  confirm: import_zod2.z.literal("DELETE")
});
var GrantsAdminClearEnrollmentsBody = import_zod2.z.object({
  grantId: IdLike,
  confirm: import_zod2.z.literal("DELETE"),
  statuses: import_zod2.z.array(import_zod2.z.enum(["active", "inactive", "deleted"])).min(1).optional()
});
var GrantsAdminReconcileBudgetBody = import_zod2.z.object({
  grantId: IdLike
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgeOperator,
  ConditionalTaskRule,
  ConditionalTaskRuleType,
  GRANT_PIN_COLORS,
  Grant,
  GrantBudget,
  GrantBudgetBreakdownValidation,
  GrantBudgetDateRange,
  GrantBudgetDisplayLevel,
  GrantBudgetItemDisplayConfig,
  GrantBudgetLineItem,
  GrantBudgetRollForwardBehavior,
  GrantBudgetSplitGoal,
  GrantBudgetSplitMode,
  GrantBudgetTotals,
  GrantComplianceConfig,
  GrantComplianceControl,
  GrantCompliancePreset,
  GrantCycleLink,
  GrantDriveTemplate,
  GrantDriveTemplateType,
  GrantEnrollmentDefaults,
  GrantEnrollmentLinkRule,
  GrantEnrollmentRequirement,
  GrantEntity,
  GrantFinancialConfig,
  GrantFinancialConfigPatch,
  GrantFinancialModel,
  GrantInputSchema,
  GrantInvoiceOption,
  GrantInvoicing,
  GrantInvoicingFrequency,
  GrantKind,
  GrantLedgerMode,
  GrantLineItemCap,
  GrantLineItemInvoicing,
  GrantLineItemType,
  GrantLinking,
  GrantPatchBody,
  GrantPinDigest,
  GrantPinImportant,
  GrantPinInvoice,
  GrantPinRentalAssistance,
  GrantPins,
  GrantStatus,
  GrantTaskDefinitions,
  GrantUpsertBody,
  GrantsActivityQuery,
  GrantsAdminClearEnrollmentsBody,
  GrantsAdminClearPaymentsBody,
  GrantsAdminDeleteBody,
  GrantsAdminPreviewQuery,
  GrantsAdminReconcileBudgetBody,
  GrantsDeleteBody,
  GrantsGetQuery,
  GrantsListQuery,
  GrantsPatchBody,
  GrantsPatchRow,
  GrantsUpsertBody,
  computeGrantLineItemOverCap,
  extractGoogleDriveFileId,
  getGrantFinancialCapabilities,
  getGrantLineItemAmountSemantics,
  normalizeGrantComplianceConfig,
  normalizeGrantDriveTemplates,
  normalizeGrantFinancialConfig,
  parseGrantMaxAssistanceMonths,
  shouldRetainGrantBudget,
  toArray
});
