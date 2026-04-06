// web/src/lib/formatters.ts
import { parseISO10, safeISODate10 } from "@lib/date";

export function fmtCurrencyUSD(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDateUSParts(d: Date): string {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
}

function fmtTimeUSParts(d: Date): string {
  let h = d.getHours();
  const m = pad2(d.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** Render a date as MM/DD/YYYY (display only; do not use for storage/sorting). */
export function fmtDateUS(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : fmtDateUSParts(value);
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : fmtDateUSParts(d);
  }
  const s = String(value);
  const iso10 = safeISODate10(s);
  if (iso10) {
    const dt = parseISO10(iso10);
    return dt ? fmtDateUSParts(dt) : "";
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? "" : fmtDateUSParts(dt);
}

/** Smart local display: date-only for ISO10 strings, date+time for timestamp-ish values. */
export function fmtDateSmart(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    const iso10 = safeISODate10(value);
    if (iso10 && String(value).trim().length <= 10) {
      return fmtDateUS(iso10);
    }
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    return `${fmtDateUSParts(dt)} ${fmtTimeUSParts(dt)}`;
  }
  if (value instanceof Date || typeof value === "number") {
    const dt = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    return `${fmtDateUSParts(dt)} ${fmtTimeUSParts(dt)}`;
  }
  return fmtDateUS(value);
}

export function fmtDateOrDash(value: unknown): string {
  return fmtDateUS(value) || "-";
}

export function fmtDateSmartOrDash(value: unknown): string {
  return fmtDateSmart(value) || "-";
}

export function fmtBytes(bytes: unknown): string {
  const n = Number(bytes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const decimals = idx === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[idx]}`;
}

export function toTrimmedOrNull(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}
