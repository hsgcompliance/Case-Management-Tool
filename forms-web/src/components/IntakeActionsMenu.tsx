import { useCallback, useEffect, useRef, useState } from "react";
import { complianceFirst, loadUsers, type FormsUser } from "@/lib/usersApi";
import { saveRemoteIntakeFlow, transferIntakeFlow, type IntakeFlowProgress } from "@/lib/intakeFlowsApi";
import { removeIntakeProgress, removeIntakeSession, type IntakeSession } from "@/lib/intakeSessions";

/**
 * Intake actions available on every step: explicit "Save progress" (bypasses
 * the normal 3-checkpoint gate) and "Send to person" (hands the whole
 * in-progress intake off to another staff member), so an intake can be picked
 * up by anyone at any point.
 *
 * Desktop: a floating card, draggable by its "Actions ⠿" header (position
 * persists per browser). Small screens: a fixed bottom bar — previously the
 * menu was simply hidden below lg, so phones had no save/send at all.
 */

const POS_KEY = "hdb:forms:intake-actions-pos";

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof p.x !== "number" || typeof p.y !== "number") return null;
    return { x: p.x, y: p.y };
  } catch {
    return null;
  }
}

function clampPos(p: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.min(Math.max(p.x, 0), Math.max(0, window.innerWidth - 176)),
    y: Math.min(Math.max(p.y, 0), Math.max(0, window.innerHeight - 120)),
  };
}

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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => loadPos());
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    void loadUsers().then(setUsers);
  }, [pickerOpen]);

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setPos(clampPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy }));
  };
  const onDragEnd = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPos((p) => {
      if (p) try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
      return p;
    });
  };

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

  const sendPicker = (compact: boolean) => (
    <>
      <select
        value={targetUid}
        onChange={(e) => setTargetUid(e.target.value)}
        className={compact
          ? "min-w-0 flex-1 rounded-md border border-slate-300 px-1.5 py-1.5 text-xs"
          : "w-full rounded-md border border-slate-300 px-1.5 py-1 text-xs"}
      >
        <option value="">Choose person…</option>
        {(() => {
          const { compliance, others } = complianceFirst(users);
          const opt = (u: FormsUser) => <option key={u.uid} value={u.uid}>{u.name}</option>;
          return compliance.length ? (
            <>
              <optgroup label="Compliance">{compliance.map(opt)}</optgroup>
              <optgroup label="All staff">{others.map(opt)}</optgroup>
            </>
          ) : (
            others.map(opt)
          );
        })()}
      </select>
      <button
        type="button"
        onClick={handleSend}
        disabled={!targetUid || busy !== null}
        className={`rounded-md bg-indigo-600 px-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 ${compact ? "py-1.5" : "block w-full py-1"}`}
      >
        Send
      </button>
    </>
  );

  return (
    <>
      {/* Desktop: floating draggable card. */}
      <div
        ref={cardRef}
        className="fixed z-40 hidden lg:block"
        style={pos ? { left: pos.x, top: pos.y } : { left: 12, top: "33vh" }}
      >
        <div className="w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-md">
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            title="Drag to move this menu"
            className="flex cursor-grab items-center justify-between px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 active:cursor-grabbing"
          >
            <span>Actions</span>
            <span aria-hidden className="text-slate-300">⠿</span>
          </div>
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
              {sendPicker(false)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Small screens: fixed bottom action bar (the menu used to be hidden entirely). */}
      <div className="fixed inset-x-2 bottom-2 z-40 lg:hidden">
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saved ? "✓ Saved" : "Save progress"}
            </button>
            {pickerOpen ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5">{sendPicker(true)}</div>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={busy !== null}
                className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Send to person
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
