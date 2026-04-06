import { useQuery, useQueryClient } from "@tanstack/react-query";
import JotformAPI from "@client/jotform";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import { useInvalidateMutation } from "./optimistic";
import type {
  TJotformSubmissionEntity,
  TJotformFormSummary,
  TJotformDigestMap,
  JotformFormsListReq,
  JotformLinkSubmissionReq,
  JotformSyncSelectionReq,
  JotformDigestUpsertReq,
  JotformDigestGetReq,
  JotformLinkSubmissionResp,
  JotformDigestListReq,
  JotformSubmissionsListReq,
  JotformSubmissionsUpsertReq,
  JotformSubmissionsPatchReq,
  JotformSyncSubmissionsReq,
  JotformApiListReq,
} from "@types";

const toIds = (value: string | string[]) =>
  Array.isArray(value) ? value : [value];

export type JotformSubmission = TJotformSubmissionEntity;
export type JotformForm = TJotformFormSummary;
export type JotformDigestMap = TJotformDigestMap;

type JotformQueryOpts = {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  refetchIntervalInBackground?: boolean;
};

export function useJotformSubmissions(
  query?: JotformSubmissionsListReq,
  opts?: JotformQueryOpts
) {
  return useQuery<JotformSubmission[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    refetchInterval: opts?.refetchInterval,
    refetchIntervalInBackground: opts?.refetchIntervalInBackground,
    queryKey: qk.jotform.list((query as Record<string, unknown>) || {}),
    queryFn: async () => {
      const res = await JotformAPI.list(query || {});
      return Array.isArray(res?.items) ? (res.items as JotformSubmission[]) : [];
    },
  });
}

export function useJotformSubmissionsLite(
  query?: JotformSubmissionsListReq,
  opts?: JotformQueryOpts
) {
  return useJotformSubmissions(query, {
    ...opts,
    staleTime: opts?.staleTime ?? 120_000,
    refetchInterval: opts?.refetchInterval ?? false,
  });
}

export function useJotformSubmissionsFrequent(
  query?: JotformSubmissionsListReq,
  opts?: JotformQueryOpts
) {
  return useJotformSubmissions(query, {
    ...opts,
    staleTime: opts?.staleTime ?? 10_000,
    refetchInterval: opts?.refetchInterval ?? 15_000,
    refetchIntervalInBackground: opts?.refetchIntervalInBackground ?? false,
  });
}

export function useJotformSubmission(
  id?: string,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = (opts?.enabled ?? true) && !!id;
  return useQuery<JotformSubmission | null>({
    ...RQ_DETAIL,
    enabled,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
    queryKey: qk.jotform.detail(id || "__none__"),
    queryFn: async () => {
      const res = await JotformAPI.get(id!);
      return (res?.submission as JotformSubmission) ?? null;
    },
  });
}

export function useJotformStructure(opts?: { enabled?: boolean; staleTime?: number }) {
  return useQuery({
    ...RQ_DETAIL,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
    queryKey: qk.jotform.structure(),
    queryFn: () => JotformAPI.structure(),
  });
}

/** List submissions live from Jotform API — no Firestore storage, cached in React Query. */
export function useJotformApiSubmissions(
  query?: Omit<JotformApiListReq, "formId"> & { formId?: string },
  opts?: JotformQueryOpts
) {
  const formId = String(query?.formId || "");
  const enabled = (opts?.enabled ?? true) && !!formId;
  return useQuery<JotformSubmission[]>({
    ...RQ_DEFAULTS,
    enabled,
    staleTime: opts?.staleTime ?? 30_000,
    refetchInterval: opts?.refetchInterval,
    queryKey: qk.jotform.apiList(formId, query as Record<string, unknown>),
    queryFn: async () => {
      const res = await JotformAPI.apiList({ ...query, formId } as JotformApiListReq);
      return Array.isArray(res?.items) ? (res.items as JotformSubmission[]) : [];
    },
  });
}

/** Fetch a single submission live from Jotform API, cached in React Query. */
export function useJotformApiSubmission(
  id?: string,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = (opts?.enabled ?? true) && !!id;
  return useQuery<JotformSubmission | null>({
    ...RQ_DETAIL,
    enabled,
    staleTime: opts?.staleTime ?? 5 * 60_000,
    queryKey: qk.jotform.apiDetail(id || "__none__"),
    queryFn: async () => {
      const res = await JotformAPI.apiGet(id!);
      return (res?.submission as JotformSubmission) ?? null;
    },
  });
}

