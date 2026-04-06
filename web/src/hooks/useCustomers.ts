// src/hooks/useCustomers.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey, QueryClient } from "@tanstack/react-query";
import type { CustomersListResp } from "@types";

import CustomersAPI from "@client/customers";
import type {
  ReqOf,
  CustomersUpsertReq,
  CustomersUpsertResp,
  CustomersPatchReq,
  CustomersPatchResp,
  CustomersSoftDeleteResp,
  CustomersHardDeleteResp,
} from "@types";
import type { TCustomer as Customer } from "@types";
import { qk } from "./queryKeys";
import { useOptimisticMutation } from "@hooks/optimistic";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";

/* ------------------------- helpers ------------------------- */

function asArr<T>(v: T | T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function isDeletedLike(c: any) {
  const s = String(c?.status || "").toLowerCase();
  return !!c?.deleted || s === "deleted";
}

function isActiveLike(c: any) {
  if (typeof c?.active === "boolean") return c.active;
  const s = String(c?.status || "").toLowerCase();
  if (s === "active") return true;
  if (s === "inactive") return false;
  return true; // default-ish
}

function normalizeActiveFilter(v: any) {
  const s = String(v ?? "all").toLowerCase();
  if (["true", "1", "yes", "active"].includes(s)) return "true";
  if (["false", "0", "no", "inactive"].includes(s)) return "false";
  return "all";
}

function matchesListFilters(customer: any, filters: any) {
  const f = filters || {};

  // deleted filter
  const deletedMode = String(f.deleted ?? "exclude").toLowerCase();
  const del = isDeletedLike(customer);
  if (deletedMode === "exclude" && del) return false;
  if (deletedMode === "only" && !del) return false;
  // include => ok

  // active filter
  const af = normalizeActiveFilter(f.active);
  const act = isActiveLike(customer);
  if (af === "true" && !act) return false;
  if (af === "false" && act) return false;

  return true;
}

function bumpSystemMetricsCustomers(
  qc: QueryClient,
  delta: { total?: number; active?: number; inactive?: number },
) {
  qc.setQueryData(qk.metrics.system(), (prev: any) => {
    if (!prev?.customers) return prev;
    return {
      ...prev,
      customers: {
        total:    Math.max(0, (prev.customers.total    ?? 0) + (delta.total    ?? 0)),
        active:   Math.max(0, (prev.customers.active   ?? 0) + (delta.active   ?? 0)),
        inactive: Math.max(0, (prev.customers.inactive ?? 0) + (delta.inactive ?? 0)),
      },
    };
  });
}

function getAllCustomerListKeys(qc: QueryClient): QueryKey[] {
  return qc
    .getQueryCache()
    .findAll({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === "customers" &&
        q.queryKey[1] === "list",
    })
    .map((q) => q.queryKey as QueryKey);
}

function extractUpsertRows(resp: any, fallback: any): Customer[] {
  // Prefer server truth if it includes IDs and server-set fields.
  if (Array.isArray(resp)) return resp as Customer[];
  if (resp && typeof resp === "object") {
    if (Array.isArray(resp.items)) return resp.items as Customer[];
    if (Array.isArray(resp.customers)) return resp.customers as Customer[];
    if (Array.isArray(resp.rows)) return resp.rows as Customer[];
    if (Array.isArray(resp.data)) return resp.data as Customer[];
  }

  // Fallback: whatever the mutation was given (may not include ID for creates)
  const guess = asArr(fallback);
  return guess as Customer[];
}

function extractUpsertIds(resp: any): string[] {
  if (!resp || typeof resp !== "object") return [];
  if (Array.isArray(resp.ids)) return resp.ids.map((id: unknown) => String(id || "")).filter(Boolean);
  if (typeof resp.id === "string" && resp.id.trim()) return [resp.id.trim()];
  return [];
}

function attachIdsToFallbackRows(resp: any, fallback: any): Customer[] {
  const varsRows = asArr(fallback) as Array<Record<string, unknown>>;
  if (!varsRows.length) return [];

  const ids = extractUpsertIds(resp);
  if (!ids.length) return [];

  return varsRows
    .map((row, idx) => {
      const existingId = String(row?.id || "").trim();
      const id = existingId || String(ids[idx] || "").trim();
      if (!id) return null;
      return { ...row, id } as Customer;
    })
    .filter((row): row is Customer => !!row?.id);
}

function upsertIntoArray(arr: any[], row: any) {
  const id = row?.id;
  if (!id) return arr;

  const idx = arr.findIndex((x) => x?.id === id);
  if (idx >= 0) {
    const next = arr.slice();
    next[idx] = { ...(arr[idx] || {}), ...(row || {}) };
    return next;
  }
  // insert new at top (keeps UX snappy; server will later re-sort on refetch if needed)
  return [row, ...arr];
}

function applyUpsertToLists(qc: QueryClient, rows: Customer[]) {
  const keys = getAllCustomerListKeys(qc);

  keys.forEach((key) => {
    const filters = Array.isArray(key) ? (key as any[])[2] : undefined;

    qc.setQueryData(key, (prev: any) => {
      const arr = Array.isArray(prev)
        ? prev
        : Array.isArray(prev?.items)
          ? prev.items
          : null;

      if (!arr) return prev;

      let nextArr = arr.slice();

      for (const row of rows) {
        if (!row?.id) continue;

        const existsIdx = nextArr.findIndex((x: any) => x?.id === row.id);
        const shouldBeHere = matchesListFilters(row, filters);

        if (existsIdx >= 0) {
          if (!shouldBeHere) {
            nextArr = nextArr.filter((x: any) => x?.id !== row.id);
          } else {
            nextArr = nextArr.map((x: any) =>
              x?.id === row.id ? { ...(x || {}), ...(row || {}) } : x
            );
          }
        } else {
          if (shouldBeHere) nextArr = upsertIntoArray(nextArr, row);
        }
      }

      return Array.isArray(prev) ? nextArr : { ...prev, items: nextArr };
    });
  });
}

/* ------------------------- hooks ------------------------- */

/** List */
export function useCustomers(
  filters?: {
    limit?: number | string;
    active?:
      | "all"
      | "true"
      | "false"
      | "1"
      | "0"
      | "yes"
      | "no"
      | "active"
      | "inactive";
    deleted?: "exclude" | "only" | "include";
    cursorUpdatedAt?: number | string | { seconds: number; nanoseconds: number };
    cursorId?: string;
    caseManagerId?: string;
    contactCaseManagerId?: string;
  },
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = opts?.enabled ?? true;

  return useQuery<Customer[]>({
    enabled,
    queryKey: qk.customers.list(filters),
    queryFn: () => CustomersAPI.list(filters),
    // accept either array or { items, next }
    select: (raw: unknown) => {
      if (Array.isArray(raw)) return raw as Customer[];
      if (raw && typeof raw === "object" && Array.isArray((raw as any).items)) {
        return (raw as any).items as Customer[];
      }
      return [] as Customer[];
    },
    ...RQ_DEFAULTS,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
  });
}

/** Detail */
export function useCustomer(id?: string, opts?: { enabled?: boolean; staleTime?: number }) {
  const enabled = (opts?.enabled ?? true) && !!id;

  return useQuery<Customer | null>({
    enabled,
    queryKey: id ? qk.customers.detail(id) : qk.customers.detailNoop(),
    queryFn: () => (id ? CustomersAPI.get(id) : Promise.resolve(null)),
    ...RQ_DETAIL,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
  });
}

/** Full list across pages (guarded) for accurate in-memory filtering/counts. */
export function useCustomersAll(
  filters?: {
    active?:
      | "all"
      | "true"
      | "false"
      | "1"
      | "0"
      | "yes"
      | "no"
      | "active"
      | "inactive";
    deleted?: "exclude" | "only" | "include";
    caseManagerId?: string;
    contactCaseManagerId?: string;
  },
  opts?: { enabled?: boolean; staleTime?: number; maxPages?: number; maxItems?: number }
) {
  const enabled = opts?.enabled ?? true;

  return useQuery<Customer[]>({
    enabled,
    queryKey: [...qk.customers.list(filters), "all-pages", opts?.maxPages ?? 200, opts?.maxItems ?? 50_000],
    queryFn: () =>
      CustomersAPI.listAll(filters, {
        maxPages: opts?.maxPages,
        maxItems: opts?.maxItems,
      }),
    ...RQ_DEFAULTS,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
  });
}

/** Upsert — surgical cache updates (detail + all list caches) */
export function useUpsertCustomers() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (rows: CustomersUpsertReq) =>
      CustomersAPI.upsert(rows) as Promise<CustomersUpsertResp>,
    onSuccess: (resp, vars) => {
      const rows = [
        ...extractUpsertRows(resp, vars),
        ...attachIdsToFallbackRows(resp, vars),
      ].filter((r: any) => !!r?.id).filter((row, idx, arr) => arr.findIndex((x: any) => x?.id === row.id) === idx);

      // Detect net-new creates BEFORE detail caches are populated
      const newRows = rows.filter((r) => r?.id && !qc.getQueryData(qk.customers.detail(r.id!)));

      // Update detail caches
      for (const row of rows) {
        qc.setQueryData(qk.customers.detail(row.id!), (prev: any) =>
          prev ? { ...prev, ...row } : row
        );
      }

      // Update all cached lists (respecting filters)
      applyUpsertToLists(qc, rows);

      // If we couldn't confidently extract rows, fall back to revalidate.
      if (!rows.length) qc.invalidateQueries({ queryKey: qk.customers.root });

      // Bump system metrics for genuinely new customers
      if (newRows.length > 0) {
        const activeNew = newRows.filter((r) => isActiveLike(r)).length;
        bumpSystemMetricsCustomers(qc, {
          total:    newRows.length,
          active:   activeNew,
          inactive: newRows.length - activeNew,
        });
      }
    },
  });
}

