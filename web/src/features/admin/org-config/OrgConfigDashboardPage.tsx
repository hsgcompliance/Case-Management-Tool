"use client";

import React from "react";
import { DashboardStyleLayout } from "@entities/Page/dashboardStyle";
import { OrgConfigDashboardProvider } from "./orgConfigContext";
import { ORG_CONFIG_OVERVIEW_TOOL_ID, ORG_CONFIG_TOOL_DEFS } from "./orgConfigToolDefs";

export interface OrgConfigDashboardPageProps {
  selectedToolKey?: string;
}

export default function OrgConfigDashboardPage({ selectedToolKey }: OrgConfigDashboardPageProps) {
  return (
    <OrgConfigDashboardProvider>
      <div className="min-h-dvh" data-tour="admin-org-config-page">
        <DashboardStyleLayout
          tools={ORG_CONFIG_TOOL_DEFS}
          selectedToolId={selectedToolKey || ORG_CONFIG_OVERVIEW_TOOL_ID}
          basePath="/admin/org-config"
          prefsKey="adminOrgConfigPrefs"
          hintToolIds={["display-config", "email-templates", "google-drive"]}
        />
      </div>
    </OrgConfigDashboardProvider>
  );
}

