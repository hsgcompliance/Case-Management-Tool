import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { getCustomerDetail, type CustomerDetail } from "@/lib/customerDetailApi";
import {
  applyRentCertSchedule,
  listEnrollmentsForCustomer,
  type EnrollmentLineItem,
  type FormsEnrollment,
  type FormsProgram,
  type RentCertApplyRow,
  type RentCertRowResult,
} from "@/lib/rentCertApi";
import { describeConflict, findConflict } from "@/lib/rentCertSchedule";
import {
  extractAssistancePrefill,
  type IntakeWebhookSnapshot,
} from "@/lib/intakeWebhookSnapshot";

type SingleKind = "deposit" | "prorated" | "arrears";
type MonthlyKind = "rent" | "utility";

type SinglePlan = {
  kind: SingleKind;
  date: string;
  amount: string;
  lineItemId: string;
};

type MonthlyPlan = {
  id: string;
  kind: MonthlyKind;
  firstDue: string;
  months: string;
  monthlyAmount: string;
  lineItemId: string;
};

type LandlordDraft = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  unitAddress: string;
};

type PreviewRow = {
  key: string;
  type: "deposit" | "prorated" | "arrears" | "monthly";
  sub?: "rent" | "utility";
  label: string;
  dueDate: string;
  amount: number;
  lineItemId: string;
};

const SINGLE_LABELS: Record<SingleKind, string> = {
  deposit: "Security Deposit",
  prorated: "Prorated Rent",
  arrears: "Arrears",
};

const money = (amount: number) =>
  amount.toLocaleString(undefined, { style: "currency", currency: "USD" });

const rowId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const isISO = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function positiveNumber(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : 0;
}

function positiveMonths(value: string): number {
  const months = Math.floor(Number(value));
  return Number.isFinite(months) && months > 0 && months <= 120 ? months : 0;
}

function addMonthsISO(value: string, offset: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const total = year * 12 + month - 1 + offset;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function inclusiveMonths(start: string, end: string): string {
  if (!isISO(start) || !isISO(end) || end < start) return "";
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return String(Math.max(1, (ey - sy) * 12 + em - sm + 1));
}

function defaultSingle(kind: SingleKind): SinglePlan {
  return { kind, date: "", amount: "", lineItemId: "" };
}

function defaultMonthly(kind: MonthlyKind): MonthlyPlan {
  return { id: rowId(kind), kind, firstDue: "", months: "", monthlyAmount: "", lineItemId: "" };
}

type RentCertDraft = {
  version: 1;
  selectedGrantId: string;
  defaultLineItemId: string;
  vendor: string;
  landlord: LandlordDraft;
  singles: Record<SingleKind, SinglePlan>;
  rentPlans: MonthlyPlan[];
  utilityPlans: MonthlyPlan[];
  lastSubmittedSignature: string;
};

function draftStorageKey(customerId: string): string {
  return `hdb:forms:rent-cert-draft:${customerId}`;
}

function draftSignature(draft: Omit<RentCertDraft, "version" | "lastSubmittedSignature">): string {
  return JSON.stringify(draft);
}

function infoClasses(complete: boolean): string {
  return complete
    ? "border-emerald-300 bg-emerald-50/70"
    : "border-amber-300 bg-amber-50/70";
}

function requiredClasses(complete: boolean): string {
  return complete
    ? "border-emerald-400 bg-emerald-50/50"
    : "border-rose-400 bg-rose-50/50";
}

function StateBadge({ complete, optional = false }: { complete: boolean; optional?: boolean }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
      complete ? "bg-emerald-100 text-emerald-700" : optional ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
    }`}>
      {complete ? "ready" : optional ? "review" : "incomplete"}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "date" | "number";
  placeholder?: string;
}) {
  return (
    <label className="min-w-0 text-xs text-slate-600">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-400"
      />
    </label>
  );
}

function LineItemField({
  value,
  onChange,
  lineItems,
  label = "Line item override",
  allowDefault = true,
}: {
  value: string;
  onChange: (value: string) => void;
  lineItems: EnrollmentLineItem[];
  label?: string;
  allowDefault?: boolean;
}) {
  return (
    <label className="min-w-0 text-xs text-slate-600">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
      >
        {allowDefault ? <option value="">Use default line item</option> : <option value="">— select required line item —</option>}
        {lineItems.filter((item) => !item.locked).map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
    </label>
  );
}

function InfoSection({
  title,
  complete,
  children,
}: {
  title: string;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-xl border-2 px-3 py-3 ${infoClasses(complete)}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <StateBadge complete={complete} optional />
      </div>
      {children}
    </section>
  );
}

function SinglePlanCard({
  plan,
  onChange,
  lineItems,
  defaultLineItemId,
}: {
  plan: SinglePlan;
  onChange: (patch: Partial<SinglePlan>) => void;
  lineItems: EnrollmentLineItem[];
  defaultLineItemId: string;
}) {
  const active = Boolean(plan.amount || plan.date || plan.lineItemId);
  const complete = active && positiveNumber(plan.amount) > 0 && isISO(plan.date) && Boolean(plan.lineItemId || defaultLineItemId);
  return (
    <div className={`rounded-lg border px-3 py-3 ${active ? (complete ? "border-emerald-300 bg-emerald-50/40" : "border-rose-300 bg-rose-50/40") : "border-slate-200 bg-white"}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{SINGLE_LABELS[plan.kind]}</div>
        {active ? <StateBadge complete={complete} /> : <span className="text-[10px] font-medium uppercase text-slate-400">optional</span>}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Amount" type="number" value={plan.amount} onChange={(amount) => onChange({ amount })} placeholder="0.00" />
        <Field label="Payment date" type="date" value={plan.date} onChange={(date) => onChange({ date })} />
        <LineItemField value={plan.lineItemId} onChange={(lineItemId) => onChange({ lineItemId })} lineItems={lineItems} />
      </div>
    </div>
  );
}

