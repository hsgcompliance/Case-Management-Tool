import {
  getGrantFinancialCapabilities,
  normalizeGrantFinancialConfig,
  normalizeGrantComplianceConfig,
  parseGrantMaxAssistanceMonths,
  type TGrantFinancialConfig,
  type TGrantFinancialModel,
  type TGrantKind,
  type TGrantComplianceConfig,
} from "@hdb/contracts";

export type GrantProgramLifecycle = TGrantKind;
export type GrantProgramFinancialModel = TGrantFinancialModel;

export type FlowInvoiceOption = {
  id: string;
  label: string;
  code?: string;
  template?: string;
  enabled?: boolean;
  custom?: boolean;
};

export type FlowInvoicing = {
  functionalGroup: string;
  grantCode: string;
  programCode: string;
  hmisCode: string;
  expenseCategories: FlowInvoiceOption[];
  descriptionTemplates: FlowInvoiceOption[];
};

export type FlowLineItem = {
  id?: string;
  label: string;
  amount: number;
  type?: { id: string; label: string } | null;
  perCustomerCap?: number | null;
  capEnabled?: boolean;
  invoicing: FlowInvoicing;
};

export type GrantProgramFlowDraft = {
  name: string;
  status: "active" | "draft" | "closed";
  kind: GrantProgramLifecycle;
  financialModel: GrantProgramFinancialModel;
  startDate: string;
  endDate: string;
  previousGrantId: string;
  nextGrantId: string;
  linkedEnrollmentOperator: "all" | "any";
  linkedEnrollmentGrantIds: string[];
  duration: string;
  lengthOfAssistance: string;
  maxAssistanceMonths: string;
  authorizationMonths: string;
  complianceConfig?: TGrantComplianceConfig | null;
  allocationEnabled: boolean;
  perCustomerCap: string;
  description: string;
  tags: string[];
  servicesOffered: string[];
  eligibility: Record<string, string>;
  levelOfAssistance: Record<string, string>;
  lineItems: FlowLineItem[];
  budgetTotal: string;
  invoicing: FlowInvoicing;
  tasks: Array<Record<string, unknown>>;
  conditionalTaskRules: Array<Record<string, unknown>>;
  pins: {
    digest: boolean;
    rentalAssistance: boolean;
    invoice: boolean;
    invoiceLabel: string;
    invoiceNote: string;
    important: boolean;
    importantLabel: string;
    importantColor: string;
    importantNote: string;
  };
};

export const FINANCIAL_CONFIG_PRESETS: Record<GrantProgramFinancialModel, TGrantFinancialConfig> = {
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
    allocationEnabled: true,
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

const NO_COMPLIANCE_CONFIG: TGrantComplianceConfig = {
  preset: "none",
  active: [],
  inactive: [],
};

const SERVER_MANAGED_KEYS = new Set([
  "id",
  "orgId",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "deleted",
  "active",
  "metrics",
  "system",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function textArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  const one = text(value);
  return one ? [one] : [];
}

function keyValueRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const k = text(key);
    const v = text(raw);
    if (k && v) out[k] = v;
  }
  return out;
}

/** Unwrap legacy dynamic-field envelopes ({ _value: ... }) written by DynamicFormFields. */
function unwrapEnvelope(value: unknown): unknown {
  if (isRecord(value) && "_value" in value) return (value as Record<string, unknown>)._value;
  return value;
}

/** Read a key/value field for the draft, tolerating legacy string and envelope shapes. */
function keyValueDraft(value: unknown): Record<string, string> {
  const raw = unwrapEnvelope(value);
  if (typeof raw === "string") {
    const notes = raw.trim();
    return notes ? { Notes: notes } : {};
  }
  return keyValueRecord(raw);
}

function firstKeyValueDraft(...candidates: unknown[]): Record<string, string> {
  for (const candidate of candidates) {
    const parsed = keyValueDraft(candidate);
    if (Object.keys(parsed).length) return parsed;
  }
  return {};
}

function invoiceOptions(value: unknown): FlowInvoiceOption[] {
  const rows = Array.isArray(value)
    ? value.filter(isRecord).map((row, index) => ({
        id: text(row.id || row.label || `custom_${index}`),
        label: text(row.label),
        code: row.code == null ? undefined : text(row.code),
        template: row.template == null ? undefined : text(row.template),
        enabled: row.enabled === true,
        custom: row.custom === true,
      })).filter((row) => row.id && row.label)
    : [];
  return rows;
}

