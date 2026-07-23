// functions/src/features/enrollments/overlap.ts
// Shared interval-overlap primitives for enrollment date windows. Extracted
// from checkOverlaps.ts (previously the only caller, and itself dead code —
// see docs/active-projects.local/report-reconciliation-workbench/
// root-cause-2026-07-21-duplicate-enrollment.md) so enrollment creation and
// the standalone duplicate-enrollment audit scan can reuse the exact same
// logic instead of a second, drifting reimplementation.

const OPEN_END = new Date("9999-12-31");

/** True if [aStart, aEnd] and [bStart, bEnd] intersect. A null end is open-ended (far future). */
export function overlapsWindow(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date | null): boolean {
  const aE = aEnd ?? OPEN_END;
  const bE = bEnd ?? OPEN_END;
  return aStart.getTime() <= bE.getTime() && bStart.getTime() <= aE.getTime();
}

export type WindowRow = {
  id: string;
  grantId?: string | null;
  startDate?: unknown;
  endDate?: unknown;
};

/** All overlapping pairs within one pool of rows (O(n^2); pools here are per-customer/per-grant, always small). */
export function findOverlappingEnrollments<T extends WindowRow>(
  rows: T[],
  toDateFn: (value: unknown) => Date | null,
  window?: { start?: Date | null; end?: Date | null },
): Array<{ a: T; b: T }> {
  const withDates = rows
    .map((row) => ({ row, s: toDateFn(row.startDate), e: toDateFn(row.endDate) }))
    .filter((m): m is { row: T; s: Date; e: Date | null } => !!m.s);

  const out: Array<{ a: T; b: T }> = [];
  for (let i = 0; i < withDates.length; i++) {
    for (let j = i + 1; j < withDates.length; j++) {
      const a = withDates[i];
      const b = withDates[j];
      if (!overlapsWindow(a.s, a.e, b.s, b.e)) continue;
      if (window?.start && a.e && a.e < window.start) continue;
      if (window?.end && b.s && b.s > window.end) continue;
      out.push({ a: a.row, b: b.row });
    }
  }
  return out;
}

/** True if `candidate`'s window overlaps ANY row in `rows` (e.g. checking a proposed new enrollment against a customer's existing ones). */
export function overlapsAny<T extends WindowRow>(
  candidate: { startDate?: unknown; endDate?: unknown },
  rows: T[],
  toDateFn: (value: unknown) => Date | null,
): T[] {
  const cS = toDateFn(candidate.startDate);
  if (!cS) return [];
  const cE = toDateFn(candidate.endDate);
  return rows.filter((row) => {
    const rS = toDateFn(row.startDate);
    if (!rS) return false;
    const rE = toDateFn(row.endDate);
    return overlapsWindow(cS, cE, rS, rE);
  });
}
