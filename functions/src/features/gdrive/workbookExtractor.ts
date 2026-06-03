// functions/src/features/gdrive/workbookExtractor.ts
//
// Read-only TSS workbook content extractor (Slice A: coverSheet + progressNotes).
//
// Auth policy: workbook CONTENT is strict per-user server OAuth only. This module
// only ever obtains its Sheets client via getWorkbookSheetsClient() — never the
// fallback chain, service account, shared OAuth, or a browser token. If the user
// is not connected or lacks the spreadsheets scope, extraction fails closed and
// the UI falls back to the iframe / open-in-Sheets path.
//
// The spreadsheetId is resolved ONLY from the customer record — the caller never
// supplies a spreadsheet id or range. The config (sheets, entities, header
// aliases) is resolved server-side from the org's TSS config.

import * as logger from "firebase-functions/logger";
import admin from "../../core/admin";
import { isoNow } from "../../core";
import { tss } from "@hdb/contracts";
import type { tss as TssNS } from "@hdb/contracts";
import { getWorkbookSheetsClient, ScopeMissingError } from "./service";
import { getOrgGDriveConfig } from "./orgConfig";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// ── Errors ────────────────────────────────────────────────────────────────────

export class WorkbookNotLinkedError extends Error {
  constructor() { super("workbook_not_linked"); }
}
export class WorkbookNotConnectedError extends Error {
  constructor() { super("google_not_connected"); }
}

// ── Cell grid helpers ─────────────────────────────────────────────────────────

type Grid = string[][];

/** Quote a sheet title for an A1 range, escaping embedded single quotes. */
function quoteTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/** Column letter(s) → 0-based index. "A"→0, "Z"→25, "AA"→26. */
function colToIdx(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Parse an A1 cell ref like "B3" → { row: 0-based, col: 0-based }. */
function parseA1(ref: string): { row: number; col: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(String(ref || "").trim());
  if (!m) return null;
  return { col: colToIdx(m[1]), row: Number(m[2]) - 1 };
}

function gridCell(grid: Grid, row: number, col: number): string {
  if (row < 0 || col < 0) return "";
  const r = grid[row];
  if (!r) return "";
  return String(r[col] ?? "").trim();
}

// ── Cell construction ─────────────────────────────────────────────────────────

function cellKindForDataType(dt?: string): TssNS.TssExtractedCell["kind"] {
  switch (dt) {
    case "number":
    case "currency":   return "number";
    case "date":
    case "time":
    case "duration":   return "date";
    case "signature":
    case "string":
    case "longText":
    case "url":
    case "select":     return "string";
    default:           return "string";
  }
}

function makeCell(raw: string, dataType?: string): TssNS.TssExtractedCell {
  const value = raw === "" ? null : raw;
  if (value === null) return { value: null, kind: "empty" };
  return { value, displayValue: raw, kind: cellKindForDataType(dataType) };
}

// ── Header normalization ────────────────────────────────────────────────────

/** All accepted normalized header ids for a field (its expected + aliases). */
function fieldHeaderIds(field: { expected?: string; aliases?: readonly string[] }): Set<string> {
  const ids = new Set<string>();
  if (field.expected) ids.add(tss.smartHeaderId(field.expected));
  for (const a of field.aliases ?? []) ids.add(tss.smartHeaderId(a));
  return ids;
}

// ── Sheet resolution ────────────────────────────────────────────────────────

type SheetMeta = { title: string; sheetId: number };

// Normalized form that KEEPS digits — used for variant detection, where the
// leading number is the whole signal ("6. Progress Notes" payer vs
// "Progress Notes" nonPayer).  "6. Progress Notes" → "6 progress notes".
function normKeepNum(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Normalized form that STRIPS a leading section number — used to *find* a sheet
// regardless of whether it carries a "N. " prefix.  "6. Progress Notes" and
// "Progress Notes" both → "progress notes".
function normSheet(name: string): string {
  return normKeepNum(String(name || "").trim().replace(/^\s*\d+\s*[.)\-:]?\s+/, ""));
}

/**
 * Resolve the actual workbook sheet title for a config sheet id, tolerant of
 * section-number prefixes, whitespace, and punctuation. Tries normalized
 * equality first, then a normalized contains match (handles extra/edited words).
 */
function resolveSheetTitle(
  cfg: TssNS.TssWorksheetConfig,
  sheetId: string,
  sheets: SheetMeta[],
): string | null {
  const sheetCfg = cfg.sheets[sheetId];
  if (!sheetCfg) return null;
  const wanted = [...(sheetCfg.expectedNames ?? []), ...(sheetCfg.aliases ?? [])]
    .map(normSheet)
    .filter(Boolean);
  if (!wanted.length) return null;

  // 1. Exact normalized match.
  for (const s of sheets) {
    if (wanted.includes(normSheet(s.title))) return s.title;
  }
  // 2. Contains match either direction (tolerant of edited titles).
  for (const s of sheets) {
    const t = normSheet(s.title);
    if (t && wanted.some((w) => w === t || t.includes(w) || w.includes(t))) return s.title;
  }
  return null;
}

// ── Variant detection ─────────────────────────────────────────────────────────

function detectVariant(
  cfg: TssNS.TssWorksheetConfig,
  sheets: SheetMeta[],
): TssNS.TssWorkbookVariant {
  // Keep digits here: the variant signal IS the leading number.
  const titles = new Set(sheets.map((s) => normKeepNum(s.title)));
  for (const rule of cfg.variantRules) {
    if (titles.has(normKeepNum(String(rule.ifSheetExists)))) return rule.variant;
  }
  return "unknown";
}

// ── Range reading ─────────────────────────────────────────────────────────────

const MAX_SCAN_ROWS = 250;
const MAX_SCAN_COLS = "Z";

async function readSheetGrid(
  sheetsApi: any,
  spreadsheetId: string,
  title: string,
): Promise<Grid> {
  const range = `${quoteTitle(title)}!A1:${MAX_SCAN_COLS}${MAX_SCAN_ROWS}`;
  const resp = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const values = Array.isArray(resp.data?.values) ? (resp.data.values as string[][]) : [];
  return values.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : []));
}

