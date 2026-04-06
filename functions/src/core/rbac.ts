// functions/src/core/rbac.ts
import { normTok } from "./norm";
export type Claims = {
  [k: string]: unknown;
  uid?: string;

  /** Highest ladder role. Backend-authoritative. */
  topRole?: string;

  /** FE-only tags. NEVER elevate backend power. */
  roles?: string[];

  /** Explicit caps (rare; backend-owned). */
  caps?: string[];
};

export type RoleLevel = "public" | "authed" | "user" | "admin" | "dev";

/** Canonical ladder roles (normalized). */
const TOP_ROLES = {
  UNVERIFIED: normTok("unverified"),
  PUBLIC_USER: normTok("public_user"),
  USER: normTok("user"),
  ADMIN: normTok("admin"),
  DEV: normTok("dev"),
  ORG_DEV: normTok("org_dev"),
  SUPER_DEV: normTok("super_dev"),
} as const;

const LADDER_SET = new Set<string>([
  TOP_ROLES.UNVERIFIED,
  TOP_ROLES.PUBLIC_USER,
  TOP_ROLES.USER,
  TOP_ROLES.ADMIN,
  TOP_ROLES.DEV,
  TOP_ROLES.ORG_DEV,
  TOP_ROLES.SUPER_DEV,
  normTok("public"),
  normTok("authed"),
]);

/**
 * Authoritative topRole.
 * Rule: if user is authed but topRole missing -> treat as unverified.
 */

const TOP_ROLE_SET = new Set<string>(Object.values(TOP_ROLES));

export function topRoleFromClaims(c: Claims): string {
  if (!c?.uid) return "";
  const tr = normTok(c.topRole);

  // Only accept known ladder roles; anything else becomes unverified.
  if (!tr || !TOP_ROLE_SET.has(tr)) return TOP_ROLES.UNVERIFIED;

  return tr;
}

/**
 * FE tags from roles[].
 * Rule: strip ladder-like tokens so roles[] can never escalate power.
 */
export function roleTagsFromClaims(c: Claims): string[] {
  if (!c) return [];
  const raw = Array.isArray(c.roles) ? c.roles : [];
  const tags = raw
    .map(normTok)
    .filter(Boolean)
    .filter((t) => !LADDER_SET.has(t));
  return Array.from(new Set(tags));
}

/**
 * Back-compat "rolesFromClaims":
 * returns [topRole, ...tags] normalized.
 * NOTE: do NOT use this for authorization decisions; use hasLevel/requireLevel.
 */
export function rolesFromClaims(c: Claims): string[] {
  if (!c) return [];
  const out: string[] = [];
  const tr = topRoleFromClaims(c);
  if (tr) out.push(tr);
  out.push(...roleTagsFromClaims(c));
  return Array.from(new Set(out));
}

/* ---------------- Ladder helpers (authoritative) ---------------- */

export function isAdmin(c: Claims) {
  const tr = topRoleFromClaims(c);
  return tr === TOP_ROLES.ADMIN;
}

export function isDev(c: Claims) {
  const tr = topRoleFromClaims(c);
  return (
    tr === TOP_ROLES.SUPER_DEV ||
    tr === TOP_ROLES.ORG_DEV ||
    tr === TOP_ROLES.DEV
  );
}

export function isOrgDev(c: Claims) {
  const tr = topRoleFromClaims(c);
  return tr === TOP_ROLES.ORG_DEV;
}

export function isSuperDev(c: Claims) {
  const tr = topRoleFromClaims(c);
  return tr === TOP_ROLES.SUPER_DEV;
}

export function isUnverified(c: Claims) {
  const tr = topRoleFromClaims(c);
  return tr === TOP_ROLES.UNVERIFIED || tr === TOP_ROLES.PUBLIC_USER || tr === "";
}

export function isBlockedRole(c: Claims) {
  // "blocked" == authed but not verified (or missing topRole)
  const tr = topRoleFromClaims(c);
  return tr === "" || tr === TOP_ROLES.UNVERIFIED || tr === TOP_ROLES.PUBLIC_USER;
}

export function isVerified(c: Claims) {
  return !isBlockedRole(c);
}

/* ---------------- Level ladder (public < authed < user < admin < dev) ---------------- */

const LEVEL_RANK: Record<RoleLevel, number> = {
  public: 0,
  authed: 1,
  user: 2,
  admin: 3,
  dev: 4,
};

export function roleRankFromClaims(c: Claims): number {
  if (!c?.uid) return LEVEL_RANK.public;

  const tr = topRoleFromClaims(c);

  if (
    tr === TOP_ROLES.SUPER_DEV ||
    tr === TOP_ROLES.ORG_DEV ||
    tr === TOP_ROLES.DEV
  )
    return LEVEL_RANK.dev;

  if (tr === TOP_ROLES.ADMIN) return LEVEL_RANK.admin;

  if (tr === TOP_ROLES.UNVERIFIED || tr === TOP_ROLES.PUBLIC_USER || tr === "")
    return LEVEL_RANK.authed;

  return LEVEL_RANK.user;
}

