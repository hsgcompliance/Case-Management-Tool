// web/src/hooks/useEnrollments.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import EnrollmentsAPI, { type Enrollment } from "@client/enrollments";
import type {
  EnrollmentsUpsertReq,
  EnrollmentsPatchReq,
  EnrollmentsListQuery,
  EnrollmentsEnrollCustomerReq,
  EnrollmentsBulkEnrollReq,
  EnrollmentsCheckOverlapsReq,
  EnrollmentsCheckDualReq,
  EnrollmentsMigrateReq,
  EnrollmentsUndoMigrationReq,
  EnrollmentsAdminReverseLedgerEntryReq,
} from "@types";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import { useInvalidateMutation } from "./optimistic";

export const CUSTOMER_ENROLLMENTS_LIMIT = 800;
export const CUSTOMER_ENROLLMENTS_STALE_MS =
  typeof RQ_DEFAULTS.staleTime === "number" ? RQ_DEFAULTS.staleTime : 60_000;

export function customerEnrollmentsQueryKey(customerId?: string | null) {
  return qk.enrollments.byCustomer(String(customerId || "").trim(), {
    limit: CUSTOMER_ENROLLMENTS_LIMIT,
  });
}

function customerEnrollmentsQueryOptions(customerId?: string | null) {
  const normalizedCustomerId = String(customerId || "").trim();
  return {
    staleTime: CUSTOMER_ENROLLMENTS_STALE_MS,
    gcTime: RQ_DEFAULTS.gcTime,
    retry: RQ_DEFAULTS.retry,
    queryKey: customerEnrollmentsQueryKey(normalizedCustomerId),
    queryFn: () =>
      EnrollmentsAPI.list({
        customerId: normalizedCustomerId || undefined,
        limit: CUSTOMER_ENROLLMENTS_LIMIT,
      }),
  };
}

export function hasFreshCustomerEnrollmentsCache(
  qc: ReturnType<typeof useQueryClient>,
  customerId?: string | null,
): boolean {
  const normalizedCustomerId = String(customerId || "").trim();
  if (!normalizedCustomerId) return false;
  const queryKey = customerEnrollmentsQueryKey(normalizedCustomerId);
  const state = qc.getQueryState(queryKey);
  const data = qc.getQueryData<Enrollment[]>(queryKey);
  if (!Array.isArray(data) || !state?.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt < CUSTOMER_ENROLLMENTS_STALE_MS;
}

export function getStaleCustomerEnrollmentIds(
  qc: ReturnType<typeof useQueryClient>,
  customerIds: Iterable<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(
      Array.from(customerIds)
        .map((customerId) => String(customerId || "").trim())
        .filter(Boolean),
    ),
  ).filter((customerId) => !hasFreshCustomerEnrollmentsCache(qc, customerId));
}

export async function preloadCustomerEnrollments(
  qc: ReturnType<typeof useQueryClient>,
  customerIds: Iterable<string | null | undefined>,
  opts?: { batchSize?: number },
) {
  const requestedCustomerIds = Array.from(
    new Set(
      Array.from(customerIds)
        .map((customerId) => String(customerId || "").trim())
        .filter(Boolean),
    ),
  );
  const staleCustomerIds = getStaleCustomerEnrollmentIds(qc, requestedCustomerIds);
  const batchSize = Math.max(1, Number(opts?.batchSize || 8));
  let loadedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < staleCustomerIds.length; i += batchSize) {
    const batch = staleCustomerIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((customerId) => qc.fetchQuery(customerEnrollmentsQueryOptions(customerId))),
    );

    for (const result of results) {
      if (result.status === "fulfilled") loadedCount += 1;
      else failedCount += 1;
    }
  }

  return {
    requestedCount: requestedCustomerIds.length,
    fetchedCount: staleCustomerIds.length,
    loadedCount,
    failedCount,
    skippedCount: requestedCustomerIds.length - staleCustomerIds.length,
  };
}

export function usePreloadCustomerEnrollments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      customerIds: Iterable<string | null | undefined>;
      batchSize?: number;
    }) => preloadCustomerEnrollments(qc, args.customerIds, { batchSize: args.batchSize }),
  });
}

