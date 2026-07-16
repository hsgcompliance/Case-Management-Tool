import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { listWebhookEventDetails, type WebhookEventDetail } from "@/lib/webhookDetailsApi";
import {
  EMPTY_CERT,
  extractCertFields,
  RENT_DETERMINATION_FORM_ID,
  type CertFields,
} from "@/lib/rentCertExtract";
import {
  describeConflict,
  findConflict,
  generateSchedule,
  SECTION_LABELS,
  type DraftRow,
  type ScheduleSection,
} from "@/lib/rentCertSchedule";
import {
  applyRentCertSchedule,
  listEnrollmentsForCustomer,
  type FormsEnrollment,
  type RentCertApplyRow,
  type RentCertRowResult,
} from "@/lib/rentCertApi";
import { matchName } from "@/lib/nameMatch";

// Rent Cert Smart Schedule Builder — parse a completed Rent Determination
// submission, let staff SELECT the billable enrollment(s) (no auto-creation,
// no fuzzy magic — selection is the decision), review the generated rows per
// section, then apply once. The backend creates the payment rows per
// enrollment in order; projections + payment queue follow via triggers.

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type RowState = DraftRow & {
  enrollmentId: string | null;
  lineItemId: string | null;
};

const SECTION_ORDER: ScheduleSection[] = ["deposit", "prorated", "arrears", "recurring", "utility"];

/** Default line item for an enrollment: prefer a rent-ish unlocked item. */
function defaultLineItem(e: FormsEnrollment): string | null {
  const unlocked = e.lineItems.filter((li) => !li.locked);
  if (!unlocked.length) return null;
  const rentish = unlocked.find((li) => /rent|rental|housing|assistance/i.test(li.label));
  return (rentish ?? unlocked[0]).id;
}

