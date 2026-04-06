// functions/core/dates.ts
// Canonical date utilities for the backend.

import { Timestamp } from "../core/admin";
import { z, ISO10, TsLike } from "@hdb/contracts";

type ISO10 = z.infer<typeof ISO10>;

export type DateInput =
  | string
  | number
  | Date
  | FirebaseFirestore.Timestamp
  | null
  | undefined;

/** Best-effort parse into a JS Date (UTC-based semantics). Returns null on failure. */
export function toDate(input: DateInput): Date | null {
  if (input == null) return null;

  // Already a Date
  if (input instanceof Date) {
    return new Date(input.getTime());
  }

  // Firestore Timestamp (or anything with toDate())
  if (typeof input === "object" && typeof (input as any).toDate === "function") {
    const d = (input as any).toDate();
    return d instanceof Date ? d : null;
  }

  // Epoch millis
  if (typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return null;

    // YYYY-MM-DD (treat as UTC date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map((n) => Number(n));
      const date = new Date(Date.UTC(y, m - 1, d));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    // Fallback: let JS parse (ISO strings, etc.)
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** Canonical UTC ISO string ("YYYY-MM-DDTHH:mm:ss.sssZ"). Empty string if invalid. */
export function toUtcIso(input: DateInput): string {
  const d = toDate(input);
  return d ? d.toISOString() : "";
}

/** Epoch millis in UTC. NaN if invalid. */
export function toUtcMillis(input: DateInput): number {
  const d = toDate(input);
  return d ? d.getTime() : Number.NaN;
}

/** Date-only ("YYYY-MM-DD") from any input (UTC). Empty string if invalid. */
export function toDateOnly(input: DateInput): ISO10 | "" {
  const d = toDate(input);
  if (!d) return "";
  return d.toISOString().slice(0, 10) as ISO10;
}

/** Month-only ("YYYY-MM") from any input (UTC). Empty string if invalid. */
export function toMonthKey(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const mm = m < 10 ? `0${m}` : String(m);
  return `${y}-${mm}`;
}

/**
 * Add months in UTC.
 * Preserves "end of month" where reasonable (e.g. Jan 31 + 1 month -> Feb 28/29).
 */
export function addMonthsUtc(input: DateInput, months: number): Date {
  const base = toDate(input) ?? new Date();
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();

  const targetMonthIndex = m + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Start at day 1 and then clamp to end-of-month.
  const result = new Date(
    Date.UTC(targetYear, normalizedMonth, 1, base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds())
  );
  const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(d, daysInTargetMonth));
  return result;
}

/**
 * Inclusive UTC window check for date-only comparisons.
 * dateIso/startIso/endIso can be full ISO or "YYYY-MM-DD".
 */
export function isWithinDateWindow(
  dateIso: string | DateInput,
  startIso?: string | DateInput | null,
  endIso?: string | DateInput | null
): boolean {
  const d = toDateOnly(dateIso);
  if (!d) return false;

  const s = startIso != null ? toDateOnly(startIso) : "";
  const e = endIso != null ? toDateOnly(endIso) : "";

  if (s && d < s) return false;
  if (e && d > e) return false;
  return true;
}

/** String cursor for pagination from a timestamp-like input (millis as string). */
export function cursorFromTimestamp(input: DateInput): string {
  const ms = toUtcMillis(input);
  if (!Number.isFinite(ms)) return "";
  return String(ms);
}

/** Convert a cursor string/number back into a Firestore Timestamp. */
export function cursorToTimestamp(input: string | number): FirebaseFirestore.Timestamp {
  const millis = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(millis)) {
    throw new Error("invalid_cursor_timestamp");
  }
  return Timestamp.fromMillis(millis) as unknown as FirebaseFirestore.Timestamp;
}

/**
 * Convert a UTC instant into a local representation.
 * - format "iso"  -> ISO-like string in the target tz
 * - format "dateOnly" -> "YYYY-MM-DD" in the target tz
 * - format "month" -> "YYYY-MM" in the target tz
 */
export function fromUtcToLocal(
  input: DateInput,
  tz?: string,
  options?: { format?: "iso" | "dateOnly" | "month" }
): string | ISO10 {
  const d = toDate(input);
  if (!d) return "";
  const fmt = options?.format ?? "iso";

  // No tz specified or explicit UTC -> defer to UTC helpers.
  if (!tz || tz === "UTC") {
    if (fmt === "dateOnly") return toDateOnly(d);
    if (fmt === "month") return toMonthKey(d);
    return d.toISOString();
  }

  if (fmt === "dateOnly") {
    const s = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const [year, month, day] = s.split("-");
    return `${year}-${month}-${day}` as ISO10;
  }

  if (fmt === "month") {
    const s = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    }).format(d);
    const [year, month] = s.split("-");
    return `${year}-${month}`;
  }

  // ISO-like local string: "YYYY-MM-DDTHH:mm:ss"
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit" as any, // for older TS libs
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);

  // sv-SE gives "YYYY-MM-DD HH:mm:ss"
  return s.replace(" ", "T");
}
