import { useMutation, useQuery } from "@tanstack/react-query";
import type { TGenerateCaseNoteSuggestionReq, TGenerateCaseNoteSuggestionResp } from "@hdb/contracts";
import { callFunction } from "@/lib/functionsApi";

export type CaseNoteBetaConfig = { enabled: boolean; allowedWorkbookVariants: string[]; defaultClientLabel: string; defaultStaffLabel: string };
export function useCaseNoteAssistantConfig() {
  return useQuery({
    queryKey: ["orgConfig", "caseNoteAssistantBeta"],
    queryFn: async () => {
      const result = await callFunction("orgGet", {}, { method: "GET" }) as { org?: { config?: Record<string, { kind?: string; label?: string; active?: boolean; value?: { aiFeatures?: { caseNoteAssistantBeta?: Partial<CaseNoteBetaConfig> } } }> } };
      const docs = Object.values(result.org?.config ?? {}).filter((doc) => doc.kind === "display" && doc.active !== false);
      const display = docs.find((doc) => /grant|budget|display/i.test(doc.label ?? "")) ?? docs[0];
      const raw = display?.value?.aiFeatures?.caseNoteAssistantBeta;
      return { enabled: raw?.enabled === true, allowedWorkbookVariants: raw?.allowedWorkbookVariants ?? ["payer"], defaultClientLabel: raw?.defaultClientLabel ?? "client", defaultStaffLabel: raw?.defaultStaffLabel ?? "case manager" };
    },
    staleTime: 5 * 60_000,
  });
}
export function useGenerateCaseNoteSuggestion() {
  return useMutation({ mutationFn: (body: TGenerateCaseNoteSuggestionReq) => callFunction("generateCaseNoteSuggestion", body) as Promise<TGenerateCaseNoteSuggestionResp> });
}
export async function recordCaseNoteSuggestionDecision(requestId: string, accepted: boolean) {
  await callFunction("recordCaseNoteSuggestionDecision", { requestId, accepted });
}
