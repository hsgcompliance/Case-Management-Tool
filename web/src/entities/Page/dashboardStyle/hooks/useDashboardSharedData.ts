import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Customers from "@client/customers";
import Enrollments from "@client/enrollments";
import Grants from "@client/grants";
import { pending } from "@lib/pending";
import { qk } from "@hooks/queryKeys";
import { fullNameFromCustomer } from "@widgets/utils";

const STALE_MS = 120_000;

// Prefer active slices for dashboard responsiveness; keep inactive lighter.
const DASH_LIMITS = {
  customersActive: 1_000,
  customersInactive: 300,
  enrollmentsActive: 2_500,
  enrollmentsInactive: 500,
  // Match GrantsPage keys to avoid duplicate grant-list cache entries.
  grantsActive: 200,
  grantsInactive: 200,
} as const;

async function ensureDashboardCaches(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.fetchQuery({
      queryKey: qk.customers.list({
        active: "true",
        deleted: "exclude",
        limit: DASH_LIMITS.customersActive,
      }),
      staleTime: STALE_MS,
      queryFn: () =>
        Customers.list({
          active: "true",
          deleted: "exclude",
          limit: DASH_LIMITS.customersActive,
        }),
    }),
    qc.fetchQuery({
      queryKey: qk.customers.list({
        active: "false",
        deleted: "exclude",
        limit: DASH_LIMITS.customersInactive,
      }),
      staleTime: STALE_MS,
      queryFn: () =>
        Customers.list({
          active: "false",
          deleted: "exclude",
          limit: DASH_LIMITS.customersInactive,
        }),
    }),
    qc.fetchQuery({
      queryKey: qk.enrollments.list({
        active: true,
        limit: DASH_LIMITS.enrollmentsActive,
      }),
      staleTime: STALE_MS,
      queryFn: () =>
        Enrollments.list({
          active: true,
          limit: DASH_LIMITS.enrollmentsActive,
        } as any),
    }),
    qc.fetchQuery({
      queryKey: qk.enrollments.list({
        active: false,
        limit: DASH_LIMITS.enrollmentsInactive,
      }),
      staleTime: STALE_MS,
      queryFn: () =>
        Enrollments.list({
          active: false,
          limit: DASH_LIMITS.enrollmentsInactive,
        } as any),
    }),
    qc.fetchQuery({
      queryKey: qk.grants.list({
        active: true,
        limit: DASH_LIMITS.grantsActive,
      }),
      staleTime: STALE_MS,
      queryFn: () =>
        Grants.list({
          active: true,
          limit: DASH_LIMITS.grantsActive,
        } as any),
    }),
    qc.fetchQuery({
      queryKey: qk.grants.list({
        active: false,
        limit: DASH_LIMITS.grantsInactive,
      }),
      staleTime: STALE_MS,
      queryFn: () =>
        Grants.list({
          active: false,
          limit: DASH_LIMITS.grantsInactive,
        } as any),
    }),
  ]);
}

