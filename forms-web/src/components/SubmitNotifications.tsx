import { useEffect, useMemo, useRef, useState } from "react";
import { listWebhookEvents, type WebhookEventItem } from "@/lib/webhookEventsApi";
import { useCatalog } from "@/hooks/useCatalog";

// Header notification bell for forms flagged "Notify on submit" (Forms admin).
// Deliberately lightweight: no read/unread tracking — just the last 7 days of
// submissions with quick links into the Jotform inbox.

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
  const [events, setEvents] = useState<WebhookEventItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const notifyForms = useMemo(
    () => new Map(catalog.filter((f) => f.notifyOnSubmit).map((f) => [f.id, f.title])),
    [catalog]
  );

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

  if (notifyForms.size === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Watched form submissions (last 7 days)"
        className="relative rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
      >
        🔔
        {items.length > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
            {items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Watched submissions · last 7 days
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                No submissions in the last 7 days for {[...notifyForms.values()].join(", ")}.
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
