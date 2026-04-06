// features/reporting/widgets/reportingDefs.tsx
// Reporting page widget definitions — shown on /dashboard (Reporting)
import { DASHBOARD_TOOL_DEFS } from "@widgets";
import type { AnyDashboardToolDefinition } from "@entities/Page/dashboardStyle/types";

// "inbox" temporarily hidden — will return later
const REPORTING_IDS = ["grant-budgets", "all-enrollments", "case-manager-load", "caseload-board"];

// Map report IDs → digest type so the toolbar can show a "Subscribe" button
const REPORT_DIGEST_MAP: Record<string, AnyDashboardToolDefinition["digestType"]> = {
  "grant-budgets":     "budget",
  "all-enrollments":   "enrollments",
  "case-manager-load": "caseManagers",
  "caseload-board":    "caseload",
};

export const REPORTING_TOOL_DEFS: readonly AnyDashboardToolDefinition[] = DASHBOARD_TOOL_DEFS
  .filter((t) => REPORTING_IDS.includes(t.id))
  .map((t) => ({
    ...t,
    defaultPinned: !t.hidden,
    digestType: REPORT_DIGEST_MAP[t.id],
  }));

export function getReportingToolDef(toolId: string) {
  return REPORTING_TOOL_DEFS.find((t) => t.id === toolId) ?? null;
}
