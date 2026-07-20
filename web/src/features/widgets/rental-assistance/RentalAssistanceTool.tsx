import React from "react";
import { createPortal } from "react-dom";
import { parseGrantMaxAssistanceMonths } from "@hdb/contracts";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { safeISODate10 } from "@lib/date";
import { toast } from "@lib/toast";
import { Pagination, usePagination } from "@entities/ui/dashboardStyle/Pagination";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { Modal } from "@entities/ui/Modal";
import { useAdminEnrollmentsData } from "@entities/Page/dashboardStyle/hooks/useAdminEnrollmentsData";
import CustomerWorkspaceModal from "@features/customers/CustomerWorkspaceModal";
import GrantWorkspaceModal from "@features/grants/GrantWorkspaceModal";
import { computeRentCertDues, addMonthsISO, todayISO } from "@features/customers/components/paymentScheduleUtils";
import { useEnrollmentsPatch } from "@hooks/useEnrollments";
import { usePaymentRentCert, usePaymentsProjectionsAdjust } from "@hooks/usePayments";
import { SortableHeader, sortRows, useTableSort } from "@hooks/useTableSort";
import type { ReqOf } from "@types";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { assistanceUsage, linkedEnrollmentIds } from "./rentalAssistanceModel";

export type RentalAssistanceFilterState = {
  status: "active" | "inactive" | "all";
  query: string;
  caseManagerId: string;
  grantIds: string[];
  rentCert: "all" | "due" | "missing";
  maxRemaining: "all" | "threeOrLess" | "exhausted";
};

type RentalAssistanceRow = {
  id: string;
  enrollment: Record<string, unknown>;
  assistancePayments: RentalPaymentRef[];
  customerName: string;
  caseManagerId: string;
  caseManagerName: string;
  grantName: string;
  customerId: string;
  grantId: string;
  assistanceStartDate: string;
  monthsOfAssistance: number | null;
  assistanceEndDate: string;
  nextRentCertDue: string;
  nextRentCertTargetDate: string;
  nextRentCertPaymentId: string;
  totalAssistance: number;
  maxAssistanceMonths: number | null;
  maxAssistanceCutoffDate: string;
  maxAssistanceMonthsRemaining: number | null;
  activeThisMonth: boolean;
};

type RentalPaymentRef = {
  id: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  lineItemId: string;
  type: string;
  note?: unknown;
  vendor?: unknown;
  comment?: unknown;
  rentCert?: { dueDate?: string; targetPaymentDate?: string; source?: string } | null;
};

type CaseManagerOption = {
  id: string;
  label: string;
};

type GrantOption = { id: string; label: string };

const RENTAL_ASSISTANCE_TAG = "rental-assistance";
const RENTAL_PAYMENT_TYPES = new Set(["monthly", "rent", "prorated", "arrears"]);

function rentalAssistanceStatus(filterState: RentalAssistanceFilterState) {
  const saved = (filterState as RentalAssistanceFilterState & { activeOnly?: boolean }).activeOnly;
  return filterState.status || (saved === false ? "all" : "active");
}

function isoMonth(value: unknown): string {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(0, 7) : "";
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : "";
}

function isDeletedEnrollment(row: Record<string, unknown>) {
  const status = String(row.status || "").toLowerCase();
  return row.deleted === true || status === "deleted";
}

function hasRentalAssistanceTag(grant: Record<string, unknown> | undefined): boolean {
  const tags = Array.isArray(grant?.tags) ? grant.tags : [];
  if (tags.some((tag) => String(tag || "").trim().toLowerCase() === RENTAL_ASSISTANCE_TAG)) return true;
  const pins = grant?.pins && typeof grant.pins === "object" ? grant.pins as Record<string, unknown> : {};
  const rentalPin = pins.rentalAssistance && typeof pins.rentalAssistance === "object"
    ? pins.rentalAssistance as Record<string, unknown>
    : null;
  return rentalPin?.enabled === true;
}

function paymentIsRentalAssistance(payment: Record<string, unknown>) {
  const type = String(payment.type || payment.paymentType || "").trim().toLowerCase();
  if (RENTAL_PAYMENT_TYPES.has(type)) return true;
  const text = [
    payment.note,
    payment.comment,
    payment.vendor,
    payment.label,
  ].flat().join(" ").toLowerCase();
  return text.includes("rent") || text.includes("rental");
}

