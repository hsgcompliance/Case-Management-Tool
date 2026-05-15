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
