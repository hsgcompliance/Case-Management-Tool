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

// Budget pipeline
export * as budgetPipeline from "./budgetPipeline";

// Canonical endpoint req/resp typing (this is where most “API types” live)
export * from "./endpointMap";

// ------------------------------
// Namespaced runtime schema exports
// ------------------------------
export * as assessments from "./assessments";
export * as customers from "./customers";
export * as creditCards from "./creditCards";
export * as enrollments from "./enrollments";
export * as formSessions from "./formSessions";
export * as gdrive from "./gdrive";
export * as google from "./google";
export * as grants from "./grants";
export * as grantBudgetManager from "./grantBudgetManager";
export * as inbox from "./inbox";
export * as jotform from "./jotform";
export * as ledger from "./ledger";
export * as payments from "./payments";
export * as tasks from "./tasks";
export * as tours from "./tours";
export * as users from "./users";
export * as metrics from "./metrics";
export * as tss from "./tss";
export * as transactionWindows from "./transactionWindows";
export * as cmActivities from "./cmActivities";

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

export {
  GrantBudgetManagerSourceType,
  GrantBudgetManagerSaveMode,
  GrantBudgetManagerOriginal,
  GrantBudgetManagerRow,
  GrantBudgetManagerLineItem,
  GrantBudgetManagerRollup,
  GrantBudgetManagerLoadBody,
  GrantBudgetManagerSaveBody,
  GrantBudgetManagerReconcileBody,
} from "./grantBudgetManager";

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

export type {
  TGrantBudgetManagerSourceType,
  TGrantBudgetManagerSaveMode,
  TGrantBudgetManagerOriginal,
  TGrantBudgetManagerRow,
  TGrantBudgetManagerLineItem,
  TGrantBudgetManagerRollup,
  TGrantBudgetManagerLoadBody,
  TGrantBudgetManagerLoadResp,
  TGrantBudgetManagerSaveBody,
  TGrantBudgetManagerSaveResp,
  TGrantBudgetManagerReconcileBody,
  TGrantBudgetManagerReconcileResp,
} from "./grantBudgetManager";

