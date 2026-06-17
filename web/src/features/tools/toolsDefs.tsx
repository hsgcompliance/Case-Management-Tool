// features/tools/toolsDefs.tsx
// Tools page widget definitions shown on /tools.
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
import {
  CustomerIdentityReviewMain,
  CustomerIdentityReviewTopbar,
  EnrollmentReconciliationMain,
  EnrollmentReconciliationTopbar,
  PaymentReconciliationMain,
  PaymentReconciliationTopbar,
  createReconciliationFilterState,
  type ReconciliationToolFilterState,
} from "@features/report-reconciliation/ReconciliationTools";

const TOOLS_FROM_DASHBOARD_IDS = [
  "spending",
  "customer-folders",
];

const fromDashboard = DASHBOARD_TOOL_DEFS
  .filter((tool) => TOOLS_FROM_DASHBOARD_IDS.includes(tool.id))
  .map((tool) => ({
    ...tool,
    hidden: false,
    defaultPinned: true,
    title: tool.id === "spending" ? "Invoicing" : tool.title,
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
  {
    id: "enrollment-reconciliation",
    title: "Enrollment Reconciliation",
    defaultPinned: true,
    createFilterState: () => createReconciliationFilterState("enrollment") satisfies ReconciliationToolFilterState,
    ToolTopbar: EnrollmentReconciliationTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: EnrollmentReconciliationMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "payment-reconciliation",
    title: "Payment Reconciliation",
    defaultPinned: true,
    createFilterState: () => createReconciliationFilterState("payment") satisfies ReconciliationToolFilterState,
    ToolTopbar: PaymentReconciliationTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: PaymentReconciliationMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "customer-identity-review",
    title: "Customer Identity Review",
    defaultPinned: true,
    createFilterState: () => createReconciliationFilterState("identity") satisfies ReconciliationToolFilterState,
    ToolTopbar: CustomerIdentityReviewTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: CustomerIdentityReviewMain as AnyDashboardToolDefinition["Main"],
  },
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
  return TOOLS_TOOL_DEFS.find((tool) => tool.id === toolId) ?? null;
}
