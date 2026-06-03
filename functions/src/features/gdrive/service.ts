// functions/src/features/gdrive/service.ts
import {
  GOOGLE_API_SCOPES,
  GOOGLE_DRIVE_AUTH_MODE,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
} from "../../core";
import * as logger from "firebase-functions/logger";
import { buildOAuthClient } from "../google/oauthClient";
import { getMissingScopes } from "../google/tokenStore";

let googleapisPromise: Promise<typeof import("googleapis")> | null = null;
async function getGoogle() {
  googleapisPromise ||= import("googleapis");
  return googleapisPromise;
}

type DriveErrorInfo = {
  message: string;
  status?: number;
  code?: number;
  reasons?: string[];
  domainReasons?: string[];
};

export type DriveAuthMode =
  | "server_user_oauth"
  | "user_access_token"
  | "service_account"
  | "shared_refresh_token";

export type DriveListDiagnostics = {
  folderId: string;
  authMode: DriveAuthMode;
  usedFallback: boolean;
  resultCount: number;
  scopedDriveId: string | null;
  folderMimeType: string | null;
  authSelection?: {
    configuredMode: string;
    headerTokenPresent: boolean;
    attemptedModes: DriveAuthMode[];
    resolvedMode: DriveAuthMode;
    failures: Array<{ mode: DriveAuthMode; reason: string }>;
  };
  scopedLookupError?: DriveErrorInfo;
  fallbackListError?: DriveErrorInfo;
  auth?: {
    hasRefreshToken: boolean;
    oauthClientIdSuffix: string;
    expectedScopes?: string[];
    tokenScopes?: string[];
    missingExpectedScopes?: string[];
    hasDriveScope?: boolean;
    tokenAudience?: string | null;
    tokenExpiresAt?: string | null;
    tokenInfoError?: string;
    serviceAccountEmail?: string | null;
  };
};

type DriveContext = {
  authClient: any;
  drive: any;
  oauth2?: any;
  clientId?: string;
  refreshToken?: string;
  authMode: DriveAuthMode;
  authDiagnostics?: DriveListDiagnostics["auth"];
  selection?: DriveListDiagnostics["authSelection"];
};

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/**
 * Thrown when the user's stored OAuth token exists but is missing a required
 * scope — meaning they unchecked a permission on the Google consent screen.
 * HTTP handlers catch this and return a structured response that names the
 * blocked permission and tells the frontend which service to re-authorize.
 */
export class ScopeMissingError extends Error {
  readonly isScopeMissing = true;
  readonly missingScopes: string[];
  readonly missingPermissions: string[];
  readonly reconnectService: "googleDrive" | "googleCalendar";

  constructor(
    missingScopes: string[],
    missingPermissions: string[],
    reconnectService: "googleDrive" | "googleCalendar",
  ) {
    super("oauth_scope_missing");
    this.missingScopes = missingScopes;
    this.missingPermissions = missingPermissions;
    this.reconnectService = reconnectService;
  }
}

function toDriveErrorInfo(err: any): DriveErrorInfo {
  const responseStatus = Number(err?.response?.status);
  const responseCode = Number(err?.code);
  const apiError = err?.response?.data?.error;
  const errorsArray = Array.isArray(apiError?.errors) ? apiError.errors : [];
  const reasons = errorsArray
    .map((e: any) => String(e?.reason || "").trim())
    .filter(Boolean);
  const domainReasons = errorsArray
    .map((e: any) => {
      const domain = String(e?.domain || "").trim();
      const reason = String(e?.reason || "").trim();
      if (!domain && !reason) return "";
      return domain && reason ? `${domain}:${reason}` : domain || reason;
    })
    .filter(Boolean);
  const message =
    String(apiError?.message || "").trim() ||
    String(err?.message || "").trim() ||
    "gdrive_error";
  return {
    message,
    ...(Number.isFinite(responseStatus) ? { status: responseStatus } : {}),
    ...(Number.isFinite(responseCode) ? { code: responseCode } : {}),
    ...(reasons.length ? { reasons } : {}),
    ...(domainReasons.length ? { domainReasons } : {}),
  };
}

