import api from "./api";
import type {
  GoogleConnectStartResp,
  GoogleDisconnectResp,
  GoogleStatusResp,
  TGoogleIntegrationMode,
  TGoogleService,
} from "@types";

export type GoogleIntegrationService = TGoogleService;
export type GoogleIntegrationMode = TGoogleIntegrationMode;
export type GoogleIntegrationStatus = GoogleStatusResp;

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
    api.get(endpointByService[service].status) as Promise<GoogleStatusResp>,

  connect: async (service: GoogleIntegrationService) => {
    const resp = (await api.post(endpointByService[service].connect, {})) as GoogleConnectStartResp;
    if (resp.ok && resp.authUrl) window.location.href = resp.authUrl;
    return resp;
  },

  disconnect: (service: GoogleIntegrationService) =>
    api.post(endpointByService[service].disconnect, {}) as Promise<GoogleDisconnectResp>,
};

export default GoogleIntegrations;
