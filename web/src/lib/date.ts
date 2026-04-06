// src/lib/date.ts
import type { FirestoreTsLike, ISODate, YearMonth } from "@types";
import type { Timestamp } from "firebase/firestore";

const pad = (n: number) => String(n).padStart(2, "0");

// Accepts many shapes and returns milliseconds (or NaN)
type TsInput = FirestoreTsLike | Timestamp | Date | string | number | null | undefined;

/**
 * Date helper guide
 *
 * Use `toISODate` / `todayISO`:
 * - UI date inputs (`type="date"`)
 * - date-only defaults
 * - local comparisons by YYYY-MM-DD string
 *
 * Use `parseISO10Strict`:
 * - validating user-entered DOB / date input values
 * - rejecting impossible dates like 2024-02-31
 *
 * Use `parseISO10`:
 * - tolerant parsing when backend may send ISO strings or ISO10
 *
 * Use `toMillisAny` / `tsToMillis`:
 * - sorting mixed Firestore timestamps, strings, and numbers
 *
 * Use `fmtMDY` / `fmtDateOrDash` (from `@lib/formatters`):
 * - display text (avoid manual `slice(0, 10)` in UI)
 */

/** True only for `YYYY-MM-DD` shape (does not validate calendar correctness). */
export function isISODate10(value?: unknown): value is ISODate {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

/** Returns a safe ISO10 string or empty string (no timezone conversion for already-ISO10 values). */
export function safeISODate10(value?: unknown): ISODate | "" {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const iso10 = s.slice(0, 10);
  return isISODate10(iso10) ? (iso10 as ISODate) : "";
}

/** Today as local `YYYY-MM-DD` (safe for `<input type="date">` defaults). */
export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function toISODate(input: Date | string | number): ISODate {
  // Normalize to a Date, then build YYYY-MM-DD using *local* getters to avoid TZ drift.
  let d: Date;
  if (input instanceof Date) d = input;
  else if (typeof input === "number") d = new Date(input);
  else d = new Date(String(input));

  if (Number.isNaN(d.getTime())) {
    // Best-effort: if you pass "YYYY-MM" or "YYYY", coerce to first of month/day
    const s = String(input ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s as ISODate;           // already ISO10
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01` as ISODate;
    if (/^\d{4}$/.test(s)) return `${s}-01-01` as ISODate;
    return "" as ISODate;
  }

  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}` as ISODate;
}

// Alias kept for callers already using toISO10
export function toISO10(d: Date | string | number): ISODate {
  return toISODate(d);
}

export function parseISO10(s?: string | null): Date | null {
  if (!s) return null;
  // Accept only YYYY-MM-DD (or tolerate full ISO by new Date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d); // local
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Strict ISO10 parser: requires valid `YYYY-MM-DD` and rejects impossible dates. */
export function parseISO10Strict(s?: string | null): Date | null {
  if (!isISODate10(s)) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function fmtMDY(input: string | number | Date): string {
  const d = input instanceof Date
    ? input
    : typeof input === "number"
      ? new Date(input)
      : parseISO10(input);

  if (!d || Number.isNaN(d.getTime())) return "";
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

export function ymKey(d = new Date()): YearMonth {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` as YearMonth;
}

export function monthName(d = new Date(), { lowercase = false } = {}): string {
  const s = d.toLocaleString(undefined, { month: "long" });
  return lowercase ? s.toLowerCase() : s;
}

export function monthFromYM(ym: YearMonth | string, { lowercase = false } = {}): string {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return "";
  return monthName(new Date(y, m - 1, 1), { lowercase });
}

export const sameYearMonth = (iso: ISODate | string, ym: YearMonth | string) =>
  String(iso || "").slice(0, 7) === String(ym || "");

// ---------------- Timestamp utilities ----------------

export const tsToMillis = (t: TsInput): number => {
  try {
    if (!t) return NaN;
    if (t instanceof Date) return t.getTime();
    if (typeof (t as any).toMillis === "function") return Number((t as any).toMillis());
    if (typeof t === "object") {
      const sec = Number((t as any)._seconds ?? (t as any).seconds);
      const nsec = Number((t as any)._nanoseconds ?? (t as any).nanoseconds ?? 0);
      if (Number.isFinite(sec)) return sec * 1000 + Math.floor(nsec / 1e6);
    }
    if (typeof t === "string") {
      const ms = Date.parse(t);
      return Number.isFinite(ms) ? ms : NaN;
    }
    if (typeof t === "number") return t;
  } catch {}
  return NaN;
};

export const itemMillis = (i: { ts?: TsInput; dueDate?: string | null; date?: string | null }): number => {
  const ms = tsToMillis(i.ts);
  if (Number.isFinite(ms)) return ms;
  const fb = Date.parse((i.dueDate ?? i.date) ?? "");
  return Number.isFinite(fb) ? fb : 0;
};

export const fmtFromTsLike = (t: TsInput, fallbackISO?: string | null): string => {
  const ms = tsToMillis(t);
  if (Number.isFinite(ms)) return fmtMDY(ms);
  if (fallbackISO) {
    const f = Date.parse(fallbackISO);
    if (Number.isFinite(f)) return fmtMDY(f);
  }
  return "-";
};

export function toMillisAny(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") return Date.parse(ts);
  const any = ts as any;
  if (typeof any.toMillis === "function") return any.toMillis();
  if ("_seconds" in any || "seconds" in any) {
    const s = any._seconds ?? any.seconds ?? 0;
    const ns = any._nanoseconds ?? any.nanoseconds ?? 0;
    return s * 1000 + Math.round(ns / 1e6);
  }
  return 0;
}

// --------------- Small helpers used by forms ---------------

export const addDays = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};
export const addYears = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setFullYear(copy.getFullYear() + n);
  return copy;
};