// ── coverSheet extractor (keyValueCard) ───────────────────────────────────────

function extractCover(
  entity: TssNS.TssDisplayEntityConfig,
  grid: Grid,
): { values: Record<string, TssNS.TssExtractedCell>; warnings: TssNS.TssExtractionWarning[]; status: TssNS.TssExtractedEntityStatus } {
  const values: Record<string, TssNS.TssExtractedCell> = {};
  const warnings: TssNS.TssExtractionWarning[] = [];
  const keyValues = entity.source.keyValues ?? [];
  let found = 0;

  for (const kv of keyValues) {
    let raw = "";

    // 1. Direct value cell.
    if (kv.sheetValueCell) {
      const rc = parseA1(kv.sheetValueCell);
      if (rc) raw = gridCell(grid, rc.row, rc.col);
    }

    // 2. Label search fallback.
    if (!raw && kv.labelSearch) {
      const ls = kv.labelSearch;
      const wantIds = new Set(ls.labelAliases.map((a) => tss.smartHeaderId(a)));
      // scanRange like "A1:E12"
      const [start, end] = ls.scanRange.split(":");
      const s = parseA1(start);
      const e = parseA1(end);
      if (s && e) {
        outer: for (let r = s.row; r <= e.row; r++) {
          for (let c = s.col; c <= e.col; c++) {
            if (wantIds.has(tss.smartHeaderId(gridCell(grid, r, c)))) {
              const off = ls.valueOffset ?? { rows: 0, cols: 1 };
              raw = gridCell(grid, r + off.rows, c + off.cols);
              if (!raw && Array.isArray(ls.fallbackValueOffsets)) {
                for (const fo of ls.fallbackValueOffsets) {
                  raw = gridCell(grid, r + fo.rows, c + fo.cols);
                  if (raw) break;
                }
              }
              break outer;
            }
          }
        }
      }
    }

    values[kv.id] = makeCell(raw, kv.dataType);
    if (raw) found++;
    else if (kv.required) {
      warnings.push({
        code: "cover_value_missing",
        message: `Cover field "${kv.label}" not found in the sheet.`,
        entityId: entity.id,
        fieldId: kv.id,
        severity: "info",
      });
    }
  }

  return {
    values,
    warnings,
    status: found > 0 ? "extracted" : "empty",
  };
}

