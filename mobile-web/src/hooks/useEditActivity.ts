import { useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import type { TCmActivity, TCmActivityType } from "@hdb/contracts";

export interface SessionEditFields {
  type: TCmActivityType;
  date: string;
  startTime?: string;
  endTime?: string;
  note?: string;
}

/** Fields that, when changed, make the synced calendar event / workbook row stale. */
function contentChanged(before: TCmActivity, after: SessionEditFields): boolean {
  return (
    before.type !== after.type ||
    before.date !== after.date ||
    (before.startTime ?? "") !== (after.startTime ?? "") ||
    (before.endTime ?? "") !== (after.endTime ?? "") ||
    (before.note ?? "") !== (after.note ?? "")
  );
}

/**
 * Edit a session. Smart re-sync: when content changes, the affected integration
 * flags are flipped so the row reads as "needs sync" again and a follow-up sync
 * updates the calendar event in place (and, if `updateWorkbook`, re-pushes a
 * corrected progress note). Returns the updated session so the caller can run the
 * sync engine on it.
 */
export function useEditActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      session: TCmActivity;
      fields: SessionEditFields;
      /** Re-push the corrected note to the workbook (default false). */
      updateWorkbook: boolean;
    }): Promise<TCmActivity> => {
      const { session, fields, updateWorkbook } = args;
      const changed = contentChanged(session, fields);

      // Reset calendar flag when content changed and it was synced → the next
      // sync patches the existing event (keeps calendarEventId for in-place update).
      const resetCalendar = changed && session.calendarSynced === true;
      // Reset workbook flag only when the user opts to update the workbook.
      const resetWorkbook = updateWorkbook;

      const patch: Record<string, unknown> = {
        type: fields.type,
        date: fields.date,
        startTime: fields.startTime ?? null,
        endTime: fields.endTime ?? null,
        note: fields.note ?? null,
        updatedAt: serverTimestamp(),
        ...(resetCalendar ? { calendarSynced: false } : {}),
        ...(resetWorkbook ? { workbookSynced: false } : {}),
      };

      await updateDoc(doc(db, "cmActivities", session.id), patch);

      return {
        ...session,
        ...fields,
        startTime: fields.startTime,
        endTime: fields.endTime,
        note: fields.note,
        ...(resetCalendar ? { calendarSynced: false } : {}),
        ...(resetWorkbook ? { workbookSynced: false } : {}),
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cmActivities.root });
    },
  });
}

/**
 * Delete a session. Hard-deletes the cmActivities doc. Note: any calendar event
 * or workbook progress-note row already pushed is NOT removed (workbook is
 * append-only; calendar cleanup is out of scope) — deletion only removes the app
 * record.
 */
export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => deleteDoc(doc(db, "cmActivities", sessionId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cmActivities.root });
    },
  });
}
