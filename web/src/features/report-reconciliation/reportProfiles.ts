"use client";

import { parseFinancialEdgeReference } from "./reportParsingEngines";

export type ReportFieldType = "text" | "date" | "money" | "identity" | "grant" | "vendor";

export type ReportFieldProfile = {
  required: boolean;
  type?: ReportFieldType;
  aliases: string[];
  notes?: string;
};

export type ReportSourceProfile = {
  id: string;
  label: string;
  recordKind: string;
  active: boolean;
  fields: Record<string, ReportFieldProfile>;
  excludeRules?: ReportExcludeRule[];
  notes?: string;
  sourceAliases?: string[];
  schemaVersion?: number;
};

export type ReportExcludeOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "regex"
  | "not_regex"
  | "is_blank"
  | "is_not_blank"
  | "amount_zero_or_blank";

export type ReportExcludeRule = {
  id: string;
  label: string;
  fieldKey: string;
  operator: ReportExcludeOperator;
  value?: string;
  flags?: string;
  enabled?: boolean;
};

export type ReportDiagnosticSeverity = "info" | "warning" | "error";

export type ReportDiagnostic = {
  severity: ReportDiagnosticSeverity;
  code: string;
  message: string;
  fieldKey?: string;
  sourceHeader?: string;
  sourceRowNumber?: number | null;
};

export type HeaderMatch = {
  fieldKey: string;
  sourceHeader: string | null;
  sourceIndex: number | null;
  required: boolean;
  found: boolean;
};

export type NormalizedReportRecord = {
  sourceType: string;
  sourceFile: string;
  sourceRowNumber: number | null;
  recordKind: string;
  customerIdentity: {
    dashboardCustomerId: string;
    cwId: string;
    hmisId: string;
    caseworthyId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    dob: string;
  };
  enrollmentEvidence: {
    programId: string;
    projectName: string;
    entryDate: string;
    exitDate: string;
    destination: string;
  };
  paymentEvidence: {
    vendor: string;
    amount: number | null;
    transactionDate: string;
    serviceMonth: string;
    grant: string;
    reference: string;
    invoice: string;
  };
  raw: Record<string, unknown>;
  diagnostics: ReportDiagnostic[];
};

export type ReconciliationPacketSummary = {
  sourceType: string;
  sourceFile: string;
  recordKind: string;
  totalRows: number;
  normalizedRows: number;
  excludedRows?: number;
  diagnosticCount: number;
  requiredMissingCount: number;
};

export type ReconciliationPacket = {
  profileId: string;
  profileLabel: string;
  sourceFile: string;
  headers: string[];
  headerRowIndex: number;
  records: NormalizedReportRecord[];
  diagnostics: ReportDiagnostic[];
  summary: ReconciliationPacketSummary;
};

export type ProposedReconciliationAction = {
  actionType: string;
  severity: ReportDiagnosticSeverity;
  confidence: number;
  customerId: string;
  affectedSources: string[];
  proposedChange: Record<string, unknown>;
  explanation: string[];
  requiresApproval: boolean;
  status: "pending" | "approved" | "rejected" | "applied";
};

const HEADER_CLEANUP_RE = /[\s_\-./()[\]{}:]+/g;
const MONEY_CLEANUP_RE = /[$,\s]/g;
const WORD_RE = /[a-z0-9]+/g;

