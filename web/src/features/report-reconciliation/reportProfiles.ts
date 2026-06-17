"use client";

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
  notes?: string;
  sourceAliases?: string[];
  schemaVersion?: number;
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
    id: "caseworthy_service_report",
    label: "Caseworthy Service Report",
    recordKind: "caseworthyService",
    active: false,
    schemaVersion: 1,
    notes: "Placeholder for future Caseworthy service exports once safe sample report shapes are available.",
    fields: {
      caseworthyId: { required: false, type: "identity", aliases: ["Caseworthy ID", "CW ID", "Client ID", "Client Id"] },
      firstName: { required: false, type: "identity", aliases: ["First Name", "Given Name"] },
      lastName: { required: false, type: "identity", aliases: ["Last Name", "Surname"] },
      serviceDate: { required: false, type: "date", aliases: ["Service Date", "Date", "Start Date"] },
      serviceName: { required: false, aliases: ["Service", "Service Name", "Description"] },
      amount: { required: false, type: "money", aliases: ["Amount", "Cost", "Total"] },
      grant: { required: false, type: "grant", aliases: ["Grant", "Program", "Project"] },
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
      notes: candidate.notes,
      sourceAliases: Array.isArray(candidate.sourceAliases) ? candidate.sourceAliases.map(String).filter(Boolean) : [],
      schemaVersion: Number(candidate.schemaVersion || 1),
    } satisfies ReportSourceProfile];
  });
  return profiles.length ? profiles : DEFAULT_REPORT_SOURCE_PROFILES;
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

export function normalizeReportRow(
  profile: ReportSourceProfile,
  headers: unknown[],
  row: Record<string, unknown> | unknown[],
  source: { sourceType?: string; sourceFile?: string; sourceRowNumber?: number | null } = {},
  overrides?: FieldColumnOverrides,
): NormalizedReportRecord {
  const { matches, diagnostics } = matchProfileHeaders(profile, headers, overrides);
  const values = new Map<string, unknown>();
  matches.forEach((match) => values.set(match.fieldKey, readRawValue(row, match)));

  const firstName = String(values.get("firstName") ?? "").trim();
  const lastName = String(values.get("lastName") ?? "").trim();
  const fullName = normalizeCustomerName(values.get("customerName") ?? `${firstName} ${lastName}`);
  const amount = normalizeAmount(values.get("amount"));
  const transactionDate = normalizeDate(values.get("transactionDate") ?? values.get("serviceStartDate") ?? values.get("dueDate"));

  return {
    sourceType: source.sourceType || profile.id,
    sourceFile: source.sourceFile || "",
    sourceRowNumber: source.sourceRowNumber ?? null,
    recordKind: profile.recordKind,
    customerIdentity: {
      dashboardCustomerId: String(values.get("customerId") ?? "").trim(),
      hmisId: String(values.get("hmisId") ?? values.get("clientId") ?? "").trim(),
      caseworthyId: String(values.get("caseworthyId") ?? "").trim(),
      firstName,
      lastName,
      fullName,
      dob: normalizeDate(values.get("dob")),
    },
    enrollmentEvidence: {
      programId: String(values.get("programId") ?? values.get("providerId") ?? values.get("serviceProvider") ?? "").trim(),
      projectName: String(values.get("projectName") ?? values.get("providerId") ?? values.get("serviceProvider") ?? values.get("grant") ?? "").trim(),
      entryDate: normalizeDate(values.get("entryDate") ?? values.get("projectEntryDate") ?? values.get("dateIdentified")),
      exitDate: normalizeDate(values.get("exitDate") ?? values.get("projectExitDate")),
      destination: String(values.get("destination") ?? "").trim(),
    },
    paymentEvidence: {
      vendor: String(values.get("vendor") ?? values.get("description") ?? "").trim(),
      amount,
      transactionDate,
      serviceMonth: transactionDate.slice(0, 7),
      grant: String(values.get("grant") ?? values.get("providerId") ?? values.get("serviceProvider") ?? "").trim(),
      reference: String(values.get("reference") ?? "").trim(),
      invoice: String(values.get("invoice") ?? "").trim(),
    },
    raw: Array.isArray(row) ? Object.fromEntries(headers.map((header, i) => [String(header || `column_${i + 1}`), row[i]])) : row,
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
}: {
  profile: ReportSourceProfile;
  headers: unknown[];
  rows: unknown[][];
  sourceFile: string;
  headerRowIndex: number;
  fieldOverrides?: FieldColumnOverrides;
}): ReconciliationPacket {
  const normalizedHeaders = headers.map((header) => String(header ?? ""));
  const headerResult = matchProfileHeaders(profile, normalizedHeaders, fieldOverrides);
  const records = rows.map((row, index) =>
    normalizeReportRow(profile, normalizedHeaders, row, {
      sourceType: profile.id,
      sourceFile,
      sourceRowNumber: headerRowIndex + index + 2,
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
