// functions/src/features/gdrive/customerFolderIndex.ts
import {
  secureHandler,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REFRESH_TOKEN,
  requireOrg,
} from "../../core";
import { getDriveClient, getDriveClientWithDiagnostics } from "./service";
import { getOrgGDriveConfig } from "./orgConfig";
import { z } from "zod";
import * as logger from "firebase-functions/logger";

const OptionalParentId = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().min(3).optional());

const QuerySchema = z.object({
  activeParentId: OptionalParentId,
  exitedParentId: OptionalParentId,
});

/** Parse "Last, First_CWID" convention used by the GAS folder builder */
function parseFolderName(name: string) {
  const match = name.match(/^([^,]+),\s*([^_]+?)(?:_(.+))?$/);
  if (!match) return { last: null, first: null, cwid: null };
  return {
    last: (match[1] ?? "").trim() || null,
    first: (match[2] ?? "").trim() || null,
    cwid: (match[3] ?? "").trim() || null,
  };
}

function readGoogleAccessToken(req: { header(name: string): string | undefined }) {
  return String(req.header("x-drive-access-token") || "").trim() || undefined;
}

function queryFlag(v: unknown): boolean {
  const raw = Array.isArray(v) ? v[0] : v;
  return ["1", "true", "yes"].includes(String(raw ?? "").trim().toLowerCase());
}

function isLikelyPermissionOrVisibilityError(err: any) {
  const status = Number(err?.response?.status ?? err?.status ?? NaN);
  const message = String(err?.response?.data?.error?.message || err?.message || err || "");
  return (
    status === 403 ||
    status === 404 ||
    /insufficient permissions|forbidden|file not found|not found|permission/i.test(message)
  );
}

async function listFoldersInParent(
  folderId: string,
  status: "active" | "exited",
  opts?: { googleAccessToken?: string }
) {
  const drive = await getDriveClient({ googleAccessToken: opts?.googleAccessToken });
  let files: Array<{ id?: string | null; name?: string | null; webViewLink?: string | null; createdTime?: string | null }> = [];
  let scopedLookupError: any = null;
  try {
    const folderMeta = await drive.files.get({
      fileId: folderId,
      fields: "id,driveId",
      supportsAllDrives: true,
    });
    const driveId = String(folderMeta.data?.driveId || "").trim();
    const out = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name,webViewLink,createdTime)",
      pageSize: 1000,
      supportsAllDrives: true,
      ...(driveId
        ? { corpora: "drive" as const, driveId, includeItemsFromAllDrives: true }
        : { corpora: "user" as const }),
    });
    files = out.data.files || [];
  } catch (err: any) {
    scopedLookupError = err;
    logger.warn("gdrive_customer_index_scoped_lookup_failed_fallback_allDrives", {
      folderId,
      status,
      message: String(err?.message || err || ""),
    });
    const out = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name,webViewLink,createdTime)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });
    files = out.data.files || [];
    if (!files.length && isLikelyPermissionOrVisibilityError(scopedLookupError)) {
      throw new Error(
        "Drive folder index parent is inaccessible to the current Drive credentials."
      );
    }
  }

  return files.map((f) => {
    const parsed = parseFolderName(f.name || "");
    return {
      id: f.id || "",
      name: f.name || "",
      url: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
      createdTime: f.createdTime || null,
      status,
      ...parsed,
    };
  });
}

export const gdriveCustomerFolderIndex = secureHandler(
  async (req, res) => {
    const debug = queryFlag((req.query as Record<string, unknown>)?.debug);
    const googleAccessToken = readGoogleAccessToken(req);
    try {
      const query = QuerySchema.parse(req.query ?? {});
      const caller = (req as any).user;
      const orgId = requireOrg(caller);
      const orgConfig = await getOrgGDriveConfig(orgId);
      const resolvedQuery = {
        activeParentId:
          query.activeParentId || orgConfig.customerFolderIndex.activeParentId,
        exitedParentId:
          query.exitedParentId || orgConfig.customerFolderIndex.exitedParentId,
      };

      if (!resolvedQuery.activeParentId && !resolvedQuery.exitedParentId) {
        res.status(400).json({ ok: false, error: "missing_parent_ids" });
        return;
      }

      // Collect auth diagnostics before listing (debug mode only)
      let authDebug: Record<string, unknown> | undefined;
      if (debug) {
        try {
          const ctx = await getDriveClientWithDiagnostics({ googleAccessToken });
          authDebug = { authMode: ctx.authMode, auth: ctx.authDiagnostics, selection: ctx.selection };
        } catch (e: any) {
          authDebug = { error: String(e?.message || e) };
        }
      }

      const results: Awaited<ReturnType<typeof listFoldersInParent>> = [];
      const warnings: Array<{ status: "active" | "exited"; parentId: string; error: string }> = [];

      if (resolvedQuery.activeParentId) {
        try {
          const folders = await listFoldersInParent(resolvedQuery.activeParentId, "active", {
            googleAccessToken,
          });
          results.push(...folders);
        } catch (err: any) {
          warnings.push({
            status: "active",
            parentId: resolvedQuery.activeParentId,
            error: String(err?.message || err || "active_parent_index_failed"),
          });
        }
      }

      if (resolvedQuery.exitedParentId) {
        try {
          const folders = await listFoldersInParent(resolvedQuery.exitedParentId, "exited", {
            googleAccessToken,
          });
          results.push(...folders);
        } catch (err: any) {
          warnings.push({
            status: "exited",
            parentId: resolvedQuery.exitedParentId,
            error: String(err?.message || err || "exited_parent_index_failed"),
          });
        }
      }

      if (!results.length && warnings.length) {
        res.status(400).json({
          ok: false,
          error: warnings[0]?.error || "gdrive_folder_index_failed",
          warnings,
          ...(debug ? { debug: authDebug } : {}),
        });
        return;
      }

      res.status(200).json({
        ok: true,
        folders: results,
        ...(warnings.length ? { warnings } : {}),
        ...(debug ? { debug: authDebug } : {}),
      });
    } catch (e: any) {
      const msg = String(e?.message || e || "gdrive_folder_index_failed");
      const code = /not found|forbidden|permission|inaccessible/i.test(msg) ? 400 : 500;
      // Attempt auth diagnostics even on error in debug mode
      let authDebug: Record<string, unknown> | undefined;
      if (debug) {
        try {
          const ctx = await getDriveClientWithDiagnostics({ googleAccessToken });
          authDebug = { authMode: ctx.authMode, auth: ctx.authDiagnostics, selection: ctx.selection };
        } catch (de: any) {
          authDebug = { error: String(de?.message || de) };
        }
      }
      res.status(code).json({
        ok: false,
        error: msg,
        ...(debug ? { debug: authDebug } : {}),
      });
    }
  },
  {
    auth: "user",
    methods: ["GET", "OPTIONS"],
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
    memory: "512MiB",
    concurrency: 4,
    timeoutSeconds: 120,
  }
);
