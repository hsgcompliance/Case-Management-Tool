import { useQuery, useQueryClient } from "@tanstack/react-query";
import LedgerAPI from "@client/ledger";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import { useInvalidateMutation } from "./optimistic";
import type {
  TLedgerEntry,
  LedgerListReq,
  LedgerBalanceReq,
  LedgerCreateReq,
  LedgerClassifyReq,
  LedgerAutoAssignReq,
} from "@types";

export type LedgerEntry = TLedgerEntry;

export function useLedgerEntries(
  query?: Partial<LedgerListReq>,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<LedgerEntry[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.ledger.list((query as Record<string, unknown>) || {}),
    queryFn: async () => {
      const res = await LedgerAPI.list(query || {});
      return Array.isArray(res?.entries) ? (res.entries as LedgerEntry[]) : [];
    },
  });
}

export function useLedgerEntry(
  id?: string,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = (opts?.enabled ?? true) && !!id;
  return useQuery<LedgerEntry | null>({
    ...RQ_DETAIL,
    enabled,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
    queryKey: qk.ledger.detail(id || "__none__"),
    queryFn: async () => {
      const res = await LedgerAPI.getById({ entryId: id! });
      return (res?.entry as LedgerEntry) ?? null;
    },
  });
}

export function useLedgerBalance(
  query?: Partial<LedgerBalanceReq>,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.ledger.balance((query as Record<string, unknown>) || {}),
    queryFn: () => LedgerAPI.balance(query || {}),
  });
}

export function useCreateLedgerEntry() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.ledger.root],
    mutationFn: (body: LedgerCreateReq) => LedgerAPI.create(body),
    onSuccess: async (res) => {
      const id = String((res as any)?.entry?.id || "");
      if (id) await qc.invalidateQueries({ queryKey: qk.ledger.detail(id) });
    },
  });
}

export function useClassifyLedgerEntries() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.ledger.root],
    mutationFn: (body: LedgerClassifyReq) => LedgerAPI.classify(body),
    onSuccess: async (res) => {
      const rows = Array.isArray((res as any)?.results) ? (res as any).results : [];
      await Promise.all(
        rows
          .map((x: any) => String(x?.entryId || ""))
          .filter(Boolean)
          .map((id: string) => qc.invalidateQueries({ queryKey: qk.ledger.detail(id) }))
      );
    },
  });
}

export function useAutoAssignLedgerEntries() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.ledger.root],
    mutationFn: (body: LedgerAutoAssignReq) => LedgerAPI.autoAssign(body),
    onSuccess: async (res) => {
      const rows = Array.isArray((res as any)?.matches) ? (res as any).matches : [];
      await Promise.all(
        rows
          .map((x: any) => String(x?.entryId || ""))
          .filter(Boolean)
          .map((id: string) => qc.invalidateQueries({ queryKey: qk.ledger.detail(id) }))
      );
    },
  });
}
