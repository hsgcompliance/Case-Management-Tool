// BEGIN FILE: web/src/entities/RefreshButton.tsx
"use client";

import React from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

type Props = {
  /** One or more queryKey prefixes to refresh (e.g. qk.customers.root, qk.grants.root) */
  queryKeys: QueryKey[]; // e.g. [qk.customers.root, qk.grants.root]
  /** Optional extra refresh work (rare). Keep business logic out of UI components. */
  onRefresh?: () => Promise<void> | void;

  title?: string;
  className?: string;
  label?: string;
  tourId?: string;
};

type QueryWithObservers = {
  queryKey: QueryKey;
  getObserversCount?: () => number;
};

export function RefreshButton({
  queryKeys,
  onRefresh,
  title = "Refresh",
  className = "",
  label = "Refresh",
  tourId,
}: Props) {
  const qc = useQueryClient();
  const [spinning, setSpinning] = React.useState(false);

  const handleClick = async () => {
    if (!queryKeys?.length || spinning) return;

    setSpinning(true);
    try {
      // 1) Invalidate + refetch mounted queries
      // Invalidate all matching (marks as stale — including unmounted), then
      // immediately refetch only the ones with active subscribers.
      await Promise.allSettled([
        ...( queryKeys || []).map((key) =>
          qc.invalidateQueries({ queryKey: key, exact: false }),
        ),
        ...(queryKeys || []).map((key) =>
          qc.refetchQueries({ queryKey: key, exact: false, type: "active" }),
        ),
      ]);

      // 2) Optional side effect (keep this uncommon)
      if (onRefresh) await onRefresh();

      // 3) Clean up *inactive* queries under these prefixes (no observers)
      const cache = qc.getQueryCache();
      for (const key of queryKeys || []) {
        const matches = cache.findAll({ queryKey: key, exact: false });
        for (const q of matches) {
          const item = q as unknown as QueryWithObservers;
          const observers =
            typeof item.getObserversCount === "function"
              ? item.getObserversCount()
              : 0;
          if (observers === 0) {
            qc.removeQueries({ queryKey: item.queryKey, exact: true });
          }
        }
      }
    } finally {
      setSpinning(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={spinning}
      aria-busy={spinning}
      title={title}
      className={[
        "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm",
        "hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        className,
      ].join(" ")}
      data-tour={tourId}
    >
      <svg
        className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 4v2.5m0 11V20m8-8h-2.5M6.5 12H4m12.02-5.52-1.77 1.77M7.25 16.75l-1.77 1.77m0-12.04 1.77 1.77m10.23 8.5-1.77 1.77"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span data-tour={tourId ? `${tourId}-label` : undefined}>{spinning ? "Refreshing…" : label}</span>
    </button>
  );
}

export default RefreshButton;
