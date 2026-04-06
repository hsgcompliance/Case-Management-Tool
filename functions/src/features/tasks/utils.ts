// functions/src/features/tasks/utils.ts
// Shared helpers used by all task handlers

import {
  getOrgId,
  assertOrgAccess as assertOrgAccessCore,
  requireUid as requireUidCore,
  rolesFromClaims,
} from "../../core";

// -------- Date helpers --------
export const toISO10 = (d: Date | string | number) =>
  new Date(d as any).toISOString().slice(0, 10);

/** Alias kept for older callers (triggers, etc.) */
export const iso10 = toISO10;

export function parseDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + n);
  if (x.getDate() !== day) {
    /* JS clamps end-of-month; OK */
  }
  return x;
};

export const addYears = (d: Date, n: number) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
};

/**
 * Last day of a given month as ISO10.
 * mIdx is 0-based (0=Jan).
 * Uses UTC to avoid tz drift.
 */
export function lastDayOfMonthISO(y: number, mIdx: number) {
  return new Date(Date.UTC(y, mIdx + 1, 0)).toISOString().slice(0, 10);
}

export const slug = (s: string) =>
  String(s || "custom").toLowerCase().replace(/[^\w-]+/g, "-");

// -------- RBAC / org helpers (pure wrappers) --------

/** Normalize roles off claims/user to lowercase tokens (tasks-only helper). */
export function normalizeRolesFromClaims(user: any): string[] {
  const raw = rolesFromClaims(user as any) || [];

  return raw
    .map((r: any) =>
      String(r || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
    )
    .filter(Boolean);
}

/**
 * Back-compat helper for older callers that read orgId directly from claims.
 * Delegates to core.getOrgId for consistency.
 */
export function getOrgIdFromClaims(user: any): string | null {
  return getOrgId(user as any);
}

/**
 * Enforce that requester org matches doc org when doc org exists.
 * Legacy docs without orgId remain accessible.
 *
 * Delegates to core.assertOrgAccess so behavior
 * (including 403 error shape) is consistent across features.
 */
export function assertOrgAccess(user: any, doc: any) {
  return assertOrgAccessCore(user as any, doc as any);
}

/**
 * Require uid from request/claims; delegates to core.requireUid.
 */
export function requireUid(src: any): string {
  return requireUidCore(src as any);
}

export function resolveCaseManagerUid(src: any): string | null {
  const candidates = [
    src?.caseManagerId,
    src?.caseManagerUid,
    src?.assignedCaseManagerId,
    src?.case_manager_id,
    src?.caseManager?.id,
    src?.caseManager?.uid,
  ];
  for (const raw of candidates) {
    const s = String(raw || "").trim();
    if (s) return s;
  }
  return null;
}

// -------- Task schedule generator (pure) --------

/**
 * def: {
 *   id?, name?, type?,
 *   kind?: 'one-off'|'recurring',
 *   frequency?: 'weekly'|'monthly'|'annually'|'every X weeks'|'every X months',
 *   every?: number,
 *   endDate?: 'YYYY-MM-DD',
 *   dueDate?: 'YYYY-MM-DD'
 * }
 * startDate: anchor for recurring schedules and fallback for one-off without dueDate
 */
export function generateOccurrences(def: any, startDate: string) {
  const start = parseDate(startDate);
  const kind: "one-off" | "recurring" =
    def?.kind ||
    (String(def?.frequency || "").toLowerCase() === "non-recurring"
      ? "one-off"
      : "recurring");
  const name = def?.name || def?.type || "Task";

  if (kind === "one-off") {
    const dueISO = toISO10(def?.dueDate ? parseDate(def.dueDate) : start);
    return [
      {
        id: def?.id
          ? `task_${slug(def.id)}_${dueISO}`
          : `task_${slug(name)}_${dueISO}`,
        type: name,
        dueDate: dueISO,
      },
    ];
  }

  // recurring
  const freq = String(def?.frequency || "monthly").toLowerCase();
  const every =
    Number.isFinite(+def?.every) && +def.every > 0 ? +def.every : 1;
  const endBound = def?.endDate ? parseDate(def.endDate) : addYears(start, 1);

  let stepFn: (d: Date) => Date;
  if (freq === "weekly") stepFn = (d) => addDays(d, 7);
  else if (freq === "monthly") stepFn = (d) => addMonths(d, 1);
  else if (freq === "annually") stepFn = (d) => addYears(d, 1);
  else if (freq.startsWith("every") && freq.includes("week"))
    stepFn = (d) => addDays(d, 7 * every);
  else if (freq.startsWith("every") && freq.includes("month"))
    stepFn = (d) => addMonths(d, every);
  else stepFn = (d) => addMonths(d, 1);

  const out: Array<{ id: string; type: string; dueDate: string }> = [];
  let due = new Date(start);
  const baseId = def?.id || def?.type || slug(name);
  const MAX = 400;

  for (let i = 0; i < MAX; i++) {
    if (due > endBound) break;
    const dueISO = toISO10(due);
    out.push({
      id: `task_${slug(baseId)}_${dueISO}`,
      type: name,
      dueDate: dueISO,
    });

    const next = stepFn(due);
    if (
      !(next instanceof Date) ||
      Number.isNaN(next.getTime()) ||
      next <= due
    )
      break;
    due = next;
  }
  return out;
}

// -------- Merge & summarize --------

/**
 * Carry status + routing from prev → next.
 * Critical: preserve verified lock (`status:"verified"` or `verified:true`).
 */
export function carryStatus(prev: any, next: any) {
  const wasVerified = prev?.status === "verified" || prev?.verified === true;

  return {
    ...next,

    // completion
    completed: prev.completed ?? next.completed ?? false,
    completedAt: prev.completedAt ?? next.completedAt ?? null,
    byUid: prev.byUid ?? prev.completedBy ?? next.byUid ?? null,

    // notes / verification
    notes: prev.notes ?? next.notes ?? "",
    verified: prev.verified ?? wasVerified ?? next.verified ?? false,
    verifiedAt: prev.verifiedAt ?? next.verifiedAt ?? null,
    verifiedBy: prev.verifiedBy ?? next.verifiedBy ?? null,
    status: prev.status ?? (wasVerified ? "verified" : next.status ?? null),

    // routing stability across regen
    assignedToUid: prev.assignedToUid ?? next.assignedToUid ?? null,
    assignedToGroup: prev.assignedToGroup ?? next.assignedToGroup ?? null,
    assignedAt: prev.assignedAt ?? next.assignedAt ?? null,
    assignedBy: prev.assignedBy ?? next.assignedBy ?? null,
  };
}

export function summarize(schedule: any[]) {
  const today = new Date().toISOString().slice(0, 10);
  const total = schedule.length;
  const completed = schedule.filter((s) => s?.completed).length;
  const overdue = schedule.filter(
    (s) => !s?.completed && String(s?.dueDate) < today
  ).length;
  const incompletes = schedule.filter((s) => !s?.completed && s?.dueDate);
  const nextDue = incompletes.length
    ? incompletes.reduce(
        (min: string | null, s: any) =>
          !min || s.dueDate < min ? s.dueDate : min,
        null
      )
    : null;
  return { total, completed, overdue, nextDue };
}
