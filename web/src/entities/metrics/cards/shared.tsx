"use client";

import React from "react";
import { MetricStrip, type MetricStripItem } from "@entities/metrics/strip/MetricStrip";

export type MetricCardItem = MetricStripItem;
export type MetricItemTransform = (items: MetricCardItem[]) => MetricCardItem[];

export type MetricCardsProps = {
  items: MetricCardItem[];
  className?: string;
  gridClassName?: string;
};

export type BuiltMetricCardsProps = {
  className?: string;
  gridClassName?: string;
  transformItems?: MetricItemTransform;
};

export function MetricCards({
  items,
  className,
  gridClassName = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
}: MetricCardsProps) {
  return <MetricStrip items={items} className={className} gridClassName={gridClassName} />;
}

export function useTransformedMetricItems(items: MetricCardItem[], transformItems?: MetricItemTransform) {
  return React.useMemo(() => (transformItems ? transformItems(items) : items), [items, transformItems]);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US");
}

export function formatIntegerOrDecimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function summarizeRefs(refs?: Array<{ id: string; name?: string | null }>): string | undefined {
  if (!refs?.length) return undefined;
  const labels = refs.map((ref) => String(ref.name || ref.id || "").trim()).filter(Boolean);
  if (!labels.length) return undefined;
  return labels.length <= 3 ? labels.join(", ") : `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}
