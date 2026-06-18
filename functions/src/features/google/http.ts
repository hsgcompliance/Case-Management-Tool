/**
 * Google OAuth integration endpoints - Calendar and Drive.
 *
 * Architecture note:
 *   Firebase Auth handles app login.
 *   Google Calendar / Drive connectors are separate OAuth integrations.
 *   Tokens are stored server-side in userSecrets/{uid}/integrations/{service}.
 *   userExtras only stores safe connection metadata (no tokens).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {
  RUNTIME,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_STATE_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI,
  WEB_BASE_URL,
} from "../../core/env";
import { secureHandler } from "../../core/http";
import type { AuthedRequest } from "../../core/requestContext";
import { isoNow } from "../../core";
import {
  readToken,
  writeToken,
  clearToken,
  writePublicMeta,
  tokenToPublicMeta,
  recordStatusToPermissionStatus,
} from "./tokenStore";
import { exchangeCode, getGoogleEmail, revokeToken } from "./oauthClient";
import type { GoogleService, GoogleTokenRecord } from "./types";

// -- Secrets list (required by every handler that uses Google OAuth) -----------

const GOOGLE_SECRETS = [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_STATE_SECRET];

// -- CSRF state helpers --------------------------------------------------------

function originOf(value: string): string {
  try { return new URL(value).origin; } catch { return ""; }
}

function buildState(uid: string, service: GoogleService, returnBase: string): string {
  const secret = GOOGLE_OAUTH_STATE_SECRET.value();
  const payload = Buffer.from(JSON.stringify({ uid, service, ts: Date.now(), returnBase })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyState(state: string): { uid: string; service: GoogleService; returnBase: string } | null {
  try {
    const secret = GOOGLE_OAUTH_STATE_SECRET.value();
    const dot = state.lastIndexOf(".");
    if (dot < 0) return null;
    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);

    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid: string;
      service: GoogleService;
      ts: number;
      returnBase?: string;
    };

    if (Date.now() - parsed.ts > 15 * 60_000) return null; // 15 min window

    // Fall back to WEB_BASE_URL for state tokens created before this change
    const returnBase = String(parsed.returnBase || WEB_BASE_URL.value() || "").replace(/\/+$/, "");
    return { uid: parsed.uid, service: parsed.service, returnBase };
  } catch {
    return null;
  }
}

// -- Scope map ----------------------------------------------------------------

const SERVICE_SCOPES: Record<GoogleService, string[]> = {
  googleCalendar: [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
  googleDrive: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
};

function oauthErrorDetails(err: unknown): Record<string, unknown> {
  const anyErr = err as {
    message?: unknown;
    code?: unknown;
    response?: {
      status?: unknown;
      statusText?: unknown;
      data?: {
        error?: unknown;
        error_description?: unknown;
        error_uri?: unknown;
      };
    };
  };
  const data = anyErr?.response?.data;
  return {
    message: typeof anyErr?.message === "string" ? anyErr.message : String(err),
    code: anyErr?.code,
    status: anyErr?.response?.status,
    statusText: anyErr?.response?.statusText,
    oauthError: data?.error,
    oauthErrorDescription: data?.error_description,
    oauthErrorUri: data?.error_uri,
  };
}

// -- Connect start - generates OAuth URL --------------------------------------

function makeConnectStart(service: GoogleService) {
  return secureHandler(
    async (req: AuthedRequest, res) => {
      const uid = req.user!.uid!;

      // Encode the originating app URL in the state so the callback redirects back to the right app
      const rawOrigin = String(req.headers.origin || req.headers.referer || "").trim();
      const returnBase = originOf(rawOrigin) || String(WEB_BASE_URL.value() || "").replace(/\/+$/, "");

      const { google } = await import("googleapis");
      const oAuth2 = new google.auth.OAuth2(
        GOOGLE_OAUTH_CLIENT_ID.value(),
        GOOGLE_OAUTH_CLIENT_SECRET.value(),
        GOOGLE_OAUTH_REDIRECT_URI.value(),
      );

      const authUrl = oAuth2.generateAuthUrl({
        access_type: "offline",
        include_granted_scopes: true,
        prompt: "consent", // force refresh_token issuance every time
        scope: SERVICE_SCOPES[service],
        state: buildState(uid, service, returnBase),
        response_type: "code",
      });

      res.json({ ok: true, service, authUrl });
    },
    {
      auth: "user",
      methods: ["POST", "OPTIONS"],
      secrets: GOOGLE_SECRETS,
      memory: "512MiB",
    },
  );
}

export const calendarConnectStart = makeConnectStart("googleCalendar");
export const driveConnectStart    = makeConnectStart("googleDrive");

// -- OAuth callback - shared for all services ---------------------------------
// Google redirects here after user approves (or denies) the consent screen.
// This is a GET handler - not a JSON API call. Responds with a 302 redirect.

export const googleOAuthCallback = onRequest(
  {
    region: RUNTIME.region,
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_STATE_SECRET],
    memory: "512MiB",
    concurrency: 20,
  },
  async (req, res) => {
    // Fallback URL used only for pre-state-verification error redirects
    const fallbackBase = String(WEB_BASE_URL.value() || "https://housing-db-v2.web.app").replace(/\/+$/, "");

    // -- Error from Google (user denied) --------------------------------------
    if (req.query.error) {
      logger.info("OAuth callback: user denied", { error: req.query.error });
      res.redirect(`${fallbackBase}/settings?calendar=denied`);
      return;
    }

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");

    if (!code || !state) {
      res.redirect(`${fallbackBase}/settings?calendar=error&msg=missing_params`);
      return;
    }

    // -- Verify CSRF state ----------------------------------------------------
    const verified = verifyState(state);
    if (!verified) {
      logger.warn("OAuth callback: invalid or expired state");
      res.redirect(`${fallbackBase}/settings?calendar=error&msg=state_invalid`);
      return;
    }

    // returnBase is the originating app URL (mobile or web), embedded in the signed state
    const { uid, service, returnBase } = verified;
    const settingsUrl = `${returnBase}/settings`;

    try {
      // -- Exchange code for tokens -------------------------------------------
      const { oAuth2, tokens } = await exchangeCode(code);

      if (!tokens.refresh_token) {
        // This happens when Google omits the refresh_token because prompt!=consent
        // or the user has already granted access previously without revoking.
        // We fall back to updating only the access token if we have an existing record.
        const existing = await readToken(uid, service);
        if (!existing?.refreshToken) {
          logger.warn("OAuth callback: no refresh_token returned and no existing token", { uid, service });
          res.redirect(`${settingsUrl}?calendar=error&msg=no_refresh_token&service=${service}`);
          return;
        }
        // Patch access token only
        await writeToken(uid, service, {
          ...existing,
          accessToken: tokens.access_token ?? null,
          accessTokenExpiresAt: tokens.expiry_date ?? null,
          updatedAt: Date.now(),
          status: "active",
        });
        await writePublicMeta(uid, service, tokenToPublicMeta({ ...existing, status: "active" }));
        res.redirect(`${settingsUrl}?calendar=connected&service=${service}`);
        return;
      }

      // -- Get Google account email -------------------------------------------
      oAuth2.setCredentials(tokens);
      let googleEmail = "";
      try {
        googleEmail = await getGoogleEmail(oAuth2 as any);
      } catch {
        // email is nice-to-have; don't fail the flow
      }

      // -- Store token record -------------------------------------------------
      const now = Date.now();
      const record: GoogleTokenRecord = {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token ?? null,
        accessTokenExpiresAt: tokens.expiry_date ?? null,
        googleEmail,
        googleSub: "",   // populated if needed via userinfo.sub
        // Store what Google actually granted, not what we requested.
        // Google returns granted scopes in tokens.scope (space-delimited).
        scopes: tokens.scope
          ? tokens.scope.split(/\s+/).map((s) => s.trim()).filter(Boolean)
          : SERVICE_SCOPES[service],
        status: "active",
        connectedAt: now,
        updatedAt: now,
      };

      const missingScopes = SERVICE_SCOPES[service].filter((s) => !record.scopes.includes(s));
      if (missingScopes.length) {
        logger.warn("OAuth callback: user did not grant all requested scopes", {
          uid, service, missingScopes, granted: record.scopes,
        });
      }

      await writeToken(uid, service, record);
      await writePublicMeta(uid, service, tokenToPublicMeta(record));

      logger.info("OAuth callback: token stored", { uid, service, googleEmail, scopeCount: record.scopes.length });
      res.redirect(`${settingsUrl}?calendar=connected&service=${service}`);
    } catch (err) {
      logger.error("OAuth callback: token exchange failed", { uid, service, ...oauthErrorDetails(err) });
      res.redirect(`${settingsUrl}?calendar=error&msg=exchange_failed&service=${service}`);
    }
  },
);

// -- Disconnect ---------------------------------------------------------------

function makeDisconnect(service: GoogleService) {
  return secureHandler(
    async (req: AuthedRequest, res) => {
      const uid = req.user!.uid!;
      try {
        const record = await readToken(uid, service);
        if (record?.refreshToken) {
          await revokeToken(record.refreshToken);
        }
      } catch {
        // revocation is best-effort
      }

      await clearToken(uid, service);
      await writePublicMeta(uid, service, {
        connected: false,
        permissionStatus: "disconnected",
        updatedAt: isoNow(),
      });

      res.json({ ok: true, service, connected: false, permissionStatus: "disconnected" });
    },
    {
      auth: "user",
      methods: ["POST", "OPTIONS"],
      secrets: GOOGLE_SECRETS,
      memory: "512MiB",
    },
  );
}

export const calendarDisconnect = makeDisconnect("googleCalendar");
export const driveDisconnect    = makeDisconnect("googleDrive");

// -- Get connection status ----------------------------------------------------

function makeGetStatus(service: GoogleService) {
  return secureHandler(
    async (req: AuthedRequest, res) => {
      const uid = req.user!.uid!;
      const record = await readToken(uid, service);
      if (!record) {
        res.json({ ok: true, service, connected: false, permissionStatus: "disconnected" });
        return;
      }
      res.json({
        ok: true,
        service,
        connected: record.status === "active",
        googleEmail: record.googleEmail,
        scopes: record.scopes,
        connectedAt: new Date(record.connectedAt).toISOString(),
        accessTokenExpiresAt: record.accessTokenExpiresAt
          ? new Date(record.accessTokenExpiresAt).toISOString()
          : null,
        // Map to the client-facing enum ("connected"/"needs_reconnect"/…). The raw
        // record status ("active") is NOT a member of GooglePermissionStatus, so a
        // strict `permissionStatus === "connected"` check (mobile) would otherwise
        // always read as disconnected even with a live token.
        permissionStatus: recordStatusToPermissionStatus(record.status),
      });
    },
    { auth: "user", methods: ["GET", "POST", "OPTIONS"], secrets: GOOGLE_SECRETS, memory: "512MiB" },
  );
}

export const calendarStatus = makeGetStatus("googleCalendar");
export const driveStatus    = makeGetStatus("googleDrive");