// Enrollments
export type {
  TEnrollment,
  TEnrollmentServiceStatus,
  TEnrollmentMedicaidStatus,
  TEnrollmentMedicaid,
  TEnrollmentActions,
  TEnrollmentActionHistoryEventType,
  TEnrollmentActionHistoryRecord,
  TEnrollmentActionsApplyBody,
  TEnrollmentActionsApplyResp,
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

// Form Sessions (Forms surface)
export type {
  TFormWorkflowId,
  TFormRenderMode,
  TFormSessionStatus,
  TFormSessionSource,
  TFormWorkflowConfig,
  TFormContextKey,
  TFormPrefillSnapshot,
  TFormSubmissionSnapshot,
  TFormSessionEntity,
  TFormSessionCreateBody,
  TFormSessionCreateResp,
  TFormSessionResolveBody,
  TFormSessionResolved,
  TFormSessionResolveResp,
  TFormSessionCompleteBody,
  TFormSessionCompleteResp,
} from "./formSessions";
export {
  FormWorkflowId,
  FormRenderMode,
  FormSessionStatus,
  FormSessionSource,
  FormWorkflowConfig,
  FormPrefillSnapshot,
  FormSubmissionSnapshot,
  FormSessionEntity,
  FormSessionCreateBody,
  FormSessionResolveBody,
  FormSessionCompleteBody,
  FORM_CONTEXT_KEYS,
  WORKFLOW_CONFIGS,
  getWorkflowConfig,
} from "./formSessions";

// Drive
export type {
  TGDriveListQuery,
  TGDriveCreateFolderBody,
  TGDriveUploadBody,
  TGDriveConfigPatchBody,
  TGDriveOrgConfig,
  TGDriveCustomerFolderIndexConfig,
  TGDriveTemplate,
  TGDriveTemplateType,
  TGDriveTemplateVariants,
  TGDriveBuildSettings,
} from "./gdrive";
export { GDRIVE_TEMPLATE_TYPES } from "./gdrive";

// Google integrations
export type {
  TGoogleAuthMode,
  TGoogleConnectStartBody,
  TGoogleConnectStartRespBody,
  TGoogleDisconnectRespBody,
  TGoogleEndpointError,
  TGoogleIntegrationMode,
  TGoogleIntegrationStatus,
  TGoogleIntegrationStatusRespBody,
  TGooglePermissionStatus,
  TGoogleService,
} from "./google";
export {
  GoogleAuthMode,
  GoogleConnectStartBody,
  GoogleIntegrationMode,
  GoogleIntegrationStatus,
  GooglePermissionStatus,
  GoogleService,
} from "./google";

// Grants — UPDATED
export type {
  // core
  TGrant,
  TGrantStatus,
  TGrantKind,
  TGrantFinancialModel,
  TGrantLedgerMode,
  TGrantFinancialConfig,
  TGrantFinancialConfigPatch,
  TGrantCompliancePreset,
  TGrantComplianceControl,
  TGrantComplianceConfig,
  TGrantDriveTemplateType,
  TGrantDriveTemplate,
  TGrantTaskDefinitions,
  TGrantFinancialCapabilities,
  TGrantLineItemAmountSemantics,
  TGrantLineItemType,
  TGrantBudgetLineItem,
  TGrantBudgetTotals,
  TGrantBudget,
  TGrantEntity,

  // pins
  TGrantPinColor,
  TGrantPinImportant,
  TGrantPinDigest,
  TGrantPinRentalAssistance,
  TGrantPinInvoice,
  TGrantPins,

  // invoicing
  TGrantInvoicing,
  TGrantInvoicingFrequency,
  TGrantEnrollmentDefaults,

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

  TGrantsAdminPreviewQuery,
  TGrantsAdminPreviewResp,
  TGrantsAdminClearPaymentsBody,
  TGrantsAdminClearPaymentsResp,
  TGrantsAdminClearEnrollmentsBody,
  TGrantsAdminClearEnrollmentsResp,
  TGrantsAdminReconcileBudgetBody,
  TGrantsAdminReconcileBudgetResp,
} from "./grants";
export {
  GRANT_PIN_COLORS,
  GrantFinancialModel,
  GrantLedgerMode,
  GrantFinancialConfig,
  GrantFinancialConfigPatch,
  GrantCompliancePreset,
  GrantComplianceControl,
  GrantComplianceConfig,
  GrantDriveTemplateType,
  GrantDriveTemplate,
  normalizeGrantDriveTemplates,
  normalizeGrantFinancialConfig,
  normalizeGrantComplianceConfig,
  getGrantFinancialCapabilities,
  shouldRetainGrantBudget,
  getGrantLineItemAmountSemantics,
  computeGrantLineItemOverCap,
  parseGrantMaxAssistanceMonths,
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
  TJotformQuestionFieldType,
  TJotformQuestionField,
  TJotformFormQuestionsGetQuery,
  TJotformFormQuestionsGetResp,
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
  TourProgressStatus,
  TourProgressEntry,
  UserToursState,
  UserGameRecord,
  UserGameMeta,
  UserGameHighScores,
  UserExtras,
  UserGrantPrefs,
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
  TUserSettings,
  TUserDigestSubs,
  TUserPinnedItem,
  TUserDashboardPrefs,
  TTourProgressStatus,
  TTourProgressEntry,
  TUserToursState,
  TUserGameRecord,
  TUserGameMeta,
  TUserGameHighScores,
  TUserExtras,
  TUserGrantPrefs,
  TTaskMode,
  TTaskModeSetBy,
  TUserListStatus,
  UserComposite,

  CreateUserBodyT,
  InviteUserBodyT,
  SetRoleBodyT,
  SetActiveBodyT,
  UpdateUserProfileBodyT,
  ResendInviteBodyT,
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
  UpdateUserProfileBodyIn,
  ResendInviteBodyIn,
  RevokeSessionsBodyIn,
  ListUsersBodyIn,
  OrgManagerListOrgsBodyIn,
  OrgManagerUpsertOrgBodyIn,
  OrgManagerPatchTeamsBodyIn,
  UpdateMeBodyIn,
} from "./users";

// Budget Pipeline
export type {
  TPipelineOperator,
  TPipelineStatus,
  TPipelineCondition,
  TPipelineConditionGroup,
  TPipelineRuleNode,
  TPipelineFormSchema,
  TBudgetPipeline,
  TBudgetPipelineUpsertBody,
  TBudgetPipelineListQuery,
  TBudgetPipelineDeleteBody,
  TBudgetPipelinePreviewBody,
  TPreviewItemResult,
  TPreviewMatchedRow,
  TBudgetPipelinePreviewResult,
} from "./budgetPipeline";

export {
  PipelineOperator,
  PipelineStatus,
  PipelineCondition,
  PipelineConditionGroup,
  PipelineRuleNode,
  PipelineFormSchema,
  BudgetPipeline,
  BudgetPipelineUpsertBody,
  BudgetPipelineListQuery,
  BudgetPipelineDeleteBody,
  BudgetPipelinePreviewBody,
} from "./budgetPipeline";

export type {
  TransactionWindowFormId,
  TransactionQuestionField,
  TransactionFieldDefinition,
  LogicalTransactionWindow,
  TransactionWindowModel,
} from "./transactionWindows";

export {
  TRANSACTION_WINDOW_FORM_IDS,
  TransactionWindowSchemaError,
  cleanVisibleLabel,
  transactionFieldKey,
  inferTransactionWindowModel,
} from "./transactionWindows";

// CM Activities
export {
  CmActivityType,
  CmActivity,
  CmActivityCreateBody,
  CmActivityUpdateBody,
  CmActivitiesListQuery,
  CmActivitiesListResp,
} from "./cmActivities";

export type {
  TCmActivityType,
  TCmActivity,
  TCmActivityCreateBody,
  TCmActivityUpdateBody,
  TCmActivitiesListQuery,
  TCmActivitiesListResp,
} from "./cmActivities";
