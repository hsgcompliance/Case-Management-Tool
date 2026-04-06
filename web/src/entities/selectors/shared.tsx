"use client";

import { RGSelect, type RGSelectProps, type SelectOption, type SelectOptionGroup } from "@entities/ui/forms/InputComponents";

export type EntitySelectOption = SelectOption | SelectOptionGroup;

export function asEntityArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)) {
    return ((raw as { items?: unknown[] }).items || []) as T[];
  }
  return [];
}

export function entitySelectInputClassName(minWidthClass: string, extraClassName = ""): string {
  return [
    minWidthClass,
    "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm",
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    "focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600",
    extraClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

export function resolveEntityPlaceholder({
  isLoading,
  isEmpty,
  loadingLabel,
  emptyLabel,
  placeholderLabel,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  loadingLabel: string;
  emptyLabel: string;
  placeholderLabel: string;
}): string {
  if (isLoading) return loadingLabel;
  if (isEmpty) return emptyLabel;
  return placeholderLabel;
}

export type EntitySelectProps = Omit<RGSelectProps, "options" | "onChange" | "value"> & {
  value: string | null;
  onChange: (next: string | null) => void;
  options: EntitySelectOption[];
};

export function EntitySelect({ value, onChange, options, ...props }: EntitySelectProps) {
  return <RGSelect {...props} value={value} onChange={(next) => onChange(next || null)} options={options} />;
}
