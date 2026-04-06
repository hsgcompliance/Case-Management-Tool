// src/hooks/optimistic.ts
import { QueryClient, useMutation, UseMutationOptions } from '@tanstack/react-query';

export type Patch = {
  /** A concrete queryKey (array). */
  key: unknown[] | ReadonlyArray<unknown> | ReadonlyArray<unknown>[];
  /** Apply your optimistic change based on the previous cache data. */
  update: (prev: any) => any;
  /** Optional: cancel queries for this key before patching (default true). */
  cancel?: boolean;
};

export type OptimisticPlan<TVars> = {
  /**
   * Build the list of patches to apply optimistically for these variables.
   * You can inspect the query cache as needed.
   */
  makePatches: (vars: TVars, qc: QueryClient) => Patch[];
  /**
   * If you still want to bust caches after success (usually unnecessary when
   * server triggers mirror your optimistic changes), provide keys here.
   */
  invalidateOnSuccess?: unknown[][];
  /**
   * If you want to re-validate eventually (e.g., background consistency), set a delay.
   * 0 disables. Default: 0.
   */
  revalidateAfterMs?: number;
  /**
   * Optional hook to run after a successful mutation and before any invalidate/revalidate.
   * Useful for token refresh flows where subsequent refetches depend on fresh auth.
   */
  afterSuccess?: (data: unknown, vars: TVars, qc: QueryClient) => Promise<void> | void;
};

type CtxSnapshot = Array<{ key: unknown[]; data: unknown }>;

type InvalidateMutationCtx = {
  snapshots: Array<{ key: unknown[]; data: unknown }>;
};

type InvalidateMutationConfig<TData, TVars> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  queryClient: QueryClient;
  /**
   * Query roots/keys to snapshot + cancel before mutate and invalidate on success.
   */
  queryKeys?: Array<unknown[] | ReadonlyArray<unknown>>;
  /**
   * Optional optimistic cache updates (applied after snapshots).
   */
  optimisticPatches?: (vars: TVars, qc: QueryClient) => Patch[];
  /**
   * Optional delayed revalidate after success to account for async backend projections/triggers.
   */
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

export function useOptimisticMutation<TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  plan: OptimisticPlan<TVars>,
  options?: Omit<UseMutationOptions<TData, unknown, TVars, CtxSnapshot>, 'mutationFn' | 'onMutate' | 'onError' | 'onSuccess' | 'onSettled'>
) {
  return useMutation<TData, unknown, TVars, CtxSnapshot>({
    mutationFn,
    async onMutate(vars) {
      const qc = (options?.meta?.queryClient as QueryClient) || (globalThis as any).__REACT_QUERY_CLIENT__;
      if (!qc) return [];

      const patches = plan.makePatches(vars, qc) || [];
      const ctx: CtxSnapshot = [];

      // snapshot + cancel + patch
      for (const p of patches) {
        for (const key of normalizePatchKeys(p.key)) {
          if (p.cancel !== false) await qc.cancelQueries({ queryKey: key });
          const before = qc.getQueryData(key);
          ctx.push({ key, data: before });
          const next = p.update(before);
          qc.setQueryData(key, next);
        }
      }
      return ctx;
    },
    onError(_e, _vars, ctx) {
      const qc = (options?.meta?.queryClient as QueryClient) || (globalThis as any).__REACT_QUERY_CLIENT__;
      if (!qc || !ctx) return;
      // rollback all
      for (const { key, data } of ctx) qc.setQueryData(key, data);
    },
    async onSuccess(_data, _vars, ctx) {
      const qc = (options?.meta?.queryClient as QueryClient) || (globalThis as any).__REACT_QUERY_CLIENT__;
      if (!qc) return;

      if (plan.afterSuccess) {
        await plan.afterSuccess(_data, _vars, qc);
      }

      // Optional targeted invalidates
      if (plan.invalidateOnSuccess?.length) {
        for (const key of plan.invalidateOnSuccess) qc.invalidateQueries({ queryKey: key });
      }

      // Optional delayed revalidation
      const delay = plan.revalidateAfterMs ?? 0;
      if (delay > 0 && ctx?.length) {
        setTimeout(() => {
          for (const { key } of ctx) qc.invalidateQueries({ queryKey: key });
        }, delay);
      }
    },
    // stay optimistic unless opted into revalidation
    ...options,
  });
}

export function useInvalidateMutation<TData, TVars>(config: InvalidateMutationConfig<TData, TVars>) {
  const {
    mutationFn,
    queryClient: qc,
    queryKeys = [],
    optimisticPatches,
    revalidateAfterMs = 0,
    onSuccess,
    onError,
  } = config;

  return useMutation<TData, unknown, TVars, InvalidateMutationCtx>({
    mutationFn,
    async onMutate(vars) {
      const snapshots: Array<{ key: unknown[]; data: unknown }> = [];
      const uniqKeys = Array.from(
        new Set(queryKeys.map((k) => JSON.stringify(k)))
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
      for (const snap of ctx?.snapshots || []) {
        qc.setQueryData(snap.key, snap.data);
      }
      await onError?.(err, vars, qc);
    },
    async onSuccess(data, vars) {
      for (const key of queryKeys) {
        await qc.invalidateQueries({ queryKey: key as unknown[] });
      }
      await onSuccess?.(data, vars, qc);

      if (revalidateAfterMs > 0 && queryKeys.length) {
        setTimeout(() => {
          for (const key of queryKeys) {
            void qc.invalidateQueries({ queryKey: key as unknown[] });
          }
        }, revalidateAfterMs);
      }
    },
  });
}

/** Helper to stash the QueryClient for places where meta isn’t passed. */
export function attachGlobalQueryClient(qc: QueryClient) {
  (globalThis as any).__REACT_QUERY_CLIENT__ = qc;
}
