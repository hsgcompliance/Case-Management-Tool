import { useEffect, useMemo, useRef, useState } from "react";
import { loadCustomers, filterCustomers, type FormsCustomer } from "@/lib/customersApi";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { CreateCustomerModal } from "./CreateCustomerModal";

// Top-of-page customer search: pick a "current session customer", switch, or clear.
// Loads the minimal customer index once (name/id/CWID) and filters client-side.
// "+ New" opens the quick create/link customer flow.

export function CustomerSearchBar() {
  const { customer, setCustomer } = useCurrentCustomer();
  const [all, setAll] = useState<FormsCustomer[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadCustomers().then((rows) => { if (alive) setAll(rows); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matches = useMemo(() => (all ? filterCustomers(all, q, 12) : []), [all, q]);

  const newButton = (
    <button
      type="button"
      onClick={() => setCreating(true)}
      title="Create a new customer (or link an existing match)"
      className="shrink-0 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
    >
      + New
    </button>
  );

  const modal = creating ? (
    <CreateCustomerModal
      onClose={() => {
        setCreating(false);
        // The modal may have created a customer — refresh the local index copy.
        loadCustomers().then(setAll);
      }}
    />
  ) : null;

  if (customer) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          {customer.name}{customer.cwId ? <span className="font-normal text-indigo-400"> · {customer.cwId}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => { setCustomer(null); setQ(""); setOpen(true); }}
          className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
        >
          Switch
        </button>
        {newButton}
        {modal}
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm items-center gap-2">
      <div ref={boxRef} className="relative min-w-0 flex-1">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={all ? "Search customers (name or CWID)…" : "Loading customers…"}
          disabled={!all}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
        />
        {open && matches.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setCustomer(c); setOpen(false); setQ(""); }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-indigo-50"
              >
                <span className="min-w-0 truncate text-sm text-slate-800">{c.name}{c.cwId ? <span className="text-slate-400"> · {c.cwId}</span> : null}</span>
                {c.caseManagerName ? <span className="shrink-0 text-[11px] text-slate-400">{c.caseManagerName}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {newButton}
      {modal}
    </div>
  );
}
