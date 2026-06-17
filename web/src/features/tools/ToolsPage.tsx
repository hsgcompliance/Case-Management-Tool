// features/tools/ToolsPage.tsx
"use client";

import React from "react";
import { DashboardStyleLayout } from "@entities/Page/dashboardStyle";
import { TOOLS_TOOL_DEFS } from "./toolsDefs";
import { ReconciliationWorkspaceProvider } from "@features/report-reconciliation/ReconciliationWorkspaceContext";

export interface ToolsPageProps {
  selectedToolKey?: string;
}

export function ToolsPage({ selectedToolKey }: ToolsPageProps) {
  return (
    <div className="min-h-dvh" data-tour="tools-page">
      <ReconciliationWorkspaceProvider>
        <DashboardStyleLayout
          tools={TOOLS_TOOL_DEFS}
          selectedToolId={selectedToolKey}
          basePath="/tools"
          prefsKey="toolsPrefs"
          hintToolIds={["spending"]}
        />
      </ReconciliationWorkspaceProvider>
    </div>
  );
}

export default ToolsPage;
