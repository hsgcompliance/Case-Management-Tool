"use client";

import React from "react";
import Link from "next/link";
import type { Enrollment } from "@client/enrollments";
import { EnrollmentMigrateDialog } from "@entities/dialogs/enrollment/EnrollmentMigrateDialog";
import GrantBudgetStrip from "@entities/grants/GrantBudgetStrip";
import { useCustomerEnrollments } from "@hooks/useEnrollments";
import { useGrants } from "@hooks/useGrants";
import { useCustomers } from "@hooks/useCustomers";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import {
  buildPaymentEditorEnrollmentOptions,
  buildPaymentEditorGrantInfo,
  buildPaymentEditorRows,
  inferPaymentEditorLineItemId,
  makeBlankPaymentEditorRow,
  summarizePaymentEditorRows,
  type PaymentEditorComplianceStatus,
  type PaymentEditorEnrollmentOption,
  type PaymentEditorGrantInfo,
  type PaymentEditorLedgerStatus,
  type PaymentEditorRow,
  type PaymentEditorTypeKey,
} from "./paymentEditorLabAdapter";
import { usePaymentEditorSheetSave } from "./usePaymentEditorSheetSave";

const TYPE_OPTIONS: Array<{ value: PaymentEditorTypeKey; label: string }> = [
  { value: "monthly-rent", label: "Monthly Rent" },
  { value: "monthly-utility", label: "Utility" },
  { value: "deposit", label: "Security Deposit" },
  { value: "prorated", label: "Prorated Rent" },
  { value: "service", label: "Supportive Service" },
  { value: "arrears", label: "Arrears" },
];

const COMPLIANCE_OPTIONS: Array<{ value: PaymentEditorComplianceStatus; label: string }> = [
  { value: "hmis-only", label: "HMIS Only" },
  { value: "caseworthy-only", label: "Caseworthy Only" },
  { value: "data-entry-complete", label: "Data Entry Complete" },
];

const PAID_OPTIONS: Array<{ value: PaymentEditorLedgerStatus; label: string }> = [
  { value: "projected", label: "Projected" },
  { value: "invoice-submitted", label: "Invoice Submitted" },
];

const INPUT_CLASS =
  "h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950";

