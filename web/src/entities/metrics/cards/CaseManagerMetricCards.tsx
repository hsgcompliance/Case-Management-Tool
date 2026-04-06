"use client";

import React from "react";
import { useCaseManagerMetrics } from "@hooks/useMetrics";
import {
  formatIntegerOrDecimal,
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
      value: data?.customers.total ?? 0,
      subtext:
        data?.customers
          ? `Active ${formatNumber(data.customers.active)} | Inactive ${formatNumber(data.customers.inactive)}`
          : undefined,
      metricId: "system-customers",
      tooltip: summarizeRefs(data?.customers.refs),
      loading: isLoading,
    },
    {
      id: "case-manager-enrollments",
      label: "Enrollments",
      value: data?.enrollments.total ?? 0,
      subtext:
        data?.enrollments
          ? `Active ${formatNumber(data.enrollments.active)} | Inactive ${formatNumber(data.enrollments.inactive)}`
          : undefined,
      metricId: "system-enrollments",
      loading: isLoading,
    },
    {
      id: "case-manager-acuity",
      label: "Acuity Avg",
      value: formatIntegerOrDecimal(data?.acuity.scoreAvg),
      subtext:
        data?.acuity
          ? `Sum ${formatNumber(data.acuity.scoreSum)} | Clients ${formatNumber(data.acuity.scoreCount)}`
          : undefined,
      metricId: "my-acuity",
      loading: isLoading,
    },
    {
      id: "case-manager-open-tasks",
      label: "Open Tasks",
      value: formatNumber(data?.tasks.openThisMonth),
      subtext:
        data?.tasks
          ? `Next month ${formatNumber(data.tasks.openNextMonth)} | Assessments ${formatNumber(data.tasks.byType.assessment.thisMonth)}`
          : undefined,
      metricId: "my-open-tasks",
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
