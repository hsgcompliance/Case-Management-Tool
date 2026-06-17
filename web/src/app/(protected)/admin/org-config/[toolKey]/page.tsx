// app/(protected)/admin/org-config/[toolKey]/page.tsx
import { notFound } from "next/navigation";
import OrgConfigDashboardPage from "@features/admin/org-config/OrgConfigDashboardPage";
import { getOrgConfigToolDef, ORG_CONFIG_TOOL_DEFS } from "@features/admin/org-config/orgConfigToolDefs";

export async function generateStaticParams() {
  return ORG_CONFIG_TOOL_DEFS.map((tool) => ({ toolKey: tool.id }));
}

export default async function OrgConfigToolRoute({ params }: { params: Promise<{ toolKey: string }> }) {
  const { toolKey } = await params;
  if (!toolKey || !getOrgConfigToolDef(toolKey)) {
    notFound();
  }
  return <OrgConfigDashboardPage selectedToolKey={toolKey} />;
}

