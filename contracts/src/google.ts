import { z } from "./core";

export const GoogleService = z.enum(["googleCalendar", "googleDrive"]);
export type TGoogleService = z.infer<typeof GoogleService>;

export const GoogleIntegrationMode = z.enum(["permanent", "temporary", "off"]);
export type TGoogleIntegrationMode = z.infer<typeof GoogleIntegrationMode>;

export const GoogleAuthMode = z.enum([
  "server_user_oauth",
  "user_access_token",
  "shared_refresh_token",
  "service_account",
  "none",
]);
export type TGoogleAuthMode = z.infer<typeof GoogleAuthMode>;

export const GooglePermissionStatus = z.enum([
  "connected",
  "needs_reconnect",
  "revoked",
  "error",
  "disconnected",
]);
export type TGooglePermissionStatus = z.infer<typeof GooglePermissionStatus>;

export const GoogleIntegrationStatus = z.object({
  service: GoogleService,
  connected: z.boolean(),
  googleEmail: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  connectedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lastSyncAt: z.string().optional(),
  accessTokenExpiresAt: z.string().nullable().optional(),
  permissionStatus: GooglePermissionStatus,
});
export type TGoogleIntegrationStatus = z.infer<typeof GoogleIntegrationStatus>;

export const GoogleConnectStartBody = z.object({}).optional();
export type TGoogleConnectStartBody = z.infer<typeof GoogleConnectStartBody>;

export type TGoogleConnectStartRespBody = {
  service: TGoogleService;
  authUrl: string;
};

export type TGoogleDisconnectRespBody = {
  service: TGoogleService;
  connected: false;
  permissionStatus: "disconnected";
};

export type TGoogleIntegrationStatusRespBody = TGoogleIntegrationStatus;

export type TGoogleEndpointError = {
  ok: false;
  error: string;
  code?:
    | "google_not_connected"
    | "google_needs_reconnect"
    | "google_permission_denied"
    | "oauth_state_invalid"
    | "oauth_state_expired"
    | "oauth_code_exchange_failed"
    | "auth_mode_read_only"
    | "unknown";
  service?: TGoogleService;
  authMode?: TGoogleAuthMode;
  category?: string;
  hint?: string;
};
