// web/src/features/grants/GrantsPage.tsx
"use client";

// @deprecated — Use /budget and /programs pages instead. This page is kept for
// backwards-compatible deep links only and will be removed in a future release.
import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListStyleLayout } from "@entities/Page/listStyle";
import { useRouter } from "next/navigation";
import RefreshButton from "@entities/ui/RefreshButton";
import PageShell from "@entities/Page/PageShell";
import PageFilterBar from "@entities/Page/PageFilterBar";
import { FilterToggleGroup } from "@entities/ui";
import { useGrants } from "@hooks/useGrants";
import { qk } from "@hooks/queryKeys";
import { useGrantMetrics } from "@hooks/useMetrics";
import { metricTextClass, populationChipClass, toneTextClass } from "@lib/colorRegistry";
import type { TGrant as Grant } from "@types";
import CreditCardsPanel from "./CreditCardsPanel";
import PinnedGrantCards, { useTogglePinnedGrant, usePinnedGrantIds } from "./PinnedGrantCards";
import { useTogglePinnedItem, usePinnedItems } from "@entities/pinned/PinnedItemsSection";

type GrantBucket = "grant" | "program";
type FilterMode = "active" | "inactive";

const isVisible = (g?: Partial<Grant> | null) => !!g && g.status !== "deleted" && g.deleted !== true;

const fmtUsd0 = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const getBudget = (g: Partial<Grant>) => {
  const b = (g?.budget || {}) as Record<string, unknown>;
  const t = ((b?.totals as Record<string, unknown> | undefined) || {}) as Record<string, unknown>;
  const total = Number((b?.total ?? b?.startAmount ?? 0) as number);
  const spent = Number((t?.spent ?? b?.spent ?? 0) as number);
  const projected = Number((t?.projected ?? b?.projected ?? 0) as number);
  const balance = Number(t?.balance ?? total - spent);
  return { total, spent, projected, balance };
};

const bucketFor = (g: Partial<Grant>): GrantBucket => {
  const kind = String(g?.kind || "").toLowerCase();
  return kind === "program" ? "program" : "grant";
};

// ─── Pin buttons (shared) ────────────────────────────────────────────────────

function PinButtons({
  isPinned,
  isDashPinned,
  onTogglePin,
  onToggleDashPin,
}: {
  isPinned: boolean;
  isDashPinned: boolean;
  onTogglePin: () => void;
  onToggleDashPin: () => void;
}) {
  return (
    <div className="col-span-2 flex items-center justify-end gap-0.5">
      <button
        type="button"
        title={isDashPinned ? "Unpin from dashboard" : "Pin to dashboard"}
        onClick={(e) => { e.stopPropagation(); onToggleDashPin(); }}
        className={`flex items-center justify-center rounded-full p-1 text-xs transition ${isDashPinned ? "text-sky-400 hover:text-sky-500" : "text-slate-300 hover:text-sky-400 dark:text-slate-600"}`}
      >
        📌
      </button>
      <button
        type="button"
        title={isPinned ? "Unpin" : "Pin to grants page"}
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        className={`flex items-center justify-center rounded-full p-1 text-sm transition ${isPinned ? "text-amber-400 hover:text-amber-500" : "text-slate-300 hover:text-amber-400 dark:text-slate-600"}`}
      >
        {isPinned ? "★" : "☆"}
      </button>
    </div>
  );
}

// ─── Grant Row (budget columns) ───────────────────────────────────────────────

