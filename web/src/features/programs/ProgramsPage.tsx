// web/src/features/programs/ProgramsPage.tsx
"use client";
import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import GrantWorkspaceModal from "@features/grants/GrantWorkspaceModal";
import PinnedGrantCards from "@features/grants/PinnedGrantCards";
import { ListStyleLayout } from "@entities/Page/listStyle";
import PageShell from "@entities/Page/PageShell";
import PageFilterBar from "@entities/Page/PageFilterBar";
import { FilterToggleGroup } from "@entities/ui";
import RefreshButton from "@entities/ui/RefreshButton";
import { useGrants } from "@hooks/useGrants";
import { useOrgConfig } from "@hooks/useOrgConfig";
import {
  filterRows,
  SmartFilterHeader,
  sortRows,
  useTableColumnFilters,
  useTableSort,
  type SortState,
} from "@hooks/useTableSort";
import { qk } from "@hooks/queryKeys";
import type { TGrant as Grant } from "@types";
import { ProgramGroupSection } from "./ProgramGroupSection";

type FilterMode = "active" | "inactive";
type KindFilter = "all" | "program" | "grant";
type FocusFilter = "all" | "active" | "empty" | "uncased";
type PopulationFilter = "all" | "youth" | "family" | "individual";

const isVisible = (g?: Partial<Grant> | null) =>
  !!g && g.status !== "deleted" && g.deleted !== true;

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNum(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ─── Grouping logic ───────────────────────────────────────────────────────────

function groupProgramsByConfig(
  programs: Grant[],
  config: ReturnType<typeof useOrgConfig>["data"],
) {
  const groups = config?.programDisplay.groups ?? [];
  const itemConfig = config?.programDisplay.items ?? {};

  // Filter out explicitly hidden items
  const visible = programs.filter((g) => {
    const cfg = itemConfig[String(g.id)];
    return cfg?.visible !== false;
  });

  if (groups.length === 0) {
    return [{ key: "_all", label: "All Programs", programs: visible }];
  }

  const assigned = new Set<string>();
  const result = groups
    .map((grp) => {
      let grpPrograms: Grant[];

      if (grp.grantIds.length > 0) {
        // Explicit ID assignment, preserving the current sorted row order.
        const ids = new Set(grp.grantIds.map(String));
        grpPrograms = visible.filter((g) => ids.has(String(g.id)));
      } else if (grp.populations && grp.populations.length > 0) {
        // Population-based fallback: match by grant's population field
        grpPrograms = visible.filter((g) => {
          const pop = String(asObj(g).population || "").toLowerCase();
          return grp.populations!.some((p) => p === pop);
        });
      } else {
        grpPrograms = [];
      }

      grpPrograms.forEach((g) => assigned.add(String(g.id)));
      return { key: grp.key, label: grp.label, programs: grpPrograms };
    })
    .filter((s) => s.programs.length > 0);

  // Programs not matched by any group
  const unconfigured = visible.filter((g) => !assigned.has(String(g.id)));
  if (unconfigured.length > 0) {
    result.push({ key: "_other", label: "Other", programs: unconfigured });
  }

  return result;
}

const DEFAULT_PROGRAM_SORT: SortState = { col: "active", dir: "desc" };

function isGrantKind(g: Grant) {
  return String(asObj(g).kind || "").toLowerCase() !== "program";
}

function budgetTotal(g: Grant) {
  const budget = asObj(asObj(g).budget);
  const totals = asObj(budget.totals);
  return asNum(totals.total ?? budget.total);
}

function enrollmentCounts(g: Grant) {
  const allMetrics = asObj(asObj(g).metrics);
  const metrics = asObj(allMetrics.enrollmentCounts);
  const customers = asObj(allMetrics.customers);
  const caseManagers = asObj(allMetrics.caseManagers);
  const pop = asObj(metrics.population);
  return {
    active: asNum(metrics.active),
    inactive: asNum(metrics.inactive),
    unique: asNum(customers.uniqueTotal ?? metrics.uniqueClients),
    caseManagers: asNum(caseManagers.total),
    youth: asNum(pop.youth ?? pop.Youth),
    family: asNum(pop.family ?? pop.Family),
    individual: asNum(pop.individual ?? pop.Individual),
  };
}

function getProgramColumnValue(g: Grant, col: string) {
  const counts = enrollmentCounts(g);
  if (col === "name") return String(g.name || g.id || "");
  if (col === "kind") return isGrantKind(g) ? "Grant" : "Program";
  if (col === "active") return counts.active;
  if (col === "inactive") return counts.inactive;
  if (col === "clients") return counts.unique;
  if (col === "population") {
    const parts = [];
    if (counts.youth > 0) parts.push("Youth");
    if (counts.family > 0) parts.push("Family");
    if (counts.individual > 0) parts.push("Individual");
    return parts.join(", ") || "None";
  }
  if (col === "cms") return counts.caseManagers;
  if (col === "budget") return budgetTotal(g);
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProgramsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>("active");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [populationFilter, setPopulationFilter] = useState<PopulationFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const { sort, onSort, setSortDir } = useTableSort();
  const { filters: columnFilters, setColumnFilter, clearFilters } = useTableColumnFilters();

  const { data: activeData = [], isLoading } = useGrants({ active: true, limit: 200 });
  const { data: inactiveData = [] } = useGrants({ active: false, limit: 200 });
  const { data: config } = useOrgConfig();

  const rows = useMemo(() => {
    const source = filter === "active" ? activeData : inactiveData;
    return (source as Grant[]).filter((g) => isVisible(g));
  }, [activeData, inactiveData, filter]);

  const searchLower = search.trim().toLowerCase();
  const baseFiltered = useMemo(() => {
    if (!searchLower) return rows;
    return rows.filter(
      (g) =>
        String(g.name || "").toLowerCase().includes(searchLower) ||
        String(g.id || "").toLowerCase().includes(searchLower),
    );
  }, [rows, searchLower]);

  const quickFiltered = useMemo(() => {
    return baseFiltered.filter((g) => {
      const counts = enrollmentCounts(g);
      const kindPass =
        kindFilter === "all" ? true
        : kindFilter === "grant" ? isGrantKind(g)
        : !isGrantKind(g);
      const focusPass =
        focusFilter === "all" ? true
        : focusFilter === "active" ? counts.active > 0
        : focusFilter === "empty" ? counts.active === 0
        : counts.caseManagers === 0;
      const populationPass =
        populationFilter === "all" ? true
        : counts[populationFilter] > 0;
      return kindPass && focusPass && populationPass;
    });
  }, [baseFiltered, focusFilter, kindFilter, populationFilter]);

  const filtered = useMemo(
    () => filterRows(quickFiltered, columnFilters, getProgramColumnValue),
    [quickFiltered, columnFilters],
  );

  const sorted = useMemo(
    () => sortRows(filtered, sort ?? DEFAULT_PROGRAM_SORT, getProgramColumnValue),
    [filtered, sort],
  );

  const sections = useMemo(
    () => groupProgramsByConfig(sorted, config),
    [sorted, config],
  );

  const itemConfig = config?.programDisplay.items ?? {};
  const totalCount = rows.length;
  const filteredCount = filtered.length;
  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, g) => {
        const counts = enrollmentCounts(g);
        acc.active += counts.active;
        acc.inactive += counts.inactive;
        acc.youth += counts.youth;
        acc.family += counts.family;
        acc.individual += counts.individual;
        acc.grants += isGrantKind(g) ? 1 : 0;
        acc.programs += isGrantKind(g) ? 0 : 1;
        return acc;
      },
      { active: 0, inactive: 0, youth: 0, family: 0, individual: 0, grants: 0, programs: 0 },
    );
  }, [filtered]);

  const columnValues = (col: string) => () => quickFiltered.map((row) => getProgramColumnValue(row, col));
  const renderSmartHeader = (
    col: string,
    label: React.ReactNode,
    defaultDir: "asc" | "desc" = "asc",
    align?: "right",
  ) => (
    <SmartFilterHeader
      label={label}
      col={col}
      sort={sort}
      onSort={onSort}
      setSortDir={setSortDir}
      defaultDir={defaultDir}
      align={align}
      filter={columnFilters[col]}
      onFilterChange={(next) => setColumnFilter(col, next)}
      values={columnValues(col)}
    />
  );

  const onRefresh = async () => {
    await qc.invalidateQueries({ queryKey: qk.grants.root });
  };

  const onOpen = (id: string) => setSelectedGrantId(id);
  const hasColumnFilters = Object.keys(columnFilters).length > 0;

  return (
    <ListStyleLayout>
      <PageShell metricsArea={null}>
        <section className="space-y-8" data-tour="programs-page">
          {/* Page header */}
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Programs
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Population enrollment counts, active/inactive totals, and grant/program tracking in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {totalCount} {totalCount === 1 ? "grant / program" : "grants / programs"}
              </div>
              <RefreshButton queryKeys={[qk.grants.root]} label="Refresh" onRefresh={onRefresh} />
              <button
                className="btn btn-xs"
                onClick={() => setCreatingProgram(true)}
              >
                + Program
              </button>
            </div>
          </div>

          {/* Pinned grants */}
          <PinnedGrantCards />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Active Enrollments</div>
              <div className="mt-1 text-2xl font-bold text-emerald-800 dark:text-emerald-200">{summary.active}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Inactive Enrollments</div>
              <div className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{summary.inactive}</div>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/20">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-300">Youth</div>
              <div className="mt-1 text-2xl font-bold text-sky-800 dark:text-sky-200">{summary.youth}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">Family</div>
              <div className="mt-1 text-2xl font-bold text-amber-800 dark:text-amber-200">{summary.family}</div>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-900/50 dark:bg-teal-950/20">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">Individual</div>
              <div className="mt-1 text-2xl font-bold text-teal-800 dark:text-teal-200">{summary.individual}</div>
            </div>
          </div>

          {/* Filter bar */}
          <PageFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name or ID"
            resultLabel={
              searchLower ? `${filteredCount} / ${totalCount} results` : undefined
            }
            actions={
              search || hasColumnFilters ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSearch("");
                    clearFilters();
                  }}
                >
                  Clear
                </button>
              ) : undefined
            }
          >
            <FilterToggleGroup
              label="Status"
              value={filter}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              onChange={setFilter}
            />
            <FilterToggleGroup
              label="Type"
              value={kindFilter}
              options={[
                { value: "all", label: "All" },
                { value: "program", label: "Programs" },
                { value: "grant", label: "Grants" },
              ]}
              onChange={setKindFilter}
            />
            <FilterToggleGroup
              label="Focus"
              value={focusFilter}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Has Active" },
                { value: "empty", label: "No Active" },
                { value: "uncased", label: "No CM" },
              ]}
              onChange={setFocusFilter}
            />
            <FilterToggleGroup
              label="Population"
              value={populationFilter}
              options={[
                { value: "all", label: "All" },
                { value: "youth", label: "Youth" },
                { value: "family", label: "Family" },
                { value: "individual", label: "Individual" },
              ]}
              onChange={setPopulationFilter}
            />
          </PageFilterBar>

          {/* Content */}
          {isLoading && filter === "active" ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading…
            </div>
          ) : sections.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {searchLower ? "No results match your search." : "No grants or programs found."}
            </div>
          ) : (
            <div className="space-y-10">
              {sections.map((s) => (
                <ProgramGroupSection
                  key={s.key}
                  label={s.label}
                  programs={s.programs}
                  itemConfig={itemConfig}
                  onOpen={onOpen}
                  renderHeader={renderSmartHeader}
                />
              ))}
            </div>
          )}
        </section>
      </PageShell>
      {/* View existing grant/program */}
      {selectedGrantId && (
        <GrantWorkspaceModal
          grantId={selectedGrantId}
          onClose={() => setSelectedGrantId(null)}
        />
      )}
      {/* Create new program */}
      {creatingProgram && (
        <GrantWorkspaceModal
          grantId={null}
          initialCreateData={{ kind: "program" } as Partial<Grant>}
          onClose={() => setCreatingProgram(false)}
          onCreated={(id) => { setCreatingProgram(false); setSelectedGrantId(id); }}
        />
      )}
    </ListStyleLayout>
  );
}

export default ProgramsPage;
