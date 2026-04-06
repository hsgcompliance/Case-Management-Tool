"use client";

import React from "react";
import { toneActiveChipClass, toneChipClass, type ColorTone } from "@lib/colorRegistry";

export type FilteringMetricChipVariant = "default" | "info" | "success" | "warning" | "danger" | "muted";

const variantClasses: Record<FilteringMetricChipVariant, string> = {
  default: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  info: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  danger: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  muted: "bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700",
};

export type FilteringMetricChipHoverText =
  | string
  | boolean
  | Record<string, string | number | null | undefined>;

function buildTooltip(
  hoverText: FilteringMetricChipHoverText | undefined,
  label: string,
  value: string,
  sub?: string | null,
): string | undefined {
  if (!hoverText) return undefined;
  if (hoverText === true) {
    const parts = [`${label}: ${value}`];
    if (sub) parts.push(`(${sub})`);
    return parts.join(" ");
  }
  if (typeof hoverText === "string") return hoverText;
  return Object.entries(hoverText)
    .filter(([, entryValue]) => entryValue != null)
    .map(([key, entryValue]) => {
      const formatted =
        typeof entryValue === "number"
          ? entryValue.toLocaleString()
          : String(entryValue ?? "-");
      return `${key}: ${formatted}`;
    })
    .join("\n");
}

export type FilteringMetricChipProps = {
  label: string;
  value: string | number | null | undefined;
  variant?: FilteringMetricChipVariant;
  tone?: ColorTone;
  sub?: string | null;
  hoverText?: FilteringMetricChipHoverText;
  title?: string;
  loading?: boolean;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

export function FilteringMetricChip({
  label,
  value,
  variant = "default",
  tone,
  sub,
  hoverText,
  title,
  loading,
  active,
  onClick,
  className = "",
}: FilteringMetricChipProps) {
  const display = value == null ? "-" : String(value);

  const tooltip = title ?? buildTooltip(hoverText, label, display, sub);
  const isToggle = onClick !== undefined;
  const semanticClass = tone ? (active ? toneActiveChipClass(tone) : toneChipClass(tone)) : "";

  const base = [
    "inline-flex min-w-[80px] flex-col rounded-md border px-2.5 py-1.5 text-left",
    isToggle ? "cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400" : "",
    tone
      ? `${semanticClass}${isToggle && !active ? " hover:brightness-95" : ""}`
      : active
        ? "border-sky-500 bg-sky-100 text-sky-900 dark:border-sky-600 dark:bg-sky-900/40 dark:text-sky-200"
        : isToggle
          ? `${variantClasses[variant]} hover:brightness-95`
          : variantClasses[variant],
    className,
  ].join(" ");

  if (loading) {
    return (
      <div className={base} aria-busy="true">
        <span className="text-[10px] uppercase tracking-wide opacity-60">{label}</span>
        <span className="mt-0.5 h-5 w-10 animate-pulse rounded bg-current opacity-20" />
      </div>
    );
  }

  const inner = (
    <>
      <span className={`text-[10px] uppercase tracking-wide leading-tight ${active ? "opacity-80" : "opacity-60"}`}>
        {label}
      </span>
      <span
        className={[
          "mt-0.5 text-sm font-semibold leading-tight",
          tone ? "" : active ? "text-sky-900 dark:text-sky-200" : "",
        ].join(" ")}
      >
        {display}
      </span>
      {sub ? (
        <span className={`mt-0.5 text-[10px] leading-tight ${active ? "opacity-70" : "opacity-50"}`}>
          {sub}
        </span>
      ) : null}
    </>
  );

  if (isToggle) {
    return (
      <button
        type="button"
        className={base}
        title={tooltip}
        aria-pressed={active}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={base} title={tooltip}>
      {inner}
    </div>
  );
}

export default FilteringMetricChip;
