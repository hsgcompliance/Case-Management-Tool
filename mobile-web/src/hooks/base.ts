// mobile-web/src/hooks/base.ts
// React Query defaults — ported from web/src/hooks/base.ts.
// Mobile stale times match web (long: rely on mutations + cache invalidation).

import { keepPreviousData } from "@tanstack/react-query";

const HOUR = 60 * 60_000;
const MIN = 60_000;

/** Standard defaults: long stale times for data that changes via mutations. */
export const RQ_DEFAULTS = {
  staleTime: 4 * HOUR,
  gcTime: 4 * HOUR,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  retry: 1,
  placeholderData: keepPreviousData,
  structuralSharing: true as const,
};

/** Detail views: single records rarely change while being viewed. */
export const RQ_DETAIL = {
  ...RQ_DEFAULTS,
  staleTime: 8 * HOUR,
  gcTime: 8 * HOUR,
};

/** Live data: activity feeds and session lists that CMs add to frequently. */
export const RQ_LIVE = {
  ...RQ_DEFAULTS,
  staleTime: 2 * MIN,
  gcTime: 10 * MIN,
  placeholderData: keepPreviousData,
};
