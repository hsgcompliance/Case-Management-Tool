// functions/src/core/requestContext.ts
import type { Request } from "express";
import type { Claims } from "./rbac";
import { isSuperDev } from "./rbac";
import { orgIdFromClaims, teamIdsFromClaims, hasTeamAccess } from "./org";

/** Auth context derived from decoded Firebase ID token + custom claims. */
export interface AuthContext extends Claims {
  uid?: string;
  orgId?: string | null;
  teamIds?: string[];
}

/** Express Request with our standard auth fields attached by secureHandler. */
export interface AuthedRequest<C extends AuthContext = AuthContext> extends Request {
  user?: C;
  uid?: string | null;
  orgId?: string | null;
  teamIds?: string[];
  __revoked?: boolean;
}

type AuthLike = Partial<AuthContext> & { user?: Partial<AuthContext> };

const asAuthLike = (src: Request | AuthContext | Claims): AuthLike => {
  const base = src as AuthLike;
  return (base.user && typeof base.user === "object" ? base.user : base) as AuthLike;
};

const mkErr = (message: string, code: number): Error & { code: number } => {
  const e = new Error(message) as Error & { code: number };
  e.code = code;
  return e;
};

/** Build a normalized AuthContext from decoded token/custom-claims object. */
export function buildAuthContext(raw: unknown): AuthContext {
  const claims = (raw || {}) as Claims;
  const orgId = orgIdFromClaims(claims);
  const teamIds = teamIdsFromClaims(claims);
  const uid = claims?.uid ? String(claims.uid) : undefined;

  return {
    ...claims,
    uid,
    orgId,
    teamIds,
  };
}

/**
 * Attach auth context to an Express request in a consistent way.
 * Returns the normalized AuthContext for convenience.
 */
export function attachAuthContext(req: Request, raw: unknown): AuthContext {
  const ctx = buildAuthContext(raw);
  const r = req as AuthedRequest;

  r.user = ctx;
  r.uid = ctx.uid ?? null;
  r.orgId = ctx.orgId ?? null;
  r.teamIds = Array.isArray(ctx.teamIds) ? ctx.teamIds : [];

  return ctx;
}

/** Best-effort read of AuthContext from a Request (may return null on public routes). */
export function getAuthContext(req: Request): AuthContext | null {
  const r = req as AuthedRequest;
  const user = (r.user || null) as AuthContext | null;
  if (user) return user;

  const uid = r.uid ?? null;
  const orgId = r.orgId ?? null;
  const teamIds: string[] = Array.isArray(r.teamIds) ? r.teamIds : [];

  if (!uid && !orgId && !teamIds.length) return null;

  return {
    uid: uid || undefined,
    orgId,
    teamIds,
  } as AuthContext;
}

/** Require an authenticated context; throws 401 "auth_required" otherwise. */
export function requireAuthContext(req: Request): AuthContext {
  const ctx = getAuthContext(req);
  if (!ctx || !ctx.uid) {
    throw mkErr("auth_required", 401);
  }
  return ctx;
}

/** Require uid either from a Request or from a Claims/AuthContext object. */
export function requireUid(src: Request | AuthContext | Claims): string {
  const auth = asAuthLike(src);
  const uid = auth.uid ?? auth.user?.uid;
  if (!uid) {
    throw mkErr("auth_required", 401);
  }
  return String(uid);
}

/** Get orgId (or null) from Request or Claims/AuthContext. */
export function getOrgId(src: Request | AuthContext | Claims): string | null {
  const claims = asAuthLike(src) as Claims;
  return orgIdFromClaims(claims);
}

/** Require orgId; throws 403 "missing_org" if none is present. */
export function requireOrgId(src: Request | AuthContext | Claims): string {
  const claims = asAuthLike(src) as Claims;
  const orgId = orgIdFromClaims(claims);
  if (!orgId) {
    throw mkErr("missing_org", 403);
  }
  return orgId;
}

/** Get teamIds (always normalized, may be empty). */
export function getTeamIds(src: Request | AuthContext | Claims): string[] {
  const claims = asAuthLike(src) as Claims;
  return teamIdsFromClaims(claims);
}

/** True if user can access doc via org or team overlap. */
export function canAccessDoc(
  src: Request | AuthContext | Claims,
  doc: { orgId?: unknown; orgID?: unknown; organizationId?: unknown; org?: unknown; teamIds?: unknown }
): boolean {
  const claims = asAuthLike(src) as Claims;

  const docOrg = doc.orgId ?? doc.orgID ?? doc.organizationId ?? doc.org ?? null;
  const docTeams = doc.teamIds ?? [];

  return hasTeamAccess(claims, docTeams, docOrg);
}

/**
 * Enforce requester org matches doc org when doc org exists.
 * Legacy docs without orgId remain accessible.
 *
 * NOTE: This mirrors the current assertOrgAccess behavior but adds a 403 code.
 */
export function assertOrgAccess(
  src: Request | AuthContext | Claims,
  doc: { orgId?: unknown; orgID?: unknown; organizationId?: unknown; org?: unknown }
) {
  const claims = asAuthLike(src) as Claims;
  if (isSuperDev(claims)) return;

  const uOrg = orgIdFromClaims(claims);
  const dOrg =
    doc.orgId ??
    doc.orgID ??
    doc.organizationId ??
    doc.org ??
    null;

  if (!dOrg) return; // legacy/unscoped
  if (!uOrg) {
    throw mkErr("forbidden_org", 403);
  }
  if (String(uOrg) !== String(dOrg)) {
    throw mkErr("forbidden_org", 403);
  }
}

/**
 * Same as assertOrgAccess, but no-ops for system/scheduled calls
 * where we don't have uid or org scope.
 */
export function assertOrgAccessMaybe(
  src: Request | AuthContext | Claims,
  doc: { orgId?: unknown; orgID?: unknown; organizationId?: unknown; org?: unknown }
) {
  const claims = asAuthLike(src) as Claims;

  if (!claims?.uid && !orgIdFromClaims(claims)) return;
  return assertOrgAccess(claims, doc);
}
