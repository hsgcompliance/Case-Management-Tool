// web/src/features/customers/components/CustomersMetricsBar.tsx
"use client";

import React from "react";
import {
  useCaseManagerMetrics,
  useSystemMetrics,
  useSystemMonthMetrics,
  currentMonthKey,
} from "@hooks/useMetrics";
import { type MetricColorId } from "@lib/colorRegistry";
import { PageMetricsBar } from "@entities/metrics/strip/PageMetricsBar";
import { extendedSystemDefaultMetrics, myDefaultMetrics } from "@entities/metrics/cards/presets";

type CustomersMetricsBarProps = {
  myUid: string;
};

type MetricItem = {
  id: MetricColorId;
  label: string;
  value: string;
  subtext?: string;
  loading?: boolean;
  disabled?: boolean;
};

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US");
}

function formatAcuity(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CustomersMetricsBar({ myUid }: CustomersMetricsBarProps) {
  const month = currentMonthKey();
  const { data: myMetrics, isLoading: myMetricsLoading } = useCaseManagerMetrics(myUid, {
    enabled: !!myUid,
  });
  const { data: systemMetrics, isLoading: systemMetricsLoading } = useSystemMetrics();
  const { data: systemMonth, isLoading: systemMonthLoading } = useSystemMonthMetrics(month);

  const metricItems = React.useMemo<MetricItem[]>(
    () => [
      {
        id: "my-customers",
        label: "My Customers",
        value: formatNumber(myMetrics?.customers.total),
        subtext: myMetrics?.customers
          ? `Active ${formatNumber(myMetrics.customers.active)} | Total ${formatNumber(myMetrics.customers.total)}`
          : undefined,
        loading: !!myUid && myMetricsLoading,
        disabled: !myUid,
      },
      {
        id: "my-enrollments",
        label: "My Enrollments",
        value: formatNumber(myMetrics?.enrollments.total),
        subtext: myMetrics?.enrollments
          ? `Active ${formatNumber(myMetrics.enrollments.active)} | Total ${formatNumber(myMetrics.enrollments.total)}`
          : undefined,
        loading: !!myUid && myMetricsLoading,
        disabled: !myUid,
      },
      {
        id: "my-acuity",
        label: "My Acuity",
        value: formatAcuity(myMetrics?.acuity.scoreAvg),
        subtext:
          myMetrics?.acuity.scoreSum != null && myMetrics?.acuity.scoreCount != null
            ? `Sum ${formatNumber(myMetrics.acuity.scoreSum)} | Count ${formatNumber(myMetrics.acuity.scoreCount)}`
            : undefined,
        loading: !!myUid && myMetricsLoading,
        disabled: !myUid,
      },
      {
        id: "my-open-tasks",
        label: "My Open Tasks",
        value: formatNumber(myMetrics?.tasks?.openThisMonth),
        subtext:
          myMetrics?.tasks?.openNextMonth != null
            ? `This month | Next ${formatNumber(myMetrics.tasks?.openNextMonth)}`
            : "This month",
        loading: !!myUid && myMetricsLoading,
        disabled: !myUid,
      },
      {
        id: "system-case-managers",
        label: "Total Case Managers",
        value: formatNumber(systemMetrics?.caseManagers.total),
        subtext: systemMetrics?.caseManagers
          ? `Active ${formatNumber(systemMetrics.caseManagers.active)} | Inactive ${formatNumber(systemMetrics.caseManagers.inactive)}`
          : undefined,
        loading: systemMetricsLoading,
      },
      {
        id: "system-customers",
        label: "Total Customers",
        value: formatNumber(systemMetrics?.customers.total),
        subtext: systemMetrics?.customers
          ? `Active ${formatNumber(systemMetrics.customers.active)} | Inactive ${formatNumber(systemMetrics.customers.inactive)}`
          : undefined,
        loading: systemMetricsLoading,
      },
      {
        id: "system-enrollments",
        label: "Total Enrollments",
        value: formatNumber(systemMetrics?.enrollments.total),
        subtext: systemMetrics?.enrollments
          ? `Active ${formatNumber(systemMetrics.enrollments.active)} | Inactive ${formatNumber(systemMetrics.enrollments.inactive)}`
          : undefined,
        loading: systemMetricsLoading,
      },
      {
        id: "system-grants",
        label: "Grants & Programs",
        value: formatNumber(systemMetrics?.grants.total),
        subtext: systemMetrics?.grants
          ? `Active ${formatNumber(systemMetrics.grants.active)} | Inactive ${formatNumber(systemMetrics.grants.inactive)}`
          : undefined,
        loading: systemMetricsLoading,
      },
      {
        id: "system-spend",
        label: "Total Spend Amount",
        value: formatCurrency(systemMonth?.spending.spent),
        subtext: systemMonth?.spending
          ? `Projected ${formatCurrency(systemMonth.spending.projected)} | ${month}`
          : month,
        loading: systemMonthLoading,
      },
    ],
    [myMetrics, myMetricsLoading, myUid, systemMetrics, systemMetricsLoading, systemMonth, systemMonthLoading, month],
  );

  const availableMetrics = React.useMemo(
    () => metricItems.filter((item) => !(item.disabled && !myUid)),
    [metricItems, myUid],
  );

  const resetOptions = React.useMemo(
    () => [
      { label: "Reset to My Case Metrics", ids: myDefaultMetrics, disabled: !myUid },
      { label: "Reset to System Metrics", ids: extendedSystemDefaultMetrics },
    ],
    [myUid],
  );

  return (
    <PageMetricsBar
      items={availableMetrics}
      defaultVisibleIds={myUid ? myDefaultMetrics : extendedSystemDefaultMetrics}
      resetOptions={resetOptions}
      storageKey="hdb_metrics_strip_v1_customers"
      gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
    />
  );
}

export default CustomersMetricsBar;
