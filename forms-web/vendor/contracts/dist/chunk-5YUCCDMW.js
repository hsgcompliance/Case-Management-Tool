import {
  GoogleIntegrationMode
} from "./chunk-ZSXXMBJ6.js";
import {
  Id,
  TsLike,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

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
var RoleTagCanonical = z.enum(["casemanager", "compliance", "viewer"]);
var TopRoleCanonical = z.enum(["viewer", "user", "admin", "dev", "org_dev", "super_dev"]);
var TopRoleLadder = z.enum([
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
var RoleInput = z.string().transform((v) => {
  const k = String(v || "").toLowerCase().replace(/[\s_-]+/g, "");
  const mapped = ROLE_ALIAS[k];
  if (!mapped) throw new Error(`invalid_role:${v}`);
  return mapped;
});
var RolesArray = z.array(RoleInput).default([]);
var CreateUserBody = z.object({
  email: z.email(),
  password: z.string().min(6),
  name: z.string().trim().optional().default(""),
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: z.array(Id).max(10).optional()
});
var InviteUserBody = z.object({
  email: z.email(),
  name: z.string().trim().optional().default(""),
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: z.array(Id).max(10).optional(),
  sendEmail: z.boolean().optional().default(true),
  continueUrl: z.string().url().optional()
});
var SetRoleBody = z.object({
  uid: Id,
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: z.array(Id).max(10).optional(),
  displayName: z.string().trim().max(120).nullable().optional()
});
var SetActiveBody = z.object({
  uid: Id,
  active: z.boolean()
});
var UpdateUserProfileBody = z.object({
  uid: Id,
  displayName: z.string().trim().max(120).nullable().optional()
});
var ResendInviteBody = z.object({
  uid: Id.optional(),
  email: z.email().optional(),
  continueUrl: z.string().url().optional()
}).refine((v) => !!v.uid || !!v.email, {
  message: "uid_or_email_required"
});
var RevokeSessionsBody = z.object({
  orgId: Id.optional()
});
var ListUsersBody = z.object({
  limit: z.number().int().min(1).max(1e3).optional().default(100),
  pageToken: z.string().optional(),
  status: z.enum(["all", "active", "inactive"]).optional().default("all")
});
var OrgManagerTeam = z.object({
  id: Id,
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional().default(true)
});
var OrgManagerOrg = z.object({
  id: Id,
  name: z.string().trim().min(1),
  active: z.boolean().optional().default(true),
  teams: z.array(OrgManagerTeam).optional().default([]),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional()
}).passthrough();
var OrgManagerListOrgsBody = z.object({
  includeInactive: z.boolean().optional().default(true)
});
var OrgManagerUpsertOrgBody = z.object({
  id: Id,
  name: z.string().trim().min(1),
  active: z.boolean().optional().default(true)
});
var OrgManagerPatchTeamsBody = z.object({
  orgId: Id,
  add: z.array(z.union([Id, OrgManagerTeam])).max(25).optional(),
  remove: z.array(Id).max(25).optional()
}).refine((v) => (v.add?.length || 0) > 0 || (v.remove?.length || 0) > 0, {
  message: "empty_patch"
});
var UserMetrics = z.object({
  caseloadActive: z.number().int().nonnegative().nullable().optional(),
  acuityScoreSum: z.number().nullable().optional(),
  acuityScoreCount: z.number().nonnegative().nullable().optional(),
  acuityScoreAvg: z.number().nullable().optional(),
  lastAcuityUpdatedAt: z.union([z.string(), z.date()]).nullable().optional(),
  enrollmentCount: z.number().int().nonnegative().nullable().optional()
}).partial();
var UserTaskMetrics = z.object({
  openThisMonth: z.number().int().nonnegative().nullable().optional(),
  openNextMonth: z.number().int().nonnegative().nullable().optional(),
  byType: z.record(
    z.string(),
    z.object({
      thisMonth: z.number().int().nonnegative().optional(),
      nextMonth: z.number().int().nonnegative().optional()
    })
  ).nullable().optional(),
  updatedAt: z.unknown().optional(),
  reconciledAt: z.unknown().optional()
}).partial();
var UserPaymentMetrics = z.object({
  unpaidThisMonth: z.number().int().nonnegative().nullable().optional(),
  unpaidNextMonth: z.number().int().nonnegative().nullable().optional(),
  unpaidTotal: z.number().int().nonnegative().nullable().optional(),
  amountThisMonth: z.number().nullable().optional(),
  amountNextMonth: z.number().nullable().optional(),
  amountTotal: z.number().nullable().optional(),
  updatedAt: z.unknown().optional(),
  reconciledAt: z.unknown().optional()
}).partial();
var UserUnknownRecord = z.record(z.string(), z.unknown());
var UserSettings = z.object({
  pageLayouts: UserUnknownRecord.optional(),
  dashboardPrefs: UserUnknownRecord.optional(),
  toolsPrefs: UserUnknownRecord.optional(),
  spendingViews: UserUnknownRecord.optional(),
  allowAiAssistance: z.boolean().optional(),
  googleIntegrationModes: z.object({
    googleCalendar: GoogleIntegrationMode.optional(),
    googleDrive: GoogleIntegrationMode.optional()
  }).optional()
}).catchall(z.unknown()).partial();
var UserDigestSubs = z.record(z.string(), z.unknown());
var UserPinnedItem = z.object({
  type: z.string(),
  id: z.string()
}).passthrough();
var UserDashboardPrefs = z.object({
  activeToolId: z.string().nullable().optional(),
  pinnedToolIds: z.array(z.string()).nullable().optional(),
  recency: z.array(z.string()).nullable().optional(),
  updatedAt: z.unknown().optional()
}).partial();
var UserCustomersPageMode = z.enum(["legacy", "new"]);
var UserGrantPrefs = z.object({
  pinnedGrantIds: z.array(z.string()).nullish(),
  metricsPinnedGrantId: z.string().nullish(),
  updatedAt: z.unknown().optional()
}).passthrough();
var TourProgressStatus = z.enum(["in_progress", "completed", "abandoned"]);
var TourProgressEntry = z.object({
  stepIndex: z.number().int().nonnegative().optional(),
  status: TourProgressStatus.optional(),
  updatedAt: z.union([z.number(), TsLike]).optional()
});
var UserToursState = z.object({
  progress: z.record(z.string(), TourProgressEntry).optional().default({}),
  dismissedAllPrompt: z.boolean().optional(),
  updatedAt: TsLike.optional()
});
var UserGameRecord = z.object({
  highScore: z.number().int().nonnegative().optional(),
  lastPlayed: z.string().optional(),
  // ISO date
  gamesPlayed: z.number().int().nonnegative().optional()
}).catchall(z.unknown());
var UserGameMeta = z.record(z.string(), UserGameRecord);
var UserGameHighScores = z.object({
  runner: z.number().int().nonnegative().optional(),
  snake: z.number().int().nonnegative().optional(),
  space_invaders: z.number().int().nonnegative().optional(),
  tower_defense_round: z.number().int().nonnegative().optional()
}).catchall(z.number().int().nonnegative());
var IntegrationPermissionStatus = z.enum([
  "connected",
  "needs_reconnect",
  "revoked",
  "error",
  "disconnected"
]);
var GoogleCalendarIntegration = z.object({
  connected: z.boolean(),
  googleEmail: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  connectedAt: z.string().optional(),
  // ISO
  updatedAt: z.string().optional(),
  // ISO
  lastSyncAt: z.string().optional(),
  // ISO
  accessTokenExpiresAt: z.string().optional(),
  // ISO — for UI "expires soon" warning only
  permissionStatus: IntegrationPermissionStatus
});
var GoogleDriveIntegration = z.object({
  connected: z.boolean(),
  googleEmail: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  connectedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  accessTokenExpiresAt: z.string().optional(),
  permissionStatus: IntegrationPermissionStatus
});
var UserExtras = z.object({
  // Human-editable
  notes: z.string().trim().nullable().optional(),
  settings: UserSettings.nullable().optional(),
  meta: UserUnknownRecord.nullable().optional(),
  // Feature sub-objects
  dashboardPrefs: UserDashboardPrefs.nullable().optional(),
  digestSubs: UserDigestSubs.nullable().optional(),
  pinnedItems: z.array(UserPinnedItem).nullable().optional(),
  tours: UserToursState.nullable().optional(),
  game_meta: UserGameMeta.optional(),
  // Legacy — kept readable so migration code can pull old scores
  gameHighScores: UserGameHighScores.optional(),
  quickBreakHighScore: z.number().int().nonnegative().optional(),
  // User-level pin preferences
  grantPrefs: UserGrantPrefs.nullable().optional(),
  // User preferences
  taskMode: z.enum(["viewer", "workflow"]).nullable().optional(),
  taskModeSetAt: z.string().nullable().optional(),
  taskModeSetBy: z.enum(["self", "admin", "system"]).nullable().optional(),
  digestOptOut: z.boolean().nullable().optional(),
  digestFrequency: z.enum(["monthly", "off"]).nullable().optional(),
  customersPageMode: UserCustomersPageMode.nullable().optional(),
  // --- Flat indexable metrics (top-level for Firestore query support) ---
  caseloadActive: z.number().int().nonnegative().nullable().optional(),
  clientTotal: z.number().int().nonnegative().nullable().optional(),
  clientActive: z.number().int().nonnegative().nullable().optional(),
  clientInactive: z.number().int().nonnegative().nullable().optional(),
  clientPopulationCounts: z.record(z.string(), z.number().int().nonnegative()).nullable().optional(),
  enrollmentCount: z.number().int().nonnegative().nullable().optional(),
  enrollmentActive: z.number().int().nonnegative().nullable().optional(),
  enrollmentInactive: z.number().int().nonnegative().nullable().optional(),
  enrollmentPopulationCounts: z.record(z.string(), z.number().int().nonnegative()).nullable().optional(),
  acuityScoreSum: z.number().nullable().optional(),
  acuityScoreCount: z.number().nonnegative().nullable().optional(),
  acuityScoreAvg: z.number().nullable().optional(),
  lastAcuityUpdatedAt: z.union([z.string(), z.date()]).nullable().optional(),
  // Grouped metrics sub-objects (written by server-side triggers, not user-settable)
  taskMetrics: UserTaskMetrics.nullable().optional(),
  paymentMetrics: UserPaymentMetrics.nullable().optional(),
  // ── Third-party integrations (public metadata only — no tokens) ──────────
  // Firebase Auth handles app login. Google Calendar/Drive connectors are
  // separate OAuth integrations. Tokens live server-side in userSecrets/{uid}.
  // Only safe connection metadata is stored here.
  integrations: z.object({
    googleCalendar: GoogleCalendarIntegration.optional(),
    googleDrive: GoogleDriveIntegration.optional()
  }).optional()
}).strict();
var UpdateMeBody = z.object({
  updates: UserExtras
});

export {
  RoleTagCanonical,
  TopRoleCanonical,
  TopRoleLadder,
  RoleInput,
  RolesArray,
  CreateUserBody,
  InviteUserBody,
  SetRoleBody,
  SetActiveBody,
  UpdateUserProfileBody,
  ResendInviteBody,
  RevokeSessionsBody,
  ListUsersBody,
  OrgManagerTeam,
  OrgManagerOrg,
  OrgManagerListOrgsBody,
  OrgManagerUpsertOrgBody,
  OrgManagerPatchTeamsBody,
  UserMetrics,
  UserTaskMetrics,
  UserPaymentMetrics,
  UserSettings,
  UserDigestSubs,
  UserPinnedItem,
  UserDashboardPrefs,
  UserCustomersPageMode,
  UserGrantPrefs,
  TourProgressStatus,
  TourProgressEntry,
  UserToursState,
  UserGameRecord,
  UserGameMeta,
  UserGameHighScores,
  GoogleCalendarIntegration,
  GoogleDriveIntegration,
  UserExtras,
  UpdateMeBody,
  users_exports
};
