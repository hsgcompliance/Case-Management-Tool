import { callFunction } from "@/lib/functionsApi";
import type { ReqOf, RespOf, TGoogleService, tss as TssNS } from "@hdb/contracts";

export type WorkbookExtract = TssNS.TssWorkbookExtract;

export type WorkbookDataResponse =
  | { ok: true; extract: WorkbookExtract }
  | { ok: false; error: string; category?: string; reconnectService?: string; hint?: string };

export type GoogleIntegrationService = TGoogleService;
export type GoogleIntegrationStatus = RespOf<"calendarStatus"> | RespOf<"driveStatus">;
export type CalendarPostEventInput = ReqOf<"calendarPostEvent">;

const endpointByService = {
  googleCalendar: {
    connect: "calendarConnectStart",
    disconnect: "calendarDisconnect",
    status: "calendarStatus",
  },
  googleDrive: {
    connect: "driveConnectStart",
    disconnect: "driveDisconnect",
    status: "driveStatus",
  },
} as const;

export const GoogleIntegrations = {
  status: (service: GoogleIntegrationService) =>
    callFunction<GoogleIntegrationStatus>(endpointByService[service].status, {}, { method: "GET" }),

  connect: async (service: GoogleIntegrationService) => {
    const resp = await callFunction<RespOf<"calendarConnectStart"> | RespOf<"driveConnectStart">>(
      endpointByService[service].connect,
      {},
    );
    if (resp.ok && resp.authUrl) window.location.href = resp.authUrl;
    return resp;
  },

  // Start the OAuth flow and return the Google consent URL WITHOUT navigating —
  // used by the in-page popup connect on the Log Session screen.
  connectAuthUrl: async (service: GoogleIntegrationService): Promise<string> => {
    const resp = await callFunction<RespOf<"calendarConnectStart"> | RespOf<"driveConnectStart">>(
      endpointByService[service].connect,
      {},
    );
    return resp.ok && resp.authUrl ? String(resp.authUrl) : "";
  },

  disconnect: (service: GoogleIntegrationService) =>
    callFunction<RespOf<"calendarDisconnect"> | RespOf<"driveDisconnect">>(
      endpointByService[service].disconnect,
      {},
    ),

  postCalendarEvent: (body: CalendarPostEventInput) =>
    callFunction<RespOf<"calendarPostEvent">>("calendarPostEvent", body),

  // Write a row to the customer's linked TSS workbook (strict per-user server
  // OAuth on the backend). mode: "append" (default, progress notes), "insert"
  // (new row that shifts the table below down — e.g. adding a goal), or "update"
  // (overwrite the row at rowKey — e.g. editing a goal in place).
  pushWorkbookRow: (body: {
    customerId: string;
    entityId: string;
    values: Record<string, string>;
    mode?: "append" | "insert" | "update";
    rowKey?: string;
  }) =>
    callFunction<{ ok: boolean; error?: string; rowKey?: string }>("appendCustomerWorkbookRow", body),

  // Read-only native extraction of the customer's linked TSS workbook (goals,
  // progress notes, …). Fails closed (ok:false) when Drive isn't connected or no
  // workbook is linked, so callers fall back to the open-in-Sheets link.
  getWorkbookData: (customerId: string) =>
    callFunction<WorkbookDataResponse>("getWorkbookData", { customerId }, { method: "GET" }),

  // ── Customer folders ──────────────────────────────────────────────────────

  // Link an existing Drive folder (by id or URL) to a customer.
  linkCustomerFolder: (body: { customerId: string; folderId?: string; folderUrl?: string; folderName?: string }) =>
    callFunction<{ ok: boolean; folderId?: string; error?: string }>("customerFolderLink", body),

  // Build a new customer folder from templates and (when customerId is set)
  // link it + its TSS workbook atomically. Needs Drive connected (writable).
  buildCustomerFolder: (body: {
    name: string;
    parentId: string;
    templates: Array<{ fileId: string; name: string; role?: string }>;
    subfolders: string[];
    customerId: string;
  }) =>
    callFunction<{
      ok: boolean;
      folder?: { id: string; name: string; url: string; workbook?: { spreadsheetId: string; url: string; name: string }; warnings?: unknown[] };
      linked?: boolean;
      linkError?: string;
      error?: string;
    }>("gdriveBuildCustomerFolder", body),

  // Re-sync the cached folder index from the org's index sheet (on-demand).
  refreshFolderIndex: () =>
    callFunction<{ ok: boolean; count?: number; deleted?: number; error?: string }>("customerFolderIndexRefresh", {}),
};