/** Patch — optimistic: detail + all list caches; mirror status/active coupling */
export function usePatchCustomers() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    (rows: CustomersPatchReq) => CustomersAPI.patch(rows) as Promise<CustomersPatchResp>,
    {
      makePatches: (rows, qc) => {
        const updates = (Array.isArray(rows) ? rows : [rows]).filter((r) => !!r?.id);

        const couple = (c: any, patch: any) => {
          const next = { ...c, ...(patch || {}) };
          if ("status" in (patch || {}) && !("active" in (patch || {}))) {
            next.active = patch.status === "active";
          }
          if ("active" in (patch || {}) && !("status" in (patch || {}))) {
            next.status = patch.active ? "active" : "inactive";
          }
          if (next.status === "deleted") {
            next.deleted = true;
            next.active = false;
          }
          return next;
        };

        // detail patches
        const detailPatches = updates.map((u) => ({
          key: qk.customers.detail(u.id!),
          update: (prev: any) => (prev ? couple(prev, u.patch) : prev),
        }));

        // list patches (for every cached list)
        const listKeys = getAllCustomerListKeys(qc);

        const listPatches = listKeys.map((key) => ({
          key,
          update: (prev: any) => {
            const arr = Array.isArray(prev)
              ? prev
              : Array.isArray(prev?.items)
                ? prev.items
                : null;
            if (!arr) return prev;

            const filters = Array.isArray(key) ? (key as any[])[2] : undefined;

            let nextArr = arr.slice();
            for (const u of updates) {
              const id = u.id!;
              const idx = nextArr.findIndex((c: any) => c?.id === id);
              if (idx < 0) continue;

              const nextRow = couple(nextArr[idx], u.patch);
              const keep = matchesListFilters(nextRow, filters);

              if (!keep) {
                nextArr = nextArr.filter((c: any) => c?.id !== id);
              } else {
                nextArr[idx] = nextRow;
              }
            }

            return Array.isArray(prev) ? nextArr : { ...prev, items: nextArr };
          },
        }));

        return [...detailPatches, ...listPatches];
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } }
  );
}

