// functions/src/core/roles.ts
//
// DEPRECATED COMPAT LAYER.
// Do not use for backend authorization.
// Use core/rbac.ts requireLevel / isAdmin / isDev etc instead.

import type { Claims } from "./rbac";
import {
  topRoleFromClaims,
  roleTagsFromClaims,
  hasLevel,
  isAdmin as isAdminRBAC,
  isDev as isDevRBAC,
  isUnverified as isUnverifiedRBAC,
} from "./rbac";
import { normTok } from "./norm";

type LegacyClaims = {
  [k: string]: unknown;
  role?: string;
  roles?: string[];
  admin?: boolean;
  topRole?: string;
  uid?: string;
};

/** Build a safe Claims-like view from legacy shapes. */
function toSafeClaims(c: LegacyClaims): Claims {
  if (!c) return {} as Claims;

  const out: Claims = { ...c };

  // Legacy admin boolean -> topRole admin if not already set.
  if (!out.topRole && c.admin === true) out.topRole = "admin";

  // Legacy single `role`
  if (typeof c.role === "string" && c.role.trim()) {
    const r = normTok(c.role);
    // If it looks like a ladder token, treat as topRole.
    if (["admin", "dev", "orgdev", "superdev", "user", "publicuser", "unverified"].includes(r)) {
      out.topRole = out.topRole || c.role;
    } else {
      out.roles = Array.isArray(out.roles) ? [...out.roles, c.role] : [c.role];
    }
  }

  return out;
}

/**
 * Back-compat rolesFromClaims:
 * returns [topRole, ...tags] in normalized form.
 */
export function rolesFromClaims(c: LegacyClaims): string[] {
  const safe = toSafeClaims(c);
  const tr = topRoleFromClaims(safe);
  const tags = roleTagsFromClaims(safe);
  const out: string[] = [];
  if (tr) out.push(tr);
  out.push(...tags);
  return Array.from(new Set(out));
}

/**
 * hasRole:
 * - ladder roles resolved via RBAC level/topRole
 * - tags via safe tag list
 */
export function hasRole(c: LegacyClaims, role: string) {
  const safe = toSafeClaims(c);
  const want = normTok(role);

  if (!want) return false;

  if (want === "dev") return hasLevel(safe, "dev");
  if (want === "admin") return hasLevel(safe, "admin");
  if (want === "user") return hasLevel(safe, "user");
  if (want === "unverified" || want === "publicuser") return isUnverifiedRBAC(safe);

  return roleTagsFromClaims(safe).includes(want);
}

export function requireRole(c: LegacyClaims, role: string) {
  if (!hasRole(c, role)) {
    const err = new Error("forbidden") as Error & { code: number };
    err.code = 403;
    throw err;
  }
}

export function isAdmin(c: LegacyClaims) {
  return isAdminRBAC(toSafeClaims(c));
}

export function isDev(c: LegacyClaims) {
  return isDevRBAC(toSafeClaims(c));
}

export function isUnverified(c: LegacyClaims) {
  return isUnverifiedRBAC(toSafeClaims(c));
}

export function isVerified(c: LegacyClaims) {
  const safe = toSafeClaims(c);
  return safe.uid ? !isUnverifiedRBAC(safe) : false;
}
