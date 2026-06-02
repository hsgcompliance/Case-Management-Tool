// mobile-web/src/hooks/queryKeys.ts
// Centralized query key factory — mirrors web/src/hooks/queryKeys.ts structure.
// Mobile scope: customers, enrollments, cmActivities, userPrefs.
// Uses stableSortObject so filter objects never produce flapping keys.

import { stableSortObject as stable } from "@lib/stable";

export const qk = {
  customers: {
    root: ["customers"] as const,
    /** My assigned caseload — by caseManagerId == uid. */
    mine: (uid: string) => ["customers", "mine", uid] as const,
    /** All org customers — by orgId. */
    org: (uid: string) => ["customers", "org", uid] as const,
    /** Single customer detail. */
    detail: (id: string) => ["customers", "detail", id] as const,
  },

  enrollments: {
    root: ["enrollments"] as const,
    /** All enrollments for a single customer. */
    byCustomer: (customerId: string) =>
      ["enrollments", "byCustomer", customerId] as const,
    /** Single enrollment detail. */
    detail: (id: string) => ["enrollments", "detail", id] as const,
  },

  cmActivities: {
    root: ["cmActivities"] as const,
    /**
     * Infinite-scroll feed for a CM.
     * Keyed by uid + type filter so different filter pills are independent.
     */
    feed: (uid: string, type?: string | null) =>
      ["cmActivities", "feed", uid, type ?? null] as const,
    /** Session list for a single customer (scoped to the viewing CM). */
    byCustomer: (uid: string, customerId: string) =>
      ["cmActivities", "byCustomer", uid, customerId] as const,
  },

  userPrefs: {
    root: ["userPrefs"] as const,
    /** Per-user display preferences stored in userExtras.settings. */
    me: (uid: string) => ["userPrefs", uid] as const,
  },

  google: {
    root: ["google"] as const,
    integration: (service: "googleCalendar" | "googleDrive", uid: string) =>
      ["google", "integration", service, uid] as const,
  },

  grants: {
    root: ["grants"] as const,
    /** Active grants for the org (keyed by requesting user uid so orgId is resolved lazily). */
    active: (uid: string) => ["grants", "active", uid] as const,
  },
};
