// features/reporting/ReportingPage.tsx
"use client";

import React from "react";
import { DashboardStyleLayout } from "@entities/Page/dashboardStyle";
import { REPORTING_TOOL_DEFS } from "./widgets/reportingDefs";

export interface ReportingPageProps {
  selectedToolKey?: string;
}

export function ReportingPage({ selectedToolKey }: ReportingPageProps) {
  return (
    <div className="min-h-dvh" data-tour="reporting-page">
      <DashboardStyleLayout
        tools={REPORTING_TOOL_DEFS}
        selectedToolId={selectedToolKey}
        basePath="/reports"
        prefsKey="dashboardPrefs"
        hintToolIds={["all-enrollments"]}
      />
    </div>
  );
}

export default ReportingPage;
