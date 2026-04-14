// contracts/src/users.ts
import { z, Id, TsLike } from "./core";

/** Org-level role tags (NOT ladder). */
export const RoleTagCanonical = z.enum(["casemanager", "compliance"]);

/** API-settable ladder levels that admins may set through admin endpoints. */
export const TopRoleCanonical = z.enum(["user", "admin", "dev", "org_dev", "super_dev"]);
export type TRoleTag = z.infer<typeof RoleTagCanonical>;

/** Full ladder used in claims/identity flows. */
export const TopRoleLadder = z.enum([
  "unverified",
  "public_user",
  "user",
  "admin",
  "dev",
  "org_dev",
  "super_dev",
]);

const ROLE_ALIAS: Record<string, TRoleTag> = {
  casemanager: "casemanager",
  cm: "casemanager",
  case: "casemanager",
  manager: "casemanager",
  caseworker: "casemanager",
  casemgr: "casemanager",
  caseworkermanager: "casemanager",
  compliance: "compliance",
};

export const RoleInput = z.string().transform((v) => {
  const k = String(v || "").toLowerCase().replace(/[\s_-]+/g, "");
  const mapped = (ROLE_ALIAS as any)[k];
  if (!mapped) throw new Error(`invalid_role:${v}`);
  return mapped;
});

export const RolesArray = z.array(RoleInput).min(1).default(["casemanager"]);

export const CreateUserBody = z.object({
  email: z.email(),
  password: z.string().min(6),
  name: z.string().trim().optional().default(""),
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: z.array(Id).max(10).optional(),
});

export const InviteUserBody = z.object({
  email: z.email(),
  name: z.string().trim().optional().default(""),
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: z.array(Id).max(10).optional(),
  sendEmail: z.boolean().optional().default(true),
  continueUrl: z.string().url().optional(),
});

export const SetRoleBody = z.object({
  uid: Id,
  roles: RolesArray.optional(),
  topRole: TopRoleCanonical.optional(),
  orgId: Id.optional(),
  teamIds: z.array(Id).max(10).optional(),
});

export const SetActiveBody = z.object({
  uid: Id,
  active: z.boolean(),
});

export const RevokeSessionsBody = z.object({
  orgId: Id.optional(),
});

export type TUserListStatus = "all" | "active" | "inactive";
export const ListUsersBody = z.object({
  limit: z.number().int().min(1).max(1000).optional().default(100),
  pageToken: z.string().optional(),
  status: z.enum(["all", "active", "inactive"]).optional().default("all"),
});

export const OrgManagerTeam = z.object({
  id: Id,
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional().default(true),
});

export const OrgManagerOrg = z
  .object({
    id: Id,
    name: z.string().trim().min(1),
    active: z.boolean().optional().default(true),
    teams: z.array(OrgManagerTeam).optional().default([]),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
  })
  .passthrough();

export const OrgManagerListOrgsBody = z.object({
  includeInactive: z.boolean().optional().default(true),
});

export const OrgManagerUpsertOrgBody = z.object({
  id: Id,
  name: z.string().trim().min(1),
  active: z.boolean().optional().default(true),
});

export const OrgManagerPatchTeamsBody = z
  .object({
    orgId: Id,
    add: z.array(z.union([Id, OrgManagerTeam])).max(25).optional(),
    remove: z.array(Id).max(25).optional(),
  })
  .refine((v) => (v.add?.length || 0) > 0 || (v.remove?.length || 0) > 0, {
    message: "empty_patch",
  });

/** Flat acuity/caseload fields — promoted to top-level on UserExtras for Firestore indexing. */
export const UserMetrics = z
  .object({
    caseloadActive: z.number().int().nonnegative().nullable().optional(),
    acuityScoreSum: z.number().nullable().optional(),
    acuityScoreCount: z.number().nonnegative().nullable().optional(),
    acuityScoreAvg: z.number().nullable().optional(),
    lastAcuityUpdatedAt: z.union([z.string(), z.date()]).nullable().optional(),
    enrollmentCount: z.number().int().nonnegative().nullable().optional(),
  })
  .partial();

/** Per-user task counts computed by triggers/reconcile — stored as `taskMetrics` on userExtras. */
export const UserTaskMetrics = z
  .object({
    openThisMonth: z.number().int().nonnegative().nullable().optional(),
    openNextMonth: z.number().int().nonnegative().nullable().optional(),
    byType: z
      .record(
        z.string(),
        z.object({
          thisMonth: z.number().int().nonnegative().optional(),
          nextMonth: z.number().int().nonnegative().optional(),
        })
      )
      .nullable()
      .optional(),
    updatedAt: z.unknown().optional(),
    reconciledAt: z.unknown().optional(),
  })
  .partial();

