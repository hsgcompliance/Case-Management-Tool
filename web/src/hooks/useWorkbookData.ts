"use client";

// Read-only TSS workbook content (Slice A).
// Calls getWorkbookData — backend extracts structured entities via strict
// per-user server OAuth. On auth/scope failure the response carries a structured
// error the UI uses to fall back to the iframe / open-sheet path.

import { useQuery } from "@tanstack/react-query";
import { GDrive } from "@client/gdrive";
import { tss } from "@hdb/contracts";
import type { tss as TssNS } from "@hdb/contracts";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS } from "./base";
import { isGoogleReauthError, GOOGLE_REAUTH_ISSUE } from "@lib/googleAuthError";

export type WorkbookDataError = {
  error: string;
  category?: string;
  reconnectService?: "googleDrive" | "googleCalendar";
  missingPermissions?: string[];
  hint?: string;
};

export type WorkbookDataResult = {
  extract: TssNS.TssWorkbookExtract | null;
  /** Structured error when extraction could not run (not connected, scope, not linked). */
  issue: WorkbookDataError | null;
};

function parseResponse(resp: unknown): WorkbookDataResult {
  const row = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
  if (row.ok === true && row.extract) {
    const parsed = tss.TssWorkbookExtractSchema.safeParse(row.extract);
    if (parsed.success) return { extract: parsed.data, issue: null };
    return { extract: null, issue: { error: "invalid_extract_shape" } };
  }
  // Expired/invalid Google token → normalize to a clean "reconnect" issue so the
  // banner shows Reconnect + Settings instead of the raw Google error string.
  if (isGoogleReauthError(row)) {
    return { extract: null, issue: { ...GOOGLE_REAUTH_ISSUE } };
  }
  // Non-ok → structured issue (google_not_connected, oauth_scope, workbook_not_linked, …)
  return {
    extract: null,
    issue: {
      error: String(row.error || "workbook_extract_failed"),
      category: typeof row.category === "string" ? row.category : undefined,
      reconnectService: row.reconnectService === "googleDrive" || row.reconnectService === "googleCalendar"
        ? row.reconnectService
        : undefined,
      missingPermissions: Array.isArray(row.missingPermissions) ? (row.missingPermissions as string[]) : undefined,
      hint: typeof row.hint === "string" ? row.hint : undefined,
    },
  };
}

export function useWorkbookData(
  customerId: string,
  opts?: { enabled?: boolean },
) {
  return useQuery<WorkbookDataResult>({
    ...RQ_DEFAULTS,
    enabled: (opts?.enabled ?? true) && !!customerId,
    queryKey: qk.gdrive.workbookData(customerId),
    // The endpoint returns 4xx with a structured body for auth/scope/not-linked;
    // the client throws on non-2xx, so catch and surface as an issue instead.
    queryFn: async () => {
      try {
        const resp = await GDrive.workbookData(customerId);
        return parseResponse(resp);
      } catch (e: unknown) {
        // The api client throws on non-2xx with the structured body at e.meta.response
        // (e.g. { ok:false, error:"google_not_connected", category, reconnectService }).
        const body = (e as { meta?: { response?: unknown } })?.meta?.response ?? e;
        return parseResponse(body);
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
