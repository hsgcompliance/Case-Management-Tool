// functions/src/core/norm.ts
// Shared normalization helpers for IDs, tokens, and generic scalars.

import type { ISO10, TsLike } from "@hdb/contracts";

export type AnyScalar = string | number | boolean | null | undefined;

/** Convert any scalar-ish value to string (no trimming/lowercasing). */
export const toStr = (v: AnyScalar): string => String(v ?? "");

/** Simple string normalize: trim only (no case change). */
export const normStr = (v: unknown): string => String(v ?? "").trim();

/**
 * ID-oriented normalize.
 * NOTE: We intentionally DO NOT lowercase here to preserve existing behavior
 * where orgId/teamIds were case-sensitive except for trimming.
 * Returns a non-empty trimmed string suitable for use as an Id.
 */
export const normId = (v: unknown): string => normStr(v);

/** Normalize tokens: lowercase, trim, drop spaces/underscores/hyphens. */
export const normTok = (v: unknown): string =>
  String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "");

/**
 * Role-specific normalizer: lowercase + trim, collapse spaces/hyphens to
 * underscores, then resolve legacy no-underscore aliases (e.g. "superdev" →
 * "super_dev") written by old normTok-based code.
 */
const _ROLE_ALIAS: Record<string, string> = {
  superdev:   "super_dev",
  orgdev:     "org_dev",
  publicuser: "public_user",
};
export const normRole = (v: unknown): string => {
  const s = String(v || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  return _ROLE_ALIAS[s.replace(/_/g, "")] ?? s;
};

/** Unique, non-empty normalized strings given a list and a normalizer. */
export function uniqNorm(
  vals: unknown[],
  norm: (v: unknown) => string = normStr
): string[] {
  const out = new Set<string>();
  for (const v of vals || []) {
    const n = norm(v);
    if (n) out.add(n);
  }
  return Array.from(out);
}