// ── progressNotes / generic dataTable extractor ───────────────────────────────

type RangeCfg = NonNullable<TssNS.TssDisplayEntityConfig["source"]["range"]>;

/** Pick the effective range config for the detected variant. */
function effectiveRange(
  entity: TssNS.TssDisplayEntityConfig,
  variant: TssNS.TssWorkbookVariant,
): RangeCfg | undefined {
  const override = entity.variantOverrides?.[variant]?.source?.range;
  return override ?? entity.source.range;
}

function isRowBlank(grid: Grid, rowIdx: number, colMap: Map<string, number>): boolean {
  for (const col of colMap.values()) {
    if (gridCell(grid, rowIdx, col)) return false;
  }
  return true;
}

type TableLayout = {
  headerRow: number;            // 0-based
  colMap: Map<string, number>;  // fieldId → 0-based column index
  warnings: TssNS.TssExtractionWarning[];
};

/**
 * Locate a data table's header row (drift-tolerant) and map fields → columns.
 * Shared by read extraction and append-row writing so both agree on layout.
 * Returns null when no header row can be located.
 */
function resolveTableLayout(
  grid: Grid,
  range: RangeCfg,
  fields: readonly TssNS.TssSmartHeaderConfig[],
  entityId: string,
): TableLayout | null {
  const warnings: TssNS.TssExtractionWarning[] = [];
  const mustContain = range.headerScan?.mustContainHeaderIds ?? [];
  const scoreIds = range.headerScan?.scoreHeaderIds ?? mustContain;
  const rowIdsAt = (rowIdx: number) => new Set((grid[rowIdx] ?? []).map((c) => tss.smartHeaderId(c)));
  const rowScore = (rowIdx: number) => {
    const ids = rowIdsAt(rowIdx);
    return scoreIds.reduce((acc, id) => acc + (ids.has(id) ? 1 : 0), 0);
  };

  // Candidate rows in priority order: fixed headerRow, configured candidates,
  // scan window, then a broad fallback over the first 30 rows.
  const candidateRows: number[] = [];
  if (typeof range.headerRow === "number") candidateRows.push(range.headerRow - 1);
  for (const n of range.headerRowCandidates ?? []) candidateRows.push(n - 1);
  if (range.headerScan) {
    for (let r = range.headerScan.minRow - 1; r <= range.headerScan.maxRow - 1; r++) candidateRows.push(r);
  }
  for (let r = 0; r < Math.min(30, MAX_SCAN_ROWS); r++) candidateRows.push(r);
  const seenRows = new Set<number>();
  const orderedRows = candidateRows.filter((r) => r >= 0 && !seenRows.has(r) && (seenRows.add(r), true));

  let headerRow = -1;
  let bestScore = -1;
  for (const r of orderedRows) {
    if (mustContain.length && !mustContain.every((id) => rowIdsAt(r).has(id))) continue;
    const sc = rowScore(r);
    if (sc > bestScore) { bestScore = sc; headerRow = r; }
  }
  if (headerRow < 0) {
    for (const r of orderedRows) {
      const sc = rowScore(r);
      if (sc >= 2 && sc > bestScore) { bestScore = sc; headerRow = r; }
    }
  }
  if (headerRow < 0) return null;

  const headerCells = grid[headerRow] ?? [];
  const colMap = new Map<string, number>();
  for (const field of fields) {
    const wantIds = fieldHeaderIds(field);
    let col = -1;
    for (let c = 0; c < headerCells.length; c++) {
      if (wantIds.has(tss.smartHeaderId(headerCells[c]))) { col = c; break; }
    }
    if (col >= 0) colMap.set(field.id, col);
    else warnings.push({
      code: "column_not_found",
      message: `Column for "${field.expected}" not found.`,
      entityId,
      sheetId: range.sheetId,
      fieldId: field.id,
      severity: "info",
    });
  }
  return { headerRow, colMap, warnings };
}

