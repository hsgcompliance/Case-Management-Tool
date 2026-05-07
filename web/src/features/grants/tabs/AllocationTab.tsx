// src/features/grants/tabs/AllocationTab.tsx
// Per-customer allocation view for allocation-type grants.
// Shows paid, projected, and total allocated per customer.
"use client";

import React, { useState } from "react";
import { useGrantCustomerAllocations } from "@hooks/useGrantCustomerAllocations";
import { useRecomputeGrantAllocations } from "@hooks/usePaymentQueue";
import { toast } from "@lib/toast";

const PAGE_SIZE = 15;

const fmtUsd = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

interface AllocationTabProps {
  grantId: string;
  /** Optional grant-level cap per customer (USD). */
  perCustomerCap?: number | null;
  lineItems?: Array<{
    id?: string | null;
    label?: string | null;
    name?: string | null;
    title?: string | null;
    capEnabled?: boolean | null;
    perCustomerCap?: number | null;
  }>;
}

export function AllocationTab({ grantId, perCustomerCap, lineItems = [] }: AllocationTabProps) {
  const { data: rows = [], isLoading, error, refetch } = useGrantCustomerAllocations(grantId);
  const recompute = useRecomputeGrantAllocations();
  const [page, setPage] = useState(0);
  const lineItemById = React.useMemo(() => {
    const map = new Map<string, NonNullable<AllocationTabProps["lineItems"]>[number]>();
    for (const item of lineItems) {
      const id = String(item.id || "");
      if (id) map.set(id, item);
    }
    return map;
  }, [lineItems]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showPaidProjected = rows.some((r) => r.projected !== 0);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        Loading allocations…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-red-500">
        Failed to load allocation data.
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No customer allocations recorded yet.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Summary row */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {rows.length} customer{rows.length !== 1 ? "s" : ""} with allocations
        </span>
        {perCustomerCap != null && (
          <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300">
            Cap: {fmtUsd(perCustomerCap)} / customer
          </span>
        )}
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          disabled={recompute.isPending}
          onClick={async () => {
            try {
              const result = await recompute.mutateAsync({ grantId });
              await refetch();
              toast(`Allocations recomputed (${result.customers} customers, ${result.ledgerRows} ledger rows).`, { type: "success" });
            } catch (e) {
              toast("Allocation recompute failed.", { type: "error" });
            }
          }}
        >
          {recompute.isPending ? "Recomputing..." : "Recompute"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                Customer
              </th>
              {showPaidProjected && (
                <>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Paid
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Projected
                  </th>
                </>
              )}
              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                Total Allocated
              </th>
              {perCustomerCap != null && (
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Status
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const isOver = perCustomerCap != null && row.total > perCustomerCap;
              const isNear =
                !isOver &&
                perCustomerCap != null &&
                perCustomerCap > 0 &&
                row.total / perCustomerCap >= 0.9;

              return (
                <tr
                  key={row.customerId}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                    <div>{row.customerName}</div>
                    {Object.keys(row.lineItemTotal || {}).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(row.lineItemTotal)
                          .sort((a, b) => Math.abs(Number(b[1] || 0)) - Math.abs(Number(a[1] || 0)))
                          .slice(0, 5)
                          .map(([lineItemId, amount]) => {
                            const line = lineItemById.get(lineItemId);
                            const label = String(line?.label || line?.name || line?.title || lineItemId);
                            const cap = line?.capEnabled && line?.perCustomerCap != null ? Number(line.perCustomerCap) : null;
                            const over = cap != null && Number(amount || 0) > cap;
                            return (
                            <span
                              key={lineItemId}
                              className={[
                                "inline-flex rounded border px-1.5 py-0.5 text-[10px] font-normal dark:bg-slate-900",
                                over
                                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:text-red-300"
                                  : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:text-slate-400",
                              ].join(" ")}
                              title={lineItemId}
                            >
                              {label}: {fmtUsd(Number(amount || 0))}{cap != null ? ` / ${fmtUsd(cap)}` : ""}
                            </span>
                          );})}
                      </div>
                    )}
                  </td>
                  {showPaidProjected && (
                    <>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                        {row.paid !== 0 ? fmtUsd(row.paid) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-blue-700 dark:text-blue-400">
                        {row.projected !== 0 ? fmtUsd(row.projected) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </>
                  )}
                  <td
                    className={[
                      "px-4 py-2.5 text-right tabular-nums font-semibold",
                      isOver
                        ? "text-red-600 dark:text-red-400"
                        : isNear
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-800 dark:text-slate-100",
                    ].join(" ")}
                  >
                    {fmtUsd(row.total)}
                  </td>
                  {perCustomerCap != null && (
                    <td className="px-4 py-2.5 text-right">
                      {isOver ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                          Over cap
                        </span>
                      ) : isNear ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Near cap
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          OK
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-slate-400">
            Page {page + 1} of {totalPages} · {rows.length} total
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
