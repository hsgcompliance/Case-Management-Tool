// contracts/src/index.ts

/**
 * Contracts index policy:
 *  - Runtime schemas are exported under namespaces to avoid name collisions.
 *  - Type exports are top-level for easy imports in web/ and functions/.
 *
 * NOTE:
 *  - Endpoint req/resp types (CustomersUpsertReq, GrantsListResp, etc.) live in ./endpointMap
 *    and are exported via `export * from "./endpointMap"`.
 */

// Core + shared envelopes
export * from "./core";
export * from "./http";

// Canonical endpoint req/resp typing (this is where most “API types” live)
export * from "./endpointMap";

// ------------------------------
// Namespaced runtime schema exports
// ------------------------------
export * as assessments from "./assessments";
export * as customers from "./customers";
export * as creditCards from "./creditCards";
export * as enrollments from "./enrollments";
export * as gdrive from "./gdrive";
export * as grants from "./grants";
export * as inbox from "./inbox";
export * as jotform from "./jotform";
export * as ledger from "./ledger";
export * as payments from "./payments";
export * as tasks from "./tasks";
export * as tours from "./tours";
export * as users from "./users";
export * as metrics from "./metrics";

// ------------------------------
// Top-level TYPE exports (leaf modules only)
// ------------------------------

export type {
  Ok,
  OkEmpty,
  Err,
  PaginatedResp,
  PageCursorUpdatedAt,
} from "./http";

export type {
  BudgetLineItemLike,
  BudgetTotals,
  TTsLike,
  TISO10,
} from "./core";

export {
  TsLike,
  ISO10,
} from "./core";

// Assessments (local types)
export type {
  AssessmentTemplateInput,
  TAssessmentSubmission,
} from "./assessments";

// Customers (local types) — UPDATED
export type {
  CustomerInput,

  // surface types (match endpointMap “style”)
  TCustomerEntity,
  TPopulation,
  TCustomerStatus,
  TAssistanceLength,

  // req bodies + resps
  TCustomersUpsertBody,
  TCustomersUpsertResp,

  TCustomersPatchRow,
  TCustomersPatchBody,
  TCustomersPatchResp,

  TCustomersDeleteBody,
  TCustomersDeleteResp,

  TCustomersAdminDeleteBody,
  TCustomersAdminDeleteResp,

  TCustomersGetQuery,
  TCustomersGetResp,

  TCustomersListQuery,
  TCustomersListResp,
  TCustomersBackfillNamesBody,
  TCustomersBackfillNamesResp,
  TCustomersBackfillCaseManagerNamesBody,
  TCustomersBackfillCaseManagerNamesResp,
  TCustomersBackfillAssistanceLengthBody,
  TCustomersBackfillAssistanceLengthResp,
} from "./customers";

// Credit cards
export type {
  TCreditCard,
  TCreditCardEntity,
  TCreditCardKind,
  TCreditCardStatus,
  TCreditCardCycleType,
  TCreditCardMatching,
  TCreditCardLimitOverride,
  TCreditCardsUpsertBody,
  TCreditCardsUpsertResp,
  TCreditCardsPatchRow,
  TCreditCardsPatchBody,
  TCreditCardsPatchResp,
  TCreditCardsDeleteBody,
  TCreditCardsDeleteResp,
  TCreditCardsAdminDeleteBody,
  TCreditCardsAdminDeleteResp,
  TCreditCardsListQuery,
  TCreditCardsListResp,
  TCreditCardsGetQuery,
  TCreditCardsGetResp,
  TCreditCardsStructureResp,
  TCreditCardsSummaryQuery,
  TCreditCardsSummaryItem,
  TCreditCardsSummaryResp,
} from "./creditCards";

// Enrollments
export type {
  TEnrollment,
  TEnrollmentsUpsertBody,
  TEnrollmentsPatchRow,
  TEnrollmentsPatchBody,
  TEnrollmentsDeleteBody,
  TEnrollmentsAdminDeleteBody,
  TEnrollmentsAdminDeleteResp,
  TEnrollmentsDeleteResp,
  TEnrollmentsDeleteResultItem,
  TEnrollmentsListQuery,
  TEnrollmentGetByIdQuery,
  TEnrollmentsEnrollCustomerBody,
  TEnrollmentsBulkEnrollBody,
  TEnrollmentsCheckOverlapsQuery,
  TEnrollmentsCheckDualQuery,
  TEnrollmentsMigrateBody,
  TEnrollmentsUndoMigrationBody,
  TEnrollmentsAdminReverseLedgerEntryBody,
} from "./enrollments";

