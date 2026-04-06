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
import { qk } from "@hooks/queryKeys";
import type { TGrant as Grant } from "@types";
import { ProgramGroupSection } from "./ProgramGroupSection";

type FilterMode = "active" | "inactive";

const isVisible = (g?: Partial<Grant> | null) =>
  !!g && g.status !== "deleted" && g.deleted !== true;

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
        // Explicit ID assignment
        grpPrograms = grp.grantIds
          .map((id) => visible.find((g) => String(g.id) === id))
          .filter((g): g is Grant => !!g);
      } else if (grp.populations && grp.populations.length > 0) {
        // Population-based fallback: match by grant's population field
        grpPrograms = visible.filter((g) => {
          const pop = String((g as any)?.population || "").toLowerCase();
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProgramsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>("active");
  const [search, setSearch] = useState("");
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [creatingProgram, setCreatingProgram] = useState(false);

  const { data: activeData = [], isLoading } = useGrants({ active: true, limit: 200 });
  const { data: inactiveData = [] } = useGrants({ active: false, limit: 200 });
  const { data: config } = useOrgConfig();

  const rows = useMemo(() => {
    const source = filter === "active" ? activeData : inactiveData;
    return (source as Grant[]).filter((g) => isVisible(g));
  }, [activeData, inactiveData, filter]);

  const searchLower = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchLower) return rows;
    return rows.filter(
      (g) =>
        String(g.name || "").toLowerCase().includes(searchLower) ||
        String(g.id || "").toLowerCase().includes(searchLower),
    );
  }, [rows, searchLower]);

  const sections = useMemo(
    () => groupProgramsByConfig(filtered, config),
    [filtered, config],
  );

  const itemConfig = config?.programDisplay.items ?? {};
  const totalCount = rows.length;
  const filteredCount = filtered.length;

  const onRefresh = async () => {
    await qc.invalidateQueries({ queryKey: qk.grants.root });
  };

  const onOpen = (id: string) => setSelectedGrantId(id);

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
                Enrollment overview across all grants and programs. Click a row to view details, tasks, and assessments.
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

          {/* Filter bar */}
          <PageFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name or ID"
            resultLabel={
              searchLower ? `${filteredCount} / ${totalCount} results` : undefined
            }
            actions={
              search ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearch("")}>
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
          initialCreateData={{ kind: "program" } as any}
          onClose={() => setCreatingProgram(false)}
          onCreated={(id) => { setCreatingProgram(false); setSelectedGrantId(id); }}
        />
      )}
    </ListStyleLayout>
  );
}

export default ProgramsPage;