/** Soft delete — optimistic: remove from lists, mark detail deleted */
export function useSoftDeleteCustomers() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    (ids: string | string[]) => CustomersAPI.delete(ids) as Promise<CustomersSoftDeleteResp>,
    {
      makePatches: (ids) => {
        const arr = Array.isArray(ids) ? ids : [ids];

        // Count currently-active customers so we can shift them to inactive in metrics
        const activeCount = arr.filter((id) => isActiveLike(qc.getQueryData(qk.customers.detail(id)))).length;

        const listKeys = getAllCustomerListKeys(qc);

        const listPatches = listKeys.map((key) => ({
          key,
          update: (prev: any) =>
            Array.isArray(prev)
              ? prev.filter((c: any) => !arr.includes(c?.id))
              : Array.isArray(prev?.items)
                ? { ...prev, items: prev.items.filter((c: any) => !arr.includes(c?.id)) }
                : prev,
        }));

        const detailPatches = arr.map((id) => ({
          key: qk.customers.detail(id),
          update: (prev: any) =>
            prev ? { ...prev, status: "deleted", deleted: true, active: false } : prev,
        }));

        // Soft delete keeps total the same — deleted customers still exist (just inactive)
        const metricsPatch = {
          key: qk.metrics.system(),
          update: (prev: any) => {
            if (!prev?.customers) return prev;
            return {
              ...prev,
              customers: {
                ...prev.customers,
                active:   Math.max(0, (prev.customers.active   ?? 0) - activeCount),
                inactive: Math.max(0, (prev.customers.inactive ?? 0) + activeCount),
              },
            };
          },
        };

        return [...listPatches, ...detailPatches, metricsPatch];
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } }
  );
}