function parseConfiguredScopes(raw: string): string[] {
  return String(raw || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeDriveAuthMode(raw: string): "auto" | DriveAuthMode {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (
    value === "server" ||
    value === "server_user_oauth" ||
    value === "per_user_oauth" ||
    value === "per-user-oauth"
  ) {
    return "server_user_oauth";
  }
  if (
    value === "user" ||
    value === "user_access_token" ||
    value === "signed_in_user" ||
    value === "signed-in-user"
  ) {
    return "user_access_token";
  }
  if (
    value === "service" ||
    value === "service_account" ||
    value === "service-account"
  ) {
    return "service_account";
  }
  if (
    value === "shared" ||
    value === "shared_refresh_token" ||
    value === "shared-refresh-token" ||
    value === "oauth" ||
    value === "shared_oauth"
  ) {
    return "shared_refresh_token";
  }
  return "auto";
}

function resolveDriveAuthOrder(configuredMode: string, hasServerUser: boolean): DriveAuthMode[] {
  const mode = normalizeDriveAuthMode(configuredMode);
  if (mode === "server_user_oauth") {
    return hasServerUser
      ? ["server_user_oauth", "user_access_token", "shared_refresh_token", "service_account"]
      : ["user_access_token", "shared_refresh_token", "service_account"];
  }
  if (hasServerUser && mode === "auto") {
    return ["server_user_oauth", "user_access_token", "shared_refresh_token", "service_account"];
  }
  if (mode === "user_access_token") {
    return hasServerUser
      ? ["user_access_token", "server_user_oauth", "shared_refresh_token", "service_account"]
      : ["user_access_token", "shared_refresh_token", "service_account"];
  }
  if (mode === "service_account") {
    return hasServerUser
      ? ["service_account", "server_user_oauth", "user_access_token", "shared_refresh_token"]
      : ["service_account", "user_access_token", "shared_refresh_token"];
  }
  if (mode === "shared_refresh_token") {
    return hasServerUser
      ? ["shared_refresh_token", "server_user_oauth", "user_access_token", "service_account"]
      : ["shared_refresh_token", "user_access_token", "service_account"];
  }
  return ["user_access_token", "shared_refresh_token", "service_account"];
}

function buildAuthSelection(configuredMode: string, googleAccessToken?: string) {
  return {
    configuredMode: String(configuredMode || "auto").trim() || "auto",
    headerTokenPresent: Boolean(String(googleAccessToken || "").trim()),
    attemptedModes: [] as DriveAuthMode[],
    resolvedMode: "server_user_oauth" as DriveAuthMode,
    failures: [] as Array<{ mode: DriveAuthMode; reason: string }>,
  };
}

async function collectAuthDiagnostics(args: {
  oauth2: any;
  clientId: string;
  refreshToken: string;
  expectedScopes: string[];
}) {
  const { oauth2, clientId, refreshToken, expectedScopes } = args;
  const auth: DriveListDiagnostics["auth"] = {
    hasRefreshToken: Boolean(refreshToken),
    oauthClientIdSuffix: String(clientId || "").slice(-8),
    ...(expectedScopes.length ? { expectedScopes } : {}),
  };
  try {
    const tokenResult = await oauth2.getAccessToken();
    const accessToken = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
    if (!accessToken) return auth;
    const tokenInfo = await oauth2.getTokenInfo(accessToken);
    const scopes = Array.isArray((tokenInfo as any)?.scopes)
      ? ((tokenInfo as any).scopes as string[])
      : typeof (tokenInfo as any)?.scope === "string"
      ? String((tokenInfo as any).scope)
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const expiryMs = Number((tokenInfo as any)?.expiry_date);
    const missingExpectedScopes = expectedScopes.filter((scope) => !scopes.includes(scope));
    const hasDriveScope = scopes.some((s) => /^https:\/\/www\.googleapis\.com\/auth\/drive(\.|$|\/)/.test(s));
    return {
      ...auth,
      ...(scopes.length ? { tokenScopes: scopes } : {}),
      ...(missingExpectedScopes.length ? { missingExpectedScopes } : {}),
      hasDriveScope,
      tokenAudience: String((tokenInfo as any)?.aud || "").trim() || null,
      tokenExpiresAt: Number.isFinite(expiryMs) ? new Date(expiryMs).toISOString() : null,
    };
  } catch (err: any) {
    return {
      ...auth,
      tokenInfoError: String(err?.message || err || "token_info_failed"),
    };
  }
}

function shortErrorMessage(err: any, fallback: string) {
  return String(
    err?.response?.data?.error?.message ||
      err?.message ||
      err ||
      fallback
  ).trim() || fallback;
}

async function buildServiceAccountContext() {
  const { google } = await getGoogle();
  const auth = new google.auth.GoogleAuth({ scopes: [DRIVE_SCOPE] });
  const client = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: client as any });
  let serviceAccountEmail: string | null = null;
  try {
    const creds = await auth.getCredentials();
    serviceAccountEmail = String(creds.client_email || "").trim() || null;
  } catch {
    serviceAccountEmail = null;
  }
  return {
    authClient: client,
    drive,
    authMode: "service_account" as const,
    authDiagnostics: {
      hasRefreshToken: false,
      oauthClientIdSuffix: "",
      expectedScopes: [DRIVE_SCOPE],
      tokenScopes: [DRIVE_SCOPE],
      missingExpectedScopes: [],
      hasDriveScope: true,
      serviceAccountEmail,
    },
  };
}

