import { useEffect, useMemo, useState } from "react";
import { listWebhookEvents, type WebhookEventItem } from "@/lib/webhookEventsApi";
import { formById } from "@/lib/formsCatalog";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { matchName, type NameMatch } from "@/lib/nameMatch";
import { WebhookDestinations } from "@/components/WebhookDestinations";
import { getCustomerDetail } from "@/lib/customerDetailApi";
import { ExternalServiceIcon } from "@/components/ui";

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
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [folderUrl, setFolderUrl] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    listWebhookEvents(50)
      .then(setItems)
      .catch((e: unknown) => setError((e as Error)?.message || "Failed to load webhook events."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    let active = true;
    setFolderUrl(null);
    if (!customer) return () => { active = false; };
    getCustomerDetail(customer.id).then((detail) => {
      if (active) setFolderUrl(detail?.driveFolderUrl ?? null);
    });
    return () => { active = false; };
  }, [customer]);

  const rows = useMemo(() => {
    const list = (items ?? []).map((it) => ({
      it,
      match: customer ? matchName(it.submitterName, customer.name) : ("none" as NameMatch),
    }));
    const matched = !customer || !matchOnly ? list : list.filter((r) => r.match !== "none");
    const query = search.trim().toLocaleLowerCase();
    if (!query) return matched;
    return matched.filter(({ it }) =>
      [it.submitterName, formById(it.formId)?.title, it.submissionId, it.pretty]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query))
    );
  }, [items, customer, matchOnly, search]);

  const groups = useMemo(() => {
    const byName = new Map<string, { key: string; name: string; match: NameMatch; rows: typeof rows }>();
    for (const row of rows) {
      const name = row.it.submitterName.trim() || "No name found";
      const key = name.toLocaleLowerCase();
      const existing = byName.get(key);
      if (existing) existing.rows.push(row);
      else byName.set(key, { key, name, match: row.match, rows: [row] });
    }
    return [...byName.values()];
  }, [rows]);

  const toggleGroup = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-3">
        <WebhookDestinations />
      </div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Live submissions</h2>
          <p className="text-xs text-slate-500">
            Recent Jotform captures grouped by customer name.{" "}
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
          <div className="min-w-0 text-sm text-indigo-950">
            Active customer: <b>{customer.name}</b>{customer.cwId ? <span className="text-indigo-500"> · {customer.cwId}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            {folderUrl ? (
              <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
                <ExternalServiceIcon href={folderUrl} />
                Customer folder
              </a>
            ) : null}
            <label className="inline-flex items-center gap-2 text-xs font-medium text-indigo-800">
              <input className="h-4 w-4 rounded border-indigo-300 text-indigo-600" type="checkbox" checked={matchOnly} onChange={(e) => setMatchOnly(e.target.checked)} />
              Matches only
            </label>
          </div>
        </div>
      ) : null}

      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="block text-xs font-semibold text-slate-600" htmlFor="webhook-search">Search customers and submissions</label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="webhook-search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Name, form, submission ID, or answer…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          {search ? <button type="button" onClick={() => setSearch("")} className="rounded-md px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Clear</button> : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : loading && !items ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {items && items.length > 0 && customer && matchOnly
            ? `No submissions matching ${customer.name}.`
            : "No webhook events yet. Submit a form whose webhook points at our receiver."}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="px-1 text-xs text-slate-400">{groups.length} customer group{groups.length === 1 ? "" : "s"} · {rows.length} submission{rows.length === 1 ? "" : "s"}</div>
          {groups.map((group) => {
            const isOpen = expanded.has(group.key);
            const forms = new Set(group.rows.map(({ it }) => formById(it.formId)?.title || `Form ${it.formId || "—"}`));
            return (
              <section key={group.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <button type="button" onClick={() => toggleGroup(group.key)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <span aria-hidden className={`text-xs text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{group.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{group.rows.length}</span>
                      {customer ? <MatchBadge match={group.match} activeName={customer.name} /> : null}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">{[...forms].join(" · ")}</div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-slate-400">{shortDate(group.rows[0]?.it.receivedAtISO ?? null)}</div>
                </button>
                {isOpen ? (
                  <ul className="divide-y divide-slate-100 border-t border-slate-200">
                    {group.rows.map(({ it }) => (
                      <li key={it.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-700">{formById(it.formId)?.title || `Form ${it.formId || "—"}`}</div>
                            <div className="text-[11px] text-slate-400">{it.answerKeys} fields{it.submissionId ? ` · submission ${it.submissionId}` : ""}</div>
                            {it.pretty ? <div className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{it.pretty}</div> : null}
                          </div>
                          <div className="shrink-0 text-[11px] text-slate-400">{shortDate(it.receivedAtISO)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
