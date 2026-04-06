// functions/src/features/users/schemas.ts
export { z } from "@hdb/contracts";

export {
  // runtime
  RoleTagCanonical,
  TopRoleCanonical,
  TopRoleLadder,
  RoleInput,
  RolesArray,
  CreateUserBody,
  InviteUserBody,
  SetRoleBody,
  SetActiveBody,
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
  UserDashboardPrefs,
  UserGameHighScores,
  UserExtras,
  UpdateMeBody,
} from "@hdb/contracts";

export type {
  // literals / core leaf types
  TRoleTag,
  TRoles,
  TTopRole,
  TTopRoleLadder,
  TRole,
  TUserMetrics,
  TUserTaskMetrics,
  TUserPaymentMetrics,
  TUserDashboardPrefs,
  TUserGameHighScores,
  TUserExtras,
  TUserListStatus,
  OrgManagerTeamT,
  OrgManagerOrgT,
  OrgManagerListOrgsBodyT,
  OrgManagerUpsertOrgBodyT,
  OrgManagerPatchTeamsBodyT,
  UserComposite,

  // body outputs (post-parse)
  CreateUserBodyT,
  InviteUserBodyT,
  SetRoleBodyT,
  SetActiveBodyT,
  RevokeSessionsBodyT,
  ListUsersBodyT,
  UpdateMeBodyT,

  // inputs
  CreateUserBodyIn,
  InviteUserBodyIn,
  SetRoleBodyIn,
  SetActiveBodyIn,
  RevokeSessionsBodyIn,
  ListUsersBodyIn,
  OrgManagerListOrgsBodyIn,
  OrgManagerUpsertOrgBodyIn,
  OrgManagerPatchTeamsBodyIn,
  UpdateMeBodyIn,
} from "@hdb/contracts";