// Back-compat alias used by older call sites.
export function useEnrollments(query?: EnrollmentsListQuery, opts?: { enabled?: boolean }) {
  return useEnrollmentsList(query, opts);
}

/**
 * Returns the set of customer IDs enrolled in a given grant.
 * Used by the Customer page enrollment filter.
 */
export function useGrantEnrolledCustomerIds(grantId: string | undefined) {
  const safeId = String(grantId || "").trim();
  return useQuery<Set<string>>({
    queryKey: ["enrollments", "byGrant", safeId],
    enabled: !!safeId,
    queryFn: async () => {
      const enrollments = await EnrollmentsAPI.listAll({ grantId: safeId });
      const ids = new Set<string>();
      for (const e of enrollments) {
        const cid = String(e.customerId || "").trim();
        if (cid) ids.add(cid);
      }
      return ids;
    },
  });
}

export function useEnrollmentsList(query?: EnrollmentsListQuery, opts?: { enabled?: boolean }) {
  return useQuery<Enrollment[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    queryKey: qk.enrollments.list(query || {}),
    queryFn: () => EnrollmentsAPI.list(query),
  });
}

/** Convenience: enrollments for a customer */
export function useCustomerEnrollments(customerId?: string | null, opts?: { enabled?: boolean }) {
  const enabled = (opts?.enabled ?? true) && !!customerId;

  return useQuery<Enrollment[]>({
    ...RQ_DEFAULTS,
    ...customerEnrollmentsQueryOptions(customerId),
    enabled,
  });
}

export function useEnrollment(enrollmentId?: string | null, opts?: { enabled?: boolean }) {
  const enabled = (opts?.enabled ?? true) && !!enrollmentId;

  return useQuery<Enrollment | null>({
    ...RQ_DETAIL,
    enabled,
    queryKey: qk.enrollments.detail(enrollmentId || ""),
    queryFn: () => EnrollmentsAPI.getById(String(enrollmentId)),
  });
}

type EnrollmentPatchRowInput = {
  id: string;
  patch: Record<string, unknown>;
  unset: string[];
};

function toPatchRows(input: EnrollmentsPatchReq): EnrollmentPatchRowInput[] {
  const rows = Array.isArray(input) ? input : [input];
  return rows
    .map((row) => ({
      id: String((row as { id?: unknown })?.id || "").trim(),
      patch:
        row && typeof row === "object" && (row as { patch?: unknown }).patch && typeof (row as { patch?: unknown }).patch === "object"
          ? ({ ...((row as { patch?: Record<string, unknown> }).patch || {}) } as Record<string, unknown>)
          : {},
      unset: Array.isArray((row as { unset?: unknown[] })?.unset)
        ? ((row as { unset?: unknown[] }).unset || []).map((key) => String(key || "").trim()).filter(Boolean)
        : [],
    }))
    .filter((row) => row.id);
}

function applyPatchToEnrollment(
  prev: Enrollment | null | undefined,
  row: EnrollmentPatchRowInput,
): Enrollment | null | undefined {
  if (!prev || String(prev.id || "").trim() !== row.id) return prev;

  const next: Record<string, unknown> = {
    ...(prev as Record<string, unknown>),
    ...row.patch,
  };

  for (const key of row.unset) {
    delete next[key];
  }

  if (Object.prototype.hasOwnProperty.call(row.patch, "status") && !Object.prototype.hasOwnProperty.call(row.patch, "active")) {
    const status = String(row.patch.status || "").toLowerCase();
    next.active = status === "active";
    if (status === "deleted") next.deleted = true;
    if (status === "active" || status === "closed") next.deleted = false;
  }
  if (Object.prototype.hasOwnProperty.call(row.patch, "active") && !Object.prototype.hasOwnProperty.call(row.patch, "status")) {
    const active = Boolean(row.patch.active);
    next.status = active ? "active" : "closed";
    if (active) next.deleted = false;
  }

  return next as Enrollment;
}

