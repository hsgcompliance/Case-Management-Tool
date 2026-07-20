import React from "react";
import { fmtDateOrDash } from "@lib/formatters";
import { useTableSort, SortableHeader, sortRows } from "@hooks/useTableSort";
import { Pagination, usePagination } from "@entities/ui/dashboardStyle/Pagination";
import { SmartExportButton, type ExportColumn } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { FilteringMetricChip } from "@entities/metrics/FilteringMetricChip";
import { useAdminEnrollmentsData } from "@entities/Page/dashboardStyle/hooks/useAdminEnrollmentsData";
import { NavCrumb } from "@entities/Page/dashboardStyle/types";
import {
  EnrollmentReportRow,
  EnrollmentRowSummary,
  GrantBucket,
  PopulationKey,
  POPULATION_KEYS,
  applyBaseFilters,
  applyChipFilters,
  buildEnrollmentReportRows,
  groupRowsByGrant,
  groupRowsByPopulation,
  summarizeEnrollmentRows,
} from "./allEnrollmentsModel";

export type AllEnrollmentsView = "programs" | "populations" | "customers";

export type AllEnrollmentsFilterState = {
  bucket: "all" | GrantBucket;
  caseManagerId: string;
  // Newer fields are optional so previously-persisted filter prefs keep working.
  view?: AllEnrollmentsView;
  status?: "all" | "active" | "inactive";
  population?: "all" | PopulationKey;
  newThisMonth?: boolean;
  migratedOnly?: boolean;
  query?: string;
};

type NormalizedFilters = Required<AllEnrollmentsFilterState>;

export function normalizeAllEnrollmentsFilters(value: AllEnrollmentsFilterState): NormalizedFilters {
  return {
    bucket: value.bucket === "grant" || value.bucket === "program" ? value.bucket : "all",
    caseManagerId: value.caseManagerId || "all",
    view: value.view === "populations" || value.view === "customers" ? value.view : "programs",
    status: value.status === "active" || value.status === "inactive" ? value.status : "all",
    population: POPULATION_KEYS.includes(value.population as PopulationKey)
      ? (value.population as PopulationKey)
      : "all",
    newThisMonth: value.newThisMonth === true,
    migratedOnly: value.migratedOnly === true,
    query: String(value.query || ""),
  };
}

export const DEFAULT_ALL_ENROLLMENTS_FILTERS: NormalizedFilters = normalizeAllEnrollmentsFilters({
  bucket: "all",
  caseManagerId: "all",
});

export type AllEnrollmentsSelection = {
  grantId: string;
} | null;

type ToolNav = {
  stack: NavCrumb<AllEnrollmentsSelection>[];
  push: (c: NavCrumb<AllEnrollmentsSelection>) => void;
  pop: () => void;
  reset: () => void;
  setStack: (s: NavCrumb<AllEnrollmentsSelection>[]) => void;
};

