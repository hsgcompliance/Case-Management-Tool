// functions/src/features/enrollments/closeHelpers.ts
// Shared close-time computation, extracted from patch.ts so enrollmentsPatch's
// close branch and the new dedicated closeEnrollmentCore (close.ts) run the
// exact same logic instead of two independently-maintained implementations.

export function closeFutureTasksAfterEndDate(schedule: any[], endDateISO: string, actor = "system") {
  const nowIso = new Date().toISOString();
  let changed = false;
  const next = (Array.isArray(schedule) ? schedule : []).map((t: any) => {
    const due = String(t?.dueDate || "").slice(0, 10);
    if (!due || due <= endDateISO) return t;
    if (t?.status === "verified") return t;
    if (t?.completed === true || t?.status === "done") return t;
    changed = true;
    return {
      ...t,
      completed: true,
      completedAt: t?.completedAt || nowIso,
      status: "done",
      notes: [String(t?.notes || "").trim(), `Auto-closed after enrollment end ${endDateISO}`]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 2000),
      updatedAt: nowIso,
      updatedBy: actor,
    };
  });
  return { changed, next };
}

export function deleteFutureTasksAfterEndDate(schedule: any[], endDateISO: string) {
  if (!Array.isArray(schedule)) return { changed: false, next: schedule };
  const next = schedule.filter((t: any) => {
    const due = String(t?.dueDate || "").slice(0, 10);
    return !due || due <= endDateISO;
  });
  return { changed: next.length !== schedule.length, next };
}

export function capEndDateToGrant(endDate: unknown, grantEndDate: unknown) {
  const end = String(endDate || "").slice(0, 10);
  const grantEnd = String(grantEndDate || "").slice(0, 10);
  if (!end || !grantEnd) return end;
  return end > grantEnd ? grantEnd : end;
}
