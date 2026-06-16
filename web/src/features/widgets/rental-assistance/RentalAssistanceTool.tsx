import React from "react";
import { parseGrantMaxAssistanceMonths } from "@hdb/contracts";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { Pagination, usePagination } from "@entities/ui/dashboardStyle/Pagination";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { useAdminEnrollmentsData } from "@entities/Page/dashboardStyle/hooks/useAdminEnrollmentsData";
import { computeRentCertDues, todayISO } from "@features/customers/components/paymentScheduleUtils";
import { SortableHeader, sortRows, useTableSort } from "@hooks/useTableSort";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";

export type RentalAssistanceFilterState = {
  status: "active" | "inactive" | "all";
  query: string;
  caseManagerId: string;
};

type RentalAssistanceRow = {
  id: string;
  customerName: string;
  caseManagerId: string;
  caseManagerName: string;
  grantName: string;
  customerId: string;
  assistanceStartDate: string;
  assistanceEndDate: string;
  nextRentCertDue: string;
  committedAmount: number;
  maxAssistanceMonths: number | null;
  maxAssistanceCutoffDate: string;
  maxAssistanceMonthsRemaining: number | null;
  activeThisMonth: boolean;
};

type CaseManagerOption = {
  id: string;
  label: string;
};

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

function monthDiffInclusive(fromMonth: string, toMonth: string): number | null {
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth)) return null;
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm) + 1);
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

  const rows = React.useMemo<RentalAssistanceRow[]>(() => {
    const query = filterState.query.trim().toLowerCase();
    const output: RentalAssistanceRow[] = [];

    for (const enrollment of enrollments as Array<Record<string, unknown>>) {
      if (isDeletedEnrollment(enrollment)) continue;
      const grantId = String(enrollment.grantId || "").trim();
      const grant = grantsById.get(grantId);
      if (!hasRentalAssistanceTag(grant)) continue;

      const payments = Array.isArray(enrollment.payments)
        ? enrollment.payments.filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && !Array.isArray(raw))
        : [];
      const assistancePayments = payments.filter((payment) => {
        if (payment.void === true) return false;
        if (paymentAmount(payment) <= 0) return false;
        return paymentIsRentalAssistance(payment);
      });
      if (!assistancePayments.length) continue;

      const paymentDates = assistancePayments
        .map((payment) => String(payment.dueDate || payment.date || "").slice(0, 10))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();
      const activeThisMonth = assistancePayments.some((payment) => isoMonth(payment.dueDate || payment.date) === month);
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
      const committedAmount = assistancePayments.reduce((sum, payment) => sum + paymentAmount(payment), 0);
      const nextRentCertDue = computeRentCertDues(assistancePayments, {
        enrollmentId: String(enrollment.id || ""),
        enrollmentLabel: grantName,
      })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .find((due) => due.targetPaymentDate >= todayISO())?.dueDate || "";
      const maxAssistanceMonths = maxMonthsFrom(grant, enrollment);
      const maxAssistanceCutoffDate = String(enrollment.maxAssistanceCutoffDate || "").slice(0, 10);
      const remaining = maxAssistanceCutoffDate
        ? monthDiffInclusive(month, maxAssistanceCutoffDate.slice(0, 7))
        : null;

      const searchText = `${customerName} ${caseManagerName} ${grantName}`.toLowerCase();
      if (query && !searchText.includes(query)) continue;

      output.push({
        id: String(enrollment.id || `${grantId}:${customerId}`),
        customerName,
        caseManagerId: caseManagerId || "unassigned",
        caseManagerName,
        grantName,
        customerId,
        assistanceStartDate: paymentDates[0] || "",
        assistanceEndDate: paymentDates[paymentDates.length - 1] || "",
        nextRentCertDue,
        committedAmount,
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
    filterState.query,
    grantNameById,
    grantsById,
    month,
    status,
  ]);

  return {
    rows,
    caseManagerOptions,
    sharedDataLoading,
    sharedDataError,
    isTruncated,
  };
}

export const RentalAssistanceTopbar: DashboardToolDefinition<RentalAssistanceFilterState, null>["ToolTopbar"] = ({
  value,
  onChange,
}) => {
  const { rows, caseManagerOptions } = useRentalAssistanceRows(value);
  const selectedStatus = rentalAssistanceStatus(value);
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
          { key: "assistanceEndDate", label: "Assistance End", value: (r: RentalAssistanceRow) => r.assistanceEndDate },
          { key: "nextRentCertDue", label: "Next Rent Cert Due", value: (r: RentalAssistanceRow) => r.nextRentCertDue },
          { key: "committedAmount", label: "Projected + Spent", value: (r: RentalAssistanceRow) => r.committedAmount },
          { key: "maxAssistanceMonthsRemaining", label: "Max Months Remaining", value: (r: RentalAssistanceRow) => r.maxAssistanceMonthsRemaining ?? "" },
          { key: "maxAssistanceCutoffDate", label: "Hard Cutoff", value: (r: RentalAssistanceRow) => r.maxAssistanceCutoffDate },
        ]}
      />
    </div>
  );
};

