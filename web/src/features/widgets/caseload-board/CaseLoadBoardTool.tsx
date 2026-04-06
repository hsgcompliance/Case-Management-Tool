"use client";

// features/caseload-board/CaseLoadBoardTool.tsx
// DashboardToolDefinition entry points for the CaseLoad Board.
// Exports: filterState factory, Topbar, and Main — ready to register in tools/index.tsx.

import React from "react";
import { useMyInboxMetrics } from "@hooks/useInbox";
import { InboxMetricsBar } from "@entities/metrics/InboxMetricsBar";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { monthKeyOffsetDays } from "@widgets/utils";
import type { CaseLoadBoardFilterState } from "./types";
import { useBoardData } from "./useBoardState";
import { CaseLoadBoardView } from "./CaseLoadBoardView";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export type { CaseLoadBoardFilterState };

export function createCaseLoadBoardFilterState(): CaseLoadBoardFilterState {
  return {
    month: monthKeyOffsetDays(0), // default: current month
    activeTaskTypeId: null,
  };
}

// ---------------------------------------------------------------------------
// Topbar
// Includes InboxMetricsBar + month filter. Game mini-player lives in
  // DashboardLayout (SharedPageMetricsBar) and is automatically present.
// ---------------------------------------------------------------------------

export const CaseLoadBoardTopbar: DashboardToolDefinition<CaseLoadBoardFilterState>["ToolTopbar"] =
  ({ value, onChange }) => {
    const month = /^\d{4}-\d{2}$/.test(String(value?.month ?? ""))
      ? value.month
      : monthKeyOffsetDays(0);

    const { data: inboxMetricsData, isLoading: metricsLoading } = useMyInboxMetrics(month);
    const endpointTotal = (inboxMetricsData as any)?.data?.total;

    const metrics = endpointTotal
      ? {
          assignedCount: Number(endpointTotal.assignedCount ?? 0),
          completedCount: Number(endpointTotal.completedCount ?? 0),
          completionPct: Number(endpointTotal.completionPct ?? 0),
          overdueCount: Number(endpointTotal.overdueCount ?? 0),
        }
      : undefined;

    const handleMonthChange = (newMonth: string) => {
      onChange({ ...value, month: newMonth, activeTaskTypeId: null });
    };

    return (
      <div className="w-full rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <label className="text-xs text-slate-500">Month</label>
            <input
              type="month"
              className="input input-sm"
              value={month}
              onChange={(e) => handleMonthChange(e.currentTarget.value || month)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleMonthChange(monthKeyOffsetDays(0))}
            >
              This Month
            </button>
          </div>
        </div>

        {/* Metrics bar — same source as Inbox topbar, shared cache */}
        <InboxMetricsBar metrics={metrics} loading={metricsLoading && !metrics} />
      </div>
    );
  };

// ---------------------------------------------------------------------------
// Main
// Full-height board view. All data from useMyInbox (shared with Inbox tool).
// Non-active task type boards are NOT rendered (freeze pattern).
// ---------------------------------------------------------------------------

export const CaseLoadBoardMain: DashboardToolDefinition<CaseLoadBoardFilterState>["Main"] = ({
  filterState,
  onFilterChange,
}) => {
  const filters = filterState ?? createCaseLoadBoardFilterState();
  const { boardState, isLoading, moveBucket } = useBoardData(filters);

  const handleFilterChange = React.useCallback(
    (next: CaseLoadBoardFilterState) => {
      onFilterChange?.(next);
    },
    [onFilterChange]
  );

  return (
    // Use full height of the tool main panel; board columns scroll internally
    <div className="flex flex-col h-full min-h-0 p-3">
      <CaseLoadBoardView
        boardState={boardState}
        filterState={filters}
        onFilterChange={handleFilterChange}
        isLoading={isLoading}
        onMoveBucket={moveBucket}
      />
    </div>
  );
};
