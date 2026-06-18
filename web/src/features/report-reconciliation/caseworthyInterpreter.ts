"use client";

import { normalizeDate, normalizeHeader } from "./reportProfiles";

/**
 * Caseworthy "Clients Served" report interpreter.
 *
 * Caseworthy service exports come in two shapes that share the same envelope:
 *   - "Account Specifics" (ClientsServedDetail): one row per service event per
 *     client, with a service description + service date. The account/grant
 *     (e.g. "Continuum of Care (CoC)-RRH") lives in the parameter block, not the rows.
 *   - "Organization Total" (ClientsServedTotalDetail): one row per client with
 *     per-client totals plus a repeated organization grand total; no service dates.
 *
 * Both wrap the data table in a parameter block at the top AND bottom of the file
 * (run-by, date range, AccountList, OrgList, ProgramList…). This module finds the
 * real data header, trims the trailing footer block, extracts that metadata, and
 * auto-detects which of the two variants a file is.
 */

export type CaseworthyVariant = "account-detail" | "org-total";

export type CaseworthyMetadata = {
  runBy: string;
  runAt: string;
  dateRangeFrom: string;
  dateRangeTo: string;
  org: string;
  account: string;
  program: string;
  service: string;
  /** Grant tokens detected in the parameters (CoC, ESG, HFV, YHDP, PSH, RRH…). */
  grantTokens: string[];
  /** All parsed parameter key→value pairs (top block), keyed by normalized key. */
  raw: Record<string, string>;
};

export type CaseworthyInterpretation = {
  variant: CaseworthyVariant;
  variantLabel: string;
  profileId: "caseworthy_service_detail" | "caseworthy_service_total";
  headerRowIndex: number;
  /** Exclusive end of the data block — rows at/after this are the footer/param block. */
  dataEndRow: number;
  metadata: CaseworthyMetadata;
};

const MAX_HEADER_SCAN = 30;
const compact = (value: unknown) => normalizeHeader(value).replace(/\s+/g, "");
const isBlankRow = (row: unknown[]) => !row.some((value) => String(value ?? "").trim());

function isParamKeyRow(row: unknown[]): boolean {
  const cells = row.map(compact);
  if (cells.some((cell) => cell.includes("headerrunby"))) return true;
  return cells.some((cell) => cell.includes("accountlist")) && cells.some((cell) => cell.includes("orglist"));
}

function isDataHeaderRow(row: unknown[]): boolean {
  const cells = row.map(compact);
  const hasClientId = cells.some((cell) => cell.startsWith("clientid"));
  const hasBirthDate = cells.some((cell) => cell.startsWith("birthdate"));
  return hasClientId && hasBirthDate;
}

function detectGrantTokens(text: string): string[] {
  const out = new Set<string>();
  if (/continuum of care|\bcoc\b/i.test(text)) out.add("CoC");
  if (/\besg\b/i.test(text)) out.add("ESG");
  if (/\bhfv\b|housing for veterans|hud-?vash|\bvash\b/i.test(text)) out.add("HFV");
  if (/\byhdp\b|youth homeless/i.test(text)) out.add("YHDP");
  if (/\bpsh\b|permanent supportive/i.test(text)) out.add("PSH");
  if (/\brrh\b|rapid re-?housing/i.test(text)) out.add("RRH");
  if (/\btbra\b/i.test(text)) out.add("TBRA");
  return Array.from(out);
}

