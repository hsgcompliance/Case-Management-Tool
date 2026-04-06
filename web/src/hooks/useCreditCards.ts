import { useQuery, useQueryClient } from "@tanstack/react-query";
import CreditCardsAPI from "@client/creditCards";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import { useInvalidateMutation } from "./optimistic";
import type {
  CreditCardEntity,
  CreditCardsListReq,
  CreditCardsSummaryReq,
  CreditCardsSummaryResp,
  CreditCardsPatchReq,
  CreditCardsUpsertReq,
} from "@types";

export type CreditCard = CreditCardEntity;

export function useCreditCards(
  query?: Partial<CreditCardsListReq>,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<CreditCard[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.creditCards.list((query as Record<string, unknown>) || {}),
    queryFn: () => CreditCardsAPI.list(query as CreditCardsListReq),
  });
}

export function useCreditCard(
  id?: string,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = (opts?.enabled ?? true) && !!id;
  return useQuery<CreditCard | null>({
    ...RQ_DETAIL,
    enabled,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
    queryKey: qk.creditCards.detail(id || "__none__"),
    queryFn: () => CreditCardsAPI.get(id!),
  });
}

export function useCreditCardsStructure() {
  return useQuery({
    ...RQ_DEFAULTS,
    queryKey: qk.creditCards.structure(),
    queryFn: () => CreditCardsAPI.structure(),
  });
}

export function useCreditCardsSummary(
  query?: Partial<CreditCardsSummaryReq>,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<CreditCardsSummaryResp>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.creditCards.summary((query as Record<string, unknown>) || {}),
    queryFn: () => CreditCardsAPI.summary(query as CreditCardsSummaryReq),
  });
}

export function useUpsertCreditCards() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.creditCards.root],
    mutationFn: (rows: CreditCardsUpsertReq) => CreditCardsAPI.upsert(rows),
  });
}

export function usePatchCreditCards() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.creditCards.root],
    mutationFn: (rows: CreditCardsPatchReq) => CreditCardsAPI.patch(rows),
  });
}