export const RentalAssistanceMain: DashboardToolDefinition<RentalAssistanceFilterState, null>["Main"] = ({
  filterState,
}) => {
  const { rows, sharedDataLoading, sharedDataError, isTruncated } = useRentalAssistanceRows(filterState);
  const { sort, onSort } = useTableSort({ col: "customerName", dir: "asc" });
  const sortedRows = React.useMemo(
    () =>
      sortRows(rows, sort, (row, col) => {
        if (col === "customerName") return row.customerName;
        if (col === "caseManagerName") return row.caseManagerName;
        if (col === "grantName") return row.grantName;
        if (col === "assistanceStartDate") return row.assistanceStartDate;
        if (col === "assistanceEndDate") return row.assistanceEndDate;
        if (col === "nextRentCertDue") return row.nextRentCertDue;
        if (col === "committedAmount") return row.committedAmount;
        if (col === "maxAssistanceMonthsRemaining") return row.maxAssistanceMonthsRemaining ?? row.maxAssistanceMonths ?? null;
        if (col === "maxAssistanceCutoffDate") return row.maxAssistanceCutoffDate;
        return null;
      }),
    [rows, sort],
  );
  const pagination = usePagination(sortedRows, 50);

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
          <SortableHeader key="assistanceEndDate" label="Assistance End" col="assistanceEndDate" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="nextRentCertDue" label="Next Rent Cert Due" col="nextRentCertDue" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="committedAmount" label="Projected + Spent" col="committedAmount" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="maxAssistanceMonthsRemaining" label="Max Remaining" col="maxAssistanceMonthsRemaining" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="maxAssistanceCutoffDate" label="Hard Cutoff" col="maxAssistanceCutoffDate" sort={sort} onSort={onSort} defaultDir="desc" />,
        ]}
        rows={
          sharedDataLoading ? (
            <tr><td colSpan={9}>Loading rental assistance...</td></tr>
          ) : sharedDataError ? (
            <tr><td colSpan={9}>Failed to load rental assistance data.</td></tr>
          ) : pagination.pageRows.length ? (
            pagination.pageRows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.customerId ? (
                    <a className="font-medium text-sky-700 hover:text-sky-800 hover:underline" href={`/customers/${row.customerId}?tab=payments`}>
                      {row.customerName}
                    </a>
                  ) : (
                    row.customerName
                  )}
                </td>
                <td>{row.caseManagerName}</td>
                <td>{row.grantName}</td>
                <td>{fmtDateOrDash(row.assistanceStartDate)}</td>
                <td>{fmtDateOrDash(row.assistanceEndDate)}</td>
                <td>{fmtDateOrDash(row.nextRentCertDue)}</td>
                <td className="text-right">{fmtCurrencyUSD(row.committedAmount)}</td>
                <td>
                  {row.maxAssistanceMonthsRemaining == null
                    ? row.maxAssistanceMonths
                      ? `${row.maxAssistanceMonths} max`
                      : "-"
                    : `${row.maxAssistanceMonthsRemaining} mo`}
                </td>
                <td>{fmtDateOrDash(row.maxAssistanceCutoffDate)}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={9}>No rental assistance rows match the current filters.</td></tr>
          )
        }
      />
      <Pagination page={pagination.page} pageCount={pagination.pageCount} setPage={pagination.setPage} />
    </div>
  );
};
