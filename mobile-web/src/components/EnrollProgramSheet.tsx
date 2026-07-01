import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGrants, type Grant } from "@/hooks/useGrants";
import { useEnrollCustomer } from "@/hooks/useEnrollCustomer";
import type { Customer } from "@/hooks/useCustomers";
import type { Enrollment } from "@/hooks/useCustomerEnrollments";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isActiveEnrollment(e: Enrollment): boolean {
  if (e.deleted === true) return false;
  const s = String(e.status ?? "").toLowerCase();
  return e.active === true || s === "active";
}

export function EnrollProgramSheet({
  customer,
  enrollments,
  onClose,
  onEnrolled,
}: {
  customer: Customer;
  enrollments: Enrollment[];
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const { user } = useAuth();
  const { data: grants = [], isLoading } = useGrants(user);
  const enroll = useEnrollCustomer();

  const activeGrantIds = useMemo(
    () => new Set(enrollments.filter(isActiveEnrollment).map((e) => e.grantId).filter(Boolean) as string[]),
    [enrollments],
  );

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Grant | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grants;
    return grants.filter((g) => g.name.toLowerCase().includes(q));
  }, [grants, search]);

  const grantsSection = filtered.filter((g) => g.kind === "grant");
  const programsSection = filtered.filter((g) => g.kind !== "grant");

  function selectGrant(g: Grant) {
    if (activeGrantIds.has(g.id)) return;
    setError(null);
    setSelected(g);
    setStartDate(todayISO());
    setEndDate(g.endDate ?? "");
  }

  async function handleEnroll() {
    if (!selected) return;
    setError(null);
    try {
      await enroll.mutateAsync({
        customerId: customer.id,
        customerName: customer.name,
        grantId: selected.id,
        grantName: selected.name,
        startDate: startDate || todayISO(),
        endDate: endDate || undefined,
        caseManagerId: customer.caseManagerId,
        caseManagerName: customer.caseManagerName,
      });
      onEnrolled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to enroll customer.");
    }
  }

  function GrantRow({ grant }: { grant: Grant }) {
    const already = activeGrantIds.has(grant.id);
    const isSelected = selected?.id === grant.id;
    return (
      <button
        type="button"
        disabled={already}
        onClick={() => selectGrant(grant)}
        className={`w-full text-left rounded-2xl border p-3.5 transition-colors ${
          already
            ? "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
            : isSelected
              ? "border-indigo-300 bg-indigo-50"
              : "border-slate-100 bg-white active:bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 leading-snug flex-1">{grant.name}</p>
          <span
            className={`text-xs font-semibold flex-shrink-0 px-2 py-0.5 rounded-full ${
              already ? "bg-slate-200 text-slate-500" : isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {already ? "Active" : isSelected ? "Selected" : "Select"}
          </span>
        </div>
        {grant.endDate && <p className="text-xs text-slate-400 mt-0.5">Ends {grant.endDate}</p>}
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe-bottom max-h-[90vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Enroll in Program</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-3 flex-shrink-0">
          <input
            type="search"
            placeholder="Search grants and programs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 flex flex-col gap-4">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {grantsSection.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Grants</p>
                  <div className="flex flex-col gap-2">
                    {grantsSection.map((g) => (
                      <GrantRow key={g.id} grant={g} />
                    ))}
                  </div>
                </div>
              )}
              {programsSection.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Programs</p>
                  <div className="flex flex-col gap-2">
                    {programsSection.map((g) => (
                      <GrantRow key={g.id} grant={g} />
                    ))}
                  </div>
                </div>
              )}
              {filtered.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">No active grants or programs found.</p>
              )}
            </>
          )}
        </div>

        {selected && (
          <div className="px-5 pt-3 pb-2 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">End date</label>
                <input
                  type="date"
                  value={endDate}
                  max={selected.endDate ?? undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => void handleEnroll()}
              disabled={enroll.isPending}
              className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {enroll.isPending ? "Enrolling…" : `Enroll in ${selected.name}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
