// src/hooks/useInbox.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox } from '@client/inbox';
import type { InboxItem, InboxListMyResp, InboxMetricsMyResp } from '@types';
import { qk } from './queryKeys';
import { RQ_DEFAULTS } from './base';
import type { RespOf } from "@types";
import { useInvalidateMutation } from './optimistic';

// Intentional: inbox list data changes frequently during active work sessions.
const INBOX_LIST_STALE_MS = 30_000;

function cachedInboxItemsForMonth(queryClient: ReturnType<typeof useQueryClient>, month?: string): InboxItem[] | undefined {
  const matches = queryClient.getQueriesData({ queryKey: qk.inbox.root });
  for (const [key, data] of matches) {
    if (!Array.isArray(key) || key.length < 3) continue;
    if (String(key[0] || "") !== "inbox" || String(key[1] || "") !== "my") continue;
    const keyFilters = (key[2] || {}) as Record<string, unknown>;
    const keyMonth = String(keyFilters?.month || "");
    if (month && keyMonth !== month) continue;
    if (Array.isArray(data)) return data as InboxItem[];
    const top = (data as { items?: unknown } | null)?.items;
    if (Array.isArray(top)) return top as InboxItem[];
    const nested = (data as { data?: { items?: unknown } } | null)?.data?.items;
    if (Array.isArray(nested)) return nested as InboxItem[];
  }
  return undefined;
}

export function useMyInbox(
  filters?: { month?: string; includeOverdue?: boolean; includeGroup?: boolean },
  opts?: { enabled?: boolean; staleTime?: number; fallbackToCachedMonth?: boolean }
) {
  const enabled = opts?.enabled ?? true;
  const queryClient = useQueryClient();
  const month = String(filters?.month || "");
  return useQuery<InboxListMyResp, Error, InboxItem[]>({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.inbox.my(filters),
    queryFn: () => Inbox.listMy(filters),
    select: (resp) => {
      const top = (resp as { items?: unknown }).items;
      if (Array.isArray(top)) return top as InboxItem[];
      const nested = (resp as { data?: { items?: unknown } }).data?.items;
      if (Array.isArray(nested)) return nested as InboxItem[];
      return [];
    },
    staleTime: opts?.staleTime ?? INBOX_LIST_STALE_MS,
    placeholderData: (prev) => {
      if (Array.isArray(prev) && prev.length) return prev;
      if (opts?.fallbackToCachedMonth === false) return prev;
      return cachedInboxItemsForMonth(queryClient, month);
    },
  });
}

type InboxWorkloadResp = RespOf<"inboxWorkloadList">;
type InboxWorkloadItem = InboxWorkloadResp extends { items: Array<infer I> } ? I : InboxItem;

export function useInboxWorkloadList(
  filters?: {
    month?: string;
    assigneeUid?: string;
    customerId?: string;
    status?: "open" | "done";
    sortBy?: "dueDate" | "assigneeUid" | "customerId";
    sortDir?: "asc" | "desc";
    includeUnassigned?: boolean;
    limit?: number;
  },
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = opts?.enabled ?? true;
  return useQuery<InboxWorkloadItem[]>({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.inbox.workload(filters),
    queryFn: async () => {
      const resp = await Inbox.workloadList(filters);
      if (resp && typeof resp === "object") {
        const items = (resp as { items?: unknown }).items;
        if (Array.isArray(items)) return items as InboxWorkloadItem[];
      }
      return [];
    },
    staleTime: opts?.staleTime ?? INBOX_LIST_STALE_MS,
  });
}

export function useMyInboxMetrics(month?: string, opts?: { enabled?: boolean; staleTime?: number }) {
  return useQuery<InboxMetricsMyResp>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    queryKey: qk.inbox.metrics(month),
    queryFn: () => Inbox.metricsMy(month ? { month } : undefined),
    staleTime: opts?.staleTime ?? 60_000,
  });
}

export function useSendInvite() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    mutationFn: (body: Parameters<typeof Inbox.sendInvite>[0]) => Inbox.sendInvite(body),
  });
}

export function useSendMonthlySummary() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    mutationFn: (body: Parameters<typeof Inbox.sendMonthlySummary>[0]) =>
      Inbox.sendMonthlySummary(body),
  });
}

export function useDigestPreview(month?: string, cmUid?: string, opts?: { enabled?: boolean }) {
  const enabled = !!month && (opts?.enabled ?? true);
  return useQuery<RespOf<"inboxDigestPreview">>({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: month ? qk.inbox.digestPreview(month, cmUid) : qk.inbox.digestPreviewNoop(),
    queryFn: () => Inbox.digestPreview({ month: month!, ...(cmUid ? { cmUid } : {}) }),
    staleTime: RQ_DEFAULTS.staleTime,
  });
}

export function useSendDigestNow() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.inbox.root],
    mutationFn: (body: { months: string[]; cmUid?: string; combine?: boolean; subject?: string; subjectTemplate?: string }) =>
      Inbox.sendDigestNow({ ...body, combine: body.combine ?? true }),
  });
}

export function useScheduleDigest() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.inbox.root],
    mutationFn: (body: { months: string[]; cmUid: string; combine?: boolean; subject?: string; subjectTemplate?: string; message?: string; sendAt: string }) =>
      Inbox.scheduleDigest({ ...body, combine: body.combine ?? true }),
  });
}
