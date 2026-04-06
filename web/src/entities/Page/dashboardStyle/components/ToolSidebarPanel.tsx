"use client";

import React from "react";
import { AnyDashboardToolDefinition, NavCrumb } from "../types";

export interface ToolSidebarPanelProps {
  tool: AnyDashboardToolDefinition;
  filterState: unknown;
  setFilterState: (next: unknown) => void;
  selection: unknown | null;
  onSelect: (sel: unknown | null) => void;
  navStack: NavCrumb<unknown>[];
  nav: {
    push: (c: NavCrumb<unknown>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<unknown>[]) => void;
  };
}

export function ToolSidebarPanel({ tool, filterState, setFilterState, selection, onSelect, navStack, nav }: ToolSidebarPanelProps) {
  const Sidebar = tool.Sidebar;
  return (
    <aside className="w-72 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {Sidebar ? (
        <Sidebar
          filterState={filterState}
          onFilterChange={setFilterState}
          selection={selection}
          onSelect={onSelect}
          nav={{ stack: navStack, push: nav.push, pop: nav.pop, reset: nav.reset, setStack: nav.setStack }}
        />
      ) : (
        <div className="p-3 text-xs text-slate-500">No sidebar for this tool.</div>
      )}
    </aside>
  );
}

export default ToolSidebarPanel;
