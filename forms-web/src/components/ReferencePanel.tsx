import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { formatDob } from "@/lib/format";

// Blank right-side reference section shown alongside an open form. Intentionally
// minimal for now — a staging area for the reference details that will support
// filling out the form (customer facts, prior answers, prefill hints). Today it
// echoes the current customer (so the key facts stay in view next to the iframe)
// and reserves space for future reference blocks.

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="truncate text-right text-sm font-medium text-slate-800">{value || "—"}</span>
    </div>
  );
}

export function ReferencePanel({ className = "" }: { className?: string }) {
  const { customer } = useCurrentCustomer();

  return (
    <aside className={`space-y-3 ${className}`}>
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reference</div>
        {customer ? (
          <div className="mt-2">
            <Line label="Name" value={customer.name} />
            <Line label="CWID" value={customer.cwId ?? "—"} />
            <Line label="DOB" value={formatDob(customer.dob)} />
            <Line label="Case manager" value={customer.caseManagerName ?? "—"} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            Set a current customer above to keep their details in view while you fill out the form.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes &amp; reference details</div>
        <p className="mt-2 text-xs text-slate-400">
          This space is reserved for reference details that help fill out the form — prior answers,
          prefill hints, and linked documents will surface here.
        </p>
      </div>
    </aside>
  );
}
