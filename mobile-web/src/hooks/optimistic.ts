// mobile-web/src/hooks/optimistic.ts
// Optimistic mutation helpers — ported exactly from web/src/hooks/optimistic.ts.
// Works with direct Firestore mutations (no HTTP client needed).

import { QueryClient, useMutation, UseMutationOptions } from "@tanstack/react-query";

export type Patch = {
  /** A concrete queryKey (array). */
  key: unknown[] | ReadonlyArray<unknown> | ReadonlyArray<unknown>[];
  /** Apply your optimistic change based on the previous cache data. */
  update: (prev: any) => any;
  /** Optional: cancel queries for this key before patching (default true). */
  cancel?: boolean;
};

export type OptimisticPlan<TVars> = {
  /** Build the list of patches to apply optimistically. */
  makePatches: (vars: TVars, qc: QueryClient) => Patch[];
  /** Keys to bust after success (usually unnecessary when mutations update cache optimistically). */
  invalidateOnSuccess?: unknown[][];
  /** Delayed re-validation for async Firestore triggers (e.g. 4000ms). 0 = disabled. */
  revalidateAfterMs?: number;
  /** Hook run after success and before any invalidation. */
  afterSuccess?: (data: unknown, vars: TVars, qc: QueryClient) => Promise<void> | void;
};

type CtxSnapshot = Array<{ key: unknown[]; data: unknown }>;

type InvalidateMutationCtx = {
  snapshots: Array<{ key: unknown[]; data: unknown }>;
};

type InvalidateMutationConfig<TData, TVars> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  queryClient: QueryClient;
  queryKeys?: Array<unknown[] | ReadonlyArray<unknown>>;
  optimisticPatches?: (vars: TVars, qc: QueryClient) => Patch[];
  revalidateAfterMs?: number;
  onSuccess?: (data: TData, vars: TVars, qc: QueryClient) => Promise<void> | void;
  onError?: (err: unknown, vars: TVars, qc: QueryClient) => Promise<void> | void;
};

function normalizePatchKeys(key: Patch["key"]): unknown[][] {
  if (!Array.isArray(key)) return [];
  const looksLikeMulti = key.length > 0 && key.every((part) => Array.isArray(part));
  if (looksLikeMulti) {
    return (key as ReadonlyArray<ReadonlyArray<unknown>>).map((k) => Array.from(k));
  }
  return [Array.from(key as ReadonlyArray<unknown>)];
}

/** Global QueryClient reference — set via attachGlobalQueryClient in main setup. */
export function attachGlobalQueryClient(qc: QueryClient) {
  (globalThis as any).__REACT_QUERY_CLIENT__ = qc;
}

function getGlobalQC(meta?: unknown): QueryClient | null {
  return ((meta as any)?.queryClient as QueryClient) ??
    (globalThis as any).__REACT_QUERY_CLIENT__ ??
    null;
}

/**
 * Declarative optimistic mutation with automatic snapshot + rollback.
 *
 * Usage:
 * ```ts
 * useOptimisticMutation(
 *   (vars) => updateDoc(ref, vars),
 *   {
 *     makePatches: (vars, qc) => [
 *       { key: qk.cmActivities.feed(uid), update: (prev) => { ... } },
 *     ],
 *     revalidateAfterMs: 3000, // re-fetch after Firestore trigger settles
 *   }
 * )
 * ```
 */
export function useOptimisticMutation<TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  plan: OptimisticPlan<TVars>,
  options?: Omit<
    UseMutationOptions<TData, unknown, TVars, CtxSnapshot>,
    "mutationFn" | "onMutate" | "onError" | "onSuccess" | "onSettled"
  >,
) {
  return useMutation<TData, unknown, TVars, CtxSnapshot>({
    mutationFn,
    async onMutate(vars) {
      const qc = getGlobalQC(options?.meta);
      if (!qc) return [];

      const patches = plan.makePatches(vars, qc) || [];
      const ctx: CtxSnapshot = [];

      for (const p of patches) {
        for (const key of normalizePatchKeys(p.key)) {
          if (p.cancel !== false) await qc.cancelQueries({ queryKey: key });
          const before = qc.getQueryData(key);
          ctx.push({ key, data: before });
          qc.setQueryData(key, p.update(before));
        }
      }
      return ctx;
    },
    onError(_e, _vars, ctx) {
      const qc = getGlobalQC(options?.meta);
      if (!qc || !ctx) return;
      for (const { key, data } of ctx) qc.setQueryData(key, data);
    },
    async onSuccess(_data, _vars, ctx) {
      const qc = getGlobalQC(options?.meta);
      if (!qc) return;

      if (plan.afterSuccess) await plan.afterSuccess(_data, _vars, qc);

      if (plan.invalidateOnSuccess?.length) {
        for (const key of plan.invalidateOnSuccess) qc.invalidateQueries({ queryKey: key });
      }

      const delay = plan.revalidateAfterMs ?? 0;
      if (delay > 0 && ctx?.length) {
        setTimeout(() => {
          for (const { key } of ctx) qc.invalidateQueries({ queryKey: key });
        }, delay);
      }
    },
    ...options,
  });
}

/**
 * Snapshot + invalidate pattern — simpler than optimistic when the UI can
 * tolerate a brief loading state after the mutation.
 */
export function useInvalidateMutation<TData, TVars>(
  config: InvalidateMutationConfig<TData, TVars>,
) {
  const { mutationFn, queryClient: qc, queryKeys = [], optimisticPatches, revalidateAfterMs = 0, onSuccess, onError } = config;

  return useMutation<TData, unknown, TVars, InvalidateMutationCtx>({
    mutationFn,
    async onMutate(vars) {
      const snapshots: Array<{ key: unknown[]; data: unknown }> = [];
      const uniqKeys = Array.from(
        new Set(queryKeys.map((k) => JSON.stringify(k))),
      ).map((k) => JSON.parse(k) as unknown[]);

      for (const key of uniqKeys) {
        await qc.cancelQueries({ queryKey: key });
        snapshots.push({ key, data: qc.getQueryData(key) });
      }

      const patches = optimisticPatches?.(vars, qc) || [];
      for (const p of patches) {
        for (const key of normalizePatchKeys(p.key)) {
          await qc.cancelQueries({ queryKey: key });
          snapshots.push({ key, data: qc.getQueryData(key) });
          qc.setQueryData(key, p.update(qc.getQueryData(key)));
        }
      }
      return { snapshots };
    },
    async onError(err, vars, ctx) {
      for (const snap of ctx?.snapshots || []) qc.setQueryData(snap.key, snap.data);
      await onError?.(err, vars, qc);
    },
    async onSuccess(data, vars) {
      for (const key of queryKeys) await qc.invalidateQueries({ queryKey: key as unknown[] });
      await onSuccess?.(data, vars, qc);
      if (revalidateAfterMs > 0 && queryKeys.length) {
        setTimeout(() => {
          for (const key of queryKeys) void qc.invalidateQueries({ queryKey: key as unknown[] });
        }, revalidateAfterMs);
      }
    },
  });
}
