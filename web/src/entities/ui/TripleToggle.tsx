"use client";
import React from "react";

export type TripleToggleValue = 0 | 1 | 2;

export type TripleToggleConfig = {
  label: string;
  title: string;
  className: string;
  symbol: string;
};

export const CERT_DUE_TOGGLE_CONFIG: [TripleToggleConfig, TripleToggleConfig, TripleToggleConfig] = [
  { label: "None",     title: "No cert due",          symbol: "·", className: "border-slate-200 bg-transparent text-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" },
  { label: "Upcoming", title: "Cert due next month",  symbol: "!", className: "border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  { label: "Due",      title: "Cert due this month",  symbol: "✓", className: "border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
];

type Props = {
  value: TripleToggleValue;
  onChange?: (next: TripleToggleValue) => void;
  config?: [TripleToggleConfig, TripleToggleConfig, TripleToggleConfig];
  disabled?: boolean;
  readOnly?: boolean;
  size?: "xs" | "sm" | "md";
};

export function TripleToggle({
  value,
  onChange,
  config = CERT_DUE_TOGGLE_CONFIG,
  disabled,
  readOnly,
  size = "sm",
}: Props) {
  const next = ((value + 1) % 3) as TripleToggleValue;
  const cfg = config[value];
  const sizeClass =
    size === "xs" ? "h-4 w-4 text-[9px]" :
    size === "sm" ? "h-5 w-5 text-[10px]" :
    "h-6 w-6 text-xs";

  if (readOnly || (!onChange && !disabled)) {
    return (
      <span
        title={cfg.title}
        className={`inline-flex items-center justify-center rounded border font-bold leading-none ${sizeClass} ${cfg.className} cursor-default`}
      >
        {cfg.symbol}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={cfg.title}
      disabled={disabled}
      onClick={() => onChange?.(next)}
      className={`inline-flex items-center justify-center rounded border font-bold leading-none transition-colors ${sizeClass} ${cfg.className} ${disabled ? "cursor-default opacity-50" : "cursor-pointer"}`}
    >
      {cfg.symbol}
    </button>
  );
}

export function certDueToggleValue(
  paymentMonth: string,
  certDueMonths: Set<string>,
  certUpcomingMonths: Set<string>,
): TripleToggleValue {
  if (certDueMonths.has(paymentMonth)) return 2;
  if (certUpcomingMonths.has(paymentMonth)) return 1;
  return 0;
}
