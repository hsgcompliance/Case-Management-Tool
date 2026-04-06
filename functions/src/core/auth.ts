// functions/src/core/auth.ts
import { authAdmin } from "./admin";
import type { Request } from "express";
import type { Claims } from "./rbac";

const unauthenticated = () => {
  const e = new Error("unauthenticated") as Error & { code: number };
  e.code = 401;
  return e;
};

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

  try {
    const dec = await authAdmin.verifyIdToken(token, true);
    const uid = dec.uid;
    if (!uid) return dec as Claims;

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
      return dec as Claims;
    }
  } catch {
    throw unauthenticated();
  }
}

/** Legacy helper: keep name but reuse canonical logic. */
export async function requireUser(req: Request): Promise<Claims> {
  return verifyUserFromRequest(req);
}
