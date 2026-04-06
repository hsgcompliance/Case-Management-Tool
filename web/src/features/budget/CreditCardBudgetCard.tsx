// web/src/features/budget/CreditCardBudgetCard.tsx
"use client";
import React from "react";
import type { CreditCardSummaryItem } from "@types";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

const fmtUsd = (cents: number) =>
  (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

interface CreditCardBudgetCardProps {
  card: CreditCardSummaryItem;
  onClick?: () => void;
}

export function CreditCardBudgetCard({ card, onClick }: CreditCardBudgetCardProps) {
  const usedPct = clamp(card.usagePct ?? 0, 0, 100);
  const remainingPct = 100 - usedPct;
  const lowAvailability = remainingPct < 25;
  const over = usedPct >= 100;

  const barClass = over
    ? "bg-red-500"
    : usedPct >= 85
    ? "bg-amber-500"
    : "bg-emerald-500";

  const cardEl = (
    <div
      className={[
        "flex flex-col gap-0 rounded-xl border shadow-sm transition-shadow",
        onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600" : "",
        "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Credit Card
          </div>
          <div className="mt-0.5 truncate font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">
            {card.name}
            {card.last4 ? (
              <span className="ml-1.5 text-xs font-normal text-slate-400">·{card.last4}</span>
            ) : null}
          </div>
        </div>
        {lowAvailability && (
          <span
            className={[
              "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              over
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400",
            ].join(" ")}
          >
            {over ? "Over limit" : "Low availability"}
          </span>
        )}
      </div>

      {/* Progress bar section */}
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 space-y-2">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
          <div
            className={["h-full rounded-full transition-all", barClass].join(" ")}
            style={{ width: `${Math.min(usedPct, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{Math.round(usedPct)}% used</span>
          <span className={remainingPct < 25 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
            {Math.round(remainingPct)}% remaining
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Limit</span>
          <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {fmtUsd(card.monthlyLimitCents)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Spent</span>
          <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            {fmtUsd(card.spentCents)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Remaining</span>
          <span className={["text-sm font-semibold tabular-nums", over ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-500"].join(" ")}>
            {fmtUsd(Math.max(card.remainingCents, 0))}
          </span>
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {cardEl}
      </button>
    );
  }
  return cardEl;
}
