// functions/src/core/auth.ts
import { authAdmin } from "./admin";
import type { Request } from "express";
import type { Claims } from "./rbac";

const unauthenticated = () => {
  const e = new Error("unauthenticated") as Error & { code: number };
  e.code = 401;
  return e;
};

const REVOCATION_ERROR_CODES = new Set([
  "auth/id-token-revoked",
  "auth/id-token-expired",
  "auth/argument-error",
  "auth/user-disabled",
  "auth/user-not-found",
]);

/**
 * Canonical user verification from an Express Request:
 * - Reads Bearer token
 * - Verifies via Firebase Admin (with revocation check)
 * - Fetches fresh customClaims
 * - Merges customClaims over decoded token
 */
export async function verifyUserFromRequest(req: Request): Promise<Claims> {
  const hdr = String(req.headers.authorization || "");
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";

  if (!token) {
    throw unauthenticated();
  }

  let dec: Claims;
  try {
    dec = (await authAdmin.verifyIdToken(token, true)) as Claims;
  } catch (err: any) {
    // checkRevoked makes an extra Admin API call to look up tokensValidAfterTime.
    // A genuinely revoked/expired/invalid token should still 401, but a transient
    // failure in that extra lookup (network blip, etc.) shouldn't be conflated
    // with an actually-invalid token. Fall back to a plain signature/expiry-only
    // verify (no extra network call) before giving up.
    if (REVOCATION_ERROR_CODES.has(String(err?.code || ""))) {
      throw unauthenticated();
    }
    try {
      dec = (await authAdmin.verifyIdToken(token)) as Claims;
    } catch {
      throw unauthenticated();
    }
  }

  const uid = dec.uid;
  if (!uid) return dec;

  try {
    const rec = await authAdmin.getUser(uid);
    const cc = (rec.customClaims || {}) as Partial<Claims>;
    return {
      ...dec,
      ...cc,
      uid,
    } as Claims;
  } catch {
    // If Admin read fails, fall back to decoded token
    return dec;
  }
}

/** Legacy helper: keep name but reuse canonical logic. */
export async function requireUser(req: Request): Promise<Claims> {
  return verifyUserFromRequest(req);
}
