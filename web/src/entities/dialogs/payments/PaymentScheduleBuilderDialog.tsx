"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import { DateInput } from "@entities/ui/DateInput";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import type { PaymentScheduleBuildInput } from "@hooks/usePayments";
import type { TPayment } from "@types";
import { isISODate10, todayISO, addMonthsISO, firstOfNextMonthISO, isoToYearMonth, fmtShortMonthDay } from "@lib/date";
import { fmtCurrencyUSD } from "@lib/formatters";
import { useGrant } from "@hooks/useGrants";
import { SpreadsheetBuilderView, type SSRow, newSSRow } from "./SpreadsheetBuilderView";
import { TripleToggle, certDueToggleValue } from "@entities/ui/TripleToggle";
import { paymentTypeLabel } from "@entities/payments/PaymentTypeLabel";
import dynamic from "next/dynamic";
const GrantBudgetStrip = dynamic(
  () => import("@entities/grants/GrantBudgetStrip").then((m) => m.GrantBudgetStrip),
  { ssr: false, loading: () => <div className="h-10 animate-pulse rounded bg-slate-100" /> },
);

const isISO = isISODate10;

type EnrollmentOption = {
  id: string;
  label: string;
  grantId?: string;
  endDate?: string | null;
  statusLabel?: "open" | "closed";
  lineItemIds?: string[];
  scheduleMeta?: unknown;
  payments?: TPayment[];
};

function isOpenEnrollmentOption(enrollment: EnrollmentOption): boolean {
  return enrollment.statusLabel !== "closed";
}

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
  comment: string;
  advancedOpen?: boolean;
  collapsed?: boolean;
};

type SinglePlan = {
  date: string;
  amount: string;
  lineItemId: string;
  vendor: string;
  comment: string;
  paid?: boolean;
  hmisComplete?: boolean;
  caseworthyComplete?: boolean;
  advancedOpen?: boolean;
  collapsed?: boolean;
};

type ServicePlan = {
  id: string;
  note: string;
  date: string;
  amount: string;
  lineItemId: string;
  vendor: string;
  comment: string;
  paid?: boolean;
  hmisComplete?: boolean;
  caseworthyComplete?: boolean;
  collapsed?: boolean;
};

type CertTaskPlan = {
  enabled: boolean;
  cadenceMonths: "3" | "4" | "6" | "12";
  endDate: string;
  bucket: "task" | "compliance";
  title: string;
  advancedOpen: boolean;
};

type CertPreviewRow = { dueDate: string; targetDate: string; label: string };

type PaymentCoreType = TPayment["type"];
type PreviewFlags = { paid?: boolean; hmisComplete?: boolean; caseworthyComplete?: boolean };

type PreviewRow = {
  dueDate: string;
  type: PaymentCoreType;
  amount: number;
  lineItemId: string;
  note?: string;
  comment?: string;
  paid?: boolean;
  hmisComplete?: boolean;
  caseworthyComplete?: boolean;
};

type PreviewTableRow =
  | { key: string; dueDate: string; status: "paid" | "remove"; type: string; note: string; comment: string; lineItemId: string; amount: number; flags?: PreviewFlags }
  | { key: string; dueDate: string; status: "new"; type: PreviewRow["type"]; note: string; comment: string; lineItemId: string; amount: number; flags?: PreviewFlags };

type CompletionState = "empty" | "partial" | "complete";

function completionState(required: (string | boolean)[], anyFilled: (string | boolean)[]): CompletionState {
  const hasAny = anyFilled.some((v) => !!v);
  const allReq = required.every((v) => !!v);
  if (!hasAny) return "empty";
  if (allReq) return "complete";
  return "partial";
}

function stateClasses(s: CompletionState): string {
  if (s === "complete") return "border-green-300 bg-green-50/40 dark:border-green-700 dark:bg-green-950/20";
  if (s === "partial")  return "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20";
  return "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900";
}

const money = fmtCurrencyUSD;

function rowId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cleanText(value: string): string { return String(value || "").trim(); }

function paymentBuildKey(row: Pick<PreviewRow, "type" | "dueDate" | "lineItemId" | "amount"> & { note?: unknown }): string {
  const note = Array.isArray(row.note) ? row.note.join("|") : String(row.note ?? "");
  const cents = Math.round(Number(row.amount || 0) * 100);
  return [
    String(row.type || "").toLowerCase(),
    String(row.dueDate || "").slice(0, 10),
    String(row.lineItemId || "").trim(),
    String(cents),
    note.trim().toLowerCase(),
  ].join("|");
}

function flagsFromPlan(plan: Pick<SinglePlan, "paid" | "hmisComplete" | "caseworthyComplete">): PreviewFlags {
  return {
    paid: plan.paid === true,
    hmisComplete: plan.hmisComplete === true,
    caseworthyComplete: plan.caseworthyComplete === true,
  };
}

function paymentPatchFromFlags(flags?: PreviewFlags): Pick<TPayment, "paid" | "paidAt" | "paidFromGrant" | "compliance"> {
  const paid = flags?.paid === true;
  const hmisComplete = flags?.hmisComplete === true;
  const caseworthyComplete = flags?.caseworthyComplete === true;
  return {
    paid,
    paidAt: paid ? todayISO() : null,
    paidFromGrant: paid,
    compliance: hmisComplete || caseworthyComplete ? { hmisComplete, caseworthyComplete, items: [] } : null,
  };
}

function listFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function invoiceDocsFromGrant(grant: Record<string, unknown> | null | undefined): string[] {
  if (!grant) return [];
  const direct = listFromUnknown(grant.invoiceDocuments);
  if (direct.length) return direct;
  const details = grant.details && typeof grant.details === "object" ? grant.details as Record<string, unknown> : {};
  const nested = listFromUnknown(details.invoiceDocuments);
  if (nested.length) return nested;
  for (const key of ["Invoice Docs", "Invoice Documents"]) {
    const raw = grant[key];
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "_value" in raw) {
      const rows = listFromUnknown((raw as Record<string, unknown>)._value);
      if (rows.length) return rows;
    }
    const rows = listFromUnknown(raw);
    if (rows.length) return rows;
  }
  return [];
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

const isoMonth = isoToYearMonth;
const fmtMonth = fmtShortMonthDay;

function minISODate(...values: Array<string | null | undefined>): string {
  return values
    .map((value) => String(value || "").slice(0, 10))
    .filter(isISO)
    .sort()[0] || "";
}

function maxPaymentDueDate(rows: Array<Pick<PreviewRow, "dueDate"> | TPayment>): string {
  let max = "";
  for (const row of rows) {
    const due = String((row as { dueDate?: unknown }).dueDate || "").slice(0, 10);
    if (isISO(due) && (!max || due > max)) max = due;
  }
  return max;
}

function defaultMonthlyPlan(kind: MonthlyPlanKind, lineItemId = "", baseDate?: string): MonthlyPlan {
  const seed = baseDate && isISO(baseDate) ? baseDate : "";
  return {
    id: rowId(kind),
    kind,
    firstDue: seed ? firstOfNextMonthISO(seed) : "",
    months: seed ? "12" : "",
    monthlyAmount: "",
    lineItemId,
    comment: "",
    advancedOpen: false,
  };
}

function defaultServicePlan(lineItemId = "", baseDate?: string): ServicePlan {
  const seed = baseDate && isISO(baseDate) ? baseDate : todayISO();
  return { id: rowId("service"), note: "", date: seed, amount: "", lineItemId, vendor: "", comment: "" };
}

function defaultSinglePlan(lineItemId = "", baseDate?: string): SinglePlan {
  const seed = baseDate && isISO(baseDate) ? baseDate : "";
  return { date: seed, amount: "", lineItemId, vendor: "", comment: "", advancedOpen: false };
}

function singlePlanHasAny(plan: SinglePlan): boolean {
  return Boolean(plan.date || plan.amount || plan.vendor || plan.comment || plan.lineItemId);
}

