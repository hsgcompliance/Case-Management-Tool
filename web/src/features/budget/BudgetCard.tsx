// web/src/features/budget/BudgetCard.tsx
"use client";
import React, { useState } from "react";
import { useGrantMetrics } from "@hooks/useMetrics";
import { usePatchGrants } from "@hooks/useGrants";
import { statusChipClass } from "@lib/colorRegistry";
import type { TGrant as Grant } from "@types";
import { useTogglePinnedGrant, usePinnedGrantIds } from "@features/grants/PinnedGrantCards";
import { useTogglePinnedItem, usePinnedItems } from "@entities/pinned/PinnedItemsSection";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

const fmtUsd = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function getBudget(g: Partial<Grant>) {
  const b = (g?.budget || {}) as Record<string, unknown>;
  const t = ((b?.totals as Record<string, unknown>) || {}) as Record<string, unknown>;
  const total = Number((b?.total ?? b?.startAmount ?? 0) as number);
  const spent = Number((t?.spent ?? b?.spent ?? 0) as number);
  const projected = Number((t?.projected ?? b?.projected ?? 0) as number);
  return {
    total,
    spent,
    projected,
    remaining: total - spent,
    projectedToSpend: spent + projected,
    available: total - spent - projected,
    rawBudget: b,
  };
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function BudgetProgressBar({
  spent,
  projected,
  total,
}: {
  spent: number;
  projected: number;
  total: number;
}) {
  const denom = total > 0 ? total : 1;
  const spentPct = clamp((spent / denom) * 100, 0, 100);
  const projPct = clamp((projected / denom) * 100, 0, 100 - spentPct);
  const remainPct = clamp(100 - spentPct - projPct, 0, 100);
  const overspent = spent + projected > total;

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
        <div
          className={["h-full transition-all", overspent ? "bg-red-300" : "bg-emerald-300"].join(" ")}
          style={{ width: `${remainPct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />Spent
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />Projected
        </span>
        <span className="flex items-center gap-1">
          <span className={["inline-block h-1.5 w-1.5 rounded-full", overspent ? "bg-red-300" : "bg-emerald-300"].join(" ")} />
          Remaining
        </span>
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

// ─── Add Funds inline form ─────────────────────────────────────────────────────

function AddFundsForm({
  grantId,
  currentTotal,
  currentBudget,
  onDone,
}: {
  grantId: string;
  currentTotal: number;
  currentBudget: Record<string, unknown>;
  onDone: () => void;
}) {
  const patch = usePatchGrants();
  const [amount, setAmount] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const add = Number(amount.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(add) || add <= 0) return;
    const newTotal = currentTotal + add;

    // If exactly 1 line item, keep it in sync with the overall total
    const lineItems = Array.isArray(currentBudget.lineItems) ? currentBudget.lineItems as Record<string, unknown>[] : [];
    const syncedLineItems = lineItems.length === 1
      ? [{ ...lineItems[0], amount: newTotal }]
      : lineItems;

    patch.mutate(
      { id: grantId, patch: { budget: { ...currentBudget, total: newTotal, lineItems: syncedLineItems } } } as any,
      { onSettled: onDone },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5"
    >
      <span className="text-xs text-slate-400">+$</span>
      <input
        autoFocus
        type="number"
        min="0"
        step="any"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      <button
        type="submit"
        disabled={patch.isPending}
        className="rounded bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDone(); }}
        className="rounded px-1 py-0.5 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      >
        ✕
      </button>
    </form>
  );
}

// ─── BudgetCard ────────────────────────────────────────────────────────────────

const ACCENT_LEFT: Record<string, string> = {
  sky: "border-l-sky-400", blue: "border-l-blue-400", indigo: "border-l-indigo-400",
  violet: "border-l-violet-400", purple: "border-l-purple-400", pink: "border-l-pink-400",
  rose: "border-l-rose-400", red: "border-l-red-400", orange: "border-l-orange-400",
  amber: "border-l-amber-400", yellow: "border-l-yellow-400", lime: "border-l-lime-400",
  green: "border-l-green-400", emerald: "border-l-emerald-400", teal: "border-l-teal-400",
  cyan: "border-l-cyan-400", slate: "border-l-slate-400",
};

function getLineItemBudget(grant: Grant, lineItemId: string) {
  const lineItems = (grant as any)?.budget?.lineItems as Array<Record<string, unknown>> | undefined;
  const li = lineItems?.find((l) => l.id === lineItemId);
  if (!li) return null;
  const amount = Number(li.amount ?? 0);
  const spent = Number(li.spent ?? 0);
  const projected = Number(li.projected ?? 0);
  return {
    total: amount,
    spent,
    projected,
    remaining: amount - spent,
    projectedToSpend: spent + projected,
    available: amount - spent - projected,
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
  const [addingFunds, setAddingFunds] = useState(false);
  const { data: pinnedIds = [] } = usePinnedGrantIds();
  const togglePin = useTogglePinnedGrant();
  const { data: dashPinnedItems = [] } = usePinnedItems();
  const toggleDashPin = useTogglePinnedItem();

  const gid = String(grant.id);
  const isPinned = pinnedIds.includes(gid);
  const isDashPinned = dashPinnedItems.some((x) => x.type === "grant" && x.id === gid);

  const liData = lineItemId ? getLineItemBudget(grant, lineItemId) : null;
  const budget = liData ?? getBudget(grant);
  const status = String(grant.status || "active");

  // Auto-detect client-allocation: explicit prop OR grant has allocationEnabled OR displayed line item has capEnabled
  const isClientAlloc = cardType === "client-allocation" ||
    (grant as any)?.budget?.allocationEnabled === true ||
    (lineItemId
      ? ((grant as any)?.budget?.lineItems as Array<Record<string, unknown>> | undefined)
          ?.find((l) => l.id === lineItemId)?.capEnabled === true
      : false);

  const availClass =
    budget.available < 0
      ? "text-red-600 dark:text-red-400"
      : budget.available < budget.total * 0.1
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-500";

  const accentLeftClass = accentColor && ACCENT_LEFT[accentColor] ? ACCENT_LEFT[accentColor] : null;

  // Display name: labelOverride > line item label > grant name
  const displayName = labelOverride || (liData?.label ? liData.label : String(grant.name || grant.id));
  // Context label shown under name for line-item cards
  const contextLabel = liData?.label ? String(grant.name || grant.id) : null;

  return (
    <div
      className={[
        "group flex flex-col gap-0 rounded-xl border shadow-sm transition-shadow hover:shadow-md",
        accentLeftClass ? `border-l-4 ${accentLeftClass}` : "",
        isClientAlloc
          ? "border-sky-200 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
      ].join(" ")}
    >
      {/* Card header — clickable to open detail */}
      <button
        type="button"
        onClick={onClick}
        className="flex items-start justify-between gap-2 rounded-t-xl p-4 text-left transition hover:opacity-80"
      >
        <div className="min-w-0">
          {isClientAlloc && (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400">
              Client Allocation
            </div>
          )}
          <div className="truncate font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors text-base leading-snug">
            {displayName}
          </div>
          {contextLabel && (
            <div className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
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
        />
      </div>

      {/* Metric rows */}
      <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
        {/* Total row with + button */}
        <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
            {!lineItemId && !addingFunds && (
              <button
                type="button"
                title="Add funds to total"
                onClick={(e) => { e.stopPropagation(); setAddingFunds(true); }}
                className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600 dark:border-slate-600 dark:hover:border-sky-500 dark:hover:bg-sky-950 dark:hover:text-sky-400"
              >
                +
              </button>
            )}
            {addingFunds && (
              <AddFundsForm
                grantId={String(grant.id)}
                currentTotal={budget.total}
                currentBudget={budget.rawBudget}
                onDone={() => setAddingFunds(false)}
              />
            )}
          </div>
          {!addingFunds && (
            <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {fmtUsd(budget.total)}
            </span>
          )}
        </div>

        <MetricRow
          label="Spent"
          value={fmtUsd(budget.spent)}
          valueClass="text-amber-700 dark:text-amber-400"
        />
        <MetricRow
          label="Remaining"
          value={fmtUsd(budget.remaining)}
          valueClass="text-slate-700 dark:text-slate-200"
        />
        <MetricRow
          label="Projected to Spend"
          value={fmtUsd(budget.projectedToSpend)}
          valueClass={budget.projectedToSpend > budget.total ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}
          dimmed={budget.projectedToSpend === 0}
        />
        <MetricRow
          label="Available"
          value={fmtUsd(budget.available)}
          valueClass={availClass}
        />
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {gm ? (
            <>
              {gm.enrollments.active} enrolled
              {gm.caseManagers.total > 0 && ` · ${gm.caseManagers.total} CMs`}
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
