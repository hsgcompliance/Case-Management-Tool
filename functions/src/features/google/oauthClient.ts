/**
 * Builds a Google OAuth2 client for a user, loading their stored token and
 * auto-refreshing the access token when expired. Writes updated tokens back
 * to the private store automatically via the googleapis "tokens" event.
 */
import * as logger from "firebase-functions/logger";
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } from "../../core/env";
import { readToken, patchToken, writePublicMeta, tokenToPublicMeta } from "./tokenStore";
import type { GoogleService } from "./types";

let googleapisPromise: Promise<typeof import("googleapis")> | null = null;
async function getGoogle() {
  googleapisPromise ||= import("googleapis");
  return googleapisPromise;
}

export type OAuthBuildResult =
  | { ok: true; auth: import("googleapis").Auth.OAuth2Client }
  | { ok: false; code: "not_connected" | "needs_reconnect" | "token_refresh_failed" };

/**
 * Builds an authenticated OAuth2 client for the given user and service.
 * If the stored access token is expired, googleapis will refresh it automatically
 * and fire the "tokens" event — we write the new token back to the private store.
 */
export async function buildOAuthClient(
  uid: string,
  service: GoogleService,
): Promise<OAuthBuildResult> {
  const { google } = await getGoogle();

  const record = await readToken(uid, service);
  if (!record) return { ok: false, code: "not_connected" };
  if (record.status === "revoked") return { ok: false, code: "needs_reconnect" };
  if (!record.refreshToken) return { ok: false, code: "needs_reconnect" };

  const oAuth2 = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID.value(),
    GOOGLE_OAUTH_CLIENT_SECRET.value(),
    GOOGLE_OAUTH_REDIRECT_URI.value(),
  );

  oAuth2.setCredentials({
    refresh_token: record.refreshToken,
    access_token: record.accessToken ?? undefined,
    expiry_date: record.accessTokenExpiresAt ?? undefined,
  });

  // When googleapis silently refreshes the token, persist the new one
  oAuth2.on("tokens", (tokens) => {
    const patch: Parameters<typeof patchToken>[2] = {
      accessToken: tokens.access_token ?? null,
      accessTokenExpiresAt: tokens.expiry_date ?? null,
      updatedAt: Date.now(),
      status: "active",
    };
    if (tokens.refresh_token) patch.refreshToken = tokens.refresh_token;

    Promise.all([
      patchToken(uid, service, patch),
      patchToken(uid, service, {}).then(() =>
        readToken(uid, service).then((r) => {
          if (r) return writePublicMeta(uid, service, tokenToPublicMeta({ ...r, ...patch }));
        }),
      ),
    ]).catch((err) => logger.warn("Token refresh write-back failed", { uid, service, err }));
  });

  return { ok: true, auth: oAuth2 };
}

/**
 * Call this when a Google API returns 401 (invalid_grant, token revoked, etc).
 * Updates the stored token status so the UI can prompt re-connection.
 */
export async function markTokenRevoked(uid: string, service: GoogleService): Promise<void> {
  try {
    const now = Date.now();
    await patchToken(uid, service, { status: "needs_reconnect", updatedAt: now });
    const record = await readToken(uid, service);
    if (record) {
      await writePublicMeta(uid, service, tokenToPublicMeta({ ...record, status: "needs_reconnect", updatedAt: now }));
    }
  } catch (err) {
    logger.warn("markTokenRevoked: write failed", { uid, service, err: String(err) });
  }
}

/**
 * Exchange an authorization code for tokens (used in the OAuth callback).
 * Returns the token set on success.
 */
export async function exchangeCode(
  code: string,
): Promise<{ oAuth2: import("googleapis").Auth.OAuth2Client; tokens: import("googleapis").Auth.Credentials }> {
  const { google } = await getGoogle();
  const oAuth2 = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID.value(),
    GOOGLE_OAUTH_CLIENT_SECRET.value(),
    GOOGLE_OAUTH_REDIRECT_URI.value(),
  );
  const { tokens } = await oAuth2.getToken(code);
  return { oAuth2, tokens };
}

/**
 * Get the Google account email for a freshly-issued token set.
 */
export async function getGoogleEmail(auth: import("googleapis").Auth.OAuth2Client): Promise<string> {
  const { google } = await getGoogle();
  const oauth2 = google.oauth2({ version: "v2", auth });
  const { data } = await oauth2.userinfo.get();
  return data.email ?? "";
}

/**
 * Revoke a refresh token via Google's revocation endpoint.
 */
export async function revokeToken(refreshToken: string): Promise<void> {
  const { google } = await getGoogle();
  const oAuth2 = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID.value(),
    GOOGLE_OAUTH_CLIENT_SECRET.value(),
  );
  await oAuth2.revokeToken(refreshToken).catch(() => {
    // Revocation failure is non-fatal — token may already be invalid
  });
}