function GrantRow({
  grant,
  isPinned,
  isDashPinned,
  onOpen,
  onTogglePin,
  onToggleDashPin,
}: {
  grant: Grant;
  isPinned: boolean;
  isDashPinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onToggleDashPin: () => void;
}) {
  const budget = getBudget(grant);
  const { data: gm } = useGrantMetrics(grant.id);

  return (
    <div
      data-block-id={`grant:${grant.id}`}
      data-block-name={String(grant.name || grant.id)}
      className="group grid w-full grid-cols-12 items-center gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 dark:border-slate-700"
    >
      <button
        type="button"
        onClick={onOpen}
        className="col-span-10 grid grid-cols-10 items-center gap-3 text-left hover:opacity-80"
      >
        <div className="col-span-10 md:col-span-3">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{String(grant.name || grant.id)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">ID: {String(grant.id || "-")}</div>
        </div>
        <div className="col-span-5 text-sm font-medium text-slate-800 dark:text-slate-200 md:col-span-2 md:text-right">{fmtUsd0(budget.total)}</div>
        <div className="col-span-5 text-sm text-slate-600 dark:text-slate-300 md:col-span-2 md:text-right">{fmtUsd0(budget.spent)}</div>
        <div
          className="col-span-5 text-sm md:col-span-2 md:text-right"
          title="Queued / projected unpaid obligations"
        >
          <span className={budget.projected > 0 ? toneTextClass("amber") : "text-slate-400 dark:text-slate-500"}>
            {budget.projected > 0 ? fmtUsd0(budget.projected) : "—"}
          </span>
        </div>
        <div
          className="col-span-5 text-right text-xs text-slate-500 dark:text-slate-400 md:col-span-1"
          title={gm ? `Active: ${gm.enrollments.active} · Total: ${gm.enrollments.total}` : undefined}
        >
          {gm ? gm.enrollments.active : (grant as any)?.metrics?.enrollmentCounts?.active ?? "—"} enrolled
        </div>
      </button>
      <PinButtons
        isPinned={isPinned}
        isDashPinned={isDashPinned}
        onTogglePin={onTogglePin}
        onToggleDashPin={onToggleDashPin}
      />
    </div>
  );
}

// ─── Program Row (enrollment + population columns) ────────────────────────────

const POP_LABELS: Record<string, string> = { youth: "Y", family: "F", individual: "I" };

function PopPill({ popKey, count }: { popKey: string; count: number }) {
  if (!count) return null;
  const letter = POP_LABELS[popKey] ?? popKey[0]?.toUpperCase() ?? "?";
  return (
    <span
      className={["inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", populationChipClass(popKey)].join(" ")}
      title={`${popKey[0].toUpperCase() + popKey.slice(1)}: ${count}`}
    >
      {letter} {count}
    </span>
  );
}

function ProgramRow({
  grant,
  isPinned,
  isDashPinned,
  onOpen,
  onTogglePin,
  onToggleDashPin,
}: {
  grant: Grant;
  isPinned: boolean;
  isDashPinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onToggleDashPin: () => void;
}) {
  const { data: gm, isLoading } = useGrantMetrics(grant.id);
  const enrollActive = gm?.enrollments.active ?? (grant as any)?.metrics?.enrollmentCounts?.active ?? "—";
  const enrollTotal = gm?.enrollments.total ?? null;
  const uniqueClients = gm?.customers.uniqueTotal ?? "—";
  const cmCount = gm?.caseManagers.total ?? "—";
  const pop = gm?.enrollments.byPopulation;

  // Fallback: use embedded grant metrics population if grantMetrics not yet reconciled
  const embeddedPop = (grant as any)?.metrics?.enrollmentCounts?.population as Record<string, number> | undefined;
  const displayPop = pop ?? (embeddedPop
    ? { youth: embeddedPop.Youth ?? 0, family: embeddedPop.Family ?? 0, individual: embeddedPop.Individual ?? 0, unknown: embeddedPop.unknown ?? 0 }
    : null);

  return (
    <div
      data-block-id={`grant:${grant.id}`}
      data-block-name={String(grant.name || grant.id)}
      className="group grid w-full grid-cols-12 items-center gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 dark:border-slate-700"
    >
      <button
        type="button"
        onClick={onOpen}
        className="col-span-10 grid grid-cols-10 items-center gap-3 text-left hover:opacity-80"
      >
        <div className="col-span-10 md:col-span-3">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{String(grant.name || grant.id)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">ID: {String(grant.id || "-")}</div>
        </div>
        {/* Active enrollments */}
        <div
          className={["col-span-5 text-right text-sm font-semibold md:col-span-2", metricTextClass("grant-active-enrollments")].join(" ")}
          title={enrollTotal != null ? `Active: ${enrollActive} · Total: ${enrollTotal}` : undefined}
        >
          {isLoading ? "…" : enrollActive}
        </div>
        {/* Unique clients */}
        <div
          className={["col-span-5 text-right text-sm font-semibold md:col-span-2", metricTextClass("grant-unique-clients")].join(" ")}
          title={gm ? `Unique clients: ${gm.customers.uniqueTotal} (${gm.customers.activeUniqueTotal} active)` : undefined}
        >
          {isLoading ? "…" : uniqueClients}
        </div>
        {/* Population pills */}
        <div className="col-span-5 flex flex-wrap justify-end gap-1 md:col-span-2">
          {displayPop
            ? (["youth", "individual", "family"] as const).map((k) => (
                <PopPill key={k} popKey={k} count={displayPop[k] ?? 0} />
              ))
            : <span className="text-xs text-slate-300">—</span>
          }
        </div>
        {/* CM count */}
        <div
          className="col-span-5 text-right text-xs text-slate-500 dark:text-slate-400 md:col-span-1"
          title={gm?.caseManagers.refs?.map((r) => r.name ?? r.id).join(", ")}
        >
          {isLoading ? "…" : (cmCount !== "—" && cmCount > 0 ? `${cmCount} CMs` : "—")}
        </div>
      </button>
      <PinButtons
        isPinned={isPinned}
        isDashPinned={isDashPinned}
        onTogglePin={onTogglePin}
        onToggleDashPin={onToggleDashPin}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GrantsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [view, setView] = useState<GrantBucket>("grant");
  const [filter, setFilter] = useState<FilterMode>("active");
  const [search, setSearch] = useState("");

  const { data: activeData = [], isLoading: loadingActive } = useGrants({ active: true, limit: 200 });
  const { data: inactiveData = [] } = useGrants({ active: false, limit: 200 });

  const { data: pinnedIds = [] } = usePinnedGrantIds();
  const togglePin = useTogglePinnedGrant();
  const { data: dashPinnedItems = [] } = usePinnedItems();
  const toggleDashPin = useTogglePinnedItem();
  const dashPinnedGrantIds = useMemo(
    () => new Set(dashPinnedItems.filter((x) => x.type === "grant").map((x) => x.id)),
    [dashPinnedItems],
  );

  const activeRows = useMemo(() => (activeData as Grant[]).filter(isVisible), [activeData]);
  const inactiveRows = useMemo(() => (inactiveData as Grant[]).filter(isVisible), [inactiveData]);

  const rows = filter === "active" ? activeRows : inactiveRows;
  const loading = filter === "active" ? loadingActive : false;

  const grouped = useMemo(() => {
    const grants: Grant[] = [];
    const programs: Grant[] = [];
    for (const row of rows) {
      if (bucketFor(row) === "program") programs.push(row);
      else grants.push(row);
    }
    return { grants, programs };
  }, [rows]);

  const onRefresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.grants.root }),
      qc.invalidateQueries({ queryKey: qk.creditCards.root }),
      qc.invalidateQueries({ queryKey: qk.ledger.root }),
      qc.invalidateQueries({ queryKey: qk.metrics.system() }),
    ]);
  };

  const searchLower = search.trim().toLowerCase();
  const filteredGrouped = useMemo(() => {
    if (!searchLower) return grouped;
    const match = (g: Grant) =>
      String(g.name || "").toLowerCase().includes(searchLower) ||
      String(g.id || "").toLowerCase().includes(searchLower);
    return { grants: grouped.grants.filter(match), programs: grouped.programs.filter(match) };
  }, [grouped, searchLower]);

  const viewingRows = view === "grant" ? filteredGrouped.grants : filteredGrouped.programs;
  const isPrograms = view === "program";
  const totalCount = view === "grant" ? grouped.grants.length : grouped.programs.length;

  return (
    <ListStyleLayout>
    <PageShell metricsArea={null}>
    <section className="space-y-6" data-tour="grants-page">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2" data-tour="grants-header">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Programs</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">View Grant and Program Budget, eligibility, Assessment and Task Details by Clicking the Grant.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {grouped.grants.length} Grants | {grouped.programs.length} Programs
          </div>
          <RefreshButton queryKeys={[qk.grants.root]} label="Refresh" onRefresh={onRefresh} tourId="grants-refresh" />
        </div>
      </div>

      <CreditCardsPanel />

      {/* Pinned grants */}
      <PinnedGrantCards />

      {/* Filter bar */}
      <PageFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or ID"
        resultLabel={searchLower ? `${viewingRows.length} / ${totalCount} ${isPrograms ? "Programs" : "Grants"}` : undefined}
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

      {/* Grants / Programs list */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" data-tour="grants-list-panel">
        {/* Tab bar */}
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700" data-tour="grants-list-panel-header">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2" data-tour="grants-view-tabs">
              <button
                type="button"
                onClick={() => setView("grant")}
                className={["relative px-1 py-2 text-sm font-semibold transition", "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full", view === "grant" ? "text-sky-500 after:bg-sky-500" : "text-slate-500 after:bg-transparent hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"].join(" ")}
              >
                Grants ({filteredGrouped.grants.length})
              </button>
              <button
                type="button"
                onClick={() => setView("program")}
                className={["relative px-1 py-2 text-sm font-semibold transition", "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full", view === "program" ? "text-sky-500 after:bg-sky-500" : "text-slate-500 after:bg-transparent hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"].join(" ")}
              >
                Programs ({filteredGrouped.programs.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button className="btn btn-xs" onClick={() => router.push("/grants/new?kind=grant")}>+ Grant</button>
              <button className="btn-secondary btn-xs" onClick={() => router.push("/grants/new?kind=program")}>+ Program</button>
            </div>
          </div>
        </div>

        {/* Column headers */}
        {isPrograms ? (
          <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
            <div className="col-span-10 md:col-span-3">Name</div>
            <div className="col-span-5 md:col-span-2 md:text-right">Active Enroll.</div>
            <div className="col-span-5 md:col-span-2 md:text-right">Unique Clients</div>
            <div className="col-span-5 md:col-span-2 md:text-right">Population</div>
            <div className="col-span-5 md:col-span-1 md:text-right">CMs</div>
            <div className="col-span-2" />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
            <div className="col-span-10 md:col-span-3">Name</div>
            <div className="col-span-5 md:col-span-2 md:text-right">Total</div>
            <div className="col-span-5 md:col-span-2 md:text-right">Spent</div>
            <div className="col-span-5 md:col-span-2 md:text-right">Queued</div>
            <div className="col-span-5 md:col-span-1 md:text-right">Enrolled</div>
            <div className="col-span-2" />
          </div>
        )}

        {loading ? (
          <div className="p-6 text-sm text-slate-600 dark:text-slate-400">Loading…</div>
        ) : viewingRows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600 dark:text-slate-400">
            No {isPrograms ? "programs" : "grants"} found.
          </div>
        ) : (
          <div>
            {viewingRows.map((g) => {
              const gid = String(g.id);
              const isPinned = pinnedIds.includes(gid);
              const isDashPinned = dashPinnedGrantIds.has(gid);
              const onOpen = () => router.push(`/grants/${gid}`);
              const onTogglePin = () => togglePin.mutate(gid);
              const onToggleDashPin = () => toggleDashPin.mutate({ type: "grant", id: gid });
              return isPrograms ? (
                <ProgramRow
                  key={gid}
                  grant={g}
                  isPinned={isPinned}
                  isDashPinned={isDashPinned}
                  onOpen={onOpen}
                  onTogglePin={onTogglePin}
                  onToggleDashPin={onToggleDashPin}
                />
              ) : (
                <GrantRow
                  key={gid}
                  grant={g}
                  isPinned={isPinned}
                  isDashPinned={isDashPinned}
                  onOpen={onOpen}
                  onTogglePin={onTogglePin}
                  onToggleDashPin={onToggleDashPin}
                />
              );
            })}
          </div>
        )}
      </section>
    </section>
    </PageShell>
    </ListStyleLayout>
  );
}

export default GrantsPage;
