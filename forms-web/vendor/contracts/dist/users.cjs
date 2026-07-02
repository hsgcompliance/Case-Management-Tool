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

// src/users.ts
var users_exports = {};
__export(users_exports, {
  CreateUserBody: () => CreateUserBody,
  GoogleCalendarIntegration: () => GoogleCalendarIntegration,
  GoogleDriveIntegration: () => GoogleDriveIntegration,
  InviteUserBody: () => InviteUserBody,
  ListUsersBody: () => ListUsersBody,
  OrgManagerListOrgsBody: () => OrgManagerListOrgsBody,
  OrgManagerOrg: () => OrgManagerOrg,
  OrgManagerPatchTeamsBody: () => OrgManagerPatchTeamsBody,
  OrgManagerTeam: () => OrgManagerTeam,
  OrgManagerUpsertOrgBody: () => OrgManagerUpsertOrgBody,
  ResendInviteBody: () => ResendInviteBody,
  RevokeSessionsBody: () => RevokeSessionsBody,
  RoleInput: () => RoleInput,
  RoleTagCanonical: () => RoleTagCanonical,
  RolesArray: () => RolesArray,
  SetActiveBody: () => SetActiveBody,
  SetRoleBody: () => SetRoleBody,
  TopRoleCanonical: () => TopRoleCanonical,
  TopRoleLadder: () => TopRoleLadder,
  TourProgressEntry: () => TourProgressEntry,
  TourProgressStatus: () => TourProgressStatus,
  UpdateMeBody: () => UpdateMeBody,
  UpdateUserProfileBody: () => UpdateUserProfileBody,
  UserCustomersPageMode: () => UserCustomersPageMode,
  UserDashboardPrefs: () => UserDashboardPrefs,
  UserDigestSubs: () => UserDigestSubs,
  UserExtras: () => UserExtras,
  UserGameHighScores: () => UserGameHighScores,
  UserGameMeta: () => UserGameMeta,
  UserGameRecord: () => UserGameRecord,
  UserGrantPrefs: () => UserGrantPrefs,
  UserMetrics: () => UserMetrics,
  UserPaymentMetrics: () => UserPaymentMetrics,
  UserPinnedItem: () => UserPinnedItem,
  UserSettings: () => UserSettings,
  UserTaskMetrics: () => UserTaskMetrics,
  UserToursState: () => UserToursState
});
module.exports = __toCommonJS(users_exports);

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
var TsLike = TimestampLike;
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

