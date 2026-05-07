//src/lib/roles.ts
type RoleLike = { role?: unknown; topRole?: unknown; roles?: unknown } | null | undefined;

const ADMIN_LIKE_TOP_ROLES = new Set(["admin", "dev", "org_dev", "super_dev"]);
const DEV_LIKE_TOP_ROLES = new Set(["dev", "org_dev", "super_dev"]);
const SUPER_DEV_ALIASES = new Set(["super_dev", "superdev"]);
const CASE_MANAGER_ALIASES = new Set(["case_manager", "casemanager"]);

export function normalizeRole(role: unknown): string {
  const raw = String(role || "").trim().toLowerCase();
  if (!raw) return "";
  const compact = raw.replace(/[\s-]+/g, "_");
  if (compact === "superdev") return "super_dev";
  if (compact === "orgdev") return "org_dev";
  if (compact === "publicuser") return "public_user";
  return compact;
}

export function normalizeRoles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = input.map(normalizeRole).filter(Boolean);
  return Array.from(new Set(out));
}

export function topRoleNormalized(input: Pick<NonNullable<RoleLike>, "topRole" | "role"> | null | undefined, fallback = ""): string {
  return normalizeRole(input?.topRole || input?.role || fallback);
}

export function hasRole(input: unknown, role: string): boolean {
  return normalizeRoles(input).includes(normalizeRole(role));
}

export function hasAnyRole(input: unknown, roles: readonly string[]): boolean {
  const normalized = normalizeRoles(input);
  return roles.some((r) => normalized.includes(normalizeRole(r)));
}

export function isAdminLike(input: Pick<NonNullable<RoleLike>, "topRole" | "role"> | null | undefined): boolean {
  return ADMIN_LIKE_TOP_ROLES.has(topRoleNormalized(input));
}

export function isDevLike(input: RoleLike): boolean {
  if (!input) return false;
  const top = topRoleNormalized(input);
  if (DEV_LIKE_TOP_ROLES.has(top)) return true;
  return normalizeRoles(input.roles).some((r) => DEV_LIKE_TOP_ROLES.has(r));
}

export function isSuperDevLike(input: RoleLike): boolean {
  if (!input) return false;
  if (topRoleNormalized(input) === "super_dev") return true;
  return normalizeRoles(input.roles).some((r) => SUPER_DEV_ALIASES.has(r));
}

export function isCaseManagerLike(input: RoleLike): boolean {
  if (!input) return false;
  if (CASE_MANAGER_ALIASES.has(topRoleNormalized(input))) return true;
  return normalizeRoles(input.roles).some((r) => CASE_MANAGER_ALIASES.has(r));
}

export function isViewerLike(input: RoleLike): boolean {
  if (!input) return false;
  return normalizeRoles(input.roles).includes("viewer");
}

export const isAdmin = (roles: string[]): boolean => hasRole(roles, "admin");
export const isCompliance = (roles: string[]): boolean => hasRole(roles, "compliance");
export const isCaseManager = (roles: string[]): boolean => hasRole(roles, "case_manager");
