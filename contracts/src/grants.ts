// contracts/src/grants.ts
import { z, Id, IdLike, TsLike, BoolLike, toArray } from "./core";
import { Ok } from "./http";

export { toArray } from "./core";

/** ---------- Enums ---------- */
export const GrantStatus = z.enum(["active", "draft", "closed", "deleted"]);
export type TGrantStatus = z.infer<typeof GrantStatus>;

export const GrantKind = z.enum(["grant", "program"]);
export type TGrantKind = z.infer<typeof GrantKind>;

export const GrantFinancialModel = z.enum(["budgeted", "billable", "serviceOnly"]);
export type TGrantFinancialModel = z.infer<typeof GrantFinancialModel>;

export const GrantLedgerMode = z.enum(["spendDown", "billing", "none"]);
export type TGrantLedgerMode = z.infer<typeof GrantLedgerMode>;

export const GrantCompliancePreset = z.enum(["hmisCaseworthy", "custom", "none"]);
export type TGrantCompliancePreset = z.infer<typeof GrantCompliancePreset>;

export const GrantComplianceControl = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    field: z.string().trim().min(1).optional(),
    type: z.enum(["boolean"]).default("boolean"),
  })
  .passthrough();
export type TGrantComplianceControl = z.infer<typeof GrantComplianceControl>;

export const GrantComplianceConfig = z
  .object({
    preset: GrantCompliancePreset.nullable().optional(),
    active: z.array(GrantComplianceControl).optional(),
    inactive: z.array(GrantComplianceControl).optional(),
  })
  .passthrough();
export type TGrantComplianceConfig = z.infer<typeof GrantComplianceConfig>;

export const GrantDriveTemplateType = z.enum(["doc", "sheet", "pdf", "other"]);
export type TGrantDriveTemplateType = z.infer<typeof GrantDriveTemplateType>;

const DIRECT_DRIVE_ID_RE = /^[-\w]{20,}$/;

