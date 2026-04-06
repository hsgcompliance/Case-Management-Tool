import React from "react";
import { useCustomersAll } from "@hooks/useCustomers";
import { useEnrollmentsList } from "@hooks/useEnrollments";
import { useGrants } from "@hooks/useGrants";
import { fullNameFromCustomer } from "@widgets/utils";

const STALE_MS = 120_000;

const ADMIN_LIMITS = {
  customersActive: 5_000,
  customersInactive: 1_000,
  enrollmentsActive: 5_000,
  enrollmentsInactive: 1_000,
  grants: 500,
} as const;

/**
 * Admin enrollments data hook — 5× higher limits than useDashboardSharedData,
 * paginated customers, and truncation flags for large orgs.
 *
 * Drop-in replacement for useDashboardSharedData in AllEnrollmentsTool.
 */
export function useAdminEnrollmentsData(): {
  customers: any[];
  enrollments: any[];
  grants: any[];
  customerNameById: Map<string, string>;
  grantNameById: Map<string, string>;
  enrollmentsByCustomer: Map<string, number>;
  sharedDataLoading: boolean;
  sharedDataError: boolean;
  sharedDataOk: boolean;
  isTruncated: { customers: boolean; enrollments: boolean };
} {
  const activeCustomersQ = useCustomersAll(
    { active: "true", deleted: "exclude" },
    { maxItems: ADMIN_LIMITS.customersActive, staleTime: STALE_MS }
  );

  const inactiveCustomersQ = useCustomersAll(
    { active: "false", deleted: "exclude" },
    { maxItems: ADMIN_LIMITS.customersInactive, staleTime: STALE_MS }
  );

  const activeEnrollmentsQ = useEnrollmentsList(
    { active: true, limit: ADMIN_LIMITS.enrollmentsActive } as any
  );

  const inactiveEnrollmentsQ = useEnrollmentsList(
    { active: false, limit: ADMIN_LIMITS.enrollmentsInactive } as any
  );

  const grantsQ = useGrants({ limit: ADMIN_LIMITS.grants }, { staleTime: STALE_MS });

  const customers = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const c of [
      ...(activeCustomersQ.data || []) as any[],
      ...(inactiveCustomersQ.data || []) as any[],
    ]) {
      if (c?.id) map.set(String(c.id), c);
    }
    return Array.from(map.values());
  }, [activeCustomersQ.data, inactiveCustomersQ.data]);

  const enrollments = React.useMemo(
    () => [
      ...(activeEnrollmentsQ.data || []) as any[],
      ...(inactiveEnrollmentsQ.data || []) as any[],
    ],
    [activeEnrollmentsQ.data, inactiveEnrollmentsQ.data]
  );

  const grants = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const g of (grantsQ.data || []) as any[]) {
      if (g?.id) map.set(String(g.id), g);
    }
    return Array.from(map.values());
  }, [grantsQ.data]);

  const customerNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) map.set(String(c.id || ""), fullNameFromCustomer(c));
    return map;
  }, [customers]);

  const grantNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grants as any[]) map.set(String(g.id || ""), String(g.name || g.id || "-"));
    return map;
  }, [grants]);

  const enrollmentsByCustomer = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of enrollments as any[]) {
      const customerId = String(e?.customerId || e?.clientId || "");
      if (!customerId) continue;
      m.set(customerId, (m.get(customerId) || 0) + 1);
    }
    return m;
  }, [enrollments]);

  const sharedDataLoading =
    activeCustomersQ.isLoading ||
    inactiveCustomersQ.isLoading ||
    activeEnrollmentsQ.isLoading ||
    inactiveEnrollmentsQ.isLoading ||
    grantsQ.isLoading;

  const sharedDataError =
    activeCustomersQ.isError ||
    inactiveCustomersQ.isError ||
    activeEnrollmentsQ.isError ||
    inactiveEnrollmentsQ.isError ||
    grantsQ.isError;

  const sharedDataOk = !sharedDataLoading && !sharedDataError;

  const isTruncated = {
    customers:
      (activeCustomersQ.data?.length ?? 0) >= ADMIN_LIMITS.customersActive ||
      (inactiveCustomersQ.data?.length ?? 0) >= ADMIN_LIMITS.customersInactive,
    enrollments:
      (activeEnrollmentsQ.data?.length ?? 0) >= ADMIN_LIMITS.enrollmentsActive ||
      (inactiveEnrollmentsQ.data?.length ?? 0) >= ADMIN_LIMITS.enrollmentsInactive,
  };

  return {
    customers,
    enrollments,
    grants,
    customerNameById,
    grantNameById,
    enrollmentsByCustomer,
    sharedDataLoading,
    sharedDataError,
    sharedDataOk,
    isTruncated,
  };
}
