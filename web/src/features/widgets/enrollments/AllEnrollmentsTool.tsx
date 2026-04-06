import React from "react";
import { fmtDateOrDash } from "@lib/formatters";
import { useTableSort, SortableHeader, sortRows } from "@hooks/useTableSort";
import { Pagination, usePagination } from "@entities/ui/dashboardStyle/Pagination";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { useAdminEnrollmentsData } from "@entities/Page/dashboardStyle/hooks/useAdminEnrollmentsData";
import { NavCrumb } from "@entities/Page/dashboardStyle/types";

type GrantBucket = "grant" | "program";

export type AllEnrollmentsFilterState = {
  bucket: "all" | GrantBucket;
  caseManagerId: string;
};

export type AllEnrollmentsSelection = {
  grantId: string;
} | null;

type ProgramRow = {
  grantId: string;
  grantName: string;
  bucket: GrantBucket;
  activeCount: number;
  inactiveCount: number;
  activeEnrollments: Array<{
    id: string;
    customerId: string;
    customerName: string;
    caseManagerId: string;
    caseManagerName: string;
    startDate: string;
    status: string;
  }>;
};

type EnrollmentSummaryExportRow = ProgramRow & { total: number };

type CaseManagerOption = {
  id: string;
  label: string;
};

function bucketForGrant(grant: Record<string, unknown> | undefined): GrantBucket {
  const explicitKind = String(grant?.kind || "").toLowerCase();
  if (explicitKind === "grant" || explicitKind === "program") return explicitKind as GrantBucket;

  const budget = (grant?.budget || {}) as Record<string, unknown>;
  const totals = (budget?.totals || {}) as Record<string, unknown>;
  const total = Number(budget?.total ?? totals?.total ?? budget?.startAmount ?? 0);
  return total <= 0 ? "program" : "grant";
}

function enrollmentIsActive(e: Record<string, unknown>): boolean {
  const status = String(e?.status || "").toLowerCase();
  if (status === "active") return true;
  if (status === "closed" || status === "deleted") return false;
  return e?.active === true;
}

function enrollmentStatusLabel(e: Record<string, unknown>): string {
  const status = String(e?.status || "").toLowerCase();
  if (status) return status;
  return enrollmentIsActive(e) ? "active" : "closed";
}

function readCaseManagerForEnrollment(
  e: Record<string, unknown>,
  customer: Record<string, unknown> | undefined
): { id: string; name: string } {
  const enrollmentCmId = String(e?.caseManagerId || "").trim();
  const enrollmentCmName = String(e?.caseManagerName || "").trim();
  const customerCmId = String(customer?.caseManagerId || "").trim();
  const customerCmName = String(customer?.caseManagerName || "").trim();

  const id = enrollmentCmId || customerCmId;
  const name = enrollmentCmName || customerCmName || id || "Unassigned";
  return {
    id: id || "unassigned",
    name,
  };
}

