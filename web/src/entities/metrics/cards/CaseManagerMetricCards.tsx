"use client";

import React from "react";
import { useCaseManagerMetrics } from "@hooks/useMetrics";
import {
  formatNumber,
  MetricCards,
  type BuiltMetricCardsProps,
  type MetricCardItem,
  summarizeRefs,
  useTransformedMetricItems,
} from "./shared";

export function buildCaseManagerMetricItems(
  data: ReturnType<typeof useCaseManagerMetrics>["data"],
  isLoading: boolean,
): MetricCardItem[] {
  return [
    {
      id: "case-manager-customers",
      label: "Customers",
      value: formatNumber(data?.customers?.total),
      subtext:
        data?.customers
          ? `Active ${formatNumber(data.customers?.active)} | Inactive ${formatNumber(data.customers?.inactive)}`
          : undefined,
      metricId: "system-customers",
      tooltip: summarizeRefs(data?.customers?.refs),
      loading: isLoading,
    },
    {
      id: "case-manager-enrollments",
      label: "Enrollments",
      value: formatNumber(data?.enrollments?.total),
      subtext:
        data?.enrollments
          ? `Active ${formatNumber(data.enrollments?.active)} | Inactive ${formatNumber(data.enrollments?.inactive)}`
          : undefined,
      metricId: "system-enrollments",
      loading: isLoading,
    },
  ];
}

export type CaseManagerMetricCardsProps = BuiltMetricCardsProps & {
  uid: string;
};

export function CaseManagerMetricCards({
  uid,
  className,
  gridClassName,
  transformItems,
}: CaseManagerMetricCardsProps) {
  const { data, isLoading } = useCaseManagerMetrics(uid);
  const items = useTransformedMetricItems(buildCaseManagerMetricItems(data, isLoading), transformItems);
  return <MetricCards items={items} className={className} gridClassName={gridClassName} />;
}

export default CaseManagerMetricCards;
