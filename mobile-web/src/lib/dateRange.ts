// Date-range presets for the sessions filter chips. Sessions store their date as
// a "YYYY-MM-DD" string (TCmActivity.date), so all bounds are inclusive local
// date strings and comparisons are plain string compares (lexicographic ===
// chronological for ISO-10 dates).

export type DateRangeKey = "today" | "week" | "month" | "all";

export const DATE_RANGE_CHIPS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

/** Local "YYYY-MM-DD" for a Date (not UTC — sessions are logged in local time). */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Inclusive [start, end] "YYYY-MM-DD" bounds for a preset, or null for "all".
 * Week starts Sunday. Used both to drive the Firestore query window and to label
 * the active filter.
 */
export function rangeBounds(key: DateRangeKey, now = new Date()): { start: string; end: string } | null {
  if (key === "all") return null;

  const end = toLocalISODate(now);

  if (key === "today") {
    return { start: end, end };
  }

  if (key === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // back to Sunday
    return { start: toLocalISODate(start), end };
  }

  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toLocalISODate(start), end };
}

/** True when a "YYYY-MM-DD" date falls within the preset window. */
export function inRange(date: string, key: DateRangeKey, now = new Date()): boolean {
  const b = rangeBounds(key, now);
  if (!b) return true;
  return date >= b.start && date <= b.end;
}
