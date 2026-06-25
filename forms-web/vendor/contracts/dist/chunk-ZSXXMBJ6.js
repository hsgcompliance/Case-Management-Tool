import {
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/google.ts
var google_exports = {};
__export(google_exports, {
  GoogleAuthMode: () => GoogleAuthMode,
  GoogleConnectStartBody: () => GoogleConnectStartBody,
  GoogleIntegrationMode: () => GoogleIntegrationMode,
  GoogleIntegrationStatus: () => GoogleIntegrationStatus,
  GooglePermissionStatus: () => GooglePermissionStatus,
  GoogleService: () => GoogleService
});
var GoogleService = z.enum(["googleCalendar", "googleDrive"]);
var GoogleIntegrationMode = z.enum(["permanent", "temporary", "off"]);
var GoogleAuthMode = z.enum([
  "server_user_oauth",
  "user_access_token",
  "shared_refresh_token",
  "service_account",
  "none"
]);
var GooglePermissionStatus = z.enum([
  "connected",
  "needs_reconnect",
  "revoked",
  "error",
  "disconnected"
]);
var GoogleIntegrationStatus = z.object({
  service: GoogleService,
  connected: z.boolean(),
  googleEmail: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  connectedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lastSyncAt: z.string().optional(),
  accessTokenExpiresAt: z.string().nullable().optional(),
  permissionStatus: GooglePermissionStatus
});
var GoogleConnectStartBody = z.object({}).optional();

export {
  GoogleService,
  GoogleIntegrationMode,
  GoogleAuthMode,
  GooglePermissionStatus,
  GoogleIntegrationStatus,
  GoogleConnectStartBody,
  google_exports
};
