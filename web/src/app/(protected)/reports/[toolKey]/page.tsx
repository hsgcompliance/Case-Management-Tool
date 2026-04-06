// app/(protected)/reports/[toolKey]/page.tsx
import React from "react";
import { notFound } from "next/navigation";
import ReportingPage from "@features/reporting/ReportingPage";
import { REPORTING_TOOL_DEFS, getReportingToolDef } from "@features/reporting/widgets/reportingDefs";

export function generateStaticParams() {
  return REPORTING_TOOL_DEFS.map((tool) => ({ toolKey: tool.id }));
}

export default async function ReportsToolPage({ params }: { params: Promise<{ toolKey: string }> }) {
  const { toolKey } = await params;
  if (!toolKey || !getReportingToolDef(toolKey)) {
    notFound();
  }
  return <ReportingPage selectedToolKey={toolKey} />;
}
