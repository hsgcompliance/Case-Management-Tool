// web/src/features/budget/BudgetPage.tsx
"use client";
import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListStyleLayout } from "@entities/Page/listStyle";
import PageShell from "@entities/Page/PageShell";
import PageFilterBar from "@entities/Page/PageFilterBar";
import { FilterToggleGroup } from "@entities/ui";
import RefreshButton from "@entities/ui/RefreshButton";
import { useGrants } from "@hooks/useGrants";
import { useOrgConfig } from "@hooks/useOrgConfig";
import { useCreditCardsSummary } from "@hooks/useCreditCards";
import { qk } from "@hooks/queryKeys";
import type { TGrant as Grant } from "@types";
import { BudgetGroupSection } from "./BudgetGroupSection";
import { CreditCardBudgetCard } from "./CreditCardBudgetCard";
import { BudgetConfigModal } from "./BudgetConfigModal";
import { NewCreditCardModal } from "./NewCreditCardModal";
import GrantWorkspaceModal from "@features/grants/GrantWorkspaceModal";
import PinnedGrantCards from "@features/grants/PinnedGrantCards";

type FilterMode = "active" | "inactive";
type ViewMode = "custom" | "all";

const isVisible = (g?: Partial<Grant> | null) =>
  !!g && g.status !== "deleted" && g.deleted !== true;

const isGrant = (g: Partial<Grant>) =>
  String(g?.kind || "").toLowerCase() !== "program";

// ─── Grouping logic ───────────────────────────────────────────────────────────

function buildSections(
  grantsList: Grant[],
  config: ReturnType<typeof useOrgConfig>["data"],
  search: string,
  viewMode: ViewMode,
) {
  const searchLower = search.trim().toLowerCase();
  const groups = config?.budgetDisplay.groups ?? [];
  const hiddenItems = config?.budgetDisplay.items ?? {};

  const grantsById = new Map<string, Grant>(
    grantsList.map((g) => [String(g.id), g]),
  );

  const visibleIds = new Set(
    grantsList
      .filter((g) => hiddenItems[String(g.id)]?.visible !== false)
      .map((g) => String(g.id)),
  );

  // "All Grants" flat view — ignore config groups
  if (viewMode === "all") {
    let visible = grantsList.filter((g) => visibleIds.has(String(g.id)));
    if (searchLower) {
      visible = visible.filter(
        (g) =>
          String(g.name || "").toLowerCase().includes(searchLower) ||
          String(g.id).toLowerCase().includes(searchLower),
      );
    }
    return {
      grantsById,
      sections: visible.length > 0
        ? [{ key: "_all", label: "All Grants", color: undefined, cols: 3,
            items: visible.map((g) => ({ id: String(g.id), grantId: String(g.id) })) }]
        : [],
    };
  }

  // Custom (config-driven) view
  if (groups.length === 0) {
    let visible = grantsList.filter((g) => visibleIds.has(String(g.id)));
    if (searchLower) {
      visible = visible.filter(
        (g) =>
          String(g.name || "").toLowerCase().includes(searchLower) ||
          String(g.id).toLowerCase().includes(searchLower),
      );
    }
    return {
      grantsById,
      sections: visible.length > 0
        ? [{ key: "_all", label: "All Grants", color: undefined, cols: 3,
            items: visible.map((g) => ({ id: String(g.id), grantId: String(g.id) })) }]
        : [],
    };
  }

  const sections = groups
    .filter((grp) => !grp.hidden)
    .map((grp) => {
      let items = grp.items.filter((item) => visibleIds.has(item.grantId));
      if (searchLower) {
        items = items.filter((item) => {
          const g = grantsById.get(item.grantId);
          return (
            String(g?.name || "").toLowerCase().includes(searchLower) ||
            item.grantId.toLowerCase().includes(searchLower) ||
            (item.labelOverride || "").toLowerCase().includes(searchLower)
          );
        });
      }
      return { key: grp.key, label: grp.label, color: grp.color, cols: grp.cols ?? 3, items };
    })
    .filter((s) => s.items.length > 0);

  return { grantsById, sections };
}

// ─── Credit cards section ─────────────────────────────────────────────────────

