"use client";

import React from "react";
import ToolSwitcherBar from "./components/ToolSwitcherBar";
import { SharedPageMetricsBar } from "@entities/metrics/strip/PageMetricsBar";
import ToolMainPanel from "./components/ToolMainPanel";
import ToolSidebarPanel from "./components/ToolSidebarPanel";
import ToolTopbarRow from "./components/ToolTopbarRow";
import { DashboardToolModalProvider } from "./hooks/useDashboardToolModal";
import { PageLayoutProvider, usePageLayout } from "./client";
import { AnyDashboardToolDefinition, DashboardToolId, NavCrumb } from "./types";
import { PinnedItemsSection } from "@entities/pinned/PinnedItemsSection";

interface DashboardLayoutInnerProps {
  tools: readonly AnyDashboardToolDefinition[];
  basePath: string;
  hintToolIds?: readonly string[];
}

function NoToolSelectedPanel() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20 text-slate-400">
      <div className="text-sm">Select a tool above to get started</div>
    </div>
  );
}

function DashboardLayoutInner({ tools, basePath, hintToolIds = [] }: DashboardLayoutInnerProps) {
  const { state, togglePin, setActiveTool, setFilter, setSelection, navPush, navPop, navReset, navSetStack } =
    usePageLayout();

  const noToolSelected = state.activeToolId === "none" || !tools.find((t) => t.id === state.activeToolId);

  const activeTool = React.useMemo<AnyDashboardToolDefinition | null>(() => {
    if (noToolSelected) return null;
    return tools.find((t) => t.id === state.activeToolId) || null;
  }, [tools, state.activeToolId, noToolSelected]);

  const toolId = activeTool?.id ?? ("none" as DashboardToolId);
  const filterState = activeTool ? (state.perToolFilterState[toolId] ?? {}) : {};
  const selection = activeTool ? (state.perToolSelection[toolId] ?? null) : null;
  const navStack = activeTool ? (state.perToolNavStack[toolId] || []) : [];

  React.useEffect(() => {
    const segment = basePath.replace(/^\//, "");
    const onPop = () => {
      const match = window.location.pathname.match(new RegExp(`\\/${segment}\\/([^/]+)`));
      if (match?.[1]) setActiveTool(match[1] as DashboardToolId);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setActiveTool, basePath]);

  const toolHasSidebar = Boolean(activeTool?.Sidebar);
  const shouldRenderSidebar =
    toolHasSidebar &&
    activeTool &&
    (activeTool.shouldRenderSidebar
      ? activeTool.shouldRenderSidebar({ filterState, selection, navStack })
      : true);

  const nav = React.useMemo(
    () => ({
      push: (c: NavCrumb<unknown>) => {
        navPush(toolId, c);
        setSelection(toolId, c.selection ?? null);
      },
      pop: () => {
        const stack = state.perToolNavStack[toolId] || [];
        if (!stack.length) return;
        const next = stack.slice(0, Math.max(0, stack.length - 1));
        navPop(toolId);
        const top = next[next.length - 1];
        setSelection(toolId, top?.selection ?? null);
      },
      reset: () => {
        navReset(toolId);
        setSelection(toolId, null);
      },
      setStack: (s: NavCrumb<unknown>[]) => {
        navSetStack(toolId, s);
        const top = s[s.length - 1];
        setSelection(toolId, top?.selection ?? null);
      },
    }),
    [toolId, state.perToolNavStack, navPush, navPop, navReset, navSetStack, setSelection]
  );

  const handleOpenTool = (nextToolId: string) => {
    setActiveTool(nextToolId as DashboardToolId);
    window.history.pushState(null, "", `${basePath}/${nextToolId}`);
  };

  return (
    <div className="min-h-dvh flex flex-col" data-tour="dashboard-layout">
      <ToolSwitcherBar
        tools={tools}
        activeToolId={state.activeToolId}
        pinnedToolIds={state.pinnedToolIds}
        hintToolIds={noToolSelected ? hintToolIds : []}
        onOpenTool={handleOpenTool}
        onUnpinTool={(nextToolId) => togglePin(nextToolId as DashboardToolId)}
      />

      <SharedPageMetricsBar />
      {basePath === "/reports" && <PinnedItemsSection />}

      {noToolSelected ? (
        <NoToolSelectedPanel />
      ) : activeTool ? (
        <>
          <ToolTopbarRow
            tool={activeTool}
            filterState={filterState}
            setFilterState={(next) => setFilter(toolId, next)}
            selection={selection}
            navStack={navStack}
            nav={nav}
          />
          <div className="flex-1 flex" data-tour="dashboard-layout-body">
            {shouldRenderSidebar ? (
              <ToolSidebarPanel
                tool={activeTool}
                filterState={filterState}
                setFilterState={(next) => setFilter(toolId, next)}
                selection={selection}
                onSelect={(sel) => setSelection(toolId, sel)}
                navStack={navStack}
                nav={nav}
              />
            ) : null}
            <ToolMainPanel
              tool={activeTool}
              filterState={filterState}
              setFilterState={(next) => setFilter(toolId, next)}
              selection={selection}
              onSelect={(sel) => setSelection(toolId, sel)}
              navStack={navStack}
              nav={nav}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

export interface DashboardStyleLayoutProps {
  selectedToolId?: string;
  tools: readonly AnyDashboardToolDefinition[];
  basePath?: string;
  prefsKey?: string;
  hintToolIds?: readonly string[];
}

export function DashboardStyleLayout({
  selectedToolId,
  tools,
  basePath = "/reports",
  prefsKey = "dashboardPrefs",
  hintToolIds,
}: DashboardStyleLayoutProps) {
  return (
    <PageLayoutProvider tools={tools} selectedToolId={selectedToolId} prefsKey={prefsKey}>
      <DashboardToolModalProvider>
        <DashboardLayoutInner tools={tools} basePath={basePath} hintToolIds={hintToolIds} />
      </DashboardToolModalProvider>
    </PageLayoutProvider>
  );
}

// Legacy alias kept for compatibility
export const DashboardLayout = DashboardStyleLayout;
export type DashboardLayoutProps = DashboardStyleLayoutProps;

export default DashboardStyleLayout;