export function extractGoogleDriveFileId(input: unknown): string {
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

function inferDriveTemplateType(input: unknown): TGrantDriveTemplateType {
  const text = String(input || "").toLowerCase();
  if (text.includes("/document/")) return "doc";
  if (text.includes("/spreadsheets/")) return "sheet";
  if (text.includes(".pdf") || text.includes("application/pdf")) return "pdf";
  return "other";
}

function normalizeGrantDriveTemplateInput(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  const fileUrl = String(raw.fileUrl || raw.url || "").trim();
  const rawFileId = String(raw.fileId || raw.id || "").trim();
  const fileId = extractGoogleDriveFileId(rawFileId) || extractGoogleDriveFileId(fileUrl);
  return {
    ...raw,
    key: String(raw.key || fileId || rawFileId || raw.label || "").trim(),
    label: String(raw.label || raw.name || raw.key || "Template").trim(),
    fileId,
    fileUrl: fileUrl || (rawFileId && rawFileId !== fileId ? rawFileId : raw.fileUrl),
    type: raw.type || inferDriveTemplateType(fileUrl || rawFileId),
  };
}

export const GrantDriveTemplate = z.preprocess(
  normalizeGrantDriveTemplateInput,
  z.object({
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(200),
    fileId: z.string().trim().min(3).max(300),
    fileUrl: z.string().trim().max(800).nullish(),
    type: GrantDriveTemplateType.optional().default("other"),
    description: z.string().trim().max(500).nullish(),
    defaultChecked: z.boolean().optional().default(true),
  })
  .passthrough(),
);
export type TGrantDriveTemplate = z.infer<typeof GrantDriveTemplate>;

export function normalizeGrantDriveTemplates(input: unknown): TGrantDriveTemplate[] {
  const rows = Array.isArray(input) ? input : [];
  return rows
    .map((row) => GrantDriveTemplate.safeParse(row))
    .filter((result): result is { success: true; data: TGrantDriveTemplate } => result.success)
    .map((result) => result.data);
}

export const GrantFinancialConfig = z
  .object({
    model: GrantFinancialModel,
    budgetEnabled: z.boolean(),
    billingEnabled: z.boolean(),
    allocationEnabled: z.boolean(),
    ledgerEnabled: z.boolean(),
    ledgerMode: GrantLedgerMode,
  })
  .passthrough();

export type TGrantFinancialConfig = z.infer<typeof GrantFinancialConfig>;

export const GrantFinancialConfigPatch = GrantFinancialConfig.partial().passthrough();
export type TGrantFinancialConfigPatch = z.infer<typeof GrantFinancialConfigPatch>;

export type TGrantFinancialCapabilities = {
  config: TGrantFinancialConfig;
  budgetEnabled: boolean;
  billingEnabled: boolean;
  allocationEnabled: boolean;
  ledgerEnabled: boolean;
  ledgerMode: TGrantLedgerMode;
  drawsDownBudget: boolean;
  usesBillingLedger: boolean;
  hasFinancialActivity: boolean;
};

export type TGrantLineItemAmountSemantics = {
  drawsDownBudget: boolean;
  amountIsBudgetAllocation: boolean;
  amountIsBillingReference: boolean;
  amountCreatesOverCap: boolean;
};

const FINANCIAL_CONFIG_DEFAULTS: Record<TGrantFinancialModel, TGrantFinancialConfig> = {
  budgeted: {
    model: "budgeted",
    budgetEnabled: true,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: true,
    ledgerMode: "spendDown",
  },
  billable: {
    model: "billable",
    budgetEnabled: false,
    billingEnabled: true,
    allocationEnabled: false,
    ledgerEnabled: true,
    ledgerMode: "billing",
  },
  serviceOnly: {
    model: "serviceOnly",
    budgetEnabled: false,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: false,
    ledgerMode: "none",
  },
};

const HMIS_CASEWORTHY_COMPLIANCE_CONFIG: Required<Pick<TGrantComplianceConfig, "active" | "inactive">> & {
  preset: "hmisCaseworthy";
} = {
  preset: "hmisCaseworthy",
  active: [
    {
      key: "caseworthyEntryComplete",
      label: "CW Entry",
      field: "compliance.caseworthyEntryComplete",
      type: "boolean",
    },
    {
      key: "hmisEntryComplete",
      label: "HMIS Entry",
      field: "compliance.hmisEntryComplete",
      type: "boolean",
    },
  ],
  inactive: [
    {
      key: "caseworthyExitComplete",
      label: "CW Exit",
      field: "compliance.caseworthyExitComplete",
      type: "boolean",
    },
    {
      key: "hmisExitComplete",
      label: "HMIS Exit",
      field: "compliance.hmisExitComplete",
      type: "boolean",
    },
  ],
};

function normalizeComplianceControl(value: unknown): TGrantComplianceControl | null {
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
    type: "boolean",
  };
}

function normalizeComplianceControls(value: unknown): TGrantComplianceControl[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeComplianceControl(entry))
    .filter((entry): entry is TGrantComplianceControl => !!entry);
}

function grantKindOf(value: Record<string, unknown> | null | undefined): TGrantKind {
  return String(value?.kind || "").trim().toLowerCase() === "program" ? "program" : "grant";
}