function MonthlyPlanCard({
  plan,
  onChange,
  onRemove,
  lineItems,
  defaultLineItemId,
}: {
  plan: MonthlyPlan;
  onChange: (patch: Partial<MonthlyPlan>) => void;
  onRemove: () => void;
  lineItems: EnrollmentLineItem[];
  defaultLineItemId: string;
}) {
  const active = Boolean(plan.firstDue || plan.months || plan.monthlyAmount || plan.lineItemId);
  const complete = active && isISO(plan.firstDue) && positiveMonths(plan.months) > 0 && positiveNumber(plan.monthlyAmount) > 0 && Boolean(plan.lineItemId || defaultLineItemId);
  return (
    <div className={`rounded-lg border px-3 py-3 ${active ? (complete ? "border-emerald-300 bg-emerald-50/40" : "border-rose-300 bg-rose-50/40") : "border-slate-200 bg-white"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {plan.kind === "rent" ? "Recurring Rent Period" : "Recurring Utility Period"}
        </div>
        <div className="flex items-center gap-2">
          {active ? <StateBadge complete={complete} /> : null}
          <button type="button" onClick={onRemove} className="text-xs text-rose-500 hover:text-rose-700">Remove</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Field label="Monthly amount" type="number" value={plan.monthlyAmount} onChange={(monthlyAmount) => onChange({ monthlyAmount })} placeholder="0.00" />
        <Field label="First due date" type="date" value={plan.firstDue} onChange={(firstDue) => onChange({ firstDue })} />
        <Field label="Number of months" type="number" value={plan.months} onChange={(months) => onChange({ months })} placeholder="12" />
        <LineItemField value={plan.lineItemId} onChange={(lineItemId) => onChange({ lineItemId })} lineItems={lineItems} />
      </div>
    </div>
  );
}

export function RentCertScheduleBuilder({
  webhookSnapshot,
  onSubmissionStateChange,
}: {
  webhookSnapshot: IntakeWebhookSnapshot | null;
  onSubmissionStateChange?: (state: { submitted: boolean; dirty: boolean }) => void;
}) {
  const { customer } = useCurrentCustomer();
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [enrollments, setEnrollments] = useState<FormsEnrollment[]>([]);
  const [programs, setPrograms] = useState<FormsProgram[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState("");
  const [defaultLineItemId, setDefaultLineItemId] = useState("");
  const [vendor, setVendor] = useState("");
  const [landlord, setLandlord] = useState<LandlordDraft>({ name: "", contact: "", phone: "", email: "", address: "", unitAddress: "" });
  const [singles, setSingles] = useState<Record<SingleKind, SinglePlan>>({
    deposit: defaultSingle("deposit"),
    prorated: defaultSingle("prorated"),
    arrears: defaultSingle("arrears"),
  });
  const [rentPlans, setRentPlans] = useState<MonthlyPlan[]>([defaultMonthly("rent")]);
  const [utilityPlans, setUtilityPlans] = useState<MonthlyPlan[]>([]);
  const [results, setResults] = useState<RentCertRowResult[] | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [lastSubmittedSignature, setLastSubmittedSignature] = useState("");
  const [hydratedCustomerId, setHydratedCustomerId] = useState("");
  const prefill = useMemo(() => extractAssistancePrefill(webhookSnapshot), [webhookSnapshot]);
  const lastPrefill = useRef("");

  const loadEnrollments = useCallback(() => {
    if (!customer) {
      setEnrollments([]);
      setPrograms([]);
      return;
    }
    setLoadingPrograms(true);
    listEnrollmentsForCustomer(customer.id)
      .then(({ enrollments: nextEnrollments, programs: nextPrograms }) => {
        setEnrollments(nextEnrollments);
        setPrograms(nextPrograms);
      })
      .catch(() => {
        setEnrollments([]);
        setPrograms([]);
      })
      .finally(() => setLoadingPrograms(false));
  }, [customer]);

  useEffect(() => {
    let alive = true;
    if (!customer) {
      setCustomerDetail(null);
      return;
    }
    getCustomerDetail(customer.id).then((detail) => alive && setCustomerDetail(detail));
    return () => { alive = false; };
  }, [customer]);

  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);

  useEffect(() => {
    let cached: RentCertDraft | null = null;
    if (customer) {
      try {
        const raw = localStorage.getItem(draftStorageKey(customer.id));
        const parsed = raw ? JSON.parse(raw) as RentCertDraft : null;
        if (parsed?.version === 1) cached = parsed;
      } catch { /* ignore invalid or unavailable browser storage */ }
    }
    setSelectedGrantId(cached?.selectedGrantId || "");
    setDefaultLineItemId(cached?.defaultLineItemId || "");
    setVendor(cached?.vendor || "");
    setLandlord(cached?.landlord || { name: "", contact: "", phone: "", email: "", address: "", unitAddress: "" });
    setSingles(cached?.singles || { deposit: defaultSingle("deposit"), prorated: defaultSingle("prorated"), arrears: defaultSingle("arrears") });
    setRentPlans(cached?.rentPlans?.length ? cached.rentPlans : [defaultMonthly("rent")]);
    setUtilityPlans(cached?.utilityPlans || []);
    setLastSubmittedSignature(cached?.lastSubmittedSignature || "");
    setResults(null);
    setApplyError(null);
    lastPrefill.current = "";
    setHydratedCustomerId(customer?.id || "");
  }, [customer?.id]);

  const currentSignature = useMemo(() => draftSignature({
    selectedGrantId,
    defaultLineItemId,
    vendor,
    landlord,
    singles,
    rentPlans,
    utilityPlans,
  }), [defaultLineItemId, landlord, rentPlans, selectedGrantId, singles, utilityPlans, vendor]);
  const submitted = Boolean(lastSubmittedSignature) && currentSignature === lastSubmittedSignature;

  useEffect(() => {
    if (!customer || hydratedCustomerId !== customer.id) return;
    const draft: RentCertDraft = {
      version: 1,
      selectedGrantId,
      defaultLineItemId,
      vendor,
      landlord,
      singles,
      rentPlans,
      utilityPlans,
      lastSubmittedSignature,
    };
    try { localStorage.setItem(draftStorageKey(customer.id), JSON.stringify(draft)); } catch { /* ignore */ }
  }, [customer, defaultLineItemId, hydratedCustomerId, landlord, lastSubmittedSignature, rentPlans, selectedGrantId, singles, utilityPlans, vendor]);

  useEffect(() => {
    onSubmissionStateChange?.({ submitted, dirty: Boolean(lastSubmittedSignature) && !submitted });
  }, [lastSubmittedSignature, onSubmissionStateChange, submitted]);

  useEffect(() => {
    const key = JSON.stringify(prefill);
    if (!webhookSnapshot || key === lastPrefill.current) return;
    lastPrefill.current = key;
    setLandlord((current) => ({
      name: current.name || prefill.landlordName,
      contact: current.contact || prefill.landlordContact,
      phone: current.phone || prefill.landlordPhone,
      email: current.email || prefill.landlordEmail,
      address: current.address || prefill.landlordAddress,
      unitAddress: current.unitAddress || prefill.unitAddress,
    }));
    setVendor((current) => current || prefill.landlordName);
    setSingles((current) => ({
      deposit: {
        ...current.deposit,
        amount: current.deposit.amount || prefill.depositAmount,
        date: current.deposit.date || prefill.assistanceStart,
      },
      prorated: {
        ...current.prorated,
        amount: current.prorated.amount || prefill.proratedAmount,
        date: current.prorated.date || prefill.assistanceStart,
      },
      arrears: {
        ...current.arrears,
        amount: current.arrears.amount || prefill.arrearsAmount,
        date: current.arrears.date || prefill.assistanceStart,
      },
    }));
    if (prefill.monthlyRent) {
      setRentPlans((current) => current.map((plan, index) => index === 0 ? {
        ...plan,
        monthlyAmount: plan.monthlyAmount || prefill.monthlyRent,
        firstDue: plan.firstDue || prefill.assistanceStart,
        months: plan.months || inclusiveMonths(prefill.assistanceStart, prefill.assistanceEnd),
      } : plan));
    }
    if (prefill.utilityAmount) {
      setUtilityPlans((current) => current.length ? current : [{
        ...defaultMonthly("utility"),
        monthlyAmount: prefill.utilityAmount,
        firstDue: prefill.assistanceStart,
        months: inclusiveMonths(prefill.assistanceStart, prefill.assistanceEnd),
      }]);
    }
  }, [prefill, webhookSnapshot]);

  const selectedProgram = programs.find((program) => program.grantId === selectedGrantId) ?? null;
  const lineItems = selectedProgram?.lineItems.filter((item) => !item.locked) ?? [];
  const selectedEnrollment = enrollments.find((enrollment) =>
    enrollment.grantId === selectedGrantId && enrollment.active && enrollment.billable,
  ) ?? null;
  const sourceSubmissionId = webhookSnapshot?.submissions.find((item) => item.linkedToCurrent)?.submissionId
    || webhookSnapshot?.submissions[0]?.submissionId
    || (customer ? `intake-${customer.id}` : "intake-session");

  const linkedSubmissions = webhookSnapshot?.submissions.filter((item) => item.linkedToCurrent).length ?? 0;
  const submissionCount = webhookSnapshot?.submissions.length ?? 0;
  const linksReady = submissionCount > 0 && linkedSubmissions === submissionCount;
  const householdMembers = webhookSnapshot?.household.members ?? [];
  const householdReady = Boolean(customer && (customer.cwId || customerDetail?.dob || householdMembers.length));
  const landlordReady = Boolean(landlord.name && (landlord.phone || landlord.email || landlord.contact) && (landlord.address || landlord.unitAddress));
  const enrollmentReady = Boolean(customer && selectedGrantId && selectedProgram);

  const schedule = useMemo(() => {
    const rows: PreviewRow[] = [];
    const issues: string[] = [];
    const addSingle = (plan: SinglePlan) => {
      const active = Boolean(plan.amount || plan.date || plan.lineItemId);
      if (!active) return;
      const amount = positiveNumber(plan.amount);
      const lineItemId = plan.lineItemId || defaultLineItemId;
      if (!amount || !isISO(plan.date) || !lineItemId) {
        issues.push(`${SINGLE_LABELS[plan.kind]} needs an amount, payment date, and line item.`);
        return;
      }
      if (!lineItems.some((item) => item.id === lineItemId)) {
        issues.push(`${SINGLE_LABELS[plan.kind]} has a line item that does not belong to the selected active grant.`);
        return;
      }
      rows.push({ key: plan.kind, type: plan.kind, label: SINGLE_LABELS[plan.kind], dueDate: plan.date, amount, lineItemId });
    };
    const addMonthly = (plan: MonthlyPlan) => {
      const active = Boolean(plan.firstDue || plan.months || plan.monthlyAmount || plan.lineItemId);
      if (!active) return;
      const amount = positiveNumber(plan.monthlyAmount);
      const months = positiveMonths(plan.months);
      const lineItemId = plan.lineItemId || defaultLineItemId;
      if (!amount || !months || !isISO(plan.firstDue) || !lineItemId) {
        issues.push(`${plan.kind === "rent" ? "Rent" : "Utility"} period needs an amount, first date, 1–120 months, and line item.`);
        return;
      }
      if (!lineItems.some((item) => item.id === lineItemId)) {
        issues.push(`${plan.kind === "rent" ? "Rent" : "Utility"} period has a line item that does not belong to the selected active grant.`);
        return;
      }
      for (let index = 0; index < months; index += 1) {
        const dueDate = addMonthsISO(plan.firstDue, index);
        rows.push({
          key: `${plan.id}:${dueDate}`,
          type: "monthly",
          sub: plan.kind,
          label: `${plan.kind === "rent" ? "Rent" : "Utility"} · ${dueDate.slice(0, 7)}`,
          dueDate,
          amount,
          lineItemId,
        });
      }
    };
    (Object.keys(singles) as SingleKind[]).forEach((kind) => addSingle(singles[kind]));
    rentPlans.forEach(addMonthly);
    utilityPlans.forEach(addMonthly);
    if (!rows.length) issues.push("Add at least one complete payment row or recurring period.");
    if (!vendor.trim()) issues.push("Default vendor / payee is required.");
    if (!defaultLineItemId && rows.some((row) => !row.lineItemId)) issues.push("A line item is required for every payment row.");

    const seen = new Set<string>();
    for (const row of rows) {
      const family = row.type === "monthly" && row.sub === "utility" ? "utility" : row.type === "deposit" ? "deposit" : "landlord";
      const key = `${family}:${row.dueDate.slice(0, 7)}`;
      if (seen.has(key)) issues.push(`Two ${family} payments overlap in ${row.dueDate.slice(0, 7)}. Adjust the periods.`);
      seen.add(key);
      if (selectedEnrollment) {
        const conflict = findConflict(row, selectedEnrollment.payments, sourceSubmissionId);
        if (conflict && !conflict.sameSource) issues.push(`${row.label}: ${describeConflict(conflict)}.`);
      }
    }
    return { rows, issues: [...new Set(issues)] };
  }, [defaultLineItemId, lineItems, rentPlans, selectedEnrollment, singles, sourceSubmissionId, utilityPlans, vendor]);

  const paymentReady = enrollmentReady && schedule.rows.length > 0 && schedule.issues.length === 0;
  const total = schedule.rows.reduce((sum, row) => sum + row.amount, 0);

  const chooseGrant = (grantId: string) => {
    setSelectedGrantId(grantId);
    setDefaultLineItemId("");
    setSingles((current) => ({
      deposit: { ...current.deposit, lineItemId: "" },
      prorated: { ...current.prorated, lineItemId: "" },
      arrears: { ...current.arrears, lineItemId: "" },
    }));
    setRentPlans((current) => current.map((plan) => ({ ...plan, lineItemId: "" })));
    setUtilityPlans((current) => current.map((plan) => ({ ...plan, lineItemId: "" })));
    setResults(null);
    setApplyError(null);
  };

  const apply = async () => {
    if (!customer || !selectedProgram || !paymentReady) return;
    const rows: RentCertApplyRow[] = schedule.rows.map((row) => ({
      ...(selectedEnrollment ? { enrollmentId: selectedEnrollment.id } : { grantId: selectedProgram.grantId }),
      lineItemId: row.lineItemId,
      type: row.type,
      ...(row.type === "monthly" ? { sub: row.sub ?? "rent" } : {}),
      amount: row.amount,
      dueDate: row.dueDate,
      label: row.label,
      vendor: vendor.trim(),
    }));
    setApplying(true);
    setApplyError(null);
    setResults(null);
    try {
      const response = await applyRentCertSchedule({
        customerId: customer.id,
        submissionId: sourceSubmissionId,
        certification: {
          sourceProgramName: prefill.programName || null,
          selectedGrantId: selectedProgram.grantId,
          selectedGrantName: selectedProgram.grantName,
          landlordName: landlord.name || null,
          landlordContact: landlord.contact || null,
          landlordPhone: landlord.phone || null,
          landlordEmail: landlord.email || null,
          landlordAddress: landlord.address || null,
          unitAddress: landlord.unitAddress || null,
          householdName: customer.name,
          householdMemberCount: householdMembers.length || customerDetail?.household.memberCount || null,
          linkedSubmissionCount: linkedSubmissions,
        },
        rows,
      });
      setResults(response.results);
      setLastSubmittedSignature(currentSignature);
      loadEnrollments();
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : String(error));
    } finally {
      setApplying(false);
    }
  };

  if (!customer) {
    return (
      <div className="rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
        Link or create the customer first. Enrollment and payment schedule creation require a customer ID.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-indigo-300 bg-white px-4 py-4 shadow-sm">
      <div className="rounded-xl bg-indigo-600 px-4 py-3 text-white">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-100">Primary intake action</div>
        <h3 className="mt-0.5 text-lg font-bold">Link intake, enroll &amp; build payment schedule</h3>
        <p className="mt-1 text-sm text-indigo-100">
          Prefill comes from the combined Webhooks sidebar model. Staff must manually select the funded grant and line item.
          Submit resolves the enrollment first, then creates the real payment schedule and queue projections.
        </p>
      </div>

      <InfoSection title="Intake submissions" complete={linksReady}>
        <div className="text-xs text-slate-700">
          {submissionCount
            ? `${linkedSubmissions} of ${submissionCount} sidebar submission${submissionCount === 1 ? "" : "s"} linked to ${customer.name}.`
            : "No matching webhook submissions are in this intake session yet."}
          {!linksReady ? " Use the Link controls in the Webhooks sidebar to finish linking." : " All sidebar submissions are linked."}
        </div>
      </InfoSection>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <InfoSection title="Landlord information" complete={landlordReady}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Landlord / company name" value={landlord.name} onChange={(name) => {
              setLandlord((current) => ({ ...current, name }));
              setVendor((current) => !current || current === landlord.name ? name : current);
            }} />
            <Field label="Contact person" value={landlord.contact} onChange={(contact) => setLandlord((current) => ({ ...current, contact }))} />
            <Field label="Phone" type="tel" value={landlord.phone} onChange={(phone) => setLandlord((current) => ({ ...current, phone }))} />
            <Field label="Email" type="email" value={landlord.email} onChange={(email) => setLandlord((current) => ({ ...current, email }))} />
            <Field label="Landlord mailing address" value={landlord.address} onChange={(address) => setLandlord((current) => ({ ...current, address }))} />
            <Field label="Assisted unit address" value={landlord.unitAddress} onChange={(unitAddress) => setLandlord((current) => ({ ...current, unitAddress }))} />
          </div>
        </InfoSection>

        <InfoSection title="Household information" complete={householdReady}>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div><span className="text-slate-500">Head of household</span><div className="font-semibold text-slate-900">{customerDetail?.household.headOfHousehold || customer.name}</div></div>
            <div><span className="text-slate-500">CWID</span><div className="font-semibold text-slate-900">{customerDetail?.cwId || customer.cwId || "—"}</div></div>
            <div><span className="text-slate-500">DOB</span><div className="font-semibold text-slate-900">{customerDetail?.dob || householdMembers.find((member) => member.isHoH)?.dob?.value || "—"}</div></div>
            <div><span className="text-slate-500">Members</span><div className="font-semibold text-slate-900">{householdMembers.length || customerDetail?.household.memberCount || "—"}</div></div>
            <div><span className="text-slate-500">Phone</span><div className="font-semibold text-slate-900">{householdMembers.find((member) => member.isHoH)?.phone?.value || "—"}</div></div>
            <div><span className="text-slate-500">Email</span><div className="font-semibold text-slate-900">{householdMembers.find((member) => member.isHoH)?.email?.value || "—"}</div></div>
          </div>
        </InfoSection>
      </div>

      <section className={`rounded-xl border-2 px-3 py-3 ${requiredClasses(enrollmentReady)}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Enrollment</h4>
            <p className="text-xs text-slate-500">Manual selection is always required. No fuzzy or automatic grant selection.</p>
          </div>
          <StateBadge complete={enrollmentReady} />
        </div>
        {prefill.programName ? (
          <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            Webhook program reference: <b>{prefill.programName}</b>. Confirm the correct active grant below.
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-600">
            <span>Active grant / program</span>
            <select
              value={selectedGrantId}
              onChange={(event) => chooseGrant(event.currentTarget.value)}
              disabled={loadingPrograms}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">{loadingPrograms ? "Loading active grants…" : "— manually select grant —"}</option>
              {programs.map((program) => <option key={program.grantId} value={program.grantId}>{program.grantName}</option>)}
            </select>
          </label>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            {selectedEnrollment
              ? <>Existing active enrollment: <b>{selectedEnrollment.grantName || selectedEnrollment.grantId}</b></>
              : selectedProgram
                ? <>A new enrollment will be created for <b>{selectedProgram.grantName}</b> before schedule rows are pushed.</>
                : "Select a grant to resolve or create the enrollment."}
          </div>
        </div>
      </section>

      <section className={`rounded-xl border-2 px-3 py-3 ${requiredClasses(paymentReady)}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Payment schedule</h4>
            <p className="text-xs text-slate-500">Same guided schema as Customer → Payments → Build Payment Schedule.</p>
          </div>
          <StateBadge complete={paymentReady} />
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-2">
          <LineItemField
            value={defaultLineItemId}
            onChange={(lineItemId) => { setDefaultLineItemId(lineItemId); setResults(null); }}
            lineItems={lineItems}
            label="Default line item (required unless every row overrides)"
            allowDefault={false}
          />
          <Field label="Default vendor / payee (required)" value={vendor} onChange={setVendor} placeholder="Landlord or property company" />
        </div>

        <div className="space-y-2">
          {(Object.keys(singles) as SingleKind[]).map((kind) => (
            <SinglePlanCard
              key={kind}
              plan={singles[kind]}
              onChange={(patch) => { setSingles((current) => ({ ...current, [kind]: { ...current[kind], ...patch } })); setResults(null); }}
              lineItems={lineItems}
              defaultLineItemId={defaultLineItemId}
            />
          ))}

          <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recurring Rent</div>
          {rentPlans.map((plan) => (
            <MonthlyPlanCard
              key={plan.id}
              plan={plan}
              onChange={(patch) => { setRentPlans((current) => current.map((item) => item.id === plan.id ? { ...item, ...patch } : item)); setResults(null); }}
              onRemove={() => setRentPlans((current) => current.filter((item) => item.id !== plan.id))}
              lineItems={lineItems}
              defaultLineItemId={defaultLineItemId}
            />
          ))}
          <button type="button" onClick={() => setRentPlans((current) => [...current, defaultMonthly("rent")])} className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
            + Add rent change period
          </button>

          <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Utility Assistance</div>
          {utilityPlans.map((plan) => (
            <MonthlyPlanCard
              key={plan.id}
              plan={plan}
              onChange={(patch) => { setUtilityPlans((current) => current.map((item) => item.id === plan.id ? { ...item, ...patch } : item)); setResults(null); }}
              onRemove={() => setUtilityPlans((current) => current.filter((item) => item.id !== plan.id))}
              lineItems={lineItems}
              defaultLineItemId={defaultLineItemId}
            />
          ))}
          <button type="button" onClick={() => setUtilityPlans((current) => [...current, defaultMonthly("utility")])} className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
            + Add utility period
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule preview</div>
            <div className="text-xs text-slate-700"><b>{schedule.rows.length}</b> rows · <b>{money(total)}</b></div>
          </div>
          {schedule.issues.length ? (
            <ul className="mb-2 space-y-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
              {schedule.issues.map((issue) => <li key={issue} className="text-xs text-rose-700">• {issue}</li>)}
            </ul>
          ) : null}
          {schedule.rows.length ? (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white text-slate-400"><tr><th className="py-1">Date</th><th>Type</th><th>Line item</th><th className="text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.rows.map((row) => (
                    <tr key={row.key}><td className="py-1">{row.dueDate}</td><td>{row.label}</td><td>{lineItems.find((item) => item.id === row.lineItemId)?.label || row.lineItemId}</td><td className="text-right font-medium">{money(row.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-xs text-slate-400">Complete one payment section to preview real queue rows.</div>}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="text-xs text-slate-600">
            {applying ? "Resolving enrollment first, then pushing payment schedule…" : submitted ? "Submitted. Editing any field will require another Submit." : "Nothing is written until Submit is clicked."}
          </div>
          <button
            type="button"
            onClick={apply}
            disabled={!paymentReady || applying}
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {applying ? "Submitting…" : "Submit"}
          </button>
        </div>
        {applyError ? <div className="mt-2 text-xs text-rose-700">Submit failed: {applyError}</div> : null}
        {results ? (
          <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            ✓ {results.filter((result) => result.status === "created").length} payment row{results.filter((result) => result.status === "created").length === 1 ? "" : "s"} created. Enrollment response was resolved before schedule creation; queue projections are syncing.
          </div>
        ) : null}
      </section>
    </div>
  );
}
