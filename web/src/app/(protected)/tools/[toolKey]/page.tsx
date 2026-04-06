// app/(protected)/tools/[toolKey]/page.tsx
import React from "react";
import { notFound } from "next/navigation";
import ToolsPage from "@features/tools/ToolsPage";
import { TOOLS_TOOL_DEFS, getToolsPageToolDef } from "@features/tools/widgets/toolsDefs";

export function generateStaticParams() {
  return TOOLS_TOOL_DEFS.map((tool) => ({ toolKey: tool.id }));
}

export default async function ToolsToolPage({ params }: { params: Promise<{ toolKey: string }> }) {
  const { toolKey } = await params;
  if (!toolKey || !getToolsPageToolDef(toolKey)) {
    notFound();
  }
  return <ToolsPage selectedToolKey={toolKey} />;
}
