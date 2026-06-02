// functions/src/features/gdrive/workbookService.ts
//
// Server-side workbook link/discovery service.
// Uses the per-user server-side OAuth pattern (same as Calendar) when the user has
// connected Google Drive via Settings. Falls back gracefully if not connected.

import * as logger from "firebase-functions/logger";
import admin from "../../core/admin";
import { isoNow } from "../../core";
import { getDriveClient } from "./service";
import { markTokenRevoked } from "../google/oauthClient";

const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";
// xlsx/xls files are Drive-hosted Office files — still embeddable in Sheets
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function isWorkbookMime(mime: string): boolean {
  return mime === SPREADSHEET_MIME || mime === XLSX_MIME || mime === XLS_MIME;
}

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function buildUserDriveClient(uid: string, googleAccessToken?: string) {
  try {
    return await getDriveClient({ userUid: uid, googleAccessToken });
  } catch {
    return null;
  }
}


async function getCustomerDoc(customerId: string): Promise<Record<string, unknown> | null> {
  const snap = await admin.firestore().collection("customers").doc(customerId).get();
  if (!snap.exists) return null;
  return snap.data() as Record<string, unknown>;
}

export type WorkbookMeta = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetName?: string;
  status: "linked";
  linkedAt: string;
  updatedAt: string;
  linkedBy: string;
  linkedEnrollmentId?: string;
};

export type FolderItem = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string | null;
  iconLink: string | null;
  isFolder: boolean;
  isSpreadsheet: boolean;
};

export type CandidateListResult =
  | { status: "ok"; folderId: string; items: FolderItem[] }
  | { status: "folder_missing"; items: [] }
  | { status: "google_drive_not_connected"; folderId: string; items: [] };

export async function attachWorkbookByUrl(args: {
  customerId: string;
  uid: string;
  workbookUrl: string;
  enrollmentId?: string;
  googleAccessToken?: string;
}): Promise<{ workbook: WorkbookMeta }> {
  const { customerId, uid, workbookUrl, enrollmentId, googleAccessToken } = args;

  const spreadsheetId = extractSpreadsheetId(workbookUrl);
  if (!spreadsheetId) {
    throw Object.assign(new Error("workbook_invalid_url"), { code: 400 });
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  let spreadsheetName: string | undefined;

  // Try to validate and fetch metadata via per-user server-side Drive OAuth
  try {
    const drive = await buildUserDriveClient(uid, googleAccessToken);
    if (drive) {
      const meta = await drive.files.get({
        fileId: spreadsheetId,
        fields: "id,name,mimeType",
        supportsAllDrives: true,
      });
      const mime = String(meta.data?.mimeType || "").trim();
      // Allow native Sheets, xlsx, and xls — reject anything else (e.g. Docs, PDFs)
      if (mime && !isWorkbookMime(mime)) {
        throw Object.assign(new Error("workbook_not_a_spreadsheet"), { code: 400 });
      }
      spreadsheetName = String(meta.data?.name || "").trim() || undefined;
    }
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg === "workbook_not_a_spreadsheet") throw err;
    const status = Number(err?.response?.status);
    if (status === 404) throw Object.assign(new Error("workbook_not_found"), { code: 404 });
    if (status === 403) throw Object.assign(new Error("workbook_access_denied"), { code: 403 });
    if (status === 401) {
      // Token revoked or expired beyond refresh — mark needs_reconnect, save anyway
      void markTokenRevoked(uid, "googleDrive");
      logger.warn("workbookService: Drive 401 — token revoked, saving without validation", { spreadsheetId });
    } else {
      // Non-fatal: Drive not connected or other transient error — save without validation
      logger.warn("workbookService: url validation skipped", { spreadsheetId, reason: msg });
    }
  }

  const now = isoNow();
  const workbook: WorkbookMeta = {
    spreadsheetId,
    spreadsheetUrl,
    ...(spreadsheetName ? { spreadsheetName } : {}),
    status: "linked",
    linkedAt: now,
    updatedAt: now,
    linkedBy: uid,
    ...(enrollmentId ? { linkedEnrollmentId: enrollmentId } : {}),
  };

  await admin
    .firestore()
    .collection("customers")
    .doc(customerId)
    .set({ customerDrive: { linkedWorkbooks: { tss: workbook } } }, { merge: true });

  return { workbook };
}

