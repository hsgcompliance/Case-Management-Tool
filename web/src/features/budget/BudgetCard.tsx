// web/src/features/budget/BudgetCard.tsx
"use client";
import React from "react";
import { useGrantMetrics } from "@hooks/useMetrics";
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

interface BudgetCardProps {
  grant: Grant;
  lineItemId?: string;
  cardType?: BudgetCardType;
  labelOverride?: string;
  accentColor?: string;
  onClick: () => void;
}

export function BudgetCard({ grant, lineItemId, cardType = "standard", labelOverride, accentColor, onClick }: BudgetCardProps) {
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

  // Auto-detect client-allocation: explicit prop OR grant has allocationEnabled OR displayed line item has capEnabled
  const isClientAlloc = cardType === "client-allocation" ||
    (grant as any)?.budget?.allocationEnabled === true ||
    (lineItemId
      ? ((grant as any)?.budget?.lineItems as Array<Record<string, unknown>> | undefined)
          ?.find((l) => l.id === lineItemId)?.capEnabled === true
      : false);

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
        "group flex flex-col gap-0 rounded-xl border-2 shadow-md transition-shadow hover:shadow-lg",
        accentLeftClass ? `border-l-[5px] ${accentLeftClass}` : "",
        isClientAlloc
          ? "border-sky-200 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
      ].join(" ")}
    >
      {/* Card header — clickable to open detail */}
      <button
        type="button"
        onClick={(event) => {
          if (hasSelectedTextWithin(event.currentTarget)) return;
          onClick();
        }}
        className={[
          "flex items-start justify-between gap-2 rounded-t-xl p-4 text-left transition hover:opacity-80",
          accentHeaderBg ? accentHeaderBg : "",
        ].join(" ")}
      >
        <div className="min-w-0">
          {isClientAlloc && (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400">
              Client Allocation
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
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <BudgetProgressBar
          spent={budget.spent}
          projected={budget.projected}
          total={budget.total}
          drawsDownBudget={drawsDownBudget}
        />
      </div>

      {/* Metric rows */}
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
        <div className="flex items-center gap-0.5">
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
