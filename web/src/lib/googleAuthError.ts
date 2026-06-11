"use client";

// Detects Google OAuth credential failures that surface through backend
// Drive / Sheets / Calendar endpoints. When a user's stored per-user Google
// token is expired or revoked, Google rejects the request with the canonical
// message:
//   "Request had invalid authentication credentials. Expected OAuth 2 access
//    token, login cookie or other valid authentication credential.
//    See https://developers.google.com/identity/sign-in/web/devconsole-project."
//
// We treat this as a soft "reconnect Google" signal — never a hard failure —
// so the UI can show a Settings/reconnect affordance and a clean toast instead
// of leaking the raw Google error string to users.

const REAUTH_PATTERNS: RegExp[] = [
  /invalid authentication credentials/i,
  /expected oauth\s*2/i,
  /login cookie/i,
  /invalid[_\s-]?grant/i,
  /token (?:has been )?(?:expired|revoked)/i,
  /devconsole-project/i, // the Google help URL embedded in the canonical message
];

/** Clean, user-facing toast text for an expired Google session. */
export const GOOGLE_REAUTH_TOAST =
  "Google access expired — please reconnect Google in Settings.";

/**
 * Structured issue consumed by DriveAuthBanner / WorkbookStructuredView to
 * render the "needs reconnection" variant (Reconnect + Settings buttons).
 */
export const GOOGLE_REAUTH_ISSUE = {
  error: "google_session_expired",
  category: "needs_reconnect" as const,
  reconnectService: "googleDrive" as const,
  hint: "Your Google sign-in expired. Reconnect Google to load workbook content — you can still open the sheet directly.",
};

function scan(value: unknown, depth = 0): boolean {
  if (value == null || depth > 5) return false;
  if (typeof value === "string") return REAUTH_PATTERNS.some((re) => re.test(value));
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => scan(v, depth + 1));
  const o = value as Record<string, unknown>;
  // Walk the shapes the api client uses: Error.message, { ok:false, error },
  // and the thrown error's e.meta.response wrapper.
  for (const k of ["message", "error", "msg", "detail", "reason", "hint", "response", "data", "body", "meta", "cause"]) {
    if (k in o && scan(o[k], depth + 1)) return true;
  }
  return false;
}

/**
 * True when an error object / response body / message string indicates an
 * expired or invalid Google OAuth credential (vs. "never connected", which is
 * handled separately as a not_connected issue).
 */
export function isGoogleReauthError(input: unknown): boolean {
  return scan(input);
}
