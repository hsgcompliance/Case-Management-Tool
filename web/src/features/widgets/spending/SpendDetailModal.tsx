"use client";

// features/dashboard/tools/spend/SpendDetailModal.tsx
// Modal detail cards for spend rows. Three card types:
//   - EnrollmentSpendCard  (grant-ledger, queue-projection)
//   - CardSpendCard        (card-ledger, queue-credit-card)
//   - InvoiceSpendCard     (queue-invoice)

import React from "react";
import Link from "next/link";
import { Modal } from "@entities/ui/Modal";
import { DetailSection, DetailRow } from "@entities/detail-card/core";
import GrantSelect from "@entities/selectors/GrantSelect";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import CreditCardSelect from "@entities/selectors/CreditCardSelect";
import CardInvoiceEntryDialog from "@entities/dialogs/payments/CardInvoiceEntryDialog";
import type { CardInvoiceEntryMode } from "@entities/dialogs/payments/CardInvoiceEntryDialog";
import { GrantBudgetStrip } from "@entities/grants/GrantBudgetStrip";
import CustomerWorkspaceModal from "@features/customers/CustomerWorkspaceModal";
import { computeRentCertDues, normalizePayments, todayISO } from "@features/customers/components/paymentScheduleUtils";
import { useGrant } from "@hooks/useGrants";
import {
  useEnrollmentPayments,
  usePaymentsUpdateCompliance,
  usePaymentsSpend,
  usePaymentsProjectionsAdjust,
} from "@hooks/usePayments";
import { toApiError } from "@client/api";
import {
  usePaymentQueueItems,
  usePatchPaymentQueueItem,
  usePostPaymentQueueToLedger,
  useReopenPaymentQueueItem,
  useVoidPaymentQueueItem,
} from "@hooks/usePaymentQueue";
import { useClassifyLedgerEntries, useCreateLedgerEntry, useLedgerEntry } from "@hooks/useLedger";
import { useJotformSubmission } from "@hooks/useJotform";
import { useTaskOtherCreate, useTaskOtherStatus } from "@hooks/useTasks";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { toast } from "@lib/toast";
import type { TPayment } from "@types";
import {
  buildNormalizedAnswerFields,
  stageLabelFromQueueSource,
} from "@widgets/jotform/jotformSubmissionView";

// ---------------------------------------------------------------------------
// Shared types (mirror SpendingTool internals without importing them)
// ---------------------------------------------------------------------------

export type SpendRowKind =
  | "grant-ledger"
  | "card-ledger"
  | "queue-projection"
  | "queue-credit-card"
  | "queue-invoice";

export type SpendRow = {
  id: string;
  kind: SpendRowKind;
  sourceLabel: string;
  title: string;
  subtitle: string;
  date: string;
  month: string;
  amountCents: number;
  completed: boolean;
  workflowState: "open" | "closed";
  workflowReason: string;
  grantId: string;
  lineItemId: string;
  customerId: string;
  creditCardId: string;
  creditCardName: string;
  cardBucket: string;
  taskToken: string;
  linkedLedgerId?: string;
  ledgerEntry?: Record<string, unknown>;
  paymentQueueItem?: Record<string, unknown> & {
    id: string;
    submissionId?: string;
    paymentId?: string | null;
    enrollmentId?: string | null;
    customerId?: string | null;
    grantId?: string | null;
    lineItemId?: string | null;
    creditCardId?: string | null;
    source?: string;
    queueStatus?: string;
    merchant?: string;
    purpose?: string;
    descriptor?: string;
    card?: string;
    cardBucket?: string;
    note?: string;
    notes?: string;
    formTitle?: string;
    formAlias?: string;
    rawMeta?: Record<string, unknown>;
    invoiceStatus?: string;
    reopenedAt?: string | null;
  };
};

export type CardBudget = {
  id: string;
  name: string;
  last4: string;
  limitCents: number;
  spentCents: number;
  pendingCents: number;
  remainingCents: number;
};

type ModalProps = {
  row: SpendRow | null;
  isOpen: boolean;
  onClose: () => void;
  grantNameById: Map<string, string>;
  lineItemLookup: Map<string, { grantName: string; lineItemLabel: string }>;
  customerNameById: Map<string, string>;
  cardBudget?: CardBudget | null;
  workflowTask?: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCents(cents: number) {
  return fmtCurrencyUSD(cents / 100);
}

type ComplianceRecord = {
  hmisComplete?: boolean | null;
  caseworthyComplete?: boolean | null;
  status?: string | null;
  note?: string | null;
  items?: Array<Record<string, unknown>> | null;
};

type PaymentRecord = TPayment & {
  id?: string | null;
  compliance?: ComplianceRecord | null;
  paid?: boolean | null;
};

const PAYMENT_TYPES: TPayment["type"][] = ["monthly", "deposit", "prorated", "service"];

function paymentTypeLabel(type: unknown): string {
  const s = String(type || "").trim().toLowerCase();
  if (s === "monthly") return "Monthly";
  if (s === "deposit") return "Deposit";
  if (s === "prorated") return "Prorated";
  if (s === "service") return "Service";
  return s || "-";
}

function normalizePaymentNote(note: unknown): string {
  if (Array.isArray(note)) return note.map((item) => String(item ?? "").trim()).filter(Boolean).join("\n");
  return String(note ?? "").trim();
}

function uniqueLines(...values: unknown[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = normalizePaymentNote(value);
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out.join("\n");
}

function paymentDueDate(payment: PaymentRecord | null | undefined, fallback = ""): string {
  const raw = String(payment?.dueDate || (payment as Record<string, unknown> | null | undefined)?.date || fallback || "");
  return raw ? raw.slice(0, 10) : "";
}

function paymentVendor(payment: PaymentRecord | null, row: SpendRow): string {
  return String(
    payment?.vendor ||
      row.paymentQueueItem?.vendor ||
      row.paymentQueueItem?.merchant ||
      row.ledgerEntry?.vendor ||
      "",
  ).trim();
}

function paymentNoteComment(payment: PaymentRecord | null, row: SpendRow): string {
  return uniqueLines(
    payment?.note,
    payment?.comment,
    row.paymentQueueItem?.note,
    row.paymentQueueItem?.notes,
    row.paymentQueueItem?.description,
    row.ledgerEntry?.note,
    row.ledgerEntry?.comment,
    row.ledgerEntry?.description,
  );
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readSubmissionAnswers(
  submission: { answers?: Record<string, unknown> | null } | null | undefined,
  rawMeta?: Record<string, unknown>,
): Record<string, unknown> {
  return submission?.answers || rawMeta || {};
}

function readCompliance(value: unknown): ComplianceRecord {
  return asObject(value) as ComplianceRecord;
}

function displayText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(displayText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.answer != null) return displayText(obj.answer);
    if (obj.prettyFormat != null) return displayText(obj.prettyFormat);
    if (obj.value != null) return displayText(obj.value);
    if (typeof obj.datetime === "string") return displayText(obj.datetime);
    const parts = ["first", "middle", "last", "addr_line1", "addr_line2", "city", "state", "postal"]
      .map((key) => displayText(obj[key]))
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
    return Object.values(obj).map(displayText).filter(Boolean).join(", ");
  }
  return "";
}

function queueString(item: Record<string, unknown> | null | undefined, key: string): string {
  return displayText(item?.[key]);
}

function queueFieldAnswer(item: Record<string, unknown> | null | undefined, fieldKey: string): string {
  const group = asObject(item?.extractionGroup);
  const fieldIds = asObject(group.fieldIds);
  const fieldId = displayText(fieldIds[fieldKey]);
  if (!fieldId) return "";
  return displayText(asObject(item?.rawAnswers)[fieldId]);
}

function queueFieldOrder(item: Record<string, unknown> | null | undefined, fieldKey?: string): number {
  const group = asObject(item?.extractionGroup);
  const fieldOrders = asObject(group.fieldOrders);
  if (fieldKey) {
    const specificOrder = Number(fieldOrders[fieldKey]);
    if (Number.isFinite(specificOrder) && specificOrder > 0) return specificOrder;
    const fieldId = displayText(asObject(group.fieldIds)[fieldKey]);
    const rawOrder = Number(asObject(asObject(item?.rawAnswers)[fieldId]).order);
    if (Number.isFinite(rawOrder) && rawOrder > 0) return rawOrder;
  }
  const allOrders = Object.values(fieldOrders)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (allOrders.length) return Math.min(...allOrders);
  const fieldIds = asObject(group.fieldIds);
  const rawOrders = Object.values(fieldIds)
    .map((fieldId) => Number(asObject(asObject(item?.rawAnswers)[displayText(fieldId)]).order))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (rawOrders.length) return Math.min(...rawOrders);
  const range = group.orderRange;
  if (Array.isArray(range) && Number.isFinite(Number(range[0]))) return Number(range[0]);
  const txnNumber = Number(item?.txnNumber);
  if (Number.isFinite(txnNumber) && txnNumber > 0) return txnNumber;
  const idSuffix = displayText(item?.id).match(/-(\d+)$/);
  if (idSuffix) return Number(idSuffix[1]) + 1;
  return Number.MAX_SAFE_INTEGER;
}

function queueFiles(item: Record<string, unknown> | null | undefined): string[] {
  const direct = item?.files_txn || item?.files || item?.files_uploadAll;
  if (Array.isArray(direct)) return direct.map(displayText).filter(Boolean);
  const typed = asObject(item?.files_typed);
  return Object.values(typed)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map(displayText)
    .filter(Boolean);
}

function isUsefulFreeText(value: unknown): boolean {
  const text = displayText(value);
  if (!text || text === "-") return false;
  const compact = text.replace(/\s+/g, "").toLowerCase();
  if (/^notes?optional\d*,notes?\(optional\),control_textarea,\d+$/i.test(text)) return false;
  if (compact.includes("notesoptional") && compact.includes("control_textarea")) return false;
  return true;
}

function firstUsefulText(...values: unknown[]): string {
  for (const value of values) {
    if (!isUsefulFreeText(value)) continue;
    return displayText(value);
  }
  return "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = displayText(value);
    if (text) return text;
  }
  return "";
}

function fileLabel(file: string, index: number): string {
  try {
    const url = new URL(file);
    const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "");
    return last || `Document ${index + 1}`;
  } catch {
    return file || `Document ${index + 1}`;
  }
}