export const DEFAULT_REPORT_SOURCE_PROFILES: ReportSourceProfile[] = [
  {
    id: "other_csv",
    label: "Other / Custom CSV",
    recordKind: "customCustomerEnrollment",
    active: true,
    schemaVersion: 1,
    notes: "Generic customer and enrollment import. Every field is optional; map any relevant columns before review.",
    sourceAliases: ["other", "custom", "csv", "spreadsheet", "tracker"],
    fields: {
      customerId: { required: false, type: "identity", aliases: ["Customer ID", "Customer Id", "Dashboard Customer ID", "Dashboard ID"] },
      cwId: { required: false, type: "identity", aliases: ["CWID", "CW ID", "CaseWorthy ID", "Caseworthy ID"] },
      hmisId: { required: false, type: "identity", aliases: ["HMIS ID", "HMIS Client Identifier", "Client ID"] },
      customerName: { required: false, type: "identity", aliases: ["Full Name", "Customer Name", "Client Name", "Name"] },
      firstName: { required: false, type: "identity", aliases: ["First Name", "Given Name"] },
      lastName: { required: false, type: "identity", aliases: ["Last Name", "Surname"] },
      dob: { required: false, type: "date", aliases: ["DOB", "Date of Birth", "Birth Date"] },
      grant: { required: false, type: "grant", aliases: ["Grant", "Program", "Project"] },
      enrollment: { required: false, type: "grant", aliases: ["Enrollment", "Enrollment Name", "Project Enrollment"] },
      entryDate: { required: false, type: "date", aliases: ["Enrollment Start", "Entry Date", "Start Date", "Begin Date", "TSS Begin Date"] },
      exitDate: { required: false, type: "date", aliases: ["Enrollment End", "Exit Date", "End Date", "TSS End Date"] },
    },
  },
  {
    id: "rental_assistance_invoice_request",
    label: "Rental Assistance Invoice Request Workbook",
    recordKind: "rentalAssistanceInvoiceRequest",
    active: true,
    schemaVersion: 1,
    notes: "Based on multi-sheet rental assistance invoice request workbooks with one worksheet per grant/program.",
    sourceAliases: ["invoice request", "rental assistance", "service cost", "household", "invoice status"],
    fields: {
      includeRow: { required: false, aliases: ["Working", "Include", "Active"] },
      serviceDate: { required: false, type: "date", aliases: ["Month", "Invoice Date", "Payment Date", "Assistance Start", "Date"] },
      customerName: { required: true, type: "identity", aliases: ["Household", "Client Name", "Customer", "Customer Name", "Name"] },
      grant: { required: false, type: "grant", aliases: ["Project Enrollment", "Project", "Grant", "Program"] },
      serviceName: { required: false, aliases: ["Service Type", "Service", "Description", "Type"] },
      amount: { required: true, type: "money", aliases: ["Service Cost", "Total Assistance", "Total Service Cost", "Amount", "Cost"] },
      vendor: { required: false, type: "vendor", aliases: ["Vendor", "Payment made to", "Payee", "Landlord", "Notes/Vendor"] },
      invoice: { required: false, aliases: ["Invoice Status", "Status", "Notes on status"] },
      dataEntry: { required: false, aliases: ["Data Entry", "Data Entry (Compliance)", "Entered in CM Dashboard", "Data type"] },
    },
    excludeRules: [
      {
        id: "rental_blank_household",
        label: "Blank household/name",
        fieldKey: "customerName",
        operator: "is_blank",
        enabled: true,
      },
    ],
  },
  {
    id: "hmis_service_payment_report",
    label: "HMIS Service Provided Report",
    recordKind: "hmisServicePayment",
    active: true,
    schemaVersion: 1,
    notes: "Based on BusinessObjects service reconciliation exports.",
    fields: {
      clientId: { required: true, type: "identity", aliases: ["Client ID", "Client Id", "ClientID", "Client"] },
      firstName: { required: true, type: "identity", aliases: ["First Name", "Given Name"] },
      lastName: { required: true, type: "identity", aliases: ["Last Name", "Surname"] },
      dob: { required: false, type: "date", aliases: ["Date of Birth", "DOB", "Birth Date"] },
      providerId: { required: true, type: "grant", aliases: ["Provider Id", "Provider ID", "Provider Name", "Project Name", "Provider"] },
      serviceStartDate: { required: false, type: "date", aliases: ["Service Start Date", "Start Date", "Date"] },
      serviceEndDate: { required: false, type: "date", aliases: ["Service End Date", "End Date"] },
      amount: { required: true, type: "money", aliases: ["Group Total Cost of Units", "Cost", "Total Cost", "Amount"] },
      serviceCode: { required: false, aliases: ["Service Code", "Code"] },
      serviceDescription: { required: false, aliases: ["Service Code Description", "Service Description", "Description"] },
    },
    excludeRules: [
      {
        id: "hmis_amount_zero_or_blank",
        label: "Blank or $0 amount",
        fieldKey: "amount",
        operator: "amount_zero_or_blank",
        enabled: true,
      },
      {
        id: "hmis_service_code_case_management",
        label: "Service code contains case management",
        fieldKey: "serviceCode",
        operator: "contains",
        value: "case management",
        enabled: true,
      },
      {
        id: "hmis_service_description_case_management",
        label: "Service description contains case management",
        fieldKey: "serviceDescription",
        operator: "contains",
        value: "case management",
        enabled: true,
      },
    ],
  },
  {
    id: "financial_edge_project_activity",
    label: "Financial Project Activity Report",
    recordKind: "financialEdgeTransaction",
    active: true,
    schemaVersion: 1,
    notes: "Based on grant-specific project activity workbooks with account, description, date, reference, and balance columns.",
    fields: {
      account: { required: false, aliases: ["Account", "Account Code"] },
      description: { required: true, type: "vendor", aliases: ["Description", "Payee", "Vendor", "Name"] },
      transactionDate: { required: false, type: "date", aliases: ["Date", "Transaction Date", "Post Date", "GL Date", "Document Date"] },
      reference: { required: false, aliases: ["Reference", "Reference Number", "Invoice", "Document Number"] },
      amount: { required: true, type: "money", aliases: ["Balance", "Amount", "Transaction Amount", "Debit", "Credit"] },
      providerId: { required: false, type: "grant", aliases: ["Provider Id", "Provider ID", "Project", "Grant"] },
    },
    excludeRules: [
      {
        id: "fe_blank_account",
        label: "Blank account",
        fieldKey: "account",
        operator: "is_blank",
        enabled: true,
      },
      {
        id: "fe_blank_description",
        label: "Blank description",
        fieldKey: "description",
        operator: "is_blank",
        enabled: true,
      },
      {
        id: "fe_amount_zero_or_blank",
        label: "Blank or $0 amount",
        fieldKey: "amount",
        operator: "amount_zero_or_blank",
        enabled: true,
      },
      {
        // Leading GL category stems only — scrap rows carry "-Direct Svcs" /
        // "-Rental Assistance" suffixes, so never key on those. "Unposted" /
        // "accounts payable" rows are intentionally NOT excluded: they are real
        // pending client payments matched by amount + date.
        id: "fe_admin_payroll_allocation_description",
        label: "Payroll/benefits/overhead description",
        fieldKey: "description",
        operator: "regex",
        value: "\\b(payroll|salar|wage|fica|accrued|med(ical)?\\s+ins|work(ers)?\\s+comp|unemploy|401k|retire|pension|fringe|benefit|space\\s+cost|allocation|indirect|overhead|communicat|depreciat|occupancy)",
        flags: "i",
        enabled: true,
      },
      {
        id: "fe_admin_payroll_allocation_reference",
        label: "Payroll or allocation reference",
        fieldKey: "reference",
        operator: "regex",
        value: "\\b(payroll|allocation)\\b",
        flags: "i",
        enabled: true,
      },
      {
        id: "fe_summary_balance_description",
        label: "Balance/totals summary description",
        fieldKey: "description",
        operator: "regex",
        value: "(beginning|ending)\\s+balance|adjustments?\\s+to\\s+balance|totals?\\s+for|subtotal|journal\\s+entr",
        flags: "i",
        enabled: true,
      },
      {
        id: "fe_summary_balance_reference",
        label: "Balance/totals summary reference",
        fieldKey: "reference",
        operator: "regex",
        value: "(beginning|ending)\\s+balance|adjustments?\\s+to\\s+balance|totals?\\s+for|subtotal|journal\\s+entr",
        flags: "i",
        enabled: true,
      },
    ],
  },
  {
    id: "coordinated_entry_by_name_list",
    label: "HMIS Coordinated Entry By Name Report",
    recordKind: "coordinatedEntryEnrollment",
    active: true,
    schemaVersion: 1,
    notes: "Based on Coordinated Entry client-enrolled exports. Header rows may be preceded by blank/prompt rows.",
    fields: {
      firstName: { required: true, type: "identity", aliases: ["First Name", "Given Name"] },
      lastName: { required: true, type: "identity", aliases: ["Last Name", "Surname"] },
      hmisId: { required: true, type: "identity", aliases: ["HMIS Client Identifier", "Client ID", "Client Id", "ClientID"] },
      dob: { required: false, type: "date", aliases: ["Date of Birth", "DOB", "Birth Date"] },
      assessmentDate: { required: false, type: "date", aliases: ["Assessment Date"] },
      dateIdentified: { required: false, type: "date", aliases: ["Date Identified"] },
      lastContactDate: { required: false, type: "date", aliases: ["Last Contact Date"] },
      serviceProvider: { required: false, type: "grant", aliases: ["Service Provider", "Provider"] },
      includeRow: { required: false, aliases: ["vInclude Row - active", "Include Row", "Active"] },
    },
  },
  {
    id: "caseworthy_service_detail",
    label: "Caseworthy Service — Account Specifics (detail)",
    recordKind: "caseworthyServiceDetail",
    active: true,
    schemaVersion: 1,
    notes: "Caseworthy ClientsServedDetail export: one row per service event per client (with a service description + date). Account/grant comes from the report parameters, not the rows. Auto-detected by caseworthyInterpreter.",
    sourceAliases: ["caseworthy", "clients served", "service detail", "hrdc"],
    fields: {
      caseworthyId: { required: true, type: "identity", aliases: ["ClientID3", "ClientID", "Client ID", "Client Id"] },
      lastName: { required: true, type: "identity", aliases: ["LastName2", "LastName", "Last Name", "Surname"] },
      firstName: { required: true, type: "identity", aliases: ["Textbox98", "FirstName", "First Name", "Given Name"] },
      dob: { required: false, type: "date", aliases: ["BirthDate2", "BirthDate", "Date of Birth", "DOB"] },
      serviceName: { required: true, aliases: ["Description2", "Service", "Service Name", "Description"] },
      serviceDate: { required: true, type: "date", aliases: ["ServiceBeginDate4", "Service Begin Date", "Service Date", "Date"] },
      caseManager: { required: false, aliases: ["CaseManager2", "Case Manager", "CaseManager"] },
      amount: { required: true, type: "money", aliases: ["ServiceTotal6", "Service Total", "Amount", "Cost"] },
      address: { required: false, aliases: ["Textbox47", "Address"] },
      grant: { required: false, type: "grant", aliases: ["AccountList", "Account", "Grant", "Program"] },
    },
  },
  {
    id: "caseworthy_service_total",
    label: "Caseworthy Service — Organization Total (per-client)",
    recordKind: "caseworthyServiceTotal",
    active: true,
    schemaVersion: 1,
    notes: "Caseworthy ClientsServedTotalDetail export: one row per client with per-client totals plus a repeated org grand total; no service dates. Account/grant comes from the report parameters. Auto-detected by caseworthyInterpreter.",
    sourceAliases: ["caseworthy", "clients served total", "service total", "hrdc"],
    fields: {
      caseworthyId: { required: true, type: "identity", aliases: ["ClientID", "Client ID", "Client Id", "ClientID3"] },
      lastName: { required: true, type: "identity", aliases: ["LastName", "Last Name", "LastName2", "Surname"] },
      firstName: { required: true, type: "identity", aliases: ["FirstName", "First Name", "Textbox98", "Given Name"] },
      dob: { required: false, type: "date", aliases: ["BirthDate", "Date of Birth", "DOB", "BirthDate2"] },
      program: { required: true, type: "grant", aliases: ["ProgramName1", "Program Name", "Program"] },
      region: { required: false, aliases: ["RegionName1", "Region"] },
      caseManager: { required: false, aliases: ["CaseManager", "Case Manager", "CaseManager2"] },
      amount: { required: true, type: "money", aliases: ["ServiceTotal2", "Service Total", "Amount"] },
      units: { required: false, aliases: ["Units2", "Units"] },
      grant: { required: false, type: "grant", aliases: ["AccountList", "Account", "Grant"] },
    },
  },
  {
    id: "dashboard_payment_schedule",
    label: "Dashboard Payment Schedule",
    recordKind: "dashboardPaymentSchedule",
    active: false,
    schemaVersion: 1,
    notes: "Placeholder profile for dashboard exports used by the future payment reconciliation tool.",
    fields: {
      customerId: { required: false, type: "identity", aliases: ["Customer ID", "Customer Id", "Dashboard Customer ID"] },
      customerName: { required: true, type: "identity", aliases: ["Customer", "Customer Name", "Name"] },
      grant: { required: true, type: "grant", aliases: ["Grant", "Program", "Project"] },
      vendor: { required: false, type: "vendor", aliases: ["Vendor", "Payee", "Landlord"] },
      amount: { required: true, type: "money", aliases: ["Amount", "Payment Amount", "Scheduled Amount"] },
      dueDate: { required: false, type: "date", aliases: ["Due Date", "Scheduled Date", "Payment Date"] },
    },
  },
];

