import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { loadCustomers, filterCustomers, type FormsCustomer } from "@/lib/customersApi";
import { linkSubmission, type SubmissionLink, type LinkedCustomer } from "@/lib/submissionLinksApi";
import { matchName } from "@/lib/nameMatch";

// "Link to user" for a submission → canonical customers.meta.linkedSubmissions[].
// Recommended match (from the submission's head-of-household name), active customer,
// or search + select. Multiple customers per submission allowed (households).
export function CustomerLinkButton({
  formId,
  formName,
  submissionId,
  recommendName,
  linked,
  onLinked,
}: {
  formId: string;
  formName: string;
  submissionId: string;
  recommendName?: string;
  linked?: SubmissionLink;
  onLinked: (c: LinkedCustomer) => void;
}) {
  const { customer } = useCurrentCustomer();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [all, setAll] = useState<FormsCustomer[] | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => { loadCustomers().then(setAll); }, []);

  const results = useMemo(() => (all && q.trim().length >= 2 ? filterCustomers(all, q, 12) : []), [all, q]);
  const linkedIds = useMemo(() => new Set((linked?.customers ?? []).map((c) => c.customerId)), [linked]);

  const recommended = useMemo(() => {
    if (!all || !recommendName || recommendName.trim().length < 3) return null;
    let exact: FormsCustomer | null = null;
    let partial: FormsCustomer | null = null;
    for (const c of all) {
      const m = matchName(recommendName, c.name);
      if (m === "exact") { exact = c; break; }
      if (m === "partial" && !partial) partial = c;
    }
    const pick = exact || partial;
    return pick && !linkedIds.has(pick.id) ? pick : null;
  }, [all, recommendName, linkedIds]);

  const link = async (c: { id: string; name: string; cwId: string | null }) => {
    setSaving(true);
    try {
      await linkSubmission({ formId, formName, submissionId, customerId: c.id, customerName: c.name, cwId: c.cwId });
      onLinked({ customerId: c.id, customerName: c.name, cwId: c.cwId });
      setOpen(false);
      setQ("");
    } finally {
      setSaving(false);
    }
  };

  const linkedLabel = (linked?.customers ?? []).map((c) => c.customerName || c.customerId).join(", ");

  return (
    <div className="flex items-center gap-2">
      {recommended ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void link({ id: recommended.id, name: recommended.name, cwId: recommended.cwId })}
          title="Recommended from the submission's name"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          ✨ Link {recommended.name}
        </button>
      ) : null}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`max-w-[280px] truncate rounded-lg border px-3 py-1.5 text-xs font-semibold ${linkedIds.size ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          title={linkedIds.size ? `Linked: ${linkedLabel}` : undefined}
        >
          {linkedIds.size ? `Linked: ${linkedLabel}` : "Link to customer"}
        </button>
        {open ? (
          <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            {customer && !linkedIds.has(customer.id) ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void link({ id: customer.id, name: customer.name, cwId: customer.cwId })}
                className="mb-1 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-left text-xs font-semibold text-white disabled:opacity-50"
              >
                Link to active: {customer.name}
              </button>
            ) : !customer ? (
              <div className="mb-1 px-1 text-[11px] text-slate-400">No active customer selected.</div>
            ) : null}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer to link…"
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
            />
            {q.trim().length >= 2 ? (
              <div className="mt-1 max-h-44 overflow-auto">
                {results.length === 0 ? (
                  <div className="px-1 py-1 text-[11px] text-slate-400">No matches.</div>
                ) : (
                  results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={saving || linkedIds.has(c.id)}
                      onClick={() => void link(c)}
                      className="block w-full truncate rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-indigo-50 disabled:opacity-40"
                    >
                      {c.name}{c.cwId ? <span className="text-slate-400"> · {c.cwId}</span> : null}{linkedIds.has(c.id) ? " ✓" : ""}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
