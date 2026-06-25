"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
module.exports = __toCommonJS(google_exports);

// src/core.ts
var import_zod = require("zod");
var import_zod2 = require("zod");
var Id = import_zod.z.string().trim().min(1);
var Ids = import_zod.z.array(Id).min(1);
var IdLike = import_zod.z.preprocess((v) => {
  if (typeof v === "string" || typeof v === "number") return String(v);
  return v;
}, Id);
var GrantIdsLike = import_zod.z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return v;
}, import_zod.z.array(Id).min(1));
var TimestampLike = import_zod.z.union([
  import_zod.z.string(),
  // ISO
  import_zod.z.number(),
  // millis
  import_zod.z.object({ seconds: import_zod.z.number(), nanoseconds: import_zod.z.number() })
  // Firestore JSON-ish
]);
var ISO10 = import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var BoolLike = import_zod.z.union([
  import_zod.z.boolean(),
  import_zod.z.literal("true"),
  import_zod.z.literal("false"),
  import_zod.z.literal(1),
  import_zod.z.literal(0),
  import_zod.z.literal("1"),
  import_zod.z.literal("0")
]);
var BoolFromLike = import_zod.z.preprocess((v) => {
  if (Array.isArray(v)) v = v[0];
  if (v === "" || v === null || v === void 0) return v;
  if (v === true || v === false) return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return v;
}, import_zod.z.boolean());
var JsonObj = import_zod.z.object({}).catchall(import_zod.z.unknown());
var JsonObjLike = import_zod.z.preprocess((v) => {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? parsed : v;
    } catch {
      return v;
    }
  }
  return v;
}, JsonObj);

// src/google.ts
var GoogleService = import_zod2.z.enum(["googleCalendar", "googleDrive"]);
var GoogleIntegrationMode = import_zod2.z.enum(["permanent", "temporary", "off"]);
var GoogleAuthMode = import_zod2.z.enum([
  "server_user_oauth",
  "user_access_token",
  "shared_refresh_token",
  "service_account",
  "none"
]);
var GooglePermissionStatus = import_zod2.z.enum([
  "connected",
  "needs_reconnect",
  "revoked",
  "error",
  "disconnected"
]);
var GoogleIntegrationStatus = import_zod2.z.object({
  service: GoogleService,
  connected: import_zod2.z.boolean(),
  googleEmail: import_zod2.z.string().optional(),
  scopes: import_zod2.z.array(import_zod2.z.string()).optional(),
  connectedAt: import_zod2.z.string().optional(),
  updatedAt: import_zod2.z.string().optional(),
  lastSyncAt: import_zod2.z.string().optional(),
  accessTokenExpiresAt: import_zod2.z.string().nullable().optional(),
  permissionStatus: GooglePermissionStatus
});
var GoogleConnectStartBody = import_zod2.z.object({}).optional();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GoogleAuthMode,
  GoogleConnectStartBody,
  GoogleIntegrationMode,
  GoogleIntegrationStatus,
  GooglePermissionStatus,
  GoogleService
});
