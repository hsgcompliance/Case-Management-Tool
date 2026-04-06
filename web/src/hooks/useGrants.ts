// src/hooks/useGrants.ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "./queryKeys";
import { Grants } from "@client/grants";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import type { GrantsListQuery, GrantsUpsertReq, GrantsPatchReq } from "@types";
import { useOptimisticMutation } from "./optimistic";
import { useInvalidateMutation } from "./optimistic";

export function useGrants(
  filters?: GrantsListQuery,
  opts?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.grants.list(filters || {}),
    queryFn: async () => Grants.list(filters),
  });
}

export function useGrant(
  id?: string,
  opts?: { enabled?: boolean; staleTime?: number },
) {
  const normalizedId = String(id || "").trim();
  const isReservedRouteId =
    normalizedId === "new" ||
    (normalizedId.startsWith("(") && normalizedId.toLowerCase().endsWith(")new"));
  const shouldFetch = (opts?.enabled ?? true) && !!normalizedId && !isReservedRouteId;
  return useQuery({
    ...RQ_DETAIL,
    enabled: shouldFetch,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
    queryKey: qk.grants.detail(id ?? "__none__"),
    queryFn: async () => Grants.get(id!),
  });
}

export function useFetchGrantById() {
  const qc = useQueryClient();
  return async (id: string) =>
    qc.fetchQuery({
      ...RQ_DETAIL,
      queryKey: qk.grants.detail(id),
      queryFn: () => Grants.get(id),
    });
}

export function useGrantsStructure() {
  return useQuery({
    queryKey: qk.grants.structure(),
    queryFn: Grants.structure,
    ...RQ_DEFAULTS,
  });
}

export function useGrantsActivity(grantId: string, limit = 1000) {
  return useQuery({
    enabled: !!grantId,
    queryKey: qk.grants.activity(grantId, limit),
    queryFn: () => Grants.activity({ grantId, limit }),
    ...RQ_DEFAULTS,
  });
}
// Alias used by ActivityTab
export const useGrantActivity = useGrantsActivity;

export function useUpsertGrants() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.grants.root],
    mutationFn: (rows: GrantsUpsertReq) => Grants.upsert(rows),
    onSuccess: (_resp, vars) => {
      // Detect net-new grants: input rows without an existing id in the detail cache
      const inputRows = Array.isArray(vars) ? vars : [vars];
      const newCount = inputRows.filter((r: any) => {
        const id = String(r?.id || "").trim();
        return !id || !qc.getQueryData(qk.grants.detail(id));
      }).length;
      if (newCount > 0) {
        qc.setQueryData(qk.metrics.system(), (prev: any) => {
          if (!prev?.grants) return prev;
          return {
            ...prev,
            grants: {
              ...prev.grants,
              total:  (prev.grants.total  ?? 0) + newCount,
              active: (prev.grants.active ?? 0) + newCount,
            },
          };
        });
      }
    },
  });
}

/** Optimistic patch of grant detail caches (hooks only touch cache; network via API wrapper) */
export function usePatchGrants() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    (rows: GrantsPatchReq) => Grants.patch(rows),
    {
      makePatches: (rows) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        return arr
          .filter((r) => !!r?.id)
          .map((r) => ({
            key: qk.grants.detail(r.id!),
            update: (prev: unknown) => {
              if (!prev) return prev;
              const patch = r.patch || {};
              const prevObj = prev as Record<string, unknown>;
              const next: Record<string, unknown> = { ...prevObj, ...patch };
              if ("status" in patch) {
                next.active = patch.status === "active";
                next.deleted = patch.status === "deleted";
              }
              return next;
            },
          }));
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } },
  );
}

const ensureIds = (idOrIds: string | string[]) =>
  Array.isArray(idOrIds) ? idOrIds : [idOrIds];

/** Optimistic soft delete: remove from lists, mark detail as deleted */
export function useDeleteGrants() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    (idOrIds: string | string[]) => Grants.delete(idOrIds),
    {
      makePatches: (idOrIds, qcInstance) => {
        const ids = ensureIds(idOrIds);
        const listKeys = qcInstance
          .getQueriesData({ queryKey: qk.grants.root })
          .map(([key]) => key as unknown[])
          .filter(
            (key) =>
              Array.isArray(key) &&
              key[0] === qk.grants.root[0] &&
              key[1] === "list",
          );

        return [
          ...listKeys.map((key) => ({
            key,
            update: (prev: unknown) => {
              if (!prev) return prev;
              if (Array.isArray(prev)) {
                return prev.filter(
                  (g) =>
                    !ids.includes(String((g as { id?: unknown })?.id ?? "")),
                );
              }
              const prevObj = prev as { items?: unknown[] };
              if (Array.isArray(prevObj.items)) {
                return {
                  ...(prev as Record<string, unknown>),
                  items: prevObj.items.filter(
                    (g) =>
                      !ids.includes(String((g as { id?: unknown })?.id ?? "")),
                  ),
                };
              }
              return prev;
            },
          })),
          ...ids.map((id) => ({
            key: qk.grants.detail(id),
            update: (prev: unknown) =>
              prev
                ? {
                    ...(prev as Record<string, unknown>),
                    status: "deleted",
                    active: false,
                    deleted: true,
                  }
                : prev,
          })),
          // Metrics: soft delete keeps total but shifts active → inactive
          {
            key: qk.metrics.system(),
            update: (prev: any) => {
              if (!prev?.grants) return prev;
              const activeCount = ids.filter((id) => {
                const g: any = qcInstance.getQueryData(qk.grants.detail(id));
                return g?.active === true || String(g?.status || "").toLowerCase() === "active";
              }).length;
              return {
                ...prev,
                grants: {
                  ...prev.grants,
                  active:   Math.max(0, (prev.grants.active   ?? 0) - activeCount),
                  inactive: Math.max(0, (prev.grants.inactive ?? 0) + activeCount),
                },
              };
            },
          },
        ];
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } },
  );
}

/** Optimistic hard delete: remove from lists, drop detail caches */
export function useAdminDeleteGrants() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    (idOrIds: string | string[]) => Grants.adminDelete(idOrIds),
    {
      makePatches: (idOrIds, qcInstance) => {
        const ids = ensureIds(idOrIds);
        const listKeys = qcInstance
          .getQueriesData({ queryKey: qk.grants.root })
          .map(([key]) => key as unknown[])
          .filter(
            (key) =>
              Array.isArray(key) &&
              key[0] === qk.grants.root[0] &&
              key[1] === "list",
          );

        return [
          ...listKeys.map((key) => ({
            key,
            update: (prev: unknown) => {
              if (!prev) return prev;
              if (Array.isArray(prev)) {
                return prev.filter(
                  (g) =>
                    !ids.includes(String((g as { id?: unknown })?.id ?? "")),
                );
              }
              const prevObj = prev as { items?: unknown[] };
              if (Array.isArray(prevObj.items)) {
                return {
                  ...(prev as Record<string, unknown>),
                  items: prevObj.items.filter(
                    (g) =>
                      !ids.includes(String((g as { id?: unknown })?.id ?? "")),
                  ),
                };
              }
              return prev;
            },
          })),
          ...ids.map((id) => ({
            key: qk.grants.detail(id),
            update: () => undefined,
          })),
        ];
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } },
  );
}
