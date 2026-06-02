// mobile-web/src/types/index.ts
// Minimal mobile type surface — mirrors the shape of web/src/types/index.ts
// but only includes what the mobile app actually uses.

export type {
  TCmActivity,
  TCmActivityType,
  TCmActivityCreateBody,
  TCmActivityUpdateBody,
  TUserExtras,
} from "@hdb/contracts";

// ─── Branded primitives (same definitions as web/src/types/index.ts) ──────────

/** `"YYYY-MM-DD"` — date-only, no timezone. Safe for `<input type="date">`. */
export type ISODate = string & { readonly __brand: "ISODate10" };

/** `"YYYY-MM"` */
export type YearMonth = string & { readonly __brand: "YearMonth" };

/** Firestore Timestamp shapes we may receive from the SDK or serialized JSON. */
export type FirestoreTsLike = {
  _seconds?: number;
  _nanoseconds?: number;
  seconds?: number;
  nanoseconds?: number;
  toMillis?: () => number;
};