function invoicingDraft(value: unknown) {
  const invoicing = isRecord(value) ? value : {};
  return {
    functionalGroup: text(invoicing.functionalGroup),
    grantCode: text(invoicing.grantCode),
    programCode: text(invoicing.programCode),
    hmisCode: text(invoicing.hmisCode || (isRecord(invoicing.meta) ? invoicing.meta.hmisCode : "")),
    expenseCategories: invoiceOptions(invoicing.expenseCategories),
    descriptionTemplates: invoiceOptions(invoicing.descriptionTemplates),
  };
}

export function copyLineItemInvoicing(source: FlowLineItem): FlowInvoicing {
  return structuredClone(source.invoicing);
}

function lineItemsFromBudget(value: unknown, legacyInvoicing?: unknown): FlowLineItem[] {
  const budget = isRecord(value) ? value : {};
  const lineItems = Array.isArray(budget.lineItems) ? budget.lineItems : [];
  return lineItems.filter(isRecord).map((row, index) => ({
    id: text(row.id) || `li_${index + 1}`,
    label: text(row.label || row.name || row.id) || `Line Item ${index + 1}`,
    amount: asNumber(row.amount, 0),
    type: isRecord(row.type)
      ? { id: text(row.type.id || row.type.label), label: text(row.type.label || row.type.id) }
      : null,
    perCustomerCap: row.perCustomerCap == null ? null : asNumber(row.perCustomerCap, 0),
    capEnabled: row.capEnabled === true,
    invoicing: invoicingDraft(isRecord(row.invoicing) ? row.invoicing : legacyInvoicing),
  }));
}

function cleanForCopy(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.map((item) => cleanForCopy(item, depth + 1));
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (depth === 0 && SERVER_MANAGED_KEYS.has(key)) continue;
    out[key] = cleanForCopy(raw, depth + 1);
  }
  return out;
}

function financialModelOf(row: Record<string, unknown>): GrantProgramFinancialModel {
  return normalizeGrantFinancialConfig(row).model;
}

export function createInitialGrantProgramDraft(
  initial?: Partial<Record<string, unknown>>,
): GrantProgramFlowDraft {
  const source = (initial || {}) as Record<string, unknown>;
  const kind = text(source.kind) === "program" ? "program" : "grant";
  const financialModel = financialModelOf(source);
  const invoicing = isRecord(source.invoicing) ? source.invoicing : {};
  const budget = isRecord(source.budget) ? source.budget : {};
  const enrollmentDefaults = isRecord(source.enrollmentDefaults) ? source.enrollmentDefaults : {};
  const pins = isRecord(source.pins) ? source.pins : {};
  const important = isRecord(pins.important) ? pins.important : {};
  const invoicePin = isRecord(pins.invoice) ? pins.invoice : {};
  const linking = isRecord(source.linking) ? source.linking : {};
  const cycle = isRecord(linking.cycle) ? linking.cycle : {};
  const enrollmentRules = Array.isArray(linking.enrollmentRules) ? linking.enrollmentRules.filter(isRecord) : [];
  const enrollmentRequirement = isRecord(linking.enrollmentRequirement) ? linking.enrollmentRequirement : {};
  const details = isRecord(source.details) ? source.details : {};
  const legacyMaxLength = text(unwrapEnvelope(source["Maximum Length of Assistance"]) ?? details.maximumLengthOfAssistance);

  return {
    name: text(source.name),
    status: text(source.status) === "closed"
      ? "closed"
      : text(source.status) === "draft"
        ? "draft"
        : "active",
    kind,
    financialModel,
    startDate: text(source.startDate).slice(0, 10),
    endDate: text(source.endDate).slice(0, 10),
    previousGrantId: text(cycle.previousGrantId),
    nextGrantId: text(cycle.nextGrantId),
    linkedEnrollmentOperator: enrollmentRequirement.operator === "any" ? "any" : "all",
    linkedEnrollmentGrantIds: Array.isArray(enrollmentRequirement.targetGrantIds)
      ? textArray(enrollmentRequirement.targetGrantIds)
      : enrollmentRules.map((rule) => text(rule.targetGrantId)).filter(Boolean),
    duration: text(source.duration),
    lengthOfAssistance: text(source.lengthOfAssistance || source.maxLengthOfAssistance || legacyMaxLength),
    maxAssistanceMonths: text(source.maxAssistanceMonths || parseGrantMaxAssistanceMonths(source.lengthOfAssistance || source.maxLengthOfAssistance || legacyMaxLength) || ""),
    authorizationMonths: text(enrollmentDefaults.authorizationMonths),
    complianceConfig: isRecord(source.complianceConfig)
      ? normalizeGrantComplianceConfig(source)
      : text(source.name)
        ? normalizeGrantComplianceConfig(source)
        : NO_COMPLIANCE_CONFIG,
    allocationEnabled: normalizeGrantFinancialConfig(source).allocationEnabled,
    perCustomerCap: budget.perCustomerCap == null ? "" : text(budget.perCustomerCap),
    description: text(source.description),
    tags: textArray(source.tags),
    servicesOffered: textArray(unwrapEnvelope(source.servicesOffered)),
    eligibility: keyValueDraft(source.eligibility),
    levelOfAssistance: firstKeyValueDraft(
      source.levelOfAssistance,
      source["Level of Assistance"],
      details.levelOfAssistanceEligibility,
    ),
    lineItems: lineItemsFromBudget(source.budget, source.invoicing),
    budgetTotal: text(budget.total || budget.startAmount),
    invoicing: {
      functionalGroup: text(invoicing.functionalGroup),
      grantCode: text(invoicing.grantCode),
      programCode: text(invoicing.programCode),
      hmisCode: text(isRecord(invoicing.meta) ? invoicing.meta.hmisCode : ""),
      expenseCategories: invoiceOptions(invoicing.expenseCategories),
      descriptionTemplates: invoiceOptions(invoicing.descriptionTemplates),
    },
    tasks: Array.isArray(source.tasks) ? (source.tasks as Array<Record<string, unknown>>) : [],
    conditionalTaskRules: Array.isArray(source.conditionalTaskRules)
      ? (source.conditionalTaskRules as Array<Record<string, unknown>>)
      : [],
    pins: {
      digest: isRecord(pins.digest) && pins.digest.enabled === true,
      rentalAssistance: isRecord(pins.rentalAssistance) && pins.rentalAssistance.enabled === true,
      invoice: isRecord(pins.invoice) && pins.invoice.enabled === true,
      invoiceLabel: text(invoicePin.label),
      invoiceNote: text(invoicePin.note),
      important: important.enabled === true,
      importantLabel: text(important.label),
      importantColor: text(important.color) || "amber",
      importantNote: text(important.note),
    },
  };
}