function useAllEnrollmentRows(filterState: AllEnrollmentsFilterState) {
  const {
    enrollments,
    grants,
    customers,
    customerNameById,
    grantNameById,
    sharedDataLoading,
    sharedDataError,
    sharedDataOk,
    isTruncated,
  } = useAdminEnrollmentsData();

  const grantsById = React.useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const g of grants as Array<Record<string, unknown>>) {
      const id = String(g?.id || "").trim();
      if (!id) continue;
      m.set(id, g);
    }
    return m;
  }, [grants]);

  const customersById = React.useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const c of customers as Array<Record<string, unknown>>) {
      const id = String(c?.id || "").trim();
      if (!id) continue;
      m.set(id, c);
    }
    return m;
  }, [customers]);

  const caseManagerOptions = React.useMemo<CaseManagerOption[]>(() => {
    const map = new Map<string, string>();

    for (const c of customers as Array<Record<string, unknown>>) {
      const cmId = String(c?.caseManagerId || "").trim();
      const cmName = String(c?.caseManagerName || "").trim();
      if (cmId) map.set(cmId, cmName || cmId);
    }

    for (const e of enrollments as Array<Record<string, unknown>>) {
      const customerId = String(e?.customerId || e?.clientId || "").trim();
      const customer = customersById.get(customerId);
      const cm = readCaseManagerForEnrollment(e, customer);
      if (cm.id && cm.id !== "unassigned") map.set(cm.id, cm.name);
    }

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [customers, customersById, enrollments]);

  const groupedRows = React.useMemo<ProgramRow[]>(() => {
    const byGrant = new Map<string, ProgramRow>();

    for (const raw of enrollments as Array<Record<string, unknown>>) {
      const grantId = String(raw?.grantId || "").trim();
      if (!grantId) continue;

      const grant = grantsById.get(grantId);
      const bucket = bucketForGrant(grant);
      if (filterState.bucket !== "all" && bucket !== filterState.bucket) continue;

      const customerId = String(raw?.customerId || raw?.clientId || "").trim();
      const customer = customersById.get(customerId);
      const cm = readCaseManagerForEnrollment(raw, customer);
      if (filterState.caseManagerId !== "all" && cm.id !== filterState.caseManagerId) continue;

      if (!byGrant.has(grantId)) {
        byGrant.set(grantId, {
          grantId,
          grantName: grantNameById.get(grantId) || String(grant?.name || grantId),
          bucket,
          activeCount: 0,
          inactiveCount: 0,
          activeEnrollments: [],
        });
      }

      const row = byGrant.get(grantId)!;
      const active = enrollmentIsActive(raw);
      if (active) {
        row.activeCount += 1;
        row.activeEnrollments.push({
          id: String(raw?.id || `${grantId}:${customerId}:${row.activeCount}`),
          customerId,
          customerName: customerNameById.get(customerId) || String(raw?.customerName || raw?.clientName || customerId || "-"),
          caseManagerId: cm.id,
          caseManagerName: cm.name,
          startDate: String(raw?.startDate || ""),
          status: enrollmentStatusLabel(raw),
        });
      } else {
        row.inactiveCount += 1;
      }
    }

    const out = Array.from(byGrant.values());
    for (const row of out) {
      row.activeEnrollments.sort((a, b) => a.customerName.localeCompare(b.customerName));
    }
    out.sort((a, b) => a.grantName.localeCompare(b.grantName));
    return out;
  }, [
    enrollments,
    grantsById,
    customersById,
    customerNameById,
    grantNameById,
    filterState.bucket,
    filterState.caseManagerId,
  ]);

  return {
    rows: groupedRows,
    caseManagerOptions,
    sharedDataLoading,
    sharedDataError,
    sharedDataOk,
    isTruncated,
  };
}

export const AllEnrollmentsTopbar = ({
  value,
  onChange,
  selection: _selection,
  nav,
}: {
  value: AllEnrollmentsFilterState;
  onChange: (next: AllEnrollmentsFilterState) => void;
  selection: AllEnrollmentsSelection;
  nav: {
    stack: NavCrumb<AllEnrollmentsSelection>[];
    push: (c: NavCrumb<AllEnrollmentsSelection>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<AllEnrollmentsSelection>[]) => void;
  };
}) => {
  const { rows, caseManagerOptions } = useAllEnrollmentRows(value);

  const exportRows = React.useMemo<EnrollmentSummaryExportRow[]>(
    () =>
      rows.map((r) => ({
        ...r,
        total: r.activeCount + r.inactiveCount,
      })),
    [rows]
  );

  return (
    <div className="flex items-center gap-2">
      <select
        className="input"
        value={value.bucket}
        onChange={(e) => onChange({ ...value, bucket: e.currentTarget.value as AllEnrollmentsFilterState["bucket"] })}
        aria-label="Program or grant filter"
      >
        <option value="all">All Programs/Grants</option>
        <option value="program">Programs only</option>
        <option value="grant">Grants only</option>
      </select>

      <select
        className="input"
        value={value.caseManagerId}
        onChange={(e) => onChange({ ...value, caseManagerId: e.currentTarget.value })}
        aria-label="Case manager filter"
      >
        <option value="all">All Case Managers</option>
        {caseManagerOptions.map((cm) => (
          <option key={cm.id} value={cm.id}>
            {cm.label}
          </option>
        ))}
      </select>

      <button
        className="btn btn-ghost btn-xs"
        onClick={() => {
          nav.reset();
          onChange({ bucket: "all", caseManagerId: "all" });
        }}
      >
        Reset
      </button>

      <SmartExportButton
        allRows={exportRows}
        activeRows={exportRows}
        filenameBase="enrollment-totals"
        columns={[
          { key: "grantName", label: "Program/Grant", value: (r: EnrollmentSummaryExportRow) => r.grantName },
          { key: "bucket", label: "Type", value: (r: EnrollmentSummaryExportRow) => r.bucket },
          { key: "activeCount", label: "Enrolled (Active)", value: (r: EnrollmentSummaryExportRow) => r.activeCount },
          { key: "inactiveCount", label: "Inactive", value: (r: EnrollmentSummaryExportRow) => r.inactiveCount },
          { key: "total", label: "Total", value: (r: EnrollmentSummaryExportRow) => r.total },
        ]}
        buttonLabel="Export"
        className="btn btn-ghost"
      />
    </div>
  );
};