/** First data-start row (0-based), honoring fixed config only when the fixed header matched. */
function dataStartRow(range: RangeCfg, headerRow: number): number {
  const usedFixedHeader = typeof range.headerRow === "number" && headerRow === range.headerRow - 1;
  return (usedFixedHeader && typeof range.dataStartRow === "number")
    ? range.dataStartRow - 1
    : headerRow + (range.dataStartRowOffset ?? 1);
}

function extractDataTable(
  entity: TssNS.TssDisplayEntityConfig,
  grid: Grid,
  variant: TssNS.TssWorkbookVariant,
): { rows: TssNS.TssExtractedRow[]; warnings: TssNS.TssExtractionWarning[]; status: TssNS.TssExtractedEntityStatus } {
  const range = effectiveRange(entity, variant);
  const fields = entity.fields ?? [];
  if (!range || !fields.length) {
    return { rows: [], warnings: [], status: "missing_headers" };
  }

  const layout = resolveTableLayout(grid, range, fields, entity.id);
  if (!layout) {
    return {
      rows: [],
      warnings: [{
        code: "headers_not_found",
        message: `Could not locate the header row for "${entity.label}".`,
        entityId: entity.id,
        sheetId: range.sheetId,
        severity: "warning",
      }],
      status: "missing_headers",
    };
  }
  const { headerRow, colMap, warnings } = layout;
  if (!colMap.size) {
    return { rows: [], warnings, status: "missing_headers" };
  }

  const dataStart = dataStartRow(range, headerRow);

  // 4. Read rows until dataEnd.
  const rows: TssNS.TssExtractedRow[] = [];
  const dataEnd = range.dataEnd;
  const minBlank = dataEnd?.minConsecutiveBlankRows ?? 1;
  const nextAnchorId = dataEnd?.nextAnchorText ? tss.smartHeaderId(dataEnd.nextAnchorText) : null;
  let consecutiveBlank = 0;

  for (let r = dataStart; r < MAX_SCAN_ROWS; r++) {
    // Stop at next anchor (scan the whole row for the anchor text).
    if (nextAnchorId) {
      const rowHasAnchor = (grid[r] ?? []).some((c) => tss.smartHeaderId(c) === nextAnchorId);
      if (rowHasAnchor) break;
    }

    if (isRowBlank(grid, r, colMap)) {
      consecutiveBlank++;
      if (dataEnd?.mode === "firstBlankRow" && consecutiveBlank >= minBlank) break;
      if (dataEnd?.mode === "untilNextAnchor" && consecutiveBlank >= Math.max(minBlank, 2) && !nextAnchorId) break;
      continue; // skip blank rows (emptyRowPolicy: skip all-blank mapped rows)
    }
    consecutiveBlank = 0;

    const values: Record<string, TssNS.TssExtractedCell> = {};
    for (const field of fields) {
      const col = colMap.get(field.id);
      const raw = col != null ? gridCell(grid, r, col) : "";
      values[field.id] = makeCell(raw, field.dataType);
    }
    rows.push({ rowKey: `row-${r + 1}`, values }); // 1-based sheet row, stable, not an A1 range
  }

  return { rows, warnings, status: rows.length ? "extracted" : "empty" };
}

// ── Main extract ──────────────────────────────────────────────────────────────

const SUPPORTED_RENDER_KINDS = new Set(["keyValueCard", "dataTable"]);

