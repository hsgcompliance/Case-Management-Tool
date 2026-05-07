// functions/src/features/gdrive/service.ts
import {
  GOOGLE_API_SCOPES,
  GOOGLE_DRIVE_AUTH_MODE,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REFRESH_TOKEN,
} from "../../core";
import * as logger from "firebase-functions/logger";

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

function resolveDriveAuthOrder(configuredMode: string): DriveAuthMode[] {
  const mode = normalizeDriveAuthMode(configuredMode);
  if (mode === "user_access_token") {
    return ["user_access_token", "shared_refresh_token", "service_account"];
  }
  if (mode === "service_account") {
    return ["service_account", "user_access_token", "shared_refresh_token"];
  }
  if (mode === "shared_refresh_token") {
    return ["shared_refresh_token", "user_access_token", "service_account"];
  }
  return ["user_access_token", "shared_refresh_token", "service_account"];
}

function buildAuthSelection(configuredMode: string, googleAccessToken?: string) {
  return {
    configuredMode: String(configuredMode || "auto").trim() || "auto",
    headerTokenPresent: Boolean(String(googleAccessToken || "").trim()),
    attemptedModes: [] as DriveAuthMode[],
    resolvedMode: "shared_refresh_token" as DriveAuthMode,
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
  const clientId = OAUTH_CLIENT_ID.value();
  const clientSecret = OAUTH_CLIENT_SECRET.value();
  const refreshToken = OAUTH_REFRESH_TOKEN.value();

  if (!clientId || !clientSecret || !refreshToken) {
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

async function buildDriveContext(opts?: { googleAccessToken?: string; includeDiagnostics?: boolean }): Promise<DriveContext> {
  const configuredMode = GOOGLE_DRIVE_AUTH_MODE.value();
  const order = resolveDriveAuthOrder(String(configuredMode || ""));
  const expectedScopes = parseConfiguredScopes(String(GOOGLE_API_SCOPES.value() || ""));
  const googleAccessToken = String(opts?.googleAccessToken || "").trim();
  const selection = buildAuthSelection(String(configuredMode || ""), googleAccessToken);

  for (const mode of order) {
    selection.attemptedModes.push(mode);
    try {
      const context =
        mode === "user_access_token"
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
      selection.resolvedMode = context.authMode;
      return {
        ...context,
        selection: opts?.includeDiagnostics ? selection : undefined,
      };
    } catch (err: any) {
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
    authMode === "user_access_token"
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
export async function getDriveClient(opts?: { googleAccessToken?: string; includeDiagnostics?: boolean }) {
  const { drive } = await buildDriveContext(opts);
  return drive;
}

export async function getSheetsClient(opts?: { googleAccessToken?: string; includeDiagnostics?: boolean }) {
  const { authClient } = await buildDriveContext(opts);
  const { google } = await getGoogle();
  return google.sheets({ version: "v4", auth: authClient as any });
}

/** Like getDriveClient but also returns auth diagnostics — used by debug endpoints */
export async function getDriveClientWithDiagnostics(opts?: { googleAccessToken?: string }) {
  const context = await buildDriveContext({ ...opts, includeDiagnostics: true });
  return { drive: context.drive, authMode: context.authMode, authDiagnostics: context.authDiagnostics, selection: context.selection };
}

export async function listInFolder(
  folderId: string,
  opts?: { includeDiagnostics?: boolean; googleAccessToken?: string }
) {
  const context = await buildDriveContext(opts);
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
  opts?: { googleAccessToken?: string; includeDiagnostics?: boolean }
) {
  const drive = await getDriveClient(opts);
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
}) {
  const drive = await getDriveClient({ googleAccessToken: args.googleAccessToken });

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

  // Copy template files in parallel (each makeCopy is independent)
  await Promise.all(
    args.templates.map((tmpl) =>
      drive.files.copy({
        fileId: tmpl.fileId,
        requestBody: { name: tmpl.name, parents: [folderId] },
        fields: "id,name",
        supportsAllDrives: true,
      }),
    ),
  );

  // Create subfolders sequentially (cheap, low risk)
  for (const sub of args.subfolders) {
    await drive.files.create({
      requestBody: {
        name: sub,
        mimeType: "application/vnd.google-apps.folder",
        parents: [folderId],
      },
      fields: "id,name",
      supportsAllDrives: true,
    });
  }

  return {
    id: folderId,
    name: String(folderResult.data?.name || args.name),
    url: `https://drive.google.com/drive/folders/${folderId}`,
  };
}

export async function uploadSmallFile(args: {
  parentId: string;
  name: string;
  contentBase64: string;
  mimeType?: string;
  googleAccessToken?: string;
}) {
  const { parentId, name, contentBase64, mimeType = "application/pdf", googleAccessToken } = args;
  const drive = await getDriveClient({ googleAccessToken });
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
