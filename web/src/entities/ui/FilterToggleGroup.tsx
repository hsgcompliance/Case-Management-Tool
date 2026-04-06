"use client";

import React from "react";

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

export interface FilterToggleGroupProps<T extends string = string> {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
}

export function FilterToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: FilterToggleGroupProps<T>) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="inline-flex flex-wrap items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
              value === option.value
                ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default FilterToggleGroup;
