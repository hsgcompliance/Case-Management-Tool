import { callFunction } from "@/lib/functionsApi";
import type { ReqOf, RespOf, TGoogleService } from "@hdb/contracts";

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

  disconnect: (service: GoogleIntegrationService) =>
    callFunction<RespOf<"calendarDisconnect"> | RespOf<"driveDisconnect">>(
      endpointByService[service].disconnect,
      {},
    ),

  postCalendarEvent: (body: CalendarPostEventInput) =>
    callFunction<RespOf<"calendarPostEvent">>("calendarPostEvent", body),
};

