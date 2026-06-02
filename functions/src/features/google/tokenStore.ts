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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    permissionStatus: record.status === "active"
      ? "connected"
      : record.status === "revoked"
        ? "revoked"
        : "needs_reconnect",
  };
}
