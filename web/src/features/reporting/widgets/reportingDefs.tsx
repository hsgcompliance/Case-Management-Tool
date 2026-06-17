// features/reporting/widgets/reportingDefs.tsx
// Reporting page widget definitions shown on /reports.
import { DASHBOARD_TOOL_DEFS } from "@widgets";
import type { AnyDashboardToolDefinition } from "@entities/Page/dashboardStyle/types";

const REPORTING_IDS = ["grant-budgets", "rental-assistance", "all-enrollments", "case-manager-load", "caseload-board"];

const REPORT_DIGEST_MAP: Record<string, AnyDashboardToolDefinition["digestType"]> = {
  "grant-budgets": "budget",
  "all-enrollments": "enrollments",
  "case-manager-load": "caseManagers",
  "caseload-board": "caseload",
};

export const REPORTING_TOOL_DEFS: readonly AnyDashboardToolDefinition[] = DASHBOARD_TOOL_DEFS
  .filter((tool) => REPORTING_IDS.includes(tool.id))
  .map((tool) => ({
    ...tool,
    defaultPinned: !tool.hidden,
    digestType: REPORT_DIGEST_MAP[tool.id],
  }));

export function getReportingToolDef(toolId: string) {
  return REPORTING_TOOL_DEFS.find((tool) => tool.id === toolId) ?? null;
}