function paymentAmount(payment: Record<string, unknown>) {
  const amount = Number(payment.amount || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function paymentId(payment: Record<string, unknown>) {
  return String(payment.id || "").trim();
}

function toRentalPaymentRef(payment: Record<string, unknown>): RentalPaymentRef | null {
  const id = paymentId(payment);
  const dueDate = safeISODate10(payment.dueDate || payment.date);
  const amount = paymentAmount(payment);
  if (!id || !dueDate || amount <= 0) return null;
  return {
    id,
    dueDate,
    amount,
    paid: payment.paid === true,
    lineItemId: String(payment.lineItemId || "").trim(),
    type: String(payment.type || payment.paymentType || "monthly").trim().toLowerCase(),
    note: payment.note,
    vendor: payment.vendor,
    comment: payment.comment,
    rentCert: payment.rentCert && typeof payment.rentCert === "object" ? payment.rentCert as RentalPaymentRef["rentCert"] : null,
  };
}

function firstUnpaidPayment(payments: RentalPaymentRef[]) {
  return payments.filter((payment) => !payment.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;
}

function lastUnpaidPayment(payments: RentalPaymentRef[]) {
  return payments.filter((payment) => !payment.paid).sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0] || null;
}

function unpaidAfter(payments: RentalPaymentRef[], cutoffDate: string) {
  return payments.filter((payment) => !payment.paid && payment.dueDate > cutoffDate);
}

function maxMonthsFrom(grant: Record<string, unknown> | undefined, enrollment: Record<string, unknown>) {
  return (
    parseGrantMaxAssistanceMonths(enrollment.maxAssistanceMonthsAtEnrollment) ??
    parseGrantMaxAssistanceMonths(grant?.maxAssistanceMonths) ??
    parseGrantMaxAssistanceMonths(grant?.lengthOfAssistance) ??
    parseGrantMaxAssistanceMonths(grant?.maxLengthOfAssistance) ??
    parseGrantMaxAssistanceMonths(grant?.maximumLengthOfAssistance)
  );
}

function useRentalAssistanceRows(filterState: RentalAssistanceFilterState) {
  const {
    enrollments,
    grants,
    customers,
    customerNameById,
    grantNameById,
    sharedDataLoading,
    sharedDataError,
    isTruncated,
  } = useAdminEnrollmentsData();
  const month = currentMonthKey();

  const grantsById = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const grant of grants as Array<Record<string, unknown>>) {
      const id = String(grant.id || "").trim();
      if (id) map.set(id, grant);
    }
    return map;
  }, [grants]);

  const customersById = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const customer of customers as Array<Record<string, unknown>>) {
      const id = String(customer.id || "").trim();
      if (id) map.set(id, customer);
    }
    return map;
  }, [customers]);

  const caseManagerOptions = React.useMemo<CaseManagerOption[]>(() => {
    const map = new Map<string, string>();
    for (const customer of customers as Array<Record<string, unknown>>) {
      const id = String(customer.caseManagerId || "").trim();
      if (!id) continue;
      map.set(id, String(customer.caseManagerName || id));
    }
    for (const enrollment of enrollments as Array<Record<string, unknown>>) {
      const id = String(enrollment.caseManagerId || "").trim();
      if (!id) continue;
      map.set(id, String(enrollment.caseManagerName || id));
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [customers, enrollments]);

  const status = rentalAssistanceStatus(filterState);

  const grantOptions = React.useMemo<GrantOption[]>(() => (
    (grants as Array<Record<string, unknown>>)
      .filter((grant) => hasRentalAssistanceTag(grant))
      .map((grant) => ({ id: String(grant.id || ""), label: String(grant.name || grant.id || "Unnamed grant") }))
      .filter((grant) => grant.id)
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [grants]);

  const continuumIdsByEnrollment = React.useMemo(
    () => linkedEnrollmentIds(enrollments as Array<Record<string, unknown>>),
    [enrollments],
  );

  const enrollmentById = React.useMemo(() => new Map(
    (enrollments as Array<Record<string, unknown>>).map((enrollment) => [String(enrollment.id || ""), enrollment]),
  ), [enrollments]);

  const rows = React.useMemo<RentalAssistanceRow[]>(() => {
    const query = filterState.query.trim().toLowerCase();
    const output: RentalAssistanceRow[] = [];

    for (const enrollment of enrollments as Array<Record<string, unknown>>) {
      if (isDeletedEnrollment(enrollment)) continue;
      const grantId = String(enrollment.grantId || "").trim();
      const grant = grantsById.get(grantId);
      if (!hasRentalAssistanceTag(grant)) continue;
      const selectedGrantIds = Array.isArray(filterState.grantIds) ? filterState.grantIds : [];
      if (selectedGrantIds.length && !selectedGrantIds.includes(grantId)) continue;

      const payments = Array.isArray(enrollment.payments)
        ? enrollment.payments.filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && !Array.isArray(raw))
        : [];
      const assistancePaymentRows = payments.filter((payment) => {
        if (payment.void === true) return false;
        if (paymentAmount(payment) <= 0) return false;
        return paymentIsRentalAssistance(payment);
      });
      const assistancePayments = assistancePaymentRows
        .map(toRentalPaymentRef)
        .filter((payment): payment is RentalPaymentRef => payment !== null);
      if (!assistancePayments.length) continue;

      const paymentDates = assistancePayments
        .map((payment) => String(payment.dueDate || "").slice(0, 10))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();
      const activeThisMonth = assistancePayments.some((payment) => isoMonth(payment.dueDate) === month);
      if (status === "active" && !activeThisMonth) continue;
      if (status === "inactive" && activeThisMonth) continue;

      const customerId = String(enrollment.customerId || enrollment.clientId || "").trim();
      const customer = customersById.get(customerId);
      const caseManagerId = String(enrollment.caseManagerId || customer?.caseManagerId || "").trim();
      const caseManagerName = String(enrollment.caseManagerName || customer?.caseManagerName || caseManagerId || "Unassigned");
      if (filterState.caseManagerId !== "all" && (caseManagerId || "unassigned") !== filterState.caseManagerId) continue;

      const customerName =
        customerNameById.get(customerId) ||
        String(enrollment.customerName || enrollment.clientName || customerId || "-");
      const grantName = grantNameById.get(grantId) || String(grant?.name || enrollment.grantName || grantId || "-");
      const totalAssistance = assistancePayments.reduce((sum, payment) => sum + payment.amount, 0);
      // computeRentCertDues is persisted-first: any payment.rentCert (including
      // an optimistic patch from the add/toggle mutations) wins over the
      // legacy every-3-months heuristic, so a cert added here stays visible.
      const nextRentCertEvent = computeRentCertDues(assistancePaymentRows, {
        enrollmentId: String(enrollment.id || ""),
        enrollmentLabel: grantName,
      })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .find((due) => due.targetPaymentDate >= todayISO()) || null;
      const nextRentCertPayment =
        (nextRentCertEvent?.paymentId
          ? assistancePayments.find((payment) => payment.id === nextRentCertEvent.paymentId)
          : assistancePayments.find((payment) => payment.dueDate === nextRentCertEvent?.targetPaymentDate)) || null;
      const nextRentCertDue = String(nextRentCertEvent?.dueDate || nextRentCertPayment?.rentCert?.dueDate || "");
      const maxAssistanceMonths = maxMonthsFrom(grant, enrollment);
      const continuumPayments = (continuumIdsByEnrollment.get(String(enrollment.id || "")) || [])
        .flatMap((id) => {
          const linked = enrollmentById.get(id);
          return Array.isArray(linked?.payments) ? linked.payments : [];
        })
        .filter((payment): payment is Record<string, unknown> => !!payment && typeof payment === "object" && !Array.isArray(payment))
        .filter((payment) => payment.void !== true && paymentAmount(payment) > 0 && paymentIsRentalAssistance(payment))
        .map(toRentalPaymentRef)
        .filter((payment): payment is RentalPaymentRef => payment !== null);
      const usage = assistanceUsage(continuumPayments, maxAssistanceMonths, todayISO());
      const assistanceStartDate = usage.startDate || paymentDates[0] || "";
      const monthsOfAssistance = usage.monthsUsed || (assistanceStartDate ? 0 : null);
      const maxAssistanceCutoffDate = usage.cutoff;
      const remaining = usage.remaining;

      const rentCertFilter = filterState.rentCert || "all";
      if (rentCertFilter === "due" && !nextRentCertDue) continue;
      if (rentCertFilter === "missing" && nextRentCertDue) continue;
      const remainingFilter = filterState.maxRemaining || "all";
      if (remainingFilter === "exhausted" && remaining !== 0) continue;
      if (remainingFilter === "threeOrLess" && (remaining == null || remaining > 3)) continue;

      const searchText = `${customerName} ${caseManagerName} ${grantName}`.toLowerCase();
      if (query && !searchText.includes(query)) continue;

      output.push({
        id: String(enrollment.id || `${grantId}:${customerId}`),
        enrollment,
        assistancePayments,
        customerName,
        caseManagerId: caseManagerId || "unassigned",
        caseManagerName,
        grantName,
        customerId,
        grantId,
        assistanceStartDate,
        monthsOfAssistance,
        assistanceEndDate: paymentDates[paymentDates.length - 1] || "",
        nextRentCertDue,
        nextRentCertTargetDate: nextRentCertPayment?.dueDate || nextRentCertEvent?.targetPaymentDate || "",
        nextRentCertPaymentId: nextRentCertPayment?.id || "",
        totalAssistance,
        maxAssistanceMonths,
        maxAssistanceCutoffDate,
        maxAssistanceMonthsRemaining: remaining,
        activeThisMonth,
      });
    }

    output.sort((a, b) => a.customerName.localeCompare(b.customerName) || a.grantName.localeCompare(b.grantName));
    return output;
  }, [
    customersById,
    customerNameById,
    enrollments,
    filterState.caseManagerId,
    filterState.grantIds,
    filterState.maxRemaining,
    filterState.query,
    filterState.rentCert,
    grantNameById,
    grantsById,
    continuumIdsByEnrollment,
    enrollmentById,
    month,
    status,
  ]);

  return {
    rows,
    caseManagerOptions,
    grantOptions,
    sharedDataLoading,
    sharedDataError,
    isTruncated,
  };
}

export const RentalAssistanceTopbar: DashboardToolDefinition<RentalAssistanceFilterState, null>["ToolTopbar"] = ({
  value,
  onChange,
}) => {
  const { rows, caseManagerOptions, grantOptions } = useRentalAssistanceRows(value);
  const selectedStatus = rentalAssistanceStatus(value);
  const selectedGrantIds = Array.isArray(value.grantIds) ? value.grantIds : [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white text-xs">
        {(["active", "inactive", "all"] as const).map((status) => (
          <button
            key={status}
            type="button"
            className={[
              "px-3 py-1.5 capitalize",
              selectedStatus === status ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
            ].join(" ")}
            onClick={() => onChange({ ...value, status })}
          >
            {status}
          </button>
        ))}
      </div>
      <select
        className="input"
        value={value.caseManagerId}
        onChange={(e) => onChange({ ...value, caseManagerId: e.currentTarget.value })}
        aria-label="Case manager filter"
      >
        <option value="all">All Case Managers</option>
        {caseManagerOptions.map((cm) => (
          <option key={cm.id} value={cm.id}>{cm.label}</option>
        ))}
      </select>
      <details className="relative">
        <summary className="input cursor-pointer list-none whitespace-nowrap">
          {selectedGrantIds.length ? `${selectedGrantIds.length} grant${selectedGrantIds.length === 1 ? "" : "s"}` : "All Grants"}
        </summary>
        <div className="absolute left-0 z-30 mt-1 max-h-72 min-w-72 overflow-auto rounded-md border border-slate-200 bg-white p-2 shadow-xl">
          <button type="button" className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-sky-700 hover:bg-sky-50" onClick={() => onChange({ ...value, grantIds: [] })}>
            Select all grants
          </button>
          {grantOptions.map((grant) => (
            <label key={grant.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedGrantIds.includes(grant.id)}
                onChange={() => onChange({
                  ...value,
                  grantIds: selectedGrantIds.includes(grant.id)
                    ? selectedGrantIds.filter((id) => id !== grant.id)
                    : [...selectedGrantIds, grant.id],
                })}
              />
              <span>{grant.label}</span>
            </label>
          ))}
        </div>
      </details>
      <select className="input" value={value.rentCert || "all"} onChange={(e) => onChange({ ...value, rentCert: e.currentTarget.value as RentalAssistanceFilterState["rentCert"] })} aria-label="Rent certification filter">
        <option value="all">All Rent Certs</option>
        <option value="due">Upcoming Rent Cert</option>
        <option value="missing">No Upcoming Rent Cert</option>
      </select>
      <select className="input" value={value.maxRemaining || "all"} onChange={(e) => onChange({ ...value, maxRemaining: e.currentTarget.value as RentalAssistanceFilterState["maxRemaining"] })} aria-label="Maximum assistance remaining filter">
        <option value="all">Any Assistance Limit</option>
        <option value="threeOrLess">3 Months or Less</option>
        <option value="exhausted">Limit Exhausted</option>
      </select>
      <input
        className="input w-56"
        placeholder="Search customers, grants..."
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.currentTarget.value })}
      />
      <SmartExportButton
        allRows={rows}
        activeRows={rows}
        filenameBase="rental-assistance"
        columns={[
          { key: "customerName", label: "Customer", value: (r: RentalAssistanceRow) => r.customerName },
          { key: "caseManagerName", label: "Case Manager", value: (r: RentalAssistanceRow) => r.caseManagerName },
          { key: "grantName", label: "Grant", value: (r: RentalAssistanceRow) => r.grantName },
          { key: "assistanceStartDate", label: "Assistance Start", value: (r: RentalAssistanceRow) => r.assistanceStartDate },
          { key: "monthsOfAssistance", label: "Months of Assistance", value: (r: RentalAssistanceRow) => r.monthsOfAssistance ?? "" },
          { key: "assistanceEndDate", label: "Assistance End", value: (r: RentalAssistanceRow) => r.assistanceEndDate },
          { key: "nextRentCertDue", label: "Next Rent Cert Due", value: (r: RentalAssistanceRow) => r.nextRentCertDue },
          { key: "totalAssistance", label: "Total Allocated", value: (r: RentalAssistanceRow) => r.totalAssistance },
          { key: "maxAssistanceMonthsRemaining", label: "Max Months Remaining", value: (r: RentalAssistanceRow) => r.maxAssistanceMonthsRemaining ?? "" },
          { key: "maxAssistanceCutoffDate", label: "Hard Cutoff", value: (r: RentalAssistanceRow) => r.maxAssistanceCutoffDate },
        ]}
      />
    </div>
  );
};

