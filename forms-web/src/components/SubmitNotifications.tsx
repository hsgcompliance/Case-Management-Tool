import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listWebhookEvents, type WebhookEventItem } from "@/lib/webhookEventsApi";
import {
  clearIntakeSessions,
  listIntakeSessions,
  onIntakeSessionsChange,
  removeIntakeSession,
  sessionCustomer,
  type IntakeSession,
} from "@/lib/intakeSessions";
import { intakeTypeLabel, intakeTypesLabel } from "@/lib/formsCatalog";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { useCatalog } from "@/hooks/useCatalog";

// Header notification bell. Two sections:
//   • Active intakes — my in-progress intake sessions (local registry; click to
//     resume, ✕ to drop, Clear to wipe — nothing is persisted server-side).
//   • Watched submissions — forms flagged "Notify on submit" (Forms admin),
//     last 7 days, with quick links into the Jotform inbox.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_MS = 5 * 60_000;

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SubmitNotifications() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const { setCustomer } = useCurrentCustomer();
  const [events, setEvents] = useState<WebhookEventItem[]>([]);
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const notifyForms = useMemo(
    () => new Map(catalog.filter((f) => f.notifyOnSubmit).map((f) => [f.id, f.title])),
    [catalog]
  );

  useEffect(() => {
    const refresh = () => setSessions(listIntakeSessions());
    refresh();
    return onIntakeSessionsChange(refresh);
  }, []);

  const incompleteIntakes = useMemo(
    () => sessions.filter((s) => s.doneCount < s.totalSteps).length,
    [sessions]
  );

  const resumeIntake = (s: IntakeSession) => {
    const c = sessionCustomer(s);
    if (c) setCustomer(c);
    setOpen(false);
    navigate("/staff/intake");
  };

  useEffect(() => {
    const load = () => { listWebhookEvents(100).then(setEvents).catch(() => {}); };
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return events.filter((e) => {
      if (!notifyForms.has(e.formId) || !e.receivedAtISO) return false;
      const t = new Date(e.receivedAtISO).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
  }, [events, notifyForms]);

  const inboxFormIds = useMemo(() => [...new Set(items.map((i) => i.formId))], [items]);

  const badgeCount = items.length + incompleteIntakes;

  if (notifyForms.size === 0 && sessions.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Active intakes + watched form submissions"
        className="relative rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
      >
        🔔
        {badgeCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
            {badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Active intakes{incompleteIntakes ? ` (${incompleteIntakes})` : ""}
            </span>
            {sessions.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Clear ALL intake sessions from this list? (Step progress itself is kept.)")) {
                    clearIntakeSessions();
                  }
                }}
                className="text-[10px] font-semibold text-slate-400 hover:text-rose-600"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="max-h-56 overflow-y-auto border-b border-slate-100">
            {sessions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No intake sessions yet — progress on the Intake tab lands here.
              </div>
            ) : (
              sessions.map((s) => {
                const complete = s.doneCount >= s.totalSteps;
                return (
                  <div
                    key={s.customerId ?? "no-customer"}
                    className="flex items-center gap-2 border-b border-slate-50 px-3 py-2 last:border-0 hover:bg-indigo-50/50"
                  >
                    <button type="button" onClick={() => resumeIntake(s)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                          {s.customerName || "No customer linked yet"}
                          {s.cwId ? <span className="font-normal text-slate-400"> · {s.cwId}</span> : null}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-semibold ${
                            complete ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {complete ? "✓ complete" : `${s.doneCount}/${s.totalSteps} steps`}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {intakeTypesLabel(s.intakeTypes) || intakeTypeLabel(s.intakeType) || "Intake"} · {shortDate(s.updatedAtISO)} · resume →
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIntakeSession(s.customerId)}
                      title="Remove from active intakes (keeps step progress)"
                      className="shrink-0 rounded px-1 text-xs font-bold text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Watched submissions · last 7 days
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                No submissions in the last 7 days
                {notifyForms.size ? ` for ${[...notifyForms.values()].join(", ")}` : ""}.
              </div>
            ) : (
              items.map((it) => (
                <a
                  key={it.id}
                  href={
                    it.submissionId
                      ? `https://www.jotform.com/inbox/${it.formId}/${it.submissionId}`
                      : `https://www.jotform.com/inbox/${it.formId}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border-b border-slate-50 px-3 py-2 last:border-0 hover:bg-indigo-50/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                      {it.submitterName || "(no name)"}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{shortDate(it.receivedAtISO)}</span>
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {notifyForms.get(it.formId)} · open in Jotform inbox ↗
                  </div>
                </a>
              ))
            )}
          </div>
          {inboxFormIds.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2">
              {inboxFormIds.map((id) => (
                <a
                  key={id}
                  href={`https://www.jotform.com/inbox/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  {notifyForms.get(id) || `Form ${id}`} inbox ↗
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