function parseFinancialModel(value: unknown): TGrantFinancialModel | null {
  const parsed = GrantFinancialModel.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseLedgerMode(value: unknown): TGrantLedgerMode | null {
  const parsed = GrantLedgerMode.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseCompliancePreset(value: unknown): TGrantCompliancePreset | null {
  const parsed = GrantCompliancePreset.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Read-time financial config normalization. This intentionally does not rely on
 * schema defaults so parsing legacy Firestore records does not imply a write-back
 * migration. Persist normalized values later only through an explicit migration.
 */
export function normalizeGrantFinancialConfig(
  grant: Record<string, unknown> | null | undefined,
): TGrantFinancialConfig {
  const raw = isPlainObject(grant?.financialConfig)
    ? (grant.financialConfig as Record<string, unknown>)
    : {};
  const legacyAllocationEnabled =
    isPlainObject(grant?.budget) &&
    (grant.budget as Record<string, unknown>).allocationEnabled === true;

  const fallbackModel: TGrantFinancialModel =
    grantKindOf(grant) === "grant" ? "budgeted" : "serviceOnly";
  const model = parseFinancialModel(raw.model) ?? fallbackModel;
  const defaults = FINANCIAL_CONFIG_DEFAULTS[model];
  const rawLedgerMode = parseLedgerMode(raw.ledgerMode);

  const next: TGrantFinancialConfig = {
    ...defaults,
    model,
    budgetEnabled:
      typeof raw.budgetEnabled === "boolean" ? raw.budgetEnabled : defaults.budgetEnabled,
    billingEnabled:
      typeof raw.billingEnabled === "boolean" ? raw.billingEnabled : defaults.billingEnabled,
    allocationEnabled:
      typeof raw.allocationEnabled === "boolean"
        ? raw.allocationEnabled
        : legacyAllocationEnabled || defaults.allocationEnabled,
    ledgerEnabled:
      typeof raw.ledgerEnabled === "boolean" ? raw.ledgerEnabled : defaults.ledgerEnabled,
    ledgerMode: rawLedgerMode ?? defaults.ledgerMode,
  };

  if (next.ledgerMode === "none") next.ledgerEnabled = false;
  if (!next.ledgerEnabled) next.ledgerMode = "none";

  return next;
}

export function normalizeGrantComplianceConfig(
  grant: Record<string, unknown> | null | undefined,
): TGrantComplianceConfig {
  const raw = isPlainObject(grant?.complianceConfig)
    ? (grant.complianceConfig as Record<string, unknown>)
    : {};
  const preset = parseCompliancePreset(raw.preset) ?? "hmisCaseworthy";

  if (preset === "none") {
    return {
      ...raw,
      preset: "none",
      active: normalizeComplianceControls(raw.active),
      inactive: normalizeComplianceControls(raw.inactive),
    };
  }

  if (preset === "hmisCaseworthy" && !Array.isArray(raw.active) && !Array.isArray(raw.inactive)) {
    return HMIS_CASEWORTHY_COMPLIANCE_CONFIG;
  }

  return {
    ...raw,
    preset,
    active: normalizeComplianceControls(raw.active),
    inactive: normalizeComplianceControls(raw.inactive),
  };
}

export function getGrantFinancialCapabilities(
  grant: Record<string, unknown> | null | undefined,
): TGrantFinancialCapabilities {
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
    hasFinancialActivity: budgetEnabled || billingEnabled || allocationEnabled || ledgerEnabled,
  };
}

export function shouldRetainGrantBudget(
  grant: Record<string, unknown> | null | undefined,
): boolean {
  return getGrantFinancialCapabilities(grant).hasFinancialActivity;
}

export function getGrantLineItemAmountSemantics(
  grant: Record<string, unknown> | null | undefined,
): TGrantLineItemAmountSemantics {
  const capabilities = getGrantFinancialCapabilities(grant);
  const amountIsBudgetAllocation = capabilities.drawsDownBudget;
  return {
    drawsDownBudget: capabilities.drawsDownBudget,
    amountIsBudgetAllocation,
    amountIsBillingReference: capabilities.usesBillingLedger && !amountIsBudgetAllocation,
    amountCreatesOverCap: amountIsBudgetAllocation,
  };
}

export function computeGrantLineItemOverCap(
  grant: Record<string, unknown> | null | undefined,
  lineItem: Record<string, unknown> | null | undefined,
): number | null {
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

/** ---------- helpers ---------- */
// Zod v4: .finite() is deprecated
const Num = z.coerce.number().refine(Number.isFinite, "not_finite").default(0);

/** ---------- Budget ---------- */
const GrantLineItemTypeInput = z.preprocess((v) => {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || ["na", "n/a", "none", "null"].includes(s.toLowerCase())) return null;
    return { label: s };
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const raw = String(o.label ?? o.name ?? o.id ?? "").trim();
    if (!raw || ["na", "n/a", "none", "null"].includes(raw.toLowerCase())) return null;
    if (!o.label) return { ...o, label: raw };
  }
  return v;
}, z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
}).passthrough().nullable());

export const GrantLineItemType = GrantLineItemTypeInput;
export type TGrantLineItemType = z.infer<typeof GrantLineItemType>;

/** Per-customer spending cap on a single budget line item. Optional. */
export const GrantLineItemCap = z
  .object({
    /** Hard cap (USD) per enrolled customer for this line item. null = no cap. */
    perCustomerCap: z.number().min(0).nullish(),
    /** Whether the cap is actively enforced (shows warnings / blocks posting when exceeded). */
    capEnabled: z.boolean().default(false),
  })
  .passthrough();

export type TGrantLineItemCap = z.infer<typeof GrantLineItemCap>;

export const GrantBudgetLineItem = z
  .object({
    id: Id.optional(), // server fills if missing
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
  })
  .passthrough();

export type TGrantBudgetLineItem = z.infer<typeof GrantBudgetLineItem>;

export const GrantBudgetTotals = z
  .object({
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
    windowProjectedBalance: Num.optional(),
  })
  .passthrough();

export type TGrantBudgetTotals = z.infer<typeof GrantBudgetTotals>;

export const GrantBudget = z
  .object({
    total: Num,
    totals: GrantBudgetTotals.nullish(),
    lineItems: z.array(GrantBudgetLineItem).default([]),

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
    updatedAt: TsLike.nullish(),
  })
  .passthrough();

export type TGrantBudget = z.infer<typeof GrantBudget>;

// ─── Conditional Task Rules ────────────────────────────────────────────────────
//
// Evaluated when a customer is enrolled in this grant.
// Age rules: compute enrollee's age as of enrollment.startDate.
// Concurrent-enrollment rules: check if the customer has another active
//   enrollment whose grantName matches programName on the start date.

export const ConditionalTaskRuleType = z.enum(["age", "population", "concurrent_enrollment"]);
export type TConditionalTaskRuleType = z.infer<typeof ConditionalTaskRuleType>;

export const AgeOperator = z.enum([">=", "<=", ">", "<"]);
export type TAgeOperator = z.infer<typeof AgeOperator>;

export const ConditionalTaskRule = z
  .object({
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
    notify: z.boolean().optional(),
  })
  .passthrough();

export type TConditionalTaskRule = z.infer<typeof ConditionalTaskRule>;

/**
 * Grant-level managed task definitions. Current UI and task generation store
 * these as an array on grants/{id}.tasks. Legacy records may still have a
 * record-shaped tasks object, so accept both shapes at contract boundaries.
 */
export const GrantTaskDefinitions = z.union([
  z.array(z.record(z.string(), z.unknown())),
  z.record(z.string(), z.unknown()),
]);
export type TGrantTaskDefinitions = z.infer<typeof GrantTaskDefinitions>;

// ─── Pins ─────────────────────────────────────────────────────────────────────
// Org-visible pins stored on the grant doc itself.
// User-level pins (metrics, dashboard detail cards) live on userExtras.grantPrefs.
//
// System pins (set by admins, affect org-wide behavior):
//   digest             → Budget Digest email
//   rentalAssistance   → Rental Assistance Digest email
//   invoice            → Invoicing Tab grant filter
//
// Legacy pins (from previous system, preserved for backward compat):
//   important          → bold badge + float-to-top display flag

export const GRANT_PIN_COLORS = ["red", "amber", "emerald", "sky", "violet", "rose", "orange"] as const;
export type TGrantPinColor = typeof GRANT_PIN_COLORS[number];

/**
 * @legacy — from previous system. Surfaces a bold badge and floats the grant
 * to the top of lists. Preserved for backward compat; prefer named system pins
 * for new feature hooks.
 */
export const GrantPinImportant = z.object({
  enabled: z.boolean().default(false),
  label: z.string().trim().nullish(),
  color: z.enum(GRANT_PIN_COLORS).nullish(),
  note: z.string().trim().nullish(),
  pinnedAt: TsLike.nullish(),
  pinnedBy: z.string().trim().nullish(),
  meta: z.record(z.string(), z.unknown()).nullish(),
}).passthrough();
export type TGrantPinImportant = z.infer<typeof GrantPinImportant>;

/**
 * Budget Digest Pin (stored as `pins.digest`) — when enabled, this grant is
 * included in the org-wide monthly budget digest email. Grants without this
 * pin are excluded from the digest and from aggregate digest totals.
 */
export const GrantPinDigest = z.object({
  enabled: z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: z.string().trim().nullish(),
}).passthrough();
export type TGrantPinDigest = z.infer<typeof GrantPinDigest>;

