"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useCaseManagerMetrics, useSystemMetrics, useSystemMonthMetrics, currentMonthKey } from "@hooks/useMetrics";
import { useMe } from "@hooks/useUsers";
import { useGrant } from "@hooks/useGrants";
import { useCreditCardsSummary } from "@hooks/useCreditCards";
import { myDefaultMetrics, systemDefaultMetrics, populationDefaultMetrics } from "@entities/metrics/cards/presets";
import { hasRole, isAdminLike, isCaseManagerLike, normalizeRole } from "@lib/roles";
import { MetricStrip, type MetricStripItem, type MetricStripProps, type MetricStripResetOption } from "./MetricStrip";
import { usePinnedGrantIds } from "@features/grants/PinnedGrantCards";
import { usePinnedItems } from "@entities/pinned/PinnedItemsSection";

export type MetricBarItem = MetricStripItem;
export type MetricBarResetOption = MetricStripResetOption;
export type PageMetricsBarProps = MetricStripProps;

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US");
}

function formatAcuity(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "--";
  return Number(n).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function PageMetricsBar(props: PageMetricsBarProps) {
  return <MetricStrip configurable hideable {...props} />;
}

export function SharedPageMetricsBar() {
  const pathname = usePathname() ?? "";
  const isCustomerPage = pathname.startsWith("/customers");

  const { data: me } = useMe();
  const meUser = me as { uid?: string; topRole?: unknown; role?: unknown; roles?: unknown } | null;
  const myUid = String(meUser?.uid || "");
  const isCaseManager = isCaseManagerLike(meUser);
  const topRole = normalizeRole(meUser?.topRole || meUser?.role);
  const isAdminOrCompliance =
    isAdminLike(meUser) ||
    topRole === "admin" ||
    topRole === "compliance" ||
    hasRole(meUser?.roles, "admin") ||
    hasRole(meUser?.roles, "compliance");
  const canToggleScopes = isCaseManager && isAdminOrCompliance;
  const month = currentMonthKey();

  const { data: caseManagerMetrics, isLoading: caseManagerLoading } = useCaseManagerMetrics(myUid, {
    enabled: !!myUid,
  });
  const { data: systemMetrics, isLoading: systemLoading } = useSystemMetrics();
  const { data: systemMonthMetrics, isLoading: systemMonthLoading } = useSystemMonthMetrics(month);

  // Pinned grant
  const { data: pinnedGrantIds = [] } = usePinnedGrantIds();
  const pinnedGrantId = (pinnedGrantIds as string[])[0] as string | undefined;
  const { data: pinnedGrant, isLoading: pinnedGrantLoading } = useGrant(pinnedGrantId, { enabled: !!pinnedGrantId });

  // Pinned credit card
  const { data: pinnedItems = [] } = usePinnedItems();
  const pinnedCardId = (pinnedItems as { type: string; id: string }[]).find((x) => x.type === "creditCard")?.id;
  const { data: cardSummary, isLoading: cardSummaryLoading } = useCreditCardsSummary(
    { id: pinnedCardId },
    { enabled: !!pinnedCardId },
  );

  // Compute pinned grant budget
  const pinnedGrantBudget = React.useMemo(() => {
    if (!pinnedGrant) return null;
    const b = (pinnedGrant as any)?.budget || {};
    const t = (b?.totals || {}) as Record<string, unknown>;
    const total = Number(b?.total ?? b?.startAmount ?? 0);
    const spent = Number(t?.spent ?? b?.spent ?? 0);
    const projected = Number(t?.projected ?? b?.projected ?? 0);
    return {
      name: String((pinnedGrant as any).name || pinnedGrantId || ""),
      available: total - spent - projected,
      projectedSpend: Number(t?.projectedSpend ?? spent + projected),
    };
  }, [pinnedGrant, pinnedGrantId]);

  const pinnedCardItem = cardSummary?.items?.[0] ?? null;

  const items = React.useMemo<MetricBarItem[]>(() => {
    // CM tooltip helper for population chips
    const popTooltip = (pop: { caseManagers?: { name?: string | null }[] } | null | undefined) => {
      if (!pop?.caseManagers?.length) return undefined;
      return pop.caseManagers.map((cm) => cm.name || "").filter(Boolean).join("\n");
    };

    const myItems: MetricBarItem[] = [
      {
        id: "my-customers",
        metricId: "my-customers",
        label: "My Customers",
        value: formatNumber(caseManagerMetrics?.customers.active),
        subtext: caseManagerMetrics?.customers
          ? `Total ${formatNumber(caseManagerMetrics.customers.total)} | Inactive ${formatNumber(caseManagerMetrics.customers.inactive)}`
          : undefined,
        loading: !!myUid && caseManagerLoading,
        disabled: !myUid || !isCaseManager,
      },
      {
        id: "my-enrollments",
        metricId: "my-enrollments",
        label: "My Enrollments",
        value: formatNumber(caseManagerMetrics?.enrollments.active),
        subtext: caseManagerMetrics?.enrollments
          ? `Total ${formatNumber(caseManagerMetrics.enrollments.total)} | Inactive ${formatNumber(caseManagerMetrics.enrollments.inactive)}`
          : undefined,
        loading: !!myUid && caseManagerLoading,
        disabled: !myUid || !isCaseManager,
      },
      {
        id: "my-acuity",
        metricId: "my-acuity",
        label: "My Acuity",
        value: formatAcuity(caseManagerMetrics?.acuity.scoreAvg),
        subtext:
          caseManagerMetrics?.acuity.scoreSum != null && caseManagerMetrics?.acuity.scoreCount != null
            ? `Sum ${formatNumber(caseManagerMetrics.acuity.scoreSum)} | Count ${formatNumber(caseManagerMetrics.acuity.scoreCount)}`
            : undefined,
        loading: !!myUid && caseManagerLoading,
        disabled: !myUid || !isCaseManager,
      },
      {
        id: "my-open-tasks",
        metricId: "my-open-tasks",
        label: "My Open Tasks",
        value: formatNumber(caseManagerMetrics?.tasks?.openThisMonth),
        subtext:
          caseManagerMetrics?.tasks?.openNextMonth != null
            ? `${month} | Next ${formatNumber(caseManagerMetrics.tasks?.openNextMonth)}`
            : month,
        loading: !!myUid && caseManagerLoading,
        disabled: !myUid || !isCaseManager,
      },
    ];

    const systemItems: MetricBarItem[] = [
      {
        id: "system-case-managers",
        metricId: "system-case-managers",
        label: "Total Case Managers",
        value: formatNumber(systemMetrics?.caseManagers.total),
        subtext: systemMetrics?.caseManagers
          ? `Active ${formatNumber(systemMetrics.caseManagers.active)} | Inactive ${formatNumber(systemMetrics.caseManagers.inactive)}`
          : undefined,
        loading: systemLoading,
      },
      {
        id: "system-customers",
        metricId: "system-customers",
        label: "Total Customers",
        value: formatNumber(systemMetrics?.customers.total),
        subtext: systemMetrics?.customers
          ? `Active ${formatNumber(systemMetrics.customers.active)} | Inactive ${formatNumber(systemMetrics.customers.inactive)}`
          : undefined,
        loading: systemLoading,
      },
      {
        id: "system-enrollments",
        metricId: "system-enrollments",
        label: "Total Enrollments",
        value: formatNumber(systemMetrics?.enrollments.total),
        subtext: systemMetrics?.enrollments
          ? `Active ${formatNumber(systemMetrics.enrollments.active)} | Inactive ${formatNumber(systemMetrics.enrollments.inactive)}`
          : undefined,
        loading: systemLoading,
      },
      {
        id: "system-grants",
        metricId: "system-grants",
        label: "Grants & Programs",
        value: formatNumber(systemMetrics?.grants.total),
        subtext: systemMetrics?.grants
          ? `Active ${formatNumber(systemMetrics.grants.active)} | Inactive ${formatNumber(systemMetrics.grants.inactive)}`
          : undefined,
        loading: systemLoading,
      },
      {
        id: "system-spend",
        metricId: "system-spend",
        label: "Total Spend",
        value: fmtUsd(systemMonthMetrics?.spending.spent),
        subtext: systemMonthMetrics?.spending
          ? `Proj. ${fmtUsd(systemMonthMetrics.spending.projected)} · ${month}`
          : month,
        loading: systemMonthLoading,
      },
    ];

    // Population items — customer count + CM count; tooltip = CM names
    const populationItems: MetricBarItem[] = [
      {
        id: "pop-youth",
        metricId: "pop-youth",
        label: "Youth",
        value: formatNumber(systemMetrics?.populations.youth.activeCustomerTotal),
        subtext: systemMetrics?.populations.youth
          ? `${formatNumber(systemMetrics.populations.youth.caseManagerTotal)} CMs`
          : undefined,
        tooltip: popTooltip(systemMetrics?.populations.youth),
        loading: systemLoading,
      },
      {
        id: "pop-family",
        metricId: "pop-family",
        label: "Family",
        value: formatNumber(systemMetrics?.populations.family.activeCustomerTotal),
        subtext: systemMetrics?.populations.family
          ? `${formatNumber(systemMetrics.populations.family.caseManagerTotal)} CMs`
          : undefined,
        tooltip: popTooltip(systemMetrics?.populations.family),
        loading: systemLoading,
      },
      {
        id: "pop-individual",
        metricId: "pop-individual",
        label: "Individual",
        value: formatNumber(systemMetrics?.populations.individual.activeCustomerTotal),
        subtext: systemMetrics?.populations.individual
          ? `${formatNumber(systemMetrics.populations.individual.caseManagerTotal)} CMs`
          : undefined,
        tooltip: popTooltip(systemMetrics?.populations.individual),
        loading: systemLoading,
      },
    ];

    // Pinned grant chips
    const pinnedGrantLabel = pinnedGrantBudget?.name ?? "";
    const pinnedGrantItems: MetricBarItem[] = [
      {
        id: "pinned-grant-available",
        metricId: "pinned-grant-available",
        label: pinnedGrantLabel ? `Available · ${pinnedGrantLabel}` : "Grant Available",
        value: pinnedGrantBudget ? fmtUsd(pinnedGrantBudget.available) : "--",
        loading: !!pinnedGrantId && pinnedGrantLoading,
        disabled: !pinnedGrantId,
      },
      {
        id: "pinned-grant-projected-spend",
        metricId: "pinned-grant-projected-spend",
        label: pinnedGrantLabel ? `Proj. Spend · ${pinnedGrantLabel}` : "Grant Projected Spend",
        value: pinnedGrantBudget ? fmtUsd(pinnedGrantBudget.projectedSpend) : "--",
        loading: !!pinnedGrantId && pinnedGrantLoading,
        disabled: !pinnedGrantId,
      },
    ];

    // Pinned credit card chip
    const pinnedCardItems: MetricBarItem[] = [
      {
        id: "pinned-card-remaining",
        metricId: "pinned-card-remaining",
        label: pinnedCardItem?.name ? `Remaining · ${pinnedCardItem.name}` : "Card Remaining",
        value: pinnedCardItem ? fmtUsd(pinnedCardItem.remainingCents / 100) : "--",
        subtext: pinnedCardItem ? `${fmtUsd(pinnedCardItem.spentCents / 100)} spent` : undefined,
        loading: !!pinnedCardId && cardSummaryLoading,
        disabled: !pinnedCardId,
      },
    ];

    return [...myItems, ...systemItems, ...populationItems, ...pinnedGrantItems, ...pinnedCardItems];
  }, [
    caseManagerLoading,
    caseManagerMetrics,
    isCaseManager,
    month,
    myUid,
    systemLoading,
    systemMetrics,
    systemMonthLoading,
    systemMonthMetrics,
    pinnedGrantId,
    pinnedGrantLoading,
    pinnedGrantBudget,
    pinnedCardId,
    cardSummaryLoading,
    pinnedCardItem,
  ]);

  // Route-aware defaults
  const defaultLargeIds = React.useMemo(() => {
    if (isCustomerPage) {
      return [...populationDefaultMetrics, "system-customers", "system-case-managers"];
    }
    return canToggleScopes || isCaseManager ? myDefaultMetrics : systemDefaultMetrics;
  }, [isCustomerPage, canToggleScopes, isCaseManager]);

  const defaultSmallIds = React.useMemo(() => {
    if (isCustomerPage) {
      return myDefaultMetrics;
    }
    return [];
  }, [isCustomerPage]);

  const storageKey = isCustomerPage ? "hdb_metrics_bar_customers" : "hdb_metrics_bar_shared";

  const resetOptions = React.useMemo<MetricBarResetOption[]>(
    () => [
      {
        label: "My Metrics (large) + System (small)",
        largeIds: myDefaultMetrics,
        smallIds: systemDefaultMetrics,
        disabled: !myUid || !isCaseManager,
      },
      {
        label: "Population (large) + My Caseload (small)",
        largeIds: [...populationDefaultMetrics, "system-customers", "system-case-managers"],
        smallIds: myDefaultMetrics,
      },
      {
        label: "System Metrics (large)",
        largeIds: systemDefaultMetrics,
        smallIds: [],
      },
    ],
    [isCaseManager, myUid],
  );

  return (
    <div className="border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
      <PageMetricsBar
        items={items}
        defaultLargeIds={defaultLargeIds}
        defaultSmallIds={defaultSmallIds}
        resetOptions={resetOptions}
        storageKey={storageKey}
      />
    </div>
  );
}

export default PageMetricsBar;
