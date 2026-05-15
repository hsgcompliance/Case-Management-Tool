// web/src/client/budgetPipeline.ts
import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  TBudgetPipeline,
  TBudgetPipelineUpsertBody,
  TBudgetPipelineListQuery,
  TBudgetPipelinePreviewBody,
  TBudgetPipelinePreviewResult,
} from "@types";

type ListResult = { ok: true; items: TBudgetPipeline[]; count: number };
type GetResult  = { ok: true; pipeline: TBudgetPipeline };
type UpsertResult = { ok: true; id: string; pipeline: TBudgetPipeline };
type DeleteResult = { ok: true; deleted: string };
type PreviewResult = { ok: true } & TBudgetPipelinePreviewResult;

export const BudgetPipeline = {
  list: (query: Partial<TBudgetPipelineListQuery> = {}): Promise<ListResult> =>
    api.get("budgetPipelineList", query) as Promise<ListResult>,

  get: (id: string): Promise<GetResult> =>
    api.get("budgetPipelineGet", { id }) as Promise<GetResult>,

  upsert: (body: TBudgetPipelineUpsertBody): Promise<UpsertResult> =>
    api.callIdem(
      "budgetPipelineUpsert",
      body,
      idemKey({ scope: "budgetPipeline", op: "upsert", body }),
    ) as Promise<UpsertResult>,

  delete: (id: string): Promise<DeleteResult> =>
    api.callIdem(
      "budgetPipelineDelete",
      { id },
      idemKey({ scope: "budgetPipeline", op: "delete", id }),
    ) as Promise<DeleteResult>,

  preview: (body: TBudgetPipelinePreviewBody): Promise<PreviewResult> =>
    api.call("budgetPipelinePreview", { body }) as Promise<PreviewResult>,
};

export default BudgetPipeline;
