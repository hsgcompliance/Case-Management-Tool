"use client";

import React from "react";
import type { TEnrollment, TGrant, TPayment } from "@types";
import { paymentTypeLabel, PaymentTypeBadge } from "@entities/payments/PaymentTypeLabel";
import {
  SmartRowHeader,
  filterRows,
  sortRows,
  useTableColumnFilters,
  useTableSort,
  type SortState,
  type TableColumnFilters,
} from "./SmartRowHeader";

export type PaymentRowsScope = "customer" | "grant" | "enrollment" | "mixed";

export type PaymentRowsEditableFlags = {
  dueDate: boolean;
  lineItemId: boolean;
  amount: boolean;
  vendor: boolean;
  notes: boolean;
  complianceStatus: boolean;
  paidStatus: boolean;
  reason?: string;
};

export type PaymentRowsRow = {
  id: string;
  scope: PaymentRowsScope;
  source: "enrollmentPayment";
  sourcePaymentId: string;
  sourceIndex: number;

  enrollmentId: string;
  enrollmentLabel: string;
  customerId: string;
  customerName: string;
  caseManagerId: string;
  caseManagerName: string;
  grantId: string;
  grantName: string;

  dueDate: string;
  dueMonth: string;
  lineItemId: string;
  lineItemName: string;
  paymentType: string;
  amount: number;
  amountCents: number;
  vendor: string;
  notes: string;
  paid: boolean;
  paidStatus: "unpaid" | "paid" | "void";
  complianceStatus: string;
  hmisComplete: boolean;
  caseworthyComplete: boolean;

  editable: PaymentRowsEditableFlags;
  rawEnrollment: TEnrollment | Record<string, unknown>;
  rawPayment: TPayment | Record<string, unknown>;
};

export type PaymentRowsSummary = {
  rowCount: number;
  totalAmount: number;
  totalCents: number;
  paidAmount: number;
  unpaidAmount: number;
  selectedAmount: number;
  byLineItem: Array<{
    lineItemId: string;
    lineItemName: string;
    rowCount: number;
    amount: number;
    paidAmount: number;
    unpaidAmount: number;
  }>;
};

export type BuildPaymentRowsArgs = {
  enrollments: Array<TEnrollment | Record<string, unknown>>;
  scope?: PaymentRowsScope;
  grant?: TGrant | Record<string, unknown> | null;
  grantId?: string | null;
  customerId?: string | null;
  includeVoided?: boolean;
  activeOnly?: boolean;
};

type PaymentRowsTableColumn =
  | "dueDate"
  | "customer"
  | "enrollment"
  | "grant"
  | "lineItem"
  | "paymentType"
  | "amount"
  | "vendor"
  | "paid"
  | "compliance"
  | "notes";

type PaymentRowsColumnValue = string | number | null | undefined;

export type PaymentRowsTableProps = {
  rows: PaymentRowsRow[];
  selectedIds?: Set<string>;
  onToggleSelected?: (rowId: string, checked: boolean) => void;
  onRowClick?: (row: PaymentRowsRow) => void;
  columns?: PaymentRowsTableColumn[];
  emptyLabel?: string;
  compact?: boolean;
};