export function RentCertScheduleBuilder() {
  const { customer } = useCurrentCustomer();

  // ── source submission (webhook events for the Rent Determination form) ──
  const [events, setEvents] = useState<WebhookEventDetail[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setEventsLoading(true);
    listWebhookEventDetails([RENT_DETERMINATION_FORM_ID], 50)
      .then((items) => {
        if (!alive) return;
        setEvents(items);
      })
      .catch(() => alive && setEvents([]))
      .finally(() => alive && setEventsLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Prefer the newest submission whose submitter matches the active customer.
  useEffect(() => {
    if (selectedEventId || !events.length) return;
    const matching = customer
      ? events.find((ev) => matchName(ev.submitterName, customer.name) !== "none")
      : null;
    setSelectedEventId((matching ?? events[0]).id);
  }, [events, customer, selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((ev) => ev.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  // ── certification fields (parsed, then staff-editable) ──
  const [cert, setCert] = useState<CertFields>(EMPTY_CERT);
  useEffect(() => {
    setCert(selectedEvent ? extractCertFields(selectedEvent) : EMPTY_CERT);
    setRows(null);
    setResults(null);
  }, [selectedEvent]);

  const setCertField = <K extends keyof CertFields>(key: K, value: CertFields[K]) =>
    setCert((c) => ({ ...c, [key]: value }));

  // ── enrollments (staff selection = the decision) ──
  const [enrollments, setEnrollments] = useState<FormsEnrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);
  const [lineItemByEnrollment, setLineItemByEnrollment] = useState<Record<string, string>>({});

  const loadEnrollments = useCallback(() => {
    if (!customer) {
      setEnrollments([]);
      setSelectedEnrollmentIds([]);
      return;
    }
    setEnrollmentsLoading(true);
    listEnrollmentsForCustomer(customer.id)
      .then((items) => {
        setEnrollments(items);
        // Preselect a single active billable enrollment; otherwise make staff choose.
        const activeBillable = items.filter((e) => e.active && e.billable);
        setSelectedEnrollmentIds((cur) => {
          const still = cur.filter((id) => items.some((e) => e.id === id));
          if (still.length) return still;
          return activeBillable.length === 1 ? [activeBillable[0].id] : [];
        });
        setLineItemByEnrollment((cur) => {
          const next = { ...cur };
          for (const e of items) if (!next[e.id]) next[e.id] = defaultLineItem(e) ?? "";
          return next;
        });
      })
      .catch(() => setEnrollments([]))
      .finally(() => setEnrollmentsLoading(false));
  }, [customer]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  const selectedEnrollments = useMemo(
    () => selectedEnrollmentIds.map((id) => enrollments.find((e) => e.id === id)).filter((x): x is FormsEnrollment => !!x),
    [selectedEnrollmentIds, enrollments],
  );
  const primaryEnrollment = selectedEnrollments[0] ?? null;

  const toggleEnrollment = (id: string) => {
    setSelectedEnrollmentIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setResults(null);
  };

  // ── generated rows (preview state) ──
  const [rows, setRows] = useState<RowState[] | null>(null);
  const [genWarnings, setGenWarnings] = useState<string[]>([]);
  const [results, setResults] = useState<RentCertRowResult[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const submissionId = selectedEvent?.submissionId ?? null;

  const generate = () => {
    const g = generateSchedule(cert);
    const enrollmentId = primaryEnrollment?.id ?? null;
    setGenWarnings(g.warnings);
    setRows(
      g.rows.map((r) => {
        const conflict = primaryEnrollment ? findConflict(r, primaryEnrollment.payments, submissionId) : null;
        return {
          ...r,
          enrollmentId,
          lineItemId: enrollmentId ? lineItemByEnrollment[enrollmentId] || null : null,
          // Conflicting rows start EXCLUDED — staff resolves during preview.
          include: r.include && !conflict,
          warnings: conflict ? [...r.warnings, describeConflict(conflict)] : r.warnings,
        };
      }),
    );
    setResults(null);
    setApplyError(null);
  };

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((cur) => (cur ? cur.map((r) => (r.key === key ? { ...r, ...patch } : r)) : cur));
    setResults(null);
  };

  // Re-evaluate conflicts live (enrollment/date edits change them).
  const annotatedRows = useMemo(() => {
    if (!rows) return null;
    return rows.map((r) => {
      const enr = enrollments.find((e) => e.id === r.enrollmentId) ?? null;
      const conflict = enr && r.dueDate ? findConflict(r, enr.payments, submissionId) : null;
      return { ...r, conflict };
    });
  }, [rows, enrollments, submissionId]);

  const includedRows = (annotatedRows ?? []).filter((r) => r.include);
  const includedTotal = includedRows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
  const blockers = includedRows.filter(
    (r) => !r.enrollmentId || !r.lineItemId || !r.dueDate || !(r.amount > 0) || (r.conflict && !r.conflict.sameSource),
  );

  const apply = async () => {
    if (!customer || !submissionId || !annotatedRows) return;
    const payload: RentCertApplyRow[] = includedRows.map((r) => ({
      enrollmentId: r.enrollmentId!,
      lineItemId: r.lineItemId!,
      type: r.type,
      ...(r.type === "monthly" ? { sub: r.sub ?? "rent" } : {}),
      amount: r.amount,
      dueDate: r.dueDate,
      label: r.label,
    }));
    if (!payload.length) return;
    setApplying(true);
    setApplyError(null);
    try {
      const out = await applyRentCertSchedule({
        customerId: customer.id,
        submissionId,
        formId: RENT_DETERMINATION_FORM_ID,
        certification: {
          programName: cert.programName,
          effectiveDate: cert.effectiveDate,
          expirationDate: cert.expirationDate,
          reason: cert.reason,
          intakePurpose: cert.intakePurpose,
          includeArrears: cert.includeArrears,
          proratedMonth: cert.proratedMonth,
          depositAmount: cert.depositAmount,
          monthlyHousingCost: cert.monthlyHousingCost,
          proratedOrArrears: cert.proratedOrArrears,
          tenantRentPayment: cert.tenantRentPayment,
          hrdcPayment: cert.hrdcPayment,
          utilityAllowance: cert.utilityAllowance,
        },
        rows: payload,
      });
      // Map results (indexed into the included payload) back onto row keys.
      const keyed = out.results.map((res, i) => ({ ...res, key: includedRows[res.index]?.key ?? String(i) }));
      setResults(keyed as RentCertRowResult[]);
      loadEnrollments(); // refresh payment summaries → conflicts show the new rows
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  };

  const resultByKey = useMemo(() => {
    const m = new Map<string, RentCertRowResult>();
    for (const r of (results ?? []) as Array<RentCertRowResult & { key?: string }>) {
      if (r.key) m.set(r.key, r);
    }
    return m;
  }, [results]);

  // ── render ──
  if (!customer) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Link a customer first — the schedule builder needs their enrollments to bill against.
      </div>
    );
  }

  const numInput = (value: number | null, onChange: (v: number | null) => void, placeholder = "blank") => (
    <input
      type="number"
      step="0.01"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
    />
  );
  const dateInput = (value: string | null, onChange: (v: string | null) => void) => (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
    />
  );

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Rent cert payment schedule builder</h3>
        <p className="text-xs text-slate-500">
          Parse the completed Rent Determination, pick the enrollment(s) to bill, review the generated rows, then
          apply — payments are created on the enrollment and flow into the payment queue in order.
        </p>
      </div>

      {/* 1 · Source submission */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">1 · Source submission</div>
        {eventsLoading ? (
          <div className="text-xs text-slate-400">Loading Rent Determination submissions…</div>
        ) : events.length ? (
          <select
            value={selectedEventId ?? ""}
            onChange={(e) => setSelectedEventId(e.target.value || null)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            {events.map((ev) => {
              const m = matchName(ev.submitterName, customer.name);
              return (
                <option key={ev.id} value={ev.id}>
                  {ev.submitterName || "(no name)"} · {ev.receivedAtISO?.slice(0, 10) ?? "?"}
                  {m !== "none" ? ` · matches ${customer.name}` : ""}
                </option>
              );
            })}
          </select>
        ) : (
          <div className="text-xs text-slate-400">
            No Rent Determination webhook events found — submit the form first, or fill the fields below manually.
          </div>
        )}
      </div>

      {/* 2 · Certification fields (editable) */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">2 · Certification fields</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="text-xs text-slate-600">
            Program name
            <input
              value={cert.programName ?? ""}
              onChange={(e) => setCertField("programName", e.target.value || null)}
              className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Reason
            <select
              value={cert.reason ?? ""}
              onChange={(e) => setCertField("reason", e.target.value || null)}
              className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              <option value="">—</option>
              <option>Initial</option>
              <option>Interim</option>
              <option>Annual</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Intake purpose
            <select
              value={cert.intakePurpose ?? ""}
              onChange={(e) => setCertField("intakePurpose", e.target.value || null)}
              className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              <option value="">—</option>
              <option>New Intake</option>
              <option>YHDP Transitional Housing Recert</option>
              <option>Update Rent Cert Letter</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Effective date
            <div className="mt-0.5">{dateInput(cert.effectiveDate, (v) => setCertField("effectiveDate", v))}</div>
          </label>
          <label className="text-xs text-slate-600">
            Expiration date
            <div className="mt-0.5">{dateInput(cert.expirationDate, (v) => setCertField("expirationDate", v))}</div>
          </label>
          <label className="text-xs text-slate-600">
            Include arrears?
            <select
              value={cert.includeArrears == null ? "" : cert.includeArrears ? "yes" : "no"}
              onChange={(e) =>
                setCertField("includeArrears", e.target.value === "" ? null : e.target.value === "yes")
              }
              className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              <option value="">—</option>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Monthly housing cost
            <div className="mt-0.5">{numInput(cert.monthlyHousingCost, (v) => setCertField("monthlyHousingCost", v))}</div>
          </label>
          <label className="text-xs text-slate-600">
            HRDC payment
            <div className="mt-0.5">{numInput(cert.hrdcPayment, (v) => setCertField("hrdcPayment", v))}</div>
          </label>
          <label className="text-xs text-slate-600">
            Deposit amount
            <div className="mt-0.5">{numInput(cert.depositAmount, (v) => setCertField("depositAmount", v))}</div>
          </label>
          <label className="text-xs text-slate-600">
            Prorated rent / arrears
            <div className="mt-0.5">{numInput(cert.proratedOrArrears, (v) => setCertField("proratedOrArrears", v))}</div>
          </label>
          <label className="text-xs text-slate-600">
            Tenant rent payment
            <div className="mt-0.5">{numInput(cert.tenantRentPayment, (v) => setCertField("tenantRentPayment", v), "blank ≠ 0")}</div>
          </label>
          <label className="text-xs text-slate-600">
            Utility allowance
            <div className="mt-0.5">{numInput(cert.utilityAllowance, (v) => setCertField("utilityAllowance", v))}</div>
          </label>
        </div>
      </div>

      {/* 3 · Enrollment selection */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          3 · Bill against enrollment(s)
        </div>
        {enrollmentsLoading ? (
          <div className="text-xs text-slate-400">Loading enrollments…</div>
        ) : enrollments.length ? (
          <div className="flex flex-wrap gap-1.5">
            {enrollments.map((e) => {
              const selected = selectedEnrollmentIds.includes(e.id);
              const disabled = !e.billable;
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={disabled}
                  title={disabled ? "No unlocked budget line items on this grant" : undefined}
                  onClick={() => toggleEnrollment(e.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    selected
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : disabled
                        ? "border-slate-100 bg-slate-50 text-slate-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
                  }`}
                >
                  {selected ? "✓ " : ""}
                  {e.grantName ?? e.grantId}
                  <span className="ml-1 font-normal text-slate-400">
                    {e.startDate ?? "?"} · {e.active ? "active" : e.status ?? "inactive"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-amber-700">
            No enrollments found for {customer.name} — enroll them in a grant in the web app first. Enrollments are
            never created from here.
          </div>
        )}
        {selectedEnrollments.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold">{e.grantName ?? e.grantId}</span>
            <span>line item:</span>
            <select
              value={lineItemByEnrollment[e.id] ?? ""}
              onChange={(ev) => {
                setLineItemByEnrollment((cur) => ({ ...cur, [e.id]: ev.target.value }));
                setRows((cur) =>
                  cur ? cur.map((r) => (r.enrollmentId === e.id ? { ...r, lineItemId: ev.target.value || null } : r)) : cur,
                );
              }}
              className="rounded-md border border-slate-200 px-2 py-1"
            >
              <option value="">— pick —</option>
              {e.lineItems.filter((li) => !li.locked).map((li) => (
                <option key={li.id} value={li.id}>
                  {li.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* 4 · Generate + preview */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">4 · Schedule preview</div>
          <button
            type="button"
            onClick={generate}
            disabled={!primaryEnrollment}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {rows ? "Regenerate schedule" : "Generate schedule"}
          </button>
        </div>
        {!primaryEnrollment ? (
          <div className="text-xs text-slate-400">Select at least one billable enrollment to generate.</div>
        ) : null}

        {genWarnings.length ? (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            {genWarnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-800">
                ⚠ {w}
              </li>
            ))}
          </ul>
        ) : null}

        {annotatedRows
          ? SECTION_ORDER.map((section) => {
              const sectionRows = annotatedRows.filter((r) => r.section === section);
              if (!sectionRows.length) return null;
              return (
                <div key={section} className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {SECTION_LABELS[section]}
                  </div>
                  {sectionRows.map((r) => {
                    const res = resultByKey.get(r.key);
                    return (
                      <div
                        key={r.key}
                        className={`flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                          r.conflict && !r.conflict.sameSource
                            ? "border-rose-200 bg-rose-50"
                            : r.include
                              ? "border-slate-200 bg-white"
                              : "border-slate-100 bg-slate-50 opacity-70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => updateRow(r.key, { include: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{r.label}</span>
                        <input
                          type="date"
                          value={r.dueDate}
                          onChange={(e) => updateRow(r.key, { dueDate: e.target.value })}
                          className="rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={Number.isFinite(r.amount) ? r.amount : ""}
                          onChange={(e) => updateRow(r.key, { amount: Number(e.target.value) })}
                          className="w-24 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs"
                        />
                        {selectedEnrollments.length > 1 ? (
                          <select
                            value={r.enrollmentId ?? ""}
                            onChange={(e) => {
                              const id = e.target.value || null;
                              updateRow(r.key, {
                                enrollmentId: id,
                                lineItemId: id ? lineItemByEnrollment[id] || null : null,
                              });
                            }}
                            className="rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                          >
                            {selectedEnrollments.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.grantName ?? e.grantId}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {res ? (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              res.status === "created"
                                ? "bg-emerald-100 text-emerald-700"
                                : res.status === "already_applied"
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {res.status === "created"
                              ? "✓ created"
                              : res.status === "already_applied"
                                ? "already applied"
                                : res.status === "failed"
                                  ? `failed: ${res.error ?? "error"}`
                                  : "conflict — not created"}
                          </span>
                        ) : null}
                        {(r.conflict && !r.conflict.sameSource) || r.warnings.length ? (
                          <span className="w-full text-[11px] text-rose-600">
                            {[...(r.conflict && !r.conflict.sameSource ? [describeConflict(r.conflict)] : []), ...r.warnings].join(" · ")}
                          </span>
                        ) : r.conflict?.sameSource ? (
                          <span className="w-full text-[11px] text-slate-400">{describeConflict(r.conflict)}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })
          : null}
      </div>

      {/* 5 · Apply */}
      {annotatedRows ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              <b>{includedRows.length}</b> row{includedRows.length === 1 ? "" : "s"} · <b>{money(includedTotal)}</b>
              {blockers.length ? (
                <span className="ml-2 text-rose-600">
                  {blockers.length} row{blockers.length === 1 ? "" : "s"} blocked (conflict or missing
                  enrollment/line-item/date/amount) — uncheck or fix to apply.
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={applying || !includedRows.length || blockers.length > 0 || !submissionId}
              className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {applying ? "Applying…" : "Apply payment schedule"}
            </button>
          </div>
          {!submissionId ? (
            <div className="text-[11px] text-amber-700">
              Applying needs a source submission (idempotency is keyed on it) — select one above.
            </div>
          ) : null}
          {applyError ? <div className="text-xs text-rose-600">Apply failed: {applyError}</div> : null}
          {results ? (
            <div className="text-xs text-emerald-700">
              ✓ {results.filter((r) => r.status === "created").length} payment
              {results.filter((r) => r.status === "created").length === 1 ? "" : "s"} created — projections and the
              payment queue update automatically.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
