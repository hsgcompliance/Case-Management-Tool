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

  // ── TSS workbook linking ────────────────────────────────────────────────────
  // Mirrors the web flows: link an existing sheet (by URL or by scanning the
  // customer folder), convert an .xlsx/.xls into a native Sheet, or build a fresh
  // workbook from the org's configured TSS template. The backend resolves the
  // customer + its folder server-side and writes customerDrive.linkedWorkbooks.tss.

  // List the Google Sheets / Excel files in the customer's linked Drive folder.
  // status: "ok" | "folder_missing" | "google_drive_not_connected".
  listWorkbookCandidates: (customerId: string) =>
    callFunction<WorkbookCandidatesResponse>(
      "listCustomerFolderWorkbookCandidates",
      { customerId },
      { method: "GET" },
    ),

  // Link an existing Google Sheet by pasted URL.
  linkWorkbookByUrl: (body: { customerId: string; workbookUrl: string; enrollmentId?: string; variant?: "payer" | "nonpayer" }) =>
    callFunction<WorkbookActionResponse>("attachCustomerWorkbookByUrl", body),

  // Link a sheet chosen from the folder candidate list.
  linkWorkbookCandidate: (body: {
    customerId: string;
    spreadsheetId: string;
    spreadsheetName?: string;
    enrollmentId?: string;
    variant?: "payer" | "nonpayer";
  }) => callFunction<WorkbookActionResponse>("attachCustomerWorkbookCandidate", body),

  // Convert an .xlsx/.xls file in the folder into a native Sheet, then link it.
  convertWorkbookXlsx: (body: { customerId: string; fileId: string; fileName?: string; enrollmentId?: string; variant?: "payer" | "nonpayer" }) =>
    callFunction<WorkbookActionResponse & { converted?: boolean }>("convertCustomerWorkbookXlsx", body),

  // Copy the org's configured TSS template (payer / non-payer) into the customer
  // folder and link the copy. Source ids are resolved server-side from org config.
  buildWorkbookFromTemplate: (body: { customerId: string; variant: "payer" | "nonpayer"; enrollmentId?: string }) =>
    callFunction<WorkbookActionResponse & { copiedFromTemplateId?: string }>("copyCustomerWorkbookFromTemplate", body),

  // Toggle the payer/non-payer variant on an already-linked workbook. Pure
  // metadata write (no Drive call) — controls AI case note assistant eligibility.
  setWorkbookVariant: (body: { customerId: string; variant: "payer" | "nonpayer" }) =>
    callFunction<WorkbookActionResponse>("setCustomerWorkbookVariant", body),
};

// ── Workbook linking response shapes ──────────────────────────────────────────

export type WorkbookActionResponse = {
  ok: boolean;
  error?: string;
  category?: string;
  reconnectService?: string;
  hint?: string;
  workbook?: { spreadsheetId: string; spreadsheetUrl: string; spreadsheetName?: string };
};

export type WorkbookCandidate = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string | null;
  iconLink: string | null;
  isFolder: boolean;
  isSpreadsheet: boolean;
};

export type WorkbookCandidatesResponse = {
  ok: boolean;
  status?: "ok" | "folder_missing" | "google_drive_not_connected";
  folderId?: string;
  items?: WorkbookCandidate[];
  error?: string;
};

