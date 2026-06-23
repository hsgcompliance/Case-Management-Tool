import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { useCalendarIntegration, useDriveIntegration } from "@/hooks/useCalendarIntegration";
import { qk } from "@/hooks/queryKeys";
import {
  computeSyncState,
  syncSession,
  type SyncContext,
  type SyncResult,
  type SyncState,
} from "@/lib/sessionSync";
import { staffInitials } from "@/lib/sessionSync";
import type { TCmActivity } from "@hdb/contracts";

export interface UseSessionSyncOptions {
  /** Whether the (single) customer in view has a linked TSS workbook. */
  customerHasWorkbook: boolean;
}

/**
 * Wraps the sync engine with connection context + React Query invalidation, and
 * tracks which sessions are currently syncing. Powers the per-row Sync/Retry
 * button and the "Sync all" button — same engine, same semantics.
 */
export function useSessionSync(user: User | null, options: UseSessionSyncOptions) {
  const qc = useQueryClient();
  const calendar = useCalendarIntegration(user);
  const drive = useDriveIntegration(user);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncAllRunning, setSyncAllRunning] = useState(false);

  // Single memoized context — stable identity unless an input actually changes,
  // so the callbacks below can depend on just [ctx] (no per-field dep lists).
  const ctx = useMemo<SyncContext>(
    () => ({
      calendarConnected: calendar.connected,
      driveConnected: drive.connected,
      customerHasWorkbook: options.customerHasWorkbook,
      staffName: (user?.displayName ?? "").trim(),
      staffInitial: staffInitials(user?.displayName),
    }),
    [calendar.connected, drive.connected, options.customerHasWorkbook, user?.displayName],
  );

  const stateFor = useCallback(
    (session: TCmActivity): SyncState => computeSyncState(session, ctx),
    [ctx],
  );

  const setSyncing = (id: string, on: boolean) =>
    setSyncingIds((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const syncOne = useCallback(
    async (
      session: TCmActivity,
      opts?: { linkedGoals?: number[]; useTodayDate?: boolean; only?: { calendar?: boolean; workbook?: boolean } },
    ): Promise<SyncResult> => {
      setSyncing(session.id, true);
      try {
        const result = await syncSession(session, ctx, opts);
        await qc.invalidateQueries({ queryKey: qk.cmActivities.root });
        if (result.calendar === "ok") void calendar.invalidate();
        return result;
      } finally {
        setSyncing(session.id, false);
      }
    },
    // ctx has stable identity (useMemo); qc/calendar refs are intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx],
  );

  const syncAll = useCallback(
    async (sessions: TCmActivity[]): Promise<{ synced: number; failed: number }> => {
      // Only sessions with something actionable — skip already-synced / ineligible.
      const targets = sessions.filter((s) => computeSyncState(s, ctx).actionable);
      if (!targets.length) return { synced: 0, failed: 0 };

      setSyncAllRunning(true);
      let synced = 0;
      let failed = 0;
      try {
        // Sequential — don't hammer Sheets/Calendar, and keep writes ordered.
        for (const session of targets) {
          setSyncing(session.id, true);
          try {
            const result = await syncSession(session, ctx);
            if (result.ok) synced++;
            else failed++;
          } catch {
            failed++;
          } finally {
            setSyncing(session.id, false);
          }
        }
        await qc.invalidateQueries({ queryKey: qk.cmActivities.root });
        void calendar.invalidate();
      } finally {
        setSyncAllRunning(false);
      }
      return { synced, failed };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx],
  );

  /** How many of the given sessions still have actionable pending pushes. */
  const pendingCount = useCallback(
    (sessions: TCmActivity[]): number => sessions.filter((s) => computeSyncState(s, ctx).actionable).length,
    [ctx],
  );

  return {
    stateFor,
    syncOne,
    syncAll,
    pendingCount,
    isSyncing: (id: string) => syncingIds.has(id),
    syncAllRunning,
    calendarConnected: calendar.connected,
    driveConnected: drive.connected,
  };
}
