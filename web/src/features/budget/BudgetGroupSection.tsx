// web/src/features/budget/BudgetGroupSection.tsx
"use client";
import React from "react";
import { BudgetCard } from "./BudgetCard";
import type { BudgetGroupItem } from "@hooks/useOrgConfig";
import type { TGrant as Grant } from "@types";

// Color key → header accent class
const ACCENT: Record<string, string> = {
  sky:     "bg-sky-500",
  blue:    "bg-blue-500",
  indigo:  "bg-indigo-500",
  violet:  "bg-violet-500",
  purple:  "bg-purple-500",
  pink:    "bg-pink-500",
  rose:    "bg-rose-500",
  red:     "bg-red-500",
  orange:  "bg-orange-500",
  amber:   "bg-amber-500",
  yellow:  "bg-yellow-500",
  lime:    "bg-lime-500",
  green:   "bg-green-500",
  emerald: "bg-emerald-500",
  teal:    "bg-teal-500",
  cyan:    "bg-cyan-500",
  slate:   "bg-slate-400",
};

const COL_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

const fmtUsd = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface BudgetGroupSectionProps {
  label: string;
  color?: string;
  cols?: number;
  items: BudgetGroupItem[];
  /** All active grants keyed by ID — used to look up grants for each item. */
  grantsById: Map<string, Grant>;
  onOpen: (grantId: string) => void;
}

export function BudgetGroupSection({
  label,
  color,
  cols = 3,
  items,
  grantsById,
  onOpen,
}: BudgetGroupSectionProps) {
  // Resolve items to grants (skip missing)
  const resolved = items
    .map((item) => ({ item, grant: grantsById.get(item.grantId) }))
    .filter((r): r is { item: BudgetGroupItem; grant: Grant } => !!r.grant);

  if (resolved.length === 0) return null;

  // Group-level totals (grant-level items only; line items add noise to group totals)
  let groupTotal = 0;
  let groupSpent = 0;
  for (const { item, grant } of resolved) {
    if (item.lineItemId) continue; // skip line-item sub-cards for group totals
    const b = (grant.budget || {}) as Record<string, unknown>;
    const t = ((b.totals as Record<string, unknown>) || {}) as Record<string, unknown>;
    groupTotal += Number((b.total ?? b.startAmount ?? 0) as number);
    groupSpent += Number((t.spent ?? b.spent ?? 0) as number);
  }

  const accentClass = color && ACCENT[color] ? ACCENT[color] : "bg-slate-200 dark:bg-slate-600";
  const colClass = COL_CLASS[cols] ?? COL_CLASS[3];

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
        <span className={`inline-block h-3 w-3 rounded-full ${accentClass} flex-shrink-0`} />
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 flex-1">{label}</h2>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <span>{resolved.length} {resolved.length === 1 ? "item" : "items"}</span>
          {groupTotal > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span>{fmtUsd(groupTotal)}</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-amber-600 dark:text-amber-400">{fmtUsd(groupSpent)} spent</span>
            </>
          )}
        </div>
      </div>

      {/* Card grid */}
      <div className={`grid gap-4 ${colClass}`}>
        {resolved.map(({ item, grant }) => (
          <BudgetCard
            key={item.id}
            grant={grant}
            lineItemId={item.lineItemId}
            cardType={item.cardType ?? "standard"}
            labelOverride={item.labelOverride}
            accentColor={item.color}
            onClick={() => onOpen(item.grantId)}
          />
        ))}
      </div>
    </section>
  );
}
