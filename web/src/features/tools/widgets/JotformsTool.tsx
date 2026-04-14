"use client";

import React from "react";
import {
  JotformDashboardMain,
  JotformDashboardSidebar,
  JotformDashboardTopbar,
  type JotformDashboardFilterState,
  type JotformDashboardSelection,
} from "@widgets/jotform/JotformDashboardTool";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";

// Digest Config tab has been shelved — Edit Digest lives in the Actions menu.
export type JotformsFilterState = JotformDashboardFilterState & {
  jotformsView: "dashboard";
};

export type JotformsSelection = JotformDashboardSelection;

export const JotformsTopbar: DashboardToolDefinition<JotformsFilterState, JotformsSelection>["ToolTopbar"] = (props) => {
  return <JotformDashboardTopbar {...props} value={props.value} onChange={props.onChange} />;
};

export const JotformsSidebar: DashboardToolDefinition<JotformsFilterState, JotformsSelection>["Sidebar"] = (props) => {
  return <JotformDashboardSidebar {...props} filterState={props.filterState} onFilterChange={props.onFilterChange} />;
};

export function JotformsMain(
  props: Parameters<NonNullable<DashboardToolDefinition<JotformsFilterState, JotformsSelection>["Main"]>>[0],
) {
  return <JotformDashboardMain {...props} filterState={props.filterState} />;
}
