import React from "react";

export type DashboardToolId = string;

export interface NavCrumb<TSelection = unknown> {
  key: string;
  label: string;
  selection: TSelection | null;
}

export interface DashboardToolDefinition<TFilterState = unknown, TSelection = unknown> {
  id: DashboardToolId;
  title: string;
  icon?: React.ReactNode;
  hidden?: boolean;
  defaultPinned?: boolean;
  /** Hide the tool title from ToolTopbarRow — filters render centered without a title label. */
  hideTopbarTitle?: boolean;
  /**
   * If set, a "Subscribe" toggle button appears in the toolbar that calls
   * inboxDigestSubUpdate for the current user's own subscription to this digest type.
   */
  digestType?: "caseload" | "budget" | "enrollments" | "caseManagers";
  createFilterState?: () => TFilterState;
  shouldRenderSidebar?: (ctx: {
    filterState: TFilterState;
    selection: TSelection | null;
    navStack: NavCrumb<TSelection>[];
  }) => boolean;
  ToolTopbar?: React.FC<{
    value: TFilterState;
    onChange: (next: TFilterState) => void;
    selection: TSelection | null;
    nav: {
      stack: NavCrumb<TSelection>[];
      push: (c: NavCrumb<TSelection>) => void;
      pop: () => void;
      reset: () => void;
      setStack: (s: NavCrumb<TSelection>[]) => void;
    };
  }>;
  Sidebar?: React.FC<{
    filterState: TFilterState;
    onFilterChange: (next: TFilterState) => void;
    selection: TSelection | null;
    onSelect: (sel: TSelection | null) => void;
    nav: {
      stack: NavCrumb<TSelection>[];
      push: (c: NavCrumb<TSelection>) => void;
      pop: () => void;
      reset: () => void;
      setStack: (s: NavCrumb<TSelection>[]) => void;
    };
  }>;
  Main: React.FC<{
    filterState: TFilterState;
    onFilterChange?: (next: TFilterState) => void;
    selection: TSelection | null;
    onSelect: (sel: TSelection | null) => void;
    nav: {
      stack: NavCrumb<TSelection>[];
      push: (c: NavCrumb<TSelection>) => void;
      pop: () => void;
      reset: () => void;
      setStack: (s: NavCrumb<TSelection>[]) => void;
    };
  }>;
}

export type AnyDashboardToolDefinition = DashboardToolDefinition<unknown, unknown>;
