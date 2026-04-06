"use client";

import React from "react";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "sky"
  | "violet"
  | "amber"
  | "rose";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default:  "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  success:  "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  warning:  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  danger:   "bg-red-100   text-red-800   dark:bg-red-900/40   dark:text-red-300",
  info:     "bg-blue-100  text-blue-800  dark:bg-blue-900/40  dark:text-blue-300",
  muted:    "bg-slate-50  text-slate-400 dark:bg-slate-800    dark:text-slate-500",
  sky:      "bg-sky-100   text-sky-800   dark:bg-sky-900/40   dark:text-sky-300",
  violet:   "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  amber:    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  rose:     "bg-rose-100  text-rose-800  dark:bg-rose-900/40  dark:text-rose-300",
};

export interface BadgeChipProps {
  label: React.ReactNode;
  variant?: BadgeVariant;
  /** Optional dot indicator matching the variant colour */
  dot?: boolean;
  className?: string;
}

export function BadgeChip({ label, variant = "default", dot, className }: BadgeChipProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      ].filter(Boolean).join(" ")}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      ) : null}
      {label}
    </span>
  );
}

export default BadgeChip;
