// functions/src/features/gdrive/workbookService.ts
//
// Server-side workbook link/discovery service.
// Uses the per-user server-side OAuth pattern (same as Calendar) when the user has
// connected Google Drive via Settings. Falls back gracefully if not connected.

import * as logger from "firebase-functions/logger";
import admin from "../../core/admin";
import { isoNow } from "../../core";
import { getDriveClient } from "./service";
import { getOrgGDriveConfig } from "./orgConfig";
import { markTokenRevoked } from "../google/oauthClient";

/** Org-config template key that designates the TSS workbook source file(s). */
const TSS_WORKBOOK_TEMPLATE_KEY = "tss_workbook";

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

/** Resolve the customer's primary Drive folder id (customerDrive → legacy meta). */
function resolveCustomerFolderId(doc: Record<string, unknown>): string {
  const cDrive = doc.customerDrive as Record<string, unknown> | null | undefined;
  const meta = doc.meta as Record<string, unknown> | null | undefined;
  const metaFolders = Array.isArray(meta?.driveFolders)
    ? (meta?.driveFolders as Array<Record<string, unknown>>)
    : [];
  return (
    String(cDrive?.folderId || "").trim() ||
    String(meta?.driveFolderId || "").trim() ||
    String(metaFolders[0]?.id || "").trim()
  );
}