function patchEnrollmentCaches(
  qc: ReturnType<typeof useQueryClient>,
  rows: EnrollmentPatchRowInput[],
) {
  if (!rows.length) return;
  const byId = new Map(rows.map((row) => [row.id, row]));

  qc.setQueriesData({ queryKey: qk.enrollments.root }, (old: unknown) => {
    if (!Array.isArray(old)) return old;
    return old.map((entry) => {
      const id = String((entry as { id?: unknown })?.id || "").trim();
      const row = byId.get(id);
      return row ? applyPatchToEnrollment(entry as Enrollment, row) ?? entry : entry;
    });
  });

  for (const row of rows) {
    qc.setQueryData(qk.enrollments.detail(row.id), (prev: Enrollment | null | undefined) =>
      applyPatchToEnrollment(prev, row) ?? prev,
    );
  }
}

function appendEnrollmentToCustomerCaches(
  qc: ReturnType<typeof useQueryClient>,
  row: Enrollment,
) {
  const customerId = String(row.customerId || "").trim();
  if (!customerId) return;

  qc.setQueryData(qk.enrollments.detail(String(row.id || "")), row);
  qc.setQueriesData({ queryKey: ["enrollments", "byCustomer", customerId] }, (old: unknown) => {
    if (!Array.isArray(old)) return old;
    if (old.some((entry) => String((entry as { id?: unknown })?.id || "").trim() === String(row.id || "").trim())) {
      return old.map((entry) =>
        String((entry as { id?: unknown })?.id || "").trim() === String(row.id || "").trim()
          ? { ...(entry as Record<string, unknown>), ...(row as Record<string, unknown>) }
          : entry,
      );
    }
    return [row, ...old];
  });
}

function removeEnrollmentCaches(
  qc: ReturnType<typeof useQueryClient>,
  ids: string[],
) {
  if (!ids.length) return;
  const idSet = new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
  if (!idSet.size) return;

  qc.setQueriesData({ queryKey: qk.enrollments.root }, (old: unknown) => {
    if (!Array.isArray(old)) return old;
    return old.filter((entry) => !idSet.has(String((entry as { id?: unknown })?.id || "").trim()));
  });

  for (const id of Array.from(idSet)) {
    qc.setQueryData(qk.enrollments.detail(id), null);
  }
}

function findCachedEnrollment(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
): Enrollment | null {
  const enrollmentId = String(id || "").trim();
  if (!enrollmentId) return null;

  const detail = qc.getQueryData<Enrollment | null>(qk.enrollments.detail(enrollmentId));
  if (detail && String(detail.id || "").trim() === enrollmentId) return detail;

  const cached = qc.getQueriesData({ queryKey: qk.enrollments.root });
  for (const [, value] of cached) {
    if (!Array.isArray(value)) continue;
    const found = value.find(
      (entry) => String((entry as { id?: unknown })?.id || "").trim() === enrollmentId,
    );
    if (found && typeof found === "object") return found as Enrollment;
  }

  return null;
}

