import { useQuery, useQueryClient } from "@tanstack/react-query";
import PaymentQueue, {
  type PaymentQueueItem,
  type CompletePaymentQueueResult,
  type PaymentQueueBypassCloseReq,
  type PaymentQueueBulkDesignateReq,
  type PaymentQueueBulkDesignateResp,
  type PaymentQueueListReq,
  type PaymentQueuePatchReq,
  type PaymentQueuePostReq,
  type PaymentQueueReopenReq,
  type PaymentQueueVoidReq,
} from "@client/paymentQueue";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import { useInvalidateMutation } from "./optimistic";
import {
  findCachedPaymentQueueItemById,
  optimisticPostPaymentQueuePatches,
  optimisticClosePaymentQueuePatches,
  optimisticVoidPaymentQueuePatches,
} from "./paymentQueueOptimistic";

export type {
  PaymentQueueItem,
  CompletePaymentQueueResult,
  PaymentQueueBypassCloseReq,
  PaymentQueueBulkDesignateReq,
  PaymentQueueBulkDesignateResp,
  PaymentQueueListReq,
  PaymentQueuePatchReq,
  PaymentQueuePostReq,
  PaymentQueueReopenReq,
  PaymentQueueVoidReq,
};

/**
 * Retrieves every backend page for one stable queue-coverage key. React Query
 * retains the last successful coverage while a wider range is loading.
 */
export function useCompletePaymentQueueItems(
  query?: PaymentQueueListReq,
  opts?: { enabled?: boolean; staleTime?: number; pageSize?: number; maxPages?: number }
) {
  return useQuery<CompletePaymentQueueResult>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? 60_000,
    queryKey: qk.paymentQueue.list({ complete: true, ...((query as Record<string, unknown>) || {}) }),
    placeholderData: (previous) => previous,
    queryFn: () => PaymentQueue.listAll(query || {}, {
      pageSize: opts?.pageSize,
      maxPages: opts?.maxPages,
    }),
  });
}

export function usePaymentQueueItems(
  query?: PaymentQueueListReq,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<PaymentQueueItem[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.paymentQueue.list((query as Record<string, unknown>) || {}),
    queryFn: async () => {
      const res = await PaymentQueue.list(query || {});
      return Array.isArray(res?.items) ? res.items : [];
    },
  });
}

/**
 * Fetch payment-queue items scoped to a set of report months, paging within each
 * month so we never exceed the backend's 1000-row hard cap. Used by the
 * reconciliation tools so we only pull rows in the uploaded report's date range
 * instead of requesting the entire queue (which 500s past the limit).
 */
export function usePaymentQueueItemsForMonths(
  months: string[],
  query?: Partial<PaymentQueueListReq>,
  opts?: { enabled?: boolean; staleTime?: number; maxMonths?: number; pagesPerMonth?: number }
) {
  const sorted = Array.from(new Set(months.filter(Boolean))).sort();
  const maxMonths = opts?.maxMonths ?? 36;
  const pagesPerMonth = opts?.pagesPerMonth ?? 10;
  const scoped = sorted.slice(0, maxMonths);
  return useQuery<PaymentQueueItem[]>({
    ...RQ_DEFAULTS,
    enabled: (opts?.enabled ?? true) && scoped.length > 0,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.paymentQueue.list({ months: scoped, ...((query as Record<string, unknown>) || {}) }),
    queryFn: async () => {
      const perMonth = await Promise.all(
        scoped.map(async (month) => {
          const out: PaymentQueueItem[] = [];
          let cursor: string | undefined;
          for (let page = 0; page < pagesPerMonth; page += 1) {
            const res = await PaymentQueue.list({ ...(query || {}), month, limit: 1000, cursor });
            const items = Array.isArray(res?.items) ? res.items : [];
            out.push(...items);
            if (!res?.hasMore || !items.length) break;
            cursor = String(items[items.length - 1]?.id || "") || undefined;
            if (!cursor) break;
          }
          return out;
        })
      );
      const byId = new Map<string, PaymentQueueItem>();
      for (const arr of perMonth) for (const item of arr) byId.set(item.id, item);
      return Array.from(byId.values());
    },
  });
}

export function usePaymentQueueItem(
  id?: string,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = (opts?.enabled ?? true) && !!id;
  return useQuery<PaymentQueueItem | null>({
    ...RQ_DETAIL,
    enabled,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
    queryKey: qk.paymentQueue.detail(id || "__none__"),
    queryFn: async () => {
      const res = await PaymentQueue.get(id!);
      return (res?.item as PaymentQueueItem) ?? null;
    },
  });
}

