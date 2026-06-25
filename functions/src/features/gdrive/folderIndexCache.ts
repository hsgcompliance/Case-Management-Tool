// functions/src/features/gdrive/folderIndexCache.ts
//
// Cached customer-folder index. The GAS-maintained index sheet is the system of
// record; reading it live (or scanning Drive) is too heavy for the app to do per
// view, so we snapshot it into Firestore:
//   orgs/{orgId}/folderIndex/{folderId}   — one small doc per folder
//   orgs/{orgId}/cache/folderIndexMeta    — { lastSyncedAt, count, sheetId }
// Mobile + web then read the cache directly from Firestore (instant, offline-ok).
//
// Writes go through the admin SDK (server-only); reads are allowed to same-org
// users by the existing /orgs/{orgId}/{document=**} rule.

import admin from "../../core/admin";
import { isoNow } from "../../core";
import * as logger from "firebase-functions/logger";
import { getSheetsClient } from "./service";
import { getOrgGDriveConfig } from "./orgConfig";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const INDEX_TAB = "index";

export type FolderIndexEntry = {
  id: string;
  name: string;
  first: string | null;
  last: string | null;
  cwid: string | null;
  status: "active" | "exited";
  url: string;
  createdTime: string | null;
  tssWorkbookId?: string | null;
  tssWorkbookUrl?: string | null;
  tssWorkbookName?: string | null;
};

/** "Last, First_CWID" → parts. Mirrors the GAS folder-naming convention. */
function parseFolderName(name: string) {
  const match = String(name || "").match(/^([^,]+),\s*([^_]+?)(?:_(.+))?$/);
  if (!match) return { last: null, first: null, cwid: null };
  return {
    last: (match[1] ?? "").trim() || null,
    first: (match[2] ?? "").trim() || null,
    cwid: (match[3] ?? "").trim() || null,
  };
}

function statusToken(value: unknown): "active" | "exited" {
  return String(value || "").trim().toLowerCase() === "active" ? "active" : "exited";
}

function quoteSheetTitle(title: string) {
  return `'${String(title || "").replace(/'/g, "''")}'`;
}

function firstExistingCol(header: string[], labels: string[]): number {
  const normalized = new Map(header.map((h, idx) => [h.toLowerCase(), idx]));
  for (const label of labels) {
    const idx = normalized.get(label.toLowerCase());
    if (idx != null) return idx;
  }
  return -1;
}

function spreadsheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

function spreadsheetIdFromUrl(value: string): string {
  const text = String(value || "").trim();
  return (
    text.match(/\/spreadsheets\/d\/([-\w]{20,})/i)?.[1] ||
    text.match(/[?&]id=([-\w]{20,})/i)?.[1] ||
    (/^[-\w]{20,}$/.test(text) ? text : "")
  );
}

/**
 * Read the org's index sheet server-side and return the parsed folder rows.
 * Tolerant of column reordering (maps by header label). Prefers the `index` tab,
 * falling back to the first tab. Uses the caller's OAuth when a uid is supplied,
 * else the shared refresh token (scheduled job, no user).
 */
export async function readIndexSheetFolders(
  sheetId: string,
  userUid?: string,
  googleAccessToken?: string,
): Promise<FolderIndexEntry[]> {
  const sheets = await getSheetsClient({ userUid, googleAccessToken, requiredScopes: [SHEETS_SCOPE] });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets(properties(title,index))",
  });
  const props = (meta.data.sheets || []).map((s: any) => s.properties || {});
  const target =
    props.find((p: any) => String(p.title || "").trim().toLowerCase() === INDEX_TAB) ||
    props.sort((a: any, b: any) => Number(a.index || 0) - Number(b.index || 0))[0];
  const title = String(target?.title || "").trim();
  if (!title) throw new Error("customer_index_sheet_missing_tab");

  const valuesResp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${quoteSheetTitle(title)}!A:Z`,
  });
  const rows: string[][] = Array.isArray(valuesResp.data.values) ? (valuesResp.data.values as string[][]) : [];
  if (!rows.length) return [];

  const header = (rows[0] || []).map((v) => String(v || "").trim());
  const col = (label: string) => header.findIndex((h) => h.toLowerCase() === label.toLowerCase());
  const idC = col("Folder ID");
  const nameC = col("Folder Name");
  const urlC = col("Folder URL");
  const firstC = col("First");
  const lastC = col("Last");
  const cwidC = col("CWID");
  const statusC = col("Status");
  const createdC = col("Created At");
  const tssWorkbookIdC = firstExistingCol(header, [
    "TSS Workbook ID",
    "TSS Workbook Id",
    "TSS Workbook",
    "Workbook ID",
    "Workbook Id",
    "TSS ID",
  ]);
  const tssWorkbookUrlC = firstExistingCol(header, [
    "TSS Workbook URL",
    "TSS Workbook Url",
    "Workbook URL",
    "Workbook Url",
  ]);
  const tssWorkbookNameC = firstExistingCol(header, [
    "TSS Workbook Name",
    "Workbook Name",
  ]);
  if (idC < 0) throw new Error("customer_index_sheet_missing_folder_id_column");

  const out: FolderIndexEntry[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const id = String(row[idC] || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = nameC >= 0 ? String(row[nameC] || "").trim() : "";
    const parsed = parseFolderName(name);
    const rawTssWorkbookUrl = tssWorkbookUrlC >= 0 ? String(row[tssWorkbookUrlC] || "").trim() : "";
    const tssWorkbookId =
      (tssWorkbookIdC >= 0 ? String(row[tssWorkbookIdC] || "").trim() : "") ||
      spreadsheetIdFromUrl(rawTssWorkbookUrl) ||
      null;
    const tssWorkbookUrl = rawTssWorkbookUrl || (tssWorkbookId ? spreadsheetUrl(tssWorkbookId) : null);
    const tssWorkbookName = (tssWorkbookNameC >= 0 ? String(row[tssWorkbookNameC] || "").trim() : "") || null;
    out.push({
      id,
      name,
      first: (firstC >= 0 ? String(row[firstC] || "").trim() : "") || parsed.first,
      last: (lastC >= 0 ? String(row[lastC] || "").trim() : "") || parsed.last,
      cwid: (cwidC >= 0 ? String(row[cwidC] || "").trim() : "") || parsed.cwid,
      status: statusToken(statusC >= 0 ? row[statusC] : "active"),
      url: (urlC >= 0 ? String(row[urlC] || "").trim() : "") || `https://drive.google.com/drive/folders/${id}`,
      createdTime: (createdC >= 0 ? String(row[createdC] || "").trim() : "") || null,
      ...(tssWorkbookId ? { tssWorkbookId, tssWorkbookUrl, tssWorkbookName } : {}),
    });
  }
  return out;
}

