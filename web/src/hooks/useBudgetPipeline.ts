// web/src/hooks/useBudgetPipeline.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BudgetPipeline } from "@client/budgetPipeline";
import { qk } from "./queryKeys";
import type {
  TBudgetPipelineUpsertBody,
  TBudgetPipelinePreviewBody,
} from "@types";

export function usePipelines(query: { grantId?: string; status?: string } = {}) {
  return useQuery({
    queryKey: qk.pipeline.list(query),
    queryFn: () => BudgetPipeline.list(query),
    staleTime: 60_000,
    select: (data) => (data as any)?.items ?? [],
  });
}

export function usePipeline(id: string | null) {
  return useQuery({
    queryKey: qk.pipeline.detail(id ?? ""),
    queryFn: () => BudgetPipeline.get(id!),
    enabled: !!id,
    staleTime: 30_000,
    select: (data) => (data as any)?.pipeline ?? null,
  });
}

export function usePipelineUpsert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBudgetPipelineUpsertBody) => BudgetPipeline.upsert(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pipeline.root });
    },
  });
}

export function usePipelineDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => BudgetPipeline.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pipeline.root });
    },
  });
}

export function usePipelinePreview() {
  return useMutation({
    mutationFn: (body: TBudgetPipelinePreviewBody) => BudgetPipeline.preview(body),
  });
}

export function usePipelineRollup(pipelineId?: string) {
  return useQuery({
    queryKey: [...qk.pipeline.root, "rollup", pipelineId ?? "all"],
    queryFn: () => BudgetPipeline.rollup(pipelineId ? { pipelineId } : {}),
    staleTime: 30_000,
    select: (data) => ({ rows: data?.rows ?? [], totals: data?.totals }),
  });
}

export function useBudgetRollupPreview(query: { grantId?: string | null; startDate?: string; endDate?: string; limit?: number; focusSourceId?: string } = {}) {
  const grantId = String(query.grantId || "").trim();
  return useQuery({
    queryKey: [...qk.pipeline.root, "budgetRollupPreview", grantId, query.startDate ?? "", query.endDate ?? "", query.limit ?? 25, query.focusSourceId ?? ""],
    queryFn: () => BudgetPipeline.rollupPreview({ ...query, grantId, limit: query.limit ?? 25 }),
    enabled: !!grantId,
    staleTime: 30_000,
    select: (data) => data.preview,
  });
}

export function useReconcileGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => BudgetPipeline.reconcileGrant(grantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pipeline.root });
    },
  });
}
