"use client";

import React from "react";
import JotformDigestPanel from "@features/tools/JotformDigestPanel";
import {
  JotformDashboardMain,
  JotformDashboardSidebar,
  JotformDashboardTopbar,
  type JotformDashboardFilterState,
  type JotformDashboardSelection,
} from "@widgets/jotform/JotformDashboardTool";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";

export type JotformsFilterState = JotformDashboardFilterState & {
  jotformsView: "dashboard" | "digest";
};

export type JotformsSelection = JotformDashboardSelection;

export const JotformsTopbar: DashboardToolDefinition<JotformsFilterState, JotformsSelection>["ToolTopbar"] = (props) => {
  const { value, onChange } = props;
  const setView = (v: JotformsFilterState["jotformsView"]) =>
    onChange({ ...value, jotformsView: v });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 p-0.5">
        {(["dashboard", "digest"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={`px-3 py-1.5 text-xs rounded transition capitalize ${
              value.jotformsView === v
                ? "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
            onClick={() => setView(v)}
          >
            {v === "dashboard" ? "Submissions" : "Digest Config"}
          </button>
        ))}
      </div>

      {value.jotformsView === "dashboard" && (
        <JotformDashboardTopbar {...props} value={value} onChange={onChange} />
      )}
    </div>
  );
};

export const JotformsSidebar: DashboardToolDefinition<JotformsFilterState, JotformsSelection>["Sidebar"] = (props) => {
  if (props.filterState.jotformsView !== "dashboard") return null;
  return <JotformDashboardSidebar {...props} filterState={props.filterState} onFilterChange={props.onFilterChange} />;
};

export function JotformsMain(props: Parameters<NonNullable<DashboardToolDefinition<JotformsFilterState, JotformsSelection>["Main"]>>[0]) {
  const { filterState } = props;
  if (filterState.jotformsView === "digest") {
    const sel = props.selection as JotformDashboardSelection;
    const formId = sel?.formId || "";
    return (
      <div className="flex-1 overflow-auto p-4">
        <JotformDigestPanel initialFormId={formId} />
      </div>
    );
  }
  return <JotformDashboardMain {...props} filterState={filterState} />;
}
