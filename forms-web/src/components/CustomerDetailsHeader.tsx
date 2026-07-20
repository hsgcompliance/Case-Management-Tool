import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { FormsCustomer } from "@/lib/customersApi";
import { getCustomerDetail, type CustomerDetail } from "@/lib/customerDetailApi";
import { listIntakeSessions, onIntakeSessionsChange, sessionCustomer } from "@/lib/intakeSessions";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { formatDob } from "@/lib/format";
import { listEnrollmentsForCustomer, markCustomerNotEligible, type FormsEnrollment } from "@/lib/rentCertApi";

// Tabbed customer header for the Intake / All forms pages.
//   • Customer tab — the current customer sourced from the customer DOC (not the
//     minimal search index): CWID / Name / DOB / CM / population / status.
//   • Household tab — a first-pass NORMALIZED HOUSEHOLD object: the canonical fields
//     plus the customer's linked Jotform submissions organized by form.
// Details read CurrentCustomer context, so they persist across every iframe form
// view. With `nav` on (Intake), ◀ ▶ step through MY ACTIVE INTAKE customers only
// (the local intake-sessions registry), NOT the full customer index. Other users'
// active intakes would need a backend projection — future enhancement.
//
// Editability + true multi-member family linking + per-form field normalization are
// the noted fine-tuning steps layered on top of this shape.

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate text-sm font-semibold text-slate-900">{value || "—"}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-semibold transition",
        active ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CustomerTab({ detail, fallback }: { detail: CustomerDetail | null; fallback: FormsCustomer }) {
  const name = detail?.name ?? fallback.name;
  const cwId = detail?.cwId ?? fallback.cwId ?? "—";
  const dob = formatDob(detail?.dob ?? fallback.dob);
  const cm = detail?.caseManagerName ?? fallback.caseManagerName ?? "—";
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      <Field label="Name" value={name} />
      <Field label="CWID" value={cwId} />
      <Field label="DOB" value={dob} />
      <Field label="Case manager" value={cm} />
      {detail?.secondaryCaseManagerName ? <Field label="Secondary CM" value={detail.secondaryCaseManagerName} /> : null}
      {detail?.population ? <Field label="Population" value={detail.population} /> : null}
      {detail?.status ? <Field label="Status" value={detail.status} /> : null}
      {detail?.acuityScore != null ? <Field label="Acuity" value={String(detail.acuityScore)} /> : null}
    </div>
  );
}

