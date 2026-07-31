import { useCallback, useEffect, useState } from "react";
import { loadUsers, type FormsUser } from "@/lib/usersApi";
import { saveRemoteIntakeFlow, transferIntakeFlow, type IntakeFlowProgress } from "@/lib/intakeFlowsApi";
import { removeIntakeProgress, removeIntakeSession, type IntakeSession } from "@/lib/intakeSessions";

/**
 * Floating left-side actions menu shown on every intake step: explicit
 * "Save progress" (bypasses the normal 3-checkpoint gate) and "Send to
 * person" (hands the whole in-progress intake off to another case manager),
 * so an intake can be picked up by anyone at any point.
 */
export function IntakeActionsMenu({
  session,
  progress,
  onSent,
}: {
  session: IntakeSession;
  progress: IntakeFlowProgress;
  onSent?: () => void;
}) {
  const [users, setUsers] = useState<FormsUser[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetUid, setTargetUid] = useState("");
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    void loadUsers().then(setUsers);
  }, [pickerOpen]);

  const handleSave = useCallback(async () => {
    setBusy("save");
    setSaved(false);
    try {
      await saveRemoteIntakeFlow(session, progress);
      setSaved(true);
    } catch (err) {
      window.alert(`Could not save progress: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setBusy(null);
    }
  }, [session, progress]);

  const handleSend = useCallback(async () => {
    if (!targetUid) return;
    const target = users.find((u) => u.uid === targetUid);
    const ok = window.confirm(
      `Send ${session.customerName || "this intake"} to ${target?.name || "the selected person"}? It will leave your active intakes.`
    );
    if (!ok) return;
    setBusy("send");
    try {
      await transferIntakeFlow(targetUid, session, progress);
      removeIntakeSession(session.customerId);
      removeIntakeProgress(session.customerId);
      setPickerOpen(false);
      setTargetUid("");
      onSent?.();
    } catch (err) {
      window.alert(`Could not send: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setBusy(null);
    }
  }, [targetUid, users, session, progress, onSent]);

  return (
    <div className="fixed left-3 top-1/3 z-40 hidden lg:block">
      <div className="w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-md">
        <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Actions</div>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null}
          className="block w-full rounded-md border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {saved ? "✓ Saved" : "Save progress"}
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={busy !== null}
          className="mt-1.5 block w-full rounded-md border border-slate-200 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Send to person
        </button>
        {pickerOpen ? (
          <div className="mt-1.5 space-y-1.5 border-t border-slate-100 pt-1.5">
            <select
              value={targetUid}
              onChange={(e) => setTargetUid(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-1.5 py-1 text-xs"
            >
              <option value="">Choose person…</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>{u.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSend}
              disabled={!targetUid || busy !== null}
              className="block w-full rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