export function usePatchPaymentQueueItem() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.paymentQueue.root],
    mutationFn: (args: { id: string; body: PaymentQueuePatchReq }) =>
      PaymentQueue.patch(args.id, args.body),
    onSuccess: async (_res, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(vars.id) }),
        qc.invalidateQueries({ queryKey: qk.ledger.root }),
      ]);
    },
  });
}

export function usePostPaymentQueueToLedger() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.paymentQueue.root, qk.ledger.root],
    optimisticPatches: (args, queryClient) => {
      const item = findCachedPaymentQueueItemById(queryClient, args.id);
      return optimisticPostPaymentQueuePatches(queryClient, item);
    },
    mutationFn: (args: { id: string; body?: PaymentQueuePostReq }) =>
      PaymentQueue.postToLedger(args.id, args.body || {}),
    onSuccess: async (_res, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(vars.id) }),
        qc.invalidateQueries({ queryKey: qk.grants.root }),
      ]);
    },
  });
}

export function useBulkDesignatePaymentQueueItems() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [],
    optimisticPatches: (body: PaymentQueueBulkDesignateReq, queryClient) =>
      body.items.flatMap((input) => {
        const item = findCachedPaymentQueueItemById(queryClient, input.id);
        return input.post
          ? optimisticPostPaymentQueuePatches(queryClient, item, {
              grantId: input.grantId,
              lineItemId: input.lineItemId,
            })
          : [];
      }),
    mutationFn: (body: PaymentQueueBulkDesignateReq) =>
      PaymentQueue.bulkDesignate(body),
    onSuccess: (_res: PaymentQueueBulkDesignateResp, body) => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        qc.invalidateQueries({ queryKey: qk.ledger.root }),
        qc.invalidateQueries({ queryKey: qk.grants.root }),
        ...body.items.map((item) =>
          qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(item.id) })
        ),
      ]);
    },
  });
}

export function useBypassClosePaymentQueueItems() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [],
    optimisticPatches: (body: PaymentQueueBypassCloseReq, queryClient) =>
      optimisticClosePaymentQueuePatches(queryClient, body.ids),
    mutationFn: (body: PaymentQueueBypassCloseReq) => PaymentQueue.bypassClose(body),
    onSuccess: (_res, vars) => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        ...(vars.ids || []).map((id) =>
        qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(id) })
        ),
      ]);
    },
  });
}

export function useReopenPaymentQueueItem() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.paymentQueue.root, qk.ledger.root],
    mutationFn: (args: { id: string; body?: PaymentQueueReopenReq }) =>
      PaymentQueue.reopen(args.id, args.body || {}),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(vars.id) });
    },
  });
}

export function useVoidPaymentQueueItem() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.paymentQueue.root, qk.ledger.root],
    mutationFn: (args: { id: string; body?: PaymentQueueVoidReq }) =>
      PaymentQueue.void(args.id, args.body || {}),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(vars.id) });
    },
  });
}

export type PaymentQueueBulkVoidReq = {
  ids: string[];
  reason?: string;
};

export type PaymentQueueBulkVoidResp = {
  voided: string[];
  failed: Array<{ id: string; error: string }>;
};

export function useBulkVoidPaymentQueueItems() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [],
    optimisticPatches: (body: PaymentQueueBulkVoidReq, queryClient) =>
      optimisticVoidPaymentQueuePatches(queryClient, body.ids),
    mutationFn: async (body: PaymentQueueBulkVoidReq): Promise<PaymentQueueBulkVoidResp> => {
      const ids = Array.from(new Set(body.ids.map((id) => String(id || "").trim()).filter(Boolean)));
      const outcomes: PaymentQueueBulkVoidResp = { voided: [], failed: [] };
      let nextIndex = 0;
      const workers = Array.from({ length: Math.min(8, ids.length) }, async () => {
        while (nextIndex < ids.length) {
          const id = ids[nextIndex++];
          try {
            await PaymentQueue.void(id, body.reason ? { reason: body.reason } : {});
            outcomes.voided.push(id);
          } catch (error) {
            outcomes.failed.push({
              id,
              error: error instanceof Error ? error.message : "void_failed",
            });
          }
        }
      });
      await Promise.all(workers);
      return outcomes;
    },
    onSuccess: (_res, vars) => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        qc.invalidateQueries({ queryKey: qk.grants.root }),
        ...vars.ids.map((id) => qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(id) })),
      ]);
    },
  });
}

export function useRecomputeGrantAllocations() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.paymentQueue.root, qk.ledger.root],
    mutationFn: (body: { grantId: string; dryRun?: boolean }) =>
      PaymentQueue.recomputeGrantAllocations(body),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: ["grantAllocations", vars.grantId] });
    },
  });
}
