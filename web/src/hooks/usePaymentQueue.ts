import { useQuery, useQueryClient } from "@tanstack/react-query";
import PaymentQueue, {
  type PaymentQueueItem,
  type PaymentQueueBypassCloseReq,
  type PaymentQueueListReq,
  type PaymentQueuePatchReq,
  type PaymentQueuePostReq,
  type PaymentQueueReopenReq,
  type PaymentQueueVoidReq,
} from "@client/paymentQueue";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import { useInvalidateMutation } from "./optimistic";

export type {
  PaymentQueueItem,
  PaymentQueueBypassCloseReq,
  PaymentQueueListReq,
  PaymentQueuePatchReq,
  PaymentQueuePostReq,
  PaymentQueueReopenReq,
  PaymentQueueVoidReq,
};

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
    mutationFn: (args: { id: string; body?: PaymentQueuePostReq }) =>
      PaymentQueue.postToLedger(args.id, args.body || {}),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(vars.id) });
    },
  });
}

export function useBypassClosePaymentQueueItems() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.paymentQueue.root],
    mutationFn: (body: PaymentQueueBypassCloseReq) => PaymentQueue.bypassClose(body),
    onSuccess: async (_res, vars) => {
      await Promise.all((vars.ids || []).map((id) =>
        qc.invalidateQueries({ queryKey: qk.paymentQueue.detail(id) })
      ));
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