function buildCreatedEnrollment(
  id: string,
  body: EnrollmentsEnrollCustomerReq,
): Enrollment {
  const extra =
    body && typeof body === "object" && body.extra && typeof body.extra === "object"
      ? ({ ...(body.extra as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const status = String(extra.status || (extra.active === false ? "closed" : "active")).toLowerCase();
  const active = typeof extra.active === "boolean" ? Boolean(extra.active) : status === "active";
  const deleted = typeof extra.deleted === "boolean" ? Boolean(extra.deleted) : status === "deleted";

  return {
    ...(extra as Record<string, unknown>),
    id,
    customerId: String(body.customerId || ""),
    grantId: String(body.grantId || ""),
    status,
    active,
    deleted,
  } as Enrollment;
}

async function invalidateEnrollmentQueries(
  qc: ReturnType<typeof useQueryClient>,
  args?: {
    enrollmentIds?: Iterable<string | null | undefined>;
    customerIds?: Iterable<string | null | undefined>;
    grantIds?: Iterable<string | null | undefined>;
  },
) {
  const enrollmentIds = new Set<string>();
  const customerIds = new Set<string>();
  const grantIds = new Set<string>();

  for (const rawId of Array.from(args?.enrollmentIds || [])) {
    const id = String(rawId || "").trim();
    if (!id) continue;
    enrollmentIds.add(id);
    const cached = findCachedEnrollment(qc, id);
    if (!cached) continue;
    const customerId = String(cached.customerId || "").trim();
    const grantId = String(cached.grantId || "").trim();
    if (customerId) customerIds.add(customerId);
    if (grantId) grantIds.add(grantId);
  }

  for (const rawCustomerId of Array.from(args?.customerIds || [])) {
    const customerId = String(rawCustomerId || "").trim();
    if (customerId) customerIds.add(customerId);
  }

  for (const rawGrantId of Array.from(args?.grantIds || [])) {
    const grantId = String(rawGrantId || "").trim();
    if (grantId) grantIds.add(grantId);
  }

  const work: Array<Promise<unknown>> = [
    qc.invalidateQueries({ queryKey: qk.enrollments.root }),
    qc.invalidateQueries({ queryKey: qk.customers.root }),
    qc.invalidateQueries({ queryKey: qk.grants.root }),
    qc.invalidateQueries({ queryKey: qk.inbox.root }),
  ];

  for (const id of Array.from(enrollmentIds)) {
    work.push(qc.invalidateQueries({ queryKey: qk.enrollments.detail(id) }));
  }
  for (const customerId of Array.from(customerIds)) {
    work.push(qc.invalidateQueries({ queryKey: ["enrollments", "byCustomer", customerId] }));
    work.push(qc.invalidateQueries({ queryKey: qk.customers.detail(customerId) }));
  }
  for (const grantId of Array.from(grantIds)) {
    work.push(qc.invalidateQueries({ queryKey: qk.grants.detail(grantId) }));
  }

  await Promise.all(work);
}

// ---------- mutations ----------

export function useEnrollmentsPatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: EnrollmentsPatchReq) => EnrollmentsAPI.patch(rows),
    onSuccess: async (_result: any, vars: EnrollmentsPatchReq) => {
      const rows = toPatchRows(vars);
      patchEnrollmentCaches(qc, rows);
      await invalidateEnrollmentQueries(qc, {
        enrollmentIds: rows.map((row) => row.id),
      });
    },
  });
}

export function useEnrollCustomer() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root],
    mutationFn: (body: EnrollmentsEnrollCustomerReq) => EnrollmentsAPI.enrollCustomer(body),
    onSuccess: async (result, body) => {
      const id = String((result as { id?: unknown })?.id || "").trim();
      if (id) {
        appendEnrollmentToCustomerCaches(qc, buildCreatedEnrollment(id, body));
      }
      await invalidateEnrollmentQueries(qc, {
        enrollmentIds: id ? [id] : [],
        customerIds: [String(body.customerId || "").trim()],
        grantIds: [String(body.grantId || "").trim()],
      });
    },
  });
}

export function useEnrollmentsBulkEnroll() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root],
    mutationFn: (body: EnrollmentsBulkEnrollReq) => EnrollmentsAPI.bulkEnroll(body),
    onSuccess: async (result, body) => {
      const enrollmentIds = Array.isArray((result as { results?: unknown[] })?.results)
        ? ((result as { results?: Array<{ enrollmentId?: unknown }> }).results || [])
            .map((item) => String(item?.enrollmentId || "").trim())
            .filter(Boolean)
        : [];
      const customerIds = Array.isArray((body as { customerIds?: unknown[] })?.customerIds)
        ? ((body as { customerIds?: unknown[] }).customerIds || [])
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        : [];
      await invalidateEnrollmentQueries(qc, {
        enrollmentIds,
        customerIds,
        grantIds: [String((body as { grantId?: unknown })?.grantId || "").trim()],
      });
    },
  });
}

export function useEnrollmentsDelete() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.inbox.root],
    mutationFn: (idOrIds: string | string[]) => EnrollmentsAPI.delete(idOrIds),
    onSuccess: async (result, idOrIds) => {
      const ids = new Set<string>();
      const requested = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      for (const id of requested) {
        const nextId = String(id || "").trim();
        if (nextId) ids.add(nextId);
      }
      if (Array.isArray((result as { results?: unknown[] })?.results)) {
        for (const item of (result as { results?: Array<{ id?: unknown }> }).results || []) {
          const nextId = String(item?.id || "").trim();
          if (nextId) ids.add(nextId);
        }
      }
      const allIds = Array.from(ids);
      removeEnrollmentCaches(qc, allIds);
      await invalidateEnrollmentQueries(qc, { enrollmentIds: allIds });
    },
  });
}