/** Hard delete — optimistic: drop from lists + clear detail caches */
export function useHardDeleteCustomers() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    (ids: string | string[]) => CustomersAPI.adminDelete(ids) as Promise<CustomersHardDeleteResp>,
    {
      makePatches: (ids) => {
        const arr = Array.isArray(ids) ? ids : [ids];

        // Count active vs inactive before removal for accurate metrics delta
        const activeCount = arr.filter((id) => isActiveLike(qc.getQueryData(qk.customers.detail(id)))).length;
        const inactiveCount = arr.length - activeCount;

        const listKeys = getAllCustomerListKeys(qc);

        const listPatches = listKeys.map((key) => ({
          key,
          update: (prev: any) =>
            Array.isArray(prev)
              ? prev.filter((c: any) => !arr.includes(c?.id))
              : Array.isArray(prev?.items)
                ? { ...prev, items: prev.items.filter((c: any) => !arr.includes(c?.id)) }
                : prev,
        }));

        const detailPatches = arr.map((id) => ({
          key: qk.customers.detail(id),
          update: (_prev: any) => undefined,
        }));

        // Hard delete removes the customer entirely — decrement all buckets
        const metricsPatch = {
          key: qk.metrics.system(),
          update: (prev: any) => {
            if (!prev?.customers) return prev;
            return {
              ...prev,
              customers: {
                total:    Math.max(0, (prev.customers.total    ?? 0) - arr.length),
                active:   Math.max(0, (prev.customers.active   ?? 0) - activeCount),
                inactive: Math.max(0, (prev.customers.inactive ?? 0) - inactiveCount),
              },
            };
          },
        };

        return [...listPatches, ...detailPatches, metricsPatch];
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } }
  );
}

/** Toggle active — optimistic detail + list caches */
export function useSetCustomerActive() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    ({ id, active }: { id: string; active: boolean }) =>
      CustomersAPI.patch({ id, patch: { active, status: active ? "active" : "inactive" } }),
    {
      makePatches: ({ id, active }, qc) => {
        const rowPatch = { active, status: active ? "active" : "inactive", deleted: false };

        const detail = {
          key: qk.customers.detail(id),
          update: (prev: any) => (prev ? { ...prev, ...rowPatch } : prev),
        };

        const lists = getAllCustomerListKeys(qc).map((key) => ({
          key,
          update: (prev: any) => {
            const arr = Array.isArray(prev)
              ? prev
              : Array.isArray(prev?.items)
                ? prev.items
                : null;
            if (!arr) return prev;

            const filters = Array.isArray(key) ? (key as any[])[2] : undefined;

            const idx = arr.findIndex((c: any) => c?.id === id);
            if (idx < 0) return prev;

            const nextRow = { ...(arr[idx] || {}), ...rowPatch };
            const keep = matchesListFilters(nextRow, filters);

            const nextArr = keep
              ? arr.map((c: any) => (c?.id === id ? nextRow : c))
              : arr.filter((c: any) => c?.id !== id);

            return Array.isArray(prev) ? nextArr : { ...prev, items: nextArr };
          },
        }));

        return [detail, ...lists];
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } }
  );
}

/** Convenience: customers scoped to a single CM, lazy-loadable. */
export function useCmCustomers(cmUid: string, opts?: { enabled?: boolean }) {
  return useCustomers(
    { caseManagerId: cmUid, active: "true", deleted: "exclude", limit: 200 },
    { enabled: (opts?.enabled ?? true) && !!cmUid }
  );
}

/** Customers where a CM is either the primary or secondary contact. */
export function useCmContactCustomers(cmUid: string, opts?: { enabled?: boolean }) {
  return useCustomers(
    { contactCaseManagerId: cmUid, active: "true", deleted: "exclude", limit: 200 },
    { enabled: (opts?.enabled ?? true) && !!cmUid }
  );
}

