// web/src/features/budget/BudgetGroupSection.tsx
"use client";
import React from "react";
import { BudgetCard } from "./BudgetCard";
import { grantAccentSolid } from "@lib/colorRegistry";
import type { BudgetGroupItem } from "@hooks/useOrgConfig";
import type { TGrant as Grant } from "@types";
import { fmtCurrencyUSD } from "@lib/formatters";
import { getGrantFinancialCapabilities } from "@hdb/contracts";

const COL_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

const fmtUsd = (n: number) => fmtCurrencyUSD(n);
const toCents = (n: unknown) => Math.round(Number(n || 0) * 100);
const fromCents = (cents: number) => cents / 100;

function hasLineItemAllocation(grant: Grant, lineItemId?: string) {
  if (!lineItemId) return false;
  const lineItems = (grant as any)?.budget?.lineItems as Array<Record<string, unknown>> | undefined;
  return lineItems?.find((lineItem) => lineItem.id === lineItemId)?.capEnabled === true;
}

function hasGrantAllocation(grant: Grant) {
  const capabilities = getGrantFinancialCapabilities(grant as Record<string, unknown>);
  return capabilities.allocationEnabled || (grant as any)?.budget?.allocationEnabled === true;
}

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
  let groupTotalCents = 0;
  let groupSpentCents = 0;
  for (const { item, grant } of resolved) {
    if (item.lineItemId) continue; // skip line-item sub-cards for group totals
    const b = (grant.budget || {}) as Record<string, unknown>;
    const t = ((b.totals as Record<string, unknown>) || {}) as Record<string, unknown>;
    groupTotalCents += toCents(b.total ?? b.startAmount ?? 0);
    groupSpentCents += toCents(t.spent ?? b.spent ?? 0);
  }
  const groupTotal = fromCents(groupTotalCents);
  const groupSpent = fromCents(groupSpentCents);

  const accentClass = color ? grantAccentSolid(color) : "bg-slate-200 dark:bg-slate-600";
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
        {resolved.flatMap(({ item, grant }) => {
          const capabilities = getGrantFinancialCapabilities(grant as Record<string, unknown>);
          const explicitAllocation = item.cardType === "client-allocation";
          const lineItemAllocation = hasLineItemAllocation(grant, item.lineItemId);
          const grantAllocation = !item.lineItemId && hasGrantAllocation(grant);
          const isBillable = capabilities.billingEnabled || capabilities.usesBillingLedger;
          const shouldUseAllocationCard = explicitAllocation || lineItemAllocation || (grantAllocation && !isBillable);
          const cards = [
            <BudgetCard
              key={item.id}
              grant={grant}
              lineItemId={item.lineItemId}
              cardType={shouldUseAllocationCard ? "client-allocation" : "standard"}
              labelOverride={item.labelOverride}
              accentColor={item.color}
              onClick={() => onOpen(item.grantId)}
            />,
          ];

          if (grantAllocation && isBillable && !explicitAllocation && !item.lineItemId) {
            cards.push(
              <BudgetCard
                key={`${item.id}::allocation`}
                grant={grant}
                cardType="client-allocation"
                labelOverride={`${item.labelOverride || grant.name || grant.id} Allocations`}
                accentColor={item.color}
                onClick={() => onOpen(item.grantId)}
              />,
            );
          }

          return cards;
        })}
      </div>
    </section>
  );
}