// Drive
export type {
  TGDriveListQuery,
  TGDriveCreateFolderBody,
  TGDriveUploadBody,
} from "./gdrive";

// Grants — UPDATED
export type {
  // core
  TGrant,
  TGrantStatus,
  TGrantKind,
  TGrantBudgetLineItem,
  TGrantBudgetTotals,
  TGrantBudget,
  TGrantEntity,

  // request bodies + responses
  TGrantsUpsertBody,
  TGrantsUpsertResp,

  TGrantsPatchRow,
  TGrantsPatchBody,
  TGrantsPatchResp,

  TGrantsDeleteBody,
  TGrantsDeleteResp,

  TGrantsAdminDeleteBody,
  TGrantsAdminDeleteResp,

  TGrantsListQuery,
  TGrantsListResp,

  TGrantsGetQuery,
  TGrantsGetResp,

  TGrantsStructureResp,

  TGrantsActivityQuery,
  TGrantsActivityItem,
  TGrantsActivityResp,
} from "./grants";

// Jotform
export type {
  TJotformSubmissionStatus,
  TJotformSubmissionSource,
  TJotformBudgetLineItem,
  TJotformBudgetTotals,
  TJotformBudget,
  TJotformSubmissionCalc,
  TJotformSubmission,
  TJotformSubmissionEntity,
  TJotformSubmissionsUpsertBody,
  TJotformSubmissionsUpsertResp,
  TJotformSubmissionsPatchRow,
  TJotformSubmissionsPatchBody,
  TJotformSubmissionsPatchResp,
  TJotformSubmissionsDeleteBody,
  TJotformSubmissionsDeleteResp,
  TJotformSubmissionsAdminDeleteBody,
  TJotformSubmissionsAdminDeleteResp,
  TJotformSubmissionsListQuery,
  TJotformSubmissionsListResp,
  TJotformSubmissionsGetQuery,
  TJotformSubmissionsGetResp,
  TJotformSubmissionsStructureResp,
  TJotformFormsListQuery,
  TJotformFormSummary,
  TJotformFormsListResp,
  TJotformLinkSubmissionBody,
  TJotformLinkSubmissionResp,
  TJotformSyncSelectionBody,
  TJotformSyncSelectionResp,
  TJotformDigestMap,
  TJotformDigestField,
  TJotformDigestSection,
  TJotformDigestHeader,
  TJotformDigestUpsertBody,
  TJotformDigestUpsertResp,
  TJotformDigestGetQuery,
  TJotformDigestGetResp,
  TJotformDigestListQuery,
  TJotformDigestListResp,
  TJotformSyncBody,
  TJotformSyncResp,
} from "./jotform";


// Inbox
export type {
  InboxSource,
  InboxStatus,
  InboxAssignedGroup,
  TInboxItem,
  TInboxItemEntity,
  TInboxListMyQuery,
  TInboxListMyResp,
  TInboxWorkloadListQuery,
  TInboxWorkloadListResp,
  TInboxEmailResp,
  TInboxDigestPreviewResp,
  TInboxSendInviteBody,
  TInboxSendMonthlySummaryBody,
  TInboxSendDigestNowBody,
  TInboxSendDigestNowResp,
  TInboxScheduleDigestBody,
  TInboxScheduleDigestResp,
  TInboxDigestPreviewQuery,
  TInboxMetricsScope,
  TInboxMetricsMyQuery,
  TInboxMetricsMyResp,
} from "./inbox";

export {InboxItemSchema} from "./inbox";

// Ledger (local types + request bodies)
export type {
  TLedgerSource,
  TLedgerEntry,
  TLedgerListBody,
  TLedgerCreateBody,
  TLedgerClassifyItem,
  TLedgerClassifyBody,
  TLedgerClassifyResp,
  TLedgerAutoAssignBody,
  TLedgerAutoAssignResp,
  TLedgerGetByIdParams,
  TLedgerBalanceQuery,
} from "./ledger";

