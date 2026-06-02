/**
 * Server-side token record for a user's Google OAuth integration.
 * Stored in: userSecrets/{uid}/integrations/{service}
 * Never exposed to clients. Cloud Functions access only.
 *
 * TODO: encrypt refreshToken and accessToken at rest using Cloud KMS or a
 * symmetric key stored in Secret Manager before storing in Firestore.
 */
export interface GoogleTokenRecord {
  // TODO: encrypt before storing — plaintext only while prototyping
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: number | null; // epoch ms
  googleEmail: string;
  googleSub: string;                   // Google user ID — for revocation
  scopes: string[];
  status: "active" | "needs_reconnect" | "revoked" | "error";
  connectedAt: number; // epoch ms
  updatedAt: number;
  revokedAt?: number;
  errorMessage?: string;
}

export type GoogleService = "googleCalendar" | "googleDrive";

/** Safe public metadata written to userExtras.integrations.{service} */
export interface GoogleIntegrationMeta {
  connected: boolean;
  googleEmail?: string;
  scopes?: string[];
  connectedAt?: string;           // ISO
  updatedAt?: string;             // ISO
  lastSyncAt?: string;            // ISO
  accessTokenExpiresAt?: string;  // ISO
  permissionStatus: "connected" | "needs_reconnect" | "revoked" | "error" | "disconnected";
}

/** Structured error codes returned to clients */
export type CalendarErrorCode =
  | "calendar_not_connected"
  | "calendar_needs_reconnect"
  | "calendar_permission_denied"
  | "calendar_api_disabled"
  | "calendar_token_refresh_failed"
  | "drive_not_connected"
  | "drive_needs_reconnect"
  | "drive_token_refresh_failed"
  | "oauth_state_invalid"
  | "oauth_state_expired"
  | "oauth_code_exchange_failed"
  | "unknown";
