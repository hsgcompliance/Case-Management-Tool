// web/src/features/budget/BudgetCard.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useGrantMetrics } from "@hooks/useMetrics";
import { useGrantCustomerAllocations, type CustomerAllocation } from "@hooks/useGrantCustomerAllocations";
import { statusChipClass, grantAccentLeftBorder, grantAccentHeaderBg } from "@lib/colorRegistry";
import type { TGrant as Grant } from "@types";
import { useTogglePinnedGrant, usePinnedGrantIds } from "@features/grants/PinnedGrantCards";
import { useTogglePinnedItem, usePinnedItems } from "@entities/pinned/PinnedItemsSection";
import { fmtCurrencyUSD } from "@lib/formatters";
import { getGrantFinancialCapabilities } from "@hdb/contracts";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function hasSelectedTextWithin(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;

  for (let i = 0; i < selection.rangeCount; i += 1) {
    const range = selection.getRangeAt(i);
    const container = range.commonAncestorContainer;
    const node = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
    if (node && element.contains(node)) return true;
  }

  return false;
}

const fmtUsd = (n: number) => fmtCurrencyUSD(n);
const toCents = (n: number) => Math.round(Number(n || 0) * 100);
const fromCents = (cents: number) => cents / 100;

function getBudget(g: Partial<Grant>) {
  const b = (g?.budget || {}) as Record<string, unknown>;
  const t = ((b?.totals as Record<string, unknown>) || {}) as Record<string, unknown>;
  const total = Number((b?.total ?? b?.startAmount ?? 0) as number);
  const spent = Number((t?.spent ?? b?.spent ?? 0) as number);
  const projected = Number((t?.projected ?? b?.projected ?? 0) as number);
  const totalCents = toCents(total);
  const spentCents = toCents(spent);
  const projectedCents = toCents(projected);
  return {
    total: fromCents(totalCents),
    spent: fromCents(spentCents),
    projected: fromCents(projectedCents),
    remaining: fromCents(totalCents - spentCents),
    projectedToSpend: fromCents(spentCents + projectedCents),
    available: fromCents(totalCents - spentCents - projectedCents),
    rawBudget: b,
  };
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function BudgetProgressBar({
  spent,
  projected,
  total,
  drawsDownBudget = true,
}: {
  spent: number;
  projected: number;
  total: number;
  drawsDownBudget?: boolean;
}) {
  const activity = spent + projected;
  const denom = drawsDownBudget ? (total > 0 ? total : 1) : Math.max(total, activity, 1);
  const spentPct = clamp((spent / denom) * 100, 0, 100);
  const projPct = clamp((projected / denom) * 100, 0, 100 - spentPct);
  const remainPct = drawsDownBudget ? clamp(100 - spentPct - projPct, 0, 100) : 0;
  const overspent = drawsDownBudget && spent + projected > total;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
        <div
          className="h-full bg-amber-400 transition-all"
          style={{ width: `${spentPct}%` }}
          title={`Spent: ${fmtUsd(spent)}`}
        />
        <div
          className="h-full bg-blue-400 transition-all"
          style={{ width: `${projPct}%` }}
          title={`Projected: ${fmtUsd(projected)}`}
        />
        {drawsDownBudget && (
          <div
            className={["h-full transition-all", overspent ? "bg-red-300" : "bg-emerald-300"].join(" ")}
            style={{ width: `${remainPct}%` }}
          />
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />Spent
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />Projected
        </span>
        {drawsDownBudget ? (
          <span className="flex items-center gap-1">
            <span className={["inline-block h-1.5 w-1.5 rounded-full", overspent ? "bg-red-300" : "bg-emerald-300"].join(" ")} />
            Remaining
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
            Reference
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Metric row ────────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  valueClass,
  dimmed,
}: {
  label: string;
  value: string;
  valueClass?: string;
  dimmed?: boolean;
}) {
  return (
    <div className={["flex items-baseline justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0", dimmed ? "opacity-50" : ""].join(" ")}>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={["text-sm font-semibold tabular-nums", valueClass ?? "text-slate-800 dark:text-slate-100"].join(" ")}>
        {value}
      </span>
    </div>
  );
}

function getLineItemBudget(grant: Grant, lineItemId: string) {
  const lineItems = (grant as any)?.budget?.lineItems as Array<Record<string, unknown>> | undefined;
  const li = lineItems?.find((l) => l.id === lineItemId);
  if (!li) return null;
  const amount = Number(li.amount ?? 0);
  const spent = Number(li.spent ?? 0);
  const projected = Number(li.projected ?? 0);
  const amountCents = toCents(amount);
  const spentCents = toCents(spent);
  const projectedCents = toCents(projected);
  return {
    total: fromCents(amountCents),
    spent: fromCents(spentCents),
    projected: fromCents(projectedCents),
    remaining: fromCents(amountCents - spentCents),
    projectedToSpend: fromCents(spentCents + projectedCents),
    available: fromCents(amountCents - spentCents - projectedCents),
    rawBudget: (grant as any)?.budget ?? {},
    label: String(li.label ?? li.id ?? ""),
  };
}

export type BudgetCardType = "standard" | "client-allocation";
type BudgetCardDisplayType = BudgetCardType | "budget" | "allocation" | "billable";
type AllocationSort = "name-asc" | "name-desc" | "amount-asc" | "amount-desc";

function getBudgetLineItems(grant: Grant) {
  const raw = (grant as any)?.budget?.lineItems;
  if (!Array.isArray(raw)) return [];
  return raw.map((item: Record<string, unknown>) => {
    const spent = fromCents(toCents(Number(item.spent || 0)));
    const projected = fromCents(toCents(Number(item.projected || 0)));
    return {
      id: String(item.id || ""),
      label: String(item.label || item.id || "Line item"),
      amount: fromCents(toCents(Number(item.amount || 0))),
      spent,
      projected,
      splitMode: String(item.splitMode || "none"),
      splitGoals: Array.isArray(item.splitGoals)
        ? item.splitGoals.map((goal: Record<string, unknown>, index: number) => ({
            id: String(goal.id || `${item.id || "li"}_split_${index}`),
            label: String(goal.label || `Cycle ${index + 1}`),
            startDate: String(goal.startDate || ""),
            endDate: String(goal.endDate || ""),
            amount: fromCents(toCents(Number(goal.amount || 0))),
            spent: fromCents(toCents(Number(goal.spent || 0))),
            projected: fromCents(toCents(Number(goal.projected || 0))),
          }))
        : [],
    };
  });
}

function CompactBudgetChildRows({
  grant,
  drawsDownBudget,
}: {
  grant: Grant;
  drawsDownBudget: boolean;
}) {
  const lineItems = getBudgetLineItems(grant).filter((item) => item.id && item.amount > 0);
  if (!lineItems.length) return null;
  return (
    <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
      <div className="space-y-2">
        {lineItems.slice(0, 6).map((item) => {
          const projectedSpend = item.spent + item.projected;
          const available = item.amount - projectedSpend;
          return (
            <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{fmtUsd(item.amount)}</span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                <span>{fmtUsd(item.spent)} spent</span>
                <span>{fmtUsd(projectedSpend)} projected</span>
                <span className={drawsDownBudget && available < 0 ? "text-red-500" : "text-emerald-600"}>{fmtUsd(available)} avail.</span>
              </div>
              {item.splitGoals.length > 0 && (
                <div className="mt-2 space-y-1 border-l border-slate-200 pl-2 dark:border-slate-700">
                  {item.splitGoals.slice(0, 4).map((goal) => {
                    const goalProjectedSpend = goal.spent + goal.projected;
                    const goalAvailable = goal.amount - goalProjectedSpend;
                    const period = goal.startDate || goal.endDate ? `${goal.startDate || "TBD"}-${goal.endDate || "TBD"}` : "Date range TBD";
                    return (
                      <div key={goal.id} className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="min-w-0 truncate">{goal.label} · {period}</span>
                        <span className={drawsDownBudget && goalAvailable < 0 ? "shrink-0 font-semibold text-red-500" : "shrink-0 font-semibold text-slate-600 dark:text-slate-300"}>
                          {fmtUsd(goalProjectedSpend)} / {fmtUsd(goal.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function filterAllocationRows(
  rows: CustomerAllocation[],
  sortMode: AllocationSort,
  amountForRow: (row: CustomerAllocation) => number,
) {
  const filtered = rows.filter((row) => amountForRow(row) !== 0);
  return filtered.sort((a, b) => {
    if (sortMode === "name-desc") return b.customerName.localeCompare(a.customerName);
    if (sortMode === "amount-asc") return amountForRow(a) - amountForRow(b) || a.customerName.localeCompare(b.customerName);
    if (sortMode === "amount-desc") return amountForRow(b) - amountForRow(a) || a.customerName.localeCompare(b.customerName);
    return a.customerName.localeCompare(b.customerName);
  });
}

function AllocationListCardBody({
  grant,
  lineItemId,
}: {
  grant: Grant;
  lineItemId?: string;
}) {
  const grantId = String(grant.id);
  const { data: rows = [], isLoading, error } = useGrantCustomerAllocations(grantId, { enabled: !!grantId });
  const [sortMode, setSortMode] = useState<AllocationSort>("name-asc");
  const lineItems = useMemo(() => getBudgetLineItems(grant).filter((item) => item.id), [grant]);
  const allocationScopes = useMemo(
    () => [
      { id: "", label: "All line items" },
      ...lineItems.map((item) => ({ id: item.id, label: item.label })),
    ],
    [lineItems],
  );
  const initialScopeIndex = useMemo(() => {
    if (!lineItemId) return 0;
    const idx = allocationScopes.findIndex((scope) => scope.id === lineItemId);
    return idx >= 0 ? idx : 0;
  }, [allocationScopes, lineItemId]);
  const [scopeIndex, setScopeIndex] = useState(initialScopeIndex);
  useEffect(() => {
    setScopeIndex(initialScopeIndex);
  }, [initialScopeIndex]);
  const safeScopeIndex = Math.min(scopeIndex, allocationScopes.length - 1);
  const selectedScope = allocationScopes[safeScopeIndex] ?? allocationScopes[0];
  const canCycleLineItems = allocationScopes.length > 2;
  const amountForRow = useMemo(
    () => (row: CustomerAllocation) =>
      selectedScope?.id ? Number(row.lineItemTotal?.[selectedScope.id] || 0) : Number(row.total || 0),
    [selectedScope?.id],
  );

  const filteredRows = useMemo(
    () => filterAllocationRows(rows, sortMode, amountForRow),
    [amountForRow, rows, sortMode],
  );
  const allocatedTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + amountForRow(row), 0),
    [amountForRow, filteredRows],
  );
  const cycleScope = (direction: -1 | 1) => {
    if (allocationScopes.length <= 1) return;
    setScopeIndex((current) => {
      const next = (current + direction + allocationScopes.length) % allocationScopes.length;
      return next;
    });
  };

  return (
    <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Total Allocated
        <select
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium normal-case tracking-normal text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          value={sortMode}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setSortMode(event.currentTarget.value as AllocationSort)}
        >
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="amount-desc">Total allocated high-low</option>
          <option value="amount-asc">Total allocated low-high</option>
        </select>
      </label>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-700 dark:text-slate-200">{selectedScope?.label || "All line items"}</div>
          <div className="text-slate-500 dark:text-slate-400">
            {filteredRows.length} customer{filteredRows.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canCycleLineItems && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Previous line item"
                onClick={(event) => {
                  event.stopPropagation();
                  cycleScope(-1);
                }}
              >
                ←
              </button>
              <button
                type="button"
                className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Next line item"
                onClick={(event) => {
                  event.stopPropagation();
                  cycleScope(1);
                }}
              >
                →
              </button>
            </div>
          )}
          <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">{fmtUsd(allocatedTotal)}</span>
        </div>
      </div>

      <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        {isLoading ? (
          <div className="px-3 py-6 text-center text-xs text-slate-400">Loading allocations...</div>
        ) : error ? (
          <div className="px-3 py-6 text-center text-xs text-red-500">Failed to load allocations.</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-400">No customer allocations recorded.</div>
        ) : (
          filteredRows.map((row) => (
            <div
              key={row.customerId}
              className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-0 dark:border-slate-800"
            >
              <span className="min-w-0 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{row.customerName}</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {fmtUsd(amountForRow(row))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BillableFinancialModelCardBody({
  grant,
  activeEnrollments,
}: {
  grant: Grant;
  activeEnrollments?: number;
}) {
  const lineItems = getBudgetLineItems(grant);
  const projectedTotal = lineItems.reduce((sum, item) => sum + item.projected, 0);

  return (
    <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Projected spending</div>
          <div className="mt-1 text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">{fmtUsd(projectedTotal)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Enrollments</div>
          <div className="mt-1 text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{activeEnrollments ?? 0}</div>
        </div>
      </div>

      <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        {lineItems.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-400">No line items configured.</div>
        ) : (
          lineItems.map((item) => (
            <div
              key={item.id || item.label}
              className="border-b border-slate-100 px-3 py-2 last:border-0 dark:border-slate-800"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                  {fmtUsd(item.projected)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                <span>{fmtUsd(item.spent)} recorded</span>
                <span>{fmtUsd(item.projected)} projected</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface BudgetCardProps {
  grant: Grant;
  lineItemId?: string;
  cardType?: BudgetCardDisplayType;
  labelOverride?: string;
  accentColor?: string;
  onClick: () => void;
  onManageBudget?: (grantId: string) => void;
  selected?: boolean;
  selectionMode?: boolean;
  onSelectGesture?: (grantId: string, gesture: { source: "card" | "checkbox"; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => void;
}

export function BudgetCard({ grant, lineItemId, cardType = "standard", labelOverride, accentColor, onClick, onManageBudget, selected = false, selectionMode = false, onSelectGesture }: BudgetCardProps) {
  const { data: gm } = useGrantMetrics(grant.id);
  const { data: pinnedIds = [] } = usePinnedGrantIds();
  const togglePin = useTogglePinnedGrant();
  const { data: dashPinnedItems = [] } = usePinnedItems();
  const toggleDashPin = useTogglePinnedItem();

  const gid = String(grant.id);
  const isPinned = pinnedIds.includes(gid);
  const isDashPinned = dashPinnedItems.some((x) => x.type === "grant" && x.id === gid);

  const liData = lineItemId ? getLineItemBudget(grant, lineItemId) : null;
  const budget = liData ?? getBudget(grant);
  const financialCapabilities = getGrantFinancialCapabilities(grant as Record<string, unknown>);
  const drawsDownBudget = financialCapabilities.drawsDownBudget;
  const isBillingMode = !drawsDownBudget && (financialCapabilities.billingEnabled || financialCapabilities.usesBillingLedger);
  const status = String(grant.status || "active");

  const displayType: BudgetCardDisplayType =
    cardType === "allocation" ? "client-allocation" : cardType === "budget" ? "standard" : cardType;
  const isClientAlloc = displayType === "client-allocation";
  const isBillableFinancialModel = displayType === "billable";

  const availClass =
    !drawsDownBudget
      ? "text-slate-700 dark:text-slate-200"
      : budget.available < 0
      ? "text-red-600 dark:text-red-400"
      : budget.available < budget.total * 0.1
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-500";

  const accentLeftClass = grantAccentLeftBorder(accentColor);
  const accentHeaderBg = grantAccentHeaderBg(accentColor);

  // Display name: labelOverride > line item label > grant name
  const displayName = labelOverride || (liData?.label ? liData.label : String(grant.name || grant.id));
  // Context label shown under name for line-item cards
  const contextLabel = liData?.label ? String(grant.name || grant.id) : null;

  return (
    <div
      className={[
        "group relative flex flex-col gap-0 rounded-xl border-2 shadow-md transition-shadow hover:shadow-lg",
        selected ? "ring-2 ring-sky-400" : "",
        accentLeftClass ? `border-l-[5px] ${accentLeftClass}` : "",
        isClientAlloc
          ? "border-sky-200 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
      ].join(" ")}
    >
      {/* Card header — clickable to open detail */}
      <label
        className={[
          "absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition",
          selected || selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        ].join(" ")}
        title={selected ? "Selected" : "Select grant"}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          className="h-4 w-4 accent-sky-600"
          checked={selected}
          onChange={(event) => {
            onSelectGesture?.(gid, {
              source: "checkbox",
              shiftKey: event.nativeEvent.shiftKey,
              ctrlKey: event.nativeEvent.ctrlKey,
              metaKey: event.nativeEvent.metaKey,
            });
          }}
        />
      </label>
      <button
        type="button"
        onClick={(event) => {
          if (hasSelectedTextWithin(event.currentTarget)) return;
          if (selectionMode || event.shiftKey || event.ctrlKey || event.metaKey) {
            onSelectGesture?.(gid, { source: "card", shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
            return;
          }
          onClick();
        }}
        className={[
          "flex items-start justify-between gap-2 rounded-t-xl p-4 pl-11 text-left transition hover:opacity-80",
          accentHeaderBg ? accentHeaderBg : "",
        ].join(" ")}
      >
        <div className="min-w-0">
          {isClientAlloc && (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400">
              Client Allocation
            </div>
          )}
          {isBillableFinancialModel && (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400">
              Billable Financial Model
            </div>
          )}
          <div className="truncate font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors text-lg leading-snug">
            {displayName}
          </div>
          {contextLabel && (
            <div className="mt-0.5 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {contextLabel}
            </div>
          )}
        </div>
        <span
          className={[
            "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            statusChipClass(status),
          ].join(" ")}
        >
          {status}
        </span>
      </button>

      {/* Progress bar */}
      {!isClientAlloc && !isBillableFinancialModel && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <BudgetProgressBar
            spent={budget.spent}
            projected={budget.projected}
            total={budget.total}
            drawsDownBudget={drawsDownBudget}
          />
        </div>
      )}

      {/* Metric rows */}
      {isClientAlloc ? (
        <AllocationListCardBody grant={grant} lineItemId={lineItemId} />
      ) : isBillableFinancialModel ? (
        <BillableFinancialModelCardBody grant={grant} activeEnrollments={gm?.enrollments?.active} />
      ) : (
        <>
          <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
            {/* Total row */}
            <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {drawsDownBudget ? "Total" : "Reference"}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {fmtUsd(budget.total)}
              </span>
            </div>

            <MetricRow
              label={isBillingMode ? "Recorded Spend" : "Spent"}
              value={fmtUsd(budget.spent)}
              valueClass="text-amber-700 dark:text-amber-400"
            />
            {drawsDownBudget ? (
              <MetricRow
                label="Remaining"
                value={fmtUsd(budget.remaining)}
                valueClass="text-slate-700 dark:text-slate-200"
              />
            ) : null}
            <MetricRow
              label={isBillingMode ? "Projected Activity" : "Projected to Spend"}
              value={fmtUsd(budget.projectedToSpend)}
              valueClass={drawsDownBudget && budget.projectedToSpend > budget.total ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}
              dimmed={budget.projectedToSpend === 0}
            />
            <MetricRow
              label={drawsDownBudget ? "Available" : "Activity Total"}
              value={fmtUsd(drawsDownBudget ? budget.available : budget.projectedToSpend)}
              valueClass={availClass}
            />
          </div>
          {!lineItemId && <CompactBudgetChildRows grant={grant} drawsDownBudget={drawsDownBudget} />}
        </>
      )}

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {gm ? (
            <>
              {gm.enrollments?.active} enrolled
              {(gm.caseManagers?.total ?? 0) > 0 && ` · ${gm.caseManagers?.total} CMs`}
            </>
          ) : null}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={(event) => {
            event.stopPropagation();
            onManageBudget?.(gid);
          }}
        >
          Budget Manager
        </button>
        <div className="hidden items-center gap-0.5">
          <button
            type="button"
            title={isDashPinned ? "Unpin from dashboard" : "Pin to dashboard"}
            onClick={(e) => { e.stopPropagation(); toggleDashPin.mutate({ type: "grant", id: gid }); }}
            className={`flex items-center justify-center rounded-full p-1 text-xs transition ${isDashPinned ? "text-sky-400 hover:text-sky-500" : "text-slate-300 hover:text-sky-400 dark:text-slate-600"}`}
          >
            📌
          </button>
          <button
            type="button"
            title={isPinned ? "Unpin" : "Pin to budget page"}
            onClick={(e) => { e.stopPropagation(); togglePin.mutate(gid); }}
            className={`flex items-center justify-center rounded-full p-1 text-sm transition ${isPinned ? "text-amber-400 hover:text-amber-500" : "text-slate-300 hover:text-amber-400 dark:text-slate-600"}`}
          >
            {isPinned ? "★" : "☆"}
          </button>
        </div>
      </div>
    </div>
  );
}