export function useJotformForms(
  query?: JotformFormsListReq,
  opts?: JotformQueryOpts
) {
  return useQuery<JotformForm[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    refetchInterval: opts?.refetchInterval,
    refetchIntervalInBackground: opts?.refetchIntervalInBackground,
    queryKey: qk.jotform.forms((query as Record<string, unknown>) || {}),
    queryFn: async () => {
      const res = await JotformAPI.formsList(query || {});
      return Array.isArray(res?.items) ? (res.items as JotformForm[]) : [];
    },
  });
}

export function useJotformFormsLite(
  query?: JotformFormsListReq,
  opts?: JotformQueryOpts
) {
  return useJotformForms(query, {
    ...opts,
    staleTime: opts?.staleTime ?? 300_000,
    refetchInterval: opts?.refetchInterval ?? false,
  });
}

export function useJotformDigest(
  query?: { formId?: string; formAlias?: string; id?: string },
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const formKey = String(query?.formId || query?.id || query?.formAlias || "__none__");
  const enabled = (opts?.enabled ?? true) && !!(query?.formId || query?.id || query?.formAlias);
  return useQuery<JotformDigestMap | null>({
    ...RQ_DETAIL,
    enabled,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
    queryKey: qk.jotform.digest(formKey),
    queryFn: async () => {
      const res = await JotformAPI.digestGet(query as JotformDigestGetReq);
      return (res?.map as JotformDigestMap) ?? null;
    },
  });
}

export function useJotformDigests(
  query?: JotformDigestListReq,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<JotformDigestMap[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.jotform.digests((query as Record<string, unknown>) || {}),
    queryFn: async () => {
      const res = await JotformAPI.digestList(query || {});
      return Array.isArray(res?.items) ? (res.items as JotformDigestMap[]) : [];
    },
  });
}

export function useUpsertJotformSubmissions() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.jotform.root],
    mutationFn: (body: JotformSubmissionsUpsertReq) => JotformAPI.upsert(body),
    onSuccess: async (res) => {
      const ids = Array.isArray(res?.ids) ? res.ids : [];
      await Promise.all(ids.map((id) => qc.invalidateQueries({ queryKey: qk.jotform.detail(id) })));
    },
  });
}

export function usePatchJotformSubmissions() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.jotform.root],
    mutationFn: (body: JotformSubmissionsPatchReq) => JotformAPI.patch(body),
    onSuccess: async (res) => {
      const ids = Array.isArray(res?.ids) ? res.ids : [];
      await Promise.all(ids.map((id) => qc.invalidateQueries({ queryKey: qk.jotform.detail(id) })));
    },
  });
}

export function useDeleteJotformSubmissions() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.jotform.root],
    mutationFn: (idOrIds: string | string[]) => JotformAPI.delete(idOrIds),
    onSuccess: async (_res, idOrIds) => {
      await Promise.all(toIds(idOrIds).map((id) => qc.invalidateQueries({ queryKey: qk.jotform.detail(id) })));
    },
  });
}

export function useAdminDeleteJotformSubmissions() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.jotform.root],
    mutationFn: (idOrIds: string | string[]) => JotformAPI.adminDelete(idOrIds),
    onSuccess: async (_res, idOrIds) => {
      await Promise.all(toIds(idOrIds).map((id) => qc.invalidateQueries({ queryKey: qk.jotform.detail(id) })));
    },
  });
}

export function useSyncJotformSubmissions() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.jotform.root],
    mutationFn: (body: JotformSyncSubmissionsReq) => JotformAPI.syncSubmissions(body),
  });
}

export function useLinkJotformSubmission() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.jotform.root],
    mutationFn: (body: JotformLinkSubmissionReq) => JotformAPI.linkSubmission(body),
    onSuccess: async (res) => {
      const id = String((res as JotformLinkSubmissionResp)?.id || "");
      if (id) await qc.invalidateQueries({ queryKey: qk.jotform.detail(id) });
    },
  });
}

export function useSyncJotformSelection() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.jotform.root],
    mutationFn: (body: JotformSyncSelectionReq) => JotformAPI.syncSelection(body),
  });
}

export function useUpsertJotformDigest() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.jotform.root],
    mutationFn: (body: JotformDigestUpsertReq) => JotformAPI.digestUpsert(body),
    onSuccess: async (_res, vars) => {
      const payload = vars as JotformDigestUpsertReq;
      const id = String(payload?.formId || payload?.id || "");
      if (id) await qc.invalidateQueries({ queryKey: qk.jotform.digest(id) });
    },
  });
}
