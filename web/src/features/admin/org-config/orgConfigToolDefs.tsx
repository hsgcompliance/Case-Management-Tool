import type { AnyDashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import {
  DisplayConfigMain,
  DisplayConfigSidebar,
  DisplayConfigTopbar,
  type DisplayConfigFilterState,
} from "./tools/DisplayConfigTool";
import {
  DevOrgControlsMain,
  DevOrgControlsTopbar,
} from "./tools/DevOrgControlsTool";
import {
  EmailTemplatesMain,
  EmailTemplatesSidebar,
  EmailTemplatesTopbar,
  type EmailTemplatesFilterState,
} from "./tools/EmailTemplatesTool";
import {
  GoogleDriveConfigMain,
  GoogleDriveConfigTopbar,
} from "./tools/GoogleDriveConfigTool";
import {
  OrgOverviewMain,
  OrgOverviewTopbar,
} from "./tools/OrgOverviewTool";
import {
  ReportMappingMain,
  ReportMappingSidebar,
  ReportMappingTopbar,
  type ReportMappingFilterState,
} from "./tools/ReportMappingTool";
import {
  SystemConfigMain,
  SystemConfigSidebar,
  SystemConfigTopbar,
  type SystemConfigFilterState,
} from "./tools/SystemConfigTool";

export const ORG_CONFIG_OVERVIEW_TOOL_ID = "overview";

export const ORG_CONFIG_TOOL_DEFS: readonly AnyDashboardToolDefinition[] = [
  {
    id: ORG_CONFIG_OVERVIEW_TOOL_ID,
    title: "Org Overview",
    defaultPinned: true,
    ToolTopbar: OrgOverviewTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: OrgOverviewMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "display-config",
    title: "Display Configuration",
    defaultPinned: true,
    createFilterState: () => ({ search: "" } satisfies DisplayConfigFilterState),
    shouldRenderSidebar: () => true,
    ToolTopbar: DisplayConfigTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: DisplayConfigSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: DisplayConfigMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "email-templates",
    title: "Email Templates",
    defaultPinned: true,
    createFilterState: () => ({ search: "" } satisfies EmailTemplatesFilterState),
    shouldRenderSidebar: () => true,
    ToolTopbar: EmailTemplatesTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: EmailTemplatesSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: EmailTemplatesMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "google-drive",
    title: "Google Drive",
    defaultPinned: true,
    ToolTopbar: GoogleDriveConfigTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: GoogleDriveConfigMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "report-mapping",
    title: "Report Mapping",
    defaultPinned: true,
    createFilterState: () => ({ search: "", showInactive: false } satisfies ReportMappingFilterState),
    shouldRenderSidebar: () => true,
    ToolTopbar: ReportMappingTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: ReportMappingSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: ReportMappingMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "system-config",
    title: "System Configuration",
    defaultPinned: false,
    createFilterState: () => ({ search: "" } satisfies SystemConfigFilterState),
    shouldRenderSidebar: () => true,
    ToolTopbar: SystemConfigTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: SystemConfigSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: SystemConfigMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "dev-org-controls",
    title: "Dev Org Controls",
    defaultPinned: false,
    ToolTopbar: DevOrgControlsTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: DevOrgControlsMain as AnyDashboardToolDefinition["Main"],
  },
];

export function getOrgConfigToolDef(toolId: string) {
  return ORG_CONFIG_TOOL_DEFS.find((tool) => tool.id === toolId) ?? null;
}