function extractMetadata(rows: unknown[][], paramKeyIdx: number, footerText: string): CaseworthyMetadata {
  const raw: Record<string, string> = {};
  if (paramKeyIdx >= 0) {
    let valueIdx = paramKeyIdx + 1;
    while (valueIdx < rows.length && isBlankRow(rows[valueIdx] ?? [])) valueIdx += 1;
    const keys = rows[paramKeyIdx] ?? [];
    const values = rows[valueIdx] ?? [];
    keys.forEach((key, index) => {
      const normalizedKey = compact(key);
      if (normalizedKey) raw[normalizedKey] = String(values[index] ?? "").trim();
    });
  }
  const account = raw["accountlist"] ?? "";
  const program = raw["programlist"] ?? "";
  const service = raw["servicelist"] ?? "";
  const org = raw["orglist"] ?? "";

  const runByRaw = raw["headerrunby2"] ?? raw["headerrunby"] ?? "";
  const runMatch = /run by\s+(.*?)\s+on\s+(.*)$/i.exec(runByRaw);
  const runBy = runMatch ? runMatch[1].trim() : runByRaw;
  const runAt = runMatch ? runMatch[2].trim() : "";

  const dateRangeRaw = raw["reportdaterangedates"] ?? "";
  const [fromRaw = "", toRaw = ""] = dateRangeRaw.split(/\s+to\s+/i);
  const dateRangeFrom = normalizeDate(fromRaw);
  const dateRangeTo = normalizeDate(toRaw);

  const grantTokens = detectGrantTokens([account, program, service, footerText].join(" "));

  return { runBy, runAt, dateRangeFrom, dateRangeTo, org, account, program, service, grantTokens, raw };
}

function detectVariant(headerRow: unknown[], fileName: string): CaseworthyVariant {
  const cells = headerRow.map(compact);
  const hasServiceDate = cells.some((cell) => cell.startsWith("servicebegindate") || cell.startsWith("servicedate"));
  const hasDescription = cells.some((cell) => cell.startsWith("description"));
  const hasProgramName = cells.some((cell) => cell.startsWith("programname"));
  const hasRegionName = cells.some((cell) => cell.startsWith("regionname"));
  if (hasServiceDate || hasDescription) return "account-detail";
  if (hasProgramName || hasRegionName) return "org-total";
  return /totaldetail/i.test(fileName) ? "org-total" : "account-detail";
}

const VARIANT_META: Record<CaseworthyVariant, { label: string; profileId: CaseworthyInterpretation["profileId"] }> = {
  "account-detail": { label: "Account Specifics (per-service detail)", profileId: "caseworthy_service_detail" },
  "org-total": { label: "Organization Total (per-client)", profileId: "caseworthy_service_total" },
};

/**
 * Returns an interpretation when `rows` look like a Caseworthy Clients Served
 * export, otherwise `null` (so non-Caseworthy reports fall through to the generic
 * profile pipeline untouched).
 */
export function interpretCaseworthyReport(rows: unknown[][], fileName = ""): CaseworthyInterpretation | null {
  if (!rows.length) return null;

  let paramKeyIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    if (isParamKeyRow(rows[i] ?? [])) {
      paramKeyIdx = i;
      break;
    }
  }

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, MAX_HEADER_SCAN); i += 1) {
    if (isDataHeaderRow(rows[i] ?? [])) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex < 0) return null;

  // Require a second, corroborating signal so a generic clientid+birthdate report
  // is not misread as Caseworthy.
  const fileSignal = /clientsserved|caseworthy/i.test(fileName);
  const headerCells = (rows[headerRowIndex] ?? []).map(compact);
  const cwColumnSignal = headerCells.some((cell) => cell.startsWith("servicetotal") || cell.startsWith("textbox"));
  if (paramKeyIdx < 0 && !fileSignal && !cwColumnSignal) return null;

  let dataEndRow = rows.length;
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    if (isBlankRow(rows[i] ?? [])) {
      dataEndRow = i;
      break;
    }
  }

  const footerText = rows
    .slice(dataEndRow)
    .map((row) => row.map((value) => String(value ?? "")).join(" "))
    .join(" ");
  const metadata = extractMetadata(rows, paramKeyIdx, footerText);
  const variant = detectVariant(rows[headerRowIndex] ?? [], fileName);
  const { label, profileId } = VARIANT_META[variant];

  return { variant, variantLabel: label, profileId, headerRowIndex, dataEndRow, metadata };
}
