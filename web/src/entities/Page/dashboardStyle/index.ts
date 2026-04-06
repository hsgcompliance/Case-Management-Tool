/**
 * entities/Page/dashboardStyle
 *
 * Dashboard-style page engine shared by Reporting and Tools style pages.
 * Exposes the layout, tool contract, and page layout hook for dashboard-style
 * workspaces that render widgets inside a shared shell.
 */

// Layout component
export {
  DashboardLayout as DashboardStyleLayout,
  type DashboardLayoutProps as DashboardStyleLayoutProps,
} from "./DashboardStyleLayout";

// Shared types for building tool widgets
export type {
  AnyDashboardToolDefinition,
  DashboardToolDefinition,
  DashboardToolId,
  NavCrumb,
} from "./types";

// Store hook — use inside DashboardStyleLayout's provider tree
export { usePageLayout } from "./client";
