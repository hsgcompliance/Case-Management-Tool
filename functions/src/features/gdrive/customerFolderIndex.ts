// functions/src/features/gdrive/customerFolderIndex.ts
import {
  secureHandler,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REFRESH_TOKEN,
} from "../../core";
import { getDriveClient } from "./service";
import { z } from "zod";
import * as logger from "firebase-functions/logger";

const QuerySchema = z.object({
  activeParentId: z.string().min(3).optional(),
  exitedParentId: z.string().min(3).optional(),
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
  return String(req.header("x-google-access-token") || "").trim() || undefined;
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
    try {
      const query = QuerySchema.parse(req.query ?? {});

      if (!query.activeParentId && !query.exitedParentId) {
        res.status(400).json({ ok: false, error: "missing_parent_ids" });
        return;
      }

      const results: Awaited<ReturnType<typeof listFoldersInParent>> = [];

      if (query.activeParentId) {
        const folders = await listFoldersInParent(query.activeParentId, "active", {
          googleAccessToken: readGoogleAccessToken(req),
        });
        results.push(...folders);
      }

      if (query.exitedParentId) {
        const folders = await listFoldersInParent(query.exitedParentId, "exited", {
          googleAccessToken: readGoogleAccessToken(req),
        });
        results.push(...folders);
      }

      res.status(200).json({ ok: true, folders: results });
    } catch (e: any) {
      const msg = String(e?.message || e || "gdrive_folder_index_failed");
      const code = /not found|forbidden|permission/i.test(msg) ? 400 : 500;
      res.status(code).json({ ok: false, error: msg });
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
