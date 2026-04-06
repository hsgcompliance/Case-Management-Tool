// functions/src/core/session.ts
import {authAdmin} from "./admin";

const DAY = 24 * 60 * 60 * 1000;

/** Exchange a client ID token for a short-lived session cookie */
export async function createSessionCookie(idToken: string, days = 5) {
  const expiresIn = Math.min(days * DAY, 14 * DAY); // Firebase max 14 days
  return authAdmin.createSessionCookie(idToken, {expiresIn});
}

/** Verify a session cookie (strict), return decoded claims */
export async function verifySessionCookie(cookie: string, checkRevocation = true) {
  return authAdmin.verifySessionCookie(cookie, checkRevocation);
}
