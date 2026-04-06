// features/tools/ToolsPage.tsx
"use client";

import React from "react";
import { DashboardStyleLayout } from "@entities/Page/dashboardStyle";
import { TOOLS_TOOL_DEFS } from "./widgets/toolsDefs";

export interface ToolsPageProps {
  selectedToolKey?: string;
}

export function ToolsPage({ selectedToolKey }: ToolsPageProps) {
  return (
    <div className="min-h-dvh" data-tour="tools-page">
      <DashboardStyleLayout
        tools={TOOLS_TOOL_DEFS}
        selectedToolId={selectedToolKey}
        basePath="/tools"
        prefsKey="toolsPrefs"
        hintToolIds={["spending"]}
      />
    </div>
  );
}

export default ToolsPage;