function AttachmentLinks({ files }: { files: string[] }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((file, index) => {
        const label = fileLabel(file, index);
        const isUrl = /^https?:\/\//i.test(file);
        return isUrl ? (
          <a
            key={`${file}-${index}`}
            className="inline-flex max-w-full items-center rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 hover:underline"
            href={file}
            target="_blank"
            rel="noreferrer"
          >
            <span className="truncate">{label}</span>
          </a>
        ) : (
          <span
            key={`${file}-${index}`}
            className="inline-flex max-w-full items-center rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-800"
            title={file}
          >
            <span className="truncate">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

function isAmountChanged(originalCents: number, draftDollars: string): boolean {
  const next = Math.round(Number(draftDollars || 0) * 100);
  return Number.isFinite(next) && next !== originalCents;
}

function jotformInboxUrl(formId: unknown, submissionId: unknown): string {
  const form = displayText(formId);
  const submission = displayText(submissionId);
  if (!form || !submission) return "";
  return `https://www.jotform.com/inbox/${encodeURIComponent(form)}/${encodeURIComponent(submission)}`;
}

function StatusBadge({ state }: { state: "open" | "closed" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        state === "open"
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {state === "open" ? "Open" : "Closed"}
    </span>
  );
}

function ToggleCheck({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
        checked
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
          checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {checked ? "OK" : null}
      </div>
      <span className="font-medium text-sm">{label}</span>
      {checked && <span className="ml-auto text-xs text-emerald-600 font-semibold">Done</span>}
    </button>
  );
}

function CustomerLink({ customerId, name }: { customerId: string; name: string }) {
  if (!customerId) return null;
  return (
    <a
      href={`/customers/${customerId}`}
      className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 hover:underline font-medium"
      target="_blank"
      rel="noopener noreferrer"
    >
      {name || customerId}
      <span className="text-xs text-sky-400">Open</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// AmountHeader — shared top amount display for all cards
// ---------------------------------------------------------------------------

function AmountHeader({
  amount,
  title,
  subtitle,
  state,
  badge,
}: {
  amount: number;
  title?: string;
  subtitle?: string;
  state: "open" | "closed";
  badge?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        state === "open"
          ? "bg-amber-50 border-amber-200"
          : "bg-emerald-50 border-emerald-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-3xl font-extrabold tabular-nums tracking-tight ${
              state === "open" ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {fmtCents(amount)}
          </div>
          {title ? (
            <div className="mt-1 max-w-[280px] truncate text-sm font-semibold text-slate-800">
              {title}
            </div>
          ) : null}
          {subtitle && (
            <div className={["max-w-[280px] truncate text-xs text-slate-500", title ? "mt-0.5" : "mt-1"].join(" ")}>{subtitle}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge state={state} />
          {badge}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="rounded-lg bg-white/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 break-words">{value}</div>
    </div>
  );
}

function shortDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "-";
  const [, month, day] = iso.split("-");
  return `${month}/${day}/${iso.slice(2, 4)}`;
}

function shortMonth(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "-";
  const [, month] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Math.max(0, Math.min(11, Number(month) - 1))]} ${iso.slice(0, 4)}`;
}

function CompactBudgetOverview({
  grantId,
  enrollmentId,
  enrollmentLabel,
  customerId,
  customerName,
  onOpenCustomerPayments,
  payments,
}: {
  grantId: string;
  enrollmentId: string;
  enrollmentLabel: string;
  customerId: string;
  customerName: string;
  onOpenCustomerPayments: (customerId: string) => void;
  payments: PaymentRecord[];
}) {
  const { data: grant, isLoading } = useGrant(grantId || undefined, { enabled: !!grantId });
  const totals = grant?.budget?.totals;
  const total = Number(totals?.total ?? grant?.budget?.total ?? 0);
  const spent = Number(totals?.spent ?? 0);
  const remaining = Number(
    totals?.projectedBalance ??
    totals?.balance ??
    total - spent - Number(totals?.projected ?? 0)
  );
  const customerSummary = React.useMemo(() => {
    const financial = normalizePayments(payments).filter((payment) => payment.type !== "service" && !payment.void);
    const dates = financial.map((payment) => payment.dueDate).filter(Boolean).sort();
    const start = dates[0] || null;
    const end = dates.at(-1) || null;
    const spentTotal = financial
      .filter((payment) => payment.paid === true)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const projectedTotal = financial
      .filter((payment) => payment.paid !== true)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const nextCert = computeRentCertDues(financial, { enrollmentId, enrollmentLabel })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .find((due) => due.targetPaymentDate >= todayISO()) || null;
    return { start, end, spentTotal, projectedTotal, nextCert };
  }, [enrollmentId, enrollmentLabel, payments]);

  return (
    <div className="space-y-3">
      {grantId ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          {isLoading ? (
            <>
              <div className="mb-2 h-3 w-28 animate-pulse rounded bg-slate-200" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="h-10 animate-pulse rounded bg-slate-200" />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm font-semibold text-slate-800">{grant?.name || "Grant Budget"}</div>
                {remaining < 0 ? (
                  <span className="shrink-0 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                    Over
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <SummaryItem label="Budget" value={fmtCurrencyUSD(total)} />
                <SummaryItem label="Spent" value={fmtCurrencyUSD(spent)} />
                <SummaryItem
                  label="Remaining"
                  value={<span className={remaining < 0 ? "text-rose-700" : "text-slate-900"}>{fmtCurrencyUSD(remaining)}</span>}
                />
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        {customerId ? (
          <button
            type="button"
            className="mb-2 inline-flex max-w-full items-center gap-1.5 text-left text-base font-bold text-sky-700 hover:text-sky-800 hover:underline"
            onClick={() => onOpenCustomerPayments(customerId)}
          >
            <span className="min-w-0 truncate">{customerName || customerId}</span>
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 4.5H3.75A1.75 1.75 0 0 0 2 6.25v6A1.75 1.75 0 0 0 3.75 14h6A1.75 1.75 0 0 0 11.5 12.25V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 2h5v5M8.5 7.5 14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <SummaryItem label="Spent" value={fmtCurrencyUSD(customerSummary.spentTotal)} />
          <SummaryItem label="Projected" value={fmtCurrencyUSD(customerSummary.projectedTotal)} />
          <SummaryItem label="Last Assistance" value={shortMonth(customerSummary.end)} />
          <SummaryItem
            label="Next Rent Cert"
            value={customerSummary.nextCert ? shortDate(customerSummary.nextCert.dueDate) : "-"}
          />
          <SummaryItem
            label="Assistance"
            value={`${shortDate(customerSummary.start)} - ${shortDate(customerSummary.end)}`}
          />
        </div>
      </div>
    </div>
  );
}

function EnrollmentPaymentFacts({
  payment,
  row,
}: {
  payment: PaymentRecord | null;
  row: SpendRow;
}) {
  const vendor = paymentVendor(payment, row);
  const noteComment = paymentNoteComment(payment, row);
  const type = paymentTypeLabel(payment?.type || asObject(row.ledgerEntry?.paymentSnapshot).type);

  if (!vendor && !noteComment && (!type || type === "-")) return null;

  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm md:grid-cols-3">
      {type && type !== "-" ? <SummaryItem label="Type" value={type} /> : null}
      {vendor ? <SummaryItem label="Vendor / Merchant" value={vendor} /> : null}
      {noteComment ? (
        <div className="md:col-span-3">
          <SummaryItem label="Note / Comment" value={<span className="whitespace-pre-wrap">{noteComment}</span>} />
        </div>
      ) : null}
    </div>
  );
}

function EnrollmentPaymentEditPanel({
  open,
  payment,
  row,
  grantId,
  lineItemId,
  busy,
  onCancel,
  onSave,
}: {
  open: boolean;
  payment: PaymentRecord | null;
  row: SpendRow;
  grantId: string;
  lineItemId: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: {
    type: TPayment["type"];
    amount: number;
    dueDate: string;
    lineItemId: string;
    vendor: string | null;
    note: string;
    comment: string | null;
  }) => Promise<void>;
}) {
  const [type, setType] = React.useState<TPayment["type"]>(
    PAYMENT_TYPES.includes(payment?.type as TPayment["type"]) ? (payment?.type as TPayment["type"]) : "monthly",
  );
  const [amount, setAmount] = React.useState(String(Number(payment?.amount ?? row.amountCents / 100) || ""));
  const [dueDate, setDueDate] = React.useState(paymentDueDate(payment, row.date));
  const [draftLineItemId, setDraftLineItemId] = React.useState(lineItemId);
  const [vendor, setVendor] = React.useState(paymentVendor(payment, row));
  const [noteComment, setNoteComment] = React.useState(paymentNoteComment(payment, row));
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setType(PAYMENT_TYPES.includes(payment?.type as TPayment["type"]) ? (payment?.type as TPayment["type"]) : "monthly");
    setAmount(String(Number(payment?.amount ?? row.amountCents / 100) || ""));
    setDueDate(paymentDueDate(payment, row.date));
    setDraftLineItemId(lineItemId);
    setVendor(paymentVendor(payment, row));
    setNoteComment(paymentNoteComment(payment, row));
    setError("");
  }, [open, payment, row, lineItemId]);

  const submit = async () => {
    setError("");
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError("Date must be YYYY-MM-DD.");
      return;
    }
    if (!draftLineItemId) {
      setError("Select a budget line item.");
      return;
    }
    await onSave({
      type,
      amount: nextAmount,
      dueDate,
      lineItemId: draftLineItemId,
      vendor: vendor.trim() ? vendor.trim() : null,
      note: noteComment.trim(),
      comment: noteComment.trim() ? noteComment.trim() : null,
    });
  };

  return (
    <Modal
      isOpen={open}
      title="Edit Enrollment Payment"
      onClose={onCancel}
      widthClass="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void submit()} disabled={busy}>{busy ? "Saving..." : "Save Payment"}</button>
        </div>
      }
    >
      {error ? <div className="mb-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</div> : null}
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.5fr]">
        {grantId ? <GrantBudgetStrip grantId={grantId} /> : null}
        <div className="space-y-1">
          <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">Budget Line Item</label>
          <LineItemSelect
            grantId={grantId || null}
            value={draftLineItemId || null}
            onChange={(value) => setDraftLineItemId(String(value || ""))}
            inputClassName="w-full"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-500">
              <th className="px-2 py-1.5">Type</th>
              <th className="px-2 py-1.5">Vendor / Merchant</th>
              <th className="px-2 py-1.5">Amount</th>
              <th className="px-2 py-1.5">Date</th>
              <th className="px-2 py-1.5">Note / Comment</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-2 align-top">
                <select className="input min-w-28 text-sm" value={type} onChange={(e) => setType(e.currentTarget.value as TPayment["type"])} disabled={busy}>
                  {PAYMENT_TYPES.map((option) => <option key={option} value={option}>{paymentTypeLabel(option)}</option>)}
                </select>
              </td>
              <td className="px-2 py-2 align-top">
                <input className="input min-w-36 text-sm" value={vendor} onChange={(e) => setVendor(e.currentTarget.value)} disabled={busy} />
              </td>
              <td className="px-2 py-2 align-top">
                <input className="input min-w-28 text-sm" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.currentTarget.value)} disabled={busy} />
              </td>
              <td className="px-2 py-2 align-top">
                <input className="input min-w-36 text-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.currentTarget.value)} disabled={busy} />
              </td>
              <td className="px-2 py-2 align-top">
                <textarea className="input min-h-10 min-w-64 resize-y text-sm" value={noteComment} onChange={(e) => setNoteComment(e.currentTarget.value)} disabled={busy} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function AdvancedEnrollmentDetails({
  enrollmentId,
  paymentId,
  payment,
  row,
  onMarkPastComplete,
  markPastBusy,
}: {
  enrollmentId: string;
  paymentId: string;
  payment: PaymentRecord | null;
  row: SpendRow;
  onMarkPastComplete?: () => void | Promise<void>;
  markPastBusy?: boolean;
}) {
  const compliance = readCompliance(payment?.compliance);
  const complianceItems = Array.isArray(compliance.items) ? compliance.items : [];
  const queueItem = asObject(row.paymentQueueItem);
  const ledgerEntry = asObject(row.ledgerEntry);
  const meta = {
    payment: payment || undefined,
    ledgerEntry: row.ledgerEntry || undefined,
    paymentQueueItem: row.paymentQueueItem || undefined,
  };
  const json = JSON.stringify(meta, null, 2);

  return (
    <details className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition hover:bg-slate-50">
        <span className="text-sm font-semibold text-slate-700">Advanced Details</span>
        <span className="text-sm font-bold text-slate-400 transition group-open:rotate-180">v</span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-4">
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <SummaryItem label="Enrollment ID" value={enrollmentId || "-"} />
          <SummaryItem label="Payment ID" value={paymentId || "-"} />
          <SummaryItem label="Payment Type" value={paymentTypeLabel(payment?.type)} />
          <SummaryItem label="Paid" value={payment?.paid ? "Yes" : "No"} />
          <SummaryItem label="Paid At" value={fmtDateOrDash(String(payment?.paidAt || ""))} />
          <SummaryItem label="Paid From Grant" value={payment?.paidFromGrant ? "Yes" : "No"} />
          <SummaryItem label="Void" value={payment?.void ? "Yes" : "No"} />
          <SummaryItem label="Vendor / Merchant" value={paymentVendor(payment, row) || "-"} />
          <SummaryItem label="Note / Comment" value={paymentNoteComment(payment, row) || "-"} />
          <SummaryItem label="Notify CM" value={payment?.notifyCM ? "Yes" : "No"} />
          <SummaryItem label="Compliance Status" value={compliance.status || "-"} />
          <SummaryItem label="Compliance Note" value={compliance.note || "-"} />
          <SummaryItem label="Compliance Items" value={complianceItems.length ? complianceItems.map((item) => displayText(item.label || item.key || item)).join(", ") : "-"} />
          <SummaryItem label="Queue Status" value={displayText(queueItem.queueStatus || queueItem.status) || "-"} />
          <SummaryItem label="Queue Source" value={displayText(queueItem.source) || "-"} />
          <SummaryItem label="Queue ID" value={displayText(queueItem.id) || "-"} />
          <SummaryItem label="Ledger ID" value={displayText(ledgerEntry.id || row.linkedLedgerId) || "-"} />
        </div>
        <pre className="rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-relaxed text-emerald-300 whitespace-pre-wrap break-all">
          {json}
        </pre>
        {onMarkPastComplete ? (
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              className="btn btn-sm border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
              disabled={markPastBusy}
              onClick={() => void onMarkPastComplete()}
            >
              Mark Past Payments Complete
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// CreditCardBudgetBar
// ---------------------------------------------------------------------------

function CreditCardBudgetBar({ budget }: { budget: CardBudget }) {
  const usage = budget.limitCents > 0
    ? Math.min(100, Math.round((budget.spentCents / budget.limitCents) * 100))
    : 0;
  const tone =
    usage >= 100 ? "bg-rose-500"
    : usage >= 85 ? "bg-amber-400"
    : "bg-sky-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Card Budget</div>
          <div className="text-sm font-bold text-slate-900">
            {budget.name}{budget.last4 ? ` **** ${budget.last4}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Remaining</div>
          <div className={`text-xl font-black tabular-nums ${budget.remainingCents < 0 ? "text-rose-600" : "text-slate-900"}`}>
            {fmtCents(budget.remainingCents)}
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
          <span>Spent {fmtCents(budget.spentCents)}</span>
          <span>{usage}% of {fmtCents(budget.limitCents)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-2 rounded-full transition-all ${tone}`} style={{ width: `${usage}%` }} />
        </div>
        {budget.pendingCents > 0 && (
          <div className="text-[11px] text-slate-400 mt-1">
            + {fmtCents(budget.pendingCents)} pending
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JotformViewPanel - normalized answers and raw inspector for CC / Invoice cards
// ---------------------------------------------------------------------------

type ViewMode = "detail" | "qa" | "raw";

function JotformViewPanel({
  submissionId,
  rawMeta,
  mode,
}: {
  submissionId?: string;
  rawMeta?: Record<string, unknown>;
  mode: ViewMode;
}) {
  const [copied, setCopied] = React.useState(false);

  const { data: submission, isLoading } = useJotformSubmission(submissionId, {
    enabled: !!submissionId && (mode === "qa" || mode === "raw"),
  });

  const rawAnswers = React.useMemo(() => readSubmissionAnswers(submission, rawMeta), [submission, rawMeta]);
  const normalizedFields = React.useMemo(
    () => buildNormalizedAnswerFields((rawAnswers || {}) as Record<string, unknown>),
    [rawAnswers],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rawAnswers, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed.", { type: "error" });
    }
  };

  if (mode === "qa") {
    if (isLoading && submissionId) {
      return <div className="py-4 text-sm text-slate-400 animate-pulse text-center">Loading submission...</div>;
    }

    if (!normalizedFields.length) {
      return <div className="py-3 text-sm text-slate-400">No normalized answers available.</div>;
    }

    return (
      <div className="space-y-2">
        {normalizedFields.map((field) => {
          return (
            <div key={field.key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{field.label}</div>
              <div className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap break-words">{field.value}</div>
              <div className="mt-1 text-[11px] font-mono text-slate-400">{field.key}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === "raw") {
    const json = JSON.stringify(rawAnswers, null, 2);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Raw JSON</span>
          <button
            className="btn btn-ghost btn-xs"
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] text-emerald-300 leading-relaxed font-mono whitespace-pre-wrap break-all">
          {json}
        </pre>
      </div>
    );
  }

  return null;
}

function QueueLifecycleBadge({ status }: { status?: string | null }) {
  const normalized = String(status || "pending").toLowerCase();
  const tone =
    normalized === "posted" ? "bg-emerald-100 text-emerald-700"
    : normalized === "void" ? "bg-rose-100 text-rose-700"
    : "bg-amber-100 text-amber-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {normalized || "pending"}
    </span>
  );
}

function ProvenanceSection({
  queueItem,
  ledgerEntry,
  title,
}: {
  queueItem?: Record<string, unknown> | null;
  ledgerEntry?: Record<string, unknown> | null;
  title?: string;
}) {
  const ledgerRecord = asObject(ledgerEntry);
  const origin = asObject(ledgerRecord.origin);
  const queueSource = queueItem?.source || origin.paymentQueueSource;
  const submissionId = String(queueItem?.submissionId || origin.jotformSubmissionId || "");
  const formId = String(queueItem?.formId || asObject(queueItem?.rawMeta).form_id || origin.jotformFormId || "");
  const jotformUrl = jotformInboxUrl(formId, submissionId);
  return (
    <DetailSection title={title || "Pipeline Provenance"}>
      <DetailRow label="Queue Item" value={String(queueItem?.id || "-")} />
      <DetailRow label="Queue Status" value={<QueueLifecycleBadge status={String(queueItem?.queueStatus || "pending")} />} />
      <DetailRow label="Submission ID" value={submissionId || "-"} />
      {formId ? <DetailRow label="Form ID" value={formId} /> : null}
      <DetailRow label="Queue Source" value={stageLabelFromQueueSource(queueSource)} />
      <DetailRow label="Ledger Entry" value={String(queueItem?.ledgerEntryId || ledgerRecord.id || "Not posted")} />
      <DetailRow label="Origin Path" value={String(origin.sourcePath || "-")} />
      <DetailRow label="Reopened" value={String(queueItem?.reopenedAt || "-")} />
      <DetailRow
        label="Source Browser"
        value={jotformUrl ? (
          <a className="text-sky-600 hover:underline" href={jotformUrl} target="_blank" rel="noreferrer">
            Open in Jotform
          </a>
        ) : (
          <Link className="text-sky-600 hover:underline" href="/tools/jotforms">Open Jotforms</Link>
        )}
      />
    </DetailSection>
  );
}

function DenseJsonBlock({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  const json = JSON.stringify(value ?? null, null, 2);
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <pre className="rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] font-mono leading-relaxed text-emerald-300 whitespace-pre-wrap break-all">
        {json}
      </pre>
    </div>
  );
}

function AdvancedQueueDetails({
  title = "Advanced Details",
  submissionId,
  rawMeta,
  queueItem,
  ledgerEntry,
  pipeline,
}: {
  title?: string;
  submissionId?: string;
  rawMeta?: Record<string, unknown>;
  queueItem?: Record<string, unknown> | null;
  ledgerEntry?: Record<string, unknown> | null;
  pipeline: React.ReactNode;
}) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("detail");
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "detail", label: "Pipeline" },
    { id: "qa", label: "Normalized Answers" },
    { id: "raw", label: "Raw Inspector" },
  ];

  return (
    <details className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition hover:bg-slate-50">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className="text-sm font-bold text-slate-400 transition group-open:rotate-180">v</span>
      </summary>
      <div className="space-y-4 border-t border-slate-100 p-4">
        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={[
                  "relative px-4 py-2 text-sm font-medium transition",
                  "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full",
                  viewMode === tab.id
                    ? "text-sky-600 after:bg-sky-500"
                    : "text-slate-500 after:bg-transparent hover:text-slate-700",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "detail" ? (
          <div className="space-y-4">{pipeline}</div>
        ) : (
          <JotformViewPanel
            submissionId={submissionId}
            rawMeta={rawMeta}
            mode={viewMode}
          />
        )}

        <div className="grid grid-cols-1 gap-4">
          <DenseJsonBlock title="Payment Queue Item" value={queueItem || {}} />
          <DenseJsonBlock title="Ledger Entry" value={ledgerEntry || {}} />
        </div>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// EnrollmentSpendCard
// ---------------------------------------------------------------------------

function EnrollmentSpendCard({
  row,
  grantNameById,
  lineItemLookup,
  customerNameById,
  onOpenCustomerPayments,
  onChildModalOpenChange,
}: {
  row: SpendRow;
  grantNameById: Map<string, string>;
  lineItemLookup: Map<string, { grantName: string; lineItemLabel: string }>;
  customerNameById: Map<string, string>;
  onOpenCustomerPayments: (customerId: string) => void;
  onChildModalOpenChange: (open: boolean) => void;
}) {
  const isProjection = row.kind === "queue-projection";

  // IDs for compliance/spend mutations
  const enrollmentId = String(
    row.paymentQueueItem?.enrollmentId ||
    row.ledgerEntry?.enrollmentId ||
    ""
  );
  const paymentId = String(
    row.paymentQueueItem?.paymentId ||
    row.ledgerEntry?.paymentId ||
    ""
  );

  // Fetch enrollment payments to get current compliance state
  const { data: enrollmentPayments = [] } = useEnrollmentPayments(enrollmentId || null, {
    enabled: !!enrollmentId,
  });

  const thisPayment = React.useMemo(
    () => (enrollmentPayments as PaymentRecord[]).find((payment) => String(payment.id || "") === paymentId) || null,
    [enrollmentPayments, paymentId],
  );

  const [localHmis, setLocalHmis] = React.useState(false);
  const [localCw, setLocalCw] = React.useState(false);
  const [localPaid, setLocalPaid] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const compliance = readCompliance(thisPayment?.compliance);
    const ledgerCompliance = readCompliance(asObject(row.ledgerEntry).compliance);
    const ledgerPaid = asObject(row.ledgerEntry).paid;
    setLocalHmis(!!(compliance.hmisComplete ?? ledgerCompliance.hmisComplete));
    setLocalCw(!!(compliance.caseworthyComplete ?? ledgerCompliance.caseworthyComplete));
    setLocalPaid(
      !!(thisPayment?.paid ?? ledgerPaid ?? row.completed),
    );
  }, [thisPayment, row.ledgerEntry, row.completed]);

  const updateCompliance = usePaymentsUpdateCompliance();
  const spendMutation = usePaymentsSpend();
  const adjustMutation = usePaymentsProjectionsAdjust();

  const [editOpen, setEditOpen] = React.useState(false);

  React.useEffect(() => {
    onChildModalOpenChange(editOpen);
    return () => onChildModalOpenChange(false);
  }, [editOpen, onChildModalOpenChange]);

  const handleToggle = async (field: "hmis" | "cw" | "paid", next: boolean) => {
    setSaving(true);
    try {
      if (field === "hmis" || field === "cw") {
        if (!enrollmentId || !paymentId) {
          toast("Missing enrollment/payment ID for compliance update.", { type: "error" });
          return;
        }
        await updateCompliance.mutateAsync({
          enrollmentId,
          paymentId,
          patch: field === "hmis" ? { hmisComplete: next } : { caseworthyComplete: next },
        });
      } else {
        // paid toggle
        if (isProjection) {
          // Queue projection: use paymentsSpend
          if (!enrollmentId || !paymentId) {
            toast("Missing enrollment/payment for spend action.", { type: "error" });
            return;
          }
          await spendMutation.mutateAsync({ body: { enrollmentId, paymentId, reverse: !next } });
        }
        // For grant-ledger (already posted) the paid field is read-only; skip silently
      }
    } catch (e: unknown) {
      if (field === "hmis") setLocalHmis(!next);
      else if (field === "cw") setLocalCw(!next);
      else setLocalPaid(!next);
      const msg = toApiError(e, "Update failed.").error;
      toast(msg, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const info = lineItemLookup.get(`${row.grantId}:${row.lineItemId}`);
  const grantName = info?.grantName || grantNameById.get(row.grantId) || row.grantId || "-";
  const lineItemLabel = info?.lineItemLabel || row.lineItemId || "-";
  const customerName = customerNameById.get(row.customerId) || row.customerId || "";

  const allDone = localHmis && localCw && localPaid;
  const currentLineItemId = String(thisPayment?.lineItemId || row.lineItemId || "");
  const mutationBusy = saving || updateCompliance.isPending || spendMutation.isPending || adjustMutation.isPending;

  const savePaymentEdit = async (patch: {
    type: TPayment["type"];
    amount: number;
    dueDate: string;
    lineItemId: string;
    vendor: string | null;
    note: string;
    comment: string | null;
  }) => {
    if (!enrollmentId || !paymentId) {
      toast("Missing enrollment/payment ID for payment edit.", { type: "error" });
      return;
    }
    if (!currentLineItemId) {
      toast("Missing budget line item for payment edit.", { type: "error" });
      return;
    }
    try {
      if (isProjection || !thisPayment?.paid) {
        await adjustMutation.mutateAsync({
          enrollmentId,
          projectionAdjustment: {
            edits: [{
              paymentId,
              amount: patch.amount,
              dueDate: patch.dueDate,
              lineItemId: patch.lineItemId,
              type: patch.type,
              note: patch.note,
              vendor: patch.vendor || "",
              comment: patch.comment || "",
            }],
            replaceUnpaid: true,
          },
          options: { updateGrantBudgets: true, recalcGrantProjected: true, activeOnly: true },
        });
      } else {
        await adjustMutation.mutateAsync({
          enrollmentId,
          spendAdjustment: {
            paymentId,
            newAmount: patch.amount,
            dueDate: patch.dueDate,
            lineItemId: patch.lineItemId,
            type: patch.type,
            note: patch.note,
            vendor: patch.vendor,
            comment: patch.comment,
            reason: "Payment modal edit",
          },
          options: { updateGrantBudgets: true, recalcGrantProjected: true, activeOnly: true },
        });
      }
      toast("Payment saved.", { type: "success" });
      setEditOpen(false);
    } catch (e: unknown) {
      toast(toApiError(e, "Payment edit failed.").error, { type: "error" });
    }
  };

  const handleVoidPayment = async () => {
    if (!enrollmentId || !paymentId) {
      toast("Missing enrollment/payment ID for void.", { type: "error" });
      return;
    }
    const amount = fmtCurrencyUSD(Number(thisPayment?.amount ?? row.amountCents / 100) || 0);
    const date = fmtDateOrDash(paymentDueDate(thisPayment, row.date));
    const paid = Boolean(thisPayment?.paid ?? row.completed);
    const message = paid
      ? `Void ${amount} dated ${date}? This will reverse the posted grant spend and remove the payment row.`
      : `Void ${amount} dated ${date}? This will remove the unpaid projection and recalculate projected grant budget.`;
    if (!window.confirm(message)) return;
    try {
      await adjustMutation.mutateAsync({
        enrollmentId,
        deleteRows: {
          paymentIds: [paymentId],
          preservePaid: false,
          updateBudgets: true,
          removeSpends: true,
          reverseLedger: paid,
        },
        options: { updateGrantBudgets: true, recalcGrantProjected: true, activeOnly: true },
      });
      toast(paid ? "Payment voided and spend reversed." : "Projection voided.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e, "Void failed.").error, { type: "error" });
    }
  };

  const handleMarkPastComplete = async () => {
    if (!enrollmentId) {
      toast("Missing enrollment ID.", { type: "error" });
      return;
    }
    const today = todayISO();
    const pastPayments = (enrollmentPayments as PaymentRecord[])
      .filter((payment) => {
        const id = String(payment?.id || "");
        const dueDate = paymentDueDate(payment);
        return id && dueDate && dueDate < today && !payment.paid && !payment.void;
      });
    if (!pastPayments.length) {
      toast("No unpaid past payments to complete.", { type: "info" });
      return;
    }
    const total = pastPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (!window.confirm(`Mark ${pastPayments.length} past payment${pastPayments.length === 1 ? "" : "s"} complete for ${fmtCurrencyUSD(total)}?`)) return;
    try {
      for (const payment of pastPayments) {
        await spendMutation.mutateAsync({ body: { enrollmentId, paymentId: String(payment.id), reverse: false } });
      }
      toast("Past payments marked complete.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e, "Mark past payments complete failed.").error, { type: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <AmountHeader
        amount={row.amountCents}
        subtitle={[grantName, lineItemLabel].filter((s) => s && s !== "-").join(" | ")}
        state={row.workflowState}
        badge={<span className="text-xs font-medium text-slate-500">{fmtDateOrDash(row.date)}</span>}
      />

      <EnrollmentPaymentFacts payment={thisPayment} row={row} />

      <CompactBudgetOverview
        grantId={row.grantId}
        enrollmentId={enrollmentId}
        enrollmentLabel={`${grantName} enrollment`}
        customerId={row.customerId}
        customerName={customerName}
        onOpenCustomerPayments={onOpenCustomerPayments}
        payments={enrollmentPayments as PaymentRecord[]}
      />

      {/* Checklist — compliance + paid */}
      <div className="space-y-2">
        <ToggleCheck
          label="HMIS Entry Complete"
          checked={localHmis}
          disabled={mutationBusy || !enrollmentId || !paymentId}
          onToggle={() => { const next = !localHmis; setLocalHmis(next); void handleToggle("hmis", next); }}
        />
        <ToggleCheck
          label="CW Entry Complete"
          checked={localCw}
          disabled={mutationBusy || !enrollmentId || !paymentId}
          onToggle={() => { const next = !localCw; setLocalCw(next); void handleToggle("cw", next); }}
        />
        <ToggleCheck
          label="Invoice Submitted"
          checked={localPaid}
          disabled={mutationBusy || (!isProjection)}
          onToggle={() => { const next = !localPaid; setLocalPaid(next); void handleToggle("paid", next); }}
        />
        {allDone && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 text-center">
            All complete
          </div>
        )}
        {!isProjection && (
          <p className="text-[11px] text-slate-400 px-1">
            Invoice Submitted is managed via the payment workflow (already posted).
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1.5fr]">
        <button
          type="button"
          className="btn btn-sm border border-slate-200 bg-white py-2.5 text-slate-700 hover:bg-slate-50"
          disabled={mutationBusy || !enrollmentId || !paymentId}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-sm border border-rose-200 bg-rose-50 py-2.5 text-rose-700 hover:bg-rose-100"
          disabled={mutationBusy || !enrollmentId || !paymentId}
          onClick={() => void handleVoidPayment()}
        >
          Void
        </button>
        {row.customerId && (
          <button
            type="button"
            className="btn btn-sm border border-sky-200 bg-sky-50 py-2.5 text-sky-700 hover:bg-sky-100"
            disabled={mutationBusy}
            onClick={() => onOpenCustomerPayments(row.customerId)}
          >
            Open Payment Schedule
          </button>
        )}
      </div>

      {editOpen && (
        <EnrollmentPaymentEditPanel
          open={editOpen}
          payment={thisPayment}
          row={row}
          grantId={row.grantId}
          lineItemId={currentLineItemId}
          busy={mutationBusy}
          onCancel={() => setEditOpen(false)}
          onSave={savePaymentEdit}
        />
      )}

      <AdvancedEnrollmentDetails
        enrollmentId={enrollmentId}
        paymentId={paymentId}
        payment={thisPayment}
        row={row}
        onMarkPastComplete={handleMarkPastComplete}
        markPastBusy={mutationBusy}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardSpendCard  (card-ledger + queue-credit-card)
// ---------------------------------------------------------------------------

function CardSpendCard({
  row,
  grantNameById,
  lineItemLookup,
  customerNameById,
  cardBudget,
  workflowTask,
  onOpenCustomerWorkspace,
}: {
  row: SpendRow;
  grantNameById: Map<string, string>;
  lineItemLookup: Map<string, { grantName: string; lineItemLabel: string }>;
  customerNameById: Map<string, string>;
  cardBudget?: CardBudget | null;
  workflowTask?: Record<string, unknown> | null;
  onOpenCustomerWorkspace: (customerId: string, initialTab?: "details" | "payments") => void;
}) {
  const [assignGrantId, setAssignGrantId] = React.useState(row.grantId || "");
  const [assignLineItemId, setAssignLineItemId] = React.useState(row.lineItemId || "");
  const [amountDraft, setAmountDraft] = React.useState(String((row.amountCents / 100).toFixed(2)));
  const [correctionReason, setCorrectionReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState("");
  const [actionMessage, setActionMessage] = React.useState("");
  const [entryDialogMode, setEntryDialogMode] = React.useState<CardInvoiceEntryMode>("manual-cc");
  const [entryDialogOpen, setEntryDialogOpen] = React.useState(false);

  const patchQueue = usePatchPaymentQueueItem();
  const postQueue = usePostPaymentQueueToLedger();
  const reopenQueue = useReopenPaymentQueueItem();
  const voidQueue = useVoidPaymentQueueItem();
  const classifyLedger = useClassifyLedgerEntries();
  const createLedger = useCreateLedgerEntry();
  const createTask = useTaskOtherCreate();
  const updateTaskStatus = useTaskOtherStatus();

  const isQueue = row.kind === "queue-credit-card";
  const queueId = String(row.paymentQueueItem?.id || "");
  const ledgerId = String(row.ledgerEntry?.id || "");
  const submissionId = String(row.paymentQueueItem?.submissionId || "");
  const provenanceLedgerId = String(row.paymentQueueItem?.ledgerEntryId || ledgerId || row.linkedLedgerId || "");
  const ledgerEntryQ = useLedgerEntry(provenanceLedgerId || undefined, { enabled: !!provenanceLedgerId });
  const sameSubmissionQ = usePaymentQueueItems(
    { submissionId, limit: 20 },
    { enabled: isQueue && !!submissionId, staleTime: 30_000 },
  );

  React.useEffect(() => {
    setActionError("");
    setActionMessage("");
    setAdvancedOpen(false);
  }, [row.id, row.workflowState]);

  const info = lineItemLookup.get(`${row.grantId}:${row.lineItemId}`);
  const grantName = info?.grantName || grantNameById.get(row.grantId) || row.grantId || "-";
  const lineItemLabel = info?.lineItemLabel || row.lineItemId || "-";
  const customerName = customerNameById.get(row.customerId) || row.customerId || "";
  const queueItem = row.paymentQueueItem || null;
  const direction = queueString(queueItem, "direction") || (row.amountCents < 0 ? "return" : "charge");
  const isReturn = direction === "return";
  const purchaser = firstText(queueString(queueItem, "purchaser"), row.title);
  const merchant = firstText(queueString(queueItem, "merchant"), row.title);
  const cardType = firstText(queueFieldAnswer(queueItem, "cardUsed"), queueString(queueItem, "card"), row.creditCardName, row.creditCardId);
  const purpose = firstText(queueString(queueItem, "purpose"), queueString(queueItem, "descriptor"));
  const expenseType = queueString(queueItem, "expenseType");
  const supportServicesProgram = firstText(queueFieldAnswer(queueItem, "supportiveProgram"), queueString(queueItem, "program"));
  const tssSpendCategory = firstText(queueFieldAnswer(queueItem, "tssCategory"));
  const programOperationsFor = firstText(queueFieldAnswer(queueItem, "programOperations"), queueString(queueItem, "billedTo"));
  const queueCustomerName = firstText(customerName, queueString(queueItem, "customer"), queueString(queueItem, "customerName"));
  const purchasePath = queueString(queueItem, "purchasePath") || (queueCustomerName ? "customer" : programOperationsFor ? "program" : "");
  const isProgramSpend = purchasePath === "program" || (!!programOperationsFor && !queueCustomerName);
  const isFlex = Boolean(queueItem?.isFlex || queueItem?.submissionIsFlex);
  const queueNotes = firstUsefulText(queueString(queueItem, "notes"), queueString(queueItem, "note"), queueFieldAnswer(queueItem, "notes"));
  const receiptFiles = queueFiles(queueItem);
  const sourceUrl = jotformInboxUrl(queueItem?.formId || asObject(queueItem?.rawMeta).form_id, submissionId);
  const otherTransactions = ((sameSubmissionQ.data || []) as Array<Record<string, unknown> & { id: string }>)
    .filter((item) => String(item.id || "") !== queueId)
    .sort((a, b) => queueFieldOrder(a) - queueFieldOrder(b));
  const amountCorrectionRequired = isQueue && isAmountChanged(row.amountCents, amountDraft);

  const anyMutating =
    patchQueue.isPending || postQueue.isPending || reopenQueue.isPending ||
    voidQueue.isPending || classifyLedger.isPending || createLedger.isPending ||
    createTask.isPending || updateTaskStatus.isPending;

  const handleReopen = async () => {
    setActionError("");
    setActionMessage("");
    setSaving(true);
    try {
      if (isQueue) {
        await reopenQueue.mutateAsync({ id: queueId });
        setActionMessage("Transaction reopened.");
      }
    } catch (e: unknown) {
      setActionError(toApiError(e, "Reopen failed.").error);
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    setActionError("");
    setActionMessage("");
    setSaving(true);
    try {
      await voidQueue.mutateAsync({ id: queueId });
      setActionMessage("Payment item voided. It will not be posted to the ledger.");
    } catch (e: unknown) {
      setActionError(toApiError(e, "Void failed.").error);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    setActionError("");
    setActionMessage("");
    if (amountCorrectionRequired && !correctionReason.trim()) {
      setActionError("Add a correction note because the amount was changed.");
      setAdvancedOpen(true);
      return;
    }
    if (isQueue && assignGrantId && !assignLineItemId) {
      setActionError("Select a budget for the chosen grant, or leave Grant as No Grant Classification.");
      return;
    }
    setSaving(true);
    try {
      if (isQueue) {
        await patchQueue.mutateAsync({
          id: queueId,
          body: {
            grantId: assignGrantId || null,
            lineItemId: assignGrantId ? assignLineItemId || null : null,
            okUnassigned: !assignGrantId,
            amount: Number(amountDraft || 0),
            ...(correctionReason.trim() ? { localModificationReason: correctionReason.trim() } : {}),
          },
        });
        await postQueue.mutateAsync({ id: queueId });
        setAdvancedOpen(false);
        setActionMessage("Marked complete and posted to the ledger.");
      } else if (ledgerId && assignGrantId && assignLineItemId) {
        await classifyLedger.mutateAsync({
          items: [{ entryId: ledgerId, grantId: assignGrantId, lineItemId: assignLineItemId }],
          dryRun: false,
        });
        toast("Allocated.", { type: "success" });
      } else {
        setActionError("Select grant and budget first.");
      }
    } catch (e: unknown) {
      setActionError(toApiError(e, "Action failed.").error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQueueCorrection = async () => {
    if (!isQueue) return;
    setActionError("");
    setActionMessage("");
    if (amountCorrectionRequired && !correctionReason.trim()) {
      setActionError("Add a correction note because the amount was changed.");
      setAdvancedOpen(true);
      return;
    }
    if (assignGrantId && !assignLineItemId) {
      setActionError("Select a budget for the chosen grant, or leave Grant as No Grant Classification.");
      return;
    }
    setSaving(true);
    try {
      await patchQueue.mutateAsync({
        id: queueId,
        body: {
          grantId: assignGrantId || null,
          lineItemId: assignGrantId ? assignLineItemId || null : null,
          okUnassigned: !assignGrantId,
          amount: Number(amountDraft || 0),
          ...(correctionReason.trim() ? { localModificationReason: correctionReason.trim() } : {}),
        },
      });
      setActionMessage("Assignment saved.");
    } catch (e: unknown) {
      setActionError(toApiError(e, "Save failed.").error);
    } finally {
      setSaving(false);
    }
  };

  const openEntryDialog = (m: CardInvoiceEntryMode) => {
    setEntryDialogMode(m);
    setEntryDialogOpen(true);
  };

  const handleCreateTask = async () => {
    try {
      await createTask.mutateAsync({
        title: `Allocate card spend ${row.subtitle}`,
        notify: false,
        notes: [
          `LEDGER_ENTRY:${row.subtitle}`,
          `Source: ${row.sourceLabel}`,
          `Amount: ${fmtCurrencyUSD(row.amountCents / 100)}`,
          `Title: ${row.title || "-"}`,
          row.creditCardName ? `Card: ${row.creditCardName}` : "",
        ].filter(Boolean).join("\n"),
        dueDate: row.date || undefined,
        assign: { group: "compliance", uids: null },
      });
      toast("Spend task created.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e, "Task creation failed.").error, { type: "error" });
    }
  };

  return (
    <div className="space-y-4">
      {cardBudget && <CreditCardBudgetBar budget={cardBudget} />}

      {isQueue ? (
        <div className={isReturn ? "overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm" : "overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm"}>
          <div className={isReturn ? "border-b border-emerald-200 bg-emerald-100/60 px-4 py-3" : "border-b border-amber-200 bg-amber-100/70 px-4 py-3"}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={isReturn ? "text-3xl font-extrabold tabular-nums tracking-tight text-emerald-800" : "text-3xl font-extrabold tabular-nums tracking-tight text-amber-800"}>
                    {fmtCents(row.amountCents)}
                  </div>
                  {isReturn ? (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                      Return / Credit Back
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                      Card Charge
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-base font-bold text-slate-950">{merchant || "Card transaction"}</div>
                <div className="mt-0.5 text-xs font-medium text-slate-600">
                  {[fmtDateOrDash(row.date), cardType || row.sourceLabel].filter(Boolean).join(" | ")}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge state={row.workflowState} />
                {row.cardBucket ? (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    {row.cardBucket}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <SummaryItem label="Purchaser" value={purchaser} />
              <SummaryItem label="Card Used" value={cardType} />
              <SummaryItem label="Merchant / Vendor" value={merchant} />
              <SummaryItem label="Purpose" value={purpose} />
              <SummaryItem label="Expense Type" value={expenseType} />
              <SummaryItem label={isProgramSpend ? "Program" : "Customer"} value={isProgramSpend ? "Program Operations" : "Customer"} />
              {isProgramSpend ? (
                <SummaryItem label="Program Operations For" value={programOperationsFor || supportServicesProgram} />
              ) : (
                <>
                  <SummaryItem label="Customer Name" value={queueCustomerName} />
                  <SummaryItem label="Support Services Program" value={supportServicesProgram} />
                  <SummaryItem label="TSS Spend Category" value={tssSpendCategory} />
                  <SummaryItem label="YHDP Flex Funds" value={isFlex ? "Yes" : "No"} />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-amber-200/80 pt-3 md:grid-cols-2">
              {receiptFiles.length ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Purchase Documentation</div>
                  <AttachmentLinks files={receiptFiles} />
                </div>
              ) : null}
              {sourceUrl ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Source Submission</div>
                  <a className="inline-flex rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 hover:underline" href={sourceUrl} target="_blank" rel="noreferrer">
                    Open in Jotform
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <AmountHeader
          amount={row.amountCents}
          title={row.title}
          subtitle={row.creditCardName || row.creditCardId || undefined}
          state={row.workflowState}
          badge={
            row.cardBucket ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {row.cardBucket}
              </span>
            ) : undefined
          }
        />
      )}

      {isQueue && queueNotes ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Transaction Note</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{queueNotes}</div>
        </div>
      ) : null}

      {isQueue && (
        <div className="space-y-3 rounded-xl border-2 border-sky-100 bg-sky-50/30 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-sky-700">Assign & Post</div>
              <div className="mt-0.5 text-xs text-slate-500">Match the grant and budget, then mark the payment complete.</div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              Advanced
            </button>
          </div>
          {row.paymentQueueItem?.localModified ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Local tracker edits are preserved during Jotform reconcile.
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">Grant</label>
              <GrantSelect
                value={assignGrantId || null}
                onChange={(v) => { setAssignGrantId(String(v || "")); setAssignLineItemId(""); }}
                includeUnassigned
                placeholderLabel="No Grant Classification"
              />
            </div>
            <div className="space-y-1">
              <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">Budget</label>
              <LineItemSelect
                grantId={assignGrantId || null}
                value={assignLineItemId || null}
                onChange={(v) => setAssignLineItemId(String(v || ""))}
                inputClassName="w-full"
              />
            </div>
          </div>
          {assignGrantId && <GrantBudgetStrip grantId={assignGrantId} />}
          {advancedOpen ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">Amount</label>
                  <input
                    className={["input text-sm", amountCorrectionRequired && !correctionReason.trim() ? "border-amber-300 bg-amber-50" : ""].join(" ")}
                    type="number"
                    step="0.01"
                    value={amountDraft}
                    onChange={(e) => setAmountDraft(e.currentTarget.value)}
                    placeholder="Amount"
                  />
                </div>
                <div className="space-y-1">
                  <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">
                    Correction Note{amountCorrectionRequired ? " Required" : ""}
                  </label>
                  <input
                    className={["input text-sm", amountCorrectionRequired && !correctionReason.trim() ? "border-amber-300 bg-amber-50" : ""].join(" ")}
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.currentTarget.value)}
                    placeholder={amountCorrectionRequired ? "Explain the amount correction" : "Optional note"}
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm justify-start border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  disabled={anyMutating || saving}
                  onClick={handleSaveQueueCorrection}
                  title="Saves the grant, budget, amount, and correction note without posting or closing the queue item."
                >
                  Save Draft Classification
                </button>
                <button type="button" className="btn btn-ghost btn-sm justify-start border border-slate-200 bg-white text-rose-700 hover:bg-rose-50" disabled={anyMutating || saving || row.workflowState === "closed"} onClick={handleVoid}>
                  Void Payment
                </button>
                <button type="button" className="btn btn-ghost btn-sm justify-start border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" disabled={anyMutating || saving || row.workflowState === "open"} onClick={handleReopen}>
                  Reopen Closed Transaction
                </button>
                <button type="button" className="btn btn-ghost btn-sm justify-start border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:col-span-3" disabled={anyMutating} onClick={() => openEntryDialog("manual-cc")}>
                  Manual Entry Override
                </button>
              </div>
            </div>
          ) : null}
          {actionError ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{actionError}</div> : null}
          {actionMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{actionMessage}</div> : null}
          <div className="grid grid-cols-1 gap-2">
            <button
              className="btn btn-sm btn-primary w-full py-2.5"
              disabled={anyMutating || saving || row.workflowState === "closed"}
              onClick={handlePost}
              title="Saves this assignment, posts the transaction to the ledger, and closes the queue item."
            >
              Mark Complete & Post
            </button>
          </div>
        </div>
      )}

      {isQueue && (
        <details className="group rounded-lg border border-slate-200 bg-white" open>
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 transition hover:bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">Other Transactions on this same form</span>
            <span className="text-sm font-bold text-slate-400 transition group-open:rotate-180">v</span>
          </summary>
          <div className="border-t border-slate-100 p-3">
            {sameSubmissionQ.isLoading ? (
              <div className="text-sm text-slate-400">Loading transactions...</div>
            ) : otherTransactions.length ? (
              <div className="space-y-2">
                {otherTransactions.map((item) => (
                  <div key={String(item.id)} className="flex items-center justify-between rounded border border-transparent p-2 transition hover:border-slate-100 hover:bg-slate-50">
                    <div className="text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-900">{firstText(item.merchant, item.title, "Transaction")}</span>
                        {displayText(item.direction) === "return" ? (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Return
                          </span>
                        ) : null}
                      </div>
                      <div className="text-slate-500">
                        {[
                          queueFieldOrder(item) === Number.MAX_SAFE_INTEGER ? "" : `Order ${queueFieldOrder(item)}`,
                          fmtDateOrDash(displayText(item.dueDate || item.createdAt)),
                          displayText(item.purpose || item.expenseType),
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </div>
                    </div>
                    <div className="text-sm font-bold tabular-nums text-slate-700">
                      {fmtCurrencyUSD(Number(item.amount || 0))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No other transactions found on this form.</div>
            )}
          </div>
        </details>
      )}

      {/* Customer link */}
      {row.customerId && (
        <div className="flex flex-wrap items-center gap-2">
          <CustomerLink customerId={row.customerId} name={customerName} />
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => onOpenCustomerWorkspace(row.customerId, "details")}
          >
            Open Customer Workspace
          </button>
        </div>
      )}

      {/* Grant context */}
      {(row.grantId || row.lineItemId) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2 text-sm">
          <span className="text-slate-500 text-xs uppercase tracking-wide">Grant</span>
          <span className="font-semibold text-slate-800">{grantName}</span>
          {row.lineItemId && (
            <>
              <span className="text-slate-400">{">"}</span>
              <span className="text-slate-600">{lineItemLabel}</span>
            </>
          )}
        </div>
      )}

      <AdvancedQueueDetails
        submissionId={submissionId}
        rawMeta={row.paymentQueueItem?.rawMeta}
        queueItem={row.paymentQueueItem || null}
        ledgerEntry={(ledgerEntryQ.data as Record<string, unknown> | null) || (row.ledgerEntry as Record<string, unknown> | null)}
        pipeline={
          <>
            <DetailSection title="Payment Object & Details">
              <DetailRow label="Type" value={row.sourceLabel} />
              <DetailRow label="Date" value={fmtDateOrDash(row.date)} />
              <DetailRow label="Status" value={<StatusBadge state={row.workflowState} />} />
              {row.paymentQueueItem?.source && (
                <DetailRow label="Queue Source" value={stageLabelFromQueueSource(row.paymentQueueItem.source)} />
              )}
              {row.paymentQueueItem?.merchant && (
                <DetailRow label="Merchant" value={String(row.paymentQueueItem.merchant)} />
              )}
              {(row.paymentQueueItem?.purpose || row.paymentQueueItem?.descriptor) && (
                <DetailRow
                  label="Purpose"
                  value={String(row.paymentQueueItem.purpose || row.paymentQueueItem.descriptor || "")}
                />
              )}
              {row.paymentQueueItem?.card && (
                <DetailRow label="Card Field" value={String(row.paymentQueueItem.card)} />
              )}
              {row.paymentQueueItem?.note && isUsefulFreeText(row.paymentQueueItem.note) ? (
                <DetailRow label="Note" value={String(row.paymentQueueItem.note)} />
              ) : null}
              {customerName && (
                <DetailRow label="Customer" value={customerName} />
              )}
              <DetailRow label="Cost" value={<span className="font-bold">{fmtCents(row.amountCents)}</span>} />
            </DetailSection>

            <ProvenanceSection
              queueItem={row.paymentQueueItem || null}
              ledgerEntry={(ledgerEntryQ.data as Record<string, unknown> | null) || (row.ledgerEntry as Record<string, unknown> | null)}
              title="Pipeline Provenance"
            />
          </>
        }
      />

      {/* Reassign */}
      {!isQueue && <DetailSection title="Assign to Grant">
        <div className="space-y-2">
          <GrantSelect
            value={assignGrantId || null}
            onChange={(v) => { setAssignGrantId(String(v || "")); setAssignLineItemId(""); }}
            includeUnassigned
          />
          {assignGrantId && <GrantBudgetStrip grantId={assignGrantId} />}
          <LineItemSelect
            grantId={assignGrantId || null}
            value={assignLineItemId || null}
            onChange={(v) => setAssignLineItemId(String(v || ""))}
            inputClassName="w-full"
          />
        </div>
      </DetailSection>}

      {/* Workflow actions */}
      {!isQueue && (
        <DetailSection title="Actions">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn btn-sm col-span-2"
                disabled={anyMutating || saving || !assignGrantId || !assignLineItemId}
                onClick={handlePost}
                title={!assignGrantId || !assignLineItemId ? "Select grant and line item first" : undefined}
              >
                Allocate to Grant
              </button>
            </div>
            <div className="border-t border-slate-100 pt-2 grid grid-cols-1 gap-1.5">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Adjustments</div>
              <button
                className="btn btn-ghost btn-sm w-full text-left"
                disabled={anyMutating}
                onClick={() => openEntryDialog("reversal")}
              >
                Create Reversal
              </button>
              <button
                className="btn btn-ghost btn-sm w-full text-left"
                disabled={anyMutating}
                onClick={() => openEntryDialog("adjustment")}
              >
                Create Adjustment
              </button>
              <button
                className="btn btn-ghost btn-sm w-full text-left"
                disabled={anyMutating}
                onClick={() => openEntryDialog("manual-cc")}
              >
                Record CC Spend (manual)
              </button>
            </div>
            {!workflowTask && (
              <button
                className="btn btn-ghost btn-sm w-full"
                disabled={anyMutating}
                onClick={handleCreateTask}
              >
                Create Spend Task
              </button>
            )}
            {workflowTask && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Spend task: {String(workflowTask.title || workflowTask.id || "-")}
              </div>
            )}
          </div>
        </DetailSection>
      )}
      {entryDialogOpen && (
        <CardInvoiceEntryDialog
          open={entryDialogOpen}
          mode={entryDialogMode}
          sourceEntryId={entryDialogMode === "reversal" ? (provenanceLedgerId || undefined) : undefined}
          sourceAmountCents={entryDialogMode === "manual-cc" && row.amountCents < 0 ? undefined : row.amountCents}
          sourceGrantId={assignGrantId || row.grantId || undefined}
          sourceLineItemId={assignLineItemId || row.lineItemId || undefined}
          sourceCreditCardId={row.creditCardId || undefined}
          sourceDate={row.date || undefined}
          sourceNote={typeof row.paymentQueueItem?.note === "string" ? row.paymentQueueItem.note : undefined}
          busy={createLedger.isPending}
          onCancel={() => setEntryDialogOpen(false)}
          onSave={async (body) => {
            try {
              await createLedger.mutateAsync(body);
              toast("Ledger entry created.", { type: "success" });
              setEntryDialogOpen(false);
            } catch (e: unknown) {
              toast(toApiError(e, "Create failed.").error, { type: "error" });
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InvoiceSpendCard  (queue-invoice)
// ---------------------------------------------------------------------------

function InvoiceSpendCard({
  row,
  grantNameById,
  lineItemLookup,
  customerNameById,
  onOpenCustomerWorkspace,
}: {
  row: SpendRow;
  grantNameById: Map<string, string>;
  lineItemLookup: Map<string, { grantName: string; lineItemLabel: string }>;
  customerNameById: Map<string, string>;
  onOpenCustomerWorkspace: (customerId: string, initialTab?: "details" | "payments") => void;
}) {
  const [assignGrantId, setAssignGrantId] = React.useState(row.grantId || "");
  const [assignLineItemId, setAssignLineItemId] = React.useState(row.lineItemId || "");
  const [assignCardId, setAssignCardId] = React.useState(row.creditCardId || "");
  const [amountDraft, setAmountDraft] = React.useState(String((row.amountCents / 100).toFixed(2)));
  const [correctionReason, setCorrectionReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState("");
  const [actionMessage, setActionMessage] = React.useState("");

  const patchQueue = usePatchPaymentQueueItem();
  const postQueue = usePostPaymentQueueToLedger();
  const reopenQueue = useReopenPaymentQueueItem();
  const voidQueue = useVoidPaymentQueueItem();
  const createLedger = useCreateLedgerEntry();
  const [entryDialogOpen, setEntryDialogOpen] = React.useState(false);

  const queueId = String(row.paymentQueueItem?.id || "");
  const submissionId = String(row.paymentQueueItem?.submissionId || "");
  const provenanceLedgerId = String(row.paymentQueueItem?.ledgerEntryId || row.linkedLedgerId || "");
  const ledgerEntryQ = useLedgerEntry(provenanceLedgerId || undefined, { enabled: !!provenanceLedgerId });
  const sameSubmissionQ = usePaymentQueueItems(
    { submissionId, limit: 20 },
    { enabled: !!submissionId, staleTime: 30_000 },
  );

  React.useEffect(() => {
    setActionError("");
    setActionMessage("");
    setAdvancedOpen(false);
  }, [row.id, row.workflowState]);

  const info = lineItemLookup.get(`${row.grantId}:${row.lineItemId}`);
  const grantName = info?.grantName || grantNameById.get(row.grantId) || row.grantId || "-";
  const lineItemLabel = info?.lineItemLabel || row.lineItemId || "-";
  const customerName = customerNameById.get(row.customerId) || row.customerId || "";
  const queueItem = row.paymentQueueItem || null;

  const queueStatus = String(queueItem?.queueStatus || "pending");
  const legacyInvoiceStatus = queueItem?.invoiceStatus ? String(queueItem.invoiceStatus) : "";
  const vendor = firstText(queueString(queueItem, "merchant"), queueString(queueItem, "vendor"), row.title);
  const purchaser = firstText(queueString(queueItem, "purchaser"), queueString(queueItem, "email"));
  const paymentMethod = queueString(queueItem, "paymentMethod");
  const expenseType = queueString(queueItem, "expenseType");
  const purchasePath = queueString(queueItem, "purchasePath");
  const isCustomerPath = purchasePath === "customer" || /customer/i.test(expenseType);
  const isProgramPath = purchasePath === "program" || /program/i.test(expenseType);
  const isCreditCardInvoice = /credit card/i.test(expenseType) || /credit card/i.test(paymentMethod);
  const invoiceNote = firstUsefulText(queueString(queueItem, "note"), queueString(queueItem, "notes"));
  const project = firstText(queueString(queueItem, "project"), queueString(queueItem, "program"));
  const billTo = firstText(queueString(queueItem, "billedTo"), queueString(queueItem, "program"));
  const serviceType = firstText(queueString(queueItem, "serviceType"), queueString(queueItem, "otherService"));
  const wioaScope = firstText(queueString(queueItem, "serviceScope"), queueString(queueItem, "wex"));
  const descriptor = firstText(queueString(queueItem, "descriptor"), queueString(queueItem, "purpose"));
  const invoiceCustomerName = firstText(customerName, queueString(queueItem, "customer"));
  const receiptFiles = queueFiles(queueItem);
  const sourceUrl = jotformInboxUrl(queueItem?.formId || asObject(queueItem?.rawMeta).form_id, submissionId);
  const otherTransactions = ((sameSubmissionQ.data || []) as Array<Record<string, unknown> & { id: string }>)
    .filter((item) => String(item.id || "") !== queueId)
    .sort((a, b) => queueFieldOrder(a) - queueFieldOrder(b));
  const isSplitInvoice = otherTransactions.length > 0;
  const amountCorrectionRequired = isAmountChanged(row.amountCents, amountDraft);

  const anyMutating = patchQueue.isPending || postQueue.isPending || reopenQueue.isPending ||
    voidQueue.isPending || createLedger.isPending;

  const handleSaveAssignment = async () => {
    setActionError("");
    setActionMessage("");
    if (amountCorrectionRequired && !correctionReason.trim()) {
      setActionError("Add a correction note because the amount was changed.");
      setAdvancedOpen(true);
      return;
    }
    if (assignGrantId && !assignLineItemId) {
      setActionError("Select a budget for the chosen grant, or leave Grant as No Grant Classification.");
      return;
    }
    setSaving(true);
    try {
      await patchQueue.mutateAsync({
        id: queueId,
        body: {
          grantId: assignGrantId || null,
          lineItemId: assignGrantId ? assignLineItemId || null : null,
          creditCardId: assignCardId || null,
          okUnassigned: !assignGrantId,
          amount: Number(amountDraft || 0),
          ...(correctionReason.trim() ? { localModificationReason: correctionReason.trim() } : {}),
        },
      });
      setActionMessage("Assignment saved.");
    } catch (e: unknown) {
      setActionError(toApiError(e, "Save failed.").error);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    setActionError("");
    setActionMessage("");
    if (assignGrantId && !assignLineItemId) {
      setActionError("Select a budget for the chosen grant, or leave Grant as No Grant Classification.");
      return;
    }
    if (amountCorrectionRequired && !correctionReason.trim()) {
      setActionError("Add a correction note because the amount was changed.");
      setAdvancedOpen(true);
      return;
    }
    setSaving(true);
    try {
      await patchQueue.mutateAsync({
        id: queueId,
        body: {
          grantId: assignGrantId || null,
          lineItemId: assignGrantId ? assignLineItemId || null : null,
          creditCardId: assignCardId || null,
          okUnassigned: !assignGrantId,
          amount: Number(amountDraft || 0),
          ...(correctionReason.trim() ? { localModificationReason: correctionReason.trim() } : {}),
        },
      });
      await postQueue.mutateAsync({ id: queueId });
      setAdvancedOpen(false);
      setActionMessage("Marked complete and posted to the ledger.");
    } catch (e: unknown) {
      setActionError(toApiError(e, "Post failed.").error);
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    setActionError("");
    setActionMessage("");
    setSaving(true);
    try {
      await reopenQueue.mutateAsync({ id: queueId });
      setActionMessage("Transaction reopened.");
    } catch (e: unknown) {
      setActionError(toApiError(e, "Reopen failed.").error);
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    setActionError("");
    setActionMessage("");
    setSaving(true);
    try {
      await voidQueue.mutateAsync({ id: queueId });
      setActionMessage("Invoice item voided. It will not be posted to the ledger.");
    } catch (e: unknown) {
      setActionError(toApiError(e, "Void failed.").error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
        <div className="border-b border-amber-200 bg-amber-100/70 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-3xl font-extrabold tabular-nums tracking-tight text-amber-800">
                  {fmtCents(row.amountCents)}
                </div>
                <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                  Invoice
                </span>
                {isSplitInvoice ? (
                  <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Split
                  </span>
                ) : null}
              </div>
              <div className="mt-1 truncate text-base font-bold text-slate-950">{vendor || "Invoice"}</div>
              <div className="mt-0.5 text-xs font-medium text-slate-600">
                {[fmtDateOrDash(row.date), paymentMethod || "Payment method pending"].filter(Boolean).join(" | ")}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge state={row.workflowState} />
              <QueueLifecycleBadge status={queueStatus} />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <SummaryItem label="Purchaser" value={purchaser} />
            <SummaryItem label="Vendor / Merchant" value={vendor} />
            <SummaryItem label="Payment Method" value={paymentMethod} />
            <SummaryItem label="Expense Type" value={expenseType} />
            <SummaryItem label="Purpose" value={descriptor} />
            <SummaryItem label="Bill to Multiple Grants" value={isSplitInvoice ? "Yes" : "No"} />
            {isCreditCardInvoice ? (
              <SummaryItem label="Card Used" value={row.creditCardName || row.creditCardId || assignCardId} />
            ) : null}
            {isCustomerPath || (!isProgramPath && invoiceCustomerName) ? (
              <>
                <SummaryItem label="Customer Name" value={invoiceCustomerName} />
                <SummaryItem label="Support Services Program" value={project} />
                <SummaryItem label="Service Type" value={serviceType} />
                <SummaryItem label="WIOA Scope" value={wioaScope} />
              </>
            ) : (
              <>
                <SummaryItem label="Program Operations For" value={billTo} />
                <SummaryItem label="Project" value={project} />
                <SummaryItem label="Service Type" value={serviceType} />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-amber-200/80 pt-3 md:grid-cols-2">
            {receiptFiles.length ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Purchase Documentation</div>
                <AttachmentLinks files={receiptFiles} />
              </div>
            ) : null}
            {sourceUrl ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Source Submission</div>
                <a className="inline-flex rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 hover:underline" href={sourceUrl} target="_blank" rel="noreferrer">
                  Open in Jotform
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {invoiceNote ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Invoice Note</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{invoiceNote}</div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border-2 border-sky-100 bg-sky-50/30 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-sky-700">Assign & Post</div>
            <div className="mt-0.5 text-xs text-slate-500">Match this transaction to a grant budget, then mark it complete.</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            Advanced
          </button>
        </div>
        {row.paymentQueueItem?.localModified ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
            Local tracker edits are preserved during Jotform reconcile.
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">Grant</label>
            <GrantSelect
              value={assignGrantId || null}
              onChange={(v) => { setAssignGrantId(String(v || "")); setAssignLineItemId(""); }}
              includeUnassigned
              placeholderLabel="No Grant Classification"
            />
          </div>
          <div className="space-y-1">
            <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">Budget</label>
            <LineItemSelect
              grantId={assignGrantId || null}
              value={assignLineItemId || null}
              onChange={(v) => setAssignLineItemId(String(v || ""))}
              inputClassName="w-full"
            />
          </div>
        </div>
        {assignGrantId && <GrantBudgetStrip grantId={assignGrantId} />}
        {advancedOpen ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">Amount</label>
                <input
                  className={["input text-sm", amountCorrectionRequired && !correctionReason.trim() ? "border-amber-300 bg-amber-50" : ""].join(" ")}
                  type="number"
                  step="0.01"
                  value={amountDraft}
                  onChange={(e) => setAmountDraft(e.currentTarget.value)}
                  placeholder="Amount"
                />
              </div>
              <div className="space-y-1">
                <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">
                  Correction Note{amountCorrectionRequired ? " Required" : ""}
                </label>
                <input
                  className={["input text-sm", amountCorrectionRequired && !correctionReason.trim() ? "border-amber-300 bg-amber-50" : ""].join(" ")}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.currentTarget.value)}
                  placeholder={amountCorrectionRequired ? "Explain the amount correction" : "Optional note"}
                />
              </div>
            </div>
            {isCreditCardInvoice ? (
              <div className="mt-3 space-y-1">
                <label className="px-1 text-[11px] font-semibold uppercase text-slate-500">Credit Card</label>
                <CreditCardSelect
                  value={assignCardId || null}
                  onChange={(v) => setAssignCardId(String(v || ""))}
                  includeUnassigned
                  inputClassName="w-full"
                />
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <button
                type="button"
                className="btn btn-ghost btn-sm justify-start border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                disabled={anyMutating || saving}
                onClick={handleSaveAssignment}
                title="Saves the grant, budget, card, amount, and correction note without posting or closing the queue item."
              >
                Save Draft Classification
              </button>
              <button type="button" className="btn btn-ghost btn-sm justify-start border border-slate-200 bg-white text-rose-700 hover:bg-rose-50" disabled={anyMutating || saving || row.workflowState === "closed"} onClick={handleVoid}>
                Void Payment
              </button>
              <button type="button" className="btn btn-ghost btn-sm justify-start border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" disabled={anyMutating || saving || row.workflowState === "open"} onClick={handleReopen}>
                Reopen Closed Transaction
              </button>
              <button type="button" className="btn btn-ghost btn-sm justify-start border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:col-span-3" disabled={anyMutating} onClick={() => setEntryDialogOpen(true)}>
                Manual Entry Override
              </button>
            </div>
          </div>
        ) : null}
        {actionError ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{actionError}</div> : null}
        {actionMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{actionMessage}</div> : null}
        <div className="grid grid-cols-1 gap-2">
          <button
            className="btn btn-sm btn-primary w-full py-2.5"
            disabled={anyMutating || saving || row.workflowState === "closed"}
            onClick={handlePost}
            title="Saves this assignment, posts the invoice to the ledger, and closes the queue item."
          >
            Mark Complete & Post
          </button>
        </div>
      </div>

      <details className="group rounded-lg border border-slate-200 bg-white" open>
        <summary className="flex cursor-pointer list-none items-center justify-between p-3 transition hover:bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">Other Transactions on this same form</span>
          <span className="text-sm font-bold text-slate-400 transition group-open:rotate-180">v</span>
        </summary>
        <div className="border-t border-slate-100 p-3">
          {sameSubmissionQ.isLoading ? (
            <div className="text-sm text-slate-400">Loading transactions...</div>
          ) : otherTransactions.length ? (
            <div className="space-y-2">
              {otherTransactions.map((item) => (
                <div key={String(item.id)} className="flex items-center justify-between rounded border border-transparent p-2 transition hover:border-slate-100 hover:bg-slate-50">
                  <div className="text-xs">
                    <div className="font-bold text-slate-900">{firstText(item.merchant, item.vendor, item.program, item.billedTo, "Transaction")}</div>
                    <div className="text-slate-500">
                      {[
                        queueFieldOrder(item) === Number.MAX_SAFE_INTEGER ? "" : `Order ${queueFieldOrder(item)}`,
                        fmtDateOrDash(displayText(item.dueDate || item.createdAt)),
                        displayText(item.expenseType || item.paymentMethod),
                      ].filter(Boolean).join(" | ")}
                    </div>
                  </div>
                  <div className="text-sm font-bold tabular-nums text-slate-700">{fmtCurrencyUSD(Number(item.amount || 0))}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">No other transactions found on this form.</div>
          )}
        </div>
      </details>

      {row.customerId && (
        <div className="flex flex-wrap items-center gap-2">
          <CustomerLink customerId={row.customerId} name={customerName} />
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => onOpenCustomerWorkspace(row.customerId, "details")}
          >
            Open Customer Workspace
          </button>
        </div>
      )}

      <AdvancedQueueDetails
        submissionId={submissionId}
        rawMeta={row.paymentQueueItem?.rawMeta}
        queueItem={queueItem}
        ledgerEntry={(ledgerEntryQ.data as Record<string, unknown> | null) || null}
        pipeline={
          <>
            <DetailSection title="Payment Object & Details">
              <DetailRow label="Form" value={String(queueItem?.formTitle || queueItem?.formAlias || "-")} />
              <DetailRow label="Date" value={fmtDateOrDash(row.date)} />
              <DetailRow label="Status" value={<StatusBadge state={row.workflowState} />} />
              <DetailRow label="Queue Status" value={<QueueLifecycleBadge status={queueStatus} />} />
              <DetailRow label="Queue Source" value={stageLabelFromQueueSource(queueItem?.source)} />
              <DetailRow label="Purchaser" value={purchaser || "-"} />
              <DetailRow label="Vendor / Merchant" value={vendor || "-"} />
              <DetailRow label="Payment Method" value={paymentMethod || "-"} />
              <DetailRow label="Expense Type" value={expenseType || "-"} />
              <DetailRow label="Purpose" value={descriptor || "-"} />
              <DetailRow label={isCustomerPath ? "Customer Name" : "Program Operations For"} value={(isCustomerPath ? invoiceCustomerName : billTo) || "-"} />
              <DetailRow label="Grant" value={grantName} />
              <DetailRow label="Budget" value={lineItemLabel} />
              {invoiceNote ? <DetailRow label="Note" value={invoiceNote} /> : null}
              {legacyInvoiceStatus ? (
                <DetailRow label="Legacy Invoice Status" value={legacyInvoiceStatus} />
              ) : null}
              {sourceUrl ? (
                <DetailRow label="Source Browser" value={<a className="text-sky-600 hover:underline" href={sourceUrl} target="_blank" rel="noreferrer">Open in Jotform</a>} />
              ) : null}
            </DetailSection>
            <ProvenanceSection
              queueItem={queueItem}
              ledgerEntry={(ledgerEntryQ.data as Record<string, unknown> | null) || null}
              title="Pipeline Provenance"
            />
          </>
        }
      />

      {false ? (
      <>
      {/* Actions */}
      <DetailSection title="Actions">
        <div className="space-y-2">
          {row.paymentQueueItem?.localModified ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Local tracker edits are preserved during Jotform reconcile.
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn btn-sm"
              disabled={anyMutating || saving || row.workflowState === "closed"}
              onClick={handlePost}
            >
              Invoice Submitted
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={anyMutating || saving || row.workflowState === "open"}
              onClick={handleReopen}
            >
              Reopen
            </button>
            <button
              className="btn btn-ghost btn-sm text-rose-700 col-span-2"
              disabled={anyMutating || saving || row.workflowState === "closed"}
              onClick={async () => {
                setSaving(true);
                try {
                  await voidQueue.mutateAsync({ id: queueId });
                  toast("Voided.", { type: "success" });
                } catch (e: unknown) {
                  toast(toApiError(e, "Void failed.").error, { type: "error" });
                } finally {
                  setSaving(false);
                }
              }}
              title="Void — this item will not be posted to ledger"
            >
              Void Item
            </button>
          </div>
          <div className="border-t border-slate-100 pt-2 grid grid-cols-1 gap-1.5">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Manual Entry</div>
            <button
              className="btn btn-ghost btn-sm w-full text-left"
              disabled={anyMutating}
              onClick={() => setEntryDialogOpen(true)}
            >
              Record Invoice Payment (manual)
            </button>
          </div>
        </div>
      </DetailSection>
      </>
      ) : null}

      {entryDialogOpen && (
        <CardInvoiceEntryDialog
          open={entryDialogOpen}
          mode="manual-invoice"
          sourceAmountCents={row.amountCents}
          sourceGrantId={assignGrantId || row.grantId || undefined}
          sourceLineItemId={assignLineItemId || row.lineItemId || undefined}
          sourceCreditCardId={assignCardId || row.creditCardId || undefined}
          sourceDate={row.date || undefined}
          sourceCustomerId={row.customerId || undefined}
          busy={createLedger.isPending}
          onCancel={() => setEntryDialogOpen(false)}
          onSave={async (body) => {
            try {
              await createLedger.mutateAsync(body);
              toast("Invoice ledger entry created.", { type: "success" });
              setEntryDialogOpen(false);
            } catch (e: unknown) {
              toast(toApiError(e, "Create failed.").error, { type: "error" });
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpendDetailModal — router + Modal wrapper
// ---------------------------------------------------------------------------

export function SpendDetailModal({
  row,
  isOpen,
  onClose,
  grantNameById,
  lineItemLookup,
  customerNameById,
  cardBudget,
  workflowTask,
}: ModalProps) {
  const [customerWorkspace, setCustomerWorkspace] = React.useState<{
    customerId: string;
    initialTab: "details" | "payments";
  } | null>(null);
  const [childModalOpen, setChildModalOpen] = React.useState(false);
  const handleChildModalOpenChange = React.useCallback((open: boolean) => {
    setChildModalOpen(open);
  }, []);

  if (!row) return null;

  const isEnrollment = row.kind === "grant-ledger" || row.kind === "queue-projection";
  const isCard = row.kind === "card-ledger" || row.kind === "queue-credit-card";
  const isInvoice = row.kind === "queue-invoice";

  const titleMap: Record<SpendRowKind, string> = {
    "grant-ledger": "Posted Payment",
    "queue-projection": "Projected Payment",
    "card-ledger": "Card Spend",
    "queue-credit-card": "Card Queue Item",
    "queue-invoice": "Invoice Queue Item",
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        title={
          <div className="flex items-center gap-2">
            <span>{titleMap[row.kind]}</span>
            <span className="text-sm font-normal text-slate-500">{fmtCents(row.amountCents)}</span>
          </div>
        }
        onClose={onClose}
        disableEscClose={!!customerWorkspace || childModalOpen}
        widthClass="max-w-2xl"
        footer={
          <div className="flex justify-end">
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        }
      >
        <div>
          {isEnrollment && (
            <EnrollmentSpendCard
              row={row}
              grantNameById={grantNameById}
              lineItemLookup={lineItemLookup}
              customerNameById={customerNameById}
              onOpenCustomerPayments={(customerId) => setCustomerWorkspace({ customerId, initialTab: "payments" })}
              onChildModalOpenChange={handleChildModalOpenChange}
            />
          )}
          {isCard && (
            <CardSpendCard
              row={row}
              grantNameById={grantNameById}
              lineItemLookup={lineItemLookup}
              customerNameById={customerNameById}
              cardBudget={cardBudget}
              workflowTask={workflowTask}
              onOpenCustomerWorkspace={(customerId, initialTab = "details") => setCustomerWorkspace({ customerId, initialTab })}
            />
          )}
          {isInvoice && (
            <InvoiceSpendCard
              row={row}
              grantNameById={grantNameById}
              lineItemLookup={lineItemLookup}
              customerNameById={customerNameById}
              onOpenCustomerWorkspace={(customerId, initialTab = "details") => setCustomerWorkspace({ customerId, initialTab })}
            />
          )}
        </div>
      </Modal>

      {customerWorkspace ? (
        <CustomerWorkspaceModal
          customerId={customerWorkspace.customerId}
          initialTab={customerWorkspace.initialTab}
          onClose={() => setCustomerWorkspace(null)}
        />
      ) : null}
    </>
  );
}
