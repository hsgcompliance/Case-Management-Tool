"use client";

import React from "react";
import CaseManagerSelect, { type CaseManagerOption } from "@entities/selectors/CaseManagerSelect";
import { useGrants } from "@hooks/useGrants";
import { PageFilterBar } from "@entities/Page";
import { FilterToggleGroup } from "@entities/ui";
import type { EnrollmentStatusBucket } from "@hooks/useEnrollments";

type ActiveMode = "all" | "active" | "inactive";
type DeletedMode = "exclude" | "include" | "only";
type ScopeMode = "all" | "my" | "primary" | "secondary";
type PopulationFilter = "all" | "Youth" | "Individual" | "Family" | "unknown";
type TierFilter = "all" | "1" | "2" | "3";
type CustomerSortMode =
  | "alphabetical"
  | "first-added"
  | "last-added"
  | "first-updated"
  | "last-updated"
  | "tier-asc"
  | "tier-desc";

type FilterOption<T extends string> = { value: T; label: string };

const SCOPE_OPTIONS: Array<FilterOption<ScopeMode>> = [
  { value: "all", label: "All" },
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
];
const STATUS_OPTIONS: Array<FilterOption<ActiveMode>> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];
const DELETED_OPTIONS: Array<FilterOption<DeletedMode>> = [
  { value: "exclude", label: "Exclude" },
  { value: "include", label: "Include" },
  { value: "only", label: "Only" },
];
const POPULATION_OPTIONS: Array<FilterOption<PopulationFilter>> = [
  { value: "all", label: "All" },
  { value: "Youth", label: "Youth" },
  { value: "Individual", label: "Individual" },
  { value: "Family", label: "Family" },
  { value: "unknown", label: "Unknown" },
];
const TIER_OPTIONS: Array<FilterOption<TierFilter>> = [
  { value: "all", label: "All" },
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
  { value: "3", label: "Tier 3" },
];
const SORT_OPTIONS: Array<FilterOption<CustomerSortMode>> = [
  { value: "alphabetical", label: "A-Z" },
  { value: "first-added", label: "First Added" },
  { value: "last-added", label: "Last Added" },
  { value: "first-updated", label: "First Updated" },
  { value: "last-updated", label: "Last Updated" },
  { value: "tier-asc", label: "Tier 1→3" },
  { value: "tier-desc", label: "Tier 3→1" },
];

const ENROLLMENT_STATUS_OPTIONS: Array<{ value: EnrollmentStatusBucket; label: string }> = [
  { value: "active", label: "Active Enrollments" },
  { value: "closed", label: "Closed Enrollments" },
  { value: "deleted", label: "Deleted Enrollments" },
];

