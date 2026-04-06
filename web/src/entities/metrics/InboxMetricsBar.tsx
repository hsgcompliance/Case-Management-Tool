import React from "react";
import { type ColorTone } from "@lib/colorRegistry";
import { MetricStrip } from "./strip/MetricStrip";

export type InboxMetricsView = {
  assignedCount: number;
  completedCount: number;
  completionPct: number;
  overdueCount: number;
};

type Props = {
  metrics: InboxMetricsView | undefined;
  loading: boolean;
};

export function InboxMetricsBar({ metrics, loading }: Props) {
  const pct = metrics ? Math.min(100, Math.max(0, Math.round(metrics.completionPct))) : 0;
  const assignedCount = metrics?.assignedCount ?? 0;
  const completedCount = metrics?.completedCount ?? 0;
  const completionTone: ColorTone = pct >= 80 ? "emerald" : pct >= 40 ? "sky" : "amber";

  return (
    <MetricStrip
      items={[
        {
          id: "assigned",
          label: "Assigned Tasks",
          value: assignedCount,
          subtext: "Tasks in scope",
          metricId: "inbox-assigned",
          loading,
        },
        {
          id: "completed",
          label: "Completed Tasks",
          value: completedCount,
          subtext: "Closed tasks",
          metricId: "inbox-completed",
          loading,
        },
        {
          id: "completion",
          label: "Task Completion",
          value: `${pct}%`,
          subtext: `${completedCount} of ${assignedCount} complete`,
          tone: completionTone,
          loading,
        },
        {
          id: "overdue",
          label: "Overdue Tasks",
          value: metrics?.overdueCount ?? 0,
          subtext: "Needs attention",
          metricId: "inbox-overdue",
          loading,
        },
      ]}
      gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    />
  );
}