async function buildSharedRefreshTokenContext(expectedScopes: string[]) {
  const { google } = await getGoogle();
  const clientId = GOOGLE_OAUTH_CLIENT_ID.value();
  const clientSecret = GOOGLE_OAUTH_CLIENT_SECRET.value();
  const refreshToken = String(GOOGLE_OAUTH_REFRESH_TOKEN.value() || "").trim();

  if (!clientId || !clientSecret || !refreshToken || refreshToken === "__unset__") {
    throw new Error("missing_oauth_secrets");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "https://developers.google.com/oauthplayground");
  oauth2.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2 });
  const authDiagnostics = await collectAuthDiagnostics({
    oauth2,
    clientId,
    refreshToken,
    expectedScopes,
  });
  return {
    authClient: oauth2,
    drive,
    oauth2,
    clientId,
    refreshToken,
    authMode: "shared_refresh_token" as const,
    authDiagnostics,
  };
}

async function buildUserAccessTokenContext(googleAccessToken: string) {
  const token = String(googleAccessToken || "").trim();
  if (!token) throw new Error("missing_google_access_token");
  const { google } = await getGoogle();
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: token });
  let authDiagnostics: DriveListDiagnostics["auth"] = {
    hasRefreshToken: false,
    oauthClientIdSuffix: "",
  };
  try {
    const tokenInfo = await oauth2.getTokenInfo(token);
    const scopes = Array.isArray((tokenInfo as any)?.scopes)
      ? ((tokenInfo as any).scopes as string[])
      : typeof (tokenInfo as any)?.scope === "string"
      ? String((tokenInfo as any).scope)
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const hasDriveScope = scopes.some((s) =>
      /^https:\/\/www\.googleapis\.com\/auth\/drive(\.|$|\/)/.test(s)
    );
    authDiagnostics = {
      ...authDiagnostics,
      ...(scopes.length ? { tokenScopes: scopes } : {}),
      hasDriveScope,
      tokenAudience: String((tokenInfo as any)?.aud || "").trim() || null,
      tokenExpiresAt: null,
    };
  } catch (err: any) {
    authDiagnostics = {
      ...authDiagnostics,
      tokenInfoError: shortErrorMessage(err, "token_info_failed"),
    };
  }
  const drive = google.drive({ version: "v3", auth: oauth2 });
  return {
    authClient: oauth2,
    drive,
    oauth2,
    authMode: "user_access_token" as const,
    authDiagnostics,
  };
}