export async function listFolderCandidates(args: {
  customerId: string;
  uid: string;
  googleAccessToken?: string;
}): Promise<CandidateListResult> {
  const { customerId, uid, googleAccessToken } = args;

  const customerDoc = await getCustomerDoc(customerId);
  if (!customerDoc) throw Object.assign(new Error("customer_not_found"), { code: 404 });

  // Resolve folderId from customerDrive first, then legacy meta fields
  const cDrive = customerDoc.customerDrive as Record<string, unknown> | null | undefined;
  const meta = customerDoc.meta as Record<string, unknown> | null | undefined;
  const metaFolders = Array.isArray(meta?.driveFolders)
    ? (meta?.driveFolders as Array<Record<string, unknown>>)
    : [];

  const folderId =
    String(cDrive?.folderId || "").trim() ||
    String(meta?.driveFolderId || "").trim() ||
    String(metaFolders[0]?.id || "").trim();

  if (!folderId) {
    return { status: "folder_missing", items: [] };
  }

  const drive = await buildUserDriveClient(uid, googleAccessToken);
  if (!drive) {
    return { status: "google_drive_not_connected", folderId, items: [] };
  }

  const q = [
    `'${folderId}' in parents`,
    `trashed = false`,
    `(mimeType = '${SPREADSHEET_MIME}' or mimeType = '${XLSX_MIME}' or mimeType = '${XLS_MIME}' or mimeType = '${FOLDER_MIME}')`,
  ].join(" and ");

  const resp = await drive.files.list({
    q,
    fields: "files(id,name,mimeType,webViewLink,modifiedTime,iconLink)",
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const raw = Array.isArray(resp.data?.files) ? resp.data.files : [];
  const items: FolderItem[] = raw.map((f: any) => ({
    id: String(f.id || ""),
    name: String(f.name || ""),
    mimeType: String(f.mimeType || ""),
    webViewLink: String(f.webViewLink || ""),
    modifiedTime: f.modifiedTime ? String(f.modifiedTime) : null,
    iconLink: f.iconLink ? String(f.iconLink) : null,
    isFolder: f.mimeType === FOLDER_MIME,
    isSpreadsheet: isWorkbookMime(f.mimeType),
  }));

  // Folders first, then alphabetical within each group
  items.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { status: "ok", folderId, items };
}

export async function attachWorkbookCandidate(args: {
  customerId: string;
  uid: string;
  spreadsheetId: string;
  spreadsheetName?: string;
  enrollmentId?: string;
  googleAccessToken?: string;
}): Promise<{ workbook: WorkbookMeta }> {
  const { customerId, uid, spreadsheetId, spreadsheetName: nameHint, enrollmentId, googleAccessToken } = args;

  let finalName: string | undefined = nameHint;

  try {
    const drive = await buildUserDriveClient(uid, googleAccessToken);
    if (drive) {
      const meta = await drive.files.get({
        fileId: spreadsheetId,
        fields: "id,name,mimeType",
        supportsAllDrives: true,
      });
      const mime = String(meta.data?.mimeType || "").trim();
      if (mime && !isWorkbookMime(mime)) {
        throw Object.assign(new Error("workbook_not_a_spreadsheet"), { code: 400 });
      }
      finalName = String(meta.data?.name || "").trim() || finalName;
    }
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg === "workbook_not_a_spreadsheet") throw err;
    const status = Number(err?.response?.status);
    if (status === 404) throw Object.assign(new Error("workbook_not_found"), { code: 404 });
    if (status === 403) throw Object.assign(new Error("workbook_access_denied"), { code: 403 });
    if (status === 401) {
      void markTokenRevoked(uid, "googleDrive");
      logger.warn("workbookService: Drive 401 — token revoked, saving without validation", { spreadsheetId });
    } else {
      logger.warn("workbookService: candidate validation skipped", { spreadsheetId, reason: msg });
    }
  }

  const now = isoNow();
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const workbook: WorkbookMeta = {
    spreadsheetId,
    spreadsheetUrl,
    ...(finalName ? { spreadsheetName: finalName } : {}),
    status: "linked",
    linkedAt: now,
    updatedAt: now,
    linkedBy: uid,
    ...(enrollmentId ? { linkedEnrollmentId: enrollmentId } : {}),
  };

  await admin
    .firestore()
    .collection("customers")
    .doc(customerId)
    .set({ customerDrive: { linkedWorkbooks: { tss: workbook } } }, { merge: true });

  return { workbook };
}