export function hasLevel(c: Claims, level: RoleLevel): boolean {
  return roleRankFromClaims(c) >= LEVEL_RANK[level];
}

export function requireLevel(c: Claims, level: RoleLevel) {
  if (!hasLevel(c, level)) {
    const e = new Error("forbidden") as Error & {
      code: number;
      meta?: Record<string, unknown>;
    };
    e.code = 403;
    e.meta = { need: level };
    throw e;
  }
}

export function requireVerified(c: Claims) {
  if (isBlockedRole(c)) {
    const e = new Error("unverified") as Error & { code: number };
    e.code = 403;
    throw e;
  }
}

/* ---------------- Role/tag checks (safe) ---------------- */

/**
 * hasRole:
 * - For ladder roles, checks topRole/level only.
 * - For tags, checks roles[] after ladder stripping.
 */
export function hasRole(c: Claims, role: string) {
  const want = normTok(role);
  if (!want) return false;

  // ladder wants
  if (want === TOP_ROLES.DEV) return hasLevel(c, "dev");
  if (want === TOP_ROLES.ADMIN) return hasLevel(c, "admin");
  if (want === TOP_ROLES.USER) return hasLevel(c, "user");
  if (want === TOP_ROLES.ORG_DEV) return isOrgDev(c) || isSuperDev(c);
  if (want === TOP_ROLES.SUPER_DEV) return isSuperDev(c);
  if (want === TOP_ROLES.UNVERIFIED || want === TOP_ROLES.PUBLIC_USER)
    return isUnverified(c);

  // tag wants
  return roleTagsFromClaims(c).includes(want);
}

export function requireRole(c: Claims, role: string) {
  if (!hasRole(c, role)) {
    const err = new Error("forbidden") as Error & {
      code: number;
      meta?: Record<string, unknown>;
    };
    err.code = 403;
    err.meta = { needRole: normTok(role) };
    throw err;
  }
}

/* ---------------- Capabilities (backend-owned) ---------------- */

const AUTO_CAPS: Record<string, string[]> = {
  [TOP_ROLES.UNVERIFIED]: [],
  [TOP_ROLES.PUBLIC_USER]: ["profile:read", "profile:write"],
  [TOP_ROLES.USER]: [],

  // FE tags (user-level shaping only)
  [normTok("casemanager")]: ["*case_manager"],
  [normTok("case_manager")]: ["*case_manager"],
  [normTok("compliance")]: ["*compliance"],

  // higher levels
  [TOP_ROLES.ADMIN]: ["*"],
  [TOP_ROLES.DEV]: ["*"],
  [TOP_ROLES.ORG_DEV]: ["*"],
  [TOP_ROLES.SUPER_DEV]: ["*"],
};

export function capsFromClaims(c: Claims) {
  const caps = new Set<string>();

  // topRole caps
  const tr = topRoleFromClaims(c);
  const autoTR = AUTO_CAPS[tr];
  if (autoTR?.length) autoTR.forEach((cap) => caps.add(normTok(cap)));

  // tag caps (safe; ladder stripped already)
  for (const tag of roleTagsFromClaims(c)) {
    const auto = AUTO_CAPS[tag];
    if (auto?.length) auto.forEach((cap) => caps.add(normTok(cap)));
  }

  // explicit caps (backend owned)
  if (Array.isArray(c?.caps)) {
    for (const cap of c.caps) caps.add(normTok(cap));
  }

  return Array.from(caps);
}

/**
 * Wildcard matching for caps:
 * - "*" matches all
 * - "foo*" matches prefix
 * - "*foo" matches contains
 * - "*foo*" matches contains
 */
function capMatchesWant(cap: string, want: string) {
  if (cap === "*") return true;

  const hasLead = cap.startsWith("*");
  const hasTrail = cap.endsWith("*");

  if (hasLead && hasTrail && cap.length > 2) {
    const inner = cap.slice(1, -1);
    return want.includes(inner);
  }
  if (hasLead && cap.length > 1) {
    const inner = cap.slice(1);
    return want.includes(inner);
  }
  if (hasTrail && cap.length > 1) {
    const inner = cap.slice(0, -1);
    return want.startsWith(inner);
  }
  return cap === want;
}

export function requireCaps(c: Claims, wants: string[]) {
  const caps = capsFromClaims(c);

  for (const w of wants) {
    const want = normTok(w);
    if (!want) continue;

    let ok = false;
    for (const cap of caps) {
      if (capMatchesWant(cap, want)) {
        ok = true;
        break;
      }
    }

    if (!ok) {
      const e: any = new Error("forbidden");
      e.code = 403;
      e.meta = { missing: want };
      throw e;
    }
  }
}
