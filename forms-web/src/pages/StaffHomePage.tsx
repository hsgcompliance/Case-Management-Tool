import { useEffect, useState } from "react";
import { listFormSessions, type FormSessionListItem } from "@/lib/formSessionsApi";
import { centsToUsd } from "@/lib/format";

const WORKFLOW_LABELS: Record<string, string> = {
  "credit-card-checkout": "CC checkout",
  "invoice-request": "Invoice",
  "credit-card-status": "CC status",
  "customer-prefill": "Customer",
};

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s === "completed" || s === "submitted"
      ? "bg-emerald-100 text-emerald-700"
      : s === "expired" || s === "revoked"
        ? "bg-slate-200 text-slate-600"
        : "bg-amber-100 text-amber-700";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${tone}`}>{status || "—"}</span>;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function StaffHomePage() {
  const [items, setItems] = useState<FormSessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    listFormSessions({ limit: 50 })
      .then((rows) => setItems(rows))
      .catch((e: unknown) => setError((e as Error)?.message || "Failed to load form sessions."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Recent form sessions</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : loading && !items ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : !items || items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No form sessions yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                        {WORKFLOW_LABELS[it.workflowId] || it.workflowId}
                      </span>
                      <StatusPill status={it.status} />
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {it.customerName || "—"}
                      {it.amountCents != null ? <span className="ml-2 font-normal text-slate-500">{centsToUsd(it.amountCents)}</span> : null}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {[it.grantName, it.vendor, it.paymentMonth].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-slate-400">
                    <div>{shortDate(it.createdAt)}</div>
                    {it.jotformSubmissionId ? (
                      <div className="mt-1 font-mono text-slate-500">sub {it.jotformSubmissionId}</div>
                    ) : (
                      <div className="mt-1">no submission</div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