async function buildServerUserOAuthContext(uid: string, requiredScopes?: string[]) {
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) throw new Error("missing_server_user_uid");
  const authResult = await buildOAuthClient(cleanUid, "googleDrive");
  if (!authResult.ok) throw new Error(`server_google_drive_${authResult.code}`);

  // Check whether the stored token actually has the required scopes.
  // The user may have unchecked a permission on the Google consent screen.
  // If scopes are missing we throw ScopeMissingError rather than proceeding —
  // the HTTP layer catches this and returns a named-permission error to the client.
  if (requiredScopes?.length) {
    const missing = await getMissingScopes(cleanUid, "googleDrive", requiredScopes);
    if (missing) {
      throw new ScopeMissingError(missing.missingScopes, missing.missingPermissions, "googleDrive");
    }
  }

  const { google } = await getGoogle();
  const drive = google.drive({ version: "v3", auth: authResult.auth });
  return {
    authClient: authResult.auth,
    drive,
    oauth2: authResult.auth,
    authMode: "server_user_oauth" as const,
    authDiagnostics: {
      hasRefreshToken: true,
      oauthClientIdSuffix: "",
      expectedScopes: requiredScopes ?? [DRIVE_SCOPE],
      hasDriveScope: true,
    },
  };
}

async function buildDriveContext(opts?: {
  googleAccessToken?: string;
  includeDiagnostics?: boolean;
  userUid?: string;
  requireWritable?: boolean;
  requiredScopes?: string[];
}): Promise<DriveContext> {
  const configuredMode = GOOGLE_DRIVE_AUTH_MODE.value();
  const userUid = String(opts?.userUid || "").trim();
  const order = resolveDriveAuthOrder(String(configuredMode || ""), Boolean(userUid));
  const expectedScopes = parseConfiguredScopes(String(GOOGLE_API_SCOPES.value() || ""));
  const googleAccessToken = String(opts?.googleAccessToken || "").trim();
  const selection = buildAuthSelection(String(configuredMode || ""), googleAccessToken);

  for (const mode of order) {
    selection.attemptedModes.push(mode);
    try {
      const context =
        mode === "server_user_oauth"
          ? await buildServerUserOAuthContext(userUid, opts?.requiredScopes)
          : mode === "user_access_token"
          ? await buildUserAccessTokenContext(googleAccessToken)
          : mode === "service_account"
          ? await buildServiceAccountContext()
          : await buildSharedRefreshTokenContext(expectedScopes);
      if (
        context.authMode === "shared_refresh_token" &&
        context.authDiagnostics?.hasDriveScope === false
      ) {
        throw new Error("shared_refresh_token_missing_drive_scope");
      }
      if (opts?.requireWritable && context.authMode === "shared_refresh_token") {
        throw new Error("shared_oauth_read_only");
      }
      selection.resolvedMode = context.authMode;
      return {
        ...context,
        selection: opts?.includeDiagnostics ? selection : undefined,
      };
    } catch (err: any) {
      // ScopeMissingError means the user connected but didn't grant required scopes.
      // Don't fall through to other auth modes — surface the specific permission error.
      if (err instanceof ScopeMissingError) throw err;
      selection.failures.push({
        mode,
        reason: shortErrorMessage(err, `drive_auth_${mode}_failed`),
      });
    }
  }

  throw Object.assign(new Error("drive_auth_unavailable"), {
    meta: { selection },
  });
}

