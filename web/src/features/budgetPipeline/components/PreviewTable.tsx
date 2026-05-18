"use client";
// web/src/features/budgetPipeline/components/PreviewTable.tsx
import React from "react";
import type { TBudgetPipelinePreviewResult } from "@types";

function fmtAmount(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type Props = {
  result: TBudgetPipelinePreviewResult | null;
  isLoading: boolean;
  onRun: () => void;
};

export function PreviewTable({ result, isLoading, onRun }: Props) {
  const perItemMap = React.useMemo(() => {
    if (!result) return new Map<string, TBudgetPipelinePreviewResult["perItem"][number]>();
    return new Map(result.perItem.map((p) => [p.itemId, p]));
  }, [result]);

  return (
    <section className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Preview Matching Transactions
        </h3>
        <button
          type="button"
          onClick={onRun}
          disabled={isLoading}
          className="btn btn-sm btn-secondary disabled:opacity-60"
        >
          {isLoading ? "Running…" : "Run Preview"}
        </button>
      </div>

      {/* Summary chips */}
      {result && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-medium">
            {result.matchCount} matched
          </span>
          <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 font-medium">
            {fmtAmount(result.totalAmount)} total
          </span>
          {result.conflicts.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-medium"
              title={result.conflicts.map((c) => `"${c.pipelineName}" also matches ${c.itemIds.length} item(s)`).join("\n")}
            >
              ⚠ {result.conflicts.length} pipeline conflict{result.conflicts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Conflict detail */}
      {result && result.conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Pipeline conflicts detected:</p>
          {result.conflicts.map((c) => (
            <p key={c.pipelineId} className="text-amber-700 dark:text-amber-400">
              &quot;{c.pipelineName}&quot; also matches {c.itemIds.length} item{c.itemIds.length !== 1 ? "s" : ""}. These would double-count.
            </p>
          ))}
        </div>
      )}

      {/* Table */}
      {!result && !isLoading && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Click &quot;Run Preview&quot; to evaluate the current rules against pending transactions.
        </div>
      )}

      {isLoading && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-8 text-center text-sm text-slate-400 dark:text-slate-500 animate-pulse">
          Evaluating rules…
        </div>
      )}

      {result && result.matched.length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No transactions matched. Adjust your include rules or check that the source form has pending items.
        </div>
      )}

      {result && result.matched.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Merchant</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400">Amount</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Form</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Month</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Customer</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Grant → Line Item</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Match reasons</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Conflicts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {result.matched.map((item) => {
                const meta = perItemMap.get(item.id);
                const hasConflict = (meta?.conflictPipelineIds.length ?? 0) > 0;
                return (
                  <tr
                    key={item.id}
                    className={
                      hasConflict
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }
                  >
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200 max-w-[140px] truncate">
                      {item.merchant || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {fmtAmount(item.amount)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[120px] truncate text-xs">
                      {item.formTitle || item.source}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 tabular-nums">
                      {item.month}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                      {item.customer || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {item.grantId
                        ? <span className="font-mono">{item.grantId}{item.lineItemId ? ` → ${item.lineItemId}` : ""}</span>
                        : <span className="text-slate-300 dark:text-slate-600">unassigned</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 max-w-[180px]">
                      {meta?.matchReasons.join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {hasConflict ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          ⚠ {meta!.conflictPipelineIds.length}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