/** Per-user payment counts computed by triggers/reconcile — stored as `paymentMetrics` on userExtras. */
export const UserPaymentMetrics = z
  .object({
    unpaidThisMonth: z.number().int().nonnegative().nullable().optional(),
    unpaidNextMonth: z.number().int().nonnegative().nullable().optional(),
    unpaidTotal: z.number().int().nonnegative().nullable().optional(),
    amountThisMonth: z.number().nullable().optional(),
    amountNextMonth: z.number().nullable().optional(),
    amountTotal: z.number().nullable().optional(),
    updatedAt: z.unknown().optional(),
    reconciledAt: z.unknown().optional(),
  })
  .partial();

/** Dashboard UI preferences stored as `dashboardPrefs` on userExtras. */
export const UserDashboardPrefs = z
  .object({
    activeToolId: z.string().nullable().optional(),
    pinnedToolIds: z.array(z.string()).nullable().optional(),
    recency: z.array(z.string()).nullable().optional(),
    updatedAt: z.unknown().optional(),
  })
  .partial();

/** Preferred customers page experience stored on `userExtras`. */
export const UserCustomersPageMode = z.enum(["legacy", "new"]);

export const TourProgressStatus = z.enum(["in_progress", "completed", "abandoned"]);
export const TourProgressEntry = z.object({
  stepIndex: z.number().int().nonnegative().optional(),
  status: TourProgressStatus.optional(),
  updatedAt: z.union([z.number(), TsLike]).optional(),
});
export const UserToursState = z.object({
  progress: z.record(z.string(), TourProgressEntry).optional().default({}),
  dismissedAllPrompt: z.boolean().optional(),
  updatedAt: TsLike.optional(),
});

// ── Game metadata ─────────────────────────────────────────────────────────────
// Per-game record: at minimum a highScore; games can store arbitrary extra state
// via .catchall(). New games can be added without changing this schema.
export const UserGameRecord = z
  .object({
    highScore: z.number().int().nonnegative().optional(),
    lastPlayed: z.string().optional(),          // ISO date
    gamesPlayed: z.number().int().nonnegative().optional(),
  })
  .catchall(z.unknown());

// Map of gameId → GameRecord (open-ended — add any game without schema changes)
export const UserGameMeta = z.record(z.string(), UserGameRecord);

// Kept for backward-compat reads during migration; new writes go to game_meta
export const UserGameHighScores = z
  .object({
    runner: z.number().int().nonnegative().optional(),
    snake: z.number().int().nonnegative().optional(),
    space_invaders: z.number().int().nonnegative().optional(),
    tower_defense_round: z.number().int().nonnegative().optional(),
  })
  .catchall(z.number().int().nonnegative());

export const UserExtras = z
  .object({
    // Human-editable
    notes: z.string().trim().nullable().optional(),
    settings: z.record(z.string(), z.unknown()).nullable().optional(),
    meta: z.record(z.string(), z.unknown()).nullable().optional(),

    // Feature sub-objects
    dashboardPrefs: UserDashboardPrefs.nullable().optional(),
    tours: UserToursState.nullable().optional(),
    game_meta: UserGameMeta.optional(),
    // Legacy — kept readable so migration code can pull old scores
    gameHighScores: UserGameHighScores.optional(),
    quickBreakHighScore: z.number().int().nonnegative().optional(),

    // User preferences
    taskMode: z.enum(["viewer", "workflow"]).nullable().optional(),
    taskModeSetAt: z.string().nullable().optional(),
    taskModeSetBy: z.enum(["self", "admin", "system"]).nullable().optional(),
    digestOptOut: z.boolean().nullable().optional(),
    digestFrequency: z.enum(["monthly", "off"]).nullable().optional(),
    customersPageMode: UserCustomersPageMode.nullable().optional(),

    // --- Flat indexable metrics (top-level for Firestore query support) ---
    caseloadActive: z.number().int().nonnegative().nullable().optional(),
    enrollmentCount: z.number().int().nonnegative().nullable().optional(),
    acuityScoreSum: z.number().nullable().optional(),
    acuityScoreCount: z.number().nonnegative().nullable().optional(),
    acuityScoreAvg: z.number().nullable().optional(),
    lastAcuityUpdatedAt: z.union([z.string(), z.date()]).nullable().optional(),

    // Grouped metrics sub-objects (written by server-side triggers, not user-settable)
    taskMetrics: UserTaskMetrics.nullable().optional(),
    paymentMetrics: UserPaymentMetrics.nullable().optional(),
  })
  .strict();