/** Set case manager — optimistic detail + list caches */
export function useSetCustomerCaseManager() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    ({
      id,
      caseManagerId,
      caseManagerName,
    }: {
      id: string | null | undefined;
      caseManagerId: string | null;
      caseManagerName?: string | null;
    }) =>
      CustomersAPI.patch({
        id: id!,
        patch: { caseManagerId, caseManagerName: caseManagerName ?? null },
      }),
    {
      makePatches: ({ id, caseManagerId, caseManagerName }, qc) => {
        const rowPatch = {
          caseManagerId: caseManagerId ?? null,
          caseManagerName: caseManagerName ?? null,
        };

        const detail = {
          key: qk.customers.detail(id!),
          update: (prev: any) =>
            prev
              ? {
                  ...prev,
                  ...rowPatch,
                  caseManagerName: rowPatch.caseManagerName ?? prev.caseManagerName ?? null,
                }
              : prev,
        };

        const lists = getAllCustomerListKeys(qc).map((key) => ({
          key,
          update: (prev: any) => {
            const arr = Array.isArray(prev)
              ? prev
              : Array.isArray(prev?.items)
                ? prev.items
                : null;
            if (!arr) return prev;

            const idx = arr.findIndex((c: any) => c?.id === id);
            if (idx < 0) return prev;

            const nextArr = arr.map((c: any) =>
              c?.id === id
                ? {
                    ...(c || {}),
                    ...rowPatch,
                    caseManagerName: rowPatch.caseManagerName ?? c?.caseManagerName ?? null,
                  }
                : c
            );

            return Array.isArray(prev) ? nextArr : { ...prev, items: nextArr };
          },
        }));

        return [detail, ...lists];
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } }
  );
}

/** Set secondary case manager/contact. */
export function useSetCustomerSecondaryCaseManager() {
  const qc = useQueryClient();

  return useOptimisticMutation(
    ({
      id,
      secondaryCaseManagerId,
      secondaryCaseManagerName,
    }: {
      id: string | null | undefined;
      secondaryCaseManagerId: string | null;
      secondaryCaseManagerName?: string | null;
    }) =>
      CustomersAPI.patch({
        id: id!,
        patch: {
          secondaryCaseManagerId,
          secondaryCaseManagerName: secondaryCaseManagerName ?? null,
        } as Record<string, unknown>,
      }),
    {
      makePatches: ({ id, secondaryCaseManagerId, secondaryCaseManagerName }, qc) => {
        const rowPatch = {
          secondaryCaseManagerId: secondaryCaseManagerId ?? null,
          secondaryCaseManagerName: secondaryCaseManagerName ?? null,
        };

        const detail = {
          key: qk.customers.detail(id!),
          update: (prev: any) =>
            prev
              ? {
                  ...prev,
                  ...rowPatch,
                  secondaryCaseManagerName:
                    rowPatch.secondaryCaseManagerName ?? prev.secondaryCaseManagerName ?? null,
                }
              : prev,
        };

        const lists = getAllCustomerListKeys(qc).map((key) => ({
          key,
          update: (prev: any) => {
            const arr = Array.isArray(prev)
              ? prev
              : Array.isArray(prev?.items)
                ? prev.items
                : null;
            if (!arr) return prev;

            const idx = arr.findIndex((c: any) => c?.id === id);
            if (idx < 0) return prev;

            const nextArr = arr.map((c: any) =>
              c?.id === id
                ? {
                    ...(c || {}),
                    ...rowPatch,
                    secondaryCaseManagerName:
                      rowPatch.secondaryCaseManagerName ?? c?.secondaryCaseManagerName ?? null,
                  }
                : c
            );

            return Array.isArray(prev) ? nextArr : { ...prev, items: nextArr };
          },
        }));

        return [detail, ...lists];
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } }
  );
}

export function useCustomersBackfillNames() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"customersBackfillNames">) => CustomersAPI.backfillNames(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.customers.root });
    },
  });
}

export function useCustomersBackfillCaseManagerNames() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"customersBackfillCaseManagerNames">) =>
      CustomersAPI.backfillCaseManagerNames(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.customers.root });
      await qc.invalidateQueries({ queryKey: qk.users.root });
    },
  });
}

export function useCustomersBackfillAssistanceLength() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"customersBackfillAssistanceLength">) =>
      CustomersAPI.backfillAssistanceLength(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.customers.root });
    },
  });
}
