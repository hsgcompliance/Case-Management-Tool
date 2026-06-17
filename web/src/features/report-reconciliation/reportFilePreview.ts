"use client";

import {
  detectLikelyReportProfiles,
  normalizeHeader,
  type ReportSourceProfile,
} from "./reportProfiles";

export type ParsedReportPreview = {
  fileName: string;
  fileType: "csv" | "txt" | "xlsx";
  sheetName?: string;
  headerRowIndex: number;
  headers: string[];
  sampleRows: unknown[][];
  totalRows: number;
  profileCandidates: ReturnType<typeof detectLikelyReportProfiles>;
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const MAX_SAMPLE_ROWS = 25;
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
  sheetName?: string,
): ParsedReportPreview {
  const headerRowIndex = findHeaderRow(rows, profiles, fileName);
  const headers = (rows[headerRowIndex] ?? []).map((value) => String(value ?? "").trim());
  const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((value) => String(value ?? "").trim()));
  return {
    fileName,
    fileType,
    sheetName,
    headerRowIndex,
    headers,
    sampleRows: dataRows.slice(0, MAX_SAMPLE_ROWS),
    totalRows: dataRows.length,
    profileCandidates: detectLikelyReportProfiles(profiles, headers, fileName),
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
  return new DOMParser().parseFromString(xml, "application/xml");
}

function textContent(parent: Element, tag: string) {
  return parent.getElementsByTagName(tag)[0]?.textContent ?? "";
}

function readSharedStrings(xml: string | null) {
  if (!xml) return [];
  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagName("si")).map((node) =>
    Array.from(node.getElementsByTagName("t")).map((item) => item.textContent ?? "").join(""),
  );
}

function columnIndex(cellRef: string) {
  const letters = cellRef.replace(/[^A-Za-z]/g, "");
  return letters.split("").reduce((acc, letter) => acc * 26 + letter.toUpperCase().charCodeAt(0) - 64, 0) - 1;
}

function readSheetRows(xml: string, sharedStrings: string[]): unknown[][] {
  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagName("row")).map((rowNode) => {
    const row: unknown[] = [];
    Array.from(rowNode.getElementsByTagName("c")).forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const index = Math.max(0, columnIndex(ref));
      const type = cell.getAttribute("t");
      let value = textContent(cell, "v");
      if (type === "s") value = sharedStrings[Number(value)] ?? value;
      if (type === "inlineStr") value = textContent(cell, "t");
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
    Array.from(rels.getElementsByTagName("Relationship")).map((rel) => [rel.getAttribute("Id") || "", rel.getAttribute("Target") || ""]),
  );
  const sheets = Array.from(workbook.getElementsByTagName("sheet")).map((sheet) => ({
    name: sheet.getAttribute("name") || "Sheet",
    relId: sheet.getAttribute("r:id") || sheet.getAttribute("id") || "",
  }));
  const selected = sheets.find((sheet) => sheet.name === preferredSheet) ?? sheets[0];
  if (!selected) throw new Error("No worksheets found in XLSX.");
  const sheetPath = normalizeXlsxPath(relMap.get(selected.relId) || "");
  const sheetXml = await readText(sheetPath);
  if (!sheetXml) throw new Error(`Unable to read worksheet ${selected.name}.`);
  return { sheetName: selected.name, rows: readSheetRows(sheetXml, readSharedStrings(sharedXml)) };
}

export async function parseReportFilePreview(file: File, profiles: ReportSourceProfile[], preferredSheet?: string): Promise<ParsedReportPreview> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx") || XLSX_MIME_RE.test(file.type)) {
    const result = await readXlsxRows(file, preferredSheet);
    return buildPreview(file.name, "xlsx", result.rows, profiles, result.sheetName);
  }
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt") || file.type.startsWith("text/")) {
    const rows = parseDelimitedText(await file.text());
    return buildPreview(file.name, lowerName.endsWith(".txt") ? "txt" : "csv", rows, profiles);
  }
  throw new Error("Only CSV, TXT, and XLSX files can be previewed.");
}