type RowActionKind = "start" | "end" | "closeFuture" | "rentCert";

type RowActionState = {
  kind: RowActionKind;
  row: RentalAssistanceRow;
} | null;

function RentalRowContextMenu({
  row,
  position,
  onClose,
  onOpenPaymentSchedule,
  onAction,
}: {
  row: RentalAssistanceRow | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onOpenPaymentSchedule: (row: RentalAssistanceRow) => void;
  onAction: (kind: RowActionKind, row: RentalAssistanceRow) => void;
}) {
  React.useEffect(() => {
    if (!row || !position) return;
    const close = () => onClose();
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose, position, row]);

  if (!row || !position || typeof document === "undefined") return null;

  const items: Array<{ key: string; label: string; onSelect: () => void; danger?: boolean }> = [
    { key: "open", label: "Open Payment Schedule", onSelect: () => onOpenPaymentSchedule(row) },
    { key: "start", label: "Adjust Start Date", onSelect: () => onAction("start", row) },
    { key: "end", label: "Adjust End Date", onSelect: () => onAction("end", row) },
    { key: "closeFuture", label: "Close Future Payments", danger: true, onSelect: () => onAction("closeFuture", row) },
    { key: "rentCert", label: "Add Rent Cert", onSelect: () => onAction("rentCert", row) },
  ];

  const menu = (
    <div
      className="fixed z-[1300] w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
      style={{
        left: Math.min(position.x, Math.max(8, window.innerWidth - 264)),
        top: Math.min(position.y, Math.max(8, window.innerHeight - 228)),
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="truncate text-sm font-semibold text-slate-900">{row.customerName}</div>
        <div className="truncate text-xs text-slate-500">{row.grantName}</div>
      </div>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={[
            "block w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
            item.danger ? "text-red-700" : "text-slate-700",
          ].join(" ")}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}

function RentalRowActionDialog({
  state,
  busy,
  onCancel,
  onConfirmDate,
  onConfirmRentCert,
}: {
  state: RowActionState;
  busy: boolean;
  onCancel: () => void;
  onConfirmDate: (date: string) => void;
  onConfirmRentCert: (values: {
    dueDate: string;
    paymentId: string;
    bucket: "task" | "compliance";
    title: string;
    supersede: boolean;
  }) => void;
}) {
  const row = state?.row || null;
  const kind = state?.kind || null;
  const sortedPayments = React.useMemo(
    () => (row ? row.assistancePayments.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)) : []),
    [row],
  );
  const nextPayment = React.useMemo(() => {
    if (!row) return null;
    return firstUnpaidPayment(row.assistancePayments) || row.assistancePayments[0] || null;
  }, [row]);

  const defaultDate =
    kind === "start"
      ? row?.assistanceStartDate || nextPayment?.dueDate || todayISO()
      : kind === "end" || kind === "closeFuture"
      ? row?.assistanceEndDate || nextPayment?.dueDate || todayISO()
      : nextPayment?.dueDate
      ? addMonthsISO(nextPayment.dueDate, -1)
      : todayISO();
  const defaultTargetId = nextPayment?.id || "";

  const [date, setDate] = React.useState(defaultDate);
  const [dueDate, setDueDate] = React.useState(defaultDate);
  const [targetPaymentId, setTargetPaymentId] = React.useState(defaultTargetId);
  const [bucket, setBucket] = React.useState<"task" | "compliance">("compliance");
  const [title, setTitle] = React.useState("");
  const [supersede, setSupersede] = React.useState(false);

  React.useEffect(() => {
    setDate(defaultDate);
    setDueDate(defaultDate);
    setTargetPaymentId(defaultTargetId);
    setBucket("compliance");
    setTitle("");
    setSupersede(false);
  }, [defaultDate, defaultTargetId, state]);

  if (!state || !row || !kind) return null;

  const titleText =
    kind === "start"
      ? "Adjust Start Date"
      : kind === "end"
      ? "Adjust End Date"
      : kind === "closeFuture"
      ? "Close Future Payments"
      : "Add Rent Cert";

  const confirmLabel =
    kind === "closeFuture"
      ? "Close payments"
      : kind === "rentCert"
      ? "Add rent cert"
      : "Save date";

  return (
    <Modal
      isOpen
      title={titleText}
      onClose={onCancel}
      widthClass="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={kind === "closeFuture" ? "btn btn-sm bg-red-600 text-white hover:bg-red-700" : "btn btn-sm"}
            disabled={busy}
            onClick={() => {
              if (kind === "rentCert") onConfirmRentCert({ dueDate, paymentId: targetPaymentId, bucket, title, supersede });
              else onConfirmDate(date);
            }}
          >
            {busy ? "Saving..." : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div>
          <div className="font-semibold text-slate-900">{row.customerName}</div>
          <div className="text-xs text-slate-500">{row.grantName}</div>
        </div>

        {kind === "rentCert" ? (
          <>
            <label className="field">
              <span className="label">Target payment</span>
              <select
                className="input"
                value={targetPaymentId}
                onChange={(event) => {
                  const id = event.currentTarget.value;
                  setTargetPaymentId(id);
                  const payment = sortedPayments.find((p) => p.id === id);
                  if (payment?.dueDate) setDueDate(addMonthsISO(payment.dueDate, -1));
                }}
              >
                <option value="">-- Select payment --</option>
                {sortedPayments.map((payment) => (
                  <option key={payment.id} value={payment.id}>
                    {payment.dueDate} · {fmtCurrencyUSD(payment.amount)}{payment.paid ? " (paid)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Rent cert due date</span>
              <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.currentTarget.value)} />
            </label>
            <label className="field">
              <span className="label">Bucket</span>
              <select className="input" value={bucket} onChange={(event) => setBucket(event.currentTarget.value as "task" | "compliance")}>
                <option value="compliance">Compliance</option>
                <option value="task">Task</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Title</span>
              <input
                className="input"
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="Default: {month} rent cert due {date}"
              />
            </label>
            <label className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={supersede}
                onChange={(event) => setSupersede(event.currentTarget.checked)}
              />
              <span>
                Mark older open rent certs on this enrollment completed. Leave unchecked to keep them —
                the report always shows the soonest due open cert.
              </span>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span className="label">{kind === "closeFuture" ? "Close after" : "New date"}</span>
              <input className="input" type="date" value={date} onChange={(event) => setDate(event.currentTarget.value)} />
            </label>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {kind === "start"
                ? "Updates the first unpaid rental-assistance payment row."
                : kind === "end"
                ? "Updates the last unpaid rental-assistance payment row."
                : "Deletes unpaid rental-assistance payment rows after this date. Paid rows are preserved."}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export const RentalAssistanceMain: DashboardToolDefinition<RentalAssistanceFilterState, null>["Main"] = ({
  filterState,
}) => {
  const { rows, sharedDataLoading, sharedDataError, isTruncated } = useRentalAssistanceRows(filterState);
  const [customerWorkspace, setCustomerWorkspace] = React.useState<string | null>(null);
  const [grantWorkspace, setGrantWorkspace] = React.useState<string | null>(null);
  const [contextRow, setContextRow] = React.useState<RentalAssistanceRow | null>(null);
  const [contextPosition, setContextPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [rowAction, setRowAction] = React.useState<RowActionState>(null);
  const enrollmentPatch = useEnrollmentsPatch();
  const paymentAdjust = usePaymentsProjectionsAdjust();
  const rentCertMutation = usePaymentRentCert();
  const { sort, onSort } = useTableSort({ col: "customerName", dir: "asc" });
  const anyActionBusy = enrollmentPatch.isPending || paymentAdjust.isPending || rentCertMutation.isPending;
  const sortedRows = React.useMemo(
    () =>
      sortRows(rows, sort, (row, col) => {
        if (col === "customerName") return row.customerName;
        if (col === "caseManagerName") return row.caseManagerName;
        if (col === "grantName") return row.grantName;
        if (col === "assistanceStartDate") return row.assistanceStartDate;
        if (col === "monthsOfAssistance") return row.monthsOfAssistance;
        if (col === "assistanceEndDate") return row.assistanceEndDate;
        if (col === "nextRentCertDue") return row.nextRentCertDue;
        if (col === "totalAssistance") return row.totalAssistance;
        if (col === "maxAssistanceMonthsRemaining") return row.maxAssistanceMonthsRemaining ?? row.maxAssistanceMonths ?? null;
        if (col === "maxAssistanceCutoffDate") return row.maxAssistanceCutoffDate;
        return null;
      }),
    [rows, sort],
  );
  const pagination = usePagination(sortedRows, 50);

  const openPaymentSchedule = React.useCallback((row: RentalAssistanceRow) => {
    if (row.customerId) setCustomerWorkspace(row.customerId);
  }, []);

  const openRowAction = React.useCallback((kind: RowActionKind, row: RentalAssistanceRow) => {
    setRowAction({ kind, row });
  }, []);

  const closeRowAction = React.useCallback(() => {
    if (!anyActionBusy) setRowAction(null);
  }, [anyActionBusy]);

  const applyDateAction = React.useCallback(
    async (date: string) => {
      const action = rowAction;
      const iso = safeISODate10(date);
      if (!action || !iso) {
        toast("Choose a valid date.", { type: "error" });
        return;
      }

      const row = action.row;
      try {
        if (action.kind === "start" || action.kind === "end") {
          const target =
            action.kind === "start"
              ? firstUnpaidPayment(row.assistancePayments)
              : lastUnpaidPayment(row.assistancePayments);
          if (!target) {
            toast("No unpaid rental-assistance payment row is available to adjust.", { type: "warning" });
            return;
          }
          await paymentAdjust.mutateAsync({
            enrollmentId: row.id,
            projectionAdjustment: {
              edits: [{ paymentId: target.id, dueDate: iso }],
              replaceUnpaid: true,
            },
            options: {
              updateGrantBudgets: true,
              recalcGrantProjected: true,
              activeOnly: false,
            },
          });
          await enrollmentPatch.mutateAsync({
            id: row.id,
            patch: action.kind === "start" ? { startDate: iso } : { endDate: iso },
            unset: [],
          } as ReqOf<"enrollmentsPatch">);
          toast(action.kind === "start" ? "Start date adjusted." : "End date adjusted.", { type: "success" });
        } else if (action.kind === "closeFuture") {
          const targets = unpaidAfter(row.assistancePayments, iso).map((payment) => payment.id);
          if (!targets.length) {
            toast("No unpaid future payments found after that date.", { type: "warning" });
            return;
          }
          await paymentAdjust.mutateAsync({
            enrollmentId: row.id,
            deleteRows: {
              paymentIds: targets,
              preservePaid: true,
              updateBudgets: true,
              removeSpends: false,
              reverseLedger: false,
            },
            options: {
              updateGrantBudgets: true,
              recalcGrantProjected: true,
              activeOnly: false,
            },
          });
          await enrollmentPatch.mutateAsync({
            id: row.id,
            patch: { endDate: iso },
            unset: [],
          } as ReqOf<"enrollmentsPatch">);
          toast(`Closed ${targets.length} future payment${targets.length === 1 ? "" : "s"}.`, { type: "success" });
        }
        setRowAction(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update rental assistance row.";
        toast(message, { type: "error" });
      }
    },
    [enrollmentPatch, paymentAdjust, rowAction],
  );

  const applyRentCertAction = React.useCallback(
    async (values: { dueDate: string; paymentId: string; bucket: "task" | "compliance"; title: string; supersede: boolean }) => {
      const action = rowAction;
      const dueDate = safeISODate10(values.dueDate);
      if (!action || action.kind !== "rentCert" || !dueDate) {
        toast("Choose a valid rent cert due date.", { type: "error" });
        return;
      }

      const row = action.row;
      const targetPayment = row.assistancePayments.find((payment) => payment.id === values.paymentId) || null;
      if (!targetPayment?.id) {
        toast("Choose the payment this rent cert applies to.", { type: "error" });
        return;
      }
      const customTitle = values.title.trim();
      try {
        await rentCertMutation.mutateAsync({
          enrollmentId: row.id,
          paymentId: targetPayment.id,
          dueDate,
          bucket: values.bucket,
          ...(customTitle ? { title: customTitle } : {}),
          ...(values.supersede ? { supersedeOlderOpenCerts: true } : {}),
        });
        toast(
          values.supersede ? "Rent cert added. Older open certs were marked completed." : "Rent cert added.",
          { type: "success" },
        );
        setRowAction(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add rent cert reminders.";
        toast(message, { type: "error" });
      }
    },
    [rentCertMutation, rowAction],
  );

  return (
    <div className="space-y-3">
      {(isTruncated.customers || isTruncated.enrollments) ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Loaded data reached the admin report limit. Export and totals may omit rows in very large orgs.
        </div>
      ) : null}
      <ToolTable
        caption="Rental assistance customers"
        headers={[
          <SortableHeader key="customerName" label="Customer" col="customerName" sort={sort} onSort={onSort} />,
          <SortableHeader key="caseManagerName" label="Case Manager" col="caseManagerName" sort={sort} onSort={onSort} />,
          <SortableHeader key="grantName" label="Grant" col="grantName" sort={sort} onSort={onSort} />,
          <SortableHeader key="assistanceStartDate" label="Assistance Start" col="assistanceStartDate" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="monthsOfAssistance" label="Months of Assistance" col="monthsOfAssistance" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="assistanceEndDate" label="Assistance End" col="assistanceEndDate" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="nextRentCertDue" label="Next Rent Cert Due" col="nextRentCertDue" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="totalAssistance" label="Total Allocated" col="totalAssistance" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="maxAssistanceMonthsRemaining" label="Max Remaining" col="maxAssistanceMonthsRemaining" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="maxAssistanceCutoffDate" label="Hard Cutoff" col="maxAssistanceCutoffDate" sort={sort} onSort={onSort} defaultDir="desc" />,
        ]}
        rows={
          sharedDataLoading ? (
            <tr><td colSpan={10}>Loading rental assistance...</td></tr>
          ) : sharedDataError ? (
            <tr><td colSpan={10}>Failed to load rental assistance data.</td></tr>
          ) : pagination.pageRows.length ? (
            pagination.pageRows.map((row) => (
              <tr
                key={row.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextRow(row);
                  setContextPosition({ x: event.clientX, y: event.clientY });
                }}
              >
                <td>
                  {row.customerId ? (
                    <button
                      type="button"
                      className="font-medium text-sky-700 hover:text-sky-800 hover:underline"
                      onClick={() => setCustomerWorkspace(row.customerId)}
                    >
                      {row.customerName}
                    </button>
                  ) : (
                    row.customerName
                  )}
                </td>
                <td>{row.caseManagerName}</td>
                <td>
                  {row.grantId ? (
                    <button
                      type="button"
                      className="font-medium text-sky-700 hover:text-sky-800 hover:underline"
                      onClick={() => setGrantWorkspace(row.grantId)}
                    >
                      {row.grantName}
                    </button>
                  ) : (
                    row.grantName
                  )}
                </td>
                <td>{fmtDateOrDash(row.assistanceStartDate)}</td>
                <td className="text-center tabular-nums">{row.monthsOfAssistance ?? "-"}</td>
                <td>{fmtDateOrDash(row.assistanceEndDate)}</td>
                <td title={`Rent cert for ${row.nextRentCertTargetDate || "next rental payment"}. Right-click the row to add or update it.`}>
                  {fmtDateOrDash(row.nextRentCertDue)}
                </td>
                <td className="text-center tabular-nums">{fmtCurrencyUSD(row.totalAssistance)}</td>
                <td>
                  {row.maxAssistanceMonthsRemaining == null
                    ? row.maxAssistanceMonths
                      ? `${row.maxAssistanceMonths} mo`
                      : "-"
                    : `${row.maxAssistanceMonthsRemaining} mo`}
                </td>
                <td>{fmtDateOrDash(row.maxAssistanceCutoffDate)}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={10}>No rental assistance rows match the current filters.</td></tr>
          )
        }
      />
      <Pagination page={pagination.page} pageCount={pagination.pageCount} setPage={pagination.setPage} />
      <RentalRowContextMenu
        row={contextRow}
        position={contextPosition}
        onClose={() => {
          setContextRow(null);
          setContextPosition(null);
        }}
        onOpenPaymentSchedule={openPaymentSchedule}
        onAction={openRowAction}
      />
      <RentalRowActionDialog
        state={rowAction}
        busy={anyActionBusy}
        onCancel={closeRowAction}
        onConfirmDate={(date) => void applyDateAction(date)}
        onConfirmRentCert={(values) => void applyRentCertAction(values)}
      />
      {customerWorkspace ? (
        <CustomerWorkspaceModal
          customerId={customerWorkspace}
          initialTab="payments"
          onClose={() => setCustomerWorkspace(null)}
        />
      ) : null}
      {grantWorkspace ? (
        <GrantWorkspaceModal
          grantId={grantWorkspace}
          onClose={() => setGrantWorkspace(null)}
        />
      ) : null}
    </div>
  );
};