function folderIndexCol(orgId: string) {
  return admin.firestore().collection("orgs").doc(orgId).collection("folderIndex");
}
function folderIndexMetaRef(orgId: string) {
  return admin.firestore().collection("orgs").doc(orgId).collection("cache").doc("folderIndexMeta");
}

/** Commit docs in batches (Firestore caps a batch at 500 ops). */
async function commitInChunks(ops: Array<(b: FirebaseFirestore.WriteBatch) => void>) {
  const db = admin.firestore();
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 400)) op(batch);
    await batch.commit();
  }
}

/**
 * Full re-sync of one org's folder index cache from its index sheet. Upserts a
 * doc per folder, deletes cache docs no longer present, and stamps the meta doc.
 * Preserves any existing `linkedCustomerId` on a folder (it's app state, not from
 * the sheet).
 */
export async function syncOrgFolderIndex(
  orgId: string,
  userUid?: string,
): Promise<{ count: number; deleted: number; sheetId: string }> {
  const config = await getOrgGDriveConfig(orgId);
  const sheetId = String(config.customerFolderIndex.sheetId || "").trim();
  if (!sheetId) throw new Error("customer_index_sheet_not_configured");

  const folders = await readIndexSheetFolders(sheetId, userUid);

  // Existing cache: ids + their linkedCustomerId (preserve through resync).
  const existingSnap = await folderIndexCol(orgId).get();
  const existingIds = new Set<string>();
  const linkedById = new Map<string, string>();
  for (const doc of existingSnap.docs) {
    existingIds.add(doc.id);
    const linked = String(doc.data()?.linkedCustomerId || "").trim();
    if (linked) linkedById.set(doc.id, linked);
  }

  const now = isoNow();
  const nextIds = new Set(folders.map((f) => f.id));
  const ops: Array<(b: FirebaseFirestore.WriteBatch) => void> = [];

  for (const f of folders) {
    const linked = linkedById.get(f.id);
    ops.push((b) =>
      b.set(
        folderIndexCol(orgId).doc(f.id),
        { orgId, ...f, ...(linked ? { linkedCustomerId: linked } : {}), updatedAt: now },
        { merge: true },
      ),
    );
  }
  let deleted = 0;
  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      deleted++;
      ops.push((b) => b.delete(folderIndexCol(orgId).doc(id)));
    }
  }

  await commitInChunks(ops);
  await folderIndexMetaRef(orgId).set(
    { lastSyncedAt: now, count: folders.length, source: "sheet", sheetId },
    { merge: true },
  );

  logger.info("folder_index_synced", { orgId, count: folders.length, deleted });
  return { count: folders.length, deleted, sheetId };
}

/** Incrementally upsert one folder (e.g. right after building it). */
export async function upsertFolderIndexEntry(
  orgId: string,
  folder: { id: string; name: string; url?: string; status?: "active" | "exited" },
  linkedCustomerId?: string,
): Promise<void> {
  const parsed = parseFolderName(folder.name);
  await folderIndexCol(orgId).doc(folder.id).set(
    {
      orgId,
      id: folder.id,
      name: folder.name,
      url: folder.url || `https://drive.google.com/drive/folders/${folder.id}`,
      status: folder.status ?? "active",
      first: parsed.first,
      last: parsed.last,
      cwid: parsed.cwid,
      ...(linkedCustomerId ? { linkedCustomerId } : {}),
      updatedAt: isoNow(),
    },
    { merge: true },
  );
}

/** Best-effort: record which customer a cached folder is linked to. */
export async function stampFolderIndexLinked(orgId: string, folderId: string, customerId: string): Promise<void> {
  try {
    await folderIndexCol(orgId).doc(folderId).set(
      { linkedCustomerId: customerId, updatedAt: isoNow() },
      { merge: true },
    );
  } catch (err) {
    logger.warn("folder_index_link_stamp_failed", { orgId, folderId, err: String(err) });
  }
}