function savedMetaSeed(meta: unknown, fallbackLineItemId: string, seedDate: string) {
  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
  if (!m || m.version !== 1) return null;
  const mapMonthly = (rows: unknown, kind: MonthlyPlanKind): MonthlyPlan[] =>
    (Array.isArray(rows) ? rows : []).map((raw) => {
      const r = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
      return {
        id: rowId(kind), kind,
        firstDue: String(r.firstDue || seedDate),
        months: String(r.months || ""),
        monthlyAmount: String(r.monthly ?? r.monthlyAmount ?? ""),
        lineItemId: String(r.lineItemId || fallbackLineItemId || ""),
        comment: String(r.comment || ""),
        advancedOpen: false,
        collapsed: false,
      };
    });
  const mapSingle = (raw: unknown): SinglePlan => {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
      date: String(r.date || seedDate),
      amount: String(r.amount || ""),
      lineItemId: String(r.lineItemId || fallbackLineItemId || ""),
      vendor: String(r.vendor || ""),
      comment: String(r.comment || ""),
      paid: r.paid === true,
      hmisComplete: r.hmisComplete === true,
      caseworthyComplete: r.caseworthyComplete === true,
      advancedOpen: false,
      collapsed: false,
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
        paid: r.paid === true,
        hmisComplete: r.hmisComplete === true,
        caseworthyComplete: r.caseworthyComplete === true,
        collapsed: false,
      };
    });
  return {
    rentPlans: mapMonthly(m.rentPlans, "rent"),
    utilityPlans: mapMonthly(m.utilPlans, "utility"),
    deposit: mapSingle(m.deposit),
    prorated: mapSingle(m.prorated),
    arrears: mapSingle(m.arrears),
    services: mapServices(m.services),
  };
}

