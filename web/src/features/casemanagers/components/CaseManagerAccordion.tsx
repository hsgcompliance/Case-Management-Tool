"use client";

import React from "react";
import { metricPillClass } from "@lib/colorRegistry";
import { fmtCurrencyUSD } from "@lib/formatters";
import type { CaseManagerUser, CustomerRow, EnrollmentRow } from "./model";
import { cmLabel } from "./model";
import CaseManagerPanel from "./CaseManagerPanel";
import type { CaseManagerReportStats } from "./caseManagerReportModel";

type Props = {
  user: CaseManagerUser;
  monthKey: string;
  customers: Array<Record<string, unknown>>;
  enrollmentsByCustomerId: Map<string, Array<Record<string, unknown>>>;
  stats: CaseManagerReportStats;
  taskCount?: number;
  openTasksByCustomerId: Map<string, number>;
  defaultOpen?: boolean;
};

export function CaseManagerAccordion({
  user,
  monthKey,
  customers,
  enrollmentsByCustomerId,
  stats,
  taskCount,
  openTasksByCustomerId,
  defaultOpen = false,
}: Props) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-medium text-slate-900">{cmLabel(user)}</span>
          <span className={["inline-flex items-center rounded-full border px-2 py-0.5 text-xs", metricPillClass("my-customers")].join(" ")}>
            {stats.activeCaseload} customers
          </span>
          <span className={["inline-flex items-center rounded-full border px-2 py-0.5 text-xs", metricPillClass("grant-unique-clients")].join(" ")}>
            {stats.newCustomersThisMonth} new · {stats.changedCustomersThisMonth} changed
          </span>
          <span className={["inline-flex items-center rounded-full border px-2 py-0.5 text-xs", metricPillClass("system-spend")].join(" ")}>
            {fmtCurrencyUSD(stats.totalAllocation)} allocated
          </span>
          <span className={["inline-flex items-center rounded-full border px-2 py-0.5 text-xs", metricPillClass("open-tasks")].join(" ")}>
            {taskCount || 0} open tasks
          </span>
        </div>
        <span className="text-sm text-slate-400">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen ? (
        <div className="border-t border-slate-100">
          <CaseManagerPanel
            user={user}
            customers={customers as CustomerRow[]}
            enrollmentsByCustomerId={enrollmentsByCustomerId as Map<string, EnrollmentRow[]>}
            monthKey={monthKey}
            stats={stats}
            taskCount={taskCount || 0}
            openTasksByCustomerId={openTasksByCustomerId}
            defaultOpen
          />
        </div>
      ) : null}
    </div>
  );
}

export default CaseManagerAccordion;
