import {
  getGrantFinancialCapabilities,
  normalizeGrantFinancialConfig,
  normalizeGrantComplianceConfig,
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

export type FlowLineItem = {
  id?: string;
  label: string;
  amount: number;
  type?: { id: string; label: string } | null;
  perCustomerCap?: number | null;
  capEnabled?: boolean;
};

export type GrantProgramFlowDraft = {
  name: string;
  status: "active" | "draft" | "closed";
  kind: GrantProgramLifecycle;
  financialModel: GrantProgramFinancialModel;
  startDate: string;
  endDate: string;
  duration: string;
  lengthOfAssistance: string;
  authorizationMonths: string;
  complianceConfig?: TGrantComplianceConfig | null;
  allocationEnabled: boolean;
  perCustomerCap: string;
  description: string;
  servicesOffered: string[];
  eligibility: Record<string, string>;
  levelOfAssistance: Record<string, string>;
  lineItems: FlowLineItem[];
  budgetTotal: string;
  invoicing: {
    functionalGroup: string;
    grantCode: string;
    programCode: string;
    hmisCode: string;
    expenseCategories: FlowInvoiceOption[];
    descriptionTemplates: FlowInvoiceOption[];
  };
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

export const TSS_COMPLIANCE_CONFIG: TGrantComplianceConfig = {
  preset: "custom",
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
    {
      key: "serviceStatus",
      label: "Service Active",
      field: "serviceStatus",
      type: "boolean",
    },
    {
      key: "medicaidStatus",
      label: "Medicaid Active",
      field: "medicaid.status",
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

export const DEFAULT_EXPENSE_CATEGORIES: FlowInvoiceOption[] = [
  { id: "housing-non-hrdc", label: "Housing Assistance (non-HRDC Property)", code: "UNR-9520-300-00", enabled: false },
  { id: "housing-hrdc", label: "Housing Assistance (HRDC Property)", code: "UNR-9960-300-00", enabled: false },
  { id: "deposit", label: "Deposit Assistance", code: "UNR-9545-300-00", enabled: false },
  { id: "preventative-arrears", label: "Preventative Arrears", code: "UNR-9548-300-00", enabled: false },
  { id: "personal-needs", label: "Personal Needs", code: "UNR-5607-300-00", enabled: false },
  { id: "utility", label: "Utility Assistance", code: "UNR-8510-300-00", enabled: false },
];

export const DEFAULT_DESCRIPTION_TEMPLATES: FlowInvoiceOption[] = [
  { id: "rental-assistance", label: "Rental Assistance", template: "J. Doe: March RA", enabled: false },
  { id: "prorated-rental-assistance", label: "Prorated Rental Assistance", template: "J. Doe: Feb Prorated Rent", enabled: false },
  { id: "deposit-assistance", label: "Deposit Assistance", template: "J. Doe: DA", enabled: false },
  { id: "utility-assistance", label: "Utility Assistance", template: "J. Doe: March Util Assistance", enabled: false },
];

export const DEFAULT_ELIGIBILITY: Record<string, string> = {
  "Housing Status": "Experiencing Category 1 Homelessness",
  "Sustainability Requirement": "Must demonstrate sustainability",
  "Unit Rent Limit": "Lesser of FMR and rent reasonable",
};

export const DEFAULT_LEVEL_OF_ASSISTANCE: Record<string, string> = {
  "Deposit Only": "MAP 0-3",
  "Short-Term": "MAP 4-7",
  "Medium-Term": "MAP 8+",
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

function invoiceOptions(value: unknown, defaults: FlowInvoiceOption[]): FlowInvoiceOption[] {
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
  const savedById = new Map(rows.map((row) => [row.id, row]));
  const merged = defaults.map((row) => ({ ...row, ...(savedById.get(row.id) || {}) }));
  const custom = rows.filter((row) => row.custom && !defaults.some((def) => def.id === row.id));
  return [...merged, ...custom];
}

function lineItemsFromBudget(value: unknown): FlowLineItem[] {
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
  }));
}

function cleanForCopy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanForCopy);
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SERVER_MANAGED_KEYS.has(key)) continue;
    out[key] = cleanForCopy(raw);
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

  return {
    name: text(source.name),
    status: text(source.status) === "active" ? "active" : "draft",
    kind,
    financialModel,
    startDate: text(source.startDate).slice(0, 10),
    endDate: text(source.endDate).slice(0, 10),
    duration: text(source.duration) || (kind === "grant" ? "1 Year" : ""),
    lengthOfAssistance: text(source.lengthOfAssistance || source.maxLengthOfAssistance),
    authorizationMonths: text(enrollmentDefaults.authorizationMonths),
    complianceConfig: isRecord(source.complianceConfig) ? normalizeGrantComplianceConfig(source) : null,
    allocationEnabled: normalizeGrantFinancialConfig(source).allocationEnabled,
    perCustomerCap: budget.perCustomerCap == null ? "" : text(budget.perCustomerCap),
    description: text(source.description),
    servicesOffered: textArray(source.servicesOffered),
    eligibility: keyValueRecord(source.eligibility),
    levelOfAssistance: keyValueRecord(source.levelOfAssistance),
    lineItems: lineItemsFromBudget(source.budget),
    budgetTotal: text(budget.total || budget.startAmount),
    invoicing: {
      functionalGroup: text(invoicing.functionalGroup),
      grantCode: text(invoicing.grantCode),
      programCode: text(invoicing.programCode),
      hmisCode: text(isRecord(invoicing.meta) ? invoicing.meta.hmisCode : ""),
      expenseCategories: invoiceOptions(invoicing.expenseCategories, DEFAULT_EXPENSE_CATEGORIES),
      descriptionTemplates: invoiceOptions(invoicing.descriptionTemplates, DEFAULT_DESCRIPTION_TEMPLATES),
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
    lineItems: draft.lineItems.map((item) => ({
      ...item,
      id: item.id ? `${item.id}_copy` : undefined,
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
    startDate: draft.startDate || "",
    endDate: draft.endDate || "",
    duration: draft.duration.trim() || null,
    lengthOfAssistance: draft.lengthOfAssistance.trim() || null,
    description: draft.description.trim() || null,
    servicesOffered: draft.servicesOffered.map(text).filter(Boolean),
    eligibility: draft.eligibility,
    levelOfAssistance: draft.levelOfAssistance,
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
    if (raw === null && key !== "endDate" && key !== "perCustomerCap" && key !== "authorizationMonths") continue;
    out[key] = stripEmpty(raw);
  }
  return out;
}
