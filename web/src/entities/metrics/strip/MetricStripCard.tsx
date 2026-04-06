"use client";

import React from "react";
import { metricCardClass, metricChipClass, toneCardClass, toneChipClass, type ColorTone, type MetricColorId } from "@lib/colorRegistry";

export interface MetricStripCardProps {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
  subtext?: React.ReactNode;
  metricId?: MetricColorId;
  tone?: ColorTone;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function MetricStripCard({
  label,
  value,
  tooltip,
  subtext,
  metricId,
  tone = "sky",
  className,
  loading,
  disabled,
  active,
  compact = false,
  onClick,
}: MetricStripCardProps) {
  const colorClass = compact
    ? metricId ? metricChipClass(metricId) : toneChipClass(tone)
    : metricId ? metricCardClass(metricId) : toneCardClass(tone);

  const shellClassName = compact
    ? [
        "rounded-xl border px-3 py-2 text-left transition",
        colorClass,
        onClick ? "cursor-pointer hover:shadow-sm" : "",
        active ? "ring-2 ring-slate-300 dark:ring-slate-500" : "",
        disabled ? "opacity-50" : "",
        className,
      ].filter(Boolean).join(" ")
    : [
        "rounded-2xl border p-4 text-left shadow-sm transition",
        colorClass,
        onClick ? "cursor-pointer hover:shadow-md" : "",
        active ? "ring-2 ring-slate-300 dark:ring-slate-500" : "",
        disabled ? "opacity-50" : "",
        className,
      ].filter(Boolean).join(" ");

  const body = loading ? (
    compact ? (
      <>
        <div className="mb-1 h-2 w-16 animate-pulse rounded bg-white/50 dark:bg-slate-700/60" />
        <div className="h-5 w-12 animate-pulse rounded bg-white/60 dark:bg-slate-700/70" />
      </>
    ) : (
      <>
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-white/50 dark:bg-slate-700/60" />
        <div className="h-8 w-20 animate-pulse rounded bg-white/60 dark:bg-slate-700/70" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/40 dark:bg-slate-700/50" />
      </>
    )
  ) : compact ? (
    <>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75 leading-tight">{label}</div>
      <div className="flex items-baseline gap-1.5 leading-none mt-0.5">
        <span className="text-lg font-bold">{value ?? "-"}</span>
        {subtext ? <span className="text-[10px] opacity-70">{subtext}</span> : null}
      </div>
    </>
  ) : (
    <>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-90">{label}</div>
      <div className="text-3xl font-bold leading-none">{value ?? "-"}</div>
      {subtext ? <div className="mt-2 text-xs opacity-80">{subtext}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={shellClassName} title={tooltip} onClick={onClick} disabled={disabled}>
        {body}
      </button>
    );
  }

  return (
    <div className={shellClassName} title={tooltip}>
      {body}
    </div>
  );
}

export default MetricStripCard;