/**
 * Rental Assistance Digest Pin — when enabled, includes this grant in the
 * org-wide rental assistance digest email.
 */
export const GrantPinRentalAssistance = z.object({
  enabled: z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: z.string().trim().nullish(),
}).passthrough();
export type TGrantPinRentalAssistance = z.infer<typeof GrantPinRentalAssistance>;

/**
 * Invoicing Tab Pin — surfaces this grant as a selectable filter in the
 * invoicing tool. Does not affect ledger or payment source-of-truth records.
 */
export const GrantPinInvoice = z.object({
  enabled: z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: z.string().trim().nullish(),
  label: z.string().trim().nullish(),
  note: z.string().trim().nullish(),
}).passthrough();
export type TGrantPinInvoice = z.infer<typeof GrantPinInvoice>;

export const GrantPins = z.object({
  // System pins
  digest: GrantPinDigest.nullish(),
  rentalAssistance: GrantPinRentalAssistance.nullish(),
  invoice: GrantPinInvoice.nullish(),
  // Legacy
  important: GrantPinImportant.nullish(),
}).passthrough();
export type TGrantPins = z.infer<typeof GrantPins>;

// ─── Invoicing ─────────────────────────────────────────────────────────────

export const GrantInvoicingFrequency = z.enum(["monthly", "quarterly", "annually", "on-demand"]);
export type TGrantInvoicingFrequency = z.infer<typeof GrantInvoicingFrequency>;

export const GrantInvoiceOption = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  code: z.string().trim().nullish(),
  template: z.string().trim().nullish(),
  enabled: z.boolean().optional(),
  custom: z.boolean().optional(),
}).passthrough();
export type TGrantInvoiceOption = z.infer<typeof GrantInvoiceOption>;

/**
 * Optional invoicing metadata stored on the grant doc.
 * Covers grant codes, contract references, funder contacts, and billing details.
 */
export const GrantInvoicing = z.object({
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
  meta: z.record(z.string(), z.unknown()).nullish(),
}).passthrough();
export type TGrantInvoicing = z.infer<typeof GrantInvoicing>;

export const GrantEnrollmentDefaults = z
  .object({
    authorizationMonths: z.number().int().min(1).max(120).nullable().optional(),
    serviceStatus: z.enum(["active", "paused"]).nullable().optional(),
    medicaidStatus: z.enum(["active", "closed"]).nullable().optional(),
  })
  .passthrough();
export type TGrantEnrollmentDefaults = z.infer<typeof GrantEnrollmentDefaults>;

/** ---------- Grant (INPUT) ---------- */
export const GrantInputSchema = z
  .object({
    id: Id.optional(),
    name: z.string().trim().min(1),

    status: GrantStatus.optional(),
    active: z.boolean().optional(), // server-derived
    deleted: z.boolean().optional(), // server-derived

    // server authoritative (but accepted for dev/explicit org targeting)
    orgId: Id.nullish(),

    kind: GrantKind.optional(),
    financialConfig: GrantFinancialConfigPatch.nullish(),

    duration: z.string().trim().nullish().default("1 Year"),

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
    updatedAt: TsLike.nullish(),
  })
  .passthrough();

export type TGrant = z.infer<typeof GrantInputSchema> & Record<string, unknown>;

/** Back-compat runtime name (functions currently import Grant) */
export const Grant = GrantInputSchema;

/** ---------- Grant (ENTITY / READ) ---------- */
export const GrantEntity = GrantInputSchema.extend({
  id: Id,
}).passthrough();

export type TGrantEntity = z.infer<typeof GrantEntity> &
  Record<string, unknown>;

function stripPatchServerFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const row = { ...(value as Record<string, unknown>) };
  const rawPatch = row.patch;
  if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) return row;

  const patch = { ...(rawPatch as Record<string, unknown>) };
  delete patch.createdAt;
  delete patch.updatedAt;
  delete patch.deletedAt;
  delete patch.active;
  delete patch.deleted;
  delete patch._tags;
  delete patch.system;

  if (patch.budget && typeof patch.budget === "object" && !Array.isArray(patch.budget)) {
    const budget = { ...(patch.budget as Record<string, unknown>) };
    delete budget.createdAt;
    delete budget.updatedAt;
    patch.budget = budget;
  }

  row.patch = patch;
  return row;
}

function stripGrantServerFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const grant = { ...(value as Record<string, unknown>) };
  delete grant.createdAt;
  delete grant.updatedAt;
  delete grant.deletedAt;
  delete grant.active;
  delete grant.deleted;
  delete grant._tags;
  delete grant.system;

  if (grant.budget && typeof grant.budget === "object" && !Array.isArray(grant.budget)) {
    const budget = { ...(grant.budget as Record<string, unknown>) };
    delete budget.createdAt;
    delete budget.updatedAt;
    grant.budget = budget;
  }

  return grant;
}

/* =============================================================================
   Requests / Responses (match current functions/http.ts + service.ts)
============================================================================= */

// ---------------- Upsert (POST /grantsUpsert) ----------------
export const GrantsUpsertBody = z.union([
  z.preprocess(stripGrantServerFields, GrantInputSchema),
  z.array(z.preprocess(stripGrantServerFields, GrantInputSchema)).min(1),
]);
export const GrantUpsertBody = GrantsUpsertBody; // back-compat

export type TGrantsUpsertBody = z.infer<typeof GrantsUpsertBody>;
export type TGrantsUpsertResp = Ok<{ ids: string[] }>;

// ---------------- Patch (PATCH /grantsPatch) ----------------
export const GrantsPatchRow = z
  .preprocess(
    stripPatchServerFields,
    z.object({
      id: Id,
      patch: GrantInputSchema.partial().passthrough(),
      unset: z.array(z.string().min(1)).optional(),
    }).passthrough(),
  )
  .refine(
    (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
    { message: "empty_patch" },
  );

export const GrantsPatchBody = z.union([
  GrantsPatchRow,
  z.array(GrantsPatchRow).min(1),
]);
export const GrantPatchBody = GrantsPatchBody; // back-compat

export type TGrantsPatchRow = z.infer<typeof GrantsPatchRow>;
export type TGrantsPatchBody = z.infer<typeof GrantsPatchBody>;
export type TGrantsPatchResp = Ok<{ ids: string[] }>;

// ---------------- Soft delete (POST /grantsDelete) ----------------
// matches handler parse: req.body?.ids ?? req.body?.id ?? req.body
export const GrantsDeleteBody = z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v as { ids?: unknown; id?: unknown };
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  z.union([IdLike, z.array(IdLike).min(1)]),
);

export type TGrantsDeleteBody = z.infer<typeof GrantsDeleteBody>;
export type TGrantsDeleteResp = Ok<{ ids: string[]; deleted: true }>;

// ---------------- Hard delete (POST /grantsAdminDelete) ----------------
export const GrantsAdminDeleteBody = GrantsDeleteBody;
export type TGrantsAdminDeleteBody = z.infer<typeof GrantsAdminDeleteBody>;
export type TGrantsAdminDeleteResp = Ok<{ ids: string[]; deleted: true }>;

// ---------------- List (GET/POST /grantsList) ----------------
const ActiveFilter = z.preprocess(
  (v) => {
    if (v === "" || v == null) return undefined;
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
  z.union([z.literal(true), z.literal(false)]),
);

export const GrantsListQuery = z
  .object({
    status: z.string().trim().optional(),
    active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),
    kind: z.union([GrantKind, z.string()]).optional(),

    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursorUpdatedAt: TsLike.optional(),
    cursorId: IdLike.optional(),

    // dev explicit org targeting (matches handler behavior)
    orgId: IdLike.optional(),
  })
  .passthrough();

export type TGrantsListQuery = z.infer<typeof GrantsListQuery>;
export type TGrantsListResp = Ok<{
  items: TGrantEntity[];
  next: { cursorUpdatedAt: unknown; cursorId: string } | null;
  orgId: string;
}>;

// ---------------- Get (GET/POST /grantsGet) ----------------
export const GrantsGetQuery = z
  .object({ id: IdLike, orgId: IdLike.optional() })
  .passthrough();