function money(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function amountNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function rowDateSort(a: PaymentEditorRow, b: PaymentEditorRow): number {
  const aValid = isValidISODate(a.dueDate);
  const bValid = isValidISODate(b.dueDate);
  if (aValid && bValid) return a.dueDate.localeCompare(b.dueDate);
  if (aValid) return -1;
  if (bValid) return 1;
  return a.id.localeCompare(b.id);
}

function todayTimeLabel(iso?: string | null): string {
  if (!iso) return "not yet";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function paidPillClass(status: PaymentEditorLedgerStatus): string {
  if (status === "invoice-submitted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function compliancePillClass(status: PaymentEditorComplianceStatus): string {
  if (status === "data-entry-complete") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "caseworthy-only") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function ThreeDotsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  );
}

function customerLabel(customer: Record<string, unknown>): string {
  return String(
    customer.name ||
      customer.fullName ||
      [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
      customer.id ||
      "Customer",
  );
}

function enrollmentLineItemOptions(
  enrollmentOptions: PaymentEditorEnrollmentOption[],
  row: PaymentEditorRow | null,
) {
  if (!row) return [];
  return enrollmentOptions.find((option) => option.id === row.enrollmentId)?.lineItems || [];
}

function lineItemDeltasForGrant(args: {
  grantId: string;
  rows: PaymentEditorRow[];
  baselineRows: Map<string, PaymentEditorRow>;
}): Record<string, number> {
  const currentIds = new Set(args.rows.map((row) => row.id));
  const deltas: Record<string, number> = {};
  const add = (lineItemId: string, amount: number) => {
    if (!lineItemId || !Number.isFinite(amount) || amount === 0) return;
    deltas[lineItemId] = (deltas[lineItemId] || 0) + amount;
  };

  for (const row of args.rows) {
    if (row.grantId !== args.grantId) continue;
    const before = args.baselineRows.get(row.id);
    const currentAmount = amountNumber(row.amount);
    if (!before) {
      add(row.lineItemId, currentAmount);
      continue;
    }
    if (before.lineItemId === row.lineItemId) {
      add(row.lineItemId, currentAmount - amountNumber(before.amount));
    } else {
      add(before.lineItemId, -amountNumber(before.amount));
      add(row.lineItemId, currentAmount);
    }
  }

  for (const before of args.baselineRows.values()) {
    if (before.grantId !== args.grantId || currentIds.has(before.id)) continue;
    add(before.lineItemId, -amountNumber(before.amount));
  }

  return deltas;
}

function GrantInvoicePanel({ grants }: { grants: PaymentEditorGrantInfo[] }) {
  const invoiceGrants = grants.filter((grant) => {
    const inv = grant.invoice;
    return inv && Object.values(inv).some((value) => String(value || "").trim());
  });

  if (!invoiceGrants.length) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Grant Invoice Information</div>
      <div className="grid gap-2 lg:grid-cols-2">
        {invoiceGrants.map((grant) => {
          const inv = grant.invoice || {};
          return (
            <div key={grant.id} className="rounded border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-800">
              <div className="font-semibold text-slate-800 dark:text-slate-100">{grant.name}</div>
              <div className="mt-1 grid gap-x-3 gap-y-1 sm:grid-cols-2">
                {[
                  ["Invoice", inv.invoiceCode],
                  ["Grant Code", inv.grantCode || grant.code],
                  ["Funder", inv.funder],
                  ["Contract", inv.contractNumber],
                  ["Frequency", inv.frequency],
                  ["Due", inv.dueDayOfMonth || inv.paymentTerms],
                  ["Portal", inv.submissionPortal],
                  ["Notes", inv.notes],
                ].map(([label, value]) =>
                  value ? (
                    <div key={`${grant.id}-${label}`} className="min-w-0">
                      <span className="text-slate-400">{label}: </span>
                      <span className="break-words font-medium text-slate-700 dark:text-slate-200">{value}</span>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export type PaymentEditorLabPageProps = {
  fixedCustomerId?: string;
  fixedCustomerName?: string;
  embedded?: boolean;
};

export default function PaymentEditorLabPage({
  fixedCustomerId,
  fixedCustomerName,
  embedded = false,
}: PaymentEditorLabPageProps = {}) {
  const hasFixedCustomer = Boolean(fixedCustomerId);
  const customersQ = useCustomers(
    { active: "true", deleted: "exclude", limit: 200 },
    { enabled: !hasFixedCustomer, staleTime: 30_000 },
  );
  const [customerId, setCustomerId] = React.useState(() => fixedCustomerId || "");
  const [enrollmentFilter, setEnrollmentFilter] = React.useState("all");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [openMenuRowId, setOpenMenuRowId] = React.useState<string | null>(null);
  const [lineItemDialogRowId, setLineItemDialogRowId] = React.useState<string | null>(null);
  const [migrateEnrollment, setMigrateEnrollment] = React.useState<Enrollment | null>(null);
  const [localMessage, setLocalMessage] = React.useState("");

  const customers = React.useMemo(
    () => (customersQ.data || []) as Array<Record<string, unknown>>,
    [customersQ.data],
  );

  React.useEffect(() => {
    if (fixedCustomerId && customerId !== fixedCustomerId) {
      setCustomerId(fixedCustomerId);
      return;
    }
    if (!fixedCustomerId && !customerId && customers.length) {
      setCustomerId(String(customers[0]?.id || ""));
    }
  }, [customerId, customers, fixedCustomerId]);

  const enrollmentsQ = useCustomerEnrollments(customerId || undefined, { enabled: !!customerId });
  const grantsQ = useGrants({ limit: 500 }, { enabled: true, staleTime: 60_000 });
  const enrollments = React.useMemo(() => (enrollmentsQ.data || []) as Enrollment[], [enrollmentsQ.data]);
  const grants = React.useMemo(
    () => (grantsQ.data || []) as Array<Record<string, unknown>>,
    [grantsQ.data],
  );
  const openEnrollments = React.useMemo(
    () =>
      enrollments.filter((enrollment) => {
        const status = String(enrollment.status || "").trim().toLowerCase();
        if (status === "closed" || status === "deleted") return false;
        if (typeof enrollment.active === "boolean") return enrollment.active;
        return true;
      }),
    [enrollments],
  );

  const grantsById = React.useMemo(() => buildPaymentEditorGrantInfo(grants), [grants]);
  const enrollmentOptions = React.useMemo(
    () =>
      buildPaymentEditorEnrollmentOptions(openEnrollments, grantsById).map((option) => ({
        ...option,
        label: formatEnrollmentLabel(option.rawEnrollment as Enrollment, { fallback: option.label }),
      })),
    [openEnrollments, grantsById],
  );

  React.useEffect(() => {
    setEnrollmentFilter("all");
    setSelectedIds(new Set());
  }, [customerId]);

  React.useEffect(() => {
    if (enrollmentFilter === "all") return;
    if (!enrollmentOptions.some((option) => option.id === enrollmentFilter)) setEnrollmentFilter("all");
  }, [enrollmentFilter, enrollmentOptions]);

  const sourceRows = React.useMemo(
    () => buildPaymentEditorRows({ enrollments: openEnrollments, grantsById }),
    [openEnrollments, grantsById],
  );

  const sheet = usePaymentEditorSheetSave(sourceRows, customerId);

  const visibleRows = React.useMemo(() => {
    const filtered =
      enrollmentFilter === "all"
        ? sheet.rows
        : sheet.rows.filter((row) => row.enrollmentId === enrollmentFilter);
    return [...filtered].sort(rowDateSort);
  }, [enrollmentFilter, sheet.rows]);

  React.useEffect(() => {
    setSelectedIds((current) => {
      const visibleIds = new Set(visibleRows.map((row) => row.id));
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleRows]);

  const visibleGrantIds = React.useMemo(
    () => Array.from(new Set(visibleRows.map((row) => row.grantId).filter(Boolean))),
    [visibleRows],
  );

  const visibleGrants = React.useMemo(
    () => visibleGrantIds.map((id) => grantsById.get(id)).filter((grant): grant is PaymentEditorGrantInfo => !!grant),
    [grantsById, visibleGrantIds],
  );

  const summary = React.useMemo(() => summarizePaymentEditorRows(visibleRows, selectedIds), [selectedIds, visibleRows]);
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.id));
  const lineItemDialogRow = sheet.rows.find((row) => row.id === lineItemDialogRowId) || null;
  const lineItemOptions = enrollmentLineItemOptions(enrollmentOptions, lineItemDialogRow);
  const loading = (!hasFixedCustomer && customersQ.isLoading) || enrollmentsQ.isLoading || grantsQ.isLoading;

  const patchType = React.useCallback(
    (row: PaymentEditorRow, typeKey: PaymentEditorTypeKey | "") => {
      const enrollment = enrollmentOptions.find((option) => option.id === row.enrollmentId);
      const lineItemId = inferPaymentEditorLineItemId(typeKey, enrollment?.lineItems || []);
      const lineItem = enrollment?.lineItems.find((item) => item.id === lineItemId);
      sheet.patchRow(row.id, {
        typeKey,
        ...(lineItemId ? { lineItemId, lineItemName: lineItem?.label || lineItemId } : {}),
      });
    },
    [enrollmentOptions, sheet],
  );

  const patchLineItem = React.useCallback(
    (row: PaymentEditorRow, lineItemId: string) => {
      const option = enrollmentOptions.find((item) => item.id === row.enrollmentId);
      const lineItem = option?.lineItems.find((item) => item.id === lineItemId);
      sheet.patchRow(row.id, { lineItemId, lineItemName: lineItem?.label || lineItemId });
    },
    [enrollmentOptions, sheet],
  );

  const addRow = React.useCallback(() => {
    const target =
      enrollmentFilter !== "all"
        ? enrollmentOptions.find((option) => option.id === enrollmentFilter)
        : enrollmentOptions[0];
    if (!target) {
      setLocalMessage("Select a customer with an enrollment before adding rows.");
      return;
    }
    sheet.addRow(makeBlankPaymentEditorRow(target));
    setLocalMessage("");
  }, [enrollmentFilter, enrollmentOptions, sheet]);

  const updateSelected = React.useCallback(
    (patch: Partial<PaymentEditorRow>) => {
      if (!selectedIds.size) return;
      sheet.setRows((current) => current.map((row) => (selectedIds.has(row.id) ? { ...row, ...patch } : row)));
    },
    [selectedIds, sheet],
  );

  const openMigrate = React.useCallback(
    (row: PaymentEditorRow) => {
      const option = enrollmentOptions.find((item) => item.id === row.enrollmentId);
      setMigrateEnrollment((option?.rawEnrollment || null) as Enrollment | null);
      setOpenMenuRowId(null);
    },
    [enrollmentOptions],
  );

  const removeRow = React.useCallback(
    (rowId: string) => {
      sheet.removeRow(rowId);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(rowId);
        return next;
      });
      setOpenMenuRowId(null);
    },
    [sheet],
  );

  const saveNow = React.useCallback(() => {
    setLocalMessage("");
    void sheet.saveNow().catch((err: unknown) => {
      setLocalMessage(err instanceof Error ? err.message : "Save failed.");
    });
  }, [sheet]);

  const validationMessage = localMessage || sheet.saveError || sheet.plan.validationErrors[0] || "";

  return (
    <div className={embedded ? "text-slate-900 dark:text-slate-100" : "min-h-screen bg-slate-100 px-4 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100"}>
      <div className={embedded ? "flex flex-col gap-3" : "mx-auto flex max-w-[1600px] flex-col gap-3"}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          {!embedded ? (
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link href="/dev" className="hover:text-slate-900 dark:hover:text-white">Dev</Link>
                <span>/</span>
                <span>Payment editor lab</span>
              </div>
              <h1 className="mt-1 text-xl font-semibold tracking-normal">Enrollment Payment Editor Lab</h1>
              <p className="mt-1 max-w-4xl text-sm text-slate-600 dark:text-slate-300">
                Sheet-style schedule editor over existing enrollment payments, spend posting, compliance updates, and grant budget recalculation.
              </p>
            </div>
          ) : (
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sheet Payment Editor</div>
              <div className="text-xs text-slate-500">Dev-backed sheet surface for this customer. Legacy payment tools are still available in Legacy View.</div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className={["rounded-md border px-2.5 py-1.5 text-xs font-semibold shadow-sm", sheet.dirty ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"].join(" ")}>
              {sheet.dirty ? `Unsaved changes: ${sheet.changedIds.size}` : "All changes saved"}
            </span>
            <button
              type="button"
              className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950"
              onClick={saveNow}
              disabled={!sheet.dirty || sheet.busy || sheet.plan.validationErrors.length > 0}
            >
              {sheet.busy ? "Saving..." : "Save Now"}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              onClick={sheet.resetRows}
              disabled={!sheet.dirty || sheet.busy}
            >
              Undo
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-2.5 xl:grid-cols-[320px_320px_1fr]">
            {hasFixedCustomer ? (
              <div className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</span>
                <div className="mt-1 flex h-8 items-center rounded border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  {fixedCustomerName || fixedCustomerId}
                </div>
              </div>
            ) : (
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</span>
                <select
                  className={`${INPUT_CLASS} mt-1`}
                  value={customerId}
                  onChange={(event) => setCustomerId(event.currentTarget.value)}
                >
                  {!customers.length ? <option value="">No customers loaded</option> : null}
                  {customers.map((customer) => (
                    <option key={String(customer.id)} value={String(customer.id)}>
                      {customerLabel(customer)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Enrollment</span>
              <select
                className={`${INPUT_CLASS} mt-1`}
                value={enrollmentFilter}
                onChange={(event) => setEnrollmentFilter(event.currentTarget.value)}
                disabled={!enrollmentOptions.length}
              >
                <option value="all">All open customer enrollments</option>
                {enrollmentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Rows</div>
                <div className="mt-0.5 text-xs font-semibold">{summary.rowCount}</div>
              </div>
              <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Visible Total</div>
                <div className="mt-0.5 text-xs font-semibold">{money(summary.total)}</div>
              </div>
              <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Projected</div>
                <div className="mt-0.5 text-xs font-semibold">{money(summary.projected)}</div>
              </div>
              <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Invoice Submitted</div>
                <div className="mt-0.5 text-xs font-semibold">{money(summary.submitted)}</div>
              </div>
              <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Autosave</div>
                <div className="mt-0.5 text-xs font-semibold">{sheet.dirty ? `${sheet.secondsUntilSave}s` : "idle"}</div>
              </div>
            </div>
          </div>
        </section>

        {visibleGrantIds.length ? (
          <section className="grid gap-2 xl:grid-cols-2">
            {visibleGrantIds.map((grantId) => {
              const lineItemDeltas = lineItemDeltasForGrant({
                grantId,
                rows: sheet.rows,
                baselineRows: sheet.baseline.rows,
              });
              const projectionDelta = Object.values(lineItemDeltas).reduce((sum, value) => sum + value, 0);
              return (
                <GrantBudgetStrip
                  key={grantId}
                  grantId={grantId}
                  projectionDelta={projectionDelta}
                  lineItemDeltas={lineItemDeltas}
                  className="bg-white dark:bg-slate-900"
                />
              );
            })}
          </section>
        ) : null}

        <GrantInvoicePanel grants={visibleGrants} />

        {selectedIds.size ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <div className="font-semibold">
              {selectedIds.size} selected - {money(summary.selected)}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:hover:bg-blue-950" onClick={() => updateSelected({ paidStatus: "invoice-submitted" })}>
                Invoice Submitted
              </button>
              <button type="button" className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:hover:bg-blue-950" onClick={() => updateSelected({ complianceStatus: "data-entry-complete" })}>
                Data Entry Complete
              </button>
              <button type="button" className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:hover:bg-blue-950" onClick={() => setSelectedIds(new Set())}>
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {validationMessage ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {validationMessage}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="w-16 border border-slate-300 px-2 py-1.5 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            visibleRows.forEach((row) => {
                              if (checked) next.add(row.id);
                              else next.delete(row.id);
                            });
                            return next;
                          });
                        }}
                        aria-label="Select rows"
                      />
                      <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-sm font-semibold leading-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800" onClick={addRow} aria-label="Add row">
                        +
                      </button>
                    </div>
                  </th>
                  <th className="w-32 border border-slate-300 px-2 py-1.5 dark:border-slate-800">Due Date</th>
                  <th className="w-52 border border-slate-300 px-2 py-1.5 dark:border-slate-800">Customer / Enrollment</th>
                  <th className="w-36 border border-slate-300 px-2 py-1.5 dark:border-slate-800">Type</th>
                  <th className="w-44 border border-slate-300 px-2 py-1.5 dark:border-slate-800">Line Item</th>
                  <th className="w-28 border border-slate-300 px-2 py-1.5 text-right dark:border-slate-800">Amount</th>
                  <th className="w-44 border border-slate-300 px-2 py-1.5 dark:border-slate-800">Vendor</th>
                  <th className="border border-slate-300 px-2 py-1.5 dark:border-slate-800">Notes</th>
                  <th className="w-16 border border-slate-300 px-2 py-1.5 text-center dark:border-slate-800">Rent Cert</th>
                  <th className="w-40 border border-slate-300 px-2 py-1.5 dark:border-slate-800">Paid Status</th>
                  <th className="w-44 border border-slate-300 px-2 py-1.5 dark:border-slate-800">Compliance</th>
                  <th className="w-16 border border-slate-300 px-2 py-1.5 text-center dark:border-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="border border-slate-200 px-3 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
                      Loading payment rows...
                    </td>
                  </tr>
                ) : visibleRows.length ? (
                  visibleRows.map((row) => {
                    const changed = sheet.changedIds.has(row.id);
                    const invalid = !row.dueDate || !row.typeKey || !row.lineItemId || amountNumber(row.amount) <= 0;
                    const rowLineItems = enrollmentLineItemOptions(enrollmentOptions, row);
                    const enrollmentLabel = enrollmentOptions.find((option) => option.id === row.enrollmentId)?.label || row.enrollmentId;
                    return (
                      <tr key={row.id} className={[invalid ? "bg-red-50/80 dark:bg-red-950/20" : changed ? "bg-sky-50/70 dark:bg-sky-950/30" : "bg-white dark:bg-slate-950"].join(" ")}>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                if (checked) next.add(row.id);
                                else next.delete(row.id);
                                return next;
                              });
                            }}
                            aria-label={`Select ${row.id}`}
                          />
                        </td>
                        <td className="border border-slate-200 p-1 dark:border-slate-800">
                          <input className={INPUT_CLASS} type="date" value={row.dueDate} onChange={(event) => sheet.patchRow(row.id, { dueDate: event.currentTarget.value })} />
                        </td>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">{row.customerName || "Customer"}</div>
                          <div className="truncate text-[11px] text-slate-500" title={enrollmentLabel}>{enrollmentLabel}</div>
                        </td>
                        <td className="border border-slate-200 p-1 dark:border-slate-800">
                          <select className={INPUT_CLASS} value={row.typeKey} onChange={(event) => patchType(row, event.currentTarget.value as PaymentEditorTypeKey)}>
                            <option value="">Select type</option>
                            {TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-slate-200 p-1 dark:border-slate-800">
                          <select className={INPUT_CLASS} value={row.lineItemId} onChange={(event) => patchLineItem(row, event.currentTarget.value)}>
                            <option value="">Select line item</option>
                            {rowLineItems.map((item) => (
                              <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-slate-200 p-1 dark:border-slate-800">
                          <input className={`${INPUT_CLASS} text-right`} inputMode="decimal" value={row.amount} onChange={(event) => sheet.patchRow(row.id, { amount: event.currentTarget.value })} title={row.lockedReason} placeholder="0.00" />
                        </td>
                        <td className="border border-slate-200 p-1 dark:border-slate-800">
                          <input className={INPUT_CLASS} value={row.vendor} onChange={(event) => sheet.patchRow(row.id, { vendor: event.currentTarget.value })} placeholder="Vendor optional" />
                        </td>
                        <td className="border border-slate-200 p-1 dark:border-slate-800">
                          <input className={INPUT_CLASS} value={row.notes} onChange={(event) => sheet.patchRow(row.id, { notes: event.currentTarget.value })} placeholder="Add note" />
                        </td>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">
                          <div className="flex items-center justify-center">
                            <input type="checkbox" checked={row.rentCertDue} onChange={(event) => sheet.patchRow(row.id, { rentCertDue: event.currentTarget.checked, rentCertDueAutoGenerated: false })} aria-label="Rent cert due" />
                          </div>
                        </td>
                        <td className="border border-slate-200 p-1 dark:border-slate-800">
                          <select className={[INPUT_CLASS, "font-semibold", paidPillClass(row.paidStatus)].join(" ")} value={row.paidStatus} onChange={(event) => sheet.patchRow(row.id, { paidStatus: event.currentTarget.value as PaymentEditorLedgerStatus })}>
                            {PAID_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-slate-200 p-1 dark:border-slate-800">
                          <select className={[INPUT_CLASS, "font-semibold", compliancePillClass(row.complianceStatus)].join(" ")} value={row.complianceStatus} onChange={(event) => sheet.patchRow(row.id, { complianceStatus: event.currentTarget.value as PaymentEditorComplianceStatus })}>
                            {COMPLIANCE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="relative border border-slate-200 px-2 py-1 text-center dark:border-slate-800">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950"
                            onClick={() => setOpenMenuRowId((current) => (current === row.id ? null : row.id))}
                            aria-label="Row actions"
                          >
                            <ThreeDotsIcon />
                          </button>
                          {openMenuRowId === row.id ? (
                            <div className="absolute right-2 top-8 z-20 w-56 overflow-hidden rounded-md border border-slate-200 bg-white text-left shadow-lg dark:border-slate-700 dark:bg-slate-900">
                              <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => removeRow(row.id)}>
                                Remove Row
                              </button>
                              <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { setLineItemDialogRowId(row.id); setOpenMenuRowId(null); }}>
                                Change Line Item
                              </button>
                              <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => openMigrate(row)}>
                                Migrate to New Enrollment
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={12} className="border border-slate-200 px-3 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
                      Select a customer with enrollments, or add a row once an enrollment is available.
                    </td>
                  </tr>
                )}
                <tr className="bg-sky-50/70 dark:bg-sky-950/20">
                  <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">
                    <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-sky-200 bg-white text-sm font-semibold text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:bg-slate-950" onClick={addRow} aria-label="Add row at bottom">
                      +
                    </button>
                  </td>
                  <td colSpan={11} className="border border-slate-200 px-2 py-1 text-xs font-medium text-sky-700 dark:border-slate-800 dark:text-sky-200">
                    Add row
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
          <div className="rounded-md border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="font-medium">Save Boundary</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Dirty rows are planned through existing payment hooks. Projected rows use projection adjustment, submitted rows use spend posting, compliance uses the payment compliance endpoint, and paid schedule edits use adjustment-safe handling.
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
                <div className="text-[11px] uppercase text-slate-500">Last Save</div>
                <div className="mt-0.5 text-xs font-semibold">{todayTimeLabel(sheet.lastSave?.savedAt)}</div>
              </div>
              <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
                <div className="text-[11px] uppercase text-slate-500">Changed Rows</div>
                <div className="mt-0.5 text-xs font-semibold">{sheet.changedIds.size}</div>
              </div>
              <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
                <div className="text-[11px] uppercase text-slate-500">Paid Adjustments</div>
                <div className="mt-0.5 text-xs font-semibold">{sheet.plan.paidAdjustments.length}</div>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="font-medium text-sm">Planned Operations</div>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded bg-slate-100 p-2 text-xs dark:bg-slate-950">
              <div>
                <div className="text-[11px] uppercase text-slate-500">Projection Batches</div>
                <div className="mt-0.5 font-semibold">{sheet.plan.projectionAdjustments.length}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-500">Spend Posts</div>
                <div className="mt-0.5 font-semibold">{sheet.plan.spendPosts.length}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-500">Compliance</div>
                <div className="mt-0.5 font-semibold">{sheet.plan.compliancePatches.length}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-500">Deletes</div>
                <div className="mt-0.5 font-semibold">{sheet.plan.paidDeletes.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {lineItemDialogRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm font-semibold">Change Line Item</div>
            <div className="mt-1 text-xs text-slate-500">
              This changes the real grant budget line item attached to the payment row.
            </div>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase text-slate-500">Type</span>
              <select className={`${INPUT_CLASS} mt-1`} value={lineItemDialogRow.typeKey} onChange={(event) => patchType(lineItemDialogRow, event.currentTarget.value as PaymentEditorTypeKey)}>
                <option value="">Select type</option>
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase text-slate-500">Line Item</span>
              <select className={`${INPUT_CLASS} mt-1`} value={lineItemDialogRow.lineItemId} onChange={(event) => patchLineItem(lineItemDialogRow, event.currentTarget.value)}>
                <option value="">Select line item</option>
                {lineItemOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950" onClick={() => setLineItemDialogRowId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <EnrollmentMigrateDialog
        open={!!migrateEnrollment}
        enrollment={migrateEnrollment}
        grants={grants as never}
        onClose={() => setMigrateEnrollment(null)}
        onDone={() => {
          setMigrateEnrollment(null);
          void enrollmentsQ.refetch();
        }}
      />
    </div>
  );
}
