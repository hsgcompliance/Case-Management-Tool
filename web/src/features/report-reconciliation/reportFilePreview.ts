"use client";

import {
  detectLikelyReportProfiles,
  normalizeHeader,
  type ReportSourceProfile,
} from "./reportProfiles";
import { interpretCaseworthyReport } from "./caseworthyInterpreter";

export type ParsedReportPreview = {
  fileName: string;
  fileType: "csv" | "txt" | "xlsx";
  sheetName?: string;
  recommendedEnabled: boolean;
  sheetRole: "data" | "helper";
  sheetReason: string;
  headerRowIndex: number;
  headers: string[];
  sampleRows: unknown[][];
  /** Full row grid (including any leading title/prompt rows) so the header row can be re-chosen. */
  allRows: unknown[][];
  totalRows: number;
  profileCandidates: ReturnType<typeof detectLikelyReportProfiles>;
  /** Human label for an auto-detected report variant (e.g. Caseworthy account-detail vs org-total). */
  reportVariant?: string;
  /** Parameter-block metadata captured from envelope reports (account/grant, date range, org…). */
  reportMetadata?: Record<string, string>;
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

/** Default cap when generating a lightweight preview (admin mapping tool). */
export const DEFAULT_PREVIEW_ROWS = 25;
/** Cap when extracting a full report for reconciliation (whole-file processing). */
export const MAX_RECONCILIATION_ROWS = 20000;
const MAX_HEADER_SCAN_ROWS = 30;
const XLSX_MIME_RE = /spreadsheetml|excel|xlsx/i;

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function decode(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(bytes);
}

export function parseDelimitedText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const delimiter = text.slice(0, 4096).split("\t").length > text.slice(0, 4096).split(",").length ? "\t" : ",";

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function rowsToCsv(rows: unknown[][]): string {
  return rows.map((row) =>
    row.map((value) => {
      const raw = String(value ?? "");
      return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, "\"\"")}"` : raw;
    }).join(","),
  ).join("\r\n");
}

function findHeaderRow(rows: unknown[][], profiles: ReportSourceProfile[], sourceName: string) {
  let best = { index: 0, score: Number.NEGATIVE_INFINITY };
  rows.slice(0, MAX_HEADER_SCAN_ROWS).forEach((row, index) => {
    const candidates = detectLikelyReportProfiles(profiles, row, sourceName, 1);
    const textScore = row.filter((value) => normalizeHeader(value).length > 0).length;
    const score = (candidates[0]?.score ?? 0) + textScore;
    if (score > best.score) best = { index, score };
  });
  return best.index;
}