type CaseManagerOption = { id: string; label: string };

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useAllEnrollmentsReport(rawFilters: AllEnrollmentsFilterState) {
  const filters = normalizeAllEnrollmentsFilters(rawFilters);
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

  const asOf = React.useMemo(() => todayISO(), []);

  const grantsById = React.useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const g of grants as Array<Record<string, unknown>>) {
      const id = String(g?.id || "").trim();
      if (id) m.set(id, g);
    }
    return m;
  }, [grants]);

  const customersById = React.useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const c of customers as Array<Record<string, unknown>>) {
      const id = String(c?.id || "").trim();
      if (id) m.set(id, c);
    }
    return m;
  }, [customers]);

  const allRows = React.useMemo(
    () =>
      buildEnrollmentReportRows({
        enrollments: enrollments as Array<Record<string, unknown>>,
        customersById,
        grantsById,
        customerNameById,
        grantNameById,
        asOf,
      }),
    [enrollments, customersById, grantsById, customerNameById, grantNameById, asOf]
  );

  const caseManagerOptions = React.useMemo<CaseManagerOption[]>(() => {
    const map = new Map<string, string>();
    for (const r of allRows) {
      if (r.caseManagerId && r.caseManagerId !== "unassigned") map.set(r.caseManagerId, r.caseManagerName);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  // Base filters scope the whole report; chip filters narrow the visible rows so
  // the metric chips can keep showing the scoped-but-untoggled counts.
  const { bucket, caseManagerId, query, status, population, newThisMonth, migratedOnly } = filters;
  const baseRows = React.useMemo(
    () => applyBaseFilters(allRows, { bucket, caseManagerId, query }),
    [allRows, bucket, caseManagerId, query]
  );
  const visibleRows = React.useMemo(
    () => applyChipFilters(baseRows, { status, population, newThisMonth, migratedOnly }),
    [baseRows, status, population, newThisMonth, migratedOnly]
  );
  const baseSummary = React.useMemo(() => summarizeEnrollmentRows(baseRows), [baseRows]);

  return {
    filters,
    asOf,
    allRows,
    baseRows,
    visibleRows,
    baseSummary,
    caseManagerOptions,
    sharedDataLoading,
    sharedDataError,
    sharedDataOk,
    isTruncated,
  };
}

function fmtMonths(value: number | null): string {
  if (value == null) return "-";
  return `${value} mo`;
}

function migrationLabel(row: EnrollmentReportRow, grantNameLookup?: (id: string) => string): string {
  const parts: string[] = [];
  if (row.migratedIn) {
    const from = row.migratedInFromGrantId && grantNameLookup ? grantNameLookup(row.migratedInFromGrantId) : row.migratedInFromGrantId;
    parts.push(from ? `in ← ${from}` : "in");
  }
  if (row.migratedOut) {
    const to = row.migratedOutToGrantId && grantNameLookup ? grantNameLookup(row.migratedOutToGrantId) : row.migratedOutToGrantId;
    parts.push(to ? `out → ${to}` : "out");
  }
  return parts.join(" | ");
}

const DETAIL_EXPORT_COLUMNS: ExportColumn<EnrollmentReportRow>[] = [
  { key: "customerName", label: "Customer", value: (r) => r.customerName },
  { key: "population", label: "Population", value: (r) => r.population },
  { key: "grantName", label: "Program/Grant", value: (r) => r.grantName },
  { key: "bucket", label: "Type", value: (r) => r.bucket },
  { key: "caseManagerName", label: "Case Manager", value: (r) => r.caseManagerName },
  { key: "startDate", label: "Start Date", value: (r) => r.startDate },
  { key: "endDate", label: "End Date", value: (r) => r.endDate },
  { key: "status", label: "Enrollment Status", value: (r) => r.status },
  { key: "monthsActive", label: "Months In Enrollment", value: (r) => r.monthsActive ?? "" },
  { key: "isNewInMonth", label: "New This Month", value: (r) => (r.isNewInMonth ? "yes" : "no") },
  { key: "migratedIn", label: "Migrated In", value: (r) => (r.migratedIn ? "yes" : "no") },
  { key: "migratedInFromGrantId", label: "Migrated From Grant", value: (r) => r.migratedInFromGrantId },
  { key: "migratedOut", label: "Migrated Out", value: (r) => (r.migratedOut ? "yes" : "no") },
  { key: "migratedOutToGrantId", label: "Migrated To Grant", value: (r) => r.migratedOutToGrantId },
  { key: "customerActive", label: "Customer Status", value: (r) => (r.customerActive ? "active" : "inactive") },
  { key: "customerSince", label: "Customer Since", value: (r) => r.customerSince },
  { key: "customerTenureMonths", label: "Customer Tenure (Months)", value: (r) => r.customerTenureMonths ?? "" },
];

const VIEW_LABELS: Record<AllEnrollmentsView, string> = {
  programs: "By Program/Grant",
  populations: "By Population",
  customers: "Customer List",
};

export const AllEnrollmentsTopbar = ({
  value,
  onChange,
  selection: _selection,
  nav,
}: {
  value: AllEnrollmentsFilterState;
  onChange: (next: AllEnrollmentsFilterState) => void;
  selection: AllEnrollmentsSelection;
  nav: ToolNav;
}) => {
  const { filters, baseRows, visibleRows, caseManagerOptions } = useAllEnrollmentsReport(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-slate-200 overflow-hidden" role="tablist" aria-label="Report view">
        {(Object.keys(VIEW_LABELS) as AllEnrollmentsView[]).map((view) => (
          <button
            key={view}
            role="tab"
            aria-selected={filters.view === view}
            className={`px-2.5 py-1.5 text-xs ${filters.view === view ? "bg-slate-800 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            onClick={() => onChange({ ...value, view })}
          >
            {VIEW_LABELS[view]}
          </button>
        ))}
      </div>

      <select
        className="input"
        value={filters.bucket}
        onChange={(e) => onChange({ ...value, bucket: e.currentTarget.value as AllEnrollmentsFilterState["bucket"] })}
        aria-label="Program or grant filter"
      >
        <option value="all">All Programs/Grants</option>
        <option value="program">Programs only</option>
        <option value="grant">Grants only</option>
      </select>

      <select
        className="input"
        value={filters.caseManagerId}
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

      <input
        className="input w-48"
        placeholder="Search customer/grant/CM..."
        value={filters.query}
        onChange={(e) => onChange({ ...value, query: e.currentTarget.value })}
        aria-label="Search enrollments"
      />

      <button
        className="btn btn-ghost btn-xs"
        onClick={() => {
          nav.reset();
          onChange({ ...DEFAULT_ALL_ENROLLMENTS_FILTERS });
        }}
      >
        Reset
      </button>

      <SmartExportButton
        allRows={baseRows}
        activeRows={visibleRows}
        filenameBase="enrollments-detail"
        columns={DETAIL_EXPORT_COLUMNS}
        buttonLabel="Export"
        className="btn btn-ghost"
      />
    </div>
  );
};

function MetricChipsRow({
  filters,
  summary,
  loading,
  onChange,
  value,
}: {
  filters: NormalizedFilters;
  summary: EnrollmentRowSummary;
  loading: boolean;
  onChange: (next: AllEnrollmentsFilterState) => void;
  value: AllEnrollmentsFilterState;
}) {
  const chipsAreDefault =
    filters.status === "all" && filters.population === "all" && !filters.newThisMonth && !filters.migratedOnly;
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      <FilteringMetricChip
        label="Total Enrollments"
        value={loading ? null : summary.total}
        sub={loading ? null : `${summary.distinctCustomers} customers`}
        tone="slate"
        loading={loading}
        active={chipsAreDefault}
        onClick={() =>
          onChange({ ...value, status: "all", population: "all", newThisMonth: false, migratedOnly: false })
        }
        hoverText={true}
      />
      <FilteringMetricChip
        label="Active"
        value={loading ? null : summary.active}
        tone="emerald"
        loading={loading}
        active={filters.status === "active"}
        onClick={() => onChange({ ...value, status: filters.status === "active" ? "all" : "active" })}
        hoverText={true}
      />
      <FilteringMetricChip
        label="Inactive"
        value={loading ? null : summary.inactive}
        tone="rose"
        loading={loading}
        active={filters.status === "inactive"}
        onClick={() => onChange({ ...value, status: filters.status === "inactive" ? "all" : "inactive" })}
        hoverText={true}
      />
      <FilteringMetricChip
        label="New This Month"
        value={loading ? null : summary.newThisMonth}
        tone="sky"
        loading={loading}
        active={filters.newThisMonth}
        onClick={() => onChange({ ...value, newThisMonth: !filters.newThisMonth })}
        hoverText={true}
      />
      <FilteringMetricChip
        label="Migrated"
        value={loading ? null : summary.migratedCustomers}
        sub={loading ? null : `${summary.migratedIn} in | ${summary.migratedOut} out`}
        tone="violet"
        loading={loading}
        active={filters.migratedOnly}
        onClick={() => onChange({ ...value, migratedOnly: !filters.migratedOnly })}
        hoverText={true}
      />
      <FilteringMetricChip
        label="Unknown Population"
        value={loading ? null : summary.unknownPopulation}
        tone="amber"
        loading={loading}
        active={filters.population === "Unknown"}
        onClick={() => onChange({ ...value, population: filters.population === "Unknown" ? "all" : "Unknown" })}
        hoverText={true}
      />
      {POPULATION_KEYS.filter((p) => p !== "Unknown").map((population) => (
        <FilteringMetricChip
          key={population}
          label={population}
          value={loading ? null : summary.byPopulation[population].total}
          sub={loading ? null : `${summary.byPopulation[population].active} active`}
          tone="slate"
          loading={loading}
          active={filters.population === population}
          onClick={() => onChange({ ...value, population: filters.population === population ? "all" : population })}
          hoverText={true}
        />
      ))}
    </div>
  );
}

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
  nav: ToolNav;
}) => {
  const { baseRows } = useAllEnrollmentsReport(filterState);
  const groups = React.useMemo(() => groupRowsByGrant(baseRows), [baseRows]);
  const selectedGrantId = String(selection?.grantId || "");

  return (
    <div className="p-3 space-y-2">
      <div className="text-xs font-semibold text-slate-700">Programs and Grants ({groups.length})</div>

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
        {groups.map((g) => {
          const active = selectedGrantId === g.grantId;
          return (
            <button
              key={g.grantId}
              className={`w-full text-left text-xs px-2 py-1 rounded border ${active ? "bg-slate-100 border-slate-300" : "border-slate-200"}`}
              onClick={() => {
                const next: AllEnrollmentsSelection = { grantId: g.grantId };
                onSelect(next);
                nav.setStack([{ key: g.grantId, label: g.grantName, selection: next }]);
              }}
            >
              <div className="font-medium truncate">{g.grantName}</div>
              <div className="text-slate-500">
                {g.bucket} | Active: {g.summary.active} | Inactive: {g.summary.inactive}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

function TruncationBanner({ isTruncated }: { isTruncated: { customers: boolean; enrollments: boolean } }) {
  if (!isTruncated.enrollments && !isTruncated.customers) return null;
  return (
    <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
      Data may be incomplete — org exceeds display limit
    </div>
  );
}

function EnrollmentRowsTable({
  rows,
  loading,
  error,
  showGrant,
  pageSize = 50,
}: {
  rows: EnrollmentReportRow[];
  loading: boolean;
  error: boolean;
  showGrant: boolean;
  pageSize?: number;
}) {
  const { sort, onSort } = useTableSort();
  const sorted = React.useMemo(
    () =>
      sortRows(rows, sort, (r, col) => {
        if (col === "customerName") return r.customerName;
        if (col === "population") return r.population;
        if (col === "grantName") return r.grantName;
        if (col === "caseManagerName") return r.caseManagerName;
        if (col === "startDate") return r.startDate;
        if (col === "endDate") return r.endDate;
        if (col === "status") return r.status;
        if (col === "monthsActive") return r.monthsActive ?? -1;
        if (col === "customerTenureMonths") return r.customerTenureMonths ?? -1;
        return null;
      }),
    [rows, sort]
  );
  const pager = usePagination(sorted, pageSize);
  const colCount = showGrant ? 10 : 9;

  return (
    <>
      <ToolTable
        headers={[
          <SortableHeader key="customerName" label="Customer" col="customerName" sort={sort} onSort={onSort} />,
          <SortableHeader key="population" label="Population" col="population" sort={sort} onSort={onSort} />,
          ...(showGrant
            ? [<SortableHeader key="grantName" label="Program/Grant" col="grantName" sort={sort} onSort={onSort} />]
            : []),
          <SortableHeader key="caseManagerName" label="Case Manager" col="caseManagerName" sort={sort} onSort={onSort} />,
          <SortableHeader key="startDate" label="Start" col="startDate" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="endDate" label="End" col="endDate" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="status" label="Status" col="status" sort={sort} onSort={onSort} />,
          <SortableHeader key="monthsActive" label="Months Enrolled" col="monthsActive" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="customerTenureMonths" label="Customer Tenure" col="customerTenureMonths" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          "Migration",
        ]}
        rows={
          loading ? (
            <tr>
              <td colSpan={colCount}>Loading enrollments...</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={colCount}>Failed to load enrollments.</td>
            </tr>
          ) : pager.pageRows.length ? (
            pager.pageRows.map((r) => (
              <tr key={r.enrollmentId}>
                <td>
                  {r.customerName || r.customerId || "-"}
                  {r.isNewInMonth ? (
                    <span className="ml-1 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium text-sky-800">new</span>
                  ) : null}
                </td>
                <td>{r.population}</td>
                {showGrant ? <td>{r.grantName}</td> : null}
                <td>{r.caseManagerName || "Unassigned"}</td>
                <td>{fmtDateOrDash(r.startDate)}</td>
                <td>{fmtDateOrDash(r.endDate)}</td>
                <td className="capitalize">{r.status}</td>
                <td className="text-right">{fmtMonths(r.monthsActive)}</td>
                <td className="text-right" title={r.customerSince ? `Since ${r.customerSince} (${r.customerActive ? "active" : "inactive"})` : undefined}>
                  {fmtMonths(r.customerTenureMonths)}
                </td>
                <td className="text-xs text-violet-700">{migrationLabel(r) || "-"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={colCount}>No enrollments match current filters.</td>
            </tr>
          )
        }
      />
      <Pagination page={pager.page} pageCount={pager.pageCount} setPage={pager.setPage} />
    </>
  );
}

type GrantSummaryExportRow = {
  grantName: string;
  bucket: GrantBucket;
  active: number;
  inactive: number;
  total: number;
  newThisMonth: number;
  migratedIn: number;
  migratedOut: number;
  avgMonthsActive: number | null;
  youth: number;
  individual: number;
  family: number;
  unknownPopulation: number;
};

const GRANT_SUMMARY_EXPORT_COLUMNS: ExportColumn<GrantSummaryExportRow>[] = [
  { key: "grantName", label: "Program/Grant", value: (r) => r.grantName },
  { key: "bucket", label: "Type", value: (r) => r.bucket },
  { key: "active", label: "Active", value: (r) => r.active },
  { key: "inactive", label: "Inactive", value: (r) => r.inactive },
  { key: "total", label: "Total", value: (r) => r.total },
  { key: "newThisMonth", label: "New This Month", value: (r) => r.newThisMonth },
  { key: "migratedIn", label: "Migrated In", value: (r) => r.migratedIn },
  { key: "migratedOut", label: "Migrated Out", value: (r) => r.migratedOut },
  { key: "avgMonthsActive", label: "Avg Months Enrolled", value: (r) => r.avgMonthsActive ?? "" },
  { key: "youth", label: "Youth", value: (r) => r.youth },
  { key: "individual", label: "Individual", value: (r) => r.individual },
  { key: "family", label: "Family", value: (r) => r.family },
  { key: "unknownPopulation", label: "Unknown Population", value: (r) => r.unknownPopulation },
];

function grantGroupToExportRow(g: { grantName: string; bucket: GrantBucket; summary: EnrollmentRowSummary }): GrantSummaryExportRow {
  return {
    grantName: g.grantName,
    bucket: g.bucket,
    active: g.summary.active,
    inactive: g.summary.inactive,
    total: g.summary.total,
    newThisMonth: g.summary.newThisMonth,
    migratedIn: g.summary.migratedIn,
    migratedOut: g.summary.migratedOut,
    avgMonthsActive: g.summary.avgMonthsActive,
    youth: g.summary.byPopulation.Youth.total,
    individual: g.summary.byPopulation.Individual.total,
    family: g.summary.byPopulation.Family.total,
    unknownPopulation: g.summary.byPopulation.Unknown.total,
  };
}

function ProgramsView({
  rows,
  loading,
  error,
  onSelectGrant,
}: {
  rows: EnrollmentReportRow[];
  loading: boolean;
  error: boolean;
  onSelectGrant: (grantId: string, grantName: string) => void;
}) {
  const groups = React.useMemo(() => groupRowsByGrant(rows), [rows]);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const { sort, onSort } = useTableSort();

  const sortedGroups = React.useMemo(
    () =>
      sortRows(groups, sort, (g, col) => {
        if (col === "grantName") return g.grantName;
        if (col === "bucket") return g.bucket;
        if (col === "active") return g.summary.active;
        if (col === "inactive") return g.summary.inactive;
        if (col === "total") return g.summary.total;
        if (col === "newThisMonth") return g.summary.newThisMonth;
        if (col === "migrated") return g.summary.migratedIn + g.summary.migratedOut;
        if (col === "avgMonths") return g.summary.avgMonthsActive ?? -1;
        return null;
      }),
    [groups, sort]
  );

  const pager = usePagination(sortedGroups, 50);
  const exportRows = React.useMemo(() => groups.map(grantGroupToExportRow), [groups]);

  const toggle = (grantId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(grantId)) next.delete(grantId);
      else next.add(grantId);
      return next;
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <SmartExportButton
          allRows={exportRows}
          activeRows={exportRows}
          filenameBase="enrollments-by-program"
          columns={GRANT_SUMMARY_EXPORT_COLUMNS}
          buttonLabel="Export This View"
          className="btn btn-ghost btn-sm"
        />
      </div>
      <ToolTable
        caption="Enrollments by program/grant"
        headers={[
          <SortableHeader key="grantName" label="Program/Grant" col="grantName" sort={sort} onSort={onSort} />,
          <SortableHeader key="bucket" label="Type" col="bucket" sort={sort} onSort={onSort} />,
          <SortableHeader key="active" label="Active" col="active" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="inactive" label="Inactive" col="inactive" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="total" label="Total" col="total" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="newThisMonth" label="New This Month" col="newThisMonth" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="migrated" label="Migrated (In/Out)" col="migrated" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="avgMonths" label="Avg Months" col="avgMonths" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          "",
        ]}
        rows={
          loading ? (
            <tr>
              <td colSpan={9}>Loading enrollments...</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={9}>Failed to load enrollments.</td>
            </tr>
          ) : pager.pageRows.length ? (
            pager.pageRows.map((g) => {
              const isOpen = expanded.has(g.grantId);
              return (
                <React.Fragment key={g.grantId}>
                  <tr className="cursor-pointer" onClick={() => toggle(g.grantId)}>
                    <td>
                      <span className="mr-1 inline-block w-3 text-slate-400">{isOpen ? "▾" : "▸"}</span>
                      {g.grantName}
                    </td>
                    <td className="capitalize">{g.bucket}</td>
                    <td className="text-right">{g.summary.active}</td>
                    <td className="text-right">{g.summary.inactive}</td>
                    <td className="text-right">{g.summary.total}</td>
                    <td className="text-right">{g.summary.newThisMonth}</td>
                    <td className="text-right">
                      {g.summary.migratedIn} / {g.summary.migratedOut}
                    </td>
                    <td className="text-right">{fmtMonths(g.summary.avgMonthsActive)}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectGrant(g.grantId, g.grantName);
                        }}
                      >
                        Details →
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={9} className="bg-slate-50 p-2">
                        <div className="max-h-80 overflow-auto rounded border border-slate-200 bg-white">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="px-2 py-1">Customer</th>
                                <th className="px-2 py-1">Population</th>
                                <th className="px-2 py-1">Case Manager</th>
                                <th className="px-2 py-1">Start</th>
                                <th className="px-2 py-1">Status</th>
                                <th className="px-2 py-1 text-right">Months</th>
                                <th className="px-2 py-1">Migration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.rows.map((r) => (
                                <tr key={r.enrollmentId} className="border-t border-slate-100">
                                  <td className="px-2 py-1">
                                    {r.customerName}
                                    {r.isNewInMonth ? (
                                      <span className="ml-1 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium text-sky-800">new</span>
                                    ) : null}
                                  </td>
                                  <td className="px-2 py-1">{r.population}</td>
                                  <td className="px-2 py-1">{r.caseManagerName}</td>
                                  <td className="px-2 py-1">{fmtDateOrDash(r.startDate)}</td>
                                  <td className="px-2 py-1 capitalize">{r.status}</td>
                                  <td className="px-2 py-1 text-right">{fmtMonths(r.monthsActive)}</td>
                                  <td className="px-2 py-1 text-violet-700">{migrationLabel(r) || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })
          ) : (
            <tr>
              <td colSpan={9}>No enrollments match current filters.</td>
            </tr>
          )
        }
      />
      <Pagination page={pager.page} pageCount={pager.pageCount} setPage={pager.setPage} />
    </div>
  );
}

type PopulationSummaryExportRow = {
  population: PopulationKey;
  active: number;
  inactive: number;
  total: number;
  newThisMonth: number;
  distinctCustomers: number;
  avgMonthsActive: number | null;
};

const POPULATION_SUMMARY_EXPORT_COLUMNS: ExportColumn<PopulationSummaryExportRow>[] = [
  { key: "population", label: "Population", value: (r) => r.population },
  { key: "active", label: "Active", value: (r) => r.active },
  { key: "inactive", label: "Inactive", value: (r) => r.inactive },
  { key: "total", label: "Total", value: (r) => r.total },
  { key: "newThisMonth", label: "New This Month", value: (r) => r.newThisMonth },
  { key: "distinctCustomers", label: "Customers", value: (r) => r.distinctCustomers },
  { key: "avgMonthsActive", label: "Avg Months Enrolled", value: (r) => r.avgMonthsActive ?? "" },
];

function PopulationsView({
  rows,
  loading,
  error,
}: {
  rows: EnrollmentReportRow[];
  loading: boolean;
  error: boolean;
}) {
  const groups = React.useMemo(() => groupRowsByPopulation(rows), [rows]);
  const [collapsed, setCollapsed] = React.useState<Set<PopulationKey>>(new Set());

  const exportRows = React.useMemo<PopulationSummaryExportRow[]>(
    () =>
      groups.map((g) => ({
        population: g.population,
        active: g.summary.active,
        inactive: g.summary.inactive,
        total: g.summary.total,
        newThisMonth: g.summary.newThisMonth,
        distinctCustomers: g.summary.distinctCustomers,
        avgMonthsActive: g.summary.avgMonthsActive,
      })),
    [groups]
  );

  const toggle = (population: PopulationKey) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(population)) next.delete(population);
      else next.add(population);
      return next;
    });

  if (loading) return <div className="text-sm text-slate-500 p-3">Loading enrollments...</div>;
  if (error) return <div className="text-sm text-slate-500 p-3">Failed to load enrollments.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <SmartExportButton
          allRows={exportRows}
          activeRows={exportRows}
          filenameBase="enrollments-by-population"
          columns={POPULATION_SUMMARY_EXPORT_COLUMNS}
          buttonLabel="Export This View"
          className="btn btn-ghost btn-sm"
        />
      </div>
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.population);
        return (
          <div key={g.population} className="rounded border border-slate-200">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
              onClick={() => toggle(g.population)}
              aria-expanded={!isCollapsed}
            >
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 text-slate-400">{isCollapsed ? "▸" : "▾"}</span>
                <span className="text-sm font-semibold">{g.population}</span>
                <span className="text-xs text-slate-500">
                  {g.summary.distinctCustomers} customer{g.summary.distinctCustomers === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>Active: <b>{g.summary.active}</b></span>
                <span>Inactive: <b>{g.summary.inactive}</b></span>
                <span>Total: <b>{g.summary.total}</b></span>
                <span>New: <b>{g.summary.newThisMonth}</b></span>
                <span>Avg: <b>{fmtMonths(g.summary.avgMonthsActive)}</b></span>
              </div>
            </button>
            {!isCollapsed ? (
              <div className="border-t border-slate-200 p-2">
                {g.rows.length ? (
                  <EnrollmentRowsTable rows={g.rows} loading={false} error={false} showGrant={true} pageSize={25} />
                ) : (
                  <div className="p-2 text-xs text-slate-500">No enrollments in this population for current filters.</div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function GrantDetailView({
  grantId,
  rows,
  loading,
  error,
  onBack,
}: {
  grantId: string;
  rows: EnrollmentReportRow[];
  loading: boolean;
  error: boolean;
  onBack: () => void;
}) {
  const grantRows = React.useMemo(() => rows.filter((r) => r.grantId === grantId), [rows, grantId]);
  const summary = React.useMemo(() => summarizeEnrollmentRows(grantRows), [grantRows]);
  const grantName = grantRows[0]?.grantName || grantId;
  const bucket = grantRows[0]?.bucket || "grant";

  return (
    <ToolCard
      title={
        <div className="flex items-center gap-2">
          <span>{grantName}</span>
          <span className="text-xs font-normal text-slate-500">({bucket})</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <SmartExportButton
            allRows={grantRows}
            activeRows={grantRows}
            filenameBase={`enrollments-${grantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            columns={DETAIL_EXPORT_COLUMNS}
            buttonLabel="Export"
            className="btn btn-ghost btn-sm"
          />
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Back to all
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Active", value: summary.active },
          { label: "Inactive", value: summary.inactive },
          { label: "Total", value: summary.total },
          { label: "New This Month", value: summary.newThisMonth },
          { label: "Migrated In", value: summary.migratedIn },
          { label: "Migrated Out", value: summary.migratedOut },
          { label: "Avg Months", value: fmtMonths(summary.avgMonthsActive) },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded border border-slate-200 px-3 py-2">
            <div className="text-xs text-slate-500">{kpi.label}</div>
            <div className="text-xl font-semibold">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded border border-slate-200 p-2">
        <div className="mb-1 text-xs font-semibold text-slate-600">Population breakdown</div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-700">
          {POPULATION_KEYS.map((population) => {
            const counts = summary.byPopulation[population];
            return (
              <span key={population}>
                {population}: <b>{counts.total}</b> ({counts.active} active)
              </span>
            );
          })}
        </div>
      </div>

      <EnrollmentRowsTable rows={grantRows} loading={loading} error={error} showGrant={false} />
    </ToolCard>
  );
}

export const AllEnrollmentsMain = ({
  filterState,
  onFilterChange,
  selection,
  onSelect,
  nav,
}: {
  filterState: AllEnrollmentsFilterState;
  onFilterChange?: (next: AllEnrollmentsFilterState) => void;
  selection: AllEnrollmentsSelection;
  onSelect: (sel: AllEnrollmentsSelection) => void;
  nav: ToolNav;
}) => {
  const {
    filters,
    visibleRows,
    baseSummary,
    sharedDataLoading,
    sharedDataError,
    isTruncated,
  } = useAllEnrollmentsReport(filterState);

  const handleFilterChange = onFilterChange || (() => {});
  const selectedGrantId = String(selection?.grantId || "");

  const chips = (
    <MetricChipsRow
      filters={filters}
      summary={baseSummary}
      loading={sharedDataLoading}
      onChange={handleFilterChange}
      value={filterState}
    />
  );

  if (selectedGrantId) {
    return (
      <div className="space-y-3">
        <TruncationBanner isTruncated={isTruncated} />
        {chips}
        <GrantDetailView
          grantId={selectedGrantId}
          rows={visibleRows}
          loading={sharedDataLoading}
          error={sharedDataError}
          onBack={() => {
            onSelect(null);
            nav.reset();
          }}
        />
      </div>
    );
  }

  return (
    <ToolCard title={`Enrollments — ${VIEW_LABELS[filters.view]}`}>
      <TruncationBanner isTruncated={isTruncated} />
      {chips}
      {filters.view === "programs" ? (
        <ProgramsView
          rows={visibleRows}
          loading={sharedDataLoading}
          error={sharedDataError}
          onSelectGrant={(grantId, grantName) => {
            const next: AllEnrollmentsSelection = { grantId };
            onSelect(next);
            nav.setStack([{ key: grantId, label: grantName, selection: next }]);
          }}
        />
      ) : null}
      {filters.view === "populations" ? (
        <PopulationsView rows={visibleRows} loading={sharedDataLoading} error={sharedDataError} />
      ) : null}
      {filters.view === "customers" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <SmartExportButton
              allRows={visibleRows}
              activeRows={visibleRows}
              filenameBase="enrolled-customers"
              columns={DETAIL_EXPORT_COLUMNS}
              buttonLabel="Export This View"
              className="btn btn-ghost btn-sm"
            />
          </div>
          <EnrollmentRowsTable rows={visibleRows} loading={sharedDataLoading} error={sharedDataError} showGrant={true} />
        </div>
      ) : null}
    </ToolCard>
  );
};

// Legacy wrapper export retained for compatibility in case any old imports still render this directly.
export function AllEnrollmentsTool() {
  return (
    <AllEnrollmentsMain
      filterState={{ ...DEFAULT_ALL_ENROLLMENTS_FILTERS }}
      selection={null}
      onSelect={() => {}}
      nav={{ stack: [], push: () => {}, pop: () => {}, reset: () => {}, setStack: () => {} }}
    />
  );
}
