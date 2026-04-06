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