// Payments
export type {
  TPaymentCompliance,
  TPaymentsUpdateComplianceBody,
  TPayment,
  TSpend,
  TSpendSource,
  TPaymentsSpendBody,
  TPaymentsGenerateProjectionsBody,
  TPaymentsRecalculateFutureReq,
  TPaymentsRecalculateFutureSingleReq,
  TPaymentsRecalculateFutureGrantReq,
  TPaymentsRecalcGrantProjectedBody,
  TPaymentsAdjustSpendBody,
  TPaymentsAdjustProjectionsBody,
  TPaymentProjectionInput,
  TPaymentsBulkCopyScheduleBody,
  TPaymentsUpdateGrantBudgetBody,
  TPaymentsUpsertProjectionsBody,
  // operation DTOs (responses) — useful for callers even if wrapped by endpointMap responses
  TPaymentsRecalculateFutureResp,
  TPaymentsRecalcGrantProjectedResp,
} from "./payments";

// Tasks
export type {
  TAssignedGroup,
  TTaskScheduleItem,
  TTaskStats,
  TTasksBulkStatusBody,
  TTasksAssignBody,
  TTasksUpdateStatusBody,
  TTasksRescheduleBody,
  TTasksUpsertManualBody,
  TTasksListQuery,
  TTasksListItem,
  TTasksAdminRegenerateForGrantBody,
  TTasksOtherCreateBody,
  TTasksOtherUpdateBody,
  TTasksOtherAssignBody,
  TTasksOtherStatusBody,
  TTasksOtherListMyQuery,
  TTasksUpdateFieldsBody,
  TTasksDeleteBody,
  TTasksGenerateScheduleWriteBody,
  TTasksGenerateScheduleWriteResult,
  TTasksAdminRegenerateForGrantResultItem,
} from "./tasks";

// Re-export schemas as named exports for backward compatibility
export {
  TasksBulkStatusBody,
  TasksAssignBody,
  TasksUpdateFieldsBody,
  TasksUpdateStatusBody,
  TasksDeleteBody,
  TasksListQuery,
  TasksRescheduleBody,
  TasksUpsertManualBody,
  TasksAdminRegenerateForGrantBody,
  TasksGenerateScheduleWriteBody,
  TasksOtherCreateBody,
  TasksOtherUpdateBody,
  TasksOtherAssignBody,
  TasksOtherStatusBody,
  TasksOtherListMyQuery,
} from "./tasks";

// Tours
export type {
  TourFlowT,
  TourStepT,
  ToursUpsertBodyT,
  ToursPatchItemT,
  ToursPatchBodyT,
  ToursDeleteBodyT,
  ToursGetQueryT,
  ToursListQueryT,
} from "./tours";

// Re-export schemas for backward compatibility
export {
  TourStep,
  TourFlow,
  ToursUpsertBody,
  ToursPatchItem,
  ToursPatchBody,
  ToursDeleteBody,
  ToursGetQuery,
  ToursListQuery,
} from "./tours";


// Users (runtime re-export for barrel consumers)
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
  TourProgressStatus,
  TourProgressEntry,
  UserToursState,
  UserGameHighScores,
  UserExtras,
  UpdateMeBody,
} from "./users";

// Metrics
export type {
  TNameRef,
  TCustomerRefLite,
  TPopulationSummary,
  TSystemSummaryMetrics,
  TSystemMonthMetrics,
  TCaseManagerSummaryMetrics,
  TCaseManagerMonthMetrics,
  TGrantSummaryMetrics,
  TGrantMonthMetrics,
  TMetricChipId,
  TMetricChipDefinition,
  TMetricWorkspaceChipInstance,
  TMetricWorkspaceLayout,
  TMetricWorkspacePrefs,
} from "./metrics";

export {
  MetricChipId,
  MetricWorkspacePrefs,
  MetricWorkspaceLayout,
  MetricWorkspaceChipInstance,
} from "./metrics";

// Users (types)
export type {
  TRoleTag,
  TRoles,
  TTopRole,
  TTopRoleLadder,
  TRole,
  TUserMetrics,
  TUserTaskMetrics,
  TUserPaymentMetrics,
  TUserDashboardPrefs,
  TTourProgressStatus,
  TTourProgressEntry,
  TUserToursState,
  TUserGameHighScores,
  TUserExtras,
  TTaskMode,
  TTaskModeSetBy,
  TUserListStatus,
  UserComposite,

  CreateUserBodyT,
  InviteUserBodyT,
  SetRoleBodyT,
  SetActiveBodyT,
  RevokeSessionsBodyT,
  ListUsersBodyT,
  OrgManagerTeamT,
  OrgManagerOrgT,
  OrgManagerListOrgsBodyT,
  OrgManagerUpsertOrgBodyT,
  OrgManagerPatchTeamsBodyT,
  UpdateMeBodyT,

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
} from "./users";