export const UpdateMeBody = z.object({
  updates: UserExtras,
});

/* ============================================================================
   Inferred (T) types
============================================================================ */

export type TRoles = z.infer<typeof RolesArray>;
export type TTopRole = z.infer<typeof TopRoleCanonical>;
export type TTopRoleLadder = z.infer<typeof TopRoleLadder>;
export type TUserMetrics = z.infer<typeof UserMetrics>;
export type TUserTaskMetrics = z.infer<typeof UserTaskMetrics>;
export type TUserPaymentMetrics = z.infer<typeof UserPaymentMetrics>;
export type TUserDashboardPrefs = z.infer<typeof UserDashboardPrefs>;
export type TUserCustomersPageMode = z.infer<typeof UserCustomersPageMode>;
export type TTourProgressStatus = z.infer<typeof TourProgressStatus>;
export type TTourProgressEntry = z.infer<typeof TourProgressEntry>;
export type TUserToursState = z.infer<typeof UserToursState>;
export type TUserGameRecord = z.infer<typeof UserGameRecord>;
export type TUserGameMeta = z.infer<typeof UserGameMeta>;
export type TUserGameHighScores = z.infer<typeof UserGameHighScores>;
export type TUserExtras = z.infer<typeof UserExtras>;
export type TTaskMode = NonNullable<TUserExtras["taskMode"]>;
export type TTaskModeSetBy = NonNullable<TUserExtras["taskModeSetBy"]>;

export type CreateUserBodyT = z.infer<typeof CreateUserBody>;
export type InviteUserBodyT = z.infer<typeof InviteUserBody>;
export type SetRoleBodyT = z.infer<typeof SetRoleBody>;
export type SetActiveBodyT = z.infer<typeof SetActiveBody>;
export type RevokeSessionsBodyT = z.infer<typeof RevokeSessionsBody>;
export type ListUsersBodyT = z.infer<typeof ListUsersBody>;
export type OrgManagerTeamT = z.infer<typeof OrgManagerTeam>;
export type OrgManagerOrgT = z.infer<typeof OrgManagerOrg>;
export type OrgManagerListOrgsBodyT = z.infer<typeof OrgManagerListOrgsBody>;
export type OrgManagerUpsertOrgBodyT = z.infer<typeof OrgManagerUpsertOrgBody>;
export type OrgManagerPatchTeamsBodyT = z.infer<typeof OrgManagerPatchTeamsBody>;
export type UpdateMeBodyT = z.infer<typeof UpdateMeBody>;

/* ============================================================================
   Input (In) types — what callers send
============================================================================ */

export type CreateUserBodyIn = z.input<typeof CreateUserBody>;
export type InviteUserBodyIn = z.input<typeof InviteUserBody>;
export type SetRoleBodyIn = z.input<typeof SetRoleBody>;
export type SetActiveBodyIn = z.input<typeof SetActiveBody>;
export type RevokeSessionsBodyIn = z.input<typeof RevokeSessionsBody>;
export type ListUsersBodyIn = z.input<typeof ListUsersBody>;
export type OrgManagerListOrgsBodyIn = z.input<typeof OrgManagerListOrgsBody>;
export type OrgManagerUpsertOrgBodyIn = z.input<typeof OrgManagerUpsertOrgBody>;
export type OrgManagerPatchTeamsBodyIn = z.input<typeof OrgManagerPatchTeamsBody>;
export type UpdateMeBodyIn = z.input<typeof UpdateMeBody>;

/* ============================================================================
   Shared composites (types only) — defined here, not endpointMap
============================================================================ */

/** Tags + canonical ladder values that FE/API care about. */
export type TRole = TRoleTag | TTopRole;

/**
 * Shape used by API responses. Keep permissive: functions may attach extra fields.
 * (Do NOT over-tighten this; endpointMap is just the wire surface.)
 */
export type UserComposite = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  phone?: string | null;
  disabled?: boolean;
  active?: boolean;
  roles?: string[];
  topRole?: string;
  createdAt?: string | null;
  lastLogin?: string | null;
  extras?: TUserExtras | Record<string, unknown> | null;
  [k: string]: unknown;
};
