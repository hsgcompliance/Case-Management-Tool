import { useQuery } from "@tanstack/react-query";
import { CaseNoteAssistant } from "@client/caseNoteAssistant";
import { qk } from "./queryKeys";

export function useCaseNoteAssistantUsage(month?: string, orgId?: string) {
  return useQuery({
    queryKey: qk.ai.caseNoteUsage({ month: month || null, orgId: orgId || null }),
    queryFn: () => CaseNoteAssistant.usageSummary({ ...(month ? { month } : {}), ...(orgId ? { orgId } : {}) }),
    staleTime: 60_000,
    retry: 1,
  });
}
