// src/lib/safeData.ts
// Strip `undefined` before a body is sent as JSON. Object properties that are
// `undefined` are OMITTED (matching JSON.stringify's own behavior, and Zod's
// `.optional()` meaning "may be absent" — NOT "may be null"; endpoints that
// want an explicit clear-to-null signal declare `.nullish()`/`.null()` and
// callers set that field to `null` themselves). Array entries still coerce to
// null since JSON has no "hole"/undefined array slot either way.
export function noUndefined<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((v: any) => (v === undefined ? null : noUndefined(v))) as any;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as any)) {
      if (v === undefined) continue;    // omit — leave the key absent
      out[k] = noUndefined(v as any);   // recurse
    }
    return out as T;
  }
  return input;
}
