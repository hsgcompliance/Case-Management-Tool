import { useEffect, useMemo, useState } from "react";
import { listWebhookEvents, type WebhookEventItem } from "@/lib/webhookEventsApi";
import { formById } from "@/lib/formsCatalog";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { matchName, type NameMatch } from "@/lib/nameMatch";
import { WebhookDestinations } from "@/components/WebhookDestinations";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function MatchBadge({ match, activeName }: { match: NameMatch; activeName: string }) {
  if (match === "exact") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Matches {activeName}</span>;
  }
  if (match === "partial") {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">~ Partial match</span>;
  }
  return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">⚠ Different name</span>;
}

export default function WebhookEventsPage() {
  const { customer } = useCurrentCustomer();
  const [items, setItems] = useState<WebhookEventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchOnly, setMatchOnly] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    listWebhookEvents(50)
      .then(setItems)
      .catch((e: unknown) => setError((e as Error)?.message || "Failed to load webhook events."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const rows = useMemo(() => {
    const list = (items ?? []).map((it) => ({
      it,
      match: customer ? matchName(it.submitterName, customer.name) : ("none" as NameMatch),
    }));
    if (!customer || !matchOnly) return list;
    return list.filter((r) => r.match !== "none");
  }, [items, customer, matchOnly]);

  return (
    <div>
      <div className="mb-3">
        <WebhookDestinations />
      </div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Webhook events</h2>
          <p className="text-xs text-slate-500">
            Live Jotform captures.{" "}
            {customer ? <span>Matching against <b>{customer.name}</b>.</span> : <span>Select a customer to name-match.</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {customer ? (
        <label className="mb-3 inline-flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={matchOnly} onChange={(e) => setMatchOnly(e.target.checked)} />
          Only show submissions matching {customer.name}
        </label>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : loading && !items ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {items && items.length > 0 && customer && matchOnly
            ? `No submissions matching ${customer.name}.`
            : "No webhook events yet. Submit a form whose webhook points at our receiver."}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ it, match }) => (
            <li key={it.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {it.submitterName || "(no name found)"}
                    </span>
                    {customer ? <MatchBadge match={match} activeName={customer.name} /> : null}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {formById(it.formId)?.title || `Form ${it.formId || "—"}`} · {it.answerKeys} fields
                    {it.submissionId ? ` · sub ${it.submissionId}` : ""}
                  </div>
                  {it.pretty ? (
                    <div className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-slate-600">{it.pretty}</div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-[11px] text-slate-400">{shortDate(it.receivedAtISO)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