function isLikelyPermissionOrVisibilityError(err?: DriveErrorInfo) {
  if (!err) return false;
  if (err.status === 403 || err.status === 404) return true;
  return /insufficient permissions|forbidden|file not found|not found|permission/i.test(
    String(err.message || "")
  );
}

function buildInaccessibleFolderError(
  authMode: DriveAuthMode,
  err?: DriveErrorInfo
) {
  const prefix =
    authMode === "server_user_oauth"
      ? "The connected Google Drive account cannot access this Drive folder."
      : authMode === "user_access_token"
      ? "The signed-in Google user cannot access this Drive folder."
      : authMode === "service_account"
      ? "The project service account cannot access this Drive folder."
      : "The shared OAuth Drive account cannot access this folder.";
  const detail =
    err?.status === 404
      ? "Check that the folder ID is valid and shared with the selected Drive principal."
      : "Share the folder with the selected Drive principal or switch Drive auth mode.";
  return `${prefix} ${detail}`;
}

/** Internal: build a Drive client using the preferred Drive auth context */
export async function getDriveClient(opts?: {
  googleAccessToken?: string;
  includeDiagnostics?: boolean;
  userUid?: string;
  requireWritable?: boolean;
  requiredScopes?: string[];
}) {
  const { drive } = await buildDriveContext(opts);
  return drive;
}

export async function getSheetsClient(opts?: {
  googleAccessToken?: string;
  includeDiagnostics?: boolean;
  userUid?: string;
  requireWritable?: boolean;
  requiredScopes?: string[];
}) {
  const { authClient } = await buildDriveContext({
    ...opts,
    requiredScopes: opts?.requiredScopes ?? [SHEETS_SCOPE],
  });
  const { google } = await getGoogle();
  return google.sheets({ version: "v4", auth: authClient as any });
}

/**
 * STRICT workbook-content Sheets client.
 *
 * Auth-mode policy (see docs/active-projects.local/google-integrations/WORKBOOK_SYSTEM.md):
 *   TSS workbook CONTENT (reading cells, extracting entities, future write/append)
 *   must use the signed-in user's own server-side Google OAuth ONLY, so every
 *   read/write is attributable to that user. There is NO fallback to the shared
 *   refresh token, the service account, or a temporary browser token — those are
 *   reserved for the Drive *folder* surface, not workbook content.
 *
 * Fails closed:
 *   - no stored user token        → throws "google_not_connected"
 *   - token missing spreadsheets  → throws ScopeMissingError (caller → re-authorize banner)
 * On failure the UI falls back to the iframe / open-in-Sheets path.
 *
 * Do NOT route folder-browsing or calendar calls through here — use getDriveClient
 * (which keeps its fallback chain) for those.
 */
export async function getWorkbookSheetsClient(opts: {
  userUid: string;
  requiredScopes?: string[];
}) {
  const uid = String(opts.userUid || "").trim();
  if (!uid) throw new Error("google_not_connected");
  let context;
  try {
    context = await buildServerUserOAuthContext(uid, opts.requiredScopes ?? [SHEETS_SCOPE]);
  } catch (err: any) {
    // ScopeMissingError must propagate intact so the caller can surface the
    // named-permission re-authorize banner.
    if (err instanceof ScopeMissingError) throw err;
    // Any other failure (no token, refresh failed) is "not connected" — fail
    // closed; the UI falls back to the iframe.
    throw new Error("google_not_connected");
  }
  const { google } = await getGoogle();
  return google.sheets({ version: "v4", auth: context.authClient as any });
}

/** Like getDriveClient but also returns auth diagnostics — used by debug endpoints */
export async function getDriveClientWithDiagnostics(opts?: { googleAccessToken?: string; userUid?: string }) {
  const context = await buildDriveContext({ ...opts, includeDiagnostics: true });
  return { drive: context.drive, authMode: context.authMode, authDiagnostics: context.authDiagnostics, selection: context.selection };
}

