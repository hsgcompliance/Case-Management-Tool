// contracts/src/endpointMap.ts
// Canonical endpoint req/resp typing. This is the source of truth.

import type {
  Ok,
  OkEmpty,
  Err,
  PaginatedResp,
} from "./http";

/* ============================================================================
   Assessments
============================================================================ */

import type {
  TAssessmentTemplateDoc,
  TAssessmentSubmissionDoc,
  TAssessmentTemplateUpsertReq,
  TGetTemplateReq,
  TListTemplatesReq,
  TDeleteTemplateReq,
  TSubmitAssessmentReq,
  TGetSubmissionReq,
  TListSubmissionsReq,
  TRecalcTemplateReq,
} from "./assessments";

/* ============================================================================
   Tasks
============================================================================ */

import type {
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

// ---------------- Tasks ----------------

export type TasksGenerateScheduleWriteReq = TTasksGenerateScheduleWriteBody;
export type TasksGenerateScheduleWriteResp = Ok<{
  results: TTasksGenerateScheduleWriteResult[];
}>;

export type TasksAssignReq = TTasksAssignBody;
export type TasksAssignResp = OkEmpty;

export type TasksUpdateFieldsReq = TTasksUpdateFieldsBody;
export type TasksUpdateFieldsResp = OkEmpty;

export type TasksUpdateStatusReq = TTasksUpdateStatusBody;
export type TasksUpdateStatusResp = OkEmpty;

export type TasksDeleteReq = TTasksDeleteBody;
export type TasksDeleteResp = Ok<{ removed: string }>;

export type TasksAdminRegenerateForGrantReq = TTasksAdminRegenerateForGrantBody;
export type TasksAdminRegenerateForGrantResp = Ok<{
  count: number;
  results: TTasksAdminRegenerateForGrantResultItem[];
}>;

export type TasksBulkStatusReq = TTasksBulkStatusBody;
export type TasksBulkStatusResp = OkEmpty;

export type TasksListReq = TTasksListQuery;
export type TasksListResp = Ok<{ items: TTasksListItem[] }>;

export type TasksRescheduleReq = TTasksRescheduleBody;
export type TasksRescheduleResp = OkEmpty;

export type TasksUpsertManualReq = TTasksUpsertManualBody;
export type TasksUpsertManualResp = OkEmpty;

// ---------------- OtherTasks ----------------

export type TasksOtherCreateReq = TTasksOtherCreateBody;
export type TasksOtherCreateResp = Ok<{ id: string }>;

export type TasksOtherUpdateReq = TTasksOtherUpdateBody;
export type TasksOtherUpdateResp = Ok<{ id: string }>;

export type TasksOtherAssignReq = TTasksOtherAssignBody;
export type TasksOtherAssignResp = Ok<{ id: string }>;

export type TasksOtherStatusReq = TTasksOtherStatusBody;
export type TasksOtherStatusResp = Ok<{ id: string }>;

export type TasksOtherListMyReq = TTasksOtherListMyQuery;
export type TasksOtherListMyResp = Ok<{ items: Array<Record<string, unknown>> }>;

/* ============================================================================
   Customers
============================================================================ */

import type {
  // surface types
  CustomerInput,
  TCustomerEntity,
  TPopulation,
  TCustomerStatus,

  // request bodies + responses
  TCustomersUpsertBody,
  TCustomersUpsertResp,

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

/* ============================================================================
   Credit Cards
============================================================================ */
import type {
  TCreditCard,
  TCreditCardEntity,
  TCreditCardStatus,
  TCreditCardKind,
  TCreditCardCycleType,
  TCreditCardMatching,
  TCreditCardLimitOverride,
  TCreditCardsUpsertBody,
  TCreditCardsUpsertResp,
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
  TCreditCardsSummaryResp,
} from "./creditCards";

// ----- optional “surface” aliases -----
export type TCustomerInput = CustomerInput;
export type CustomerEntity = TCustomerEntity;
export type CustomerPopulation = TPopulation;
export type CustomerStatus = TCustomerStatus;

// ----- endpoint-specific aliases (Req/Resp) -----
export type CustomersUpsertReq = TCustomersUpsertBody;
export type CustomersUpsertResp = TCustomersUpsertResp;

export type CustomersPatchReq = TCustomersPatchBody;
export type CustomersPatchResp = TCustomersPatchResp;

export type CustomersSoftDeleteReq = TCustomersDeleteBody;
export type CustomersSoftDeleteResp = TCustomersDeleteResp;

export type CustomersHardDeleteReq = TCustomersAdminDeleteBody;
export type CustomersHardDeleteResp = TCustomersAdminDeleteResp;

export type CustomersGetQuery = TCustomersGetQuery;
export type CustomersGetResp = TCustomersGetResp;

export type CustomersListQuery = TCustomersListQuery;
export type CustomersListResp = TCustomersListResp;
export type CustomersBackfillNamesReq = TCustomersBackfillNamesBody;
export type CustomersBackfillNamesResp = TCustomersBackfillNamesResp;
export type CustomersBackfillCaseManagerNamesReq = TCustomersBackfillCaseManagerNamesBody;
export type CustomersBackfillCaseManagerNamesResp = TCustomersBackfillCaseManagerNamesResp;
export type CustomersBackfillAssistanceLengthReq = TCustomersBackfillAssistanceLengthBody;
export type CustomersBackfillAssistanceLengthResp = TCustomersBackfillAssistanceLengthResp;

// ----- credit card aliases -----
export type TCreditCardInput = TCreditCard;
export type CreditCardEntity = TCreditCardEntity;
export type CreditCardStatus = TCreditCardStatus;
export type CreditCardKind = TCreditCardKind;
export type CreditCardCycleType = TCreditCardCycleType;
export type CreditCardMatching = TCreditCardMatching;
export type CreditCardLimitOverride = TCreditCardLimitOverride;

export type CreditCardsUpsertReq = TCreditCardsUpsertBody;
export type CreditCardsUpsertResp = TCreditCardsUpsertResp;

export type CreditCardsPatchReq = TCreditCardsPatchBody;
export type CreditCardsPatchResp = TCreditCardsPatchResp;

export type CreditCardsDeleteReq = TCreditCardsDeleteBody;
export type CreditCardsDeleteResp = TCreditCardsDeleteResp;

export type CreditCardsAdminDeleteReq = TCreditCardsAdminDeleteBody;
export type CreditCardsAdminDeleteResp = TCreditCardsAdminDeleteResp;

export type CreditCardsListReq = TCreditCardsListQuery;
export type CreditCardsListResp = TCreditCardsListResp;

export type CreditCardsGetReq = TCreditCardsGetQuery;
export type CreditCardsGetResp = TCreditCardsGetResp;

export type CreditCardsStructureReq = void;
export type CreditCardsStructureResp = TCreditCardsStructureResp;

export type CreditCardsSummaryReq = TCreditCardsSummaryQuery;
export type CreditCardsSummaryResp = TCreditCardsSummaryResp;

/* ============================================================================
   Grants
============================================================================ */
import type {
  // core
  TGrant,
  TGrantEntity,
  TGrantStatus,
  TGrantKind,
  TGrantBudgetLineItem,
  TGrantBudgetTotals,
  TGrantBudget,

  // bodies + endpoint resps
  TGrantsUpsertBody,
  TGrantsUpsertResp,

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
  TGrantsActivityResp,
} from "./grants";

// ----- surface aliases -----
export type TGrantInput = TGrant;
export type GrantEntity = TGrantEntity;
export type GrantStatus = TGrantStatus;
export type GrantKind = TGrantKind;
export type GrantBudgetLineItem = TGrantBudgetLineItem;
export type GrantBudgetTotals = TGrantBudgetTotals;
export type GrantBudget = TGrantBudget;

// ----- endpoint aliases -----
export type GrantsUpsertReq = TGrantsUpsertBody;
export type GrantsUpsertResp = TGrantsUpsertResp;

export type GrantsPatchReq = TGrantsPatchBody;
export type GrantsPatchResp = TGrantsPatchResp;

export type GrantsDeleteReq = TGrantsDeleteBody;
export type GrantsDeleteResp = TGrantsDeleteResp;

export type GrantsAdminDeleteReq = TGrantsAdminDeleteBody;
export type GrantsAdminDeleteResp = TGrantsAdminDeleteResp;

export type GrantsListReq = TGrantsListQuery;
export type GrantsListResp = TGrantsListResp;

export type GrantsGetReq = TGrantsGetQuery;
export type GrantsGetResp = TGrantsGetResp;

export type GrantsStructureReq = void;
export type GrantsStructureResp = TGrantsStructureResp;

export type GrantsActivityReq = TGrantsActivityQuery;
export type GrantsActivityResp = TGrantsActivityResp;

/* ============================================================================
   Jotform
============================================================================ */
import type {
  TJotformSubmissionsUpsertBody,
  TJotformSubmissionsUpsertResp,
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
  TJotformFormsListResp,
  TJotformLinkSubmissionBody,
  TJotformLinkSubmissionResp,
  TJotformSyncSelectionBody,
  TJotformSyncSelectionResp,
  TJotformDigestUpsertBody,
  TJotformDigestUpsertResp,
  TJotformDigestGetQuery,
  TJotformDigestGetResp,
  TJotformDigestListQuery,
  TJotformDigestListResp,
  TJotformSyncBody,
  TJotformSyncResp,
  TJotformApiListQuery,
  TJotformApiListResp,
  TJotformApiGetQuery,
  TJotformApiGetResp,
} from "./jotform";

export type JotformSubmissionsUpsertReq = TJotformSubmissionsUpsertBody;
export type JotformSubmissionsUpsertResp = TJotformSubmissionsUpsertResp;

export type JotformSubmissionsPatchReq = TJotformSubmissionsPatchBody;
export type JotformSubmissionsPatchResp = TJotformSubmissionsPatchResp;

export type JotformSubmissionsDeleteReq = TJotformSubmissionsDeleteBody;
export type JotformSubmissionsDeleteResp = TJotformSubmissionsDeleteResp;

export type JotformSubmissionsAdminDeleteReq = TJotformSubmissionsAdminDeleteBody;
export type JotformSubmissionsAdminDeleteResp = TJotformSubmissionsAdminDeleteResp;

export type JotformSubmissionsListReq = TJotformSubmissionsListQuery;
export type JotformSubmissionsListResp = TJotformSubmissionsListResp;

export type JotformSubmissionsGetReq = TJotformSubmissionsGetQuery;
export type JotformSubmissionsGetResp = TJotformSubmissionsGetResp;

export type JotformSubmissionsStructureReq = void;
export type JotformSubmissionsStructureResp = TJotformSubmissionsStructureResp;

export type JotformFormsListReq = TJotformFormsListQuery;
export type JotformFormsListResp = TJotformFormsListResp;

export type JotformLinkSubmissionReq = TJotformLinkSubmissionBody;
export type JotformLinkSubmissionResp = TJotformLinkSubmissionResp;

export type JotformSyncSelectionReq = TJotformSyncSelectionBody;
export type JotformSyncSelectionResp = TJotformSyncSelectionResp;

export type JotformDigestUpsertReq = TJotformDigestUpsertBody;
export type JotformDigestUpsertResp = TJotformDigestUpsertResp;

export type JotformDigestGetReq = TJotformDigestGetQuery;
export type JotformDigestGetResp = TJotformDigestGetResp;

export type JotformDigestListReq = TJotformDigestListQuery;
export type JotformDigestListResp = TJotformDigestListResp;

export type JotformSyncSubmissionsReq = TJotformSyncBody;
export type JotformSyncSubmissionsResp = TJotformSyncResp;

export type JotformApiListReq = TJotformApiListQuery;
export type JotformApiListResp = TJotformApiListResp;
export type JotformApiGetReq = TJotformApiGetQuery;
export type JotformApiGetResp = TJotformApiGetResp;


/* ============================================================================
   Enrollments
============================================================================ */
import type {
  TEnrollment,
  TEnrollmentEntity,
  TEnrollmentGetByIdQuery,
  TEnrollmentGetByIdResp,
  TEnrollmentsAdminDeleteBody,
  TEnrollmentsAdminDeleteResp,
  TEnrollmentsAdminReverseLedgerEntryBody,
  TEnrollmentsAdminReverseLedgerEntryResp,
  TEnrollmentsBulkEnrollBody,
  TEnrollmentsBulkEnrollResp,
  TEnrollmentsCheckDualQuery,
  TEnrollmentsCheckDualResp,
  TEnrollmentsCheckOverlapsQuery,
  TEnrollmentsCheckOverlapsResp,
  TEnrollmentsBackfillNamesBody,
  TEnrollmentsBackfillNamesResp,
  TEnrollmentsDeleteBody,
  TEnrollmentsDeleteResp,
  TEnrollmentsEnrollCustomerBody,
  TEnrollmentsEnrollCustomerResp,
  TEnrollmentsListQuery,
  TEnrollmentsListResp,
  TEnrollmentsMigrateBody,
  TEnrollmentsMigrateResp,
  TEnrollmentsPatchBody,
  TEnrollmentsPatchRow,
  TEnrollmentsPatchResp,
  TEnrollmentsUndoMigrationBody,
  TEnrollmentsUndoMigrationResp,
  TEnrollmentsUpsertBody,
  TEnrollmentsUpsertResp
} from "./enrollments";

export type EnrollmentsAdminDeleteReq = TEnrollmentsAdminDeleteBody;
export type EnrollmentsAdminDeleteResp = TEnrollmentsAdminDeleteResp;

export type EnrollmentsAdminReverseLedgerEntryReq = TEnrollmentsAdminReverseLedgerEntryBody;
export type EnrollmentsAdminReverseLedgerEntryResp = TEnrollmentsAdminReverseLedgerEntryResp;

export type EnrollmentsBulkEnrollReq = TEnrollmentsBulkEnrollBody;
export type EnrollmentsBulkEnrollResp = TEnrollmentsBulkEnrollResp;

export type EnrollmentsCheckDualReq = TEnrollmentsCheckDualQuery;
export type EnrollmentsCheckDualResp = TEnrollmentsCheckDualResp;

export type EnrollmentsCheckOverlapsReq = TEnrollmentsCheckOverlapsQuery;
export type EnrollmentsCheckOverlapsResp = TEnrollmentsCheckOverlapsResp;

export type EnrollmentsBackfillNamesReq = TEnrollmentsBackfillNamesBody;
export type EnrollmentsBackfillNamesResp = TEnrollmentsBackfillNamesResp;

export type EnrollmentsDeleteReq = TEnrollmentsDeleteBody;
export type EnrollmentsDeleteResp = TEnrollmentsDeleteResp;

export type EnrollmentsEnrollCustomerReq = TEnrollmentsEnrollCustomerBody;
export type EnrollmentsEnrollCustomerResp = TEnrollmentsEnrollCustomerResp;

export type EnrollmentGetByIdQuery = TEnrollmentGetByIdQuery;
export type EnrollmentGetByIdResp = TEnrollmentGetByIdResp;

export type EnrollmentsListQuery = TEnrollmentsListQuery;
export type EnrollmentsListResp = TEnrollmentsListResp;

export type EnrollmentsMigrateReq = TEnrollmentsMigrateBody;
export type EnrollmentsMigrateResp = TEnrollmentsMigrateResp;

export type EnrollmentsPatchReq = TEnrollmentsPatchBody;
export type EnrollmentsPatchResp = TEnrollmentsPatchResp;
export type EnrollmentsPatchRow = TEnrollmentsPatchRow;

export type EnrollmentsUndoMigrationReq = TEnrollmentsUndoMigrationBody;
export type EnrollmentsUndoMigrationResp = TEnrollmentsUndoMigrationResp;

export type EnrollmentsUpsertReq = TEnrollmentsUpsertBody;
export type EnrollmentsUpsertResp = TEnrollmentsUpsertResp;


/* ============================================================================
   Payments
============================================================================ */

import type {
  // entities / shared shapes
  TPayment,
  TSpend,
  // request bodies
  TPaymentsSpendBody,
  TPaymentsRecalculateFutureReq,
  TPaymentsRecalcGrantProjectedBody,
  TPaymentsAdjustSpendBody,
  TPaymentsAdjustProjectionsBody,
  TPaymentsBulkCopyScheduleBody,
  TPaymentsGenerateProjectionsBody,
  TPaymentsUpdateComplianceBody,
  TPaymentsDeleteRowsBody,
  TPaymentsUpdateGrantBudgetBody,
  TPaymentsUpsertProjectionsBody,

  // operation DTOs (responses)
  TPaymentsRecalculateFutureResp,
  TPaymentsRecalcGrantProjectedResp,
  TPaymentsDeleteRowsResp,
} from "./payments";

export type TSpendEntity = TSpend;

// ---------------- Upsert Projections ----------------

export type PaymentsUpsertProjectionsReq = TPaymentsUpsertProjectionsBody;
export type PaymentsUpsertProjectionsResp = Ok<{
  id: string;
  payments: TPayment[];
}>;

// ---------------- Bulk Copy Schedule ----------------

export type PaymentsBulkCopyScheduleReq = TPaymentsBulkCopyScheduleBody;
export type PaymentsBulkCopyScheduleResp = Ok<{
  results: Array<{
    enrollmentId: string;
    ok: boolean;
    count?: number;
    error?: string;
  }>;
}>;

// ---------------- Spend ----------------

export type PaymentsSpendReq = TPaymentsSpendBody;
export type PaymentsSpendResp = Ok<{}>;

// ---------------- Recalculate Future ----------------

export type PaymentsRecalculateFutureReq = TPaymentsRecalculateFutureReq;
export type PaymentsRecalculateFutureResp = Ok<TPaymentsRecalculateFutureResp>;

// ---------------- Update Compliance ----------------

export type PaymentsUpdateComplianceReq = TPaymentsUpdateComplianceBody;
export type PaymentsUpdateComplianceResp = Ok<
  { id: string } & Partial<TEnrollmentEntity>
>;

export type PaymentsDeleteRowsReq = TPaymentsDeleteRowsBody;
export type PaymentsDeleteRowsResp = Ok<TPaymentsDeleteRowsResp> | Err;

// ---------------- Update Grant Budget ----------------

export type PaymentsUpdateGrantBudgetReq = TPaymentsUpdateGrantBudgetBody;
export type PaymentsUpdateGrantBudgetResp = Ok<Record<string, unknown>>;

// ---------------- Recalc Grant Projected ----------------

export type PaymentsRecalcGrantProjectedReq = TPaymentsRecalcGrantProjectedBody;
export type PaymentsRecalcGrantProjectedResp = Ok<TPaymentsRecalcGrantProjectedResp>;

// ---------------- Adjust Projections ----------------

export type PaymentsAdjustProjectionsReq = TPaymentsAdjustProjectionsBody;
export type PaymentsAdjustProjectionsResp =
  | Ok<{ enrollmentId?: string; payments?: TPayment[] } & Record<string, unknown>>
  | Err;

// ---------------- Adjust Spend ----------------

export type PaymentsAdjustSpendReq = TPaymentsAdjustSpendBody;
export type PaymentsAdjustSpendResp = Ok<Record<string, unknown>> | Err;

// ---------------- Generate Projections ----------------

export type PaymentsGenerateProjectionsReq = TPaymentsGenerateProjectionsBody;
export type PaymentsGenerateProjectionsResp = Ok<{ items: TPayment[] }>;

/* ============================================================================
   Drive
============================================================================ */
import type {
  TGDriveListQuery,
  TGDriveCreateFolderBody,
  TGDriveUploadBody,
  TGDriveCustomerFolderIndexQuery,
  TGDriveConfigPatchBody,
  TGDriveOrgConfig,
  TCustomerFolder,
  TGDriveBuildCustomerFolderBody,
  TGDriveCustomerFolderSyncBody,
  TGDriveSyncReconcileItem,
} from "./gdrive";
export type {
  TCustomerFolder,
  TGDriveBuildCustomerFolderBody,
  TGDriveOrgConfig,
  TGDriveCustomerFolderIndexConfig,
  TGDriveCustomerFolderSyncBody,
  TGDriveSyncReconcileItem,
} from "./gdrive";

export type GDriveFile = {
  id: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  driveId?: string;
  parents?: string[];
  iconLink?: string;
  [k: string]: unknown;
};

export type GDriveListResp = Ok<{ files?: GDriveFile[]; nextPageToken?: string } & Record<string, unknown>>;
export type GDriveCreateFolderResp = Ok<{ folder: GDriveFile }>;
export type GDriveUploadResp = Ok<{ file: GDriveFile }>;
export type GDriveBuildCustomerFolderResp = Ok<{ folder: { id: string; name: string; url: string } }>;
export type GDriveCustomerFolderIndexResp = Ok<{ folders: TCustomerFolder[] }>;
export type GDriveConfigGetResp = Ok<{ orgId: string; config: TGDriveOrgConfig }>;
export type GDriveConfigPatchResp = Ok<{ orgId: string; config: TGDriveOrgConfig }>;
export type GDriveCustomerFolderSyncResp = Ok<{
  applied?: boolean;
  apply?: boolean;
  reason?: string;
  folderId?: string;
  folderName?: string;
  targetStatus?: string;
  matchScore?: number;
  linked?: boolean;
  reasons?: string[];
  nextName?: string;
  customerId?: string;
  cwId?: string;
  direction?: string;
  count?: number;
  sheetConfigured?: boolean;
  items?: TGDriveSyncReconcileItem[];
}>;

/* =============================================================================
   Inbox
============================================================================= */
import type {
  // item types
  TInboxItem,
  TInboxItemEntity,

  // list
  TInboxListMyQuery,
  TInboxListMyResp,
  TInboxWorkloadListQuery,
  TInboxWorkloadListResp,

  // metrics
  TInboxMetricsMyQuery,
  TInboxMetricsMyResp,

  // email
  TInboxSendInviteBody,
  TInboxSendMonthlySummaryBody,
  TInboxEmailResp,

  // digest
  TInboxDigestPreviewQuery,
  TInboxDigestPreviewResp,
  TInboxSendDigestNowBody,
  TInboxSendDigestNowResp,
  TInboxScheduleDigestBody,
  TInboxScheduleDigestResp,
  TInboxDigestSubsGetResp,
  TInboxDigestSubUpdateReq,
  TInboxDigestSubUpdateResp,
  TInboxDigestHtmlPreviewReq,
  TInboxDigestHtmlPreviewResp,
} from "./inbox";

// ---------------- Inbox ----------------

export type InboxListMyQuery = TInboxListMyQuery;
export type InboxListMyResp = TInboxListMyResp;
export type InboxWorkloadListQuery = TInboxWorkloadListQuery;
export type InboxWorkloadListResp = TInboxWorkloadListResp;
export type InboxMetricsMyQuery = TInboxMetricsMyQuery;
export type InboxMetricsMyResp = TInboxMetricsMyResp;

export type InboxSendInviteReq = TInboxSendInviteBody;
export type InboxSendMonthlySummaryReq = TInboxSendMonthlySummaryBody;
export type InboxEmailResp = TInboxEmailResp;

export type InboxDigestPreviewQuery = TInboxDigestPreviewQuery;
export type InboxDigestPreviewResp = TInboxDigestPreviewResp;

export type InboxSendDigestNowReq = TInboxSendDigestNowBody;
export type InboxSendDigestNowResp = TInboxSendDigestNowResp;
export type InboxScheduleDigestReq = TInboxScheduleDigestBody;
export type InboxScheduleDigestResp = TInboxScheduleDigestResp;
export type InboxDigestSubsGetResp = TInboxDigestSubsGetResp;
export type InboxDigestSubUpdateReq = TInboxDigestSubUpdateReq;
export type InboxDigestSubUpdateResp = TInboxDigestSubUpdateResp;
export type InboxDigestHtmlPreviewReq = TInboxDigestHtmlPreviewReq;
export type InboxDigestHtmlPreviewResp = TInboxDigestHtmlPreviewResp;


/* ============================================================================
   Ledger
============================================================================ */

import type {
  TLedgerEntry,
  TLedgerListBody,
  TLedgerCreateBody,
  TLedgerClassifyBody,
  TLedgerClassifyResp,
  TLedgerAutoAssignBody,
  TLedgerAutoAssignResp,
  TLedgerGetByIdParams,
  TLedgerBalanceQuery,
} from "./ledger";

export type LedgerListReq = TLedgerListBody;
export type LedgerListResp = Ok<{
  entries: TLedgerEntry[];
  count: number;
  hasMore: boolean;
}>;

export type LedgerCreateReq = TLedgerCreateBody;
export type LedgerCreateResp = Ok<{ entry: TLedgerEntry }>;

export type LedgerClassifyReq = TLedgerClassifyBody;
export type LedgerClassifyResp = Ok<TLedgerClassifyResp>;

export type LedgerAutoAssignReq = TLedgerAutoAssignBody;
export type LedgerAutoAssignResp = Ok<TLedgerAutoAssignResp>;

export type LedgerGetByIdReq = TLedgerGetByIdParams;
export type LedgerGetByIdResp = Ok<{ entry: TLedgerEntry }>;

export type LedgerBalanceReq = TLedgerBalanceQuery;
export type LedgerBalanceResp = Ok<{
  balances: Record<
    string,
    { totalCents: number; totalAmount: number; count: number; entries: string[] }
  >;
  groupBy: TLedgerBalanceQuery["groupBy"];
}>;

export type LedgerDeleteReq = TLedgerGetByIdParams;
export type LedgerDeleteResp = Ok<{ deleted: string }>;

/* ============================================================================
   Users
============================================================================ */
import type {
  TUserExtras,
  UserComposite,
  OrgManagerOrgT,
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

export type UsersCreateReq = CreateUserBodyIn;
export type UsersCreateResp = Ok<{ user: UserComposite }>;

export type UsersInviteReq = InviteUserBodyIn;
// current implementation returns { ...composite, inviteEmail: sent }
export type UsersInviteResp = Ok<{ user: UserComposite & { inviteEmail?: unknown } }>;

export type UsersSetRoleReq = SetRoleBodyIn;
export type UsersSetRoleResp = Ok<{ user: UserComposite }>;

export type UsersSetActiveReq = SetActiveBodyIn;
export type UsersSetActiveResp = Ok<{ user: UserComposite }>;

export type UsersUpdateProfileReq = UpdateUserProfileBodyIn;
export type UsersUpdateProfileResp = Ok<{ user: UserComposite }>;

export type UsersResendInviteReq = ResendInviteBodyIn;
export type UsersResendInviteResp = Ok<{ user: UserComposite; inviteEmail?: unknown }>;

export type UsersRevokeSessionsReq = RevokeSessionsBodyIn;
export type UsersRevokeSessionsResp = Ok<{
  orgId: string | null;
  scope: "org" | "all";
  scanned: number;
  revoked: number;
  pages: number;
}>;

export type UsersListQuery = ListUsersBodyIn;
export type UsersListResp = Ok<{ users: UserComposite[]; nextPageToken?: string | null }>;

export type DevOrgsListReq = OrgManagerListOrgsBodyIn;
export type DevOrgsListResp = Ok<{ items: OrgManagerOrgT[] }>;

export type DevOrgsUpsertReq = OrgManagerUpsertOrgBodyIn;
export type DevOrgsUpsertResp = Ok<{ org: OrgManagerOrgT }>;

export type DevOrgsPatchTeamsReq = OrgManagerPatchTeamsBodyIn;
export type DevOrgsPatchTeamsResp = Ok<{ org: OrgManagerOrgT }>;

export type UsersMeResp = Ok<{ user: UserComposite | null }>;
export type UsersMeUpdateReq = UpdateMeBodyIn;
export type UsersMeUpdateResp = Ok<{ uid: string; extras: TUserExtras | Record<string, unknown> }>;

/* ============================================================================
   Tours
============================================================================ */

import type {
  TourFlowT,
  ToursUpsertBodyT,
  ToursPatchBodyT,
  ToursDeleteBodyT,
  ToursGetQueryT,
  ToursListQueryT,
} from "./tours";

export type TTourFlowEntity = TourFlowT & { id: string };

export type ToursUpsertReq = ToursUpsertBodyT;
export type ToursUpsertResp = Ok<{ ids: string[]; count: number }>;

export type ToursPatchReq = ToursPatchBodyT;
export type ToursPatchResp = Ok<{ ids: string[]; count: number }>;

export type ToursDeleteReq = ToursDeleteBodyT;
export type ToursDeleteResp = Ok<{ ids: string[]; deleted: true }>;

export type ToursAdminDeleteReq = ToursDeleteBodyT;
export type ToursAdminDeleteResp = Ok<{ ids: string[]; hardDeleted: true }>;

export type ToursListReq = ToursListQueryT;
export type ToursListResp = Ok<{
  items: Array<TourFlowT & Record<string, unknown>>; // handler returns { id, ...data }
  next: string | null;
}>;

export type ToursGetReq = ToursGetQueryT;
export type ToursGetResp = Ok<{ tour: TourFlowT & Record<string, unknown> }>;

export type ToursStructureReq = void;
export type ToursStructureResp = Ok<{ structure: Partial<TourFlowT> }>;


/* ============================================================================
   Misc
============================================================================ */

export type HealthResp = Ok<Record<string, unknown>>;
export type CreateSessionResp = Ok<Record<string, unknown>>;

/* ============================================================================
   EndpointMap (canonical)
============================================================================ */

export interface EndpointMap {
  // ASSESSMENTS (templates + submissions)
  assessmentTemplatesUpsert: { req: TAssessmentTemplateUpsertReq; resp: Ok<{ ids: string[] }> };
  assessmentTemplatesGet: { req: TGetTemplateReq; resp: Ok<{ template: TAssessmentTemplateDoc }> };
  assessmentTemplatesList: { req: TListTemplatesReq; resp: Ok<{ items: TAssessmentTemplateDoc[] }> };
  assessmentTemplatesDelete: { req: TDeleteTemplateReq; resp: Ok<{ deleted: true }> };

  assessmentSubmit: { req: TSubmitAssessmentReq; resp: Ok<Record<string, unknown>> };
  assessmentSubmissionGet: { req: TGetSubmissionReq; resp: Ok<{ submission: TAssessmentSubmissionDoc }> };
  assessmentSubmissionsList: { req: TListSubmissionsReq; resp: Ok<{ items: TAssessmentSubmissionDoc[] }> };
  assessmentTemplateRecalc: { req: TRecalcTemplateReq; resp: Ok<{ updated: number }> };

  // CUSTOMERS
  customersUpsert: { req: CustomersUpsertReq; resp: CustomersUpsertResp };
  customersPatch: { req: CustomersPatchReq; resp: CustomersPatchResp };
  customersDelete: { req: CustomersSoftDeleteReq; resp: CustomersSoftDeleteResp };
  customersAdminDelete: { req: CustomersHardDeleteReq; resp: CustomersHardDeleteResp };
  customersGet: { req: CustomersGetQuery; resp: CustomersGetResp };
  customersList: { req: CustomersListQuery; resp: CustomersListResp };
  customersBackfillNames: { req: CustomersBackfillNamesReq; resp: CustomersBackfillNamesResp };
  customersBackfillCaseManagerNames: { req: CustomersBackfillCaseManagerNamesReq; resp: CustomersBackfillCaseManagerNamesResp };
  customersBackfillAssistanceLength: { req: CustomersBackfillAssistanceLengthReq; resp: CustomersBackfillAssistanceLengthResp };

  // CREDIT CARDS
  creditCardsUpsert: { req: CreditCardsUpsertReq; resp: CreditCardsUpsertResp };
  creditCardsPatch: { req: CreditCardsPatchReq; resp: CreditCardsPatchResp };
  creditCardsDelete: { req: CreditCardsDeleteReq; resp: CreditCardsDeleteResp };
  creditCardsAdminDelete: { req: CreditCardsAdminDeleteReq; resp: CreditCardsAdminDeleteResp };
  creditCardsList: { req: CreditCardsListReq; resp: CreditCardsListResp };
  creditCardsGet: { req: CreditCardsGetReq; resp: CreditCardsGetResp };
  creditCardsStructure: { req: CreditCardsStructureReq; resp: CreditCardsStructureResp };
  creditCardsSummary: { req: CreditCardsSummaryReq; resp: CreditCardsSummaryResp };

  // ENROLLMENTS
  enrollmentsUpsert: { req: EnrollmentsUpsertReq; resp: EnrollmentsUpsertResp };
  enrollmentsPatch: { req: EnrollmentsPatchReq; resp: EnrollmentsPatchResp };
  enrollmentsList: { req: EnrollmentsListQuery; resp: EnrollmentsListResp };
  enrollmentGetById: { req: EnrollmentGetByIdQuery; resp: EnrollmentGetByIdResp };
  enrollmentsDelete: { req: EnrollmentsDeleteReq; resp: EnrollmentsDeleteResp };
  enrollmentsAdminDelete: { req: EnrollmentsAdminDeleteReq; resp: EnrollmentsAdminDeleteResp };
  enrollmentsEnrollCustomer: { req: EnrollmentsEnrollCustomerReq; resp: EnrollmentsEnrollCustomerResp };
  enrollmentsBulkEnroll: { req: EnrollmentsBulkEnrollReq; resp: EnrollmentsBulkEnrollResp };
  enrollmentsCheckOverlaps: { req: EnrollmentsCheckOverlapsReq; resp: EnrollmentsCheckOverlapsResp };
  enrollmentsCheckDual: { req: EnrollmentsCheckDualReq; resp: EnrollmentsCheckDualResp };
  enrollmentsBackfillNames: { req: EnrollmentsBackfillNamesReq; resp: EnrollmentsBackfillNamesResp };
  enrollmentsMigrate: { req: EnrollmentsMigrateReq; resp: EnrollmentsMigrateResp };
  enrollmentsUndoMigration: { req: EnrollmentsUndoMigrationReq; resp: EnrollmentsUndoMigrationResp };
  enrollmentsAdminReverseLedgerEntry: { req: EnrollmentsAdminReverseLedgerEntryReq; resp: EnrollmentsAdminReverseLedgerEntryResp };

  // GRANTS
  grantsUpsert: { req: GrantsUpsertReq; resp: GrantsUpsertResp };
  grantsPatch: { req: GrantsPatchReq; resp: GrantsPatchResp };
  grantsDelete: { req: GrantsDeleteReq; resp: GrantsDeleteResp };
  grantsAdminDelete: { req: GrantsAdminDeleteReq; resp: GrantsAdminDeleteResp };
  grantsList: { req: GrantsListReq; resp: GrantsListResp };
  grantsGet: { req: GrantsGetReq; resp: GrantsGetResp };
  grantsStructure: { req: GrantsStructureReq; resp: GrantsStructureResp };
  grantsActivity: { req: GrantsActivityReq; resp: GrantsActivityResp };

  // JOTFORM
  jotformSubmissionsUpsert: { req: JotformSubmissionsUpsertReq; resp: JotformSubmissionsUpsertResp };
  jotformSubmissionsPatch: { req: JotformSubmissionsPatchReq; resp: JotformSubmissionsPatchResp };
  jotformSubmissionsDelete: { req: JotformSubmissionsDeleteReq; resp: JotformSubmissionsDeleteResp };
  jotformSubmissionsAdminDelete: { req: JotformSubmissionsAdminDeleteReq; resp: JotformSubmissionsAdminDeleteResp };
  jotformSubmissionsList: { req: JotformSubmissionsListReq; resp: JotformSubmissionsListResp };
  jotformSubmissionsGet: { req: JotformSubmissionsGetReq; resp: JotformSubmissionsGetResp };
  jotformSubmissionsStructure: { req: JotformSubmissionsStructureReq; resp: JotformSubmissionsStructureResp };
  jotformFormsList: { req: JotformFormsListReq; resp: JotformFormsListResp };
  jotformLinkSubmission: { req: JotformLinkSubmissionReq; resp: JotformLinkSubmissionResp };
  jotformSyncSelection: { req: JotformSyncSelectionReq; resp: JotformSyncSelectionResp };
  jotformDigestUpsert: { req: JotformDigestUpsertReq; resp: JotformDigestUpsertResp };
  jotformDigestGet: { req: JotformDigestGetReq; resp: JotformDigestGetResp };
  jotformDigestList: { req: JotformDigestListReq; resp: JotformDigestListResp };
  jotformSyncSubmissions: { req: JotformSyncSubmissionsReq; resp: JotformSyncSubmissionsResp };
  jotformApiSubmissionsList: { req: JotformApiListReq; resp: JotformApiListResp };
  jotformApiSubmissionGet: { req: JotformApiGetReq; resp: JotformApiGetResp };

  // PAYMENTS 
  paymentsGenerateProjections: { req: PaymentsGenerateProjectionsReq; resp: PaymentsGenerateProjectionsResp };
  paymentsUpsertProjections: { req: PaymentsUpsertProjectionsReq; resp: PaymentsUpsertProjectionsResp };
  paymentsBulkCopySchedule: { req: PaymentsBulkCopyScheduleReq; resp: PaymentsBulkCopyScheduleResp };
  paymentsSpend: { req: PaymentsSpendReq; resp: PaymentsSpendResp };
  paymentsUpdateCompliance: { req: PaymentsUpdateComplianceReq; resp: PaymentsUpdateComplianceResp };
  paymentsDeleteRows: { req: PaymentsDeleteRowsReq; resp: PaymentsDeleteRowsResp };
  paymentsUpdateGrantBudget: { req: PaymentsUpdateGrantBudgetReq; resp: PaymentsUpdateGrantBudgetResp };
  paymentsRecalcGrantProjected: { req: PaymentsRecalcGrantProjectedReq; resp: PaymentsRecalcGrantProjectedResp };
  paymentsRecalculateFuture: { req: PaymentsRecalculateFutureReq; resp: PaymentsRecalculateFutureResp };
  paymentsAdjustProjections: { req: PaymentsAdjustProjectionsReq; resp: PaymentsAdjustProjectionsResp };
  paymentsAdjustSpend: { req: PaymentsAdjustSpendReq; resp: PaymentsAdjustSpendResp };

  // TASKS
  tasksGenerateScheduleWrite: { req: TasksGenerateScheduleWriteReq; resp: TasksGenerateScheduleWriteResp };
  tasksAssign: { req: TasksAssignReq; resp: TasksAssignResp };
  tasksUpdateFields: { req: TasksUpdateFieldsReq; resp: TasksUpdateFieldsResp };
  tasksUpdateStatus: { req: TasksUpdateStatusReq; resp: TasksUpdateStatusResp };
  tasksDelete: { req: TasksDeleteReq; resp: TasksDeleteResp };
  tasksAdminRegenerateForGrant: { req: TasksAdminRegenerateForGrantReq; resp: TasksAdminRegenerateForGrantResp };
  tasksBulkStatus: { req: TasksBulkStatusReq; resp: TasksBulkStatusResp };
  tasksList: { req: TasksListReq; resp: TasksListResp };
  tasksReschedule: { req: TasksRescheduleReq; resp: TasksRescheduleResp };
  tasksUpsertManual: { req: TasksUpsertManualReq; resp: TasksUpsertManualResp };

  // Other tasks collection routes
  tasksOtherCreate: { req: TasksOtherCreateReq; resp: TasksOtherCreateResp };
  tasksOtherUpdate: { req: TasksOtherUpdateReq; resp: TasksOtherUpdateResp };
  tasksOtherAssign: { req: TasksOtherAssignReq; resp: TasksOtherAssignResp };
  tasksOtherStatus: { req: TasksOtherStatusReq; resp: TasksOtherStatusResp };
  tasksOtherListMy: { req: TasksOtherListMyReq; resp: TasksOtherListMyResp };

  // INBOX
  inboxListMy: { req: InboxListMyQuery; resp: InboxListMyResp };
  inboxWorkloadList: { req: InboxWorkloadListQuery; resp: InboxWorkloadListResp };
  inboxMetricsMy: { req: InboxMetricsMyQuery; resp: InboxMetricsMyResp };
  inboxSendInvite: { req: InboxSendInviteReq; resp: InboxEmailResp };
  inboxSendMonthlySummary: { req: InboxSendMonthlySummaryReq; resp: InboxEmailResp };
  inboxDigestPreview: { req: InboxDigestPreviewQuery; resp: InboxDigestPreviewResp };
  inboxSendDigestNow: { req: InboxSendDigestNowReq; resp: InboxSendDigestNowResp };
  inboxScheduleDigest: { req: InboxScheduleDigestReq; resp: InboxScheduleDigestResp };
  inboxDigestSubsGet: { req: Record<string, never>; resp: InboxDigestSubsGetResp };
  inboxDigestSubUpdate: { req: InboxDigestSubUpdateReq; resp: InboxDigestSubUpdateResp };
  inboxDigestHtmlPreview: { req: InboxDigestHtmlPreviewReq; resp: InboxDigestHtmlPreviewResp };

  // DRIVE
  gdriveList: { req: TGDriveListQuery; resp: GDriveListResp };
  gdriveCreateFolder: { req: TGDriveCreateFolderBody; resp: GDriveCreateFolderResp };
  gdriveUpload: { req: TGDriveUploadBody; resp: GDriveUploadResp };
  gdriveCustomerFolderIndex: { req: TGDriveCustomerFolderIndexQuery; resp: GDriveCustomerFolderIndexResp };
  gdriveBuildCustomerFolder: { req: TGDriveBuildCustomerFolderBody; resp: GDriveBuildCustomerFolderResp };
  gdriveConfigGet: { req: void; resp: GDriveConfigGetResp };
  gdriveConfigPatch: { req: TGDriveConfigPatchBody; resp: GDriveConfigPatchResp };
  gdriveCustomerFolderSync: { req: TGDriveCustomerFolderSyncBody; resp: GDriveCustomerFolderSyncResp };

  // LEDGER
  ledgerList: { req: LedgerListReq; resp: LedgerListResp };
  ledgerCreate: { req: LedgerCreateReq; resp: LedgerCreateResp };
  ledgerClassify: { req: LedgerClassifyReq; resp: LedgerClassifyResp };
  ledgerAutoAssign: { req: LedgerAutoAssignReq; resp: LedgerAutoAssignResp };
  ledgerGetById: { req: LedgerGetByIdReq; resp: LedgerGetByIdResp };
  ledgerBalance: { req: LedgerBalanceReq; resp: LedgerBalanceResp };
  ledgerDelete: { req: LedgerDeleteReq; resp: LedgerDeleteResp };

  // USERS
  usersCreate: { req: UsersCreateReq; resp: UsersCreateResp };
  usersInvite: { req: UsersInviteReq; resp: UsersInviteResp };
  usersSetRole: { req: UsersSetRoleReq; resp: UsersSetRoleResp };
  usersSetActive: { req: UsersSetActiveReq; resp: UsersSetActiveResp };
  usersUpdateProfile: { req: UsersUpdateProfileReq; resp: UsersUpdateProfileResp };
  usersResendInvite: { req: UsersResendInviteReq; resp: UsersResendInviteResp };
  usersRevokeSessions: { req: UsersRevokeSessionsReq; resp: UsersRevokeSessionsResp };
  usersList: { req: UsersListQuery; resp: UsersListResp };
  devOrgsList: { req: DevOrgsListReq; resp: DevOrgsListResp };
  devOrgsUpsert: { req: DevOrgsUpsertReq; resp: DevOrgsUpsertResp };
  devOrgsPatchTeams: { req: DevOrgsPatchTeamsReq; resp: DevOrgsPatchTeamsResp };
  usersMe: { req: void; resp: UsersMeResp };
  usersMeUpdate: { req: UsersMeUpdateReq; resp: UsersMeUpdateResp };
  devGrantAdmin: {
    req: { uid?: string; email?: string; orgId?: string; teamIds?: string[]; topRole?: string; roles?: string[] } & Record<string, unknown>;
    resp: Ok<Record<string, unknown>>;
  };

  // TOURS
  toursUpsert: { req: ToursUpsertReq; resp: ToursUpsertResp };
  toursPatch: { req: ToursPatchReq; resp: ToursPatchResp };
  toursDelete: { req: ToursDeleteReq; resp: ToursDeleteResp };
  toursAdminDelete: { req: ToursAdminDeleteReq; resp: ToursAdminDeleteResp };
  toursList: { req: ToursListReq; resp: ToursListResp };
  toursGet: { req: ToursGetReq; resp: ToursGetResp };
  toursStructure: { req: ToursStructureReq; resp: ToursStructureResp };

  // MISC
  createSession: { req: Record<string, unknown>; resp: CreateSessionResp };
  health: { req: void; resp: HealthResp };
}

export type EndpointName = keyof EndpointMap;
export type ReqOf<N extends EndpointName> = EndpointMap[N]["req"];
export type RespOf<N extends EndpointName> = EndpointMap[N]["resp"];
