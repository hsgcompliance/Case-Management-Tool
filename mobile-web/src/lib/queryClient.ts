import { QueryClient } from "@tanstack/react-query";
import { RQ_DEFAULTS } from "@hooks/base";
import { attachGlobalQueryClient } from "@hooks/optimistic";

export const queryClient = new QueryClient({
  defaultOptions: { queries: RQ_DEFAULTS },
});

// Stash globally so useOptimisticMutation can resolve qc without prop drilling.
attachGlobalQueryClient(queryClient);
