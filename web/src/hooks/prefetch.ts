// web/src/hooks/prefetch.ts
import type { QueryClient, QueryKey } from "@tanstack/react-query";

type PrefetchOpts = {
  staleTime?: number;
};

/**
 * Canonical prefetch helper.
 * Policy: React Query is the cache. Prefetch uses queryClient; do not create ad-hoc caches elsewhere.
 */
export function prefetch<T>(
  qc: QueryClient,
  key: QueryKey,
  fn: () => Promise<T>,
  opts: PrefetchOpts = {}
) {
  return qc.prefetchQuery({
    queryKey: key,
    queryFn: fn,
    staleTime: opts.staleTime,
  });
}

export function invalidate(qc: QueryClient, key: QueryKey) {
  return qc.invalidateQueries({ queryKey: key });
}