export function useEnrollmentsAdminDelete() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.inbox.root],
    mutationFn: (idOrIds: string | string[]) => EnrollmentsAPI.adminDelete(idOrIds),
    onSuccess: async (result, idOrIds) => {
      const ids = new Set<string>();
      const requested = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      for (const id of requested) {
        const nextId = String(id || "").trim();
        if (nextId) ids.add(nextId);
      }
      if (Array.isArray((result as { results?: unknown[] })?.results)) {
        for (const item of (result as { results?: Array<{ id?: unknown }> }).results || []) {
          const nextId = String(item?.id || "").trim();
          if (nextId) ids.add(nextId);
        }
      }
      const allIds = Array.from(ids);
      removeEnrollmentCaches(qc, allIds);
      await invalidateEnrollmentQueries(qc, { enrollmentIds: allIds });
    },
  });
}

export function useEnrollmentsCheckOverlaps() {
  return useMutation({
    mutationFn: (body: EnrollmentsCheckOverlapsReq) => EnrollmentsAPI.checkOverlaps(body),
  });
}

export function useEnrollmentsUpsert() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.inbox.root],
    mutationFn: (rows: EnrollmentsUpsertReq) => EnrollmentsAPI.upsert(rows),
    onSuccess: async (result) => {
      const ids = Array.isArray((result as { ids?: unknown[] })?.ids)
        ? ((result as { ids?: unknown[] }).ids || []).map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      await invalidateEnrollmentQueries(qc, { enrollmentIds: ids });
    },
  });
}

export function useEnrollmentsCheckDual() {
  return useMutation({
    mutationFn: (body: EnrollmentsCheckDualReq) => EnrollmentsAPI.checkDual(body),
  });
}

export function useEnrollmentsMigrate() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.inbox.root],
    mutationFn: (body: EnrollmentsMigrateReq) => EnrollmentsAPI.migrate(body),
    onSuccess: async (res, body) => {
      const result = res as {
        fromId?: unknown;
        toId?: unknown;
        fromGrantId?: unknown;
        toGrantId?: unknown;
      };
      const customerIdMaybe =
        (body as unknown as { customerId?: unknown; clientId?: unknown })?.customerId ??
        (body as unknown as { customerId?: unknown; clientId?: unknown })?.clientId;
      const customerId =
        typeof customerIdMaybe === "string" && customerIdMaybe.trim()
          ? customerIdMaybe.trim()
          : "";
      await invalidateEnrollmentQueries(qc, {
        enrollmentIds: [
          String(result.fromId || "").trim(),
          String(result.toId || "").trim(),
        ],
        customerIds: customerId ? [customerId] : [],
        grantIds: [
          String(result.fromGrantId || "").trim(),
          String(result.toGrantId || "").trim(),
        ],
      });
    },
  });
}

// Alias used by customer migration dialog orchestration.
export function useMigrateEnrollment() {
  return useEnrollmentsMigrate();
}

export function useEnrollmentsBackfillNames() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root],
    mutationFn: (body: Parameters<typeof EnrollmentsAPI.backfillNames>[0]) =>
      EnrollmentsAPI.backfillNames(body),
  });
}

export function useEnrollmentsBackfillPopulation() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root],
    mutationFn: (body?: Record<string, unknown>) => EnrollmentsAPI.backfillPopulation(body),
  });
}

export function useEnrollmentsUndoMigration() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root],
    mutationFn: (body: EnrollmentsUndoMigrationReq) => EnrollmentsAPI.undoMigration(body),
    onSuccess: async (result) => {
      const res = result as {
        fromEnrollmentId?: unknown;
        toEnrollmentId?: unknown;
        fromGrantId?: unknown;
        toGrantId?: unknown;
      };
      await invalidateEnrollmentQueries(qc, {
        enrollmentIds: [
          String(res.fromEnrollmentId || "").trim(),
          String(res.toEnrollmentId || "").trim(),
        ],
        grantIds: [
          String(res.fromGrantId || "").trim(),
          String(res.toGrantId || "").trim(),
        ],
      });
    },
  });
}

export function useEnrollmentsAdminReverseLedgerEntry() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root],
    mutationFn: (body: EnrollmentsAdminReverseLedgerEntryReq) =>
      EnrollmentsAPI.adminReverseLedgerEntry(body),
    onSuccess: async () => {
      await invalidateEnrollmentQueries(qc);
    },
  });
}
