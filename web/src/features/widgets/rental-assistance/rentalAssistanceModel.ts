function monthKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : "";
}

function addMonthsToMonthKey(value: string, delta: number) {
  if (!/^\d{4}-\d{2}$/.test(value)) return "";
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function hardCutoff(startDate: string, maxMonths: number | null) {
  if (!maxMonths || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return "";
  const firstMonth = monthKey(startDate);
  const anchor = Number(startDate.slice(8, 10)) >= 15 ? addMonthsToMonthKey(firstMonth, 1) : firstMonth;
  const finalMonth = addMonthsToMonthKey(anchor, maxMonths - 1);
  const [year, month] = finalMonth.split("-").map(Number);
  const date = new Date(year, month, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function linkedEnrollmentIds(enrollments: Array<Record<string, unknown>>) {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id) || id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    if (!left || !right) return;
    const a = find(left);
    const b = find(right);
    parent.set(left, a);
    parent.set(right, b);
    if (a !== b) parent.set(b, a);
  };
  const continuumOwner = new Map<string, string>();
  for (const enrollment of enrollments) {
    const id = String(enrollment.id || "").trim();
    if (!id) continue;
    parent.set(id, parent.get(id) || id);
    const continuity = enrollment.continuity && typeof enrollment.continuity === "object"
      ? enrollment.continuity as Record<string, unknown>
      : {};
    const continuumId = String(continuity.continuumId || "").trim();
    if (continuumId) {
      const owner = continuumOwner.get(continuumId);
      if (owner) union(id, owner);
      else continuumOwner.set(continuumId, id);
    }
    for (const linked of [
      continuity.previousEnrollmentId,
      continuity.nextEnrollmentId,
      (enrollment.migratedFrom as Record<string, unknown> | undefined)?.enrollmentId,
      (enrollment.migratedTo as Record<string, unknown> | undefined)?.enrollmentId,
    ]) union(id, String(linked || "").trim());
  }
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) || []), id]);
  }
  return new Map(Array.from(parent.keys()).map((id) => [id, groups.get(find(id)) || [id]]));
}

export function assistanceUsage(
  payments: Array<{ dueDate: string }>,
  maxMonths: number | null,
  asOf: string,
) {
  const monthKeys = Array.from(new Set(payments.map((payment) => monthKey(payment.dueDate)).filter(Boolean))).sort();
  const startDate = payments.map((payment) => payment.dueDate).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort()[0] || "";
  const todayMonth = monthKey(asOf);
  const lastCompletedMonth = addMonthsToMonthKey(todayMonth, -1);
  return {
    startDate,
    monthsUsed: monthKeys.filter((month) => month <= todayMonth).length,
    remaining: maxMonths == null ? null : Math.max(0, maxMonths - monthKeys.filter((month) => month <= lastCompletedMonth).length),
    cutoff: hardCutoff(startDate, maxMonths),
  };
}
