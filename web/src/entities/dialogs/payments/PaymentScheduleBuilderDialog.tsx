"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import type { PaymentScheduleBuildInput } from "@hooks/usePayments";
import type { TPayment } from "@types";
import { isISODate10, todayISO as libTodayISO } from "@lib/date";
import { SpreadsheetBuilderView, type SSRow, newSSRow } from "./SpreadsheetBuilderView";
import dynamic from "next/dynamic";
const GrantBudgetStrip = dynamic(
  () => import("@entities/grants/GrantBudgetStrip").then((m) => m.GrantBudgetStrip),
  { ssr: false, loading: () => <div className="h-10 animate-pulse rounded bg-slate-100" /> },
);

function isISO(s: string): boolean { return isISODate10(s); }
function lastDayOfMonth(y: number, mo: number): number {
  return new Date(y, mo, 0).getDate(); // mo is 1-based; day 0 = last of prior month
}
function addMonthsISO(iso: string, m: number): string {
  if (!isISO(iso)) return "";
  const [y0, mo0, d0] = iso.split("-").map(Number);
  const total = y0 * 12 + (mo0 - 1) + m;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const d = Math.min(d0, lastDayOfMonth(y, mo));
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function firstOfNextMonth(iso: string): string {
  if (!isISO(iso)) return "";
  const [y0, mo0] = iso.split("-").map(Number);
  const total = y0 * 12 + (mo0 - 1) + 1;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}-01`;
}

type EnrollmentOption = {
  id: string;
  label: string;
  grantId?: string;
  statusLabel?: "open" | "closed";
  lineItemIds?: string[];
  scheduleMeta?: unknown;
  payments?: TPayment[];
};

type Props = {
  open: boolean;
  enrollments: EnrollmentOption[];
  busy?: boolean;
  customerName?: string;
  onCancel: () => void;
  onBuild: (payload: PaymentScheduleBuildInput) => void;
};

type MonthlyPlanKind = "rent" | "utility";

type MonthlyPlan = {
  id: string;
  kind: MonthlyPlanKind;
  firstDue: string;
  months: string;
  monthlyAmount: string;
  lineItemId: string;
  vendor: string;
  comment: string;
};

type SinglePlan = {
  enabled: boolean;
  date: string;
  amount: string;
  lineItemId: string;
  vendor: string;
  comment: string;
};

type ServicePlan = {
  id: string;
  note: string;
  date: string;
  amount: string;
  lineItemId: string;
  vendor: string;
  comment: string;
};

type PreviewRow = {
  dueDate: string;
  type: "monthly" | "deposit" | "prorated" | "service";
  amount: number;
  lineItemId: string;
  note?: string;
};

type MonthlyOverlapWarning = {
  month: string;
  count: number;
  labels: string[];
};

type CertTaskPlan = {
  enabled: boolean;
  title: string;
  startDate: string;
  cadenceMonths: "3" | "4" | "6" | "12";
  endDate: string;
  bucket: "task" | "compliance";
};

function todayISO(): string {
  return libTodayISO();
}

function plusOneYearISO(iso?: string): string {
  const base = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : todayISO();
  return addMonthsISO(base, 12);
}

function money(v: number): string {
  return Number(v || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rowId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cleanText(value: string): string {
  return String(value || "").trim();
}

function asPositiveNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
}

function asPositiveInt(value: string, max = 120): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(max, Math.floor(n));
}

function isoMonth(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? String(iso).slice(0, 7) : "";
}

function defaultMonthlyPlan(kind: MonthlyPlanKind, lineItemId = "", baseDate?: string): MonthlyPlan {
  const seed = baseDate && isISO(baseDate) ? baseDate : todayISO();
  return {
    id: rowId(kind),
    kind,
    firstDue: firstOfNextMonth(seed),
    months: "12",
    monthlyAmount: "",
    lineItemId,
    vendor: "",
    comment: "",
  };
}

function defaultServicePlan(lineItemId = "", baseDate?: string): ServicePlan {
  const seed = baseDate && isISO(baseDate) ? baseDate : todayISO();
  return {
    id: rowId("service"),
    note: "",
    date: seed,
    amount: "",
    lineItemId,
    vendor: "",
    comment: "",
  };
}

function savedMetaSeed(meta: unknown, fallbackLineItemId: string, seedDate: string) {
  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
  if (!m || m.version !== 1) return null;
  const mapMonthly = (rows: unknown, kind: MonthlyPlanKind): MonthlyPlan[] =>
    (Array.isArray(rows) ? rows : []).map((raw) => {
      const r = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
      return {
        id: rowId(kind),
        kind,
        firstDue: String(r.firstDue || seedDate),
        months: String(r.months || ""),
        monthlyAmount: String(r.monthly ?? r.monthlyAmount ?? ""),
        lineItemId: String(r.lineItemId || fallbackLineItemId || ""),
        vendor: String(r.vendor || ""),
        comment: String(r.comment || ""),
      };
    });
  const mapSingle = (raw: unknown): SinglePlan => {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
      enabled: Boolean(r.enabled),
      date: String(r.date || seedDate),
      amount: String(r.amount || ""),
      lineItemId: String(r.lineItemId || fallbackLineItemId || ""),
      vendor: String(r.vendor || ""),
      comment: String(r.comment || ""),
    };
  };
  const mapServices = (rows: unknown): ServicePlan[] =>
    (Array.isArray(rows) ? rows : []).map((raw) => {
      const r = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
      return {
        id: String(r.id || rowId("service")),
        note: String(r.note || ""),
        date: String(r.date || seedDate),
        amount: String(r.amount || ""),
        lineItemId: String(r.lineItemId || fallbackLineItemId || ""),
        vendor: String(r.vendor || ""),
        comment: String(r.comment || ""),
      };
    });
  return {
    rentPlans: mapMonthly(m.rentPlans, "rent"),
    utilityPlans: mapMonthly(m.utilPlans, "utility"),
    deposit: mapSingle(m.deposit),
    prorated: mapSingle(m.prorated),
    services: mapServices(m.services),
  };
}

function MonthlyPlanEditor({
  label,
  plans,
  onChange,
  onAdd,
  onRemove,
  grantId,
  fallbackLineItemIds,
}: {
  label: string;
  plans: MonthlyPlan[];
  onChange: (id: string, patch: Partial<MonthlyPlan>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  grantId?: string | null;
  fallbackLineItemIds: string[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd}>+ Add row</button>
      </div>
      {plans.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-slate-400">No rows yet.</div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded border border-slate-200 p-2 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs text-slate-600 dark:text-slate-400">{label} plan</div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(plan.id)}>Remove</button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">First Due</div>
                  <input type="date" className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={plan.firstDue} onChange={(e) => onChange(plan.id, { firstDue: e.currentTarget.value })} />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Months</div>
                  <input type="number" min={1} max={120} className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={plan.months} onChange={(e) => onChange(plan.id, { months: e.currentTarget.value })} />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Monthly Amount</div>
                  <input type="number" min={0} step="0.01" className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={plan.monthlyAmount} onChange={(e) => onChange(plan.id, { monthlyAmount: e.currentTarget.value })} placeholder="0.00" />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Line Item</div>
                  <LineItemSelect
                    grantId={grantId || null}
                    value={plan.lineItemId}
                    onChange={(next) => onChange(plan.id, { lineItemId: String(next || "") })}
                    fallbackLineItemIds={fallbackLineItemIds}
                    inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Vendor (optional)</div>
                  <input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={plan.vendor} onChange={(e) => onChange(plan.id, { vendor: e.currentTarget.value })} />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Comment (optional)</div>
                  <input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={plan.comment} onChange={(e) => onChange(plan.id, { comment: e.currentTarget.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentScheduleBuilderDialog({
  open,
  enrollments,
  busy = false,
  customerName,
  onCancel,
  onBuild,
}: Props) {
  const [enrollmentId, setEnrollmentId] = React.useState("");
  const [replaceUnpaid, setReplaceUnpaid] = React.useState(true);
  const [updateGrantBudgets, setUpdateGrantBudgets] = React.useState(true);
  const [recalcGrantProjected, setRecalcGrantProjected] = React.useState(true);

  const [rentPlans, setRentPlans] = React.useState<MonthlyPlan[]>([]);
  const [utilityPlans, setUtilityPlans] = React.useState<MonthlyPlan[]>([]);
  const [deposit, setDeposit] = React.useState<SinglePlan>({ enabled: false, date: todayISO(), amount: "", lineItemId: "", vendor: "", comment: "" });
  const [prorated, setProrated] = React.useState<SinglePlan>({ enabled: false, date: todayISO(), amount: "", lineItemId: "", vendor: "", comment: "" });
  const [services, setServices] = React.useState<ServicePlan[]>([]);
  const [certTask, setCertTask] = React.useState<CertTaskPlan>({
    enabled: false,
    title: "Rent Certification",
    startDate: todayISO(),
    cadenceMonths: "3",
    endDate: plusOneYearISO(),
    bucket: "compliance",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"builder" | "spreadsheet">("builder");
  const [ssRows, setSsRows] = React.useState<SSRow[]>(() => [newSSRow()]);

  const seedFromEnrollment = React.useCallback((enr?: EnrollmentOption) => {
    const firstLineItem = enr?.lineItemIds?.[0] || "";
    const seedDate = todayISO();
    const saved = savedMetaSeed(enr?.scheduleMeta, firstLineItem, seedDate);
    setEnrollmentId(enr?.id || "");
    setReplaceUnpaid(true);
    setUpdateGrantBudgets(true);
    setRecalcGrantProjected(true);
    setRentPlans(saved?.rentPlans?.length ? saved.rentPlans : [defaultMonthlyPlan("rent", firstLineItem, seedDate)]);
    setUtilityPlans(saved?.utilityPlans || []);
    setDeposit(saved?.deposit || { enabled: false, date: seedDate, amount: "", lineItemId: firstLineItem, vendor: "", comment: "" });
    setProrated(saved?.prorated || { enabled: false, date: seedDate, amount: "", lineItemId: firstLineItem, vendor: "", comment: "" });
    setServices(saved?.services || []);
    setCertTask({
      enabled: false,
      title: "Rent Certification",
      startDate: seedDate,
      cadenceMonths: "3",
      endDate: plusOneYearISO(seedDate),
      bucket: "compliance",
    });
    setError(null);
    const ssBase = newSSRow("monthly-rent", firstOfNextMonth(seedDate));
    ssBase.lineItemId = firstLineItem;
    setSsRows([ssBase]);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    seedFromEnrollment(enrollments[0]);
  }, [open, enrollments, seedFromEnrollment]);

  const selectedEnrollment = React.useMemo(
    () => enrollments.find((e) => e.id === enrollmentId) || null,
    [enrollmentId, enrollments],
  );

  const fallbackLineItemIds = selectedEnrollment?.lineItemIds || [];

  const patchMonthlyPlans = (
    setter: React.Dispatch<React.SetStateAction<MonthlyPlan[]>>,
    id: string,
    patch: Partial<MonthlyPlan>,
  ) => {
    setter((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const previewRows = React.useMemo<PreviewRow[]>(() => {
    const rows: PreviewRow[] = [];

    const pushMonthly = (plans: MonthlyPlan[], kind: MonthlyPlanKind) => {
      for (const plan of plans) {
        const count = asPositiveInt(plan.months, 120);
        const amt = asPositiveNumber(plan.monthlyAmount);
        if (!count || !amt || !isISO(plan.firstDue) || !cleanText(plan.lineItemId)) continue;
        for (let i = 0; i < count; i++) {
          const due = addMonthsISO(plan.firstDue, i);
          if (!due) continue;
          rows.push({
            dueDate: due,
            type: "monthly",
            amount: amt,
            lineItemId: cleanText(plan.lineItemId),
            note: kind,
          });
        }
      }
    };

    pushMonthly(rentPlans, "rent");
    pushMonthly(utilityPlans, "utility");

    if (deposit.enabled) {
      const amt = asPositiveNumber(deposit.amount);
      if (amt && isISO(deposit.date) && cleanText(deposit.lineItemId)) {
        rows.push({ dueDate: deposit.date, type: "deposit", amount: amt, lineItemId: cleanText(deposit.lineItemId), note: "Security Deposit" });
      }
    }

    if (prorated.enabled) {
      const amt = asPositiveNumber(prorated.amount);
      if (amt && isISO(prorated.date) && cleanText(prorated.lineItemId)) {
        rows.push({ dueDate: prorated.date, type: "prorated", amount: amt, lineItemId: cleanText(prorated.lineItemId), note: "Prorated Rent" });
      }
    }

    for (const svc of services) {
      const amt = asPositiveNumber(svc.amount);
      if (amt && isISO(svc.date) && cleanText(svc.lineItemId) && cleanText(svc.note)) {
        rows.push({ dueDate: svc.date, type: "service", amount: amt, lineItemId: cleanText(svc.lineItemId), note: cleanText(svc.note) });
      }
    }

    rows.sort((a, b) => `${a.dueDate}|${a.type}`.localeCompare(`${b.dueDate}|${b.type}`));
    return rows;
  }, [rentPlans, utilityPlans, deposit, prorated, services]);

  const totals = React.useMemo(() => {
    const monthlyCount = previewRows.filter((r) => r.type === "monthly").length;
    const monthlyTotal = previewRows.filter((r) => r.type === "monthly").reduce((s, r) => s + r.amount, 0);
    const depositTotal = previewRows.filter((r) => r.type === "deposit").reduce((s, r) => s + r.amount, 0);
    const proratedTotal = previewRows.filter((r) => r.type === "prorated").reduce((s, r) => s + r.amount, 0);
    const serviceTotal = previewRows.filter((r) => r.type === "service").reduce((s, r) => s + r.amount, 0);
    const grandTotal = previewRows.reduce((s, r) => s + r.amount, 0);
    return { monthlyCount, monthlyTotal, depositTotal, proratedTotal, serviceTotal, grandTotal };
  }, [previewRows]);

  const monthlyOverlapWarnings = React.useMemo<MonthlyOverlapWarning[]>(() => {
    const buckets = new Map<string, { count: number; labels: string[] }>();
    for (const row of previewRows) {
      if (row.type !== "monthly") continue;
      const month = isoMonth(row.dueDate);
      if (!month) continue;
      const key = `${month}|${row.lineItemId}`;
      const slot = buckets.get(key) || { count: 0, labels: [] };
      slot.count += 1;
      if (row.note && !slot.labels.includes(String(row.note))) slot.labels.push(String(row.note));
      buckets.set(key, slot);
    }
    return Array.from(buckets.entries())
      .filter(([, v]) => v.count > 1)
      .slice(0, 6)
      .map(([key, v]) => {
        const [month] = key.split("|");
        return { month, count: v.count, labels: v.labels };
      });
  }, [previewRows]);

  const ssTotals = React.useMemo(() => {
    let grand = 0;
    let monthlyCount = 0;
    for (const r of ssRows) {
      const amt = Number(r.amount) || 0;
      if (!amt || !r.lineItemId) continue;
      if (r.typeKey === "monthly-rent" || r.typeKey === "monthly-utility") {
        const m = Math.max(1, Math.floor(Number(r.months) || 1));
        grand += amt * m;
        monthlyCount += m;
      } else {
        grand += amt;
      }
    }
    return { grand, monthlyCount };
  }, [ssRows]);

  const budgetPreview = React.useMemo(() => {
    const lineItemDeltas: Record<string, number> = {};
    const add = (lineItemId: string, amount: number) => {
      const key = cleanText(lineItemId);
      if (!key || !Number.isFinite(amount) || amount <= 0) return;
      lineItemDeltas[key] = (lineItemDeltas[key] || 0) + amount;
    };

    if (viewMode === "spreadsheet") {
      for (const row of ssRows) {
        const amount = asPositiveNumber(row.amount);
        if (!amount || !row.lineItemId) continue;
        const multiplier =
          row.typeKey === "monthly-rent" || row.typeKey === "monthly-utility"
            ? asPositiveInt(row.months, 120) || 1
            : 1;
        add(row.lineItemId, amount * multiplier);
      }
    } else {
      for (const row of previewRows) add(row.lineItemId, row.amount);
    }

    if (replaceUnpaid) {
      for (const payment of selectedEnrollment?.payments || []) {
        if (payment?.paid) continue;
        const lineItemId = cleanText(String(payment.lineItemId || ""));
        const amount = Number(payment.amount || 0);
        if (!lineItemId || !Number.isFinite(amount) || amount <= 0) continue;
        lineItemDeltas[lineItemId] = (lineItemDeltas[lineItemId] || 0) - amount;
      }
    }

    return {
      total: Object.values(lineItemDeltas).reduce((sum, amount) => sum + amount, 0),
      lineItemDeltas,
    };
  }, [previewRows, replaceUnpaid, selectedEnrollment?.payments, ssRows, viewMode]);

  const ssSubmit = () => {
    setError(null);
    if (!enrollmentId) return setError("Select an enrollment.");
    if (ssRows.length === 0) return setError("Add at least one row.");
    const monthlyPlans: NonNullable<PaymentScheduleBuildInput["monthlyPlans"]> = [];
    const additions: NonNullable<PaymentScheduleBuildInput["additions"]> = [];
    for (let i = 0; i < ssRows.length; i++) {
      const r = ssRows[i];
      const amt = asPositiveNumber(r.amount);
      if (!amt) return setError(`Row ${i + 1}: amount must be positive.`);
      if (!isISO(r.date)) return setError(`Row ${i + 1}: date must be YYYY-MM-DD.`);
      if (!r.lineItemId) return setError(`Row ${i + 1}: select a line item.`);
      const vendor = cleanText(r.vendor);
      const note = cleanText(r.note);
      if (r.typeKey === "monthly-rent" || r.typeKey === "monthly-utility") {
        const months = asPositiveInt(r.months, 120) || 1;
        monthlyPlans.push({
          kind: r.typeKey === "monthly-rent" ? "rent" : "utility",
          startDate: r.date,
          months,
          monthlyAmount: amt,
          lineItemId: r.lineItemId,
          ...(vendor ? { vendor } : {}),
          ...(note ? { comment: note } : {}),
        });
      } else {
        const defaultNote: Record<string, string> = { prorated: "Prorated Rent", deposit: "Security Deposit" };
        additions.push({
          amount: amt,
          dueDate: r.date,
          lineItemId: r.lineItemId,
          type: r.typeKey as "prorated" | "deposit" | "service",
          note: note || defaultNote[r.typeKey] || r.typeKey,
          ...(vendor ? { vendor } : {}),
        });
      }
    }
    onBuild({
      enrollmentId,
      replaceUnpaid,
      monthlyPlans,
      additions,
      options: { updateGrantBudgets, recalcGrantProjected, activeOnly: true },
    });
  };

  const submit = () => {
    setError(null);
    if (!enrollmentId) return setError("Select an enrollment.");
    if (previewRows.length === 0) return setError("Add at least one valid payment row to build the schedule.");

    for (const plan of [...rentPlans, ...utilityPlans]) {
      if (!isISO(plan.firstDue)) return setError("Monthly plan first due date must be YYYY-MM-DD.");
      if (plan.months !== "" && asPositiveInt(plan.months, 120) === 0) return setError("Monthly plan months must be between 1 and 120.");
      if (plan.monthlyAmount !== "" && asPositiveNumber(plan.monthlyAmount) === 0) return setError("Monthly plan amount must be greater than 0.");
    }
    if (deposit.enabled && !isISO(deposit.date)) return setError("Deposit date must be YYYY-MM-DD.");
    if (prorated.enabled && !isISO(prorated.date)) return setError("Prorated date must be YYYY-MM-DD.");
    if (services.some((s) => s.date && !isISO(s.date))) return setError("Service dates must be YYYY-MM-DD.");

    const additions: NonNullable<PaymentScheduleBuildInput["additions"]> = [];

    if (deposit.enabled) {
      const amt = asPositiveNumber(deposit.amount);
      const lineItemId = cleanText(deposit.lineItemId);
      if (amt && lineItemId && isISO(deposit.date)) {
        additions.push({
          amount: amt,
          dueDate: deposit.date,
          lineItemId,
          type: "deposit",
          note: ["Security Deposit"],
          ...(cleanText(deposit.vendor) ? { vendor: cleanText(deposit.vendor) } : {}),
          ...(cleanText(deposit.comment) ? { comment: cleanText(deposit.comment) } : {}),
        });
      }
    }

    if (prorated.enabled) {
      const amt = asPositiveNumber(prorated.amount);
      const lineItemId = cleanText(prorated.lineItemId);
      if (amt && lineItemId && isISO(prorated.date)) {
        additions.push({
          amount: amt,
          dueDate: prorated.date,
          lineItemId,
          type: "prorated",
          note: ["Prorated Rent"],
          ...(cleanText(prorated.vendor) ? { vendor: cleanText(prorated.vendor) } : {}),
          ...(cleanText(prorated.comment) ? { comment: cleanText(prorated.comment) } : {}),
        });
      }
    }

    for (const svc of services) {
      const amt = asPositiveNumber(svc.amount);
      const lineItemId = cleanText(svc.lineItemId);
      const note = cleanText(svc.note);
      if (!amt || !lineItemId || !note || !isISO(svc.date)) continue;
      additions.push({
        amount: amt,
        dueDate: svc.date,
        lineItemId,
        type: "service",
        note,
        ...(cleanText(svc.vendor) ? { vendor: cleanText(svc.vendor) } : {}),
        ...(cleanText(svc.comment) ? { comment: cleanText(svc.comment) } : {}),
      });
    }

    const taskDefs: unknown[] = [];
    const rentCertTaskPrefix = "payment_rent_cert_";
    if (certTask.enabled) {
      const certStart = certTask.startDate;
      const certEnd = certTask.endDate;
      if (!isISO(certStart)) return setError("Certification task start date must be YYYY-MM-DD.");
      if (certEnd && !isISO(certEnd)) return setError("Certification task end date must be YYYY-MM-DD.");

      const cadence = Math.max(1, Number(certTask.cadenceMonths) || 3);
      const monthLabel = (iso: string) => {
        if (!isISO(iso)) return iso;
        const [, month, day] = iso.split("-");
        const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${names[Math.max(0, Math.min(11, Number(month) - 1))]} ${Number(day)}`;
      };
      rentPlans.forEach((plan, planIndex) => {
        const months = asPositiveInt(plan.months);
        const lineItemId = cleanText(plan.lineItemId) || `rent_${planIndex + 1}`;
        for (let offset = cadence; offset < months; offset += cadence) {
          const targetDate = addMonthsISO(plan.firstDue, offset);
          const dueDate = addMonthsISO(targetDate, -1);
          if (!isISO(targetDate) || !isISO(dueDate)) continue;
          if (certEnd && dueDate > certEnd) continue;
          const label = `${monthLabel(targetDate)} rent cert due ${monthLabel(dueDate)}`;
          const idBase = `${rentCertTaskPrefix}${lineItemId}_${targetDate}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
          taskDefs.push(
            {
              id: `${idBase}_cm`,
              name: label,
              kind: "one-off",
              dueDate,
              bucket: certTask.bucket,
              notify: true,
              assignedToGroup: "casemanager",
              notes: `Collect updated rent certification documents from the customer and landlord by ${monthLabel(dueDate)} for ${monthLabel(targetDate)} assistance.`,
              description: certTask.title.trim() || "Rent Certification",
            },
            {
              id: `${idBase}_compliance`,
              name: label,
              kind: "one-off",
              dueDate,
              bucket: certTask.bucket,
              notify: true,
              assignedToGroup: "compliance",
              notes: `Prepare and send the updated rent certification / notice by ${monthLabel(dueDate)} for ${monthLabel(targetDate)} assistance.`,
              description: certTask.title.trim() || "Rent Certification",
            },
          );
        }
      });
    }

    onBuild({
      enrollmentId,
      replaceUnpaid,
      monthlyPlans: [
        ...rentPlans.map((plan) => ({
          kind: "rent" as const,
          startDate: plan.firstDue,
          months: asPositiveInt(plan.months, 120),
          monthlyAmount: asPositiveNumber(plan.monthlyAmount),
          lineItemId: cleanText(plan.lineItemId),
          ...(cleanText(plan.vendor) ? { vendor: cleanText(plan.vendor) } : {}),
          ...(cleanText(plan.comment) ? { comment: cleanText(plan.comment) } : {}),
        })),
        ...utilityPlans.map((plan) => ({
          kind: "utility" as const,
          startDate: plan.firstDue,
          months: asPositiveInt(plan.months, 120),
          monthlyAmount: asPositiveNumber(plan.monthlyAmount),
          lineItemId: cleanText(plan.lineItemId),
          ...(cleanText(plan.vendor) ? { vendor: cleanText(plan.vendor) } : {}),
          ...(cleanText(plan.comment) ? { comment: cleanText(plan.comment) } : {}),
        })),
      ],
      additions,
      options: {
        updateGrantBudgets,
        recalcGrantProjected,
        activeOnly: true,
      },
      taskDefs,
      replaceTaskDefPrefixes: [rentCertTaskPrefix, "pay_cert_"],
    });
  };

  return (
    <Modal
      tourId="payment-schedule-builder-dialog"
      isOpen={open}
      title={customerName ? `Build Payment Schedule - ${customerName}` : "Build Payment Schedule"}
      onClose={onCancel}
      widthClass="max-w-6xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={replaceUnpaid} onChange={(e) => setReplaceUnpaid(e.currentTarget.checked)} />
              Overwrite unpaid schedule, keep paid rows
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={updateGrantBudgets} onChange={(e) => setUpdateGrantBudgets(e.currentTarget.checked)} />
              Update grant budgets
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={recalcGrantProjected} onChange={(e) => setRecalcGrantProjected(e.currentTarget.checked)} />
              Recalculate grant projected totals
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="btn btn-sm" onClick={viewMode === "spreadsheet" ? ssSubmit : submit} disabled={busy}>{busy ? "Building..." : "Build Schedule"}</button>
          </div>
        </div>
      }
    >
      <div className="relative space-y-4">
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-white/80 backdrop-blur-[1px] dark:bg-slate-900/80">
            <div className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Building payment schedule...
            </div>
          </div>
        ) : null}
        {error ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</div> : null}
        {monthlyOverlapWarnings.length ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            Multiple monthly rows are scheduled in the same month for the same line item. This usually means you created more than one monthly plan stream (for example rent + utility, or duplicate rent rows).
            <div className="mt-1">
              {monthlyOverlapWarnings.map((w) => (
                <div key={`${w.month}:${w.count}`}>
                  {w.month}: {w.count} monthly rows{w.labels.length ? ` (${w.labels.join(", ")})` : ""}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Schedule setup</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Build projected rows for one enrollment and preview grant impact before posting.
              </div>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              {(["builder", "spreadsheet"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    viewMode === mode
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {mode === "spreadsheet" ? "Spreadsheet" : "Guided Builder"}
                </button>
              ))}
            </div>
          </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm" style={{ minWidth: "220px" }}>
            <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Enrollment</div>
            <select
              className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={enrollmentId}
              onChange={(e) => seedFromEnrollment(enrollments.find((x) => x.id === e.currentTarget.value))}
            >
              <option value="">-- Select enrollment --</option>
              {enrollments.map((e) => (
                <option key={e.id} value={e.id}>{e.label}{e.statusLabel ? ` (${e.statusLabel})` : ""}</option>
              ))}
            </select>
          </label>

          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {viewMode === "spreadsheet" ? (
              <>
                <div>Overall Total: <b>{money(ssTotals.grand)}</b></div>
                <div>Length of Assistance (months): <b>{ssTotals.monthlyCount}</b></div>
              </>
            ) : (
              <>
                <div>Rows: <b>{previewRows.length}</b></div>
                <div>Total: <b>{money(totals.grandTotal)}</b></div>
                {previewRows.length ? (
                  <div>Range: <b>{previewRows[0]?.dueDate}</b> {"->"} <b>{previewRows[previewRows.length - 1]?.dueDate}</b></div>
                ) : null}
              </>
            )}
          </div>
        </div>
        </div>

        <GrantBudgetStrip
          grantId={selectedEnrollment?.grantId}
          projectionDelta={budgetPreview.total}
          lineItemDeltas={budgetPreview.lineItemDeltas}
        />

        {viewMode === "spreadsheet" ? (
          <SpreadsheetBuilderView
            rows={ssRows}
            setRows={setSsRows}
            grantId={selectedEnrollment?.grantId}
          />
        ) : null}

        {viewMode === "builder" ? (<>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            <input
              type="checkbox"
              checked={certTask.enabled}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setCertTask((prev) => ({ ...prev, enabled: checked }));
              }}
            />
            Build recurring certification tasks (CM + Compliance)
          </label>
          {certTask.enabled ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Task Title</div>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={certTask.title}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setCertTask((prev) => ({ ...prev, title: value }));
                  }}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Start Date</div>
                <input
                  type="date"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={certTask.startDate}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setCertTask((prev) => ({ ...prev, startDate: value }));
                  }}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Cadence</div>
                <select
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={certTask.cadenceMonths}
                  onChange={(e) => {
                    const value = e.currentTarget.value as CertTaskPlan["cadenceMonths"];
                    setCertTask((prev) => ({ ...prev, cadenceMonths: value }));
                  }}
                >
                  <option value="3">Every 3 months</option>
                  <option value="4">Every 4 months</option>
                  <option value="6">Every 6 months</option>
                  <option value="12">Yearly</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">End Date</div>
                <input
                  type="date"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={certTask.endDate}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setCertTask((prev) => ({ ...prev, endDate: value }));
                  }}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Bucket</div>
                <select
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={certTask.bucket}
                  onChange={(e) => {
                    const value = e.currentTarget.value as CertTaskPlan["bucket"];
                    setCertTask((prev) => ({ ...prev, bucket: value }));
                  }}
                >
                  <option value="compliance">compliance</option>
                  <option value="task">task</option>
                </select>
              </label>
              <div className="flex items-end text-xs text-slate-600 dark:text-slate-400">
                Creates a sequential two-step recurring task (case manager {"->"} compliance).
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">Optional: build rent-cert reminder tasks alongside payment projections.</div>
          )}
        </div>

        <MonthlyPlanEditor
          label="Rent"
          plans={rentPlans}
          onChange={(id, patch) => patchMonthlyPlans(setRentPlans, id, patch)}
          onAdd={() => setRentPlans((prev) => [...prev, defaultMonthlyPlan("rent", fallbackLineItemIds[0] || "")])}
          onRemove={(id) => setRentPlans((prev) => prev.filter((p) => p.id !== id))}
          grantId={selectedEnrollment?.grantId || null}
          fallbackLineItemIds={fallbackLineItemIds}
        />

        <MonthlyPlanEditor
          label="Utilities"
          plans={utilityPlans}
          onChange={(id, patch) => patchMonthlyPlans(setUtilityPlans, id, patch)}
          onAdd={() => setUtilityPlans((prev) => [...prev, defaultMonthlyPlan("utility", fallbackLineItemIds[0] || "")])}
          onRemove={(id) => setUtilityPlans((prev) => prev.filter((p) => p.id !== id))}
          grantId={selectedEnrollment?.grantId || null}
          fallbackLineItemIds={fallbackLineItemIds}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
              <input
                type="checkbox"
                checked={deposit.enabled}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setDeposit((prev) => ({ ...prev, enabled: checked }));
                }}
              />
              Security Deposit
            </label>
            {deposit.enabled ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Date</div><input type="date" className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={deposit.date} onChange={(e) => { const value = e.currentTarget.value; setDeposit((prev) => ({ ...prev, date: value })); }} /></label>
                <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Amount</div><input type="number" min={0} step="0.01" className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={deposit.amount} onChange={(e) => { const value = e.currentTarget.value; setDeposit((prev) => ({ ...prev, amount: value })); }} /></label>
                <label className="text-sm md:col-span-2"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Line Item</div><LineItemSelect grantId={selectedEnrollment?.grantId || null} value={deposit.lineItemId} onChange={(next) => setDeposit((prev) => ({ ...prev, lineItemId: String(next || "") }))} fallbackLineItemIds={fallbackLineItemIds} inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label>
                <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Vendor (optional)</div><input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={deposit.vendor} onChange={(e) => { const value = e.currentTarget.value; setDeposit((prev) => ({ ...prev, vendor: value })); }} /></label>
                <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Comment (optional)</div><input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={deposit.comment} onChange={(e) => { const value = e.currentTarget.value; setDeposit((prev) => ({ ...prev, comment: value })); }} /></label>
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">Enable to add a one-time deposit row.</div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
              <input
                type="checkbox"
                checked={prorated.enabled}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setProrated((prev) => ({ ...prev, enabled: checked }));
                }}
              />
              Prorated Rent
            </label>
            {prorated.enabled ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Date</div><input type="date" className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={prorated.date} onChange={(e) => { const value = e.currentTarget.value; setProrated((prev) => ({ ...prev, date: value })); }} /></label>
                <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Amount</div><input type="number" min={0} step="0.01" className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={prorated.amount} onChange={(e) => { const value = e.currentTarget.value; setProrated((prev) => ({ ...prev, amount: value })); }} /></label>
                <label className="text-sm md:col-span-2"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Line Item</div><LineItemSelect grantId={selectedEnrollment?.grantId || null} value={prorated.lineItemId} onChange={(next) => setProrated((prev) => ({ ...prev, lineItemId: String(next || "") }))} fallbackLineItemIds={fallbackLineItemIds} inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label>
                <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Vendor (optional)</div><input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={prorated.vendor} onChange={(e) => { const value = e.currentTarget.value; setProrated((prev) => ({ ...prev, vendor: value })); }} /></label>
                <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Comment (optional)</div><input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={prorated.comment} onChange={(e) => { const value = e.currentTarget.value; setProrated((prev) => ({ ...prev, comment: value })); }} /></label>
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">Enable to add a one-time prorated rent row.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Support Services</div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setServices((prev) => [...prev, defaultServicePlan(fallbackLineItemIds[0] || "")])}>+ Add service</button>
          </div>
          {services.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">No service rows yet.</div>
          ) : (
            <div className="space-y-3">
              {services.map((svc) => (
                <div key={svc.id} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Service row</div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setServices((prev) => prev.filter((s) => s.id !== svc.id))}>Remove</button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Service Note</div><input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={svc.note} onChange={(e) => { const value = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, note: value } : s)); }} placeholder="Transportation, childcare, etc." /></label>
                    <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Amount</div><input type="number" min={0} step="0.01" className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={svc.amount} onChange={(e) => { const value = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, amount: value } : s)); }} /></label>
                    <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Date</div><input type="date" className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={svc.date} onChange={(e) => { const value = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, date: value } : s)); }} /></label>
                    <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Line Item</div><LineItemSelect grantId={selectedEnrollment?.grantId || null} value={svc.lineItemId} onChange={(next) => setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, lineItemId: String(next || "") } : s))} fallbackLineItemIds={fallbackLineItemIds} inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label>
                    <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Vendor (optional)</div><input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={svc.vendor} onChange={(e) => { const value = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, vendor: value } : s)); }} /></label>
                    <label className="text-sm"><div className="mb-1 text-xs text-slate-600 dark:text-slate-400">Comment (optional)</div><input className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={svc.comment} onChange={(e) => { const value = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, comment: value } : s)); }} /></label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Overall Total</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{money(totals.grandTotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <div>Length of Assistance (months): <b>{totals.monthlyCount}</b></div>
            <div>Monthly total: <b>{money(totals.monthlyTotal)}</b></div>
            <div>Deposit total: <b>{money(totals.depositTotal)}</b></div>
            <div>Prorated total: <b>{money(totals.proratedTotal)}</b></div>
            <div>Service total: <b>{money(totals.serviceTotal)}</b></div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">Draft Preview</div>
          {previewRows.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">Build rows above to preview the schedule.</div>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-2 py-1 text-left">Due</th>
                    <th className="px-2 py-1 text-left">Type</th>
                    <th className="px-2 py-1 text-left">Note</th>
                    <th className="px-2 py-1 text-left">Line Item</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={`${row.type}:${row.dueDate}:${row.lineItemId}:${idx}`} className="border-t border-slate-100 dark:border-slate-700 dark:text-slate-300">
                      <td className="px-2 py-1">{row.dueDate}</td>
                      <td className="px-2 py-1">{row.type}</td>
                      <td className="px-2 py-1">{row.note || "-"}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{row.lineItemId}</td>
                      <td className="px-2 py-1 text-right">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>) : null}
      </div>
    </Modal>
  );
}