function HouseholdTab({ detail, loading }: { detail: CustomerDetail | null; loading: boolean }) {
  if (loading && !detail) return <div className="py-2 text-xs text-slate-400">Loading household…</div>;
  const hh = detail?.household;
  if (!hh) return <div className="py-2 text-xs text-slate-400">No household data yet.</div>;

  return (
    <div className="space-y-3">
      {/* Normalized household object */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Normalized household</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {hh.normalized.map((f) => (
            <Field key={f.key} label={f.label} value={f.value} />
          ))}
        </div>
      </div>

      {/* Members */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Members ({hh.memberCount})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hh.members.map((m, i) => (
            <span
              key={`${m.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200"
            >
              <span className="font-semibold text-slate-800">{m.name}</span>
              <span className="text-slate-400">{m.relation}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Linked form inputs, organized by form */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Form inputs ({hh.formCount})
        </div>
        {hh.forms.length === 0 ? (
          <p className="text-xs text-slate-400">
            No linked submissions yet — link a submission to this customer (Submissions tab) to populate the household.
          </p>
        ) : (
          <div className="max-h-44 space-y-1 overflow-auto">
            {hh.forms.map((g) => (
              <div
                key={g.formId || g.formName}
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200"
              >
                <span className="min-w-0 truncate text-xs font-medium text-slate-700">{g.formName}</span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {g.count} {g.count === 1 ? "submission" : "submissions"}
                  {g.latestLinkedAt ? ` · ${g.latestLinkedAt.slice(0, 10)}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CustomerDetailsHeader({ nav = false }: { nav?: boolean }) {
  const { customer, setCustomer } = useCurrentCustomer();
  const [navList, setNavList] = useState<FormsCustomer[] | null>(null);
  const [tab, setTab] = useState<"customer" | "household">("customer");
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [openEnrollments, setOpenEnrollments] = useState<FormsEnrollment[]>([]);
  const [notEligibleOpen, setNotEligibleOpen] = useState(false);
  const [notEligibleEnrollmentId, setNotEligibleEnrollmentId] = useState("");
  const [notEligibleBusy, setNotEligibleBusy] = useState(false);
  const [notEligibleResult, setNotEligibleResult] = useState<string | null>(null);

  // Nav steps through my active intake customers (local sessions registry).
  useEffect(() => {
    if (!nav) return;
    const refresh = () =>
      setNavList(
        listIntakeSessions()
          .map(sessionCustomer)
          .filter((c): c is FormsCustomer => !!c)
      );
    refresh();
    return onIntakeSessionsChange(refresh);
  }, [nav]);

  useEffect(() => {
    if (!customer) { setDetail(null); return; }
    let alive = true;
    setLoading(true);
    getCustomerDetail(customer.id)
      .then((d) => { if (alive) setDetail(d); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customer?.id]);

  useEffect(() => {
    if (!customer) {
      setOpenEnrollments([]);
      return;
    }
    listEnrollmentsForCustomer(customer.id).then(({ enrollments }) => {
      const open = enrollments.filter((row) => row.active && row.status !== "closed");
      setOpenEnrollments(open);
      setNotEligibleEnrollmentId(open[0]?.id || "");
    }).catch(() => setOpenEnrollments([]));
  }, [customer?.id]);

  const markNotEligible = async () => {
    if (!customer || !notEligibleEnrollmentId) return;
    const enrollment = openEnrollments.find((row) => row.id === notEligibleEnrollmentId);
    if (!window.confirm(`Mark ${customer.name} not eligible for ${enrollment?.grantName || "this program"} and close that enrollment?`)) return;
    setNotEligibleBusy(true);
    setNotEligibleResult(null);
    try {
      const result = await markCustomerNotEligible({ customerId: customer.id, enrollmentId: notEligibleEnrollmentId });
      setOpenEnrollments((rows) => rows.filter((row) => row.id !== notEligibleEnrollmentId));
      setNotEligibleOpen(false);
      setNotEligibleResult(result.customerInactivated
        ? "Enrollment closed; customer marked inactive."
        : "Enrollment closed; customer remains active because another enrollment is open.");
      getCustomerDetail(customer.id, true).then(setDetail);
    } catch (error) {
      setNotEligibleResult(`Could not close enrollment: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setNotEligibleBusy(false);
    }
  };

  const index = useMemo(() => {
    if (!nav || !navList || !customer) return -1;
    return navList.findIndex((c) => c.id === customer.id);
  }, [nav, navList, customer]);

  const canPrev = nav && index > 0;
  const canNext = nav && index >= 0 && navList != null && index < navList.length - 1;
  const step = (delta: number) => {
    if (!navList || index < 0) return;
    const next = navList[index + delta];
    if (next) setCustomer(next);
  };

  if (!customer) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-400">
        No customer selected — use the search above to set the current customer.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40">
      {/* Identity + nav bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        {nav ? (
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!canPrev}
            title="Previous customer"
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            ◀
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900">
            {customer.name}
            {customer.cwId ? <span className="font-normal text-slate-400"> · {customer.cwId}</span> : null}
          </div>
          {nav && navList ? (
            <div className="text-[10px] text-slate-400">
              {index >= 0
                ? `${index + 1} of ${navList.length} active intake${navList.length === 1 ? "" : "s"}`
                : "not in your active intakes"}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setNotEligibleOpen((value) => !value)}
          disabled={!openEnrollments.length || notEligibleBusy}
          title={openEnrollments.length ? "Close an ineligible program enrollment" : "No open enrollment to close"}
          className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Customer not eligible
        </button>
        <button
          type="button"
          disabled
          title="Editing customer details — coming soon"
          className="hidden shrink-0 cursor-not-allowed rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-300 sm:block"
        >
          Edit ✎
        </button>
        {nav ? (
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!canNext}
            title="Next customer"
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            ▶
          </button>
        ) : null}
      </div>

      {notEligibleOpen ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-indigo-100 bg-white px-3 py-2.5">
          <label className="min-w-56 flex-1 text-xs font-medium text-slate-600">
            Enrollment to close
            <select
              value={notEligibleEnrollmentId}
              onChange={(event) => setNotEligibleEnrollmentId(event.currentTarget.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              {openEnrollments.map((row) => <option key={row.id} value={row.id}>{row.grantName || row.grantId}</option>)}
            </select>
          </label>
          <button type="button" onClick={markNotEligible} disabled={!notEligibleEnrollmentId || notEligibleBusy} className="rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40">
            {notEligibleBusy ? "Closing…" : "Confirm not eligible"}
          </button>
        </div>
      ) : null}
      {notEligibleResult ? <div className="border-t border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{notEligibleResult}</div> : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-indigo-100 px-3">
        <TabButton active={tab === "customer"} onClick={() => setTab("customer")}>Customer</TabButton>
        <TabButton active={tab === "household"} onClick={() => setTab("household")}>
          Household{detail?.household ? ` · ${detail.household.formCount}` : ""}
        </TabButton>
      </div>

      {/* Tab content */}
      <div className="px-3 py-3">
        {tab === "customer" ? (
          <CustomerTab detail={detail} fallback={customer} />
        ) : (
          <HouseholdTab detail={detail} loading={loading} />
        )}
      </div>
    </div>
  );
}
