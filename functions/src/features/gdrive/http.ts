// functions/src/features/gdrive/http.ts
import {
  secureHandler,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REFRESH_TOKEN,
  DRIVE_SANDBOX_FOLDER_ID,
} from "../../core";
import { GDriveListQuery, GDriveCreateFolderBody, GDriveUploadBody, GDriveBuildCustomerFolderBody } from "./schemas";
import { listInFolder, createFolder, uploadSmallFile, buildCustomerFolder, type DriveListDiagnostics } from "./service";

function queryFlag(v: unknown): boolean {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
}

function readGoogleAccessToken(req: { header(name: string): string | undefined }) {
  return String(req.header("x-google-access-token") || "").trim() || undefined;
}

function inferStatusCode(message: string, diagnostics?: DriveListDiagnostics): number {
  const status = Number(
    diagnostics?.fallbackListError?.status ??
      diagnostics?.scopedLookupError?.status ??
      NaN
  );
  if (Number.isFinite(status) && status >= 400 && status <= 599) return status;
  if (/insufficient permissions|file not found|not found|forbidden|permission/i.test(message)) return 400;
  return 500;
}

function buildHints(message: string, diagnostics?: DriveListDiagnostics): string[] {
  const hints = new Set<string>();
  const msg = String(message || "").toLowerCase();
  if (diagnostics?.authMode === "user_access_token") {
    hints.add("Drive access used the signed-in user's Google access token.");
  }
  if (diagnostics?.authMode === "service_account") {
    hints.add("Drive access used the project service account.");
  }
  if (diagnostics?.authMode === "shared_refresh_token") {
    hints.add("This endpoint currently uses one shared OAuth refresh token, not per-user Drive OAuth.");
  }
  if (diagnostics?.auth?.hasDriveScope === false) {
    hints.add("The current access token does not include a Google Drive scope.");
  }
  if (Array.isArray(diagnostics?.auth?.missingExpectedScopes) && diagnostics.auth.missingExpectedScopes.length) {
    hints.add(`Token missing expected scopes: ${diagnostics.auth.missingExpectedScopes.join(", ")}`);
  }
  if (diagnostics?.folderMimeType && diagnostics.folderMimeType !== "application/vnd.google-apps.folder") {
    hints.add(`folderId resolved to ${diagnostics.folderMimeType}, not a folder.`);
  }
  if (
    diagnostics?.scopedLookupError?.status === 404 ||
    /file not found|not found/i.test(diagnostics?.scopedLookupError?.message || "")
  ) {
    hints.add("Folder ID is invalid or not visible to the OAuth token owner account.");
  }
  if (
    diagnostics?.scopedLookupError?.status === 403 ||
    diagnostics?.fallbackListError?.status === 403 ||
    /insufficient permissions|forbidden|permission/i.test(msg)
  ) {
    hints.add("Token owner lacks permission to this folder/shared drive. Share it with that account.");
  }
  if (diagnostics?.usedFallback && diagnostics?.resultCount === 0) {
    hints.add("Fallback allDrives query returned 0 children. Folder may be empty or inaccessible with this token.");
  }
  if (!hints.size) {
    hints.add("Use ?debug=1 to return Drive diagnostics (scopes, fallback path, and API error details).");
  }
  return Array.from(hints);
}

function classifyError(message: string, diagnostics?: DriveListDiagnostics): string {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("missing_oauth_secrets")) return "auth_config";
  if (diagnostics?.auth?.hasDriveScope === false) return "oauth_scope";
  if (Array.isArray(diagnostics?.auth?.missingExpectedScopes) && diagnostics.auth.missingExpectedScopes.length) {
    return "oauth_scope";
  }
  if (/file not found|not found/i.test(msg)) return "not_found_or_unshared";
  if (/insufficient permissions|forbidden|permission/i.test(msg)) return "permission_denied";
  if (/invalid credentials|unauthenticated|unauthorized/i.test(msg)) return "auth_failed";
  return "drive_api_error";
}

export const gdriveList = secureHandler(
  async (req, res) => {
    try {
      const parsed = GDriveListQuery.parse(req.query ?? {});
      const debug = queryFlag((req.query as Record<string, unknown> | undefined)?.debug);
      const sandbox = DRIVE_SANDBOX_FOLDER_ID.value();
      const folderId = parsed.folderId || (sandbox ? String(sandbox) : "");

      if (!folderId) {
        res.status(400).json({ ok: false, error: "missing_folderId" });
        return;
      }

      const out = await listInFolder(folderId, {
        includeDiagnostics: debug,
        googleAccessToken: readGoogleAccessToken(req),
      });
      const hints = buildHints("", out.diagnostics);
      res.status(200).json({
        ok: true,
        ...(out.data || {}),
        ...(debug
          ? {
              debug: {
                diagnostics: out.diagnostics,
                hints,
              },
            }
          : {}),
      });
    } catch (e: any) {
      const msg = String(e?.message || e || "gdrive_list_failed");
      const diagnostics = (e?.diagnostics || undefined) as DriveListDiagnostics | undefined;
      const code = inferStatusCode(msg, diagnostics);
      const hints = buildHints(msg, diagnostics);
      const category = classifyError(msg, diagnostics);
      const debug = queryFlag((req.query as Record<string, unknown> | undefined)?.debug);
      res.status(code).json({
        ok: false,
        error: msg,
        category,
        hint: hints[0],
        ...(debug
          ? {
              debug: {
                diagnostics,
                hints,
              },
            }
          : {}),
      });
    }
  },
  {
    auth: "user",
    methods: ["GET", "OPTIONS"],
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN, DRIVE_SANDBOX_FOLDER_ID],
    memory: "512MiB",
    concurrency: 4,
    timeoutSeconds: 60,
  }
);

export const gdriveCreateFolder = secureHandler(
  async (req, res) => {
    const body = GDriveCreateFolderBody.parse(req.body ?? {});
    const r = await createFolder(body.parentId, body.name, {
      googleAccessToken: readGoogleAccessToken(req),
    });
    res.status(200).json({ ok: true, folder: r });
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
  }
);

export const gdriveBuildCustomerFolder = secureHandler(
  async (req, res) => {
    const body = GDriveBuildCustomerFolderBody.parse(req.body ?? {});
    try {
      const folder = await buildCustomerFolder({
        ...body,
        googleAccessToken: readGoogleAccessToken(req),
      });
      res.status(200).json({ ok: true, folder });
    } catch (e: any) {
      const msg = String(e?.message || e || "gdrive_build_failed");
      res.status(500).json({ ok: false, error: msg });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
    timeoutSeconds: 120,
    memory: "256MiB",
  },
);

export const gdriveUpload = secureHandler(
  async (req, res) => {
    const body = GDriveUploadBody.parse(req.body ?? {});
    try {
      const r = await uploadSmallFile({
        ...body,
        googleAccessToken: readGoogleAccessToken(req),
      });
      res.status(200).json({ ok: true, file: r });
    } catch (e: any) {
      const msg = e?.message || String(e);
      const code = msg.includes("file_too_large") ? 413 : 400;
      res.status(code).json({ ok: false, error: msg });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
  }
);