export async function listInFolder(
  folderId: string,
  opts?: { includeDiagnostics?: boolean; googleAccessToken?: string; userUid?: string }
) {
  const context = await buildDriveContext({ ...opts, requiredScopes: [DRIVE_SCOPE] });
  const { drive } = context;
  const includeDiagnostics = opts?.includeDiagnostics === true;
  const diagnostics: DriveListDiagnostics = {
    folderId,
    authMode: context.authMode,
    usedFallback: false,
    resultCount: 0,
    scopedDriveId: null,
    folderMimeType: null,
  };
  if (includeDiagnostics) {
    diagnostics.auth = context.authDiagnostics;
    diagnostics.authSelection = context.selection;
  }

  // Prefer drive-scoped listing when we can resolve driveId, but fall back to
  // allDrives query (legacy behavior) when metadata lookup fails.
  try {
    const folderMeta = await drive.files.get({
      fileId: folderId,
      fields: "id,driveId,mimeType",
      supportsAllDrives: true,
    });
    const driveId = String(folderMeta.data?.driveId || "").trim();
    diagnostics.folderMimeType = String(folderMeta.data?.mimeType || "").trim() || null;
    diagnostics.scopedDriveId = driveId || null;
    const out = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id,name,mimeType,webViewLink,driveId,size,modifiedTime)",
      pageSize: 100,
      supportsAllDrives: true,
      ...(driveId
        ? { corpora: "drive" as const, driveId, includeItemsFromAllDrives: true }
        : { corpora: "user" as const }),
    });
    diagnostics.resultCount = Array.isArray(out.data?.files) ? out.data.files.length : 0;
    return { data: out.data, diagnostics };
  } catch (err: any) {
    diagnostics.scopedLookupError = toDriveErrorInfo(err);
    logger.warn("gdrive_list_scoped_lookup_failed_fallback_allDrives", {
      folderId,
      errorMessage: diagnostics.scopedLookupError.message,
      errorStatus: diagnostics.scopedLookupError.status,
      errorCode: diagnostics.scopedLookupError.code,
      reasons: diagnostics.scopedLookupError.reasons || [],
    });
    diagnostics.usedFallback = true;
    try {
      const out = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id,name,mimeType,webViewLink,iconLink,driveId,parents,size,modifiedTime)",
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: "allDrives",
      });
      diagnostics.resultCount = Array.isArray(out.data?.files) ? out.data.files.length : 0;
      if (diagnostics.resultCount === 0) {
        logger.warn("gdrive_list_empty_result_after_fallback", {
          folderId,
          authMode: diagnostics.authMode,
          scopedDriveId: diagnostics.scopedDriveId,
          scopedLookupErrorMessage: diagnostics.scopedLookupError?.message || "",
          scopedLookupErrorReasons: diagnostics.scopedLookupError?.reasons || [],
        });
        if (isLikelyPermissionOrVisibilityError(diagnostics.scopedLookupError)) {
          throw Object.assign(
            new Error(
              buildInaccessibleFolderError(
                diagnostics.authMode,
                diagnostics.scopedLookupError
              )
            ),
            { diagnostics }
          );
        }
      }
      return { data: out.data, diagnostics };
    } catch (fallbackErr: any) {
      diagnostics.fallbackListError = toDriveErrorInfo(fallbackErr);
      logger.error("gdrive_list_fallback_failed", {
        folderId,
        authMode: diagnostics.authMode,
        fallbackErrorMessage: diagnostics.fallbackListError.message,
        fallbackErrorStatus: diagnostics.fallbackListError.status,
        fallbackErrorCode: diagnostics.fallbackListError.code,
        fallbackReasons: diagnostics.fallbackListError.reasons || [],
      });
      throw Object.assign(new Error(diagnostics.fallbackListError.message), {
        diagnostics,
      });
    }
  }
}

