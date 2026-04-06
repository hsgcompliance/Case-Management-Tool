// functions/src/core/security.ts
import { isPlainObject } from "./utils";

export const DEFAULTS = {
  maxDepth: 8,
  maxKeysPerObject: 500,
  maxArrayLength: 1000,
  maxStringLength: 1000,
};

export function flagAdverseFields(obj: any, ctx = "", cfg = DEFAULTS) {
  const red: { path: string; reason: string }[] = [];
  const seen = new WeakSet();
  const push = (p: string, r: string) => red.push({ path: p, reason: r });

  const walk = (v: any, path = "", d = 0) => {
    if (d > cfg.maxDepth) { push(path, "Max depth exceeded"); return; }

    if (v && typeof v === "object") {
      if (seen.has(v)) { push(path, "Cyclic reference"); return; }
      seen.add(v);

      if (Array.isArray(v)) {
        if (v.length > cfg.maxArrayLength) push(path, "Array too long");
        for (let i = 0; i < Math.min(v.length, cfg.maxArrayLength); i++) {
          walk(v[i], `${path}[${i}]`, d + 1);
        }
        return;
      }

      const keys = Object.keys(v);
      if (keys.length > cfg.maxKeysPerObject) push(path, "Too many keys");

      for (const k of keys) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") {
          push(`${path}.${k}`, "Proto pollution key");
          continue;
        }
        walk(v[k], path ? `${path}.${k}` : k, d + 1);
      }
      return;
    }

    if (typeof v === "string") {
      if (v.length > cfg.maxStringLength) push(path, "String too long");
      if (/<script[\s>]/i.test(v)) push(path, "Script tag");
      if (/on\w+=["']?/i.test(v)) push(path, "Inline JS attribute");
    }
  };

  try { walk(obj); }
  catch (e: any) { push("(root)", `Scanner error: ${e?.message || e}`); }

  if (red.length) console.warn(`[ADVERSE] ${ctx}: ${red.length} issues`, red.slice(0, 3));
  return red;
}

export function truncateLongStrings(s: any, max = 1000) {
  if (typeof s !== "string") return s;
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export const removeUndefinedDeepFromJson = (obj: any) => JSON.parse(JSON.stringify(obj));
export const removeUndefinedDeep = removeUndefinedDeepFromJson;

export function sanitizeFlatObject<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (v === undefined) continue;
    out[k] = typeof v === "string"
      ? truncateLongStrings(v, DEFAULTS.maxStringLength)
      : v;
  }
  return out as T;
}

export function sanitizeNestedObject<T = any>(obj: T, cfg = DEFAULTS): T {
  const cleaned = removeUndefinedDeepFromJson(obj);
  if (!cleaned || typeof cleaned !== "object") return cleaned;

  const walk = (v: any, d = 0): any => {
    if (d > cfg.maxDepth) return undefined;

    if (Array.isArray(v)) return v.slice(0, cfg.maxArrayLength).map(x => walk(x, d + 1)).filter(x => x !== undefined);

    if (isPlainObject(v)) {
      const keys = Object.keys(v);
      const o: any = {};
      for (const k of keys.slice(0, cfg.maxKeysPerObject)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        const next = walk(v[k], d + 1);
        if (next !== undefined) o[k] = next;
      }
      return o;
    }

    return typeof v === "string" ? truncateLongStrings(v, cfg.maxStringLength) : v;
  };

  return walk(cleaned, 0) as T;
}

/* ---------------- Reserved-field stripping ---------------- */

const RESERVED_KEYS = new Set([
  "orgId", "teamId", "teamIds",
  "createdAt", "updatedAt", "deletedAt",
  "by", "createdBy", "updatedBy",
  "status", // optionally keep reserved if you want stricter state control
]);

/** Drop reserved keys from user-provided patches/extras. */
export function stripReservedFields(obj: unknown): Record<string, any> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj as Record<string, any>)) {
    if (RESERVED_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}
