import { z } from "./core.js";
export declare const GoogleService: z.ZodEnum<{
    googleCalendar: "googleCalendar";
    googleDrive: "googleDrive";
}>;
export type TGoogleService = z.infer<typeof GoogleService>;
export declare const GoogleIntegrationMode: z.ZodEnum<{
    permanent: "permanent";
    temporary: "temporary";
    off: "off";
}>;
export type TGoogleIntegrationMode = z.infer<typeof GoogleIntegrationMode>;
export declare const GoogleAuthMode: z.ZodEnum<{
    none: "none";
    server_user_oauth: "server_user_oauth";
    user_access_token: "user_access_token";
    shared_refresh_token: "shared_refresh_token";
    service_account: "service_account";
}>;
export type TGoogleAuthMode = z.infer<typeof GoogleAuthMode>;
export declare const GooglePermissionStatus: z.ZodEnum<{
    error: "error";
    connected: "connected";
    needs_reconnect: "needs_reconnect";
    revoked: "revoked";
    disconnected: "disconnected";
}>;
export type TGooglePermissionStatus = z.infer<typeof GooglePermissionStatus>;
export declare const GoogleIntegrationStatus: z.ZodObject<{
    service: z.ZodEnum<{
        googleCalendar: "googleCalendar";
        googleDrive: "googleDrive";
    }>;
    connected: z.ZodBoolean;
    googleEmail: z.ZodOptional<z.ZodString>;
    scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    connectedAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
    lastSyncAt: z.ZodOptional<z.ZodString>;
    accessTokenExpiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    permissionStatus: z.ZodEnum<{
        error: "error";
        connected: "connected";
        needs_reconnect: "needs_reconnect";
        revoked: "revoked";
        disconnected: "disconnected";
    }>;
}, z.core.$strip>;
export type TGoogleIntegrationStatus = z.infer<typeof GoogleIntegrationStatus>;
export declare const GoogleConnectStartBody: z.ZodOptional<z.ZodObject<{}, z.core.$strip>>;
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
    code?: "google_not_connected" | "google_needs_reconnect" | "google_permission_denied" | "oauth_state_invalid" | "oauth_state_expired" | "oauth_code_exchange_failed" | "auth_mode_read_only" | "unknown";
    service?: TGoogleService;
    authMode?: TGoogleAuthMode;
    category?: string;
    hint?: string;
};
