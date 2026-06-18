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

  // Append a progress-note row to the customer's linked TSS workbook (strict
  // per-user server OAuth on the backend; caller sends customerId + values only).
  pushWorkbookRow: (body: { customerId: string; entityId: string; values: Record<string, string> }) =>
    callFunction<{ ok: boolean; error?: string; rowKey?: string }>("appendCustomerWorkbookRow", body),

  // Read-only native extraction of the customer's linked TSS workbook (goals,
  // progress notes, …). Fails closed (ok:false) when Drive isn't connected or no
  // workbook is linked, so callers fall back to the open-in-Sheets link.
  getWorkbookData: (customerId: string) =>
    callFunction<WorkbookDataResponse>("getWorkbookData", { customerId }, { method: "GET" }),
};

