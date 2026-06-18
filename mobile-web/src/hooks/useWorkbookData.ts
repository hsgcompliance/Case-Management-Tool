import { useQuery } from "@tanstack/react-query";
import { GoogleIntegrations, type WorkbookExtract } from "@/lib/googleIntegrations";

/**
 * Normalized state for the customer workbook content. The backend fails closed
 * (Drive not connected / no workbook linked / missing scope) so we map those
 * into explicit, renderable states instead of throwing.
 */
export type WorkbookDataState =
  | { kind: "ok"; extract: WorkbookExtract }
  | { kind: "not_connected" }
  | { kind: "not_linked" }
  | { kind: "scope_missing" }
  | { kind: "error"; message: string };

function mapError(error: string): WorkbookDataState {
  switch (error) {
    case "google_not_connected":
      return { kind: "not_connected" };
    case "workbook_not_linked":
      return { kind: "not_linked" };
    case "oauth_scope_missing":
      return { kind: "scope_missing" };
    default:
      return { kind: "error", message: error || "workbook_extract_failed" };
  }
}

export function useWorkbookData(
  customerId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery<WorkbookDataState>({
    queryKey: ["workbook", "data", customerId ?? ""],
    enabled: !!customerId && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        const resp = await GoogleIntegrations.getWorkbookData(customerId!);
        if (resp.ok) return { kind: "ok", extract: resp.extract };
        return mapError(resp.error);
      } catch (err) {
        return mapError(err instanceof Error ? err.message : "workbook_extract_failed");
      }
    },
  });
}
