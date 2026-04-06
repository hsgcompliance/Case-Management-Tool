"use client";

import React from "react";
import { useGrantMetrics } from "@hooks/useMetrics";
import {
  formatCurrency,
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
      value: data?.enrollments.active ?? 0,
      subtext:
        data?.enrollments
          ? `Total ${data.enrollments.total} | ${summarizePopulations(data.enrollments.byPopulation) ?? "Population mix pending"}`
          : "Population mix pending",
      metricId: "grant-active-enrollments",
      loading: isLoading,
    },
    {
      id: "grant-unique-clients",
      label: "Unique Clients",
      value: data?.customers.uniqueTotal ?? 0,
      subtext:
        data?.customers
          ? `Active ${data.customers.activeUniqueTotal} | Inactive ${data.customers.inactiveUniqueTotal}`
          : undefined,
      metricId: "grant-unique-clients",
      loading: isLoading,
    },
    {
      id: "grant-case-managers",
      label: "Case Managers",
      value: data?.caseManagers.total ?? 0,
      subtext: summarizeRefs(data?.caseManagers.refs) ?? "No case managers assigned",
      metricId: "system-case-managers",
      loading: isLoading,
    },
    {
      id: "grant-budget-spent",
      label: "Budget Spent",
      value: formatCurrency(data?.spending.spent),
      subtext:
        data?.spending
          ? `Projected ${formatCurrency(data.spending.projected)} | Line items ${data.spending.lineItemsActive ?? 0}`
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
