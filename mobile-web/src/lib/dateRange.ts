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
 *
 * Week/month windows extend to the END of the period (Saturday / last day),
 * not just today: sessions can carry a forward date — intentionally, or from
 * legacy evening saves that stamped the UTC (next-day) date — and clipping the
 * window at today made them silently vanish from every default view.
 */
export function rangeBounds(key: DateRangeKey, now = new Date()): { start: string; end: string } | null {
  if (key === "all") return null;

  const today = toLocalISODate(now);

  if (key === "today") {
    return { start: today, end: today };
  }

  if (key === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // back to Sunday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // forward to Saturday
    return { start: toLocalISODate(start), end: toLocalISODate(end) };
  }

  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
  return { start: toLocalISODate(start), end: toLocalISODate(end) };
}

/** True when a "YYYY-MM-DD" date falls within the preset window. */
export function inRange(date: string, key: DateRangeKey, now = new Date()): boolean {
  const b = rangeBounds(key, now);
  if (!b) return true;
  return date >= b.start && date <= b.end;
}