export async function extractWorkbook(args: {
  customerId: string;
  uid: string;
  orgId: string;
}): Promise<TssNS.TssWorkbookExtract> {
  const { customerId, uid, orgId } = args;

  // 1. Resolve the linked workbook from the customer record ONLY.
  const snap = await admin.firestore().collection("customers").doc(customerId).get();
  const customer = snap.exists ? (snap.data() as Record<string, any>) : null;
  const tssMeta = customer?.customerDrive?.linkedWorkbooks?.tss as
    | { spreadsheetId?: string; spreadsheetName?: string }
    | undefined;
  const spreadsheetId = String(tssMeta?.spreadsheetId || "").trim();
  if (!spreadsheetId) throw new WorkbookNotLinkedError();

  // 2. Resolve config (baseline + org override) and honor forceVariant.
  const orgConfig = await getOrgGDriveConfig(orgId);
  const override = orgConfig.worksheetConfig ?? null;
  const cfg = tss.resolveTssWorksheetConfig(override);

  // 3. Strict per-user OAuth Sheets client (throws → caller falls back to iframe).
  const sheetsApi = await getWorkbookSheetsClient({ userUid: uid, requiredScopes: [SHEETS_SCOPE] });

  // 4. List sheets, detect variant.
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties(title,sheetId)",
  });
  const sheets: SheetMeta[] = (meta.data?.sheets ?? [])
    .map((s: any) => ({ title: String(s?.properties?.title ?? ""), sheetId: Number(s?.properties?.sheetId ?? 0) }))
    .filter((s: SheetMeta) => s.title);
  const spreadsheetName = String(meta.data?.properties?.title ?? tssMeta?.spreadsheetName ?? "");
  const variant = tss.resolveWorkbookVariant(override, detectVariant(cfg, sheets));

  // 5. Cache sheet grids we read (avoid re-reading the same tab).
  const gridCache = new Map<string, Grid>();
  const getGrid = async (sheetId: string): Promise<{ grid: Grid | null; title: string | null }> => {
    const title = resolveSheetTitle(cfg, sheetId, sheets);
    if (!title) return { grid: null, title: null };
    if (!gridCache.has(title)) gridCache.set(title, await readSheetGrid(sheetsApi, spreadsheetId, title));
    return { grid: gridCache.get(title)!, title };
  };

  // 6. Extract each enabled entity (Slice A: coverSheet + progressNotes).
  const entities: TssNS.TssExtractedEntity[] = [];
  const topWarnings: TssNS.TssExtractionWarning[] = [];

  for (const [entityKey, entity] of Object.entries(cfg.entities)) {
    const base = {
      entityId: entity.id,
      renderKind: entity.renderKind,
      label: entity.label,
      section: entity.section,
    };

    // Unsupported render kinds in this slice — surfaced, not broken.
    if (!SUPPORTED_RENDER_KINDS.has(entity.renderKind)) {
      entities.push({ ...base, status: "unsupported" });
      continue;
    }

    const sheetId = entity.source.range?.sheetId ?? entity.source.sheetId;
    if (!sheetId) {
      // No sheet-backed source (e.g. static acronym card) — not for this slice.
      entities.push({ ...base, status: "unsupported" });
      continue;
    }

    try {
      const { grid, title } = await getGrid(sheetId);
      if (!grid || !title) {
        entities.push({
          ...base,
          status: "missing_sheet",
          warnings: [{ code: "sheet_not_found", message: `Sheet "${sheetId}" not found in workbook.`, entityId: entity.id, sheetId, severity: "warning" }],
        });
        continue;
      }

      if (entity.renderKind === "keyValueCard") {
        const { values, warnings, status } = extractCover(entity, grid);
        entities.push({ ...base, status, values, ...(warnings.length ? { warnings } : {}) });
      } else {
        // dataTable
        const { rows, warnings, status } = extractDataTable(entity, grid, variant);
        entities.push({ ...base, status, rows, ...(warnings.length ? { warnings } : {}) });
      }
    } catch (err: any) {
      logger.warn("workbook_entity_extract_failed", { entityKey, entityId: entity.id, error: String(err?.message || err) });
      entities.push({
        ...base,
        status: "error",
        warnings: [{ code: "entity_extract_error", message: "Could not extract this section.", entityId: entity.id, severity: "error" }],
      });
    }
  }

  return {
    customerId,
    spreadsheetId,
    spreadsheetName: spreadsheetName || undefined,
    variant,
    entities,
    warnings: topWarnings,
    extractedAt: isoNow(),
    configVersion: cfg.version,
    // spreadsheetModifiedTime deferred — needs Drive metadata, not just Sheets scope.
  };
}

// ── Append row (write-back) ─────────────────────────────────────────────────

