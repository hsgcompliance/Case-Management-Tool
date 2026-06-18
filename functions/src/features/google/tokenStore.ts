/**
 * Server-side token storage for Google OAuth integrations.
 * Private path: userSecrets/{uid}/integrations/{service}
 * Public metadata path: userExtras/{uid}.integrations.{service}
 *
 * Firestore rules must deny ALL client access to the userSecrets collection.
 */
import admin from "../../core/admin";
import type { GoogleTokenRecord, GoogleService, GoogleIntegrationMeta } from "./types";

// ── Private token store (server-only) ────────────────────────────────────────

function privateRef(uid: string, service: GoogleService) {
  return admin
    .firestore()
    .collection("userSecrets")
    .doc(uid)
    .collection("integrations")
    .doc(service);
}

export async function readToken(uid: string, service: GoogleService): Promise<GoogleTokenRecord | null> {
  const snap = await privateRef(uid, service).get();
  if (!snap.exists) return null;
  return snap.data() as GoogleTokenRecord;
}

export async function writeToken(uid: string, service: GoogleService, record: GoogleTokenRecord): Promise<void> {
  await privateRef(uid, service).set(record);
}

export async function patchToken(uid: string, service: GoogleService, patch: Partial<GoogleTokenRecord>): Promise<void> {
  await privateRef(uid, service).set(patch, { merge: true });
}

export async function clearToken(uid: string, service: GoogleService): Promise<void> {
  await privateRef(uid, service).delete();
}

// ── Public metadata (userExtras.integrations.{service}) ──────────────────────

function publicRef(uid: string) {
  return admin.firestore().collection("userExtras").doc(uid);
}

export async function writePublicMeta(
  uid: string,
  service: GoogleService,
  meta: GoogleIntegrationMeta,
): Promise<void> {
  await publicRef(uid).set(
    { integrations: { [service]: meta } },
    { merge: true },
  );
}

export async function readPublicMeta(
  uid: string,
  service: GoogleService,
): Promise<GoogleIntegrationMeta | null> {
  const snap = await publicRef(uid).get();
  return (snap.data()?.integrations?.[service] as GoogleIntegrationMeta) ?? null;
}

// ── Scope helpers ─────────────────────────────────────────────────────────────

export const SCOPE_DISPLAY_NAMES: Record<string, string> = {
  "https://www.googleapis.com/auth/drive":                    "Google Drive file access",
  "https://www.googleapis.com/auth/drive.file":               "Google Drive file access",
  "https://www.googleapis.com/auth/drive.readonly":           "Google Drive read access",
  "https://www.googleapis.com/auth/spreadsheets":             "Google Sheets access",
  "https://www.googleapis.com/auth/spreadsheets.readonly":    "Google Sheets read access",
  "https://www.googleapis.com/auth/calendar.events":          "Google Calendar access",
  "https://www.googleapis.com/auth/calendar.events.readonly": "Google Calendar read access",
};

export type MissingScopesInfo = {
  missingScopes: string[];
  missingPermissions: string[];
};

/**
 * Checks whether the stored token for a user/service is missing any of the
 * required scopes. Returns null when all scopes are present or when no token
 * exists (no token = not connected, not a scope error — callers handle that
 * separately). Returns MissingScopesInfo when scopes are stored but incomplete.
 */
export async function getMissingScopes(
  uid: string,
  service: GoogleService,
  requiredScopes: string[],
): Promise<MissingScopesInfo | null> {
  const record = await readToken(uid, service);
  if (!record?.scopes?.length) return null; // not connected — not a scope error
  const missing = requiredScopes.filter((s) => !record.scopes.includes(s));
  if (!missing.length) return null;
  const seen = new Set<string>();
  const missingPermissions = missing
    .map((s) => SCOPE_DISPLAY_NAMES[s] ?? s)
    .filter((name) => (seen.has(name) ? false : (seen.add(name), true)));
  return { missingScopes: missing, missingPermissions };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Map the internal token record status to the client-facing permissionStatus
 * enum (GoogleIntegrationMeta["permissionStatus"]). The raw record status value
 * ("active") is NOT a member of that enum — clients key off "connected". This is
 * the single source of truth so the status endpoint and the public metadata
 * always agree (web tolerates either, mobile keys strictly off this value).
 */
export function recordStatusToPermissionStatus(
  status: GoogleTokenRecord["status"],
): GoogleIntegrationMeta["permissionStatus"] {
  switch (status) {
    case "active":   return "connected";
    case "revoked":  return "revoked";
    case "error":    return "error";
    default:         return "needs_reconnect";
  }
}

export function tokenToPublicMeta(record: GoogleTokenRecord): GoogleIntegrationMeta {
  return {
    connected: record.status === "active",
    googleEmail: record.googleEmail,
    scopes: record.scopes,
    connectedAt: new Date(record.connectedAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
    accessTokenExpiresAt: record.accessTokenExpiresAt
      ? new Date(record.accessTokenExpiresAt).toISOString()
      : undefined,
    permissionStatus: recordStatusToPermissionStatus(record.status),
  };
}