// ─── Chevron icon ────────────────────────────────────────────────────────────
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ─── Rent row ────────────────────────────────────────────────────────────────
function RentRow({
  plan, onChange, onRemove, canRemove, grantId, fallbackLineItemIds, globalLineItemId,
}: {
  plan: MonthlyPlan;
  onChange: (patch: Partial<MonthlyPlan>) => void;
  onRemove: () => void;
  canRemove: boolean;
  grantId?: string | null;
  fallbackLineItemIds: string[];
  globalLineItemId: string;
}) {
  const state = completionState(
    [isISO(plan.firstDue) ? plan.firstDue : "", asPositiveInt(plan.months) > 0 ? "y" : "", asPositiveNumber(plan.monthlyAmount) > 0 ? "y" : ""],
    [plan.firstDue, plan.months, plan.monthlyAmount],
  );
  const effectiveLI = plan.lineItemId || globalLineItemId;
  const allFB = effectiveLI && !fallbackLineItemIds.includes(effectiveLI)
    ? [effectiveLI, ...fallbackLineItemIds]
    : fallbackLineItemIds;

  return (
    <div className={`rounded-lg border p-3 transition-colors ${stateClasses(state)}`}>
      {plan.collapsed && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
            onClick={() => onChange({ collapsed: false })}
          >
            {plan.kind === "utility" ? "Utility" : "Rent"}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {plan.monthlyAmount ? `${money(asPositiveNumber(plan.monthlyAmount))}/mo` : "Not filled"}{plan.firstDue ? ` · ${plan.firstDue}` : ""}
            </span>
          </button>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Expand"
            onClick={() => onChange({ collapsed: false })}
          >
            <ChevronIcon open={false} />
          </button>
        </div>
      )}
      <div hidden={plan.collapsed}>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Collapse"
          onClick={() => onChange({ collapsed: true })}
        >
          X
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-sm" style={{ minWidth: 140 }}>
          <div className="mb-1 text-xs text-slate-500">Start Date</div>
          <DateInput
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={plan.firstDue}
            onChange={(value) => onChange({ firstDue: value })}
          />
        </div>
        <label className="text-sm" style={{ minWidth: 80 }}>
          <div className="mb-1 text-xs text-slate-500">Months</div>
          <input
            type="number" min={1} max={120}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={plan.months}
            onChange={(e) => onChange({ months: e.currentTarget.value })}
          />
        </label>
        <label className="text-sm" style={{ minWidth: 110 }}>
          <div className="mb-1 text-xs text-slate-500">Amount / mo</div>
          <input
            type="number" min={0} step="0.01" placeholder="0.00"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={plan.monthlyAmount}
            onChange={(e) => onChange({ monthlyAmount: e.currentTarget.value })}
          />
        </label>
        <div className="flex items-end gap-2 pb-0.5">
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            onClick={() => onChange({ advancedOpen: !plan.advancedOpen })}
          >
            {plan.advancedOpen ? "Less ▲" : "Advanced ▼"}
          </button>
          {canRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-rose-400 hover:text-rose-600">
              Remove
            </button>
          )}
        </div>
      </div>
      {plan.advancedOpen && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 md:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 text-xs text-slate-500">Line Item override</div>
            <LineItemSelect
              grantId={grantId || null}
              value={plan.lineItemId || null}
              onChange={(next) => onChange({ lineItemId: String(next || "") })}
              fallbackLineItemIds={allFB}
              placeholderLabel={`Default (${globalLineItemId || "none"})`}
              allowEmpty
              inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs text-slate-500">Comment</div>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={plan.comment}
              onChange={(e) => onChange({ comment: e.currentTarget.value })}
            />
          </label>
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Single plan (Deposit / Prorated) ────────────────────────────────────────
function SinglePlanCard({
  label, plan, onChange, grantId, fallbackLineItemIds, globalLineItemId, globalVendor,
}: {
  label: string;
  plan: SinglePlan;
  open?: boolean;
  onToggle?: () => void;
  onChange: (patch: Partial<SinglePlan>) => void;
  grantId?: string | null;
  fallbackLineItemIds: string[];
  globalLineItemId: string;
  globalVendor: string;
}) {
  const state = completionState(
    [isISO(plan.date) ? plan.date : "", asPositiveNumber(plan.amount) > 0 ? "y" : ""],
    [plan.date, plan.amount],
  );
  const effectiveLI = plan.lineItemId || globalLineItemId;
  const allFB = effectiveLI && !fallbackLineItemIds.includes(effectiveLI)
    ? [effectiveLI, ...fallbackLineItemIds]
    : fallbackLineItemIds;

  return (
    <div className={`rounded-lg border transition-colors ${stateClasses(state)}`}>
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <button
          type="button"
          className="min-w-0 flex-1 text-left text-sm font-medium text-slate-800 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
          onClick={() => plan.collapsed && onChange({ collapsed: false })}
        >
          <span>{label}</span>
          {plan.collapsed && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              {plan.amount ? money(asPositiveNumber(plan.amount)) : "Not filled"}{plan.date ? ` · ${plan.date}` : ""}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {state !== "empty" && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              state === "complete" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>
              {state === "complete" ? "Ready" : "Incomplete"}
            </span>
          )}
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title={plan.collapsed ? "Expand" : "Collapse"}
            onClick={() => onChange({ collapsed: !plan.collapsed })}
          >
            {plan.collapsed ? <ChevronIcon open={false} /> : "X"}
          </button>
        </div>
      </div>
      {!plan.collapsed && <div className="border-t border-slate-100 px-3 pb-3 pt-3 dark:border-slate-800">
          <div className="flex flex-wrap items-end gap-3">
            <div className="text-sm" style={{ minWidth: 140 }}>
              <div className="mb-1 text-xs text-slate-500">Date</div>
              <DateInput
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={plan.date}
                onChange={(value) => onChange({ date: value })}
              />
            </div>
            <label className="text-sm" style={{ minWidth: 110 }}>
              <div className="mb-1 text-xs text-slate-500">Amount</div>
              <input
                type="number" min={0} step="0.01" placeholder="0.00"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={plan.amount}
                onChange={(e) => onChange({ amount: e.currentTarget.value })}
              />
            </label>
            <div className="pb-0.5">
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => onChange({ advancedOpen: !plan.advancedOpen })}
              >
                {plan.advancedOpen ? "Less ▲" : "Advanced ▼"}
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={plan.paid === true} onChange={(e) => onChange({ paid: e.currentTarget.checked })} />
              Mark paid
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={plan.hmisComplete === true} onChange={(e) => onChange({ hmisComplete: e.currentTarget.checked })} />
              HMIS complete
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={plan.caseworthyComplete === true} onChange={(e) => onChange({ caseworthyComplete: e.currentTarget.checked })} />
              CW complete
            </label>
          </div>
          {plan.advancedOpen && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 md:grid-cols-3">
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-500">Line Item override</div>
                <LineItemSelect
                  grantId={grantId || null}
                  value={plan.lineItemId || null}
                  onChange={(next) => onChange({ lineItemId: String(next || "") })}
                  fallbackLineItemIds={allFB}
                  placeholderLabel={`Default (${globalLineItemId || "none"})`}
                  allowEmpty
                  inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-500">Vendor override</div>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={plan.vendor}
                  placeholder={globalVendor || ""}
                  onChange={(e) => onChange({ vendor: e.currentTarget.value })}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-xs text-slate-500">Comment</div>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={plan.comment}
                  onChange={(e) => onChange({ comment: e.currentTarget.value })}
                />
              </label>
            </div>
          )}
      </div>}
    </div>
  );
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────
function CollapsibleSection({
  label, count, open, onToggle, children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={onToggle}
      >
        <ChevronIcon open={open} />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        {count > 0 && (
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-3 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Draft Preview Modal ──────────────────────────────────────────────────────
function DraftPreviewModal({
  open, onCancel, onConfirm, busy,
  previewRows, certPreviewRows, existingPayments, certCutoffDate,
  grantId, budgetProjectionDelta, budgetLineItemDeltas,
  replaceUnpaid, setReplaceUnpaid,
  updateGrantBudgets, setUpdateGrantBudgets,
  recalcGrantProjected, setRecalcGrantProjected,
  previewFlags, setPreviewFlags,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  previewRows: PreviewRow[];
  certPreviewRows: CertPreviewRow[];
  existingPayments: TPayment[];
  certCutoffDate?: string;
  grantId?: string | null;
  budgetProjectionDelta: number;
  budgetLineItemDeltas: Record<string, number>;
  replaceUnpaid: boolean;
  setReplaceUnpaid: (v: boolean) => void;
  updateGrantBudgets: boolean;
  setUpdateGrantBudgets: (v: boolean) => void;
  recalcGrantProjected: boolean;
  setRecalcGrantProjected: (v: boolean) => void;
  previewFlags: Record<string, PreviewFlags>;
  setPreviewFlags: React.Dispatch<React.SetStateAction<Record<string, PreviewFlags>>>;
}) {
  const newTotal = previewRows.reduce((s, r) => s + r.amount, 0);

  const paidRows = React.useMemo(
    () => existingPayments
      .filter((p) => p.paid && !p.void && p.amount > 0 && isISO(String(p.dueDate || "")))
      .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || ""))),
    [existingPayments],
  );
  const unpaidRows = React.useMemo(
    () => existingPayments
      .filter((p) => !p.paid && !p.void && p.amount > 0 && isISO(String(p.dueDate || "")))
      .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || ""))),
    [existingPayments],
  );

  const paidTotal = paidRows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const removedTotal = replaceUnpaid ? unpaidRows.reduce((s, p) => s + Number(p.amount || 0), 0) : 0;
  const grandAfterBuild = paidTotal + newTotal;

  const hasPaid = paidRows.length > 0;
  const hasUnpaid = unpaidRows.length > 0;
  const isRebuild = hasPaid || hasUnpaid;

  // Build month lookup sets for the cert column
  const certDueMonths = React.useMemo(() => new Set(certPreviewRows.map((r) => isoMonth(r.dueDate))), [certPreviewRows]);
  const certUpcomingMonths = React.useMemo(
    () => new Set(certPreviewRows.map((r) => isoMonth(addMonthsISO(r.dueDate, -1))).filter(Boolean)),
    [certPreviewRows],
  );
  const hasCert = certPreviewRows.length > 0;

  const colSpanBase = 5;
  const tableRows = React.useMemo<PreviewTableRow[]>(() => {
    const fromPayment = (p: TPayment, status: "paid" | "remove", idx: number): PreviewTableRow => ({
      key: `${status}:${p.id || idx}`,
      dueDate: String(p.dueDate || "").slice(0, 10),
      status,
      type: String(p.type || "-"),
      note: Array.isArray(p.note) ? p.note.filter(Boolean).join(", ") : String(p.note || "-"),
      comment: String(p.comment ?? ""),
      lineItemId: String(p.lineItemId || ""),
      amount: Number(p.amount || 0),
    });
    return [
      ...paidRows.map((p, idx) => fromPayment(p, "paid", idx)),
      ...(replaceUnpaid ? unpaidRows.map((p, idx) => fromPayment(p, "remove", idx)) : []),
      ...previewRows.map((row, idx): PreviewTableRow => ({
        key: paymentBuildKey(row),
        dueDate: row.dueDate,
        status: "new",
        type: row.type,
        note: row.note || "-",
        comment: row.comment || "",
        lineItemId: row.lineItemId,
        amount: row.amount,
        flags: previewFlags[paymentBuildKey(row)] ?? {
          paid: row.paid === true,
          hmisComplete: row.hmisComplete === true,
          caseworthyComplete: row.caseworthyComplete === true,
        },
      })),
    ].sort((a, b) => `${a.dueDate}|${a.status}|${a.type}`.localeCompare(`${b.dueDate}|${b.status}|${b.type}`));
  }, [paidRows, previewFlags, previewRows, replaceUnpaid, unpaidRows]);

  React.useEffect(() => {
    setPreviewFlags((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of previewRows) {
        const key = paymentBuildKey(row);
        if (next[key]) continue;
        next[key] = {
          paid: row.paid === true,
          hmisComplete: row.hmisComplete === true,
          caseworthyComplete: row.caseworthyComplete === true,
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [previewRows, setPreviewFlags]);

  const statusPill = (status: PreviewTableRow["status"]) => {
    const cls =
      status === "paid"
        ? "border-slate-200 bg-slate-50 text-slate-500"
        : status === "remove"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-sky-200 bg-sky-50 text-sky-700";
    const label = status === "paid" ? "Paid" : status === "remove" ? "Remove" : "New";
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>{label}</span>;
  };

  return (
    <Modal
      isOpen={open}
      title="Schedule Preview"
      onClose={onCancel}
      widthClass="max-w-4xl"
      disableOverlayClose
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={replaceUnpaid} onChange={(e) => setReplaceUnpaid(e.currentTarget.checked)} />
              Replace unpaid rows
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={updateGrantBudgets} onChange={(e) => setUpdateGrantBudgets(e.currentTarget.checked)} />
              Update grant budgets
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={recalcGrantProjected} onChange={(e) => setRecalcGrantProjected(e.currentTarget.checked)} />
              Recalculate grant projected
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>← Back</button>
            <button className="btn btn-sm" onClick={onConfirm} disabled={busy}>
              {busy ? "Building..." : "Confirm & Build"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {grantId && (
          <GrantBudgetStrip
            grantId={grantId}
            projectionDelta={budgetProjectionDelta}
            lineItemDeltas={budgetLineItemDeltas}
          />
        )}

        {previewRows.length === 0 && !isRebuild ? (
          <div className="text-xs text-slate-500 dark:text-slate-400">No rows to preview.</div>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 text-left">Due</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                  <th className="px-2 py-1.5 text-left">Type</th>
                  <th className="px-2 py-1.5 text-left">Comment</th>
                  <th className="px-2 py-1.5 text-left">Line Item</th>
                  <th className="px-2 py-1.5 text-right">Amount</th>
                  <th className="px-2 py-1.5 text-center">Paid</th>
                  <th className="px-2 py-1.5 text-center">HMIS</th>
                  <th className="px-2 py-1.5 text-center">CW</th>
                  {hasCert && <th className="px-2 py-1.5 text-center" title="Rent Cert Due">Cert</th>}
                </tr>
              </thead>
              <tbody>
                {/* Paid rows — always shown when present */}
                {tableRows.map((row) => {
                  const month = isoMonth(row.dueDate);
                  const certVal = hasCert && row.status === "new" ? certDueToggleValue(month, certDueMonths, certUpcomingMonths) : 0;
                  const removed = row.status === "remove";
                  return (
                    <tr key={row.key} className={[
                      "border-t border-slate-100 dark:border-slate-700 dark:text-slate-300",
                      row.status === "paid" ? "bg-slate-50 text-slate-500 dark:bg-slate-800/40 dark:text-slate-500" : "",
                      removed ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400" : "",
                    ].join(" ")}>
                      <td className="px-2 py-1"><span className={removed ? "line-through" : ""}>{row.dueDate}</span></td>
                      <td className="px-2 py-1">{statusPill(row.status)}</td>
                      <td className="px-2 py-1">{paymentTypeLabel({ type: row.type, note: row.note })}</td>
                      <td className="px-2 py-1">{row.comment || "-"}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{row.lineItemId}</td>
                      <td className="px-2 py-1 text-right"><span className={removed ? "line-through" : ""}>{money(row.amount)}</span></td>
                      {(["paid", "hmisComplete", "caseworthyComplete"] as const).map((field) => (
                        <td key={field} className="px-2 py-1 text-center">
                          {row.status === "new" ? (
                            <input
                              type="checkbox"
                              checked={row.flags?.[field] === true}
                              onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                setPreviewFlags((prev) => ({
                                  ...prev,
                                  [row.key]: { ...(prev[row.key] || row.flags || {}), [field]: checked },
                                }));
                              }}
                              aria-label={`${field} for ${row.dueDate}`}
                            />
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                      ))}
                      {hasCert && (
                        <td className="px-2 py-1 text-center">
                          {certVal > 0 && <TripleToggle value={certVal} readOnly />}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* Unpaid rows being replaced */}
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  <td className="px-2 py-1.5 text-right" colSpan={colSpanBase + 3}>New rows subtotal</td>
                  <td className="px-2 py-1.5 text-right">{money(newTotal)}</td>
                  {hasCert && <td className="px-2 py-1.5" />}
                </tr>
                {replaceUnpaid && removedTotal > 0 ? (
                  <tr className="border-t border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                    <td className="px-2 py-1 text-right text-amber-600 dark:text-amber-400" colSpan={colSpanBase + 3}>Removed subtotal</td>
                    <td className="px-2 py-1 text-right font-medium text-amber-600 dark:text-amber-400">{money(removedTotal)}</td>
                    {hasCert && <td className="px-2 py-1" />}
                  </tr>
                ) : null}
                {paidTotal > 0 ? (
                  <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                    <td className="px-2 py-1 text-right text-slate-500 dark:text-slate-500" colSpan={colSpanBase + 3}>Paid subtotal</td>
                    <td className="px-2 py-1 text-right font-medium text-slate-500 dark:text-slate-500">{money(paidTotal)}</td>
                    {hasCert && <td className="px-2 py-1" />}
                  </tr>
                ) : null}

                {/* Grand total after build */}
                {isRebuild && (
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100">
                    <td className="px-2 py-2 text-right" colSpan={colSpanBase + 3}>
                      Total after build
                      <span className="ml-2 font-normal text-slate-400 dark:text-slate-400">
                        ({paidRows.length} paid + {previewRows.length} new)
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">{money(grandAfterBuild)}</td>
                    {hasCert && <td className="px-2 py-2" />}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {hasCert && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <TripleToggle value={2} readOnly size="xs" />
            <span className="font-semibold">Rent Cert Reminders: {certPreviewRows.length}</span>
            <span>Shown in the Cert column.</span>
            {certCutoffDate ? <span>Stops at {certCutoffDate}.</span> : null}
          </div>
        )}

      </div>
    </Modal>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────
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

  // Global defaults
  const [globalLineItemId, setGlobalLineItemId] = React.useState("");
  const [globalVendor, setGlobalVendor] = React.useState("");

  // Section open state
  const [servicesOpen, setServicesOpen] = React.useState(false);
  const [utilitiesOpen, setUtilitiesOpen] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);

  const [rentPlans, setRentPlans] = React.useState<MonthlyPlan[]>([]);
  const [utilityPlans, setUtilityPlans] = React.useState<MonthlyPlan[]>([]);
  const [deposit, setDeposit] = React.useState<SinglePlan>(defaultSinglePlan());
  const [prorated, setProrated] = React.useState<SinglePlan>(defaultSinglePlan());
  const [arrears, setArrears] = React.useState<SinglePlan>(defaultSinglePlan());
  const [services, setServices] = React.useState<ServicePlan[]>([]);
  const [previewFlags, setPreviewFlags] = React.useState<Record<string, PreviewFlags>>({});
  const [viewMode, setViewMode] = React.useState<"builder" | "spreadsheet">("builder");
  const [ssRows, setSsRows] = React.useState<SSRow[]>(() => [newSSRow()]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const [certTask, setCertTask] = React.useState<CertTaskPlan>({
    enabled: true,
    cadenceMonths: "3",
    endDate: "",
    bucket: "compliance",
    title: "Rent Certification",
    advancedOpen: false,
  });

  // Invoice docs task — kept for payload compatibility, no UI
  const [invoiceDocsTask] = React.useState({ enabled: false, dueDate: todayISO(), bucket: "compliance" as const });
  const openEnrollments = React.useMemo(() => enrollments.filter(isOpenEnrollmentOption), [enrollments]);

  const seedFromEnrollment = React.useCallback((enr?: EnrollmentOption) => {
    const firstLineItem = enr?.lineItemIds?.[0] || "";
    const seedDate = todayISO();
    const saved = savedMetaSeed(enr?.scheduleMeta, firstLineItem, seedDate);
    setEnrollmentId(enr?.id || "");
    setGlobalLineItemId(firstLineItem);
    setGlobalVendor(saved?.rentPlans?.[0]?.vendor || "");
    setReplaceUnpaid(true);
    setUpdateGrantBudgets(true);
    setRecalcGrantProjected(true);
    setRentPlans(saved?.rentPlans?.length ? saved.rentPlans : [defaultMonthlyPlan("rent", firstLineItem, seedDate)]);
    setUtilityPlans(saved?.utilityPlans || []);
    setDeposit(saved?.deposit || defaultSinglePlan(firstLineItem));
    setProrated(saved?.prorated || defaultSinglePlan(firstLineItem));
    setArrears(saved?.arrears || defaultSinglePlan(firstLineItem));
    setServices(saved?.services || []);
    setPreviewFlags({});
    setServicesOpen(false);
    setUtilitiesOpen(false);
    setShowPreview(false);
    setSubmitAttempted(false);
    setCertTask({ enabled: true, cadenceMonths: "3", endDate: "", bucket: "compliance", title: "Rent Certification", advancedOpen: false });
    setError(null);
    const ssBase = newSSRow("monthly-rent", firstOfNextMonthISO(seedDate));
    ssBase.lineItemId = firstLineItem;
    setSsRows([ssBase]);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    seedFromEnrollment(openEnrollments[0]);
  }, [open, openEnrollments, seedFromEnrollment]);

  // Auto-add empty rent row when all are filled
  React.useEffect(() => {
    if (viewMode !== "builder") return;
    const isRentFilled = (p: MonthlyPlan) =>
      isISO(p.firstDue) && asPositiveInt(p.months) > 0 && asPositiveNumber(p.monthlyAmount) > 0;
    const filled = rentPlans.filter(isRentFilled);
    if (filled.length === rentPlans.length && rentPlans.length > 0) {
      setRentPlans((prev) => [...prev, defaultMonthlyPlan("rent", globalLineItemId)]);
    }
  }, [rentPlans, globalLineItemId, viewMode]);

  const selectedEnrollment = React.useMemo(
    () => openEnrollments.find((e) => e.id === enrollmentId) || null,
    [enrollmentId, openEnrollments],
  );
  const { data: selectedGrant } = useGrant(selectedEnrollment?.grantId, { enabled: !!selectedEnrollment?.grantId });
  const enrollmentEndDate = String(selectedEnrollment?.endDate || "").slice(0, 10);
  const grantEndDate = String((selectedGrant as Record<string, unknown> | null | undefined)?.endDate || "").slice(0, 10);

  const certStartDate = React.useMemo(
    () => rentPlans.find((p) => isISO(p.firstDue))?.firstDue || todayISO(),
    [rentPlans],
  );

  const existingPayments = React.useMemo(
    () => (selectedEnrollment?.payments || []) as TPayment[],
    [selectedEnrollment?.payments],
  );

  const scheduleEditWarning = React.useMemo(() => {
    const meta = selectedEnrollment?.scheduleMeta;
    if (!meta || typeof meta !== "object") {
      // No saved meta but has payments — was built before meta was tracked
      return existingPayments.some((p) => p.paid) ? "has-paid" as const : null;
    }
    const m = meta as Record<string, unknown>;
    if (m.version !== 1) return null;
    if (typeof m.editedAt === "string" && m.editedAt) return "edited" as const;
    if (existingPayments.some((p) => p.paid)) return "has-paid" as const;
    return null;
  }, [selectedEnrollment?.scheduleMeta, existingPayments]);

  const fallbackLineItemIds = selectedEnrollment?.lineItemIds || [];
  const invoiceDocs = React.useMemo(
    () => invoiceDocsFromGrant((selectedGrant || null) as Record<string, unknown> | null),
    [selectedGrant],
  );

  const resolvedDepositLI = cleanText(deposit.lineItemId) || globalLineItemId;
  const resolvedProratedLI = cleanText(prorated.lineItemId) || globalLineItemId;
  const resolvedArrearsLI = cleanText(arrears.lineItemId) || globalLineItemId;
  const showDefaultLineItemError = submitAttempted && !cleanText(globalLineItemId);
  const showDefaultVendorError = submitAttempted && !cleanText(globalVendor);
  const showDefaultsError = showDefaultLineItemError || showDefaultVendorError;

  const previewRows = React.useMemo<PreviewRow[]>(() => {
    const rows: PreviewRow[] = [];

    for (const plan of rentPlans) {
      const count = asPositiveInt(plan.months, 120);
      const amt = asPositiveNumber(plan.monthlyAmount);
      const li = cleanText(plan.lineItemId) || globalLineItemId;
      if (!count || !amt || !isISO(plan.firstDue) || !li) continue;
      for (let i = 0; i < count; i++) {
        const due = addMonthsISO(plan.firstDue, i);
        if (!due) continue;
        rows.push({ dueDate: due, type: "monthly", amount: amt, lineItemId: li, note: "rent", comment: plan.comment || "" });
      }
    }

    for (const plan of utilityPlans) {
      const count = asPositiveInt(plan.months, 120);
      const amt = asPositiveNumber(plan.monthlyAmount);
      const li = cleanText(plan.lineItemId) || globalLineItemId;
      if (!count || !amt || !isISO(plan.firstDue) || !li) continue;
      for (let i = 0; i < count; i++) {
        const due = addMonthsISO(plan.firstDue, i);
        if (!due) continue;
        rows.push({ dueDate: due, type: "monthly", amount: amt, lineItemId: li, note: "utility", comment: plan.comment || "" });
      }
    }

    const depositAmt = asPositiveNumber(deposit.amount);
    if (depositAmt && isISO(deposit.date) && resolvedDepositLI) {
      rows.push({ dueDate: deposit.date, type: "deposit", amount: depositAmt, lineItemId: resolvedDepositLI, note: "Security Deposit", comment: deposit.comment || "", ...flagsFromPlan(deposit) });
    }

    const proratedAmt = asPositiveNumber(prorated.amount);
    if (proratedAmt && isISO(prorated.date) && resolvedProratedLI) {
      rows.push({ dueDate: prorated.date, type: "prorated", amount: proratedAmt, lineItemId: resolvedProratedLI, note: "Prorated Rent", comment: prorated.comment || "", ...flagsFromPlan(prorated) });
    }

    const arrearsAmt = asPositiveNumber(arrears.amount);
    if (arrearsAmt && isISO(arrears.date) && resolvedArrearsLI) {
      rows.push({ dueDate: arrears.date, type: "arrears", amount: arrearsAmt, lineItemId: resolvedArrearsLI, note: "Arrears", comment: arrears.comment || "", ...flagsFromPlan(arrears) });
    }

    for (const svc of services) {
      const amt = asPositiveNumber(svc.amount);
      const li = cleanText(svc.lineItemId) || globalLineItemId;
      if (amt && isISO(svc.date) && li && cleanText(svc.note)) {
        rows.push({ dueDate: svc.date, type: "service", amount: amt, lineItemId: li, note: cleanText(svc.note), comment: svc.comment || "", ...flagsFromPlan(svc) });
      }
    }

    rows.sort((a, b) => `${a.dueDate}|${a.type}`.localeCompare(`${b.dueDate}|${b.type}`));
    return rows;
  }, [rentPlans, utilityPlans, deposit, prorated, arrears, services, globalLineItemId, resolvedDepositLI, resolvedProratedLI, resolvedArrearsLI]);

  const certCutoffDate = React.useMemo(
    () => {
      const retainedExisting = existingPayments.filter((payment) => !payment.void && (payment.paid || !replaceUnpaid));
      return minISODate(maxPaymentDueDate([...previewRows, ...retainedExisting]), enrollmentEndDate, grantEndDate, certTask.endDate);
    },
    [certTask.endDate, enrollmentEndDate, existingPayments, grantEndDate, previewRows, replaceUnpaid],
  );

  const certPreviewRows = React.useMemo<CertPreviewRow[]>(() => {
    if (!certTask.enabled) return [];
    const cadence = Math.max(1, Number(certTask.cadenceMonths) || 3);
    const rows: CertPreviewRow[] = [];
    for (const plan of rentPlans) {
      const months = asPositiveInt(plan.months);
      if (!months || !isISO(plan.firstDue)) continue;
      for (let offset = cadence; offset < months; offset += cadence) {
        const targetDate = addMonthsISO(plan.firstDue, offset);
        const dueDate = addMonthsISO(targetDate, -1);
        if (!isISO(dueDate)) continue;
        if (certTask.endDate && isISO(certTask.endDate) && dueDate > certTask.endDate) continue;
        if (certCutoffDate && (dueDate > certCutoffDate || targetDate > certCutoffDate)) continue;
        rows.push({ dueDate, targetDate, label: `${fmtMonth(targetDate)} cert — due ${fmtMonth(dueDate)}` });
      }
    }
    return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [certCutoffDate, certTask, rentPlans]);

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
            ? asPositiveInt(row.months, 120) || 1 : 1;
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
    return { total: Object.values(lineItemDeltas).reduce((s, a) => s + a, 0), lineItemDeltas };
  }, [previewRows, replaceUnpaid, selectedEnrollment?.payments, ssRows, viewMode]);

  const ssSubmit = () => {
    setSubmitAttempted(true);
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
          startDate: r.date, months, monthlyAmount: amt, lineItemId: r.lineItemId,
          ...(vendor ? { vendor } : {}),
          ...(note ? { comment: note } : {}),
        });
      } else {
        const defaultNote: Record<string, string> = { prorated: "Prorated Rent", deposit: "Security Deposit", arrears: "Arrears" };
        additions.push({
          amount: amt, dueDate: r.date, lineItemId: r.lineItemId,
          type: r.typeKey as "prorated" | "deposit" | "service" | "arrears",
          note: note || defaultNote[r.typeKey] || r.typeKey,
          ...(vendor ? { vendor } : {}),
        });
      }
    }
    onBuild({ enrollmentId, replaceUnpaid, monthlyPlans, additions, options: { updateGrantBudgets, recalcGrantProjected, activeOnly: true } });
  };

  const validate = (): string | null => {
    if (!enrollmentId) return "Select an enrollment.";
    if (previewRows.length === 0) return "Add at least one valid payment row to build the schedule.";
    for (const plan of [...rentPlans, ...utilityPlans]) {
      if (!plan.firstDue && !plan.months && !plan.monthlyAmount) continue;
      if (!isISO(plan.firstDue)) return "Monthly plan first due date must be YYYY-MM-DD.";
      if (plan.months !== "" && asPositiveInt(plan.months, 120) === 0) return "Monthly plan months must be between 1 and 120.";
      if (plan.monthlyAmount !== "" && asPositiveNumber(plan.monthlyAmount) === 0) return "Monthly plan amount must be greater than 0.";
    }
    if (singlePlanHasAny(deposit) && (!isISO(deposit.date) || asPositiveNumber(deposit.amount) <= 0)) {
      return "Deposit needs both a date and an amount.";
    }
    if (singlePlanHasAny(prorated) && (!isISO(prorated.date) || asPositiveNumber(prorated.amount) <= 0)) {
      return "Prorated rent needs both a date and an amount.";
    }
    if (singlePlanHasAny(arrears) && (!isISO(arrears.date) || asPositiveNumber(arrears.amount) <= 0)) {
      return "Arrears needs both a date and an amount.";
    }
    if (services.some((s) => s.date && !isISO(s.date))) return "Service dates must be YYYY-MM-DD.";
    return null;
  };

  const handlePreviewSchedule = () => {
    setSubmitAttempted(true);
    setError(null);
    const err = validate();
    if (err) return setError(err);
    setShowPreview(true);
  };

  const handleConfirmBuild = () => {
    const additions: NonNullable<PaymentScheduleBuildInput["additions"]> = [];

    const depositAmt = asPositiveNumber(deposit.amount);
    const depositLi = resolvedDepositLI;
    if (depositAmt && depositLi && isISO(deposit.date)) {
      const flags = previewFlags[paymentBuildKey({ type: "deposit", dueDate: deposit.date, lineItemId: depositLi, amount: depositAmt, note: "Security Deposit" })] ?? flagsFromPlan(deposit);
      additions.push({
        amount: depositAmt, dueDate: deposit.date, lineItemId: depositLi, type: "deposit",
        note: ["Security Deposit"],
        ...(cleanText(deposit.vendor || globalVendor) ? { vendor: cleanText(deposit.vendor || globalVendor) } : {}),
        ...(cleanText(deposit.comment) ? { comment: cleanText(deposit.comment) } : {}),
        ...paymentPatchFromFlags(flags),
      });
    }

    const proratedAmt = asPositiveNumber(prorated.amount);
    const proratedLi = resolvedProratedLI;
    if (proratedAmt && proratedLi && isISO(prorated.date)) {
      const flags = previewFlags[paymentBuildKey({ type: "prorated", dueDate: prorated.date, lineItemId: proratedLi, amount: proratedAmt, note: "Prorated Rent" })] ?? flagsFromPlan(prorated);
      additions.push({
        amount: proratedAmt, dueDate: prorated.date, lineItemId: proratedLi, type: "prorated",
        note: ["Prorated Rent"],
        ...(cleanText(prorated.vendor || globalVendor) ? { vendor: cleanText(prorated.vendor || globalVendor) } : {}),
        ...(cleanText(prorated.comment) ? { comment: cleanText(prorated.comment) } : {}),
        ...paymentPatchFromFlags(flags),
      });
    }

    const arrearsAmt = asPositiveNumber(arrears.amount);
    const arrearsLi = resolvedArrearsLI;
    if (arrearsAmt && arrearsLi && isISO(arrears.date)) {
      const flags = previewFlags[paymentBuildKey({ type: "arrears", dueDate: arrears.date, lineItemId: arrearsLi, amount: arrearsAmt, note: "Arrears" })] ?? flagsFromPlan(arrears);
      additions.push({
        amount: arrearsAmt, dueDate: arrears.date, lineItemId: arrearsLi, type: "arrears",
        note: ["Arrears"],
        ...(cleanText(arrears.vendor || globalVendor) ? { vendor: cleanText(arrears.vendor || globalVendor) } : {}),
        ...(cleanText(arrears.comment) ? { comment: cleanText(arrears.comment) } : {}),
        ...paymentPatchFromFlags(flags),
      });
    }

    for (const svc of services) {
      const amt = asPositiveNumber(svc.amount);
      const li = cleanText(svc.lineItemId) || globalLineItemId;
      const note = cleanText(svc.note);
      if (!amt || !li || !note || !isISO(svc.date)) continue;
      const flags = previewFlags[paymentBuildKey({ type: "service", dueDate: svc.date, lineItemId: li, amount: amt, note })] ?? flagsFromPlan(svc);
      additions.push({
        amount: amt, dueDate: svc.date, lineItemId: li, type: "service", note,
        ...(cleanText(svc.vendor || globalVendor) ? { vendor: cleanText(svc.vendor || globalVendor) } : {}),
        ...(cleanText(svc.comment) ? { comment: cleanText(svc.comment) } : {}),
        ...paymentPatchFromFlags(flags),
      });
    }

    const taskDefs: unknown[] = [];
    if (certTask.enabled) {
      const cadence = Math.max(1, Number(certTask.cadenceMonths) || 3);
      const filledRentPlans = rentPlans.filter(
        (p) => isISO(p.firstDue) && asPositiveInt(p.months) > 0 && asPositiveNumber(p.monthlyAmount) > 0,
      );
      for (const plan of filledRentPlans) {
        const planMonths = asPositiveInt(plan.months);
        for (let offset = cadence; offset < planMonths; offset += cadence) {
          const targetDate = addMonthsISO(plan.firstDue, offset);
          const dueDate = addMonthsISO(targetDate, -1);
          if (!isISO(dueDate)) continue;
          if (certTask.endDate && isISO(certTask.endDate) && dueDate > certTask.endDate) continue;
          if (certCutoffDate && (dueDate > certCutoffDate || targetDate > certCutoffDate)) continue;
          const label = `${fmtMonth(targetDate)} rent cert due ${fmtMonth(dueDate)}`;
          const idBase = `payment_rent_cert_${cleanText(plan.lineItemId) || globalLineItemId}_${targetDate}`
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "_");
          const desc = certTask.title || "Rent Certification";
          taskDefs.push(
            {
              id: `${idBase}_cm`, name: label, kind: "one-off", dueDate, bucket: certTask.bucket, notify: true,
              assignedToGroup: "casemanager", description: desc,
              notes: `Collect updated rent certification documents from the customer and landlord by ${fmtMonth(dueDate)} for ${fmtMonth(targetDate)} assistance.`,
            },
            {
              id: `${idBase}_compliance`, name: label, kind: "one-off", dueDate, bucket: certTask.bucket, notify: true,
              assignedToGroup: "compliance", description: desc,
              notes: `Prepare and send the updated rent certification / notice by ${fmtMonth(dueDate)} for ${fmtMonth(targetDate)} assistance.`,
            },
          );
        }
      }
    }

    onBuild({
      enrollmentId,
      replaceUnpaid,
      monthlyPlans: [
        ...rentPlans
          .filter((p) => isISO(p.firstDue) && asPositiveInt(p.months) > 0 && asPositiveNumber(p.monthlyAmount) > 0)
          .map((plan) => ({
            kind: "rent" as const,
            startDate: plan.firstDue,
            months: asPositiveInt(plan.months, 120),
            monthlyAmount: asPositiveNumber(plan.monthlyAmount),
            lineItemId: cleanText(plan.lineItemId) || globalLineItemId,
            ...(cleanText(globalVendor) ? { vendor: cleanText(globalVendor) } : {}),
            ...(cleanText(plan.comment) ? { comment: cleanText(plan.comment) } : {}),
          })),
        ...utilityPlans
          .filter((p) => isISO(p.firstDue) && asPositiveInt(p.months) > 0 && asPositiveNumber(p.monthlyAmount) > 0)
          .map((plan) => ({
            kind: "utility" as const,
            startDate: plan.firstDue,
            months: asPositiveInt(plan.months, 120),
            monthlyAmount: asPositiveNumber(plan.monthlyAmount),
            lineItemId: cleanText(plan.lineItemId) || globalLineItemId,
            ...(cleanText(globalVendor) ? { vendor: cleanText(globalVendor) } : {}),
            ...(cleanText(plan.comment) ? { comment: cleanText(plan.comment) } : {}),
          })),
      ],
      additions,
      options: { updateGrantBudgets, recalcGrantProjected, activeOnly: true },
      previewFlags,
      invoiceDocsTask: { enabled: false, dueDate: invoiceDocsTask.dueDate, bucket: invoiceDocsTask.bucket, docs: invoiceDocs },
      taskDefs,
      replaceTaskDefPrefixes: ["payment_rent_cert_", "payment_invoice_docs_", "pay_cert_"],
    });
  };

  const serviceCount = services.filter((s) => s.note || s.amount).length;
  const utilityCount = utilityPlans.filter((p) => p.firstDue || p.monthlyAmount).length;

  return (
    <>
      <Modal
        tourId="payment-schedule-builder-dialog"
        isOpen={open}
        title={customerName ? `Build Payment Schedule — ${customerName}` : "Build Payment Schedule"}
        onClose={onCancel}
        widthClass="max-w-5xl"
        footer={
          <div className="flex w-full items-center gap-2">
            {busy ? (
              <div className="mr-auto text-xs font-medium text-slate-500">Saving rows, tasks, and budget projections...</div>
            ) : (
              <div className="mr-auto" />
            )}
            <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
            {viewMode === "spreadsheet" ? (
              <button className="btn btn-sm" onClick={ssSubmit} disabled={busy}>{busy ? "Building..." : "Build Schedule"}</button>
            ) : (
              <button className="btn btn-sm" onClick={handlePreviewSchedule} disabled={busy}>Preview Schedule →</button>
            )}
          </div>
        }
      >
        <div className="relative space-y-4" aria-busy={busy}>
          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-white/80 backdrop-blur-[1px] dark:bg-slate-900/80">
              <div className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Building payment schedule...</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Keeping this dialog open while projections, tasks, and budget totals refresh.
                </div>
              </div>
            </div>
          )}
          {error && <div className="whitespace-pre-line rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</div>}

          {scheduleEditWarning && (
            <div className={`rounded border px-3 py-2 text-xs ${
              scheduleEditWarning === "edited"
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300"
            }`}>
              {scheduleEditWarning === "edited" ? (
                <><span className="font-semibold">Schedule edited after build</span> — individual payment adjustments have been made. Review the preview carefully before rebuilding.</>
              ) : (
                <><span className="font-semibold">Active schedule</span> — this enrollment has paid rows. The preview will show what stays, what is removed, and what is added.</>
              )}
            </div>
          )}

          {/* ── Header row ── */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 text-sm" style={{ minWidth: 220 }}>
              <div className="mb-1 text-xs text-slate-500">Enrollment</div>
              <select
                className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={enrollmentId}
                onChange={(e) => seedFromEnrollment(openEnrollments.find((x) => x.id === e.currentTarget.value))}
              >
                <option value="">-- Select enrollment --</option>
                {openEnrollments.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}{e.statusLabel ? ` (${e.statusLabel})` : ""}</option>
                ))}
              </select>
            </label>
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

          {/* ── Budget strip ── */}
          <GrantBudgetStrip
            grantId={selectedEnrollment?.grantId}
            projectionDelta={budgetPreview.total}
            lineItemDeltas={budgetPreview.lineItemDeltas}
          />

          {viewMode === "spreadsheet" ? (
            <>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span>Overall Total: <b>{money(ssTotals.grand)}</b></span>
                <span className="ml-4">Length of Assistance: <b>{ssTotals.monthlyCount} mo</b></span>
              </div>
              <SpreadsheetBuilderView rows={ssRows} setRows={setSsRows} grantId={selectedEnrollment?.grantId} />
            </>
          ) : (
            <>
              {/* ── Settings card ── */}
              <div className={`rounded-lg border bg-white p-3 dark:bg-slate-900 ${
                showDefaultsError
                  ? "border-rose-400 bg-rose-50/40 dark:border-rose-500/80 dark:bg-rose-950/20"
                  : "border-slate-200 dark:border-slate-700"
              }`}>
                <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${showDefaultsError ? "text-rose-500" : "text-slate-400"}`}>Defaults</div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1" style={{ minWidth: 200 }}>
                    <div className={`mb-1 text-xs ${showDefaultLineItemError ? "text-rose-600 dark:text-rose-300" : "text-slate-500"}`}>Default Line Item</div>
                    <LineItemSelect
                      grantId={selectedEnrollment?.grantId || null}
                      value={globalLineItemId || null}
                      onChange={(next) => setGlobalLineItemId(String(next || ""))}
                      fallbackLineItemIds={fallbackLineItemIds}
                      allowEmpty
                      placeholderLabel="None"
                      inputClassName={`w-full rounded border px-2 py-1.5 dark:bg-slate-900 dark:text-slate-100 ${
                        showDefaultLineItemError
                          ? "border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/30"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                    />
                    {showDefaultLineItemError && <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">Select a line item.</div>}
                  </div>
                  <div className="flex-1" style={{ minWidth: 160 }}>
                    <div className={`mb-1 text-xs ${showDefaultVendorError ? "text-rose-600 dark:text-rose-300" : "text-slate-500"}`}>Default Vendor</div>
                    <input
                      className={`w-full rounded border px-2 py-1.5 dark:bg-slate-900 dark:text-slate-100 ${
                        showDefaultVendorError
                          ? "border-rose-500 bg-rose-50 text-rose-900 placeholder:text-rose-300 dark:border-rose-500 dark:bg-rose-950/30"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                      value={globalVendor}
                      onChange={(e) => setGlobalVendor(e.currentTarget.value)}
                      placeholder="e.g. Parkview Apartments"
                    />
                    {showDefaultVendorError && <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">Enter a vendor.</div>}
                  </div>
                </div>
              </div>

              {/* ── Deposit ── */}
              <SinglePlanCard
                label="Security Deposit"
                plan={deposit}
                onChange={(patch) => setDeposit((prev) => ({ ...prev, ...patch }))}
                grantId={selectedEnrollment?.grantId}
                fallbackLineItemIds={fallbackLineItemIds}
                globalLineItemId={globalLineItemId}
                globalVendor={globalVendor}
              />

              {/* ── Prorated ── */}
              <SinglePlanCard
                label="Prorated Rent"
                plan={prorated}
                onChange={(patch) => setProrated((prev) => ({ ...prev, ...patch }))}
                grantId={selectedEnrollment?.grantId}
                fallbackLineItemIds={fallbackLineItemIds}
                globalLineItemId={globalLineItemId}
                globalVendor={globalVendor}
              />

              <SinglePlanCard
                label="Arrears"
                plan={arrears}
                onChange={(patch) => setArrears((prev) => ({ ...prev, ...patch }))}
                grantId={selectedEnrollment?.grantId}
                fallbackLineItemIds={fallbackLineItemIds}
                globalLineItemId={globalLineItemId}
                globalVendor={globalVendor}
              />

              {/* ── Recurring Rent ── */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recurring Rent</div>
                {rentPlans.map((plan, idx) => (
                  <RentRow
                    key={plan.id}
                    plan={plan}
                    onChange={(patch) => setRentPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, ...patch } : p))}
                    onRemove={() => setRentPlans((prev) => prev.filter((p) => p.id !== plan.id))}
                    canRemove={rentPlans.length > 1 || idx < rentPlans.length - 1}
                    grantId={selectedEnrollment?.grantId}
                    fallbackLineItemIds={fallbackLineItemIds}
                    globalLineItemId={globalLineItemId}
                  />
                ))}
              </div>

              {/* ── Rent Cert Reminders ── */}
              <div className="mt-1 border-t border-dashed border-slate-200 pt-2 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <input
                    id="certTask-enabled"
                    type="checkbox"
                    checked={certTask.enabled}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setCertTask((prev) => ({ ...prev, enabled: checked }));
                    }}
                    className="rounded"
                  />
                  <label htmlFor="certTask-enabled" className="flex-1 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
                    Rent Cert Reminders
                    {certTask.enabled && certPreviewRows.length > 0 && (
                      <span className="ml-1 text-slate-400">
                        ({certPreviewRows.length} task{certPreviewRows.length !== 1 ? "s" : ""})
                      </span>
                    )}
                  </label>
                  {certTask.enabled && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      onClick={() => setCertTask((prev) => ({ ...prev, advancedOpen: !prev.advancedOpen }))}
                    >
                      {certTask.advancedOpen ? "Less ▲" : "Advanced ▼"}
                    </button>
                  )}
                </div>
                {certTask.enabled && (
                  <div className="mt-1 text-[10px] text-slate-400">
                    Starts {certStartDate} · every {certTask.cadenceMonths} mo
                  </div>
                )}
                {certTask.enabled && certTask.advancedOpen && (
                  <div className="mt-2 grid grid-cols-1 gap-2 border-t border-slate-100 pt-2 dark:border-slate-800 md:grid-cols-2 lg:grid-cols-4">
                    <div className="text-sm">
                      <div className="mb-1 text-xs text-slate-500">Cadence</div>
                      <select
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={certTask.cadenceMonths}
                        onChange={(e) => {
                          const value = e.currentTarget.value as CertTaskPlan["cadenceMonths"];
                          setCertTask((prev) => ({ ...prev, cadenceMonths: value }));
                        }}
                      >
                        <option value="3">Every 3 months</option>
                        <option value="4">Every 4 months</option>
                        <option value="6">Every 6 months</option>
                        <option value="12">Annually</option>
                      </select>
                    </div>
                    <div className="text-sm">
                      <div className="mb-1 text-xs text-slate-500">End Date (optional)</div>
                      <DateInput
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={certTask.endDate}
                        onChange={(value) => {
                          setCertTask((prev) => ({ ...prev, endDate: value }));
                        }}
                      />
                    </div>
                    <label className="text-sm">
                      <div className="mb-1 text-xs text-slate-500">Bucket</div>
                      <select
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={certTask.bucket}
                        onChange={(e) => {
                          const value = e.currentTarget.value as CertTaskPlan["bucket"];
                          setCertTask((prev) => ({ ...prev, bucket: value }));
                        }}
                      >
                        <option value="compliance">Compliance</option>
                        <option value="task">Task</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      <div className="mb-1 text-xs text-slate-500">Task Title</div>
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={certTask.title}
                        placeholder="Rent Certification"
                        onChange={(e) => {
                          const value = e.currentTarget.value;
                          setCertTask((prev) => ({ ...prev, title: value }));
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* ── Utility Assistance ── */}
              <CollapsibleSection
                label="Utility Assistance"
                count={utilityCount}
                open={utilitiesOpen}
                onToggle={() => setUtilitiesOpen((v) => !v)}
              >
                <div className="space-y-2">
                  {utilityPlans.length === 0 && (
                    <div className="text-xs text-slate-400">No utility rows.</div>
                  )}
                  {utilityPlans.map((plan) => (
                    <RentRow
                      key={plan.id}
                      plan={plan}
                      onChange={(patch) => setUtilityPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, ...patch } : p))}
                      onRemove={() => setUtilityPlans((prev) => prev.filter((p) => p.id !== plan.id))}
                      canRemove
                      grantId={selectedEnrollment?.grantId}
                      fallbackLineItemIds={fallbackLineItemIds}
                      globalLineItemId={globalLineItemId}
                    />
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setUtilityPlans((prev) => [...prev, defaultMonthlyPlan("utility", globalLineItemId)])}
                  >
                    + Add utility row
                  </button>
                </div>
              </CollapsibleSection>

              {/* ── Support Services ── */}
              <CollapsibleSection
                label="Support Services"
                count={serviceCount}
                open={servicesOpen}
                onToggle={() => setServicesOpen((v) => !v)}
              >
                <div className="space-y-2">
                  {services.length === 0 && (
                    <div className="text-xs text-slate-400">No service rows.</div>
                  )}
                  {services.map((svc) => {
                    const svcState = completionState(
                      [svc.note, svc.amount, isISO(svc.date) ? svc.date : ""],
                      [svc.note, svc.amount, svc.date],
                    );
                    return (
                      <div key={svc.id} className={`rounded-lg border p-3 transition-colors ${stateClasses(svcState)}`}>
                        {svc.collapsed ? (
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
                              onClick={() => setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, collapsed: false } : s))}
                            >
                              Support Service
                              <span className="ml-2 text-xs font-normal text-slate-400">
                                {svc.note || "Not filled"}{svc.amount ? ` · ${money(asPositiveNumber(svc.amount))}` : ""}
                              </span>
                            </button>
                            <button
                              type="button"
                              title="Expand"
                              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              onClick={() => setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, collapsed: false } : s))}
                            >
                              <ChevronIcon open={false} />
                            </button>
                          </div>
                        ) : (
                        <>
                        <div className="mb-2 flex justify-end">
                          <button
                            type="button"
                            title="Collapse"
                            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            onClick={() => setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, collapsed: true } : s))}
                          >
                            X
                          </button>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex-1 text-sm" style={{ minWidth: 140 }}>
                            <div className="mb-1 text-xs text-slate-500">Service Note</div>
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              value={svc.note}
                              placeholder="Transportation, childcare…"
                              onChange={(e) => { const v = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, note: v } : s)); }}
                            />
                          </label>
                          <label className="text-sm" style={{ minWidth: 100 }}>
                            <div className="mb-1 text-xs text-slate-500">Amount</div>
                            <input
                              type="number" min={0} step="0.01" placeholder="0.00"
                              className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              value={svc.amount}
                              onChange={(e) => { const v = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, amount: v } : s)); }}
                            />
                          </label>
                          <div className="text-sm" style={{ minWidth: 130 }}>
                            <div className="mb-1 text-xs text-slate-500">Date</div>
                            <DateInput
                              className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              value={svc.date}
                              onChange={(value) => { setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, date: value } : s)); }}
                            />
                          </div>
                          <div className="pb-0.5">
                            <button
                              type="button"
                              className="text-xs text-rose-400 hover:text-rose-600"
                              onClick={() => setServices((prev) => prev.filter((s) => s.id !== svc.id))}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                          <label className="inline-flex items-center gap-1.5">
                            <input type="checkbox" checked={svc.paid === true} onChange={(e) => { const checked = e.currentTarget.checked; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, paid: checked } : s)); }} />
                            Mark paid
                          </label>
                          <label className="inline-flex items-center gap-1.5">
                            <input type="checkbox" checked={svc.hmisComplete === true} onChange={(e) => { const checked = e.currentTarget.checked; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, hmisComplete: checked } : s)); }} />
                            HMIS complete
                          </label>
                          <label className="inline-flex items-center gap-1.5">
                            <input type="checkbox" checked={svc.caseworthyComplete === true} onChange={(e) => { const checked = e.currentTarget.checked; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, caseworthyComplete: checked } : s)); }} />
                            CW complete
                          </label>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <label className="text-sm">
                            <div className="mb-1 text-xs text-slate-500">Line Item</div>
                            <LineItemSelect
                              grantId={selectedEnrollment?.grantId || null}
                              value={svc.lineItemId || globalLineItemId || null}
                              onChange={(next) => { const v = String(next || ""); setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, lineItemId: v } : s)); }}
                              fallbackLineItemIds={fallbackLineItemIds}
                              inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </label>
                          <label className="text-sm">
                            <div className="mb-1 text-xs text-slate-500">Vendor</div>
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              value={svc.vendor}
                              placeholder={globalVendor}
                              onChange={(e) => { const v = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, vendor: v } : s)); }}
                            />
                          </label>
                          <label className="text-sm">
                            <div className="mb-1 text-xs text-slate-500">Comment</div>
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              value={svc.comment}
                              onChange={(e) => { const v = e.currentTarget.value; setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, comment: v } : s)); }}
                            />
                          </label>
                        </div>
                        </>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setServices((prev) => [...prev, defaultServicePlan(globalLineItemId)])}
                  >
                    + Add service
                  </button>
                </div>
              </CollapsibleSection>
            </>
          )}
        </div>
      </Modal>

      <DraftPreviewModal
        open={showPreview}
        onCancel={() => setShowPreview(false)}
        onConfirm={handleConfirmBuild}
        busy={busy}
        previewRows={previewRows}
        certPreviewRows={certPreviewRows}
        existingPayments={existingPayments}
        certCutoffDate={certCutoffDate}
        grantId={selectedEnrollment?.grantId}
        budgetProjectionDelta={budgetPreview.total}
        budgetLineItemDeltas={budgetPreview.lineItemDeltas}
        replaceUnpaid={replaceUnpaid}
        setReplaceUnpaid={setReplaceUnpaid}
        updateGrantBudgets={updateGrantBudgets}
        setUpdateGrantBudgets={setUpdateGrantBudgets}
        recalcGrantProjected={recalcGrantProjected}
        setRecalcGrantProjected={setRecalcGrantProjected}
        previewFlags={previewFlags}
        setPreviewFlags={setPreviewFlags}
      />
    </>
  );
}