export function copyGrantProgramToDraft(
  source: Record<string, unknown>,
  base?: GrantProgramFlowDraft,
): GrantProgramFlowDraft {
  const cleaned = cleanForCopy(source) as Record<string, unknown>;
  const draft = createInitialGrantProgramDraft(cleaned);
  return {
    ...(base || createInitialGrantProgramDraft()),
    ...draft,
    status: "draft",
    name: draft.name ? `${draft.name} Copy` : "",
    startDate: base?.startDate || "",
    endDate: "",
    previousGrantId: "",
    nextGrantId: "",
    linkedEnrollmentOperator: "all",
    linkedEnrollmentGrantIds: [],
    // Copied line items get fresh ids: ledger/paymentQueue rows reference
    // lineItemId, so carrying the source ids (or a `_copy` variant) into a new
    // grant creates misleading lineage.
    lineItems: draft.lineItems.map((item, index) => ({
      ...item,
      id: `li_${Date.now().toString(36)}_${index + 1}`,
      spent: 0,
      projected: 0,
    } as FlowLineItem)),
  };
}

export function buildGrantProgramPayload(draft: GrantProgramFlowDraft): Record<string, unknown> {
  const financialConfig = {
    ...FINANCIAL_CONFIG_PRESETS[draft.financialModel],
    allocationEnabled: draft.allocationEnabled || FINANCIAL_CONFIG_PRESETS[draft.financialModel].allocationEnabled,
  };
  const capabilities = getGrantFinancialCapabilities({ kind: draft.kind, financialConfig });
  const budgetLineItems = draft.lineItems
    .map((item, index) => ({
      id: text(item.id) || `li_${index + 1}`,
      label: text(item.label) || `Line Item ${index + 1}`,
      amount: capabilities.drawsDownBudget ? asNumber(item.amount, 0) : 0,
      spent: 0,
      projected: 0,
      type: item.type || null,
      perCustomerCap: item.perCustomerCap == null ? null : asNumber(item.perCustomerCap, 0),
      capEnabled: item.capEnabled === true,
      invoicing: {
        functionalGroup: item.invoicing.functionalGroup.trim() || null,
        grantCode: item.invoicing.grantCode.trim() || null,
        programCode: item.invoicing.programCode.trim() || null,
        hmisCode: item.invoicing.hmisCode.trim() || null,
        expenseCategories: item.invoicing.expenseCategories.filter((row) => row.enabled || row.custom),
        descriptionTemplates: item.invoicing.descriptionTemplates.filter((row) => row.enabled || row.custom),
      },
    }))
    .filter((item) => item.label);
  const budgetTotal = capabilities.drawsDownBudget
    ? asNumber(draft.budgetTotal, 0)
    : 0;
  const enabledExpenseCategories = draft.invoicing.expenseCategories
    .filter((row) => row.enabled || row.custom)
    .map((row) => ({ ...row, enabled: row.enabled === true }));
  const enabledDescriptions = draft.invoicing.descriptionTemplates
    .filter((row) => row.enabled || row.custom)
    .map((row) => ({ ...row, enabled: row.enabled === true }));

  const payload: Record<string, unknown> = {
    name: draft.name.trim(),
    status: draft.status,
    kind: draft.kind,
    financialConfig,
    startDate: draft.startDate || null,
    endDate: draft.endDate || null,
    linking: {
      cycle: {
        previousGrantId: draft.previousGrantId || null,
        nextGrantId: draft.nextGrantId || null,
      },
      enrollmentRequirement: draft.linkedEnrollmentGrantIds.length
        ? { operator: draft.linkedEnrollmentOperator, targetGrantIds: draft.linkedEnrollmentGrantIds, behavior: "warnOnly" }
        : null,
      enrollmentRules: [],
    },
    duration: draft.duration.trim() || null,
    lengthOfAssistance: draft.maxAssistanceMonths.trim()
      ? `${Math.max(1, Math.min(240, Math.floor(asNumber(draft.maxAssistanceMonths, 1))))} months`
      : draft.lengthOfAssistance.trim() || null,
    maxAssistanceMonths: draft.maxAssistanceMonths.trim()
      ? Math.max(1, Math.min(240, Math.floor(asNumber(draft.maxAssistanceMonths, 1))))
      : null,
    description: draft.description.trim() || null,
    tags: draft.tags.map(text).filter(Boolean).length ? draft.tags.map(text).filter(Boolean) : undefined,
    servicesOffered: draft.servicesOffered.map(text).filter(Boolean).length
      ? draft.servicesOffered.map(text).filter(Boolean)
      : undefined,
    eligibility: Object.keys(keyValueRecord(draft.eligibility)).length ? keyValueRecord(draft.eligibility) : undefined,
    levelOfAssistance: Object.keys(keyValueRecord(draft.levelOfAssistance)).length ? keyValueRecord(draft.levelOfAssistance) : undefined,
    enrollmentDefaults: {
      authorizationMonths: draft.authorizationMonths
        ? Math.max(1, Math.min(120, Math.floor(asNumber(draft.authorizationMonths, 12))))
        : null,
    },
    complianceConfig: draft.complianceConfig
      ? normalizeGrantComplianceConfig({ complianceConfig: draft.complianceConfig })
      : undefined,
    budget: capabilities.hasFinancialActivity
      ? {
          total: budgetTotal,
          lineItems: budgetLineItems,
          allocationEnabled: draft.allocationEnabled,
          perCustomerCap: draft.perCustomerCap ? asNumber(draft.perCustomerCap, 0) : null,
        }
      : { total: 0, lineItems: [] },
    invoicing: {
      functionalGroup: draft.invoicing.functionalGroup.trim() || null,
      grantCode: draft.invoicing.grantCode.trim() || null,
      programCode: draft.invoicing.programCode.trim() || null,
      expenseCategories: enabledExpenseCategories,
      descriptionTemplates: enabledDescriptions,
      meta: {
        hmisCode: draft.invoicing.hmisCode.trim() || null,
      },
    },
    tasks: draft.tasks,
    conditionalTaskRules: draft.conditionalTaskRules,
    pins: {
      digest: { enabled: draft.pins.digest },
      rentalAssistance: { enabled: draft.pins.rentalAssistance },
      invoice: {
        enabled: draft.pins.invoice,
        label: draft.pins.invoiceLabel.trim() || null,
        note: draft.pins.invoiceNote.trim() || null,
      },
      important: {
        enabled: draft.pins.important,
        label: draft.pins.importantLabel.trim() || null,
        color: draft.pins.importantColor || "amber",
        note: draft.pins.importantNote.trim() || null,
      },
    },
  };

  return stripEmpty(payload) as Record<string, unknown>;
}

function stripEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined) continue;
    if (raw === null && !["startDate", "endDate", "previousGrantId", "nextGrantId", "perCustomerCap", "authorizationMonths"].includes(key)) continue;
    out[key] = stripEmpty(raw);
  }
  return out;
}
