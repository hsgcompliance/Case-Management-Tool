"use client";

import React from "react";
import { useGrantMetrics } from "@hooks/useMetrics";
import {
  formatCurrency,
  formatNumber,
  MetricCards,
  type BuiltMetricCardsProps,
  type MetricCardItem,
  summarizeRefs,
  useTransformedMetricItems,
} from "./shared";

function summarizePopulations(pop?: Record<string, number>): string | undefined {
  if (!pop) return undefined;
  const parts = [
    pop.youth ? `Youth ${pop.youth}` : null,
    pop.family ? `Family ${pop.family}` : null,
    pop.individual ? `Individual ${pop.individual}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : undefined;
}

export function buildGrantMetricItems(
  data: ReturnType<typeof useGrantMetrics>["data"],
  isLoading: boolean,
): MetricCardItem[] {
  return [
    {
      id: "grant-active-enrollments",
      label: "Active Enrollments",
      value: formatNumber(data?.enrollments?.active),
      subtext:
        data?.enrollments
          ? `Total ${formatNumber(data.enrollments?.total)} | ${summarizePopulations(data.enrollments?.byPopulation) ?? "Population mix pending"}`
          : "Population mix pending",
      metricId: "grant-active-enrollments",
      loading: isLoading,
    },
    {
      id: "grant-unique-clients",
      label: "Unique Clients",
      value: formatNumber(data?.customers?.uniqueTotal),
      subtext:
        data?.customers
          ? `Active ${formatNumber(data.customers?.activeUniqueTotal)} | Inactive ${formatNumber(data.customers?.inactiveUniqueTotal)}`
          : undefined,
      metricId: "grant-unique-clients",
      loading: isLoading,
    },
    {
      id: "grant-case-managers",
      label: "Case Managers",
      value: formatNumber(data?.caseManagers?.total),
      subtext: summarizeRefs(data?.caseManagers?.refs) ?? "No case managers assigned",
      metricId: "system-case-managers",
      loading: isLoading,
    },
    {
      id: "grant-budget-spent",
      label: "Budget Spent",
      value: formatCurrency(data?.spending?.spent),
      subtext:
        data?.spending
          ? `Projected ${formatCurrency(data.spending?.projected)} | Line items ${formatNumber(data.spending?.lineItemsActive)}`
          : undefined,
      metricId: "system-spend",
      loading: isLoading,
    },
  ];
}

export type GrantMetricCardsProps = BuiltMetricCardsProps & {
  grantId: string;
};

export function GrantMetricCards({ grantId, className, gridClassName, transformItems }: GrantMetricCardsProps) {
  const { data, isLoading } = useGrantMetrics(grantId);
  const items = useTransformedMetricItems(buildGrantMetricItems(data, isLoading), transformItems);
  return <MetricCards items={items} className={className} gridClassName={gridClassName} />;
}

export default GrantMetricCards;
