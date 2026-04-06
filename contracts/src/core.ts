// contracts/core.ts
// Minimal core surface for contracts.
// Keep this tiny on purpose.
import { z } from "zod";
export { z } from "zod";

export const Id = z.string().trim().min(1);
export const Ids = z.array(Id).min(1);
export const IdLike = z.preprocess((v) => {
  if (typeof v === "string" || typeof v === "number") return String(v);
  return v;
}, Id);

export const GrantIdsLike = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v.split(",").map(s => s.trim()).filter(Boolean);
  }
  return v;
}, z.array(Id).min(1));

//CustomerIdLike, EnrollmentIdLike, PaymentIdLike, TaskIdLike, TourIdLike, UserIdLike can all be aliases of IdLike consider adding them or just keeping generLic IdLike for simplicity.

export const TimestampLike = z.union([
  z.string(),            // ISO
  z.number(),            // millis
  z.object({ seconds: z.number(), nanoseconds: z.number() }), // Firestore JSON-ish
]);

export const TsLike = TimestampLike;
export const ISO10 = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type TTsLike = z.infer<typeof TsLike>;
export type TISO10 = z.infer<typeof ISO10>;

// NOTE: This is an INPUT shape. It does NOT coerce.
export const BoolLike = z.union([
  z.boolean(),
  z.literal("true"),
  z.literal("false"),
  z.literal(1),
  z.literal(0),
  z.literal("1"),
  z.literal("0"),
]);
export const Boolish = BoolLike;
export type Boolish = z.infer<typeof Boolish>;
/**
 * Coerces boolean-ish input to a real boolean.
 * - Handles "true"/"false", "1"/"0", 1/0, booleans
 * - Treats "" / null / undefined as-is so `.optional()` can work cleanly
 * - If input is an array (Express query), uses the first value
 *
 * Use this when the handler wants an actual boolean (not the raw query semantics).
 */
export const BoolFromLike = z.preprocess((v) => {
  if (Array.isArray(v)) v = v[0];
  if (v === "" || v === null || v === undefined) return v;
  if (v === true || v === false) return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  // fall through -> Zod will throw (good)
  return v;
}, z.boolean());

export const JsonObj = z.object({}).catchall(z.unknown());
export const JsonObjLike = z.preprocess((v) => {
  if (v && typeof v === "object") return v; // JsonObj will reject arrays
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? parsed : v;
    } catch {
      return v;
    }
  }
  return v;
}, JsonObj);

export interface BudgetLineItemLike {
  id?: string;
  amount?: number | string | null;
  spent?: number | string | null;
  projected?: number | string | null;
  [key: string]: any;
}

export interface BudgetTotals {
  total: number;
  spent: number;
  balance: number;
  projected: number;
  projectedBalance: number;
  /** spent + projected — total dollars allocated (committed + future obligations) */
  projectedSpend?: number;
}

export function toArray<T>(x: T | T[] | undefined | null): T[] {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}