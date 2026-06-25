"use client";

import React from "react";
import { useBudgetRollupPreview } from "@hooks/useBudgetPipeline";
import type { BudgetRollupPreviewSource } from "@client/budgetPipeline";

function money(value: number | null | undefined) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function SourceList({ rows }: { rows: BudgetRollupPreviewSource[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {rows.slice(0, 5).map((row) => (
        <div key={`${row.sourceType}:${row.id}`} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
          <div className="min-w-0">
            <span className="font-mono uppercase text-slate-400">{row.sourceType}</span>
            <span className="mx-1 text-slate-300">/</span>
            <span className="truncate">{row.label || row.id}</span>
            {row.reason ? <span className="ml-1 text-amber-700">({row.reason})</span> : null}
          </div>
          <div className="shrink-0 tabular-nums">
            {row.date ? `${row.date} · ` : ""}{money(row.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BudgetRollupPreviewPanel({
  grantId,
  startDate,
  endDate,
  focusSourceId,
  compact = false,
}: {
  grantId?: string | null;
  startDate?: string;
  endDate?: string;
  focusSourceId?: string;
  compact?: boolean;
}) {
  const { data, isLoading, isError, error, refetch } = useBudgetRollupPreview({ grantId, startDate, endDate, focusSourceId, limit: compact ? 10 : 25 });

  if (!grantId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Select or assign a grant to preview budget rollup placement.
      </div>
    );
  }

  if (isLoading) {
    return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">Loading budget rollup...</div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {(error as Error)?.message || "Failed to load budget rollup."}
      </div>
    );
  }

  const activeLineItems = data.lineItems.filter((li) => li.budget || li.spent || li.projected || li.splitGoals.length);

  return (
    <section className={compact ? "rounded-lg border border-slate-200 bg-slate-50 p-3" : "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget Rollup Preview</div>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">{data.grant.name}</h3>
          <div className="mt-1 text-xs text-slate-500">
            Ledger {data.sourceCounts.ledger} · payment queue {data.sourceCounts.paymentQueue} · unmatched {data.sourceCounts.unmatched}
          </div>
        </div>
        <button type="button" className="btn btn-xs btn-secondary" onClick={() => void refetch()}>
          Refresh
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
        <Metric label="Budget" value={data.grant.budget} />
        <Metric label="Spent" value={data.grant.spent} />
        <Metric label="Projected" value={data.grant.projected} />
        <Metric label="Balance" value={data.grant.balance} />
        <Metric label="Projected balance" value={data.grant.projectedBalance} />
      </div>

      <div className="mt-3 space-y-2">
        {activeLineItems.map((li) => (
          <details key={li.id || li.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" open={!compact}>
            <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">
              {li.label}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {money(li.spent)} spent · {money(li.projected)} projected · {money(li.budget)} budget
              </span>
            </summary>
            {li.splitGoals.length ? (
              <div className="mt-2 space-y-1">
                {li.splitGoals.map((goal) => (
                  <div key={goal.id || goal.label} className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">{goal.label}</span>
                      <span className="text-slate-500">{goal.startDate || "TBD"} - {goal.endDate || "TBD"}</span>
                    </div>
                    <div className="mt-1 text-slate-500">
                      {money(goal.spent)} spent · {money(goal.projected)} projected · {money(goal.amount)} planned · projected balance {money(goal.projectedBalance)}
                    </div>
                    <SourceList rows={goal.sources} />
                  </div>
                ))}
              </div>
            ) : null}
            <SourceList rows={li.sources} />
          </details>
        ))}
      </div>

      {data.unmatched.length ? (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2" open>
          <summary className="cursor-pointer text-sm font-semibold text-amber-900">Needs review ({data.sourceCounts.unmatched})</summary>
          <SourceList rows={data.unmatched} />
        </details>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-800 tabular-nums">{money(value)}</div>
    </div>
  );
}