function EnrollmentGrantFilter({
  value,
  statuses,
  onChange,
  onStatusesChange,
}: {
  value: string;
  statuses: EnrollmentStatusBucket[];
  onChange: (v: string) => void;
  onStatusesChange: (v: EnrollmentStatusBucket[]) => void;
}) {
  const { data: grants = [] } = useGrants({ limit: 500 });
  const [open, setOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const sorted = React.useMemo(
    () =>
      [...grants]
        .filter((g) => !g.deleted && String(g.status || "").toLowerCase() !== "deleted")
        .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
    [grants],
  );
  const selectedStatuses = React.useMemo(() => new Set(statuses), [statuses]);
  const allStatusesSelected = statuses.length === ENROLLMENT_STATUS_OPTIONS.length;
  const statusSummary = allStatusesSelected
    ? "All enrollment statuses"
    : ENROLLMENT_STATUS_OPTIONS
        .filter((option) => selectedStatuses.has(option.value))
        .map((option) => option.label.replace(" Enrollments", ""))
        .join(", ") || "No statuses selected";

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleStatus = React.useCallback(
    (status: EnrollmentStatusBucket) => {
      const next = new Set(statuses);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      onStatusesChange(ENROLLMENT_STATUS_OPTIONS.map((option) => option.value).filter((nextStatus) => next.has(nextStatus)));
    },
    [onStatusesChange, statuses],
  );

  return (
    <div className="min-w-[240px] space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Enrollment
      </div>
      <div className="relative flex items-center gap-1" ref={popoverRef}>
        <select
          className="select min-w-0 flex-1 text-sm"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
        >
          <option value="all">All (no filter)</option>
          {sorted.map((g) => (
            <option key={String(g.id)} value={String(g.id)}>
              {String(g.name || g.id || "")}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={[
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-slate-600 transition",
            open
              ? "border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
          ].join(" ")}
          onClick={() => setOpen((prev) => !prev)}
          title="Advanced enrollment filters"
          aria-label="Advanced enrollment filters"
          aria-expanded={open}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16" />
            <path d="M7 12h10" />
            <path d="M10 17h4" />
          </svg>
        </button>
        {open ? (
          <div className="absolute right-0 top-10 z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Enrollment Filters</div>
            <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">{statusSummary}</div>
            <div className="space-y-2">
              {ENROLLMENT_STATUS_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(option.value)}
                    onChange={() => toggleStatus(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-lg"
                onClick={() => onStatusesChange(ENROLLMENT_STATUS_OPTIONS.map((option) => option.value))}
              >
                All
              </button>
              <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type CustomerFilterBarProps = {
  myUid: string;
  isAdminUser: boolean;
  search: string;
  resultLabel?: string;
  searchPlaceholder?: string;
  defaultExpanded?: boolean;
  activeMode: ActiveMode;
  deletedMode: DeletedMode;
  scopeMode: ScopeMode;
  cmFilter: string;
  populationFilter: PopulationFilter;
  tierFilter: TierFilter;
  sortMode: CustomerSortMode;
  grantFilter: string;
  enrollmentStatuses: EnrollmentStatusBucket[];
  caseManagerOptions: CaseManagerOption[];
  onActiveModeChange: (mode: ActiveMode) => void;
  onDeletedModeChange: (mode: DeletedMode) => void;
  onScopeModeChange: (mode: ScopeMode) => void;
  onCmFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onPopulationFilterChange: (value: PopulationFilter) => void;
  onTierFilterChange: (value: TierFilter) => void;
  onSortModeChange: (value: CustomerSortMode) => void;
  onGrantFilterChange: (value: string) => void;
  onEnrollmentStatusesChange: (value: EnrollmentStatusBucket[]) => void;
  onResetFilters: () => void;
  onSearchEnter?: () => void;
  /** When provided, renders the "Refresh Enrollments" action below the filters. */
  refreshEnrollments?: { onClick: () => void; isRefreshing: boolean; disabled: boolean } | null;
};

export function CustomerFilterBar({
  myUid,
  isAdminUser,
  search,
  resultLabel,
  searchPlaceholder,
  defaultExpanded = false,
  activeMode,
  deletedMode,
  scopeMode,
  cmFilter,
  populationFilter,
  tierFilter,
  sortMode,
  grantFilter,
  enrollmentStatuses,
  caseManagerOptions,
  onActiveModeChange,
  onDeletedModeChange,
  onScopeModeChange,
  onCmFilterChange,
  onSearchChange,
  onPopulationFilterChange,
  onTierFilterChange,
  onSortModeChange,
  onGrantFilterChange,
  onEnrollmentStatusesChange,
  onResetFilters,
  onSearchEnter,
  refreshEnrollments,
}: CustomerFilterBarProps) {
  return (
    <PageFilterBar
      search={search}
      onSearchChange={onSearchChange}
      onSearchEnter={onSearchEnter}
      searchPlaceholder={searchPlaceholder}
      resultLabel={resultLabel}
      defaultExpanded={defaultExpanded}
      actions={
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={onResetFilters}>
            Clear
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-4">
        <FilterToggleGroup label="Status" value={activeMode} options={STATUS_OPTIONS} onChange={onActiveModeChange} />
        {isAdminUser ? (
          <FilterToggleGroup label="Deleted" value={deletedMode} options={DELETED_OPTIONS} onChange={onDeletedModeChange} />
        ) : null}
        <FilterToggleGroup label="Population" value={populationFilter} options={POPULATION_OPTIONS} onChange={onPopulationFilterChange} />
        <FilterToggleGroup label="Tier" value={tierFilter} options={TIER_OPTIONS} onChange={onTierFilterChange} />
        <FilterToggleGroup
          label="Scope"
          value={scopeMode}
          options={SCOPE_OPTIONS.filter((option) => !!myUid || option.value !== "my")}
          onChange={onScopeModeChange}
        />
        <div className="min-w-[200px] space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Case Manager
          </div>
          <CaseManagerSelect
            value={cmFilter === "all" ? null : cmFilter}
            onChange={(uid) => onCmFilterChange(uid || "all")}
            options={caseManagerOptions}
            includeAll
            allLabel="All"
          />
        </div>
        <EnrollmentGrantFilter
          value={grantFilter}
          statuses={enrollmentStatuses}
          onChange={onGrantFilterChange}
          onStatusesChange={onEnrollmentStatusesChange}
        />
        <FilterToggleGroup label="Sort" value={sortMode} options={SORT_OPTIONS} onChange={onSortModeChange} />
      </div>
      {refreshEnrollments ? (
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            type="button"
            className="btn btn-sm rounded-lg border border-sky-300 bg-sky-50 text-sky-900 hover:border-sky-400 hover:bg-sky-100"
            onClick={refreshEnrollments.onClick}
            disabled={refreshEnrollments.disabled}
            title="Pre-loads enrollment data for all visible customers, not just your caseload."
          >
            {refreshEnrollments.isRefreshing ? "Refreshing Enrollments..." : "Refresh Enrollments"}
          </button>
        </div>
      ) : null}
    </PageFilterBar>
  );
}

export default CustomerFilterBar;
