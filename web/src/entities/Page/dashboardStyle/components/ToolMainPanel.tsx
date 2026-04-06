"use client";

import React from "react";
import { AnyDashboardToolDefinition, NavCrumb } from "../types";

export interface ToolMainPanelProps {
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

export function ToolMainPanel({ tool, filterState, setFilterState, selection, onSelect, navStack, nav }: ToolMainPanelProps) {
  const Main = tool.Main;
  return (
    <main className="min-w-0 flex-1 bg-white p-3 dark:bg-slate-900">
      <Main
        filterState={filterState}
        onFilterChange={setFilterState}
        selection={selection}
        onSelect={onSelect}
        nav={{ stack: navStack, push: nav.push, pop: nav.pop, reset: nav.reset, setStack: nav.setStack }}
      />
    </main>
  );
}

export default ToolMainPanel;
