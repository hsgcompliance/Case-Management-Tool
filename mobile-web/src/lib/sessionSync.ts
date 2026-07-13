// Session sync engine — the single source of truth for pushing a session to
// Google Calendar and/or the customer's TSS workbook (progress note). Reused by:
//   • the Log Session save flow,
//   • the per-row "Sync"/"Retry" button,
//   • the "Sync all" button.
// "Be smart about the session": only the pushes that are eligible and not already
// done are attempted, so re-running is safe (idempotent — calendar dedupes on the
// server via activityId; workbook is gated on workbookSynced).

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GoogleIntegrations } from "@/lib/googleIntegrations";
import type { TCmActivity, TCmActivityType } from "@hdb/contracts";

// ── Shared formatting (also used by the Log Session form) ────────────────────

export const SESSION_TYPE_LABELS: Record<TCmActivityType, string> = {
  "in-person": "In Person",
  phone: "Phone",
  "data-entry": "Data Entry",
  other: "On Behalf of",
};

/** Initials from a display name: "Griffin Seyfried" → "GS"; single token → first 2. */
export function staffInitials(name?: string | null): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "2026-06-18" → "6/18/2026" for the in-note signature line. */
export function prettyDate(iso: string): string {
  const [y, m, d] = String(iso || "").split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

/** Build the progress-note Summary cell — self-contained + signed (variant-safe). */
export function buildProgressNoteSummary(args: {
  type: TCmActivityType;
  note?: string;
  date: string;
  staffInitial: string;
}): string {
  const modality = SESSION_TYPE_LABELS[args.type] ?? "";
  const noteBody = [modality, (args.note ?? "").trim()].filter(Boolean).join(" — ");
  const signature = [args.staffInitial, prettyDate(args.date)].filter(Boolean).join(" · ");
  return [noteBody, signature ? `— ${signature}` : ""].filter(Boolean).join("\n");
}

/** Linked Plan Goal column — "Goal #1, Goal #3" from selected 1-based numbers. */
export function buildLinkedPlanGoal(linkedGoals: number[]): string {
  return linkedGoals.map((n) => `Goal #${n}`).join(", ");
}

/** Field map for appendCustomerWorkbookRow → progressNotes. */
export function buildProgressNoteValues(args: {
  session: Pick<TCmActivity, "type" | "date" | "startTime" | "endTime" | "note">;
  staffName: string;
  staffInitial: string;
  linkedGoals: number[];
  /** When true, stamp the row with today's date instead of the session date. */
  useTodayDate?: boolean;
}): Record<string, string> {
  const { session, staffName, staffInitial, linkedGoals, useTodayDate } = args;
  // LOCAL date, not UTC — toISOString() rolls to tomorrow in the evening.
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const progressDate = useTodayDate ? localToday : session.date;
  const summary = buildProgressNoteSummary({
    type: session.type,
    note: session.note,
    date: progressDate,
    staffInitial,
  });
  const linkedPlanGoal = buildLinkedPlanGoal(linkedGoals);
  return {
    progressDate,
    ...(session.startTime ? { startTime: session.startTime } : {}),
    ...(session.endTime ? { endTime: session.endTime } : {}),
    ...(summary ? { summary } : {}),
    ...(linkedPlanGoal ? { linkedPlanGoal } : {}),
    ...(staffName ? { staffName } : {}),
    ...(staffInitial ? { staffInitial } : {}),
  };
}

// ── Sync state ───────────────────────────────────────────────────────────────

export interface SyncContext {
  calendarConnected: boolean;
  driveConnected: boolean;
  /** Whether the session's customer has a linked TSS workbook (best-effort). */
  customerHasWorkbook: boolean;
  staffName: string;
  staffInitial: string;
}

export interface SyncState {
  needsCalendar: boolean;
  needsWorkbook: boolean;
  pending: boolean;
  /** Anything actionable right now (connected + eligible + not done). */
  actionable: boolean;
}

/**
 * What still needs syncing for a session, given the current connection context.
 * Calendar requires a start time; workbook requires a linked workbook. A session
 * with neither eligible reads as fully synced (nothing to do).
 */
export function computeSyncState(session: TCmActivity, ctx: SyncContext): SyncState {
  const calendarEligible = !!session.startTime;
  const workbookEligible = ctx.customerHasWorkbook;

  const needsCalendar = calendarEligible && !session.calendarSynced;
  const needsWorkbook = workbookEligible && !session.workbookSynced;

  const actionable =
    (needsCalendar && ctx.calendarConnected) || (needsWorkbook && ctx.driveConnected);

  return {
    needsCalendar,
    needsWorkbook,
    pending: needsCalendar || needsWorkbook,
    actionable,
  };
}

// ── Sync execution ───────────────────────────────────────────────────────────

export interface SyncResult {
  calendar: "ok" | "skip" | "not_connected" | "error";
  workbook: "ok" | "skip" | "not_connected" | "not_linked" | "error";
  errors: string[];
  /** True when every attempted push succeeded (nothing left pending+actionable). */
  ok: boolean;
}

/**
 * Push a session to whichever integrations are eligible-and-incomplete. Safe to
 * re-run: calendar dedupes server-side on activityId; workbook is gated on the
 * workbookSynced flag (the caller flips it false to force a re-push on edit).
 */
export async function syncSession(
  session: TCmActivity,
  ctx: SyncContext,
  opts?: {
    linkedGoals?: number[];
    useTodayDate?: boolean;
    /** Restrict which pushes run (offline-draft flush honors the saved intent). */
    only?: { calendar?: boolean; workbook?: boolean };
  },
): Promise<SyncResult> {
  const base = computeSyncState(session, ctx);
  const state = {
    ...base,
    needsCalendar: base.needsCalendar && opts?.only?.calendar !== false,
    needsWorkbook: base.needsWorkbook && opts?.only?.workbook !== false,
  };
  const errors: string[] = [];
  let calendar: SyncResult["calendar"] = "skip";
  let workbook: SyncResult["workbook"] = "skip";

  // ── Calendar ──
  if (state.needsCalendar) {
    if (!ctx.calendarConnected) {
      calendar = "not_connected";
    } else {
      try {
        await GoogleIntegrations.postCalendarEvent({
          customerName: session.customerName ?? "Customer",
          type: session.type,
          date: session.date,
          startTime: session.startTime || undefined,
          endTime: session.endTime || undefined,
          note: session.note || undefined,
          activityId: session.id,
        });
        calendar = "ok";
      } catch (err) {
        calendar = "error";
        errors.push(`Calendar: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }

  // ── Workbook ──
  if (state.needsWorkbook) {
    if (!ctx.driveConnected) {
      workbook = "not_connected";
    } else {
      try {
        const values = buildProgressNoteValues({
          session,
          staffName: ctx.staffName,
          staffInitial: ctx.staffInitial,
          linkedGoals: opts?.linkedGoals ?? [],
          useTodayDate: opts?.useTodayDate,
        });
        const resp = await GoogleIntegrations.pushWorkbookRow({
          customerId: session.customerId,
          entityId: "progressNotes",
          values,
        });
        if (resp.ok) {
          workbook = "ok";
          try {
            await updateDoc(doc(db, "cmActivities", session.id), {
              workbookSynced: true,
              workbookSyncedAt: new Date().toISOString(),
              ...(resp.rowKey ? { workbookRowKey: resp.rowKey } : {}),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // Non-fatal: the row is in the sheet even if the flag write failed.
          }
        } else if (resp.error === "workbook_not_linked") {
          workbook = "not_linked";
        } else if (resp.error === "google_not_connected") {
          workbook = "not_connected";
        } else {
          workbook = "error";
          errors.push(`Workbook: ${resp.error ?? "failed"}`);
        }
      } catch (err) {
        workbook = "error";
        errors.push(`Workbook: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }

  // "ok" means nothing actionable was left unfinished. A push that couldn't run
  // because the integration is disconnected is NOT ok (still pending); a "skip"
  // (not eligible) or "not_linked" (no workbook to push to) is fine.
  const calendarOk = calendar === "ok" || calendar === "skip";
  const workbookOk = workbook === "ok" || workbook === "skip" || workbook === "not_linked";
  const ok = calendarOk && workbookOk;
  return { calendar, workbook, errors, ok };
}