export function normalizeHeader(input: unknown): string {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(HEADER_CLEANUP_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCustomerName(input: unknown): string {
  return String(input ?? "")
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** How a single name column orders its words. "auto" = comma means "Last, First". */
export type ReportNameOrder = "auto" | "first_last" | "last_first";

export const REPORT_NAME_ORDER_LABELS: Record<ReportNameOrder, string> = {
  auto: "Smart (comma = Last, First)",
  first_last: "First Last",
  last_first: "Last, First",
};

/**
 * Parse a person-name cell into ordered parts. Strips parenthetical/bracketed
 * annotations trackers append to names ("Sara Da, Adayah (YHDP PSH)") so they
 * never pollute matching. In "auto" order a comma reads as Last, First (the
 * common tracker format); otherwise word order is read as First … Last.
 */
export function parseReportPersonName(input: unknown, order: ReportNameOrder = "auto") {
  const raw = String(input ?? "").replace(/[([{][^)\]}]*[)\]}]?/g, " ").replace(/[:;]/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return { firstName: "", lastName: "", fullName: "" };
  const commaParts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  let firstName = "";
  let lastName = "";
  let reordered = false;
  if (order !== "first_last" && commaParts.length > 1) {
    lastName = commaParts[0];
    firstName = commaParts.slice(1).join(" ");
    reordered = true;
  } else {
    const words = raw.replace(/,/g, " ").replace(/\./g, " ").split(/\s+/).filter(Boolean);
    if (order === "last_first") {
      lastName = words[0] ?? "";
      firstName = words.slice(1).join(" ");
      reordered = true;
    } else {
      firstName = words[0] ?? "";
      lastName = words.length > 1 ? words[words.length - 1] : "";
    }
  }
  // Reordered names rebuild as "First … Last"; natural order keeps the full
  // string so middle names still participate in exact-name matching.
  const fullName = normalizeCustomerName(reordered ? `${firstName} ${lastName}` : raw);
  return { firstName, lastName, fullName };
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

export function normalizeAmount(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw);
  const cleaned = raw.replace(/[()]/g, "").replace(MONEY_CLEANUP_RE, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

export function normalizeDate(input: unknown): string {
  if (input instanceof Date && Number.isFinite(input.getTime())) return input.toISOString().slice(0, 10);
  if (typeof input === "number" && Number.isFinite(input)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + Math.round(input) * 86400000).toISOString().slice(0, 10);
  }
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  if (/^\d+(\.\d+)?$/.test(raw)) return normalizeDate(Number(raw));
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export function normalizeReportProfiles(raw: unknown): ReportSourceProfile[] {
  if (!Array.isArray(raw)) return DEFAULT_REPORT_SOURCE_PROFILES;
  const profiles = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ReportSourceProfile>;
    if (!candidate.id || !candidate.label || !candidate.recordKind || !candidate.fields || typeof candidate.fields !== "object") {
      return [];
    }
    const fields = Object.fromEntries(
      Object.entries(candidate.fields).flatMap(([fieldKey, field]) => {
        if (!field || typeof field !== "object") return [];
        const value = field as Partial<ReportFieldProfile>;
        return [[fieldKey, {
          required: value.required === true,
          type: value.type,
          aliases: Array.isArray(value.aliases) ? value.aliases.map(String).filter(Boolean) : [],
          notes: value.notes,
        } satisfies ReportFieldProfile]];
      }),
    );
    return [{
      id: String(candidate.id),
      label: String(candidate.label),
      recordKind: String(candidate.recordKind),
      active: candidate.active !== false,
      fields,
      excludeRules: normalizeExcludeRules(candidate.excludeRules, []),
      notes: candidate.notes,
      sourceAliases: Array.isArray(candidate.sourceAliases) ? candidate.sourceAliases.map(String).filter(Boolean) : [],
      schemaVersion: Number(candidate.schemaVersion || 1),
    } satisfies ReportSourceProfile];
  });
  if (!profiles.length) return DEFAULT_REPORT_SOURCE_PROFILES;
  const genericProfile = DEFAULT_REPORT_SOURCE_PROFILES.find((profile) => profile.id === "other_csv");
  return genericProfile && !profiles.some((profile) => profile.id === genericProfile.id)
    ? [genericProfile, ...profiles]
    : profiles;
}

export function getActiveReportProfiles(profiles: ReportSourceProfile[]): ReportSourceProfile[] {
  return profiles.filter((profile) => profile.active !== false);
}

export function findReportProfile(profiles: ReportSourceProfile[], id: string): ReportSourceProfile | null {
  const normalizedId = id.trim().toLowerCase();
  return profiles.find((profile) => profile.id.toLowerCase() === normalizedId) ?? null;
}

export function buildProfileWordBag(profile: ReportSourceProfile): Set<string> {
  const text = [
    profile.id,
    profile.label,
    profile.recordKind,
    profile.notes,
    ...(profile.sourceAliases ?? []),
    ...Object.keys(profile.fields),
    ...Object.values(profile.fields).flatMap((field) => field.aliases),
  ].join(" ");
  return new Set(normalizeHeader(text).match(WORD_RE) ?? []);
}

export function scoreReportProfile(profile: ReportSourceProfile, headers: unknown[], sourceName = "") {
  const { matches, diagnostics } = matchProfileHeaders(profile, headers);
  const requiredMatches = matches.filter((match) => match.required && match.found).length;
  const requiredTotal = matches.filter((match) => match.required).length;
  const optionalMatches = matches.filter((match) => !match.required && match.found).length;
  const sourceWords = new Set(normalizeHeader(sourceName).match(WORD_RE) ?? []);
  const profileWords = buildProfileWordBag(profile);
  const sourceWordMatches = Array.from(sourceWords).filter((word) => profileWords.has(word)).length;
  const missingRequired = diagnostics.filter((diagnostic) => diagnostic.code === "required_header_missing").length;
  const score = requiredMatches * 8 + optionalMatches * 2 + sourceWordMatches - missingRequired * 5;
  return {
    profile,
    score,
    matches,
    diagnostics,
    requiredMatches,
    requiredTotal,
    optionalMatches,
    sourceWordMatches,
  };
}

export function detectLikelyReportProfiles(profiles: ReportSourceProfile[], headers: unknown[], sourceName = "", limit = 5) {
  return profiles
    .filter((profile) => profile.active !== false)
    .map((profile) => scoreReportProfile(profile, headers, sourceName))
    .sort((a, b) => b.score - a.score || b.requiredMatches - a.requiredMatches || b.optionalMatches - a.optionalMatches)
    .slice(0, limit);
}

export function buildHeaderIndex(headers: unknown[]): Map<string, { header: string; index: number }> {
  const index = new Map<string, { header: string; index: number }>();
  headers.forEach((header, i) => {
    const label = String(header ?? "").trim();
    const normalized = normalizeHeader(label);
    if (normalized && !index.has(normalized)) index.set(normalized, { header: label, index: i });
  });
  return index;
}

/**
 * Per-field manual mapping overrides keyed by field key. A non-negative number
 * pins the field to that column index; `-1` explicitly unmaps it (ignoring alias
 * auto-match). Fields absent from the map fall back to alias matching.
 */
export type FieldColumnOverrides = Record<string, number>;

export function matchProfileHeaders(
  profile: ReportSourceProfile,
  headers: unknown[],
  overrides?: FieldColumnOverrides,
): { matches: HeaderMatch[]; diagnostics: ReportDiagnostic[] } {
  const headerIndex = buildHeaderIndex(headers);
  const diagnostics: ReportDiagnostic[] = [];
  const matches = Object.entries(profile.fields).map<HeaderMatch>(([fieldKey, field]) => {
    const override = overrides?.[fieldKey];
    let found: { header: string; index: number } | null;
    if (override != null && override >= 0) {
      const index = Math.min(override, Math.max(0, headers.length - 1));
      found = { header: String(headers[index] ?? `Column ${index + 1}`).trim() || `Column ${index + 1}`, index };
    } else if (override === -1) {
      found = null; // explicitly unmapped by the operator
    } else {
      const aliases = [fieldKey, ...field.aliases];
      found = aliases.map(normalizeHeader).map((alias) => headerIndex.get(alias)).find(Boolean) ?? null;
    }
    if (field.required && !found) {
      diagnostics.push({
        severity: "error",
        code: "required_header_missing",
        fieldKey,
        message: `Required field "${fieldKey}" was not found in the report headers.`,
      });
    }
    return {
      fieldKey,
      sourceHeader: found?.header ?? null,
      sourceIndex: found?.index ?? null,
      required: field.required,
      found: Boolean(found),
    };
  });
  return { matches, diagnostics };
}

export function validateRequiredFields(profile: ReportSourceProfile, headers: unknown[]): ReportDiagnostic[] {
  return matchProfileHeaders(profile, headers).diagnostics;
}

function readRawValue(row: Record<string, unknown> | unknown[], match: HeaderMatch): unknown {
  if (match.sourceIndex != null && Array.isArray(row)) return row[match.sourceIndex];
  if (match.sourceHeader && !Array.isArray(row)) return row[match.sourceHeader];
  return undefined;
}

const EXCLUDE_OPERATORS: ReportExcludeOperator[] = [
  "contains",
  "not_contains",
  "equals",
  "not_equals",
  "regex",
  "not_regex",
  "is_blank",
  "is_not_blank",
  "amount_zero_or_blank",
];

function normalizeRuleText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactRuleText(value: unknown) {
  return normalizeRuleText(value).replace(/[^a-z0-9]+/g, "");
}

export function normalizeExcludeRules(raw: unknown, fallback: ReportExcludeRule[] = []): ReportExcludeRule[] {
  if (!Array.isArray(raw)) return fallback.map((rule) => ({ ...rule }));
  const rules = raw.flatMap((item, index): ReportExcludeRule[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ReportExcludeRule>;
    const operator = EXCLUDE_OPERATORS.includes(candidate.operator as ReportExcludeOperator)
      ? candidate.operator as ReportExcludeOperator
      : null;
    if (!candidate.fieldKey || !operator) return [];
    return [{
      id: String(candidate.id || `exclude_rule_${index + 1}`),
      label: String(candidate.label || candidate.id || `Exclude rule ${index + 1}`),
      fieldKey: String(candidate.fieldKey),
      operator,
      value: candidate.value == null ? "" : String(candidate.value),
      flags: candidate.flags == null ? undefined : String(candidate.flags).replace(/[^dgimsuvy]/g, ""),
      enabled: candidate.enabled !== false,
    }];
  });
  return rules.length ? rules : fallback.map((rule) => ({ ...rule }));
}

export function defaultExcludeRulesForProfile(profile: ReportSourceProfile): ReportExcludeRule[] {
  return normalizeExcludeRules(profile.excludeRules, []);
}

function excludeRuleMatches(rule: ReportExcludeRule, value: unknown) {
  const raw = String(value ?? "");
  const text = normalizeRuleText(raw);
  const expected = normalizeRuleText(rule.value);
  const compactText = compactRuleText(raw);
  const compactExpected = compactRuleText(rule.value);
  if (rule.operator === "is_blank") return !text;
  if (rule.operator === "is_not_blank") return Boolean(text);
  if (rule.operator === "amount_zero_or_blank") {
    const amount = normalizeAmount(value);
    return amount == null || Math.abs(amount) < 0.005;
  }
  if (rule.operator === "contains") {
    if (!expected) return false;
    return text.includes(expected) || Boolean(compactExpected && compactText.includes(compactExpected));
  }
  if (rule.operator === "not_contains") {
    if (!expected) return false;
    return !text.includes(expected) && !(compactExpected && compactText.includes(compactExpected));
  }
  if (rule.operator === "equals") return text === expected;
  if (rule.operator === "not_equals") return text !== expected;
  if (rule.operator === "regex" || rule.operator === "not_regex") {
    if (!rule.value) return false;
    try {
      const regex = new RegExp(rule.value, rule.flags || "i");
      const matched = regex.test(raw);
      return rule.operator === "regex" ? matched : !matched;
    } catch {
      return false;
    }
  }
  return false;
}

export type ReportFilterEvaluation = {
  excluded: boolean;
  matchedRuleIds: string[];
  matchedRuleLabels: string[];
  values: Record<string, unknown>;
};

export type ReportFilterRow = ReportFilterEvaluation & {
  row: unknown[];
  rowIndex: number;
  sourceRowNumber: number | null;
};

export function evaluateExcludeRules(
  profile: ReportSourceProfile,
  headers: unknown[],
  row: Record<string, unknown> | unknown[],
  overrides?: FieldColumnOverrides,
  rules: ReportExcludeRule[] = defaultExcludeRulesForProfile(profile),
): ReportFilterEvaluation {
  const normalizedRules = normalizeExcludeRules(rules, []);
  const enabledRules = normalizedRules.filter((rule) => rule.enabled !== false);
  const { matches } = matchProfileHeaders(profile, headers, overrides);
  const matchMap = new Map(matches.map((match) => [match.fieldKey, match]));
  const values: Record<string, unknown> = {};
  const mappedFields = new Set<string>();
  for (const rule of enabledRules) {
    const match = matchMap.get(rule.fieldKey);
    if (match && (match.sourceIndex != null || match.sourceHeader)) mappedFields.add(rule.fieldKey);
    values[rule.fieldKey] = match ? readRawValue(row, match) : undefined;
  }
  const matched = enabledRules.filter((rule) => {
    if ((rule.operator === "is_blank" || rule.operator === "amount_zero_or_blank") && !mappedFields.has(rule.fieldKey)) return false;
    return excludeRuleMatches(rule, values[rule.fieldKey]);
  });
  return {
    excluded: matched.length > 0,
    matchedRuleIds: matched.map((rule) => rule.id),
    matchedRuleLabels: matched.map((rule) => rule.label),
    values,
  };
}

export function filterReportRows({
  profile,
  headers,
  rows,
  headerRowIndex,
  fieldOverrides,
  excludeRules,
}: {
  profile: ReportSourceProfile;
  headers: unknown[];
  rows: unknown[][];
  headerRowIndex: number;
  fieldOverrides?: FieldColumnOverrides;
  excludeRules?: ReportExcludeRule[];
}): { included: ReportFilterRow[]; excluded: ReportFilterRow[]; all: ReportFilterRow[] } {
  const rules = normalizeExcludeRules(excludeRules, defaultExcludeRulesForProfile(profile));
  const all = rows.map((row, index) => {
    const evaluation = evaluateExcludeRules(profile, headers, row, fieldOverrides, rules);
    return {
      row,
      rowIndex: index,
      sourceRowNumber: headerRowIndex + index + 2,
      ...evaluation,
    };
  });
  return {
    included: all.filter((row) => !row.excluded),
    excluded: all.filter((row) => row.excluded),
    all,
  };
}

export function normalizeReportRow(
  profile: ReportSourceProfile,
  headers: unknown[],
  row: Record<string, unknown> | unknown[],
  source: { sourceType?: string; sourceFile?: string; sourceRowNumber?: number | null; sourceGrant?: string; nameOrder?: ReportNameOrder } = {},
  overrides?: FieldColumnOverrides,
): NormalizedReportRecord {
  const { matches, diagnostics } = matchProfileHeaders(profile, headers, overrides);
  const values = new Map<string, unknown>();
  matches.forEach((match) => values.set(match.fieldKey, readRawValue(row, match)));

  const firstName = String(values.get("firstName") ?? "").trim();
  const lastName = String(values.get("lastName") ?? "").trim();
  const amount = normalizeAmount(values.get("amount"));
  const transactionDate = normalizeDate(values.get("transactionDate") ?? values.get("serviceStartDate") ?? values.get("serviceDate") ?? values.get("dueDate"));
  const serviceName = String(values.get("serviceName") ?? values.get("serviceDescription") ?? "").trim();
  const reference = String(values.get("reference") ?? serviceName).trim();
  const parsedReference = profile.id === "financial_edge_project_activity" ? parseFinancialEdgeReference(reference) : null;
  const parsedFeName = profile.id === "financial_edge_project_activity"
    ? String(parsedReference?.fields.staffPrefix || parsedReference?.fields.customerName || "").replace(/\./g, " ").replace(/\s+/g, " ").trim()
    : "";
  const reportNameValue = firstText(values.get("customerName"), parsedFeName);
  const sourceGrant = String(source.sourceGrant ?? "").trim();
  const reportGrant = firstText(values.get("grant"), values.get("enrollment"), values.get("providerId"), values.get("serviceProvider"), sourceGrant, serviceName);
  const parsedName = parseReportPersonName(reportNameValue, source.nameOrder ?? "auto");
  const fullName = parsedName.fullName || normalizeCustomerName(`${firstName} ${lastName}`);

  return {
    sourceType: source.sourceType || profile.id,
    sourceFile: source.sourceFile || "",
    sourceRowNumber: source.sourceRowNumber ?? null,
    recordKind: profile.recordKind,
    customerIdentity: {
      dashboardCustomerId: String(values.get("customerId") ?? "").trim(),
      cwId: String(values.get("cwId") ?? "").trim(),
      hmisId: String(values.get("hmisId") ?? values.get("clientId") ?? "").trim(),
      caseworthyId: String(values.get("caseworthyId") ?? "").trim(),
      firstName: firstName || parsedName.firstName,
      lastName: lastName || parsedName.lastName,
      fullName,
      dob: normalizeDate(values.get("dob")),
    },
    enrollmentEvidence: {
      programId: firstText(values.get("programId"), values.get("providerId"), values.get("serviceProvider"), values.get("program"), sourceGrant),
      projectName: firstText(values.get("projectName"), values.get("enrollment"), values.get("providerId"), values.get("serviceProvider"), values.get("program"), reportGrant),
      entryDate: normalizeDate(values.get("entryDate") ?? values.get("projectEntryDate") ?? values.get("dateIdentified")),
      exitDate: normalizeDate(values.get("exitDate") ?? values.get("projectExitDate")),
      destination: String(values.get("destination") ?? "").trim(),
    },
    paymentEvidence: {
      vendor: String(values.get("vendor") ?? values.get("description") ?? "").trim(),
      amount,
      transactionDate,
      serviceMonth: transactionDate.slice(0, 7),
      grant: reportGrant,
      reference,
      invoice: String(values.get("invoice") ?? values.get("dataEntry") ?? "").trim(),
    },
    raw: {
      ...(Array.isArray(row) ? Object.fromEntries(headers.map((header, i) => [String(header || `column_${i + 1}`), row[i]])) : row),
      ...(parsedReference ? { parsedFinancialEdgeReference: parsedReference } : {}),
    },
    diagnostics,
  };
}

export function buildReconciliationPacket({
  profile,
  headers,
  rows,
  sourceFile,
  headerRowIndex,
  fieldOverrides,
  excludeRules,
  sourceGrant,
  nameOrder,
}: {
  profile: ReportSourceProfile;
  headers: unknown[];
  rows: unknown[][];
  sourceFile: string;
  headerRowIndex: number;
  fieldOverrides?: FieldColumnOverrides;
  excludeRules?: ReportExcludeRule[];
  sourceGrant?: string;
  nameOrder?: ReportNameOrder;
}): ReconciliationPacket {
  const normalizedHeaders = headers.map((header) => String(header ?? ""));
  const headerResult = matchProfileHeaders(profile, normalizedHeaders, fieldOverrides);
  const filtered = filterReportRows({
    profile,
    headers: normalizedHeaders,
    rows,
    headerRowIndex,
    fieldOverrides,
    excludeRules,
  });
  const records = filtered.included.map((filterRow) =>
    normalizeReportRow(profile, normalizedHeaders, filterRow.row, {
      sourceType: profile.id,
      sourceFile,
      sourceRowNumber: filterRow.sourceRowNumber,
      sourceGrant,
      nameOrder,
    }, fieldOverrides),
  );
  const rowDiagnostics = records.flatMap((record) => record.diagnostics);
  const diagnostics = [...headerResult.diagnostics, ...rowDiagnostics];
  return {
    profileId: profile.id,
    profileLabel: profile.label,
    sourceFile,
    headers: normalizedHeaders,
    headerRowIndex,
    records,
    diagnostics,
    summary: {
      sourceType: profile.id,
      sourceFile,
      recordKind: profile.recordKind,
      totalRows: rows.length,
      normalizedRows: records.length,
      excludedRows: filtered.excluded.length,
      diagnosticCount: diagnostics.length,
      requiredMissingCount: headerResult.diagnostics.filter((diagnostic) => diagnostic.code === "required_header_missing").length,
    },
  };
}

/** Derive header labels + non-empty data rows for a chosen header row index. */
export function deriveHeadersAndRows(allRows: unknown[][], headerRowIndex: number) {
  const safeIndex = Math.min(Math.max(0, headerRowIndex), Math.max(0, allRows.length - 1));
  const headers = (allRows[safeIndex] ?? []).map((value) => String(value ?? "").trim());
  const dataRows = allRows
    .slice(safeIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((value) => String(value ?? "").trim()));
  return { headers, dataRows, headerRowIndex: safeIndex };
}

/**
 * Distinct grant/provider/project signals seen in a packet's rows. These are the
 * report-side values matched against dashboard grant names (HMIS service provider,
 * CE service provider, dashboard project name, etc.). Financial Edge rows usually
 * lack this, so callers should also consider the file name.
 */
export function collectReportGrantSignals(packet: ReconciliationPacket): string[] {
  const set = new Set<string>();
  for (const record of packet.records) {
    const signal = record.paymentEvidence.grant
      || record.enrollmentEvidence.projectName
      || record.enrollmentEvidence.programId;
    const value = String(signal || "").trim();
    if (value) set.add(value);
    if (set.size >= 50) break;
  }
  return Array.from(set);
}
