// features/tools/toolsDefs.tsx
// Tools page widget definitions — shown on /tools
import { DASHBOARD_TOOL_DEFS } from "@widgets";
import type { AnyDashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { AssessmentManagerMain } from "./AssessmentManagerTool";
import { AcuityManagerMain } from "./AcuityManagerTool";
import { ReconciliationsMain } from "./ReconciliationsTool";
import {
  JotformsTopbar,
  JotformsSidebar,
  JotformsMain,
  type JotformsFilterState,
} from "./JotformsTool";
import { EmailDigestMain } from "./EmailDigestTool";
import { PipelineManagerMain } from "./PipelineManagerTool";

// IDs from DASHBOARD_TOOL_DEFS that belong on the Tools page
const TOOLS_FROM_DASHBOARD_IDS = [
  "spending",               // → renamed "Invoicing", un-hidden
  "customer-folders",       // → un-hidden
];

const fromDashboard = DASHBOARD_TOOL_DEFS
  .filter((t) => TOOLS_FROM_DASHBOARD_IDS.includes(t.id))
  .map((t) => ({
    ...t,
    hidden: false,
    defaultPinned: true,
    title: t.id === "spending" ? "Invoicing" : t.title,
  }));

const newWidgets: readonly AnyDashboardToolDefinition[] = [
  {
    id: "jotforms",
    title: "Jotforms",
    defaultPinned: true,
    createFilterState: () =>
      ({
        jotformsView: "dashboard",
        formSearch: "",
        submissionSearch: "",
        detailView: "pipeline",
        submissionsColWidth: 360,
      } satisfies JotformsFilterState),
    shouldRenderSidebar: () => true,
    ToolTopbar: JotformsTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: JotformsSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: JotformsMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "budget-map",
    title: "Budget Pipelines",
    defaultPinned: true,
    Main: PipelineManagerMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "email-digest",
    title: "Email Digest",
    defaultPinned: true,
    Main: EmailDigestMain as AnyDashboardToolDefinition["Main"],
  },
  // ── Advanced tools — accessible via the overflow menu ────────────────────
  {
    id: "assessment-manager",
    title: "Assessment Manager",
    defaultPinned: false,
    Main: AssessmentManagerMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "acuity-manager",
    title: "Acuity Manager",
    defaultPinned: false,
    Main: AcuityManagerMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "reconciliations",
    title: "Reconciliations",
    defaultPinned: false,
    Main: ReconciliationsMain as AnyDashboardToolDefinition["Main"],
  },
];

export const TOOLS_TOOL_DEFS: readonly AnyDashboardToolDefinition[] = [
  ...newWidgets,
  ...fromDashboard,
];

export function getToolsPageToolDef(toolId: string) {
  return TOOLS_TOOL_DEFS.find((t) => t.id === toolId) ?? null;
}
