"use client";

import React from "react";
import { currentMonthKey, useSystemMetrics, useSystemMonthMetrics } from "@hooks/useMetrics";
import {
  formatCurrency,
  formatNumber,
  MetricCards,
  type BuiltMetricCardsProps,
  type MetricCardItem,
  useTransformedMetricItems,
} from "./shared";

export function buildSystemMetricItems(
  sys: ReturnType<typeof useSystemMetrics>["data"],
  sysMonth: ReturnType<typeof useSystemMonthMetrics>["data"],
  sysLoading: boolean,
  monthLoading: boolean,
  month: string,
): MetricCardItem[] {
  return [
    {
      id: "system-case-managers",
      label: "Case Managers",
      value: formatNumber(sys?.caseManagers.total),
      subtext:
        sys?.caseManagers
          ? `Active ${formatNumber(sys.caseManagers.active)} | Inactive ${formatNumber(sys.caseManagers.inactive)}`
          : undefined,
      metricId: "system-case-managers",
      loading: sysLoading,
    },
    {
      id: "system-customers",
      label: "Customers",
      value: formatNumber(sys?.customers.total),
      subtext:
        sys?.customers
          ? `Active ${formatNumber(sys.customers.active)} | Inactive ${formatNumber(sys.customers.inactive)}`
          : undefined,
      metricId: "system-customers",
      loading: sysLoading,
    },
    {
      id: "system-enrollments",
      label: "Enrollments",
      value: formatNumber(sys?.enrollments.total),
      subtext:
        sys?.enrollments
          ? `Active ${formatNumber(sys.enrollments.active)} | Inactive ${formatNumber(sys.enrollments.inactive)}`
          : undefined,
      metricId: "system-enrollments",
      loading: sysLoading,
    },
    {
      id: "system-grants",
      label: "Grants & Programs",
      value: formatNumber(sys?.grants.total),
      subtext:
        sys?.grants
          ? `Active ${formatNumber(sys.grants.active)} | Inactive ${formatNumber(sys.grants.inactive)}`
          : undefined,
      metricId: "system-grants",
      loading: sysLoading,
    },
    {
      id: "system-open-tasks",
      label: `Open Tasks (${month})`,
      value: formatNumber(sysMonth?.tasks.open),
      subtext:
        sysMonth?.tasks
          ? `Done ${formatNumber(sysMonth.tasks.done)} | Total ${formatNumber(sysMonth.tasks.total)}`
          : undefined,
      metricId: "open-tasks",
      loading: monthLoading,
    },
    {
      id: "system-spending",
      label: `Spent (${month})`,
      value: formatCurrency(sysMonth?.spending.spent),
      subtext:
        sysMonth?.spending
          ? `Projected ${formatCurrency(sysMonth.spending.projected)}`
          : undefined,
      metricId: "system-spend",
      loading: monthLoading,
    },
  ];
}

export type SystemMetricCardsProps = BuiltMetricCardsProps & {
  month?: string;
};

export function SystemMetricCards({
  className,
  gridClassName = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
  month,
  transformItems,
}: SystemMetricCardsProps) {
  const activeMonth = month || currentMonthKey();
  const { data: sys, isLoading: sysLoading } = useSystemMetrics();
  const { data: sysMonth, isLoading: monthLoading } = useSystemMonthMetrics(activeMonth);
  const items = useTransformedMetricItems(
    buildSystemMetricItems(sys, sysMonth, sysLoading, monthLoading, activeMonth),
    transformItems,
  );
  return <MetricCards items={items} className={className} gridClassName={gridClassName} />;
}

export default SystemMetricCards;
