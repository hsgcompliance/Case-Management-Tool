import { useQuery, useQueryClient } from "@tanstack/react-query";
import GrantBudgetManager from "@client/grantBudgetManager";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS } from "./base";
import { useInvalidateMutation } from "./optimistic";
import type {
  GrantBudgetManagerLoadResp,
  GrantBudgetManagerSaveReq,
  GrantBudgetManagerReconcileReq,
} from "@types";

function normalizeGrantIds(grantIds: string[]) {
  return Array.from(new Set(grantIds.map((id) => String(id || "").trim()).filter(Boolean))).sort();
}

function affectedGrantIdsFromResult(result: unknown, fallback: string[]) {
  const raw = result as { grantsRecomputed?: unknown; affectedGrantIds?: unknown };
  const ids = Array.isArray(raw?.grantsRecomputed)
    ? raw.grantsRecomputed
    : Array.isArray(raw?.affectedGrantIds)
    ? raw.affectedGrantIds
    : fallback;
  return normalizeGrantIds(ids.map(String));
}

async function invalidateBudgetManagerQueries(queryClient: ReturnType<typeof useQueryClient>, grantIds: string[]) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.grantBudgetManager.root }),
    queryClient.invalidateQueries({ queryKey: qk.grants.root }),
    queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
    queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
    queryClient.invalidateQueries({ queryKey: qk.metrics.system() }),
    ...grantIds.flatMap((grantId) => [
      queryClient.invalidateQueries({ queryKey: qk.metrics.grant(grantId) }),
      queryClient.invalidateQueries({ queryKey: ["grants", "activity"] }),
    ]),
  ]);
}

export function useGrantBudgetManagerLoad(grantIds: string[], opts?: { enabled?: boolean; staleTime?: number }) {
  const ids = normalizeGrantIds(grantIds);
  return useQuery<GrantBudgetManagerLoadResp>({
    ...RQ_DEFAULTS,
    enabled: (opts?.enabled ?? true) && ids.length > 0,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.grantBudgetManager.load(ids),
    queryFn: () => GrantBudgetManager.load({ grantIds: ids }),
  });
}

export function useSaveGrantBudgetManager() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    // Invalidation lives in onSuccess so dry-run previews skip it entirely —
    // the helper invalidates `queryKeys` on every success, and refetching the
    // Budget Manager load query mid-edit would reseed the open modal.
    mutationFn: (body: GrantBudgetManagerSaveReq) => GrantBudgetManager.save(body),
    onSuccess: async (result, vars) => {
      if ((result as { dryRun?: boolean } | null)?.dryRun) return;
      await invalidateBudgetManagerQueries(qc, affectedGrantIdsFromResult(result, vars.grantIds));
    },
  });
}

export function useReconcileGrantBudgets() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.grantBudgetManager.root, qk.grants.root, qk.ledger.root, qk.paymentQueue.root],
    mutationFn: (body: GrantBudgetManagerReconcileReq) => GrantBudgetManager.reconcile(body),
    onSuccess: async (result, vars) => {
      await invalidateBudgetManagerQueries(qc, affectedGrantIdsFromResult(result, vars.grantIds));
    },
  });
}