function buildPreview(
  fileName: string,
  fileType: ParsedReportPreview["fileType"],
  rows: unknown[][],
  profiles: ReportSourceProfile[],
  maxRows: number,
  sheetName?: string,
): ParsedReportPreview {
  const sourceName = `${fileName} ${sheetName || ""}`;
  // Envelope reports (Caseworthy Clients Served) wrap the data table in parameter
  // blocks top + bottom; the interpreter pins the real header row, trims the
  // trailing footer block, detects the variant, and surfaces the parameter metadata.
  const caseworthy = interpretCaseworthyReport(rows, sourceName);
  const effectiveRows = caseworthy ? rows.slice(0, caseworthy.dataEndRow) : rows;
  const headerRowIndex = caseworthy ? caseworthy.headerRowIndex : findHeaderRow(effectiveRows, profiles, sourceName);
  const headers = (effectiveRows[headerRowIndex] ?? []).map((value) => String(value ?? "").trim());
  const dataRows = effectiveRows.slice(headerRowIndex + 1).filter((row) => row.some((value) => String(value ?? "").trim()));
  const profileCandidates = detectLikelyReportProfiles(profiles, headers, sourceName);
  if (caseworthy) {
    // Guarantee the detected variant profile is the default even if scoring is close.
    const idx = profileCandidates.findIndex((candidate) => candidate.profile.id === caseworthy.profileId);
    if (idx > 0) profileCandidates.unshift(profileCandidates.splice(idx, 1)[0]);
  }
  const sheetText = normalizeHeader(`${sheetName || ""} ${rows.slice(0, 3).flat().join(" ")}`);
  const helperSheet = /\b(guide|budget|summary|data entry guide|instructions?)\b/.test(sheetText);
  const bestScore = profileCandidates[0]?.score ?? 0;
  const recommendedEnabled = Boolean(caseworthy) || (!helperSheet && bestScore >= 30 && dataRows.length > 0);
  // Keep the full grid (capped) including leading title rows so the operator can re-pick the header row.
  const allRows = effectiveRows.slice(0, headerRowIndex + 1 + maxRows);
  const reportMetadata = caseworthy
    ? {
        variant: caseworthy.variantLabel,
        account: caseworthy.metadata.account,
        grants: caseworthy.metadata.grantTokens.join(", "),
        org: caseworthy.metadata.org,
        program: caseworthy.metadata.program,
        service: caseworthy.metadata.service,
        dateRange: [caseworthy.metadata.dateRangeFrom, caseworthy.metadata.dateRangeTo].filter(Boolean).join(" → "),
        runBy: caseworthy.metadata.runBy,
        runAt: caseworthy.metadata.runAt,
      }
    : undefined;
  return {
    fileName,
    fileType,
    sheetName,
    recommendedEnabled,
    sheetRole: recommendedEnabled ? "data" : "helper",
    sheetReason: caseworthy
      ? `Caseworthy ${caseworthy.variantLabel}${caseworthy.metadata.account ? ` · ${caseworthy.metadata.account}` : ""} — ${dataRows.length} rows.`
      : recommendedEnabled
        ? `Detected ${profileCandidates[0]?.profile.label || "report data"} with ${dataRows.length} data rows.`
        : helperSheet
          ? "Looks like a workbook guide, budget, summary, or helper sheet."
          : "No strong report profile match was detected.",
    headerRowIndex,
    headers,
    sampleRows: dataRows.slice(0, maxRows),
    allRows,
    totalRows: dataRows.length,
    profileCandidates,
    reportVariant: caseworthy?.variantLabel,
    reportMetadata,
  };
}

function listZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 66000); offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Unable to read XLSX central directory.");
  const entryCount = readUint16(view, eocd + 10);
  let offset = readUint32(view, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (readUint32(view, offset) !== 0x02014b50) throw new Error("Invalid XLSX central directory entry.");
    const compressionMethod = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localHeaderOffset = readUint32(view, offset + 42);
    const name = decode(new Uint8Array(buffer, offset + 46, fileNameLength));
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const Decompression = (globalThis as unknown as { DecompressionStream?: new (format: string) => TransformStream }).DecompressionStream;
  if (!Decompression) throw new Error("This browser cannot preview compressed XLSX files.");
  const stream = new Blob([bytes]).stream().pipeThrough(new Decompression("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buffer);
  const offset = entry.localHeaderOffset;
  if (readUint32(view, offset) !== 0x04034b50) throw new Error(`Invalid XLSX local header for ${entry.name}.`);
  const fileNameLength = readUint16(view, offset + 26);
  const extraLength = readUint16(view, offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  const compressed = new Uint8Array(buffer, dataOffset, entry.compressedSize);
  if (entry.compressionMethod === 0) return decode(compressed);
  if (entry.compressionMethod === 8) return decode(await inflateRaw(compressed));
  throw new Error(`Unsupported XLSX compression method ${entry.compressionMethod}.`);
}

function parseXml(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  // DOMParser surfaces malformed XML as a <parsererror> root rather than throwing.
  if (doc.getElementsByTagName("parsererror").length) {
    const detail = doc.getElementsByTagName("parsererror")[0]?.textContent?.trim().slice(0, 200) || "unknown XML error";
    throw new Error(`Could not parse XLSX XML (${detail}).`);
  }
  return doc;
}

/**
 * Find elements by local name regardless of namespace prefix. Real-world Excel /
 * Financial Edge exports sometimes prefix the spreadsheetml elements (e.g.
 * `<x:sheet>`), which `getElementsByTagName("sheet")` (qualified-name match) misses.
 * `getElementsByTagNameNS("*", local)` matches the local name in any namespace.
 */
function findByLocalName(root: Document | Element, localName: string): Element[] {
  const ns = root.getElementsByTagNameNS("*", localName);
  if (ns.length) return Array.from(ns);
  return Array.from(root.getElementsByTagName(localName));
}

/** Read an attribute by local name, tolerant of namespace prefixes (e.g. `r:id`). */
function attrByLocalName(el: Element, localName: string): string {
  const direct = el.getAttribute(localName);
  if (direct != null) return direct;
  for (const attr of Array.from(el.attributes)) {
    if (attr.localName === localName || attr.name === localName || attr.name.endsWith(`:${localName}`)) {
      return attr.value;
    }
  }
  return "";
}

function textOfLocal(parent: Element, localName: string) {
  return findByLocalName(parent, localName)[0]?.textContent ?? "";
}

function readSharedStrings(xml: string | null) {
  if (!xml) return [];
  const doc = parseXml(xml);
  return findByLocalName(doc, "si").map((node) =>
    findByLocalName(node, "t").map((item) => item.textContent ?? "").join(""),
  );
}

function columnIndex(cellRef: string) {
  const letters = cellRef.replace(/[^A-Za-z]/g, "");
  return letters.split("").reduce((acc, letter) => acc * 26 + letter.toUpperCase().charCodeAt(0) - 64, 0) - 1;
}

function readSheetRows(xml: string, sharedStrings: string[]): unknown[][] {
  const doc = parseXml(xml);
  return findByLocalName(doc, "row").map((rowNode) => {
    const row: unknown[] = [];
    findByLocalName(rowNode, "c").forEach((cell, cellOrder) => {
      const ref = attrByLocalName(cell, "r");
      // Fall back to positional order when a cell omits its reference attribute.
      const index = ref ? Math.max(0, columnIndex(ref)) : cellOrder;
      const type = attrByLocalName(cell, "t");
      let value = textOfLocal(cell, "v");
      if (type === "s") value = sharedStrings[Number(value)] ?? value;
      if (type === "inlineStr" || type === "str") value = textOfLocal(cell, "t") || value;
      while (row.length < index) row.push("");
      row[index] = value;
    });
    return row;
  });
}

function normalizeXlsxPath(path: string) {
  const clean = path.replace(/^\/+/, "");
  return clean.startsWith("xl/") ? clean : `xl/${clean}`;
}

async function readXlsxRows(file: File, preferredSheet?: string) {
  const buffer = await file.arrayBuffer();
  const entries = listZipEntries(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const readText = async (name: string) => {
    const entry = byName.get(name);
    return entry ? readZipEntry(buffer, entry) : null;
  };
  const [workbookXml, relsXml, sharedXml] = await Promise.all([
    readText("xl/workbook.xml"),
    readText("xl/_rels/workbook.xml.rels"),
    readText("xl/sharedStrings.xml"),
  ]);
  if (!workbookXml || !relsXml) throw new Error("Unable to find workbook metadata in XLSX.");
  const workbook = parseXml(workbookXml);
  const rels = parseXml(relsXml);
  const relMap = new Map(
    findByLocalName(rels, "Relationship").map((rel) => [attrByLocalName(rel, "Id"), attrByLocalName(rel, "Target")]),
  );
  const sheets = findByLocalName(workbook, "sheet").map((sheet) => ({
    name: attrByLocalName(sheet, "name") || "Sheet",
    relId: attrByLocalName(sheet, "id"),
  }));
  if (!sheets.length) {
    // Last resort: any worksheet part in the package, so a structurally-odd workbook
    // (no <sheets> block, unexpected prefixes) still previews instead of dead-ending.
    const worksheetEntry = entries.find((entry) => /^xl\/worksheets\/.+\.xml$/i.test(entry.name));
    if (worksheetEntry) {
      const fallbackXml = await readText(worksheetEntry.name);
      if (fallbackXml) {
        return { sheetName: "Sheet1", rows: readSheetRows(fallbackXml, readSharedStrings(sharedXml)) };
      }
    }
    const sheetParts = entries.filter((entry) => /worksheets/i.test(entry.name)).map((entry) => entry.name);
    throw new Error(`No worksheets found in XLSX (parts: ${sheetParts.join(", ") || "none"}).`);
  }
  const selected = sheets.find((sheet) => sheet.name === preferredSheet) ?? sheets[0];
  const sheetPath = normalizeXlsxPath(relMap.get(selected.relId) || "");
  const sheetXml = await readText(sheetPath);
  if (!sheetXml) throw new Error(`Unable to read worksheet ${selected.name} (path: ${sheetPath}).`);
  return { sheetName: selected.name, rows: readSheetRows(sheetXml, readSharedStrings(sharedXml)) };
}

async function readXlsxSheets(file: File) {
  const buffer = await file.arrayBuffer();
  const entries = listZipEntries(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const readText = async (name: string) => {
    const entry = byName.get(name);
    return entry ? readZipEntry(buffer, entry) : null;
  };
  const [workbookXml, relsXml, sharedXml] = await Promise.all([
    readText("xl/workbook.xml"),
    readText("xl/_rels/workbook.xml.rels"),
    readText("xl/sharedStrings.xml"),
  ]);
  if (!workbookXml || !relsXml) throw new Error("Unable to find workbook metadata in XLSX.");
  const workbook = parseXml(workbookXml);
  const rels = parseXml(relsXml);
  const relMap = new Map(
    findByLocalName(rels, "Relationship").map((rel) => [attrByLocalName(rel, "Id"), attrByLocalName(rel, "Target")]),
  );
  const sharedStrings = readSharedStrings(sharedXml);
  const sheets = findByLocalName(workbook, "sheet").map((sheet, index) => ({
    name: attrByLocalName(sheet, "name") || `Sheet${index + 1}`,
    relId: attrByLocalName(sheet, "id"),
  }));
  if (!sheets.length) {
    const worksheetEntries = entries.filter((entry) => /^xl\/worksheets\/.+\.xml$/i.test(entry.name));
    if (!worksheetEntries.length) throw new Error("No worksheets found in XLSX.");
    const fallback = await Promise.all(worksheetEntries.map(async (entry, index) => ({
      sheetName: `Sheet${index + 1}`,
      rows: readSheetRows(await readZipEntry(buffer, entry), sharedStrings),
    })));
    return fallback;
  }
  const out: Array<{ sheetName: string; rows: unknown[][] }> = [];
  for (const sheet of sheets) {
    const sheetPath = normalizeXlsxPath(relMap.get(sheet.relId) || "");
    const sheetXml = await readText(sheetPath);
    if (sheetXml) out.push({ sheetName: sheet.name, rows: readSheetRows(sheetXml, sharedStrings) });
  }
  if (!out.length) throw new Error("No readable worksheets found in XLSX.");
  return out;
}

export type ParseReportFileOptions = {
  preferredSheet?: string;
  /** Max data rows to retain. Defaults to a small preview cap; reconciliation passes a large cap. */
  maxRows?: number;
};

export async function parseReportFilePreview(
  file: File,
  profiles: ReportSourceProfile[],
  opts: ParseReportFileOptions = {},
): Promise<ParsedReportPreview> {
  const maxRows = opts.maxRows ?? DEFAULT_PREVIEW_ROWS;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx") || XLSX_MIME_RE.test(file.type)) {
    const result = await readXlsxRows(file, opts.preferredSheet);
    return buildPreview(file.name, "xlsx", result.rows, profiles, maxRows, result.sheetName);
  }
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt") || file.type.startsWith("text/")) {
    const rows = parseDelimitedText(await file.text());
    return buildPreview(file.name, lowerName.endsWith(".txt") ? "txt" : "csv", rows, profiles, maxRows);
  }
  if (lowerName.endsWith(".xls")) {
    throw new Error("Legacy .xls (binary) files aren't supported — re-save as .xlsx or export to CSV.");
  }
  throw new Error("Only CSV, TXT, and XLSX files can be previewed.");
}

export async function parseReportFilePreviews(
  file: File,
  profiles: ReportSourceProfile[],
  opts: ParseReportFileOptions = {},
): Promise<ParsedReportPreview[]> {
  const maxRows = opts.maxRows ?? DEFAULT_PREVIEW_ROWS;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx") || XLSX_MIME_RE.test(file.type)) {
    const sheets = await readXlsxSheets(file);
    const singleSheet = sheets.length === 1;
    return sheets.map((sheet) => buildPreview(file.name, "xlsx", sheet.rows, profiles, maxRows, singleSheet ? undefined : sheet.sheetName));
  }
  return [await parseReportFilePreview(file, profiles, opts)];
}
