import type { ReactNode } from "react";
import type { PageLayoutPreference } from "@lib/userSettings";
import type { AnyDashboardToolDefinition, DashboardToolId, NavCrumb } from "../types";

export type PageLayoutState = {
  activeToolId: DashboardToolId;
  pinnedToolIds: DashboardToolId[];
  recency: DashboardToolId[];
  perToolFilterState: Record<DashboardToolId, unknown>;
  perToolSelection: Record<DashboardToolId, unknown | null>;
  perToolNavStack: Record<DashboardToolId, NavCrumb<unknown>[]>;
  settingsLoaded: boolean;
};

export type PageLayoutAction =
  | { type: "HYDRATE_SETTINGS"; payload: PageLayoutPreference }
  | { type: "SET_ACTIVE_TOOL"; toolId: DashboardToolId }
  | { type: "TOGGLE_PIN"; toolId: DashboardToolId }
  | { type: "SET_FILTER"; toolId: DashboardToolId; filterState: unknown }
  | { type: "SET_SELECTION"; toolId: DashboardToolId; selection: unknown | null }
  | { type: "NAV_PUSH"; toolId: DashboardToolId; crumb: NavCrumb<unknown> }
  | { type: "NAV_POP"; toolId: DashboardToolId }
  | { type: "NAV_RESET"; toolId: DashboardToolId }
  | { type: "NAV_SET_STACK"; toolId: DashboardToolId; stack: NavCrumb<unknown>[] };

export type PageLayoutContextValue = {
  state: PageLayoutState;
  setActiveTool: (toolId: DashboardToolId) => void;
  togglePin: (toolId: DashboardToolId) => void;
  setFilter: (toolId: DashboardToolId, filterState: unknown) => void;
  setSelection: (toolId: DashboardToolId, selection: unknown | null) => void;
  navPush: (toolId: DashboardToolId, crumb: NavCrumb<unknown>) => void;
  navPop: (toolId: DashboardToolId) => void;
  navReset: (toolId: DashboardToolId) => void;
  navSetStack: (toolId: DashboardToolId, stack: NavCrumb<unknown>[]) => void;
};

export type PageLayoutProviderProps = {
  children: ReactNode;
  tools: readonly AnyDashboardToolDefinition[];
  selectedToolId?: string;
  prefsKey?: string;
};
