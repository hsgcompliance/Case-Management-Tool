//hooks/base.ts
import { keepPreviousData } from '@tanstack/react-query';
import { stableStringify } from '@lib/stable';
export { idemKey } from "@lib/idem";

const HOUR = 60 * 60_000;

// Uniform defaults for all queries.
// Long stale times: data is accurate on page open, mutations update optimistically.
// Manual refresh covers anything that needs to be fresher.
export const RQ_DEFAULTS = {
  staleTime: 4 * HOUR,        // lists: treat as fresh for 4h
  gcTime: 4 * HOUR,           // keep in memory for 4h after unmount
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,   // only fires when already stale (4h+)
  retry: 1,
  placeholderData: keepPreviousData,
  structuralSharing: true as const,
};

// Detail views: 8h — single records rarely change while being viewed.
export const RQ_DETAIL = {
  ...RQ_DEFAULTS,
  staleTime: 8 * HOUR,
  gcTime: 8 * HOUR,
};