// web/src/types/index.ts
// Canonical type surface for web/.
//
// Rule: Web should import types from "@/types".
// Rule: Contracts is source-of-truth for API typing (EndpointMap), so derive endpoint types here.
// Rule: Keep web-only types truly UI-only.

// Import type utilities we'll use in type expressions below
import type {
  Ok,
  ReqOf,
  RespOf,
  TCreditCard,
  TCreditCardEntity,
  TCreditCardsSummaryItem,
  TCustomerEntity,
  TPopulation,
  TGrant,
  TEnrollment,
  TPayment,
  TSpend,
  TInboxItem,
  TInboxSendInviteBody,
  TInboxSendMonthlySummaryBody,
} from "@hdb/contracts";

// -----------------------------------------------------------------------------
// Contracts primitives (safe, small, stable)
// -----------------------------------------------------------------------------
export type {
  // HTTP envelope + pagination
  Ok,
  Err,
  ApiResp,
  PaginatedResp,
  PageCursorUpdatedAt,
  TimestampLike,

  // Endpoint typing utilities
  EndpointMap,
  EndpointName,
  ReqOf,
  RespOf,

  // Canonical entities / shapes (non-endpoint)
  TCustomerInput,
  TCustomerEntity,
  CustomerInput,
  TPopulation,
  CustomerStatus,

  TCreditCard,
  TCreditCardEntity,
  TCreditCardStatus,
  TCreditCardCycleType,
  TCreditCardMatching,
  TCreditCardLimitOverride,
  TCreditCardsSummaryItem,

  TGrant,
  TGrantStatus,
  TGrantKind,
  TGrantBudgetLineItem,
  TGrantBudgetTotals,
  TGrantBudget,

  TJotformSubmission,
  TJotformSubmissionEntity,
  TJotformFormSummary,
  TJotformDigestMap,
  TJotformDigestField,
  TJotformDigestSection,
  TJotformDigestHeader,
  TJotformBudget,
  TJotformSubmissionCalc,

  TEnrollment,

  TPayment,
  TPaymentProjectionInput,
  TPaymentCompliance,
  TSpend,
  TSpendSource,
  TPaymentsGenerateProjectionsBody,

  TTaskScheduleItem,
  TTaskStats,
  TAssignedGroup,

  TGDriveListQuery,
  TGDriveCreateFolderBody,
  TGDriveUploadBody,
  TGDriveBuildCustomerFolderBody,
  TCustomerFolder,

  InboxSource,
  TInboxItem,
  TInboxSendInviteBody,
  TInboxSendMonthlySummaryBody,

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

  TRoleTag,
  TRoles,
  TTopRole,
  TUserExtras,

  TourFlowT,
} from "@hdb/contracts";

// Backward-compatible UI aliases
export type TCustomer = TCustomerEntity;
export type Population = TPopulation;
export type CreditCard = TCreditCard;
export type CreditCardEntity = TCreditCardEntity;
export type CreditCardSummaryItem = TCreditCardsSummaryItem;
export type Grant = TGrant;
export type Enrollment = TEnrollment;
export type Payment = TPayment;
export type Spend = TSpend;
export type InboxItem = TInboxItem;
export type TSendInviteBody = TInboxSendInviteBody;
export type TSendMonthlySummaryBody = TInboxSendMonthlySummaryBody;
export type ScheduleMeta = Extract<NonNullable<TEnrollment["scheduleMeta"]>, { version: 1 }>;

// -----------------------------------------------------------------------------
// Endpoint req/resp aliases (derived from EndpointMap)
// This eliminates “missing export” errors and prevents drift.
// -----------------------------------------------------------------------------

// Customers
export type CustomersUpsertReq = ReqOf<"customersUpsert">;
export type CustomersUpsertResp = RespOf<"customersUpsert">;

export type CustomersPatchReq = ReqOf<"customersPatch">;
export type CustomersPatchResp = RespOf<"customersPatch">;

export type CustomersSoftDeleteReq = ReqOf<"customersDelete">;
export type CustomersSoftDeleteResp = RespOf<"customersDelete">;

export type CustomersHardDeleteReq = ReqOf<"customersAdminDelete">;
export type CustomersHardDeleteResp = RespOf<"customersAdminDelete">;

export type CustomersGetQuery = ReqOf<"customersGet">;
export type CustomersGetResp = RespOf<"customersGet">;

export type CustomersListQuery = ReqOf<"customersList">;
export type CustomersListResp = RespOf<"customersList">;
// NOTE: filter types live inside the paginated response; keep these only if you truly need them.
export type CustomersListFilter = CustomersListResp extends Ok<infer T>
  ? T extends { filter: infer F }
    ? F
    : never
  : never;

// Grants
export type GrantsUpsertReq = ReqOf<"grantsUpsert">;
export type GrantsUpsertResp = RespOf<"grantsUpsert">;

export type GrantsPatchReq = ReqOf<"grantsPatch">;
export type GrantsPatchResp = RespOf<"grantsPatch">;

export type GrantsDeleteReq = ReqOf<"grantsDelete">;
export type GrantsDeleteResp = RespOf<"grantsDelete">;

export type GrantsAdminDeleteReq = ReqOf<"grantsAdminDelete">;
export type GrantsAdminDeleteResp = RespOf<"grantsAdminDelete">;

export type GrantsListQuery = ReqOf<"grantsList">;
export type GrantsListResp = RespOf<"grantsList">;

export type GrantsGetReq = ReqOf<"grantsGet">;
export type GrantsGetResp = RespOf<"grantsGet">;

export type GrantsStructureReq = ReqOf<"grantsStructure">;
export type GrantsStructureResp = RespOf<"grantsStructure">;

export type GrantsActivityReq = ReqOf<"grantsActivity">;
export type GrantsActivityResp = RespOf<"grantsActivity">;
export type GrantsActivityItem =
  GrantsActivityResp extends Ok<infer T>
    ? T extends { items: Array<infer I> }
      ? I
      : never
    : never;

// Credit Cards
export type CreditCardsUpsertReq = ReqOf<"creditCardsUpsert">;
export type CreditCardsUpsertResp = RespOf<"creditCardsUpsert">;

export type CreditCardsPatchReq = ReqOf<"creditCardsPatch">;
export type CreditCardsPatchResp = RespOf<"creditCardsPatch">;

export type CreditCardsDeleteReq = ReqOf<"creditCardsDelete">;
export type CreditCardsDeleteResp = RespOf<"creditCardsDelete">;

export type CreditCardsAdminDeleteReq = ReqOf<"creditCardsAdminDelete">;
export type CreditCardsAdminDeleteResp = RespOf<"creditCardsAdminDelete">;

export type CreditCardsListReq = ReqOf<"creditCardsList">;
export type CreditCardsListResp = RespOf<"creditCardsList">;

export type CreditCardsGetReq = ReqOf<"creditCardsGet">;
export type CreditCardsGetResp = RespOf<"creditCardsGet">;

export type CreditCardsStructureReq = ReqOf<"creditCardsStructure">;
export type CreditCardsStructureResp = RespOf<"creditCardsStructure">;

export type CreditCardsSummaryReq = ReqOf<"creditCardsSummary">;
export type CreditCardsSummaryResp = RespOf<"creditCardsSummary">;

// Jotform
export type JotformSubmissionsUpsertReq = ReqOf<"jotformSubmissionsUpsert">;
export type JotformSubmissionsUpsertResp = RespOf<"jotformSubmissionsUpsert">;

export type JotformSubmissionsPatchReq = ReqOf<"jotformSubmissionsPatch">;
export type JotformSubmissionsPatchResp = RespOf<"jotformSubmissionsPatch">;

export type JotformSubmissionsDeleteReq = ReqOf<"jotformSubmissionsDelete">;
export type JotformSubmissionsDeleteResp = RespOf<"jotformSubmissionsDelete">;

export type JotformSubmissionsAdminDeleteReq = ReqOf<"jotformSubmissionsAdminDelete">;
export type JotformSubmissionsAdminDeleteResp = RespOf<"jotformSubmissionsAdminDelete">;

export type JotformSubmissionsListReq = ReqOf<"jotformSubmissionsList">;
export type JotformSubmissionsListResp = RespOf<"jotformSubmissionsList">;

export type JotformSubmissionsGetReq = ReqOf<"jotformSubmissionsGet">;
export type JotformSubmissionsGetResp = RespOf<"jotformSubmissionsGet">;

export type JotformSubmissionsStructureReq = ReqOf<"jotformSubmissionsStructure">;
export type JotformSubmissionsStructureResp = RespOf<"jotformSubmissionsStructure">;
export type JotformFormsListReq = ReqOf<"jotformFormsList">;
export type JotformFormsListResp = RespOf<"jotformFormsList">;
export type JotformLinkSubmissionReq = ReqOf<"jotformLinkSubmission">;
export type JotformLinkSubmissionResp = RespOf<"jotformLinkSubmission">;
export type JotformSyncSelectionReq = ReqOf<"jotformSyncSelection">;
export type JotformSyncSelectionResp = RespOf<"jotformSyncSelection">;
export type JotformDigestUpsertReq = ReqOf<"jotformDigestUpsert">;
export type JotformDigestUpsertResp = RespOf<"jotformDigestUpsert">;
export type JotformDigestGetReq = ReqOf<"jotformDigestGet">;
export type JotformDigestGetResp = RespOf<"jotformDigestGet">;
export type JotformDigestListReq = ReqOf<"jotformDigestList">;
export type JotformDigestListResp = RespOf<"jotformDigestList">;
export type JotformSyncSubmissionsReq = ReqOf<"jotformSyncSubmissions">;
export type JotformSyncSubmissionsResp = RespOf<"jotformSyncSubmissions">;

// Enrollments
export type EnrollmentsUpsertReq = ReqOf<"enrollmentsUpsert">;
export type EnrollmentsUpsertResp = RespOf<"enrollmentsUpsert">;

export type EnrollmentsPatchReq = ReqOf<"enrollmentsPatch">;
export type EnrollmentsPatchResp = RespOf<"enrollmentsPatch">;

export type EnrollmentsDeleteReq = ReqOf<"enrollmentsDelete">;
export type EnrollmentsDeleteResp = RespOf<"enrollmentsDelete">;

export type EnrollmentsAdminDeleteReq = ReqOf<"enrollmentsAdminDelete">;
export type EnrollmentsAdminDeleteResp = RespOf<"enrollmentsAdminDelete">;

export type EnrollmentsEnrollCustomerReq = ReqOf<"enrollmentsEnrollCustomer">;
export type EnrollmentsEnrollCustomerResp = RespOf<"enrollmentsEnrollCustomer">;

export type EnrollmentsBulkEnrollReq = ReqOf<"enrollmentsBulkEnroll">;
export type EnrollmentsBulkEnrollResp = RespOf<"enrollmentsBulkEnroll">;

export type EnrollmentsCheckOverlapsReq = ReqOf<"enrollmentsCheckOverlaps">;
export type EnrollmentsCheckOverlapsResp = RespOf<"enrollmentsCheckOverlaps">;

export type EnrollmentsCheckDualReq = ReqOf<"enrollmentsCheckDual">;
export type EnrollmentsCheckDualResp = RespOf<"enrollmentsCheckDual">;

export type EnrollmentsMigrateReq = ReqOf<"enrollmentsMigrate">;
export type EnrollmentsMigrateResp = RespOf<"enrollmentsMigrate">;

export type EnrollmentsUndoMigrationReq = ReqOf<"enrollmentsUndoMigration">;
export type EnrollmentsUndoMigrationResp = RespOf<"enrollmentsUndoMigration">;

export type EnrollmentsAdminReverseLedgerEntryReq = ReqOf<"enrollmentsAdminReverseLedgerEntry">;
export type EnrollmentsAdminReverseLedgerEntryResp = RespOf<"enrollmentsAdminReverseLedgerEntry">;

export type EnrollmentsListQuery = ReqOf<"enrollmentsList">;
export type EnrollmentsListResp = RespOf<"enrollmentsList">;

export type EnrollmentGetByIdQuery = ReqOf<"enrollmentGetById">;
export type EnrollmentGetByIdResp = RespOf<"enrollmentGetById">;

// Payments
export type PaymentsUpsertProjectionsReq = ReqOf<"paymentsUpsertProjections">;
export type PaymentsUpsertProjectionsResp = RespOf<"paymentsUpsertProjections">;

export type PaymentsBulkCopyScheduleReq = ReqOf<"paymentsBulkCopySchedule">;
export type PaymentsBulkCopyScheduleResp = RespOf<"paymentsBulkCopySchedule">;

export type PaymentsSpendReq = ReqOf<"paymentsSpend">;
export type PaymentsSpendResp = RespOf<"paymentsSpend">;

export type PaymentsRecalculateFutureReq = ReqOf<"paymentsRecalculateFuture">;
export type PaymentsRecalculateFutureResp = RespOf<"paymentsRecalculateFuture">;

export type PaymentsUpdateComplianceReq = ReqOf<"paymentsUpdateCompliance">;
export type PaymentsUpdateComplianceResp = RespOf<"paymentsUpdateCompliance">;

export type PaymentsUpdateGrantBudgetReq = ReqOf<"paymentsUpdateGrantBudget">;
export type PaymentsUpdateGrantBudgetResp = RespOf<"paymentsUpdateGrantBudget">;

export type PaymentsRecalcGrantProjectedReq = ReqOf<"paymentsRecalcGrantProjected">;
export type PaymentsRecalcGrantProjectedResp = RespOf<"paymentsRecalcGrantProjected">;

export type PaymentsAdjustProjectionsReq = ReqOf<"paymentsAdjustProjections">;
export type PaymentsAdjustProjectionsResp = RespOf<"paymentsAdjustProjections">;

export type PaymentsAdjustSpendReq = ReqOf<"paymentsAdjustSpend">;
export type PaymentsAdjustSpendResp = RespOf<"paymentsAdjustSpend">;

// Ledger
export type LedgerListReq = ReqOf<"ledgerList">;
export type LedgerListResp = RespOf<"ledgerList">;

export type LedgerCreateReq = ReqOf<"ledgerCreate">;
export type LedgerCreateResp = RespOf<"ledgerCreate">;

export type LedgerClassifyReq = ReqOf<"ledgerClassify">;
export type LedgerClassifyResp = RespOf<"ledgerClassify">;

export type LedgerAutoAssignReq = ReqOf<"ledgerAutoAssign">;
export type LedgerAutoAssignResp = RespOf<"ledgerAutoAssign">;

export type LedgerGetByIdReq = ReqOf<"ledgerGetById">;
export type LedgerGetByIdResp = RespOf<"ledgerGetById">;

export type LedgerBalanceReq = ReqOf<"ledgerBalance">;
export type LedgerBalanceResp = RespOf<"ledgerBalance">;

export type LedgerDeleteReq = ReqOf<"ledgerDelete">;
export type LedgerDeleteResp = RespOf<"ledgerDelete">;

// Drive
export type GDriveListReq = ReqOf<"gdriveList">;
export type GDriveListResp = RespOf<"gdriveList">;

export type GDriveCreateFolderReq = ReqOf<"gdriveCreateFolder">;
export type GDriveCreateFolderResp = RespOf<"gdriveCreateFolder">;

export type GDriveUploadReq = ReqOf<"gdriveUpload">;
export type GDriveUploadResp = RespOf<"gdriveUpload">;

export type GDriveConfigGetResp = RespOf<"gdriveConfigGet">;
export type GDriveConfigPatchReq = ReqOf<"gdriveConfigPatch">;
export type GDriveConfigPatchResp = RespOf<"gdriveConfigPatch">;

export type GDriveCustomerFolderIndexResp = RespOf<"gdriveCustomerFolderIndex">;
export type GDriveBuildCustomerFolderResp = RespOf<"gdriveBuildCustomerFolder">;

// If you still want these names explicitly:
export type GDriveFile =
  GDriveListResp extends Ok<infer T>
    ? T extends { files?: Array<infer F> }
      ? F
      : Record<string, unknown>
    : Record<string, unknown>;

// Inbox
export type InboxListMyQuery = ReqOf<"inboxListMy">;
export type InboxListMyResp = RespOf<"inboxListMy">;
export type InboxMetricsMyQuery = ReqOf<"inboxMetricsMy">;
export type InboxMetricsMyResp = RespOf<"inboxMetricsMy">;
export type { TInboxMetricsScope } from "@hdb/contracts";

export type InboxSendInviteReq = ReqOf<"inboxSendInvite">;
export type InboxSendInviteResp = RespOf<"inboxSendInvite">;

export type InboxSendMonthlySummaryReq = ReqOf<"inboxSendMonthlySummary">;
export type InboxSendMonthlySummaryResp = RespOf<"inboxSendMonthlySummary">;

export type DigestSendNowReq = ReqOf<"inboxSendDigestNow">;
export type DigestSendNowResp = RespOf<"inboxSendDigestNow">;
export type DigestScheduleReq = ReqOf<"inboxScheduleDigest">;
export type DigestScheduleResp = RespOf<"inboxScheduleDigest">;
export type InboxDigestPreviewReq = ReqOf<"inboxDigestPreview">;
export type InboxDigestPreviewResp = RespOf<"inboxDigestPreview">;

export type InboxEmailResp = InboxSendInviteResp; // compat alias

// Users
export type UsersCreateReq = ReqOf<"usersCreate">;
export type UsersCreateResp = RespOf<"usersCreate">;

