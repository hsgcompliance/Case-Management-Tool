import {
  BoolLike,
  Id,
  IdLike,
  TsLike,
  toArray,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

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
var GrantStatus = z.enum(["active", "draft", "closed", "deleted"]);
var GrantKind = z.enum(["grant", "program"]);
var GrantFinancialModel = z.enum(["budgeted", "billable", "serviceOnly"]);
var GrantLedgerMode = z.enum(["spendDown", "billing", "none"]);
var GrantCompliancePreset = z.enum(["hmisCaseworthy", "custom", "none"]);
var GrantComplianceControl = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  field: z.string().trim().min(1).optional(),
  type: z.enum(["boolean"]).default("boolean")
}).passthrough();
var GrantComplianceConfig = z.object({
  preset: GrantCompliancePreset.nullable().optional(),
  active: z.array(GrantComplianceControl).optional(),
  inactive: z.array(GrantComplianceControl).optional()
}).passthrough();
var GrantDriveTemplateType = z.enum(["doc", "sheet", "pdf", "other"]);
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
var GrantDriveTemplate = z.preprocess(
  normalizeGrantDriveTemplateInput,
  z.object({
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(200),
    fileId: z.string().trim().min(3).max(300),
    fileUrl: z.string().trim().max(800).nullish(),
    type: GrantDriveTemplateType.optional().default("other"),
    description: z.string().trim().max(500).nullish(),
    defaultChecked: z.boolean().optional().default(true)
  }).passthrough()
);
function normalizeGrantDriveTemplates(input) {
  const rows = Array.isArray(input) ? input : [];
  return rows.map((row) => GrantDriveTemplate.safeParse(row)).filter((result) => result.success).map((result) => result.data);
}
var GrantFinancialConfig = z.object({
  model: GrantFinancialModel,
  budgetEnabled: z.boolean(),
  billingEnabled: z.boolean(),
  allocationEnabled: z.boolean(),
  ledgerEnabled: z.boolean(),
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
var Num = z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var NullablePositiveInt = z.coerce.number().int().min(1).max(240).nullable();
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
var GrantLineItemTypeInput = z.preprocess((v) => {
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
}, z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1)
}).passthrough().nullable());
var GrantLineItemType = GrantLineItemTypeInput;
var GrantLineItemCap = z.object({
  /** Hard cap (USD) per enrolled customer for this line item. null = no cap. */
  perCustomerCap: z.number().min(0).nullish(),
  /** Whether the cap is actively enforced (shows warnings / blocks posting when exceeded). */
  capEnabled: z.boolean().default(false)
}).passthrough();
var GrantBudgetSplitMode = z.enum(["none", "fixed", "monthly", "quarterly", "custom"]);
var GrantBudgetRollForwardBehavior = z.enum([
  "none",
  "rollToNext",
  "rollToEnd",
  "rebalanceFuture",
  "manual"
]);
var GrantBudgetDisplayLevel = z.enum(["grant", "lineItem", "split"]);
var GrantBudgetDateRange = z.object({
  startDate: z.string().trim().nullish(),
  endDate: z.string().trim().nullish()
}).passthrough();
var GrantBudgetSplitGoal = z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().nullish(),
  startDate: z.string().trim().nullish(),
  endDate: z.string().trim().nullish(),
  amount: Num,
  spent: Num.optional(),
  projected: Num.optional(),
  balance: Num.optional(),
  projectedBalance: Num.optional(),
  includeAllBudgetItems: z.boolean().optional(),
  notes: z.string().trim().nullish()
}).passthrough();
var GrantBudgetItemDisplayConfig = z.object({
  /** Budget card cycle presentation. Missing values preserve the legacy total view. */
  cycleDisplayMode: z.enum(["split", "total"]).optional(),
  /** Explicit digest participation. `appearInDigest` remains a legacy read alias. */
  displayOnDigest: z.boolean().optional(),
  digestDisplayMode: z.enum(["currentCycle", "total", "both"]).optional(),
  showGrantTotal: z.boolean().optional(),
  showLineItemTotal: z.boolean().optional(),
  showSplitGoals: z.boolean().optional(),
  appearInDigest: z.boolean().optional(),
  displayAs: z.enum(["main", "nested"]).optional(),
  mainDisplayLevel: GrantBudgetDisplayLevel.optional(),
  groupUnderParentGrant: z.boolean().optional(),
  expandedByDefault: z.boolean().optional()
}).passthrough();
var GrantBudgetBreakdownValidation = z.object({
  status: z.enum(["ok", "warning"]).default("ok"),
  message: z.string().trim().optional(),
  splitTotal: Num.optional(),
  variance: Num.optional()
}).passthrough();
var GrantInvoiceOption = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  code: z.string().trim().nullish(),
  template: z.string().trim().nullish(),
  enabled: z.boolean().optional(),
  custom: z.boolean().optional()
}).passthrough();
var GrantLineItemInvoicing = z.object({
  functionalGroup: z.string().trim().nullish(),
  grantCode: z.string().trim().nullish(),
  programCode: z.string().trim().nullish(),
  hmisCode: z.string().trim().nullish(),
  expenseCategories: z.array(GrantInvoiceOption).nullish(),
  descriptionTemplates: z.array(GrantInvoiceOption).nullish()
}).passthrough();
var GrantBudgetLineItem = z.object({
  id: Id.optional(),
  // server fills if missing
  label: z.string().trim().nullish(),
  amount: Num,
  projected: Num,
  spent: Num,
  projectedInWindow: Num.optional(),
  spentInWindow: Num.optional(),
  locked: z.boolean().nullish(),
  /**
   * Open line-item grouping object for reporting across grants.
   * null = uncategorized / N/A. Frontend can add new categories by writing
   * any { id, label } pair; current defaults include Rental Assistance,
   * Program Spending, and Customer Support Service.
   */
  type: GrantLineItemType.nullish(),
  // ── Per-customer cap (optional) ──────────────────────────────────────────
  /** USD cap per enrolled customer on this line item. Only enforced if capEnabled. */
  perCustomerCap: z.number().min(0).nullish(),
  capEnabled: z.boolean().default(false),
  /**
   * Optional planning breakdown under this line item. The line-item amount
   * remains the budget source of truth; split goals are planning windows.
   */
  splitMode: GrantBudgetSplitMode.optional().default("none"),
  rollForward: GrantBudgetRollForwardBehavior.optional().default("none"),
  splitStartDate: z.string().trim().nullish(),
  splitEndDate: z.string().trim().nullish(),
  splitGoals: z.array(GrantBudgetSplitGoal).optional().default([]),
  display: GrantBudgetItemDisplayConfig.nullish(),
  breakdownValidation: GrantBudgetBreakdownValidation.nullish(),
  /** Invoice metadata for this line item. Grant-level invoicing remains legacy read compatibility. */
  invoicing: GrantLineItemInvoicing.nullish()
}).passthrough();
var GrantBudgetTotals = z.object({
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
var GrantBudget = z.object({
  total: Num,
  totals: GrantBudgetTotals.nullish(),
  lineItems: z.array(GrantBudgetLineItem).default([]),
  digestDisplay: z.object({
    showOverallSummary: z.boolean().optional().default(true),
    showGrantTotals: z.boolean().optional().default(true),
    mainDisplayLevel: GrantBudgetDisplayLevel.optional().default("grant"),
    expandNestedRowsByDefault: z.boolean().optional().default(false),
    groupChildrenUnderParentGrant: z.boolean().optional().default(true)
  }).passthrough().nullish(),
  /**
   * When true, this grant/program tracks per-customer allocations and shows
   * the Allocation tab on budget cards and grant detail.
   */
  allocationEnabled: z.boolean().optional(),
  /**
   * Optional grant-level cap per customer (USD across all line items).
   * null = no grant-level cap (line items may still have their own caps).
   */
  perCustomerCap: z.number().min(0).nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var ConditionalTaskRuleType = z.enum(["age", "population", "concurrent_enrollment"]);
var AgeOperator = z.enum([">=", "<=", ">", "<"]);
var ConditionalTaskRule = z.object({
  id: z.string().min(1),
  /** Human-readable description of this rule (e.g. "Under 18 — youth compliance") */
  name: z.string().trim().min(1),
  type: ConditionalTaskRuleType,
  // ── Age condition ────────────────────────────────────────────────────────
  /** Comparison operator applied to the enrollee's age in years */
  ageOperator: AgeOperator.optional(),
  /** Age threshold in years */
  ageThreshold: z.number().int().min(0).optional(),
  // ── Concurrent-enrollment condition ──────────────────────────────────────
  /**
   * Grant name (or substring) to match in the enrollee's other active
   * enrollments on the start date.  Case-insensitive substring match.
   */
  programName: z.string().trim().optional(),
  /** Match against customer/enrollment population. Accepts Youth, Individual, or Family. */
  population: z.enum(["Youth", "Individual", "Family"]).optional(),
  populations: z.array(z.enum(["Youth", "Individual", "Family"])).optional(),
  // ── Task definition ──────────────────────────────────────────────────────
  taskName: z.string().trim().min(1),
  taskDescription: z.string().trim().nullish(),
  taskBucket: z.string().trim().default("task"),
  /** Days from enrollment.startDate until the task is due. null → due on start date. */
  dueOffsetDays: z.number().int().nullish(),
  assignToGroup: z.enum(["admin", "compliance", "casemanager"]).default("casemanager"),
  taskNotes: z.string().trim().nullish(),
  /** Optional recurrence for condition-created reminders. Defaults to one-off. */
  kind: z.enum(["one-off", "recurring"]).optional(),
  frequency: z.string().trim().nullish(),
  every: z.number().int().min(1).nullish(),
  dueDate: z.string().trim().nullish(),
  endDate: z.string().trim().nullish(),
  notify: z.boolean().optional()
}).passthrough();
var GrantTaskDefinitions = z.union([
  z.array(z.record(z.string(), z.unknown())),
  z.record(z.string(), z.unknown())
]);
var GRANT_PIN_COLORS = ["red", "amber", "emerald", "sky", "violet", "rose", "orange"];
var GrantPinImportant = z.object({
  enabled: z.boolean().default(false),
  label: z.string().trim().nullish(),
  color: z.enum(GRANT_PIN_COLORS).nullish(),
  note: z.string().trim().nullish(),
  pinnedAt: TsLike.nullish(),
  pinnedBy: z.string().trim().nullish(),
  meta: z.record(z.string(), z.unknown()).nullish()
}).passthrough();
var GrantPinDigest = z.object({
  enabled: z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: z.string().trim().nullish()
}).passthrough();
var GrantPinRentalAssistance = z.object({
  enabled: z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: z.string().trim().nullish()
}).passthrough();
var GrantPinInvoice = z.object({
  enabled: z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: z.string().trim().nullish(),
  label: z.string().trim().nullish(),
  note: z.string().trim().nullish()
}).passthrough();
var GrantPins = z.object({
  // System pins
  digest: GrantPinDigest.nullish(),
  rentalAssistance: GrantPinRentalAssistance.nullish(),
  invoice: GrantPinInvoice.nullish(),
  // Legacy
  important: GrantPinImportant.nullish()
}).passthrough();
var GrantInvoicingFrequency = z.enum(["monthly", "quarterly", "annually", "on-demand"]);
var GrantInvoicing = z.object({
  /** Grant identifier used on invoices / reimbursement requests */
  grantCode: z.string().trim().nullish(),
  /** Functional group used by invoice/payment exports */
  functionalGroup: z.string().trim().nullish(),
  /** Expense category options this grant can surface in invoice/payment workflows */
  expenseCategories: z.array(GrantInvoiceOption).nullish(),
  /** Description templates this grant can surface in invoice/payment workflows */
  descriptionTemplates: z.array(GrantInvoiceOption).nullish(),
  /** Separate invoice code if the invoicing code differs from the grant code */
  invoiceCode: z.string().trim().nullish(),
  /** Program or funding-source code (e.g. federal program code) */
  programCode: z.string().trim().nullish(),
  /** Contract number with the funder */
  contractNumber: z.string().trim().nullish(),
  /** Vendor or supplier number assigned by the funder */
  vendorNumber: z.string().trim().nullish(),
  /** Name of the funder / grantor agency */
  funder: z.string().trim().nullish(),
  /** Primary contact name at the funder for invoicing */
  funderContact: z.string().trim().nullish(),
  /** Funder contact email */
  funderEmail: z.string().trim().nullish(),
  /** How often invoices are submitted */
  frequency: GrantInvoicingFrequency.nullish(),
  /** Day of month the invoice is due (1–28) */
  dueDayOfMonth: z.number().int().min(1).max(28).nullish(),
  /** Payment terms (e.g. "Net 30", "Net 60") */
  paymentTerms: z.string().trim().nullish(),
  /** Billing address (free-form) */
  billingAddress: z.string().trim().nullish(),
  /** Submission portal URL or platform name */
  submissionPortal: z.string().trim().nullish(),
  /** Reporting requirements or schedule */
  reportingNotes: z.string().trim().nullish(),
  /** General invoicing notes */
  notes: z.string().trim().nullish(),
  /** Open-ended meta for org-specific invoicing fields */
  meta: z.record(z.string(), z.unknown()).nullish()
}).passthrough();
var GrantEnrollmentDefaults = z.object({
  authorizationMonths: z.number().int().min(1).max(120).nullable().optional(),
  serviceStatus: z.enum(["active", "paused"]).nullable().optional(),
  medicaidStatus: z.enum(["active", "closed"]).nullable().optional()
}).passthrough();
var GrantCycleLink = z.object({
  previousGrantId: Id.nullable().optional(),
  nextGrantId: Id.nullable().optional()
}).passthrough();
var GrantEnrollmentLinkRule = z.object({
  targetGrantId: Id,
  onEnroll: z.literal("ensureActive").default("ensureActive"),
  onAllSourcesClosed: z.literal("flagShouldUnenroll").default("flagShouldUnenroll")
}).passthrough();
var GrantEnrollmentRequirement = z.object({
  operator: z.enum(["all", "any"]).default("all"),
  targetGrantIds: z.array(Id).min(1).max(20),
  behavior: z.literal("warnOnly").default("warnOnly")
}).passthrough();
var GrantLinking = z.object({
  cycle: GrantCycleLink.nullish(),
  /** Enrollment eligibility requirement. Consumers surface warnings only. */
  enrollmentRequirement: GrantEnrollmentRequirement.nullish(),
  /** Legacy enrollment automation rules retained for read compatibility. */
  enrollmentRules: z.array(GrantEnrollmentLinkRule).max(20).default([])
}).passthrough();
var GrantInputSchema = z.object({
  id: Id.optional(),
  name: z.string().trim().min(1),
  status: GrantStatus.optional(),
  active: z.boolean().optional(),
  // server-derived
  deleted: z.boolean().optional(),
  // server-derived
  // server authoritative (but accepted for dev/explicit org targeting)
  orgId: Id.nullish(),
  kind: GrantKind.optional(),
  financialConfig: GrantFinancialConfigPatch.nullish(),
  duration: z.string().trim().nullish().default("1 Year"),
  lengthOfAssistance: z.string().trim().nullish(),
  maxAssistanceMonths: NullablePositiveInt.nullish(),
  // Date | Timestamp | ISO string; server normalizes
  startDate: z.unknown().optional(),
  endDate: z.unknown().optional(),
  // Only allowed when kind="grant" (service enforces)
  budget: GrantBudget.nullish(),
  taskTypes: z.array(z.string().trim()).nullish(),
  tasks: GrantTaskDefinitions.nullish(),
  complianceConfig: GrantComplianceConfig.nullish(),
  driveTemplates: z.array(GrantDriveTemplate).nullish(),
  /** Conditional task rules evaluated on each new enrollment. */
  conditionalTaskRules: z.array(ConditionalTaskRule).nullish(),
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
  invoiceDocuments: z.array(z.string().trim()).nullish(),
  /** Optional internal guidance mapping assistance levels to eligibility criteria. */
  levelOfAssistance: z.record(z.string(), z.string()).nullish(),
  /**
   * Optional relationship hints for reporting/navigation.
   * These are not required for enrollment; enrollments still use grantId/grantName.
   */
  programIds: z.array(IdLike).nullish(),
  fundingGrantIds: z.array(IdLike).nullish(),
  relatedProgramIds: z.array(IdLike).nullish(),
  relatedGrantIds: z.array(IdLike).nullish(),
  meta: z.record(z.string(), z.unknown()).nullish(),
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
var GrantsUpsertBody = z.union([
  z.preprocess(stripGrantServerFields, GrantInputSchema),
  z.array(z.preprocess(stripGrantServerFields, GrantInputSchema)).min(1)
]);
var GrantUpsertBody = GrantsUpsertBody;
var GrantsPatchRow = z.preprocess(
  stripPatchServerFields,
  z.object({
    id: Id,
    patch: GrantInputSchema.partial().passthrough(),
    unset: z.array(z.string().min(1)).optional()
  }).passthrough()
).refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var GrantsPatchBody = z.union([
  GrantsPatchRow,
  z.array(GrantsPatchRow).min(1)
]);
var GrantPatchBody = GrantsPatchBody;
var GrantsDeleteBody = z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  z.union([IdLike, z.array(IdLike).min(1)])
);
var GrantsAdminDeleteBody = GrantsDeleteBody;
var ActiveFilter = z.preprocess(
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
  z.union([z.literal(true), z.literal(false)])
);
var GrantsListQuery = z.object({
  status: z.string().trim().optional(),
  active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),
  kind: z.union([GrantKind, z.string()]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  // dev explicit org targeting (matches handler behavior)
  orgId: IdLike.optional()
}).passthrough();
var GrantsGetQuery = z.object({ id: IdLike, orgId: IdLike.optional() }).passthrough();
var GrantsActivityQuery = z.object({
  grantId: IdLike,
  limit: z.coerce.number().int().min(1).max(1e3).optional(),
  cursor: z.string().trim().optional(),
  includeProjected: z.union([BoolLike, z.string()]).optional(),
  orgId: IdLike.optional()
}).passthrough();
var GrantsAdminPreviewQuery = z.object({ grantId: IdLike });
var GrantsAdminClearPaymentsBody = z.object({
  grantId: IdLike,
  confirm: z.literal("DELETE")
});
var GrantsAdminClearEnrollmentsBody = z.object({
  grantId: IdLike,
  confirm: z.literal("DELETE"),
  statuses: z.array(z.enum(["active", "inactive", "deleted"])).min(1).optional()
});
var GrantsAdminReconcileBudgetBody = z.object({
  grantId: IdLike
});

export {
  GrantStatus,
  GrantKind,
  GrantFinancialModel,
  GrantLedgerMode,
  GrantCompliancePreset,
  GrantComplianceControl,
  GrantComplianceConfig,
  GrantDriveTemplateType,
  extractGoogleDriveFileId,
  GrantDriveTemplate,
  normalizeGrantDriveTemplates,
  GrantFinancialConfig,
  GrantFinancialConfigPatch,
  normalizeGrantFinancialConfig,
  normalizeGrantComplianceConfig,
  getGrantFinancialCapabilities,
  shouldRetainGrantBudget,
  getGrantLineItemAmountSemantics,
  computeGrantLineItemOverCap,
  parseGrantMaxAssistanceMonths,
  GrantLineItemType,
  GrantLineItemCap,
  GrantBudgetSplitMode,
  GrantBudgetRollForwardBehavior,
  GrantBudgetDisplayLevel,
  GrantBudgetDateRange,
  GrantBudgetSplitGoal,
  GrantBudgetItemDisplayConfig,
  GrantBudgetBreakdownValidation,
  GrantInvoiceOption,
  GrantLineItemInvoicing,
  GrantBudgetLineItem,
  GrantBudgetTotals,
  GrantBudget,
  ConditionalTaskRuleType,
  AgeOperator,
  ConditionalTaskRule,
  GrantTaskDefinitions,
  GRANT_PIN_COLORS,
  GrantPinImportant,
  GrantPinDigest,
  GrantPinRentalAssistance,
  GrantPinInvoice,
  GrantPins,
  GrantInvoicingFrequency,
  GrantInvoicing,
  GrantEnrollmentDefaults,
  GrantCycleLink,
  GrantEnrollmentLinkRule,
  GrantEnrollmentRequirement,
  GrantLinking,
  GrantInputSchema,
  Grant,
  GrantEntity,
  GrantsUpsertBody,
  GrantUpsertBody,
  GrantsPatchRow,
  GrantsPatchBody,
  GrantPatchBody,
  GrantsDeleteBody,
  GrantsAdminDeleteBody,
  GrantsListQuery,
  GrantsGetQuery,
  GrantsActivityQuery,
  GrantsAdminPreviewQuery,
  GrantsAdminClearPaymentsBody,
  GrantsAdminClearEnrollmentsBody,
  GrantsAdminReconcileBudgetBody,
  grants_exports
};