export const AllEnrollmentsSidebar = ({
  filterState,
  onFilterChange: _onFilterChange,
  selection,
  onSelect,
  nav,
}: {
  filterState: AllEnrollmentsFilterState;
  onFilterChange: (next: AllEnrollmentsFilterState) => void;
  selection: AllEnrollmentsSelection;
  onSelect: (sel: AllEnrollmentsSelection) => void;
  nav: {
    stack: NavCrumb<AllEnrollmentsSelection>[];
    push: (c: NavCrumb<AllEnrollmentsSelection>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<AllEnrollmentsSelection>[]) => void;
  };
}) => {
  const { rows } = useAllEnrollmentRows(filterState);
  const selectedGrantId = String(selection?.grantId || "");

  return (
    <div className="p-3 space-y-2">
      <div className="text-xs font-semibold text-slate-700">Programs and Grants ({rows.length})</div>

      <button
        className={`w-full text-left text-xs px-2 py-1 rounded border ${!selectedGrantId ? "bg-slate-100 border-slate-300" : "border-slate-200"}`}
        onClick={() => {
          onSelect(null);
          nav.reset();
        }}
      >
        All Programs/Grants
      </button>

      <div className="space-y-1 max-h-[60vh] overflow-auto">
        {rows.map((r) => {
          const active = selectedGrantId === r.grantId;
          return (
            <button
              key={r.grantId}
              className={`w-full text-left text-xs px-2 py-1 rounded border ${active ? "bg-slate-100 border-slate-300" : "border-slate-200"}`}
              onClick={() => {
                const next: AllEnrollmentsSelection = { grantId: r.grantId };
                onSelect(next);
                nav.setStack([{ key: r.grantId, label: r.grantName, selection: next }]);
              }}
            >
              <div className="font-medium truncate">{r.grantName}</div>
              <div className="text-slate-500">
                {r.bucket} | Active: {r.activeCount} | Inactive: {r.inactiveCount}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const AllEnrollmentsMain = ({
  filterState,
  onFilterChange: _onFilterChange,
  selection,
  onSelect,
  nav,
}: {
  filterState: AllEnrollmentsFilterState;
  onFilterChange?: (next: AllEnrollmentsFilterState) => void;
  selection: AllEnrollmentsSelection;
  onSelect: (sel: AllEnrollmentsSelection) => void;
  nav: {
    stack: NavCrumb<AllEnrollmentsSelection>[];
    push: (c: NavCrumb<AllEnrollmentsSelection>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<AllEnrollmentsSelection>[]) => void;
  };
}) => {
  const { rows, sharedDataLoading, sharedDataError, isTruncated } = useAllEnrollmentRows(filterState);
  const { sort: summarySort, onSort: onSummarySort } = useTableSort();
  const { sort: detailSort, onSort: onDetailSort } = useTableSort();

  const sortedRows = React.useMemo(
    () =>
      sortRows(rows, summarySort, (r, col) => {
        if (col === "grantName") return r.grantName;
        if (col === "bucket") return r.bucket;
        if (col === "activeCount") return r.activeCount;
        if (col === "inactiveCount") return r.inactiveCount;
        return null;
      }),
    [rows, summarySort]
  );

  const pagination = usePagination(sortedRows, 50);
  const selected = rows.find((r) => r.grantId === String(selection?.grantId || "")) || null;

  const sortedDetail = React.useMemo(
    () =>
      sortRows(selected?.activeEnrollments || [], detailSort, (e, col) => {
        if (col === "customerName") return e.customerName;
        if (col === "caseManagerName") return e.caseManagerName;
        if (col === "startDate") return e.startDate;
        if (col === "status") return e.status;
        return null;
      }),
    [selected?.activeEnrollments, detailSort]
  );

  const detailPager = usePagination(sortedDetail, 50);

  if (selected) {
    return (
      <ToolCard
        title={
          <div className="flex items-center gap-2">
            <span>{selected.grantName}</span>
            <span className="text-xs font-normal text-slate-500">({selected.bucket})</span>
          </div>
        }
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onSelect(null);
              nav.reset();
            }}
          >
            Back to all
          </button>
        }
      >
        {(isTruncated.enrollments || isTruncated.customers) && (
          <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
            Data may be incomplete — org exceeds display limit
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded border border-slate-200 px-3 py-2">
            <div className="text-xs text-slate-500">Enrolled (Active)</div>
            <div className="text-xl font-semibold">{selected.activeCount}</div>
          </div>
          <div className="rounded border border-slate-200 px-3 py-2">
            <div className="text-xs text-slate-500">Inactive</div>
            <div className="text-xl font-semibold">{selected.inactiveCount}</div>
          </div>
          <div className="rounded border border-slate-200 px-3 py-2">
            <div className="text-xs text-slate-500">Total</div>
            <div className="text-xl font-semibold">{selected.activeCount + selected.inactiveCount}</div>
          </div>
        </div>

        <ToolTable
          headers={[
            <SortableHeader key="customerName" label="Customer" col="customerName" sort={detailSort} onSort={onDetailSort} />,
            <SortableHeader key="caseManagerName" label="Case Manager" col="caseManagerName" sort={detailSort} onSort={onDetailSort} />,
            <SortableHeader key="startDate" label="Start Date" col="startDate" sort={detailSort} onSort={onDetailSort} defaultDir="desc" />,
            <SortableHeader key="status" label="Status" col="status" sort={detailSort} onSort={onDetailSort} />,
          ]}
          rows={
            sharedDataLoading ? (
              <tr>
                <td colSpan={4}>Loading enrollments...</td>
              </tr>
            ) : sharedDataError ? (
              <tr>
                <td colSpan={4}>Failed to load enrollments.</td>
              </tr>
            ) : detailPager.pageRows.length ? (
              detailPager.pageRows.map((e) => (
                <tr key={e.id}>
                  <td>{e.customerName || e.customerId || "-"}</td>
                  <td>{e.caseManagerName || "Unassigned"}</td>
                  <td>{fmtDateOrDash(e.startDate)}</td>
                  <td className="capitalize">{e.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>No active customers in this program/grant for current filters.</td>
              </tr>
            )
          }
        />
        <Pagination page={detailPager.page} pageCount={detailPager.pageCount} setPage={detailPager.setPage} />
      </ToolCard>
    );
  }

  return (
    <ToolCard title="All Enrollments">
      {(isTruncated.enrollments || isTruncated.customers) && (
        <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          Data may be incomplete — org exceeds display limit
        </div>
      )}
      <ToolTable
        headers={[
          <SortableHeader key="grantName" label="Program/Grant" col="grantName" sort={summarySort} onSort={onSummarySort} />,
          <SortableHeader key="bucket" label="Type" col="bucket" sort={summarySort} onSort={onSummarySort} />,
          <SortableHeader key="activeCount" label="Enrolled (Active)" col="activeCount" sort={summarySort} onSort={onSummarySort} defaultDir="desc" align="right" />,
          <SortableHeader key="inactiveCount" label="Inactive" col="inactiveCount" sort={summarySort} onSort={onSummarySort} defaultDir="desc" align="right" />,
        ]}
        rows={
          sharedDataLoading ? (
            <tr>
              <td colSpan={4}>Loading enrollments...</td>
            </tr>
          ) : sharedDataError ? (
            <tr>
              <td colSpan={4}>Failed to load enrollments.</td>
            </tr>
          ) : pagination.pageRows.length ? (
            pagination.pageRows.map((r) => (
              <tr
                key={r.grantId}
                className="cursor-pointer"
                onClick={() => {
                  const next: AllEnrollmentsSelection = { grantId: r.grantId };
                  onSelect(next);
                  nav.setStack([{ key: r.grantId, label: r.grantName, selection: next }]);
                }}
              >
                <td>{r.grantName}</td>
                <td className="capitalize">{r.bucket}</td>
                <td className="text-right">{r.activeCount}</td>
                <td className="text-right">{r.inactiveCount}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4}>No enrollments match current filters.</td>
            </tr>
          )
        }
      />
      <Pagination page={pagination.page} pageCount={pagination.pageCount} setPage={pagination.setPage} />
    </ToolCard>
  );
};

// Legacy wrapper export retained for compatibility in case any old imports still render this directly.
export function AllEnrollmentsTool() {
  return <AllEnrollmentsMain filterState={{ bucket: "all", caseManagerId: "all" }} selection={null} onSelect={() => {}} nav={{ stack: [], push: () => {}, pop: () => {}, reset: () => {}, setStack: () => {} }} />;
}