/** "{last}, {first} TSS Workbook" — mirrors the build-folder doc-name convention. */
function buildWorkbookCopyName(doc: Record<string, unknown>): string {
  const first = String(doc.firstName || "").trim();
  const last = String(doc.lastName || "").trim();
  const base = last && first
    ? `${last}, ${first}`
    : String(doc.name || "").trim() || "Customer";
  return `${base} TSS Workbook`.replace(/\s{2,}/g, " ").trim().slice(0, 255);
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

/**
 * Best-effort Drive lookup for a spreadsheet's canonical name + type.
 *
 * NEVER throws: linking must not depend on a live Drive call succeeding. A failed
 * lookup (not connected, 401/403/404, scope, transient, or no client) simply
 * returns `{}` so the caller saves the link anyway. `confirmedNotSpreadsheet` is
 * set ONLY when Drive positively answered with a non-spreadsheet mime (a
 * successful call) — that one case is a real signal a caller may choose to
 * reject, distinct from an API *failure*.
 */
async function lookupWorkbookMetaBestEffort(args: {
  uid: string;
  spreadsheetId: string;
  googleAccessToken?: string;
}): Promise<{ name?: string; confirmedNotSpreadsheet?: boolean }> {
  const { uid, spreadsheetId, googleAccessToken } = args;
  try {
    const drive = await buildUserDriveClient(uid, googleAccessToken);
    if (!drive) return {}; // not connected — link without validation
    const meta = await drive.files.get({
      fileId: spreadsheetId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });
    const mime = String(meta.data?.mimeType || "").trim();
    if (mime && !isWorkbookMime(mime)) return { confirmedNotSpreadsheet: true };
    const name = String(meta.data?.name || "").trim();
    return name ? { name } : {};
  } catch (err: any) {
    const status = Number(err?.response?.status);
    if (status === 401) {
      void markTokenRevoked(uid, "googleDrive");
      logger.warn("workbookService: Drive 401 — token revoked, linking without validation", { spreadsheetId });
    } else {
      logger.warn("workbookService: workbook validation skipped (non-fatal)", {
        spreadsheetId,
        reason: String(err?.message || ""),
        ...(Number.isFinite(status) ? { status } : {}),
      });
    }
    return {}; // any failure → link anyway
  }
}

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

  // Best-effort name/type resolution. Rejects ONLY when Drive positively confirms
  // a non-spreadsheet file; any Drive failure is non-fatal and the link is saved.
  const lookup = await lookupWorkbookMetaBestEffort({ uid, spreadsheetId, googleAccessToken });
  if (lookup.confirmedNotSpreadsheet) {
    throw Object.assign(new Error("workbook_not_a_spreadsheet"), { code: 400 });
  }
  const spreadsheetName = lookup.name;

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

  // The candidate came from a mime-filtered folder listing, so its name and type
  // are already known client-side — linking needs NO Drive call. Only when the
  // client didn't supply a name do we attempt a best-effort lookup (never blocks).
  let finalName: string | undefined = nameHint?.trim() || undefined;
  if (!finalName) {
    const lookup = await lookupWorkbookMetaBestEffort({ uid, spreadsheetId, googleAccessToken });
    finalName = lookup.name;
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

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/** Strip a trailing .xlsx / .xls extension from a file name. */
function stripSpreadsheetExt(name: string): string {
  return name.replace(/\.(xlsx|xls)$/i, "").trim();
}

/**
 * Converts an uploaded Excel file (.xlsx/.xls) in the customer folder into a
 * native Google Sheet (Drive files.copy with a Sheets target mimeType), then
 * links the resulting native sheet as the customer's TSS workbook.
 *
 * This is a Drive *folder-surface* write (creating a file), so it uses the
 * standard writable Drive client (user OAuth preferred per GOOGLE_DRIVE_AUTH_MODE),
 * NOT the strict workbook-content path. The original .xlsx is left untouched.
 */
export async function convertXlsxAndAttach(args: {
  customerId: string;
  uid: string;
  fileId: string;
  fileName?: string;
  enrollmentId?: string;
  googleAccessToken?: string;
}): Promise<{ workbook: WorkbookMeta; converted: true }> {
  const { customerId, uid, fileId, fileName, enrollmentId, googleAccessToken } = args;

  // Writable Drive client (folder surface — fallback chain, user OAuth preferred).
  const drive = await getDriveClient({
    userUid: uid,
    googleAccessToken,
    requireWritable: true,
    requiredScopes: [DRIVE_SCOPE],
  });

  // Resolve the source file: confirm it's an Excel file and find its folder.
  const srcMeta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,parents",
    supportsAllDrives: true,
  });
  const srcMime = String(srcMeta.data?.mimeType || "").trim();
  if (srcMime !== XLSX_MIME && srcMime !== XLS_MIME) {
    // Already native (or not a spreadsheet) — nothing to convert.
    throw Object.assign(new Error("workbook_not_convertible"), { code: 400 });
  }
  const baseName = stripSpreadsheetExt(String(srcMeta.data?.name || fileName || "Workbook"));
  const parents = Array.isArray(srcMeta.data?.parents) ? (srcMeta.data!.parents as string[]) : [];

  // Copy with conversion to a native Google Sheet, into the same folder.
  // Drive converts an Office file when the copy's target mimeType is a Google
  // Workspace type. Capture the real API error so failures aren't opaque 500s.
  let copied;
  try {
    copied = await drive.files.copy({
      fileId,
      requestBody: {
        name: baseName,
        mimeType: SPREADSHEET_MIME,
        ...(parents.length ? { parents } : {}),
      },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });
  } catch (err: any) {
    const httpStatus = Number(err?.response?.status ?? err?.code);
    const apiMessage =
      err?.response?.data?.error?.message ||
      err?.errors?.[0]?.message ||
      err?.message ||
      "copy_failed";
    const reasons = Array.isArray(err?.response?.data?.error?.errors)
      ? err.response.data.error.errors.map((e: any) => String(e?.reason || "")).filter(Boolean)
      : [];
    logger.error("workbook_xlsx_convert_copy_failed", {
      fileId, srcMime, parents, status: err?.response?.status, code: err?.code, apiMessage, reasons,
    });
    throw Object.assign(new Error(`workbook_convert_failed: ${apiMessage}`), {
      code: Number.isFinite(httpStatus) && httpStatus >= 400 && httpStatus <= 599 ? httpStatus : 502,
    });
  }

  const newId = String(copied.data?.id || "").trim();
  if (!newId) throw Object.assign(new Error("workbook_convert_failed"), { code: 500 });

  // Archive the original Excel file so it's clearly superseded by the native sheet.
  // Non-fatal: a rename failure must not undo a successful conversion.
  try {
    const originalName = String(srcMeta.data?.name || `${baseName}.xlsx`);
    if (!/^Archived_/i.test(originalName)) {
      await drive.files.update({
        fileId,
        requestBody: { name: `Archived_${originalName}` },
        supportsAllDrives: true,
      });
    }
  } catch (e: any) {
    logger.warn("workbook_xlsx_archive_rename_failed", { fileId, error: String(e?.message || e) });
  }

  const now = isoNow();
  const workbook: WorkbookMeta = {
    spreadsheetId: newId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newId}/edit`,
    spreadsheetName: String(copied.data?.name || baseName).trim() || baseName,
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

  return { workbook, converted: true };
}

/**
 * Copies the org's configured TSS workbook template (payer / non-payer variant)
 * into the customer's existing Drive folder and links the copy as the customer's
 * TSS workbook. Used by the "Create from TSS template" action on the workbook
 * panel when no workbook is linked yet.
 *
 * Source file ids come from the org Drive config's `tss_workbook` template (NOT
 * the client) so staff can only copy the org-sanctioned template. Folder-surface
 * write → standard writable Drive client (user OAuth preferred).
 */
export async function copyWorkbookFromTemplate(args: {
  customerId: string;
  uid: string;
  orgId: string;
  variant: "payer" | "nonpayer";
  enrollmentId?: string;
  googleAccessToken?: string;
}): Promise<{ workbook: WorkbookMeta; copiedFromTemplateId: string }> {
  const { customerId, uid, orgId, variant, enrollmentId, googleAccessToken } = args;

  const customerDoc = await getCustomerDoc(customerId);
  if (!customerDoc) throw Object.assign(new Error("customer_not_found"), { code: 404 });

  const folderId = resolveCustomerFolderId(customerDoc);
  if (!folderId) throw Object.assign(new Error("customer_folder_missing"), { code: 400 });

  // Resolve the source template file id from org config (authoritative).
  const config = await getOrgGDriveConfig(orgId);
  const template = (config.templates || []).find((t) => t.key === TSS_WORKBOOK_TEMPLATE_KEY);
  if (!template) throw Object.assign(new Error("tss_template_not_configured"), { code: 400 });
  const variantId = template.variants
    ? String((variant === "payer" ? template.variants.payer : template.variants.nonpayer) || "").trim()
    : "";
  const sourceId = variantId || String(template.fileId || "").trim();
  if (!sourceId) {
    throw Object.assign(new Error(`tss_template_${variant}_missing`), { code: 400 });
  }

  const drive = await getDriveClient({
    userUid: uid,
    googleAccessToken,
    requireWritable: true,
    requiredScopes: [DRIVE_SCOPE],
  });

  const name = buildWorkbookCopyName(customerDoc);

  let copied;
  try {
    copied = await drive.files.copy({
      fileId: sourceId,
      requestBody: { name, parents: [folderId] },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });
  } catch (err: any) {
    const httpStatus = Number(err?.response?.status ?? err?.code);
    const apiMessage =
      err?.response?.data?.error?.message ||
      err?.errors?.[0]?.message ||
      err?.message ||
      "copy_failed";
    const reasons = Array.isArray(err?.response?.data?.error?.errors)
      ? err.response.data.error.errors.map((e: any) => String(e?.reason || "")).filter(Boolean)
      : [];
    logger.error("workbook_tss_template_copy_failed", {
      customerId, sourceId, folderId, variant, status: err?.response?.status, code: err?.code, apiMessage, reasons,
    });
    throw Object.assign(new Error(`tss_template_copy_failed: ${apiMessage}`), {
      code: Number.isFinite(httpStatus) && httpStatus >= 400 && httpStatus <= 599 ? httpStatus : 502,
    });
  }

  const newId = String(copied.data?.id || "").trim();
  if (!newId) throw Object.assign(new Error("tss_template_copy_failed"), { code: 500 });

  const now = isoNow();
  const workbook: WorkbookMeta = {
    spreadsheetId: newId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newId}/edit`,
    spreadsheetName: String(copied.data?.name || name).trim() || name,
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

  return { workbook, copiedFromTemplateId: sourceId };
}