export type TGrantsGetQuery = z.infer<typeof GrantsGetQuery>;
export type TGrantsGetResp = Ok<{ grant: TGrantEntity }>;

// ---------------- Structure (GET /grantsStructure) ----------------
export type TGrantsStructureResp = Ok<{ structure: Partial<TGrant> }>;

// ---------------- Activity (GET/POST /grantsActivity) ----------------
export const GrantsActivityQuery = z
  .object({
    grantId: IdLike,
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    cursor: z.string().trim().optional(),
    includeProjected: z.union([BoolLike, z.string()]).optional(),
    orgId: IdLike.optional(),
  })
  .passthrough();

export type TGrantsActivityQuery = z.infer<typeof GrantsActivityQuery>;
export type TGrantsActivityItem = {
  id: string;
  kind: "spend" | "reversal" | "projection";
  sourceType?: "ledger" | "paymentQueue" | "legacySpend";
  grantId: string;
  enrollmentId: string;
  paymentId?: string | null;
  lineItemId?: string | null;
  amount: number;
  note?: string | null;
  ts: string;
  by?: unknown | null;
  reversalOf?: string | null;
  queueStatus?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerNameAtSpend?: string | null;
  grantNameAtSpend?: string | null;
  lineItemLabelAtSpend?: string | null;
  paymentLabelAtSpend?: string | null;
  ledgerEntry?: Record<string, unknown> | null;
  paymentQueueItem?: Record<string, unknown> | null;
};
export type TGrantsActivityResp = Ok<{
  items: TGrantsActivityItem[];
  next?: { cursor: string } | null;
  counts?: { total: number; ledger: number; projected: number; legacy: number };
}>;

// ---------------- Admin: Preview (GET /grantsAdminPreview) ----------------
export const GrantsAdminPreviewQuery = z.object({ grantId: IdLike });
export type TGrantsAdminPreviewQuery = z.infer<typeof GrantsAdminPreviewQuery>;

type AmountCount = { count: number; amount: number };
export type TGrantsAdminPreviewResp = Ok<{
  ledger: { enrollmentSpends: AmountCount; ccInvoice: AmountCount };
  paymentQueue: { projections: AmountCount; ccInvoice: AmountCount };
  spendMirrors: AmountCount;
  enrollments: { active: number; inactive: number; deleted: number; total: number };
  currentBudget: { total: number; spent: number; projected: number; balance: number; projectedBalance: number };
}>;

// ---------------- Admin: Clear Payments (POST /grantsAdminClearPayments) ----------------
export const GrantsAdminClearPaymentsBody = z.object({
  grantId: IdLike,
  confirm: z.literal("DELETE"),
});
export type TGrantsAdminClearPaymentsBody = z.infer<typeof GrantsAdminClearPaymentsBody>;
export type TGrantsAdminClearPaymentsResp = Ok<{
  deleted: { ledger: number; paymentQueue: number; spendMirrors: number };
  skipped: { ledger: number; paymentQueue: number };
  totals: Record<string, number>;
  counts: { ledger: number; paymentQueue: number };
}>;

// ---------------- Admin: Clear Enrollments (POST /grantsAdminClearEnrollments) ----------------
export const GrantsAdminClearEnrollmentsBody = z.object({
  grantId: IdLike,
  confirm: z.literal("DELETE"),
  statuses: z.array(z.enum(["active", "inactive", "deleted"])).min(1).optional(),
});
export type TGrantsAdminClearEnrollmentsBody = z.infer<typeof GrantsAdminClearEnrollmentsBody>;
export type TGrantsAdminClearEnrollmentsResp = Ok<{
  cleared: { enrollments: number; paymentQueue: number; spendMirrors: number };
  skipped: { enrollments: number };
}>;

// ---------------- Admin: Reconcile Budget (POST /grantsAdminReconcileBudget) ----------------
export const GrantsAdminReconcileBudgetBody = z.object({
  grantId: IdLike,
});
export type TGrantsAdminReconcileBudgetBody = z.infer<typeof GrantsAdminReconcileBudgetBody>;
export type TGrantsAdminReconcileBudgetResp = Ok<{
  totals: Record<string, number>;
  counts: { ledger: number; paymentQueue: number };
}>;