export async function createFolder(
  parentId: string,
  name: string,
  opts?: { googleAccessToken?: string; includeDiagnostics?: boolean; userUid?: string }
) {
  const drive = await getDriveClient({ ...opts, requireWritable: true, requiredScopes: [DRIVE_SCOPE] });
  const r = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id,name,webViewLink,driveId,parents",
    supportsAllDrives: true,
  });
  return r.data;
}

export async function buildCustomerFolder(args: {
  name: string;
  parentId: string;
  templates: Array<{ fileId: string; name: string }>;
  subfolders: string[];
  googleAccessToken?: string;
  userUid?: string;
}) {
  const drive = await getDriveClient({
    googleAccessToken: args.googleAccessToken,
    userUid: args.userUid,
    requireWritable: true,
    requiredScopes: [DRIVE_SCOPE],
  });

  // Create main folder
  const folderResult = await drive.files.create({
    requestBody: {
      name: args.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [args.parentId],
    },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });

  const folderId = String(folderResult.data?.id || "").trim();
  if (!folderId) throw new Error("folder_create_no_id");

  const warnings: Array<{
    phase: "template" | "subfolder";
    name: string;
    fileId?: string;
    error: string;
  }> = [];

  // Copy template files in parallel. A template failure should not hide the
  // successfully-created customer folder from the app.
  const templateResults = await Promise.allSettled(
    args.templates.map((tmpl) =>
      drive.files.copy({
        fileId: tmpl.fileId,
        requestBody: { name: tmpl.name, parents: [folderId] },
        fields: "id,name",
        supportsAllDrives: true,
      }),
    ),
  );
  templateResults.forEach((result, index) => {
    if (result.status === "fulfilled") return;
    const tmpl = args.templates[index];
    warnings.push({
      phase: "template",
      name: String(tmpl?.name || "template"),
      ...(tmpl?.fileId ? { fileId: tmpl.fileId } : {}),
      error: shortErrorMessage(result.reason, "template_copy_failed"),
    });
  });

  // Create subfolders sequentially (cheap, low risk). Keep going so one bad
  // label does not turn a finished folder into a 500.
  for (const sub of args.subfolders) {
    try {
      await drive.files.create({
        requestBody: {
          name: sub,
          mimeType: "application/vnd.google-apps.folder",
          parents: [folderId],
        },
        fields: "id,name",
        supportsAllDrives: true,
      });
    } catch (err: any) {
      warnings.push({
        phase: "subfolder",
        name: String(sub || "subfolder"),
        error: shortErrorMessage(err, "subfolder_create_failed"),
      });
    }
  }

  if (warnings.length) {
    logger.warn("gdrive_customer_folder_build_partial", {
      folderId,
      folderName: String(folderResult.data?.name || args.name),
      warningCount: warnings.length,
      warnings,
    });
  }

  return {
    id: folderId,
    name: String(folderResult.data?.name || args.name),
    url: `https://drive.google.com/drive/folders/${folderId}`,
    ...(warnings.length ? { warnings } : {}),
  };
}

export async function uploadSmallFile(args: {
  parentId: string;
  name: string;
  contentBase64: string;
  mimeType?: string;
  googleAccessToken?: string;
  userUid?: string;
}) {
  const { parentId, name, contentBase64, mimeType = "application/pdf", googleAccessToken, userUid } = args;
  const drive = await getDriveClient({ googleAccessToken, userUid, requireWritable: true, requiredScopes: [DRIVE_SCOPE] });
  const media = { mimeType, body: Buffer.from(contentBase64, "base64") };

  // ~10MB guardrail
  const size = Buffer.byteLength(media.body);
  if (size > 10 * 1024 * 1024) {
    logger.warn("gdrive_upload_large_file_skipped", { size });
    throw new Error("file_too_large");
  }

  const r = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media,
    fields: "id,name,webViewLink,driveId,parents",
    supportsAllDrives: true,
  });
  return r.data;
}
