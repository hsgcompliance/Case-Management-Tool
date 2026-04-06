"use client";

import React from "react";
import type { MetricStripItem, MetricStripResetOption, TierState } from "./MetricStrip";

type MetricsDropdownProps = {
  items: MetricStripItem[];
  tiers: TierState;
  resetOptions?: MetricStripResetOption[];
  setTiers: React.Dispatch<React.SetStateAction<TierState>>;
  onClose: () => void;
};

export function MetricsDropdown({
  items,
  tiers,
  resetOptions,
  setTiers,
  onClose,
}: MetricsDropdownProps) {
  function moveTo(id: string, tier: "large" | "small" | "hidden") {
    setTiers((prev) => ({
      large: tier === "large"
        ? prev.large.includes(id) ? prev.large : [...prev.large, id]
        : prev.large.filter((x) => x !== id),
      small: tier === "small"
        ? prev.small.includes(id) ? prev.small : [...prev.small, id]
        : prev.small.filter((x) => x !== id),
    }));
  }

  return (
    <div className="absolute right-0 top-full z-[80] mt-2 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      {resetOptions?.length ? (
        <>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Presets
          </div>
          <div className="mb-3 space-y-0.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            {resetOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                disabled={option.disabled}
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => {
                  const allIds = items.map((i) => i.id);
                  const large = (option.largeIds ?? option.ids ?? []).filter((id) => allIds.includes(id));
                  const small = (option.smallIds ?? []).filter((id) => allIds.includes(id));
                  setTiers({ large, small });
                  onClose();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Metrics</span>
        <div className="flex gap-3 pr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span className="w-8 text-center">Large</span>
          <span className="w-8 text-center">Small</span>
          <span className="w-8 text-center">Off</span>
        </div>
      </div>

      <div className="space-y-0.5 max-h-64 overflow-y-auto">
        {items.map((item) => {
          const inLarge = tiers.large.includes(item.id);
          const inSmall = tiers.small.includes(item.id);
          const inHidden = !inLarge && !inSmall;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span className="flex-1 min-w-0 truncate text-sm text-slate-700 dark:text-slate-300">
                {item.label}
              </span>
              <div className="flex gap-3 pr-1">
                {(["large", "small", "hidden"] as const).map((tier) => {
                  const checked = tier === "large" ? inLarge : tier === "small" ? inSmall : inHidden;
                  return (
                    <button
                      key={tier}
                      type="button"
                      title={tier === "hidden" ? "Hide" : `Show in ${tier} row`}
                      onClick={() => moveTo(item.id, tier)}
                      className={[
                        "w-8 h-5 rounded-full border transition text-[10px] font-semibold",
                        checked
                          ? "border-sky-400 bg-sky-400 text-white"
                          : "border-slate-200 bg-white text-slate-400 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800",
                      ].join(" ")}
                    >
                      {checked ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MetricsDropdown;