function CreditCardBudgetSection({ onNewCard }: { onNewCard: () => void }) {
  const { data: summary } = useCreditCardsSummary({ active: true });
  const cards = summary?.items ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300">Credit Cards</h2>
          {cards.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {cards.length} {cards.length === 1 ? "card" : "cards"}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-xs btn-secondary"
          onClick={onNewCard}
        >
          + New Card
        </button>
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No credit cards configured.</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <CreditCardBudgetCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BudgetPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("custom");
  const [search, setSearch] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [creatingGrant, setCreatingGrant] = useState(false);

  const { data: activeData = [], isLoading } = useGrants({ active: true, limit: 200 });
  const { data: inactiveData = [] } = useGrants({ active: false, limit: 200 });
  const { data: config } = useOrgConfig();

  const sourceGrants = useMemo(() => {
    const source = filter === "active" ? activeData : inactiveData;
    return (source as Grant[]).filter((g) => isVisible(g) && isGrant(g));
  }, [activeData, inactiveData, filter]);

  const activeGrants = useMemo(
    () => (activeData as Grant[]).filter((g) => isVisible(g) && isGrant(g)),
    [activeData],
  );

  const { grantsById, sections } = useMemo(
    () => buildSections(sourceGrants, config, search, viewMode),
    [sourceGrants, config, search, viewMode],
  );

  const totalCount = sourceGrants.length;
  const hasConfig = (config?.budgetDisplay.groups ?? []).length > 0;

  const onRefresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.grants.root }),
      qc.invalidateQueries({ queryKey: qk.creditCards.root }),
      qc.invalidateQueries({ queryKey: qk.metrics.system() }),
    ]);
  };

  const onOpen = (id: string) => setSelectedGrantId(id);

  const tabClass = (active: boolean) =>
    [
      "relative px-1 py-1.5 text-sm font-semibold transition",
      "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full",
      active
        ? "text-sky-500 after:bg-sky-500"
        : "text-slate-500 after:bg-transparent hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
    ].join(" ");

  return (
    <ListStyleLayout>
      <PageShell metricsArea={null}>
        <section className="space-y-10" data-tour="budget-page">
          {/* Page header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Budget
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Budget overview by funding source. Click any card to view details and activity.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center gap-3 border-b border-transparent">
                <button
                  type="button"
                  className={tabClass(viewMode === "custom")}
                  onClick={() => setViewMode("custom")}
                >
                  Custom
                </button>
                <button
                  type="button"
                  className={tabClass(viewMode === "all")}
                  onClick={() => setViewMode("all")}
                >
                  All Grants ({totalCount})
                </button>
              </div>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => setCreatingGrant(true)}
              >
                + New Grant
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfigOpen(true)}
                title="Configure budget layout"
              >
                ⚙ Configure
              </button>
              <RefreshButton queryKeys={[qk.grants.root]} label="Refresh" onRefresh={onRefresh} />
            </div>
          </div>

          {/* Credit cards */}
          <CreditCardBudgetSection onNewCard={() => setNewCardOpen(true)} />

          {/* Pinned grants */}
          <PinnedGrantCards />

          {/* Filter bar */}
          <PageFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search grants by name or ID"
            resultLabel={
              search.trim() ? `${sections.reduce((n, s) => n + s.items.length, 0)} results` : undefined
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

          {/* Budget sections */}
          {isLoading && filter === "active" ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>
          ) : sections.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-10 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {search.trim()
                  ? "No grants match your search."
                  : viewMode === "custom" && !hasConfig
                  ? "No budget groups configured yet."
                  : "No grants found."}
              </p>
              {!search.trim() && viewMode === "custom" && !hasConfig && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setConfigOpen(true)}
                >
                  ⚙ Configure Layout
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              {sections.map((s) => (
                <BudgetGroupSection
                  key={s.key}
                  label={s.label}
                  color={s.color}
                  cols={s.cols}
                  items={s.items}
                  grantsById={grantsById}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </section>
      </PageShell>

      {/* Config modal */}
      <BudgetConfigModal
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        grants={activeGrants}
      />

      {/* New credit card */}
      <NewCreditCardModal
        isOpen={newCardOpen}
        onClose={() => setNewCardOpen(false)}
      />

      {/* New grant workspace */}
      {creatingGrant && (
        <GrantWorkspaceModal
          grantId={null}
          initialCreateData={{ kind: "grant" } as any}
          onClose={() => setCreatingGrant(false)}
          onCreated={(id) => { setCreatingGrant(false); setSelectedGrantId(id); }}
        />
      )}

      {/* View existing grant workspace */}
      {selectedGrantId && (
        <GrantWorkspaceModal
          grantId={selectedGrantId}
          onClose={() => setSelectedGrantId(null)}
        />
      )}
    </ListStyleLayout>
  );
}

export default BudgetPage;
