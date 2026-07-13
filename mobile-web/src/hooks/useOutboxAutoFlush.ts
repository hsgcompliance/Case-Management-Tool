// Auto-sync for the offline session outbox.
//
// Mounted once in the app shell: whenever the app is (or comes back) online and
// the signed-in user has queued offline drafts, each draft is flushed — the real
// cmActivities doc is created, then the calendar/workbook pushes run per the
// intent captured at save time. A draft is removed once its doc exists; push
// failures stay retryable from the session row (per-row Sync), matching the
// manual flush on the customer's Sessions tab.
//
// Also powers the "Sync now" banner on the Activity feed.

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { useCalendarIntegration, useDriveIntegration } from "@/hooks/useCalendarIntegration";
import { createActivity } from "@/hooks/useCreateActivity";
import { qk } from "@/hooks/queryKeys";
import { isOnline, listOutbox, removeOutbox, subscribeOutbox, type OutboxEntry } from "@/lib/sessionOutbox";
import { staffInitials, syncSession } from "@/lib/sessionSync";
import type { TCmActivity } from "@hdb/contracts";

// Module-level guard: the hook may be mounted more than once (app shell +
// feed banner); only one flush may run at a time or drafts could double-create.
let flushInFlight = false;

async function flushEntry(user: User, draft: OutboxEntry, ctx: { calendarConnected: boolean; driveConnected: boolean }) {
  const id = await createActivity(user, draft.body); // throws → draft stays queued
  const session: TCmActivity = {
    id,
    orgId: "",
    caseManagerId: user.uid,
    caseManagerName: user.displayName ?? "",
    customerId: draft.body.customerId,
    customerName: draft.body.customerName,
    type: draft.body.type,
    date: draft.body.date,
    startTime: draft.body.startTime,
    endTime: draft.body.endTime,
    note: draft.body.note,
    calendarSynced: false,
    workbookSynced: false,
    createdAt: new Date().toISOString(),
  } as TCmActivity;
  // Best-effort pushes per the saved intent. customerHasWorkbook isn't known
  // here — trust the intent; an unlinked workbook fails soft (not_linked).
  await syncSession(session, {
    calendarConnected: ctx.calendarConnected,
    driveConnected: ctx.driveConnected,
    customerHasWorkbook: draft.intent.workbook,
    staffName: (user.displayName ?? "").trim(),
    staffInitial: staffInitials(user.displayName),
  }, {
    linkedGoals: draft.intent.linkedGoals,
    only: { calendar: draft.intent.calendar, workbook: draft.intent.workbook },
  });
  // Doc exists → the draft's job is done, even if a push stayed pending.
  removeOutbox(user.uid, draft.localId);
}

export function useOutboxAutoFlush(user: User | null) {
  const qc = useQueryClient();
  const calendar = useCalendarIntegration(user);
  const drive = useDriveIntegration(user);
  const [flushing, setFlushing] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<OutboxEntry[]>(() => listOutbox(user?.uid));

  // Track the outbox so banners can show a live count.
  useEffect(() => {
    const update = () => setPendingDrafts(listOutbox(user?.uid));
    update();
    return subscribeOutbox(update);
  }, [user?.uid]);

  const flush = useCallback(async () => {
    if (!user || flushInFlight || !isOnline()) return;
    const drafts = listOutbox(user.uid);
    if (!drafts.length) return;
    flushInFlight = true;
    setFlushing(true);
    try {
      for (const draft of drafts) {
        try {
          await flushEntry(user, draft, { calendarConnected: calendar.connected, driveConnected: drive.connected });
        } catch {
          // Create failed (still offline / rules) — keep the draft for later.
        }
      }
      await qc.invalidateQueries({ queryKey: qk.cmActivities.root });
    } finally {
      flushInFlight = false;
      setFlushing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, calendar.connected, drive.connected]);

  // Auto-flush on sign-in/app open and whenever connectivity returns.
  useEffect(() => {
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  return { flush, flushing, pendingDrafts };
}