// src/users.ts
var RoleTagCanonical = import_zod2.z.enum(["casemanager", "compliance", "viewer"]);
var TopRoleCanonical = import_zod2.z.enum(["viewer", "user", "admin", "dev", "org_dev", "super_dev"]);
var TopRoleLadder = import_zod2.z.enum([
  "unverified",
  "public_user",
  "viewer",
  "user",
  "admin",
  "dev",
  "org_dev",
  "super_dev"
]);
var ROLE_ALIAS = {
  casemanager: "casemanager",
  cm: "casemanager",
  case: "casemanager",
  manager: "casemanager",
  caseworker: "casemanager",
  casemgr: "casemanager",
  caseworkermanager: "casemanager",
  compliance: "compliance",
  viewer: "viewer",
  view: "viewer",
  read: "viewer",
  readonly: "viewer"
};
var RoleInput = import_zod2.z.string().transform((v) => {
  const k = String(v || "").toLowerCase().replace(/[\s_-]+/g, "");
  const mapped = ROLE_ALIAS[k];
  if (!mapped) throw new Error(`invalid_role:${v}`);
  return mapped;
});
var RolesArray = import_zod2.z.array(RoleInput).default([]);
var CreateUserBody = import_zod2.z.object({
  email: import_zod2.z.email(),
  password: import_zod2.z.string().min(6),
  name: import_zod2.z.string().trim().optional().default(""),
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: import_zod2.z.array(Id).max(10).optional()
});
var InviteUserBody = import_zod2.z.object({
  email: import_zod2.z.email(),
  name: import_zod2.z.string().trim().optional().default(""),
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: import_zod2.z.array(Id).max(10).optional(),
  sendEmail: import_zod2.z.boolean().optional().default(true),
  continueUrl: import_zod2.z.string().url().optional()
});
var SetRoleBody = import_zod2.z.object({
  uid: Id,
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: import_zod2.z.array(Id).max(10).optional(),
  displayName: import_zod2.z.string().trim().max(120).nullable().optional()
});
var SetActiveBody = import_zod2.z.object({
  uid: Id,
  active: import_zod2.z.boolean()
});
var UpdateUserProfileBody = import_zod2.z.object({
  uid: Id,
  displayName: import_zod2.z.string().trim().max(120).nullable().optional()
});
var ResendInviteBody = import_zod2.z.object({
  uid: Id.optional(),
  email: import_zod2.z.email().optional(),
  continueUrl: import_zod2.z.string().url().optional()
}).refine((v) => !!v.uid || !!v.email, {
  message: "uid_or_email_required"
});
var RevokeSessionsBody = import_zod2.z.object({
  orgId: Id.optional()
});
var ListUsersBody = import_zod2.z.object({
  limit: import_zod2.z.number().int().min(1).max(1e3).optional().default(100),
  pageToken: import_zod2.z.string().optional(),
  status: import_zod2.z.enum(["all", "active", "inactive"]).optional().default("all")
});
var OrgManagerTeam = import_zod2.z.object({
  id: Id,
  name: import_zod2.z.string().trim().min(1).optional(),
  active: import_zod2.z.boolean().optional().default(true)
});
var OrgManagerOrg = import_zod2.z.object({
  id: Id,
  name: import_zod2.z.string().trim().min(1),
  active: import_zod2.z.boolean().optional().default(true),
  teams: import_zod2.z.array(OrgManagerTeam).optional().default([]),
  createdAt: import_zod2.z.unknown().optional(),
  updatedAt: import_zod2.z.unknown().optional()
}).passthrough();
var OrgManagerListOrgsBody = import_zod2.z.object({
  includeInactive: import_zod2.z.boolean().optional().default(true)
});
var OrgManagerUpsertOrgBody = import_zod2.z.object({
  id: Id,
  name: import_zod2.z.string().trim().min(1),
  active: import_zod2.z.boolean().optional().default(true)
});
var OrgManagerPatchTeamsBody = import_zod2.z.object({
  orgId: Id,
  add: import_zod2.z.array(import_zod2.z.union([Id, OrgManagerTeam])).max(25).optional(),
  remove: import_zod2.z.array(Id).max(25).optional()
}).refine((v) => (v.add?.length || 0) > 0 || (v.remove?.length || 0) > 0, {
  message: "empty_patch"
});
var UserMetrics = import_zod2.z.object({
  caseloadActive: import_zod2.z.number().int().nonnegative().nullable().optional(),
  acuityScoreSum: import_zod2.z.number().nullable().optional(),
  acuityScoreCount: import_zod2.z.number().nonnegative().nullable().optional(),
  acuityScoreAvg: import_zod2.z.number().nullable().optional(),
  lastAcuityUpdatedAt: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.date()]).nullable().optional(),
  enrollmentCount: import_zod2.z.number().int().nonnegative().nullable().optional()
}).partial();
var UserTaskMetrics = import_zod2.z.object({
  openThisMonth: import_zod2.z.number().int().nonnegative().nullable().optional(),
  openNextMonth: import_zod2.z.number().int().nonnegative().nullable().optional(),
  byType: import_zod2.z.record(
    import_zod2.z.string(),
    import_zod2.z.object({
      thisMonth: import_zod2.z.number().int().nonnegative().optional(),
      nextMonth: import_zod2.z.number().int().nonnegative().optional()
    })
  ).nullable().optional(),
  updatedAt: import_zod2.z.unknown().optional(),
  reconciledAt: import_zod2.z.unknown().optional()
}).partial();
var UserPaymentMetrics = import_zod2.z.object({
  unpaidThisMonth: import_zod2.z.number().int().nonnegative().nullable().optional(),
  unpaidNextMonth: import_zod2.z.number().int().nonnegative().nullable().optional(),
  unpaidTotal: import_zod2.z.number().int().nonnegative().nullable().optional(),
  amountThisMonth: import_zod2.z.number().nullable().optional(),
  amountNextMonth: import_zod2.z.number().nullable().optional(),
  amountTotal: import_zod2.z.number().nullable().optional(),
  updatedAt: import_zod2.z.unknown().optional(),
  reconciledAt: import_zod2.z.unknown().optional()
}).partial();
var UserUnknownRecord = import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown());
var UserSettings = import_zod2.z.object({
  pageLayouts: UserUnknownRecord.optional(),
  dashboardPrefs: UserUnknownRecord.optional(),
  toolsPrefs: UserUnknownRecord.optional(),
  spendingViews: UserUnknownRecord.optional(),
  allowAiAssistance: import_zod2.z.boolean().optional(),
  googleIntegrationModes: import_zod2.z.object({
    googleCalendar: GoogleIntegrationMode.optional(),
    googleDrive: GoogleIntegrationMode.optional()
  }).optional()
}).catchall(import_zod2.z.unknown()).partial();
var UserDigestSubs = import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown());
var UserPinnedItem = import_zod2.z.object({
  type: import_zod2.z.string(),
  id: import_zod2.z.string()
}).passthrough();
var UserDashboardPrefs = import_zod2.z.object({
  activeToolId: import_zod2.z.string().nullable().optional(),
  pinnedToolIds: import_zod2.z.array(import_zod2.z.string()).nullable().optional(),
  recency: import_zod2.z.array(import_zod2.z.string()).nullable().optional(),
  updatedAt: import_zod2.z.unknown().optional()
}).partial();
var UserCustomersPageMode = import_zod2.z.enum(["legacy", "new"]);
var UserGrantPrefs = import_zod2.z.object({
  pinnedGrantIds: import_zod2.z.array(import_zod2.z.string()).nullish(),
  metricsPinnedGrantId: import_zod2.z.string().nullish(),
  updatedAt: import_zod2.z.unknown().optional()
}).passthrough();
var TourProgressStatus = import_zod2.z.enum(["in_progress", "completed", "abandoned"]);
var TourProgressEntry = import_zod2.z.object({
  stepIndex: import_zod2.z.number().int().nonnegative().optional(),
  status: TourProgressStatus.optional(),
  updatedAt: import_zod2.z.union([import_zod2.z.number(), TsLike]).optional()
});
var UserToursState = import_zod2.z.object({
  progress: import_zod2.z.record(import_zod2.z.string(), TourProgressEntry).optional().default({}),
  dismissedAllPrompt: import_zod2.z.boolean().optional(),
  updatedAt: TsLike.optional()
});
var UserGameRecord = import_zod2.z.object({
  highScore: import_zod2.z.number().int().nonnegative().optional(),
  lastPlayed: import_zod2.z.string().optional(),
  // ISO date
  gamesPlayed: import_zod2.z.number().int().nonnegative().optional()
}).catchall(import_zod2.z.unknown());
var UserGameMeta = import_zod2.z.record(import_zod2.z.string(), UserGameRecord);
var UserGameHighScores = import_zod2.z.object({
  runner: import_zod2.z.number().int().nonnegative().optional(),
  snake: import_zod2.z.number().int().nonnegative().optional(),
  space_invaders: import_zod2.z.number().int().nonnegative().optional(),
  tower_defense_round: import_zod2.z.number().int().nonnegative().optional()
}).catchall(import_zod2.z.number().int().nonnegative());
var IntegrationPermissionStatus = import_zod2.z.enum([
  "connected",
  "needs_reconnect",
  "revoked",
  "error",
  "disconnected"
]);
var GoogleCalendarIntegration = import_zod2.z.object({
  connected: import_zod2.z.boolean(),
  googleEmail: import_zod2.z.string().optional(),
  scopes: import_zod2.z.array(import_zod2.z.string()).optional(),
  connectedAt: import_zod2.z.string().optional(),
  // ISO
  updatedAt: import_zod2.z.string().optional(),
  // ISO
  lastSyncAt: import_zod2.z.string().optional(),
  // ISO
  accessTokenExpiresAt: import_zod2.z.string().optional(),
  // ISO — for UI "expires soon" warning only
  permissionStatus: IntegrationPermissionStatus
});
var GoogleDriveIntegration = import_zod2.z.object({
  connected: import_zod2.z.boolean(),
  googleEmail: import_zod2.z.string().optional(),
  scopes: import_zod2.z.array(import_zod2.z.string()).optional(),
  connectedAt: import_zod2.z.string().optional(),
  updatedAt: import_zod2.z.string().optional(),
  accessTokenExpiresAt: import_zod2.z.string().optional(),
  permissionStatus: IntegrationPermissionStatus
});
var UserExtras = import_zod2.z.object({
  // Human-editable
  notes: import_zod2.z.string().trim().nullable().optional(),
  settings: UserSettings.nullable().optional(),
  meta: UserUnknownRecord.nullable().optional(),
  // Feature sub-objects
  dashboardPrefs: UserDashboardPrefs.nullable().optional(),
  digestSubs: UserDigestSubs.nullable().optional(),
  pinnedItems: import_zod2.z.array(UserPinnedItem).nullable().optional(),
  tours: UserToursState.nullable().optional(),
  game_meta: UserGameMeta.optional(),
  // Legacy — kept readable so migration code can pull old scores
  gameHighScores: UserGameHighScores.optional(),
  quickBreakHighScore: import_zod2.z.number().int().nonnegative().optional(),
  // User-level pin preferences
  grantPrefs: UserGrantPrefs.nullable().optional(),
  // User preferences
  taskMode: import_zod2.z.enum(["viewer", "workflow"]).nullable().optional(),
  taskModeSetAt: import_zod2.z.string().nullable().optional(),
  taskModeSetBy: import_zod2.z.enum(["self", "admin", "system"]).nullable().optional(),
  digestOptOut: import_zod2.z.boolean().nullable().optional(),
  digestFrequency: import_zod2.z.enum(["monthly", "off"]).nullable().optional(),
  customersPageMode: UserCustomersPageMode.nullable().optional(),
  // --- Flat indexable metrics (top-level for Firestore query support) ---
  caseloadActive: import_zod2.z.number().int().nonnegative().nullable().optional(),
  clientTotal: import_zod2.z.number().int().nonnegative().nullable().optional(),
  clientActive: import_zod2.z.number().int().nonnegative().nullable().optional(),
  clientInactive: import_zod2.z.number().int().nonnegative().nullable().optional(),
  clientPopulationCounts: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.number().int().nonnegative()).nullable().optional(),
  enrollmentCount: import_zod2.z.number().int().nonnegative().nullable().optional(),
  enrollmentActive: import_zod2.z.number().int().nonnegative().nullable().optional(),
  enrollmentInactive: import_zod2.z.number().int().nonnegative().nullable().optional(),
  enrollmentPopulationCounts: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.number().int().nonnegative()).nullable().optional(),
  acuityScoreSum: import_zod2.z.number().nullable().optional(),
  acuityScoreCount: import_zod2.z.number().nonnegative().nullable().optional(),
  acuityScoreAvg: import_zod2.z.number().nullable().optional(),
  lastAcuityUpdatedAt: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.date()]).nullable().optional(),
  // Grouped metrics sub-objects (written by server-side triggers, not user-settable)
  taskMetrics: UserTaskMetrics.nullable().optional(),
  paymentMetrics: UserPaymentMetrics.nullable().optional(),
  // ── Third-party integrations (public metadata only — no tokens) ──────────
  // Firebase Auth handles app login. Google Calendar/Drive connectors are
  // separate OAuth integrations. Tokens live server-side in userSecrets/{uid}.
  // Only safe connection metadata is stored here.
  integrations: import_zod2.z.object({
    googleCalendar: GoogleCalendarIntegration.optional(),
    googleDrive: GoogleDriveIntegration.optional()
  }).optional()
}).strict();
var UpdateMeBody = import_zod2.z.object({
  updates: UserExtras
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CreateUserBody,
  GoogleCalendarIntegration,
  GoogleDriveIntegration,
  InviteUserBody,
  ListUsersBody,
  OrgManagerListOrgsBody,
  OrgManagerOrg,
  OrgManagerPatchTeamsBody,
  OrgManagerTeam,
  OrgManagerUpsertOrgBody,
  ResendInviteBody,
  RevokeSessionsBody,
  RoleInput,
  RoleTagCanonical,
  RolesArray,
  SetActiveBody,
  SetRoleBody,
  TopRoleCanonical,
  TopRoleLadder,
  TourProgressEntry,
  TourProgressStatus,
  UpdateMeBody,
  UpdateUserProfileBody,
  UserCustomersPageMode,
  UserDashboardPrefs,
  UserDigestSubs,
  UserExtras,
  UserGameHighScores,
  UserGameMeta,
  UserGameRecord,
  UserGrantPrefs,
  UserMetrics,
  UserPaymentMetrics,
  UserPinnedItem,
  UserSettings,
  UserTaskMetrics,
  UserToursState
});
