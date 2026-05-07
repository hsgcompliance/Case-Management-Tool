// web/src/features/budget/BudgetPage.tsx
"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toApiError } from "@client/api";
import { useAuth } from "@app/auth/AuthProvider";
import { ListStyleLayout } from "@entities/Page/listStyle";
import PageShell from "@entities/Page/PageShell";
import PageFilterBar from "@entities/Page/PageFilterBar";
import { FilterToggleGroup } from "@entities/ui";
import RefreshButton from "@entities/ui/RefreshButton";
import { useGrants } from "@hooks/useGrants";
import { useOrgConfig } from "@hooks/useOrgConfig";
import { useCreditCards } from "@hooks/useCreditCards";
import { useSyncJotformSelection } from "@hooks/useJotform";
import { qk } from "@hooks/queryKeys";
import { hasAnyRole, isAdminLike } from "@lib/roles";
import { toast } from "@lib/toast";
import { LINE_ITEMS_FORM_IDS } from "@features/widgets/jotform/lineItemsFormMap";
import type { CreditCardEntity, CreditCardSummaryItem, TGrant as Grant } from "@types";
import { BudgetGroupSection } from "./BudgetGroupSection";
import { CreditCardBudgetCard } from "./CreditCardBudgetCard";
import { CreditCardBudgetDetailModal } from "./CreditCardBudgetDetailModal";
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

// ─── Card entity → summary shape ─────────────────────────────────────────────

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonthKey() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function cardToSummaryItem(card: CreditCardEntity): CreditCardSummaryItem {
  const budget = (card as any).budget as {
    month?: string; lastMonth?: string; spentCents?: number;
    usagePct?: number; entryCount?: number;
    lastMonthSpentCents?: number; lastMonthEntryCount?: number;
  } | null | undefined;

  const monthlyLimitCents = Number(card.monthlyLimitCents || 0);
  const spentCents = Number(budget?.spentCents || 0);
  // Recompute live using the card's current limit so limit edits are instant
  const remainingCents = monthlyLimitCents - spentCents;
  const usagePct =
    monthlyLimitCents > 0
      ? Math.max(0, Math.min(999, (spentCents / monthlyLimitCents) * 100))
      : 0;

  return {
    id: String(card.id),
    name: String(card.name || ""),
    status: (card.status || "draft") as CreditCardSummaryItem["status"],
    month: budget?.month || currentMonthKey(),
    lastMonth: budget?.lastMonth || prevMonthKey(),
    monthlyLimitCents,
    spentCents,
    remainingCents,
    usagePct,
    entryCount: Number(budget?.entryCount || 0),
    lastMonthSpentCents: Number(budget?.lastMonthSpentCents || 0),
    lastMonthEntryCount: Number(budget?.lastMonthEntryCount || 0),
    cycleType: (card.cycleType || "calendar_month") as CreditCardSummaryItem["cycleType"],
    statementCloseDay: card.statementCloseDay != null ? Number(card.statementCloseDay) : null,
    last4: card.last4 || null,
  };
}

// ─── Credit cards section ─────────────────────────────────────────────────────

function CreditCardBudgetSection({
  onNewCard,
  onOpenCard,
}: {
  onNewCard: () => void;
  onOpenCard: (card: CreditCardSummaryItem) => void;
}) {
  const { data: rawCards = [] } = useCreditCards({ active: true });
  const cards = rawCards.map(cardToSummaryItem);

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
        <div className="flex flex-wrap justify-center gap-4">
          {cards.map((card) => (
            <div key={card.id} className="w-full max-w-xs">
              <CreditCardBudgetCard card={card} onClick={() => onOpenCard(card)} />
            </div>
          ))}
        </div>

      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BudgetPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [filter, setFilter] = useState<FilterMode>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("custom");
  const [search, setSearch] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [selectedCreditCard, setSelectedCreditCard] = useState<CreditCardSummaryItem | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [creatingGrant, setCreatingGrant] = useState(false);

  const { data: activeData = [], isLoading } = useGrants({ active: true, limit: 200 });
  const { data: inactiveData = [] } = useGrants({ active: false, limit: 200 });
  const { data: config } = useOrgConfig();
  const syncSpendingForms = useSyncJotformSelection();
  const canSyncSpendingForms = isAdminLike(profile) || hasAnyRole(profile?.roles, ["compliance", "org_dev", "super_dev"]);
  const autoSyncFired = useRef(false);

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

  const onLoadSpendingForms = async () => {
    if (!canSyncSpendingForms) {
      toast("You do not have permission to load Jotform spending forms.", { type: "error" });
      return;
    }
    try {
      const result = await syncSpendingForms.mutateAsync({
        mode: "formIds",
        formIds: [LINE_ITEMS_FORM_IDS.creditCard, LINE_ITEMS_FORM_IDS.invoice],
        limit: 50,
        maxPages: 1,
        includeRaw: true,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.jotform.root }),
        qc.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        qc.invalidateQueries({ queryKey: qk.creditCards.root }),
        qc.invalidateQueries({ queryKey: qk.ledger.root }),
        qc.invalidateQueries({ queryKey: qk.grants.root }),
      ]);
      toast(`Loaded ${Number(result?.count || 0)} spending submission${Number(result?.count || 0) === 1 ? "" : "s"}.`, { type: "success" });
    } catch (error: unknown) {
      toast(toApiError(error, "Failed to load spending forms.").error, { type: "error" });
    }
  };

  useEffect(() => {
    if (!canSyncSpendingForms || autoSyncFired.current) return;
    autoSyncFired.current = true;
    void onLoadSpendingForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSyncSpendingForms]);

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
              {syncSpendingForms.isPending && (
                <span className="text-xs text-slate-400 dark:text-slate-500 animate-pulse">Syncing card data…</span>
              )}
            </div>
          </div>

          {/* Credit cards */}
          <CreditCardBudgetSection
            onNewCard={() => setNewCardOpen(true)}
            onOpenCard={(card) => setSelectedCreditCard(card)}
          />

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

      {/* Credit card activity */}
      <CreditCardBudgetDetailModal
        card={selectedCreditCard}
        isOpen={!!selectedCreditCard}
        onClose={() => setSelectedCreditCard(null)}
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
