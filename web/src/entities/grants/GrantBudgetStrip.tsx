"use client";

import React from "react";
import { useGrant } from "@hooks/useGrants";
import { fmtCurrencyUSD } from "@lib/formatters";

type Props = {
  grantId: string | null | undefined;
  /** Additional projected spend from the current editing session (positive = more cost). */
  projectionDelta?: number;
  /** Optional per-line-item preview deltas. Positive means the edit increases projected/spent pressure. */
  lineItemDeltas?: Record<string, number>;
  className?: string;
};

function Stat({
  label,
  value,
  delta = 0,
  warnNegative = false,
  bold = false,
}: {
  label: string;
  value: number | undefined | null;
  delta?: number;
  warnNegative?: boolean;
  bold?: boolean;
}) {
  if (value == null) return null;
  const adjusted = value + delta;
  const hasDelta = delta !== 0;
  const isOverspend = warnNegative && adjusted < 0;

  return (
    <div
      className={`flex flex-col gap-0.5 rounded px-1.5 py-0.5 -mx-1.5 ${
        isOverspend ? "bg-rose-100 ring-1 ring-rose-200" : ""
      }`}
    >
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <span
        className={`text-xs ${bold ? "font-bold" : "font-medium"} ${
          isOverspend ? "text-rose-700" : hasDelta ? "text-amber-700" : "text-slate-700"
        }`}
      >
        {fmtCurrencyUSD(adjusted)}
        {hasDelta && (
          <span className={`ml-1 font-normal ${isOverspend ? "text-rose-400" : "text-slate-400"}`}>
            ({delta > 0 ? "+" : ""}{fmtCurrencyUSD(delta)})
          </span>
        )}
      </span>
    </div>
  );
}

export function GrantBudgetStrip({ grantId, projectionDelta = 0, lineItemDeltas, className }: Props) {
  const { data: grant, isLoading } = useGrant(grantId ?? undefined, { enabled: !!grantId });

  if (!grantId) return null;

  if (isLoading) {
    return (
      <div className={`animate-pulse rounded border border-slate-200 bg-slate-50 px-3 py-2.5 ${className ?? ""}`}>
        <div className="mb-1.5 h-2.5 w-32 rounded bg-slate-200" />
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-7 w-20 rounded bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const totals = grant?.budget?.totals;

  if (!totals) {
    return (
      <div className={`rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 ${className ?? ""}`}>
        {grant?.name ? <b className="text-slate-700">{grant.name}</b> : "Grant"} · No budget totals available.
      </div>
    );
  }

  const projectedBalance =
    totals.projectedBalance ?? totals.total - totals.spent - totals.projected;
  const adjustedBalance = projectedBalance - projectionDelta;
  const isOverspend = adjustedBalance < 0;
  const lineItems = Array.isArray(grant?.budget?.lineItems) ? grant.budget.lineItems : [];
  const visibleLineItemImpacts = Object.entries(lineItemDeltas || {})
    .filter(([, delta]) => Math.abs(Number(delta || 0)) >= 0.005)
    .map(([lineItemId, delta]) => {
      const li = lineItems.find((item: Record<string, unknown>) => String(item?.id || "") === lineItemId) as
        | Record<string, unknown>
        | undefined;
      const label = String(li?.label || li?.name || li?.title || li?.code || lineItemId);
      const projected = Number(li?.projected || 0);
      const spent = Number(li?.spent || 0);
      const cap = Number(li?.amount || 0);
      const after = projected + Number(delta || 0);
      return {
        lineItemId,
        label,
        delta: Number(delta || 0),
        after,
        overBy: Math.max(0, spent + after - cap),
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  return (
    <div
      className={`rounded border px-3 py-2.5 ${
        isOverspend ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
      } ${className ?? ""}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">{grant?.name}</span>
        {isOverspend && (
          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Overspend
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Stat label="Budget" value={totals.total} />
        <Stat label="Spent" value={totals.spent} />
        <Stat label="Projected" value={totals.projected} delta={projectionDelta} />
        <Stat
          label="Proj. Remaining"
          value={projectedBalance}
          delta={-projectionDelta}
          warnNegative
          bold
        />
        {totals.balance != null && <Stat label="Balance" value={totals.balance} />}
      </div>
      {visibleLineItemImpacts.length ? (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Line item impact
          </div>
          <div className="grid gap-1 text-xs md:grid-cols-2">
            {visibleLineItemImpacts.map((item) => (
              <div
                key={item.lineItemId}
                className={`flex items-center justify-between gap-3 rounded px-2 py-1 ${
                  item.overBy > 0 ? "bg-rose-100 text-rose-800" : "bg-white text-slate-700"
                }`}
              >
                <span className="min-w-0 truncate" title={item.lineItemId}>{item.label}</span>
                <span className="shrink-0 font-medium">
                  {item.delta > 0 ? "+" : ""}{fmtCurrencyUSD(item.delta)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default GrantBudgetStrip;
