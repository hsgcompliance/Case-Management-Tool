"use client";

import React from "react";

type MetricToggleCardProps = {
  label: string;
  value: string | number;
  active?: boolean;
  onClick?: () => void;
  title?: string;
};

export function MetricToggleCard({ label, value, active = false, onClick, title }: MetricToggleCardProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title || label}
      onClick={onClick}
      className={[
        "min-w-[120px] rounded-md border px-3 py-2 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
        active
          ? "border-sky-500 bg-sky-100 text-sky-900"
          : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200",
      ].join(" ")}
    >
      <div className={`text-[11px] uppercase tracking-wide ${active ? "text-sky-700" : "text-slate-500"}`}>{label}</div>
      <div className={`text-lg font-semibold ${active ? "text-sky-900" : "text-slate-800"}`}>{value}</div>
    </button>
  );
}

export default MetricToggleCard;