export type UsersInviteReq = ReqOf<"usersInvite">;
export type UsersInviteResp = RespOf<"usersInvite">;

export type UsersSetRoleReq = ReqOf<"usersSetRole">;
export type UsersSetRoleResp = RespOf<"usersSetRole">;

export type UsersSetActiveReq = ReqOf<"usersSetActive">;
export type UsersSetActiveResp = RespOf<"usersSetActive">;

export type UsersUpdateProfileReq = ReqOf<"usersUpdateProfile">;
export type UsersUpdateProfileResp = RespOf<"usersUpdateProfile">;

export type UsersResendInviteReq = ReqOf<"usersResendInvite">;
export type UsersResendInviteResp = RespOf<"usersResendInvite">;

export type UsersRevokeSessionsReq = ReqOf<"usersRevokeSessions">;
export type UsersRevokeSessionsResp = RespOf<"usersRevokeSessions">;

export type UsersListQuery = ReqOf<"usersList">;
export type UsersListResp = RespOf<"usersList">;

export type UsersMeResp = RespOf<"usersMe">;

export type UsersMeUpdateReq = ReqOf<"usersMeUpdate">;
export type UsersMeUpdateResp = RespOf<"usersMeUpdate">;

// Misc
export type HealthResp = RespOf<"health">;
export type CreateSessionResp = RespOf<"createSession">;

// Assessments (now contracted via EndpointMap; keep FE alias names for convenience)
export type AssessmentTemplatesUpsertReq = ReqOf<"assessmentTemplatesUpsert">;
export type AssessmentTemplatesUpsertResp = RespOf<"assessmentTemplatesUpsert">;

export type AssessmentTemplatesGetQuery = ReqOf<"assessmentTemplatesGet">;
export type AssessmentTemplatesGetResp = RespOf<"assessmentTemplatesGet">;

export type AssessmentTemplatesListReq = ReqOf<"assessmentTemplatesList">;
export type AssessmentTemplatesListResp = RespOf<"assessmentTemplatesList">;

export type AssessmentTemplatesDeleteReq = ReqOf<"assessmentTemplatesDelete">;
export type AssessmentTemplatesDeleteResp = RespOf<"assessmentTemplatesDelete">;

export type AssessmentSubmitReq = ReqOf<"assessmentSubmit">;
export type AssessmentSubmitResp = RespOf<"assessmentSubmit">;

export type AssessmentSubmissionGetQuery = ReqOf<"assessmentSubmissionGet">;
export type AssessmentSubmissionGetResp = RespOf<"assessmentSubmissionGet">;

export type AssessmentSubmissionsListReq = ReqOf<"assessmentSubmissionsList">;
export type AssessmentSubmissionsListResp = RespOf<"assessmentSubmissionsList">;

export type AssessmentTemplateRecalcReq = ReqOf<"assessmentTemplateRecalc">;
export type AssessmentTemplateRecalcResp = RespOf<"assessmentTemplateRecalc">;

// Tours
export type ToursUpsertReq = ReqOf<"toursUpsert">;
export type ToursUpsertResp = RespOf<"toursUpsert">;

export type ToursPatchReq = ReqOf<"toursPatch">;
export type ToursPatchResp = RespOf<"toursPatch">;

export type ToursDeleteReq = ReqOf<"toursDelete">;
export type ToursDeleteResp = RespOf<"toursDelete">;

export type ToursAdminDeleteReq = ReqOf<"toursAdminDelete">;
export type ToursAdminDeleteResp = RespOf<"toursAdminDelete">;

export type ToursListReq = ReqOf<"toursList">;
export type ToursListResp = RespOf<"toursList">;

export type ToursGetReq = ReqOf<"toursGet">;
export type ToursGetResp = RespOf<"toursGet">;

export type ToursStructureResp = RespOf<"toursStructure">;

// Tasks (endpoint-typed; entity types already exported above)
export type TasksGenerateScheduleWriteReq = ReqOf<"tasksGenerateScheduleWrite">;
export type TasksGenerateScheduleWriteResp = RespOf<"tasksGenerateScheduleWrite">;

export type TasksAssignReq = ReqOf<"tasksAssign">;
export type TasksAssignResp = RespOf<"tasksAssign">;

export type TasksUpdateFieldsReq = ReqOf<"tasksUpdateFields">;
export type TasksUpdateFieldsResp = RespOf<"tasksUpdateFields">;

