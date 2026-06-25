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

// Loose endpoint — types mirror functions/src/features/budgetPipeline/schemas.ts
export type BudgetPipelineRollupRow = {
  pipelineId: string;
  name: string;
  status: TBudgetPipeline["status"];
  grantId: string | null;
  grantName: string | null;
  lineItemId: string | null;
  lineItemLabel: string | null;
  lineItemBudget: number;
  lineItemProjected: number;
  lineItemSpent: number;
  pendingCount: number;
  pendingAmount: number;
  postedCount: number;
  postedAmount: number;
};
export type BudgetPipelineRollupResult = {
  ok: true;
  rows: BudgetPipelineRollupRow[];
  totals: { pendingAmount: number; postedAmount: number; pendingCount: number; postedCount: number };
};

export type BudgetRollupPreviewSource = {
  id: string;
  sourceType: "ledger" | "paymentQueue";
  date: string;
  amount: number;
  status: "spent" | "projected";
  label: string;
  grantId: string;
  lineItemId: string;
  splitGoalId: string | null;
  customerId: string;
  caseManagerId: string;
  ledgerId: string | null;
  paymentQueueId: string | null;
  reason?: string;
};

export type BudgetRollupPreview = {
  grant: {
    id: string;
    name: string;
    budget: number;
    spent: number;
    projected: number;
    balance: number;
    projectedBalance: number;
  };
  lineItems: Array<{
    id: string;
    label: string;
    budget: number;
    spent: number;
    projected: number;
    balance: number;
    projectedBalance: number;
    splitGoals: Array<{
      id: string;
      label: string;
      startDate: string;
      endDate: string;
      amount: number;
      spent: number;
      projected: number;
      balance: number;
      projectedBalance: number;
      sources: BudgetRollupPreviewSource[];
    }>;
    sources: BudgetRollupPreviewSource[];
  }>;
  unmatched: BudgetRollupPreviewSource[];
  sourceCounts: { ledger: number; paymentQueue: number; unmatched: number };
};
type ReconcileGrantResult = { ok: true; totals: Record<string, unknown>; warnings: string[] };

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

  rollup: (query: { pipelineId?: string } = {}): Promise<BudgetPipelineRollupResult> =>
    api.get("budgetPipelineRollup", query) as Promise<BudgetPipelineRollupResult>,
  rollupPreview: (query: { grantId: string; startDate?: string; endDate?: string; limit?: number; focusSourceId?: string }): Promise<{ ok: true; preview: BudgetRollupPreview }> =>
    api.get("budgetRollupPreview", query) as Promise<{ ok: true; preview: BudgetRollupPreview }>,

  // Reconcile a grant's authoritative projected/spent from queue + ledger.
  reconcileGrant: (grantId: string): Promise<ReconcileGrantResult> =>
    api.call("budgetPipelineReconcileGrant", { body: { grantId } }) as Promise<ReconcileGrantResult>,
};

export default BudgetPipeline;