const DEFAULT_COLUMNS: PaymentRowsTableColumn[] = [
  "dueDate",
  "customer",
  "enrollment",
  "lineItem",
  "amount",
  "vendor",
  "paid",
  "compliance",
  "notes",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = ""): string {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cents(value: unknown): number {
  return Math.round(numberValue(value) * 100);
}

function iso10(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function notesText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join("; ");
  return text(value);
}

function labelEnrollment(enrollment: Record<string, unknown>): string {
  return (
    text(enrollment.name) ||
    text(enrollment.programName) ||
    text(enrollment.program) ||
    [iso10(enrollment.startDate), text(enrollment.status || (enrollment.active === false ? "closed" : "active"))]
      .filter(Boolean)
      .join(" / ") ||
    text(enrollment.id, "Enrollment")
  );
}

function labelCustomer(enrollment: Record<string, unknown>): string {
  return (
    text(enrollment.customerName) ||
    text(enrollment.clientName) ||
    [text(enrollment.firstName), text(enrollment.lastName)].filter(Boolean).join(" ") ||
    text(enrollment.customerId, "Unknown household")
  );
}

function labelGrant(enrollment: Record<string, unknown>, grant?: Record<string, unknown> | null): string {
  return text(grant?.name || grant?.title || grant?.label) || text(enrollment.grantName) || text(enrollment.grantId);
}

function lineItemsFromGrant(grant?: Record<string, unknown> | null): Record<string, string> {
  const budget = asRecord(grant?.budget);
  const raw = Array.isArray(budget.lineItems) ? budget.lineItems : [];
  const out = new Map<string, string>();
  for (const item of raw) {
    const row = asRecord(item);
    const id = text(row.id);
    if (!id) continue;
    out.set(id, text(row.label || row.name || row.title || row.code, id));
  }
  return Object.fromEntries(out);
}


function editableFlags(payment: Record<string, unknown>): PaymentRowsEditableFlags {
  const paid = Boolean(payment.paid);
  const voided = Boolean(payment.void);
  if (voided) {
    return {
      dueDate: false,
      lineItemId: false,
      amount: false,
      vendor: false,
      notes: false,
      complianceStatus: false,
      paidStatus: false,
      reason: "Voided rows are read-only.",
    };
  }
  if (paid) {
    return {
      dueDate: false,
      lineItemId: false,
      amount: false,
      vendor: false,
      notes: false,
      complianceStatus: true,
      paidStatus: true,
      reason: "Paid rows require adjustment-safe save handling for schedule fields.",
    };
  }
  return {
    dueDate: true,
    lineItemId: true,
    amount: true,
    vendor: true,
    notes: true,
    complianceStatus: true,
    paidStatus: true,
  };
}

function shouldIncludeEnrollment(enrollment: Record<string, unknown>, args: BuildPaymentRowsArgs): boolean {
  if (args.activeOnly && (enrollment.active === false || enrollment.deleted === true || enrollment.status === "closed")) {
    return false;
  }
  const grantId = text(args.grantId);
  if (grantId && text(enrollment.grantId) !== grantId) return false;
  const customerId = text(args.customerId);
  if (customerId && text(enrollment.customerId) !== customerId) return false;
  return true;
}

export function buildPaymentRows(args: BuildPaymentRowsArgs): PaymentRowsRow[] {
  const grant = args.grant ? asRecord(args.grant) : null;
  const lineItemNames = lineItemsFromGrant(grant);
  const scope = args.scope || (args.grantId ? "grant" : args.customerId ? "customer" : "mixed");
  const rows: PaymentRowsRow[] = [];

  for (const rawEnrollment of args.enrollments || []) {
    const enrollment = asRecord(rawEnrollment);
    if (!shouldIncludeEnrollment(enrollment, args)) continue;

    const enrollmentId = text(enrollment.id);
    if (!enrollmentId) continue;

    const payments = Array.isArray(enrollment.payments) ? enrollment.payments : [];
    payments.forEach((rawPayment, index) => {
      const payment = asRecord(rawPayment);
      if (!args.includeVoided && Boolean(payment.void)) return;

      const paymentId = text(payment.id, `payment_${index}`);
      const dueDate = iso10(payment.dueDate || payment.date);
      const lineItemId = text(payment.lineItemId);
      const compliance = asRecord(payment.compliance);
      const amount = numberValue(payment.amount);
      const paid = Boolean(payment.paid);
      const voided = Boolean(payment.void);

      rows.push({
        id: `${enrollmentId}:${paymentId}`,
        scope,
        source: "enrollmentPayment",
        sourcePaymentId: paymentId,
        sourceIndex: index,
        enrollmentId,
        enrollmentLabel: labelEnrollment(enrollment),
        customerId: text(enrollment.customerId),
        customerName: labelCustomer(enrollment),
        caseManagerId: text(enrollment.caseManagerId),
        caseManagerName: text(enrollment.caseManagerName),
        grantId: text(enrollment.grantId || args.grantId),
        grantName: labelGrant(enrollment, grant),
        dueDate,
        dueMonth: dueDate ? dueDate.slice(0, 7) : "",
        lineItemId,
        lineItemName: lineItemNames[lineItemId] || lineItemId,
        paymentType: paymentTypeLabel(payment),
        amount,
        amountCents: cents(amount),
        vendor: text(payment.vendor),
        notes: notesText(payment.comment),
        paid,
        paidStatus: voided ? "void" : paid ? "paid" : "unpaid",
        complianceStatus: text(compliance.status),
        hmisComplete: Boolean(compliance.hmisComplete),
        caseworthyComplete: Boolean(compliance.caseworthyComplete),
        editable: editableFlags(payment),
        rawEnrollment,
        rawPayment,
      });
    });
  }

  return rows.sort((a, b) => {
    const due = (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    if (due !== 0) return due;
    return `${a.customerName}|${a.enrollmentLabel}|${a.sourceIndex}`.localeCompare(
      `${b.customerName}|${b.enrollmentLabel}|${b.sourceIndex}`,
    );
  });
}

export function buildCustomerPaymentRows(args: Omit<BuildPaymentRowsArgs, "scope">): PaymentRowsRow[] {
  return buildPaymentRows({ ...args, scope: "customer" });
}

export function buildGrantPaymentRows(args: Omit<BuildPaymentRowsArgs, "scope">): PaymentRowsRow[] {
  return buildPaymentRows({ ...args, scope: "grant" });
}

export function summarizePaymentRows(rows: PaymentRowsRow[], selectedIds?: Set<string>): PaymentRowsSummary {
  const lineItems = new Map<string, PaymentRowsSummary["byLineItem"][number]>();
  const summary: PaymentRowsSummary = {
    rowCount: 0,
    totalAmount: 0,
    totalCents: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    selectedAmount: 0,
    byLineItem: [],
  };

  for (const row of rows) {
    summary.rowCount += 1;
    summary.totalAmount += row.amount;
    summary.totalCents += row.amountCents;
    if (row.paid) summary.paidAmount += row.amount;
    else summary.unpaidAmount += row.amount;
    if (selectedIds?.has(row.id)) summary.selectedAmount += row.amount;

    const key = row.lineItemId || "unassigned";
    const current =
      lineItems.get(key) ||
      {
        lineItemId: key,
        lineItemName: row.lineItemName || "Unassigned",
        rowCount: 0,
        amount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
      };
    current.rowCount += 1;
    current.amount += row.amount;
    if (row.paid) current.paidAmount += row.amount;
    else current.unpaidAmount += row.amount;
    lineItems.set(key, current);
  }

  summary.byLineItem = Array.from(lineItems.values()).sort((a, b) => a.lineItemName.localeCompare(b.lineItemName));
  return summary;
}

function money(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function paidClass(row: PaymentRowsRow): string {
  if (row.paidStatus === "void") return "border-red-200 bg-red-50 text-red-700";
  if (row.paid) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function complianceLabel(row: PaymentRowsRow): string {
  if (row.complianceStatus) return row.complianceStatus;
  if (row.hmisComplete && row.caseworthyComplete) return "complete";
  if (row.hmisComplete || row.caseworthyComplete) return "partial";
  return "not started";
}

export function getPaymentRowsColumnValue(
  row: PaymentRowsRow,
  col: string,
  part = "header",
): PaymentRowsColumnValue {
  if (col === "dueDate") return row.dueDate;
  if (col === "customer") return part === "id" ? row.customerId : row.customerName;
  if (col === "enrollment") return part === "id" ? row.enrollmentId : row.enrollmentLabel;
  if (col === "grant") return part === "id" ? row.grantId : row.grantName;
  if (col === "lineItem") return part === "id" ? row.lineItemId : row.lineItemName;
  if (col === "paymentType") return row.paymentType;
  if (col === "amount") return row.amount;
  if (col === "vendor") return row.vendor;
  if (col === "paid") return row.paidStatus;
  if (col === "compliance") return complianceLabel(row);
  if (col === "notes") return row.notes;
  return "";
}

function columnLabel(column: PaymentRowsTableColumn): string {
  if (column === "dueDate") return "Due Date";
  if (column === "customer") return "Household";
  if (column === "lineItem") return "Line Item";
  if (column === "paymentType") return "Type";
  return column.charAt(0).toUpperCase() + column.slice(1);
}

export function PaymentRowsTable({
  rows,
  selectedIds,
  onToggleSelected,
  onRowClick,
  columns = DEFAULT_COLUMNS,
  emptyLabel = "No payment rows.",
  compact = false,
}: PaymentRowsTableProps) {
  const hasSelection = Boolean(onToggleSelected);
  const cellPad = compact ? "px-2 py-1.5" : "px-3 py-2";
  const { sort, onSort, setSortDir } = useTableSort();
  const { filters, setColumnFilter } = useTableColumnFilters();
  const valueForColumn = React.useCallback(
    (row: PaymentRowsRow, col: string, part?: string) => getPaymentRowsColumnValue(row, col, part),
    [],
  );
  const filteredRows = React.useMemo(
    () => filterRows(rows, filters, valueForColumn),
    [filters, rows, valueForColumn],
  );
  const visibleRows = React.useMemo(
    () => sortRows(filteredRows, sort, valueForColumn),
    [filteredRows, sort, valueForColumn],
  );

  if (!rows.length) {
    return (
      <div className="rounded-md border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              {hasSelection ? <th className={`${cellPad} w-9 border-b border-slate-200 dark:border-slate-800`} /> : null}
              {columns.map((column) => (
                <th
                  key={column}
                  className={[
                    cellPad,
                    "border-b border-slate-200 dark:border-slate-800",
                    column === "amount" ? "text-right" : "",
                  ].join(" ")}
                >
                  <SmartRowHeader
                    label={columnLabel(column)}
                    col={column}
                    sort={sort as SortState}
                    onSort={onSort}
                    setSortDir={setSortDir}
                    align={column === "amount" ? "right" : undefined}
                    filter={(filters as TableColumnFilters)[column]}
                    onFilterChange={(next) => setColumnFilter(column, next)}
                    values={(part) => rows.map((row) => valueForColumn(row, column, part))}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950" : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {hasSelection ? (
                  <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}>
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(row.id) || false}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onToggleSelected?.(row.id, event.currentTarget.checked)}
                      aria-label={`Select payment ${row.id}`}
                    />
                  </td>
                ) : null}
                {columns.includes("dueDate") ? <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}>{row.dueDate || "-"}</td> : null}
                {columns.includes("customer") ? <td className={`${cellPad} border-b border-slate-100 font-medium dark:border-slate-800`}>{row.customerName}</td> : null}
                {columns.includes("enrollment") ? <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}>{row.enrollmentLabel}</td> : null}
                {columns.includes("grant") ? <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}>{row.grantName}</td> : null}
                {columns.includes("lineItem") ? <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}>{row.lineItemName || "Unassigned"}</td> : null}
                {columns.includes("paymentType") ? <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}><PaymentTypeBadge payment={row.rawPayment as { type?: string; note?: string | string[] }} /></td> : null}
                {columns.includes("amount") ? <td className={`${cellPad} border-b border-slate-100 text-right tabular-nums dark:border-slate-800`}>{money(row.amount)}</td> : null}
                {columns.includes("vendor") ? <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}>{row.vendor || "-"}</td> : null}
                {columns.includes("paid") ? (
                  <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${paidClass(row)}`}>
                      {row.paidStatus}
                    </span>
                  </td>
                ) : null}
                {columns.includes("compliance") ? <td className={`${cellPad} border-b border-slate-100 dark:border-slate-800`}>{complianceLabel(row)}</td> : null}
                {columns.includes("notes") ? <td className={`${cellPad} border-b border-slate-100 text-slate-600 dark:border-slate-800 dark:text-slate-300`}>{row.notes || "-"}</td> : null}
              </tr>
            )) : (
              <tr>
                <td
                  className={`${cellPad} border-b border-slate-100 text-center text-slate-500 dark:border-slate-800`}
                  colSpan={columns.length + (hasSelection ? 1 : 0)}
                >
                  No rows match the current table filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PaymentRowsTable;