export type TasksUpdateStatusReq = ReqOf<"tasksUpdateStatus">;
export type TasksUpdateStatusResp = RespOf<"tasksUpdateStatus">;

export type TasksDeleteReq = ReqOf<"tasksDelete">;
export type TasksDeleteResp = RespOf<"tasksDelete">;

export type TasksBulkStatusReq = ReqOf<"tasksBulkStatus">;
export type TasksBulkStatusResp = RespOf<"tasksBulkStatus">;

export type TasksListQuery = ReqOf<"tasksList">;
export type TasksListResp = RespOf<"tasksList">;

export type TasksRescheduleReq = ReqOf<"tasksReschedule">;
export type TasksRescheduleResp = RespOf<"tasksReschedule">;

export type TasksUpsertManualReq = ReqOf<"tasksUpsertManual">;
export type TasksUpsertManualResp = RespOf<"tasksUpsertManual">;

export type TasksAdminRegenerateForGrantReq = ReqOf<"tasksAdminRegenerateForGrant">;
export type TasksAdminRegenerateForGrantResp = RespOf<"tasksAdminRegenerateForGrant">;

export type TasksOtherCreateReq = ReqOf<"tasksOtherCreate">;
export type TasksOtherCreateResp = RespOf<"tasksOtherCreate">;
export type TasksOtherUpdateReq = ReqOf<"tasksOtherUpdate">;
export type TasksOtherUpdateResp = RespOf<"tasksOtherUpdate">;
export type TasksOtherAssignReq = ReqOf<"tasksOtherAssign">;
export type TasksOtherAssignResp = RespOf<"tasksOtherAssign">;
export type TasksOtherStatusReq = ReqOf<"tasksOtherStatus">;
export type TasksOtherStatusResp = RespOf<"tasksOtherStatus">;
export type TasksOtherListMyQuery = ReqOf<"tasksOtherListMy">;
export type TasksOtherListMyResp = RespOf<"tasksOtherListMy">;

// -----------------------------------------------------------------------------
// WEB-ONLY types (UI convenience, not in contracts)
// -----------------------------------------------------------------------------

// Canonical narrow date strings we use in the UI
export type ISODate = string & { readonly __brand: "ISODate10" }; // "YYYY-MM-DD"
export type YearMonth = string & { readonly __brand: "YearMonth" }; // "YYYY-MM"

// Firestore-like timestamp we accept in utils
export type FirestoreTsLike = {
  _seconds?: number;
  _nanoseconds?: number;
  seconds?: number;
  nanoseconds?: number;
  toMillis?: () => number;
};

// UI convenience aliases (keep until you’ve scrubbed callsites)
export type TaskScheduleItem = import("@hdb/contracts").TTaskScheduleItem;
export type PaymentProjection = import("@hdb/contracts").TPayment;
export type TRole = import("@hdb/contracts").TRoleTag | import("@hdb/contracts").TTopRole;

// -----------------------------------------------------------------------------
// ACUITY (legacy FE-only — should be replaced by assessments templates/submissions)
// -----------------------------------------------------------------------------

// TODO(contracts): If “acuityRubrics*” endpoints still exist, add them to EndpointMap in contracts.
// TODO(web): Once contracts owns these endpoints, delete these FE-only types.

export type AcuityRubricDoc = {
  id: string;
  title: string;
  version?: string | null;
  questions?: Array<Record<string, unknown>>;
  levels?: Array<Record<string, unknown>>;
  updatedAt?: unknown | null;
};

export type AcuityRubricsSetResp = Ok<{ id: string }>;
export type AcuityRubricsGetResp = Ok<{ rubric: Record<string, unknown> & { id: string } }>;
export type AcuityRubricsListResp = Ok<{
  items: Array<{
    id: string;
    title: string;
    version: string | null;
    questionsCount: number;
    updatedAt: unknown | null;
  }>;
}>;
export type AcuityRubricsDeleteResp = Ok<{ deleted: true }>;
export type AcuitySubmitAnswersResp = Ok<{ customerId: string; score: number; level: string }>;
export type AcuityRecalcRubricResp = Ok<{ updated: number }>;

// -----------------------------------------------------------------------------
// PAYMENTS (generate projections FE-only until it’s in EndpointMap)
// -----------------------------------------------------------------------------

export type PaymentsGenerateProjectionsReq = ReqOf<"paymentsGenerateProjections">;
export type PaymentsGenerateProjectionsResp = RespOf<"paymentsGenerateProjections">;