export function useDashboardSharedData() {
  const qc = useQueryClient();

  // Single heavy gate: fetch/cache the canonical query keys used across pages.
  const warmup = useQuery({
    queryKey: qk.dashboard.sharedWarmup("v3"),
    staleTime: STALE_MS,
    retry: 1,
    queryFn: async () =>
      pending.with(async () => {
        await ensureDashboardCaches(qc);
        return { ok: true, at: Date.now() };
      }, "heavy", { delayMs: 150 }),
  });

  const queriesEnabled = !warmup.isPending;

  const { data: activeCustomers = [] } = useQuery({
    enabled: queriesEnabled,
    queryKey: qk.customers.list({
      active: "true",
      deleted: "exclude",
      limit: DASH_LIMITS.customersActive,
    }),
    staleTime: STALE_MS,
    queryFn: () =>
      Customers.list({
        active: "true",
        deleted: "exclude",
        limit: DASH_LIMITS.customersActive,
      }),
  });

  const { data: inactiveCustomers = [] } = useQuery({
    enabled: queriesEnabled,
    queryKey: qk.customers.list({
      active: "false",
      deleted: "exclude",
      limit: DASH_LIMITS.customersInactive,
    }),
    staleTime: STALE_MS,
    queryFn: () =>
      Customers.list({
        active: "false",
        deleted: "exclude",
        limit: DASH_LIMITS.customersInactive,
      }),
  });

  const { data: activeEnrollments = [] } = useQuery({
    enabled: queriesEnabled,
    queryKey: qk.enrollments.list({
      active: true,
      limit: DASH_LIMITS.enrollmentsActive,
    }),
    staleTime: STALE_MS,
    queryFn: () =>
      Enrollments.list({
        active: true,
        limit: DASH_LIMITS.enrollmentsActive,
      } as any),
  });

  const { data: inactiveEnrollments = [] } = useQuery({
    enabled: queriesEnabled,
    queryKey: qk.enrollments.list({
      active: false,
      limit: DASH_LIMITS.enrollmentsInactive,
    }),
    staleTime: STALE_MS,
    queryFn: () =>
      Enrollments.list({
        active: false,
        limit: DASH_LIMITS.enrollmentsInactive,
      } as any),
  });

  const { data: grantsActive = [] } = useQuery({
    enabled: queriesEnabled,
    queryKey: qk.grants.list({
      active: true,
      limit: DASH_LIMITS.grantsActive,
    }),
    staleTime: STALE_MS,
    queryFn: () =>
      Grants.list({
        active: true,
        limit: DASH_LIMITS.grantsActive,
      } as any),
  });

  const { data: grantsInactive = [] } = useQuery({
    enabled: queriesEnabled,
    queryKey: qk.grants.list({
      active: false,
      limit: DASH_LIMITS.grantsInactive,
    }),
    staleTime: STALE_MS,
    queryFn: () =>
      Grants.list({
        active: false,
        limit: DASH_LIMITS.grantsInactive,
      } as any),
  });

  const customers = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const c of [...(activeCustomers as any[]), ...(inactiveCustomers as any[])]) {
      if (c?.id) map.set(String(c.id), c);
    }
    return Array.from(map.values());
  }, [activeCustomers, inactiveCustomers]);

  const enrollments = React.useMemo(
    () => [...(activeEnrollments as any[]), ...(inactiveEnrollments as any[])],
    [activeEnrollments, inactiveEnrollments]
  );

  const grants = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const g of [...(grantsActive as any[]), ...(grantsInactive as any[])]) {
      if (g?.id) map.set(String(g.id), g);
    }
    return Array.from(map.values());
  }, [grantsActive, grantsInactive]);

  const grantNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grants as any[]) map.set(String(g.id || ""), String(g.name || g.id || "-"));
    return map;
  }, [grants]);

  const customerNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers as any[]) map.set(String(c.id || ""), fullNameFromCustomer(c));
    return map;
  }, [customers]);

  const enrollmentsByCustomer = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of enrollments as any[]) {
      const customerId = String(e?.customerId || e?.clientId || "");
      if (!customerId) continue;
      m.set(customerId, (m.get(customerId) || 0) + 1);
    }
    return m;
  }, [enrollments]);

  const metrics = React.useMemo(
    () => ({
      limits: DASH_LIMITS,
      fetched: {
        activeCustomers: (activeCustomers as any[]).length,
        inactiveCustomers: (inactiveCustomers as any[]).length,
        activeEnrollments: (activeEnrollments as any[]).length,
        inactiveEnrollments: (inactiveEnrollments as any[]).length,
        activeGrants: (grantsActive as any[]).length,
        inactiveGrants: (grantsInactive as any[]).length,
      },
      maybeTruncated: {
        activeCustomers: (activeCustomers as any[]).length >= DASH_LIMITS.customersActive,
        inactiveCustomers: (inactiveCustomers as any[]).length >= DASH_LIMITS.customersInactive,
        activeEnrollments: (activeEnrollments as any[]).length >= DASH_LIMITS.enrollmentsActive,
        inactiveEnrollments: (inactiveEnrollments as any[]).length >= DASH_LIMITS.enrollmentsInactive,
        activeGrants: (grantsActive as any[]).length >= DASH_LIMITS.grantsActive,
        inactiveGrants: (grantsInactive as any[]).length >= DASH_LIMITS.grantsInactive,
      },
      warmupPending: warmup.isPending,
      warmupError: warmup.isError,
      warmupOk: warmup.data?.ok === true,
    }),
    [
      activeCustomers,
      inactiveCustomers,
      activeEnrollments,
      inactiveEnrollments,
      grantsActive,
      grantsInactive,
      warmup.isPending,
      warmup.isError,
      warmup.data?.ok,
    ]
  );

  return {
    customers,
    enrollments,
    grants,
    grantNameById,
    customerNameById,
    enrollmentsByCustomer,
    sharedDataLoading: warmup.isPending,
    sharedDataError: warmup.isError,
    sharedDataOk: warmup.data?.ok === true,
    metrics,
  };
}
