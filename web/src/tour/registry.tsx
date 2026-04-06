//web/src/tours/registry.ts
import { TourFlow, type TourFlowT } from "./schema";
import { Routes } from "@lib/Routes";

export const DashboardTour = TourFlow.parse({
  id: "dashboard",
  name: "Dashboard Basics",
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: "s01",
      route: Routes.protected.reports(),
      selector: '[data-tour="the-dashboard-page"]',
      title: "Reports",
      body: "High-level status & shortcuts.",
      placement: "right",
      padding: 8,
    },
    {
      id: "s02",
      route: Routes.protected.reports(),
      selector: '[data-tour="tools-panel"]',
      title: "Tools",
      body: "Toggle features on/off here.",
      placement: "bottom",
      padding: 8,
    },
  ],
});

export const CustomersTour = TourFlow.parse({
  id: "customers",
  name: "Customers & Enrollments",
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: "s01",
      route: Routes.protected.customers(),
      selector: '[data-tour="customers-table"]',
      title: "Customers",
      body: "Search, filter, and open detail modals.",
    },
    {
      id: "s02",
      route: Routes.protected.customer(":id"), // dynamic; engine will replace at runtime
      selector: '[data-tour="customer-tabs"]',
      title: "Details",
      body: "Tabs for Assessments, Payments, and more.",
    },
  ],
});

export type TourRegistryMap = Record<string, TourFlowT>;

export const TourRegistry: TourRegistryMap = {
  dashboard: DashboardTour,
  customers: CustomersTour,
} as const;

export type TourId = keyof typeof TourRegistry;