/** 0-based column index → A1 column letters. 0→"A", 25→"Z", 26→"AA". */
function idxToCol(idx: number): string {
  let n = idx + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export class WorkbookEntityNotWritableError extends Error {
  constructor(msg = "entity_not_writable") { super(msg); }
}

/**
 * Append a row to a dataTable entity (Slice A: progress notes). Strict per-user
 * server OAuth so the write is attributed to the signed-in user. Append-only:
 * we locate the first empty data row of the resolved table and write the mapped
 * fields there — never editing existing rows.
 */
export async function appendWorkbookRow(args: {
  customerId: string;
  uid: string;
  orgId: string;
  entityId: string;
  values: Record<string, string>;
}): Promise<{ rowKey: string; spreadsheetId: string }> {
  const { customerId, uid, orgId, entityId, values } = args;

  // 1. Resolve workbook + config (same path as extraction).
  const snap = await admin.firestore().collection("customers").doc(customerId).get();
  const customer = snap.exists ? (snap.data() as Record<string, any>) : null;
  const spreadsheetId = String(customer?.customerDrive?.linkedWorkbooks?.tss?.spreadsheetId || "").trim();
  if (!spreadsheetId) throw new WorkbookNotLinkedError();

  const orgConfig = await getOrgGDriveConfig(orgId);
  const override = orgConfig.worksheetConfig ?? null;
  const cfg = tss.resolveTssWorksheetConfig(override);

  const entity = Object.values(cfg.entities).find((e) => e.id === entityId);
  if (!entity) throw new WorkbookEntityNotWritableError("entity_not_found");
  if (entity.renderKind !== "dataTable" || entity.direction === "worksheetToApp") {
    throw new WorkbookEntityNotWritableError();
  }

  // 2. Strict per-user OAuth Sheets client (write attributed to the user).
  const sheetsApi = await getWorkbookSheetsClient({ userUid: uid, requiredScopes: [SHEETS_SCOPE] });

  // 3. Resolve sheet + variant + grid.
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,sheetId)",
  });
  const sheets: SheetMeta[] = (meta.data?.sheets ?? [])
    .map((s: any) => ({ title: String(s?.properties?.title ?? ""), sheetId: Number(s?.properties?.sheetId ?? 0) }))
    .filter((s: SheetMeta) => s.title);
  const variant = tss.resolveWorkbookVariant(override, detectVariant(cfg, sheets));

  const range = effectiveRange(entity, variant);
  const fields = entity.fields ?? [];
  if (!range || !fields.length) throw new WorkbookEntityNotWritableError("entity_has_no_table");

  const sheetTitle = resolveSheetTitle(cfg, range.sheetId, sheets);
  if (!sheetTitle) throw new WorkbookEntityNotWritableError("sheet_not_found");
  const grid = await readSheetGrid(sheetsApi, spreadsheetId, sheetTitle);

  // 4. Resolve layout + find the first empty data row to append into.
  const layout = resolveTableLayout(grid, range, fields, entity.id);
  if (!layout || !layout.colMap.size) throw new WorkbookEntityNotWritableError("table_layout_unresolved");
  const { colMap } = layout;
  const start = dataStartRow(range, layout.headerRow);

  let insertRow = -1;
  for (let r = start; r < MAX_SCAN_ROWS; r++) {
    if (isRowBlank(grid, r, colMap)) { insertRow = r; break; }
  }
  if (insertRow < 0) throw new WorkbookEntityNotWritableError("table_full");

  // 5. Build the row array spanning the mapped columns and write it.
  const cols = [...colMap.values()];
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const rowArr: string[] = new Array(maxCol - minCol + 1).fill("");
  for (const field of fields) {
    const col = colMap.get(field.id);
    if (col == null) continue;
    const v = values[field.id];
    if (v != null && String(v).length) rowArr[col - minCol] = String(v);
  }

  const a1 = `${quoteTitle(sheetTitle)}!${idxToCol(minCol)}${insertRow + 1}:${idxToCol(maxCol)}${insertRow + 1}`;
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: a1,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowArr] },
  });

  return { rowKey: `row-${insertRow + 1}`, spreadsheetId };
}

export { ScopeMissingError };
