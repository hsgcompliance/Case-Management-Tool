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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BoolFromLike: () => BoolFromLike,
  BoolLike: () => BoolLike,
  Boolish: () => Boolish,
  BudgetPipeline: () => BudgetPipeline,
  BudgetPipelineDeleteBody: () => BudgetPipelineDeleteBody,
  BudgetPipelineListQuery: () => BudgetPipelineListQuery,
  BudgetPipelinePreviewBody: () => BudgetPipelinePreviewBody,
  BudgetPipelineUpsertBody: () => BudgetPipelineUpsertBody,
  CmActivitiesListQuery: () => CmActivitiesListQuery,
  CmActivitiesListResp: () => CmActivitiesListResp,
  CmActivity: () => CmActivity,
  CmActivityCreateBody: () => CmActivityCreateBody,
  CmActivityType: () => CmActivityType,
  CmActivityUpdateBody: () => CmActivityUpdateBody,
  CreateUserBody: () => CreateUserBody,
  FORM_CONTEXT_KEYS: () => FORM_CONTEXT_KEYS,
  FormPrefillSnapshot: () => FormPrefillSnapshot,
  FormRenderMode: () => FormRenderMode,
  FormSessionCompleteBody: () => FormSessionCompleteBody,
  FormSessionCreateBody: () => FormSessionCreateBody,
  FormSessionEntity: () => FormSessionEntity,
  FormSessionResolveBody: () => FormSessionResolveBody,
  FormSessionSource: () => FormSessionSource,
  FormSessionStatus: () => FormSessionStatus,
  FormSubmissionSnapshot: () => FormSubmissionSnapshot,
  FormWorkflowConfig: () => FormWorkflowConfig,
  FormWorkflowId: () => FormWorkflowId,
  GDRIVE_TEMPLATE_TYPES: () => GDRIVE_TEMPLATE_TYPES,
  GRANT_PIN_COLORS: () => GRANT_PIN_COLORS,
  GenerateCaseNoteSuggestionBodySchema: () => GenerateCaseNoteSuggestionBodySchema,
  GenerateCaseNoteSuggestionResponseSchema: () => GenerateCaseNoteSuggestionResponseSchema,
  GoogleAuthMode: () => GoogleAuthMode,
  GoogleConnectStartBody: () => GoogleConnectStartBody,
  GoogleIntegrationMode: () => GoogleIntegrationMode,
  GoogleIntegrationStatus: () => GoogleIntegrationStatus,
  GooglePermissionStatus: () => GooglePermissionStatus,
  GoogleService: () => GoogleService,
  GrantBudgetManagerLineItem: () => GrantBudgetManagerLineItem,
  GrantBudgetManagerLoadBody: () => GrantBudgetManagerLoadBody,
  GrantBudgetManagerOriginal: () => GrantBudgetManagerOriginal,
  GrantBudgetManagerReconcileBody: () => GrantBudgetManagerReconcileBody,
  GrantBudgetManagerRollup: () => GrantBudgetManagerRollup,
  GrantBudgetManagerRow: () => GrantBudgetManagerRow,
  GrantBudgetManagerSaveBody: () => GrantBudgetManagerSaveBody,
  GrantBudgetManagerSaveMode: () => GrantBudgetManagerSaveMode,
  GrantBudgetManagerSourceType: () => GrantBudgetManagerSourceType,
  GrantComplianceConfig: () => GrantComplianceConfig,
  GrantComplianceControl: () => GrantComplianceControl,
  GrantCompliancePreset: () => GrantCompliancePreset,
  GrantDriveTemplate: () => GrantDriveTemplate,
  GrantDriveTemplateType: () => GrantDriveTemplateType,
  GrantFinancialConfig: () => GrantFinancialConfig,
  GrantFinancialConfigPatch: () => GrantFinancialConfigPatch,
  GrantFinancialModel: () => GrantFinancialModel,
  GrantIdsLike: () => GrantIdsLike,
  GrantLedgerMode: () => GrantLedgerMode,
  HouseholdEntity: () => HouseholdEntity,
  HouseholdInputSchema: () => HouseholdInputSchema,
  HouseholdMember: () => HouseholdMember,
  HouseholdRelationship: () => HouseholdRelationship,
  HouseholdStatus: () => HouseholdStatus,
  HouseholdsAddMemberBody: () => HouseholdsAddMemberBody,
  HouseholdsDeleteBody: () => HouseholdsDeleteBody,
  HouseholdsGetQuery: () => HouseholdsGetQuery,
  HouseholdsListQuery: () => HouseholdsListQuery,
  HouseholdsPatchBody: () => HouseholdsPatchBody,
  HouseholdsPatchRow: () => HouseholdsPatchRow,
  HouseholdsRemoveMemberBody: () => HouseholdsRemoveMemberBody,
  HouseholdsSetHeadBody: () => HouseholdsSetHeadBody,
  HouseholdsUpsertBody: () => HouseholdsUpsertBody,
  ISO10: () => ISO10,
  Id: () => Id,
  IdLike: () => IdLike,
  Ids: () => Ids,
  InboxItemSchema: () => InboxItemSchema,
  InviteUserBody: () => InviteUserBody,
  JsonObj: () => JsonObj,
  JsonObjLike: () => JsonObjLike,
  ListUsersBody: () => ListUsersBody,
  MetricChipId: () => MetricChipId,
  MetricWorkspaceChipInstance: () => MetricWorkspaceChipInstance,
  MetricWorkspaceLayout: () => MetricWorkspaceLayout,
  MetricWorkspacePrefs: () => MetricWorkspacePrefs,
  OrgManagerListOrgsBody: () => OrgManagerListOrgsBody,
  OrgManagerOrg: () => OrgManagerOrg,
  OrgManagerPatchTeamsBody: () => OrgManagerPatchTeamsBody,
  OrgManagerTeam: () => OrgManagerTeam,
  OrgManagerUpsertOrgBody: () => OrgManagerUpsertOrgBody,
  PipelineCondition: () => PipelineCondition,
  PipelineConditionGroup: () => PipelineConditionGroup,
  PipelineFormSchema: () => PipelineFormSchema,
  PipelineOperator: () => PipelineOperator,
  PipelineRuleNode: () => PipelineRuleNode,
  PipelineStatus: () => PipelineStatus,
  RecordCaseNoteSuggestionDecisionBodySchema: () => RecordCaseNoteSuggestionDecisionBodySchema,
  ResendInviteBody: () => ResendInviteBody,
  RevokeSessionsBody: () => RevokeSessionsBody,
  RoleInput: () => RoleInput,
  RoleTagCanonical: () => RoleTagCanonical,
  RolesArray: () => RolesArray,
  SetActiveBody: () => SetActiveBody,
  SetRoleBody: () => SetRoleBody,
  TRANSACTION_WINDOW_FORM_IDS: () => TRANSACTION_WINDOW_FORM_IDS,
  TasksAdminRegenerateForGrantBody: () => TasksAdminRegenerateForGrantBody,
  TasksAssignBody: () => TasksAssignBody,
  TasksBulkStatusBody: () => TasksBulkStatusBody,
  TasksDeleteBody: () => TasksDeleteBody,
  TasksGenerateScheduleWriteBody: () => TasksGenerateScheduleWriteBody,
  TasksListQuery: () => TasksListQuery,
  TasksOtherAssignBody: () => TasksOtherAssignBody,
  TasksOtherCreateBody: () => TasksOtherCreateBody,
  TasksOtherListMyQuery: () => TasksOtherListMyQuery,
  TasksOtherStatusBody: () => TasksOtherStatusBody,
  TasksOtherUpdateBody: () => TasksOtherUpdateBody,
  TasksRescheduleBody: () => TasksRescheduleBody,
  TasksUpdateFieldsBody: () => TasksUpdateFieldsBody,
  TasksUpdateStatusBody: () => TasksUpdateStatusBody,
  TasksUpsertManualBody: () => TasksUpsertManualBody,
  TimestampLike: () => TimestampLike,
  TopRoleCanonical: () => TopRoleCanonical,
  TopRoleLadder: () => TopRoleLadder,
  TourFlow: () => TourFlow,
  TourProgressEntry: () => TourProgressEntry,
  TourProgressStatus: () => TourProgressStatus,
  TourStep: () => TourStep,
  ToursDeleteBody: () => ToursDeleteBody,
  ToursGetQuery: () => ToursGetQuery,
  ToursListQuery: () => ToursListQuery,
  ToursPatchBody: () => ToursPatchBody,
  ToursPatchItem: () => ToursPatchItem,
  ToursUpsertBody: () => ToursUpsertBody,
  TransactionWindowSchemaError: () => TransactionWindowSchemaError,
  TsLike: () => TsLike,
  UpdateMeBody: () => UpdateMeBody,
  UpdateUserProfileBody: () => UpdateUserProfileBody,
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
  UserToursState: () => UserToursState,
  WORKFLOW_CONFIGS: () => WORKFLOW_CONFIGS,
  assessments: () => assessments_exports,
  budgetPipeline: () => budgetPipeline_exports,
  caseNoteAssistant: () => caseNoteAssistant_exports,
  cleanVisibleLabel: () => cleanVisibleLabel,
  cmActivities: () => cmActivities_exports,
  computeGrantLineItemOverCap: () => computeGrantLineItemOverCap,
  creditCards: () => creditCards_exports,
  customers: () => customers_exports,
  deriveHeadCustomerId: () => deriveHeadCustomerId,
  enrollments: () => enrollments_exports,
  formSessions: () => formSessions_exports,
  gdrive: () => gdrive_exports,
  getGrantFinancialCapabilities: () => getGrantFinancialCapabilities,
  getGrantLineItemAmountSemantics: () => getGrantLineItemAmountSemantics,
  getWorkflowConfig: () => getWorkflowConfig,
  google: () => google_exports,
  grantBudgetManager: () => grantBudgetManager_exports,
  grants: () => grants_exports,
  householdRelationshipLabel: () => householdRelationshipLabel,
  households: () => households_exports,
  inbox: () => inbox_exports,
  inferTransactionWindowModel: () => inferTransactionWindowModel,
  jotform: () => jotform_exports,
  ledger: () => ledger_exports,
  metrics: () => metrics_exports,
  normalizeGrantComplianceConfig: () => normalizeGrantComplianceConfig,
  normalizeGrantDriveTemplates: () => normalizeGrantDriveTemplates,
  normalizeGrantFinancialConfig: () => normalizeGrantFinancialConfig,
  parseGrantMaxAssistanceMonths: () => parseGrantMaxAssistanceMonths,
  payments: () => payments_exports,
  shouldRetainGrantBudget: () => shouldRetainGrantBudget,
  tasks: () => tasks_exports,
  toArray: () => toArray,
  tours: () => tours_exports,
  transactionFieldKey: () => transactionFieldKey,
  transactionWindows: () => transactionWindows_exports,
  tss: () => tss_exports,
  users: () => users_exports,
  z: () => import_zod2.z
});
module.exports = __toCommonJS(index_exports);

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
var Boolish = BoolLike;
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
function toArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

// src/budgetPipeline.ts
var budgetPipeline_exports = {};
__export(budgetPipeline_exports, {
  BudgetPipeline: () => BudgetPipeline,
  BudgetPipelineDeleteBody: () => BudgetPipelineDeleteBody,
  BudgetPipelineListQuery: () => BudgetPipelineListQuery,
  BudgetPipelinePreviewBody: () => BudgetPipelinePreviewBody,
  BudgetPipelineUpsertBody: () => BudgetPipelineUpsertBody,
  PipelineCondition: () => PipelineCondition,
  PipelineConditionGroup: () => PipelineConditionGroup,
  PipelineFormSchema: () => PipelineFormSchema,
  PipelineOperator: () => PipelineOperator,
  PipelineRuleNode: () => PipelineRuleNode,
  PipelineStatus: () => PipelineStatus
});
var import_zod3 = require("zod");
var PipelineOperator = import_zod3.z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "in",
  "not_in",
  "gte",
  "lte",
  "gt",
  "lt",
  "is_true",
  "is_false",
  "before",
  "after",
  "is_empty",
  "is_not_empty"
]);
var PipelineStatus = import_zod3.z.enum(["draft", "active", "inactive"]);
var PipelineCondition = import_zod3.z.object({
  id: import_zod3.z.string(),
  field: import_zod3.z.string(),
  // paymentQueue field key, or "raw:{fieldId}" for rawAnswers
  operator: PipelineOperator,
  value: import_zod3.z.union([import_zod3.z.string(), import_zod3.z.number(), import_zod3.z.boolean(), import_zod3.z.array(import_zod3.z.string())]).default("")
});
var PipelineConditionGroup = import_zod3.z.object({
  id: import_zod3.z.string(),
  label: import_zod3.z.string().optional(),
  logic: import_zod3.z.enum(["AND", "OR"]),
  kind: import_zod3.z.enum(["include", "exclude"]),
  conditions: import_zod3.z.array(PipelineCondition)
});
var PipelineRuleNode = import_zod3.z.lazy(
  () => import_zod3.z.discriminatedUnion("type", [
    import_zod3.z.object({
      id: import_zod3.z.string(),
      type: import_zod3.z.literal("condition"),
      condition: PipelineCondition
    }),
    import_zod3.z.object({
      id: import_zod3.z.string(),
      type: import_zod3.z.literal("group"),
      logic: import_zod3.z.enum(["AND", "OR"]),
      children: import_zod3.z.array(PipelineRuleNode)
    })
  ])
);
var PipelineFormSchema = import_zod3.z.object({
  enabled: import_zod3.z.boolean().optional().default(true),
  sourceFormId: import_zod3.z.string(),
  sourceFormTitle: import_zod3.z.string(),
  includeGroups: import_zod3.z.array(PipelineConditionGroup).optional().default([]),
  excludeGroups: import_zod3.z.array(PipelineConditionGroup).optional().default([]),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional()
});
var BudgetPipeline = import_zod3.z.object({
  id: import_zod3.z.string(),
  orgId: import_zod3.z.string(),
  name: import_zod3.z.string(),
  status: PipelineStatus,
  grantId: import_zod3.z.string().nullable(),
  lineItemId: import_zod3.z.string().nullable(),
  sourceFormId: import_zod3.z.string().nullable(),
  sourceFormTitle: import_zod3.z.string().nullable(),
  formSchemas: import_zod3.z.record(import_zod3.z.string(), PipelineFormSchema).optional(),
  includeGroups: import_zod3.z.array(PipelineConditionGroup),
  excludeGroups: import_zod3.z.array(PipelineConditionGroup),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional(),
  createdAt: import_zod3.z.string(),
  updatedAt: import_zod3.z.string(),
  createdBy: import_zod3.z.string(),
  updatedBy: import_zod3.z.string()
});
var BudgetPipelineUpsertBody = import_zod3.z.object({
  id: import_zod3.z.string().optional(),
  name: import_zod3.z.string().min(1),
  status: PipelineStatus.optional(),
  grantId: import_zod3.z.string().nullable().optional(),
  lineItemId: import_zod3.z.string().nullable().optional(),
  sourceFormId: import_zod3.z.string().nullable().optional(),
  sourceFormTitle: import_zod3.z.string().nullable().optional(),
  formSchemas: import_zod3.z.record(import_zod3.z.string(), PipelineFormSchema).optional(),
  includeGroups: import_zod3.z.array(PipelineConditionGroup).optional().default([]),
  excludeGroups: import_zod3.z.array(PipelineConditionGroup).optional().default([]),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional()
});
var BudgetPipelineListQuery = import_zod3.z.object({
  grantId: import_zod3.z.string().optional(),
  status: PipelineStatus.optional(),
  limit: import_zod3.z.coerce.number().int().min(1).max(200).default(50)
});
var BudgetPipelineDeleteBody = import_zod3.z.object({
  id: import_zod3.z.string().min(1)
});
var BudgetPipelinePreviewBody = import_zod3.z.object({
  grantId: import_zod3.z.string().nullable().optional(),
  lineItemId: import_zod3.z.string().nullable().optional(),
  sourceFormId: import_zod3.z.string().nullable().optional(),
  includeGroups: import_zod3.z.array(PipelineConditionGroup),
  excludeGroups: import_zod3.z.array(PipelineConditionGroup),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional(),
  pipelineId: import_zod3.z.string().optional(),
  month: import_zod3.z.string().optional(),
  limit: import_zod3.z.coerce.number().int().min(1).max(5e3).default(100)
});

// src/assessments.ts
var assessments_exports = {};
__export(assessments_exports, {
  AssessmentAnswer: () => AssessmentAnswer,
  AssessmentComputed: () => AssessmentComputed,
  AssessmentOpenedReason: () => AssessmentOpenedReason,
  AssessmentOutputEntry: () => AssessmentOutputEntry,
  AssessmentRunStatus: () => AssessmentRunStatus,
  AssessmentSchema: () => AssessmentSchema,
  AssessmentScope: () => AssessmentScope,
  AssessmentSubmission: () => AssessmentSubmission,
  AssessmentTemplate: () => AssessmentTemplate,
  AssessmentTemplateUpsertBody: () => AssessmentTemplateUpsertBody,
  AssessmentTemplateVersion: () => AssessmentTemplateVersion,
  CanonicalAssessmentKind: () => CanonicalAssessmentKind,
  DeleteTemplateBody: () => DeleteTemplateBody,
  GetSubmissionBody: () => GetSubmissionBody,
  GetTemplateBody: () => GetTemplateBody,
  ListSubmissionsBody: () => ListSubmissionsBody,
  ListTemplatesBody: () => ListTemplatesBody,
  ListVersionsBody: () => ListVersionsBody,
  OpenReassessmentBody: () => OpenReassessmentBody,
  PushAnswerBody: () => PushAnswerBody,
  RecalcTemplateBody: () => RecalcTemplateBody,
  RubricDef: () => RubricDef,
  RubricLevel: () => RubricLevel,
  RubricOption: () => RubricOption,
  RubricQuestion: () => RubricQuestion,
  SubmitAssessmentBody: () => SubmitAssessmentBody,
  TemplateEditPolicy: () => TemplateEditPolicy
});
var AssessmentRunStatus = import_zod2.z.enum([
  "draft",
  "active",
  "submitted",
  "scored",
  "closed",
  "superseded",
  "voided"
]);
var AssessmentOpenedReason = import_zod2.z.enum([
  "manual",
  "intake",
  "reassessment",
  "scheduled"
]);
var AssessmentOutputEntry = import_zod2.z.object({
  // display
  assessmentName: import_zod2.z.string(),
  metric: import_zod2.z.string(),
  score: import_zod2.z.number().nullable().optional(),
  level: import_zod2.z.string().nullable().optional(),
  // provenance — all linkage fields always present for sort/filter
  contextId: import_zod2.z.string(),
  submissionId: import_zod2.z.string(),
  templateId: import_zod2.z.string(),
  templateVersion: import_zod2.z.number(),
  templateVersionId: import_zod2.z.string().nullable().optional(),
  orgId: import_zod2.z.string(),
  customerId: import_zod2.z.string().nullable().optional(),
  enrollmentId: import_zod2.z.string().nullable().optional(),
  grantId: import_zod2.z.string().nullable().optional(),
  scoredAt: import_zod2.z.string(),
  scoredBy: import_zod2.z.string()
}).passthrough();
var AssessmentTemplateVersion = import_zod2.z.object({
  id: import_zod2.z.string().optional(),
  templateId: import_zod2.z.string(),
  orgId: import_zod2.z.string(),
  versionNumber: import_zod2.z.number().int().min(1),
  status: import_zod2.z.enum(["draft", "published", "deprecated"]).default("published"),
  schema: import_zod2.z.unknown(),
  // AssessmentSchema — typed as unknown here to avoid circular dep
  title: import_zod2.z.string(),
  kind: import_zod2.z.string(),
  publishedAt: import_zod2.z.string().nullable().optional(),
  publishedByUid: import_zod2.z.string().nullable().optional(),
  createdAt: import_zod2.z.unknown().optional()
}).passthrough();
var AssessmentScope = import_zod2.z.enum(["customer", "enrollment"]);
var CanonicalAssessmentKind = import_zod2.z.enum([
  "acuity",
  "waitlistPriority",
  "progress",
  "custom"
]);
var TemplateEditPolicy = import_zod2.z.enum([
  "adminOnly",
  "ownerOrAdmin",
  "team",
  "org"
]);
var RubricOption = import_zod2.z.object({
  value: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]),
  label: import_zod2.z.string().trim().min(1),
  points: import_zod2.z.number().default(0)
});
var RubricQuestion = import_zod2.z.object({
  id: import_zod2.z.string().trim().min(1),
  label: import_zod2.z.string().trim().min(1),
  options: import_zod2.z.array(RubricOption).min(1)
});
var RubricLevel = import_zod2.z.object({
  min: import_zod2.z.number().default(0),
  max: import_zod2.z.number().optional(),
  // undefined → +∞
  label: import_zod2.z.string().trim().min(1)
});
var RubricDef = import_zod2.z.object({
  title: import_zod2.z.string().trim().min(1),
  version: import_zod2.z.string().trim().default("v1"),
  questions: import_zod2.z.array(RubricQuestion).min(1),
  levels: import_zod2.z.array(RubricLevel).min(1)
});
var AssessmentSchema = import_zod2.z.discriminatedUnion("type", [
  import_zod2.z.object({
    type: import_zod2.z.literal("rubric"),
    rubric: RubricDef
  })
]);
var AssessmentTemplate = import_zod2.z.object({
  id: import_zod2.z.string().optional(),
  // org/team access (server authoritative)
  orgId: import_zod2.z.string().trim().min(1).nullish(),
  teamIds: import_zod2.z.array(import_zod2.z.string().trim().min(1)).max(10).optional(),
  // optional scope to a grant/program (still stored separately)
  grantId: import_zod2.z.string().trim().min(1).nullish(),
  // flexible kind (keep it string so you can grow without migrating contracts)
  kind: import_zod2.z.string().trim().min(1).default("custom"),
  // where submissions are tied
  scope: AssessmentScope.default("enrollment"),
  // UX / identity
  title: import_zod2.z.string().trim().min(1),
  description: import_zod2.z.string().nullable().optional(),
  // human-readable name for the primary output metric (e.g. "Acuity Score")
  outputLabel: import_zod2.z.string().trim().nullish(),
  // template lifecycle
  version: import_zod2.z.number().int().min(1).default(1),
  locked: import_zod2.z.boolean().optional().default(false),
  // "active" | "deprecated" — separate from version status
  templateStatus: import_zod2.z.enum(["active", "deprecated"]).optional().default("active"),
  // pointer to latest published version subcollection doc
  currentVersionId: import_zod2.z.string().trim().nullish(),
  // edit controls
  editPolicy: TemplateEditPolicy.default("team"),
  ownerUid: import_zod2.z.string().trim().nullish(),
  // builder output
  schema: AssessmentSchema,
  // timestamps (accepted but ignored on write)
  createdAt: import_zod2.z.unknown().optional(),
  updatedAt: import_zod2.z.unknown().optional()
}).passthrough();
var AssessmentTemplateUpsertBody = import_zod2.z.union([
  AssessmentTemplate,
  import_zod2.z.array(AssessmentTemplate)
]);
var GetTemplateBody = import_zod2.z.object({
  templateId: import_zod2.z.string().trim().min(1)
});
var ListTemplatesBody = import_zod2.z.object({
  grantId: import_zod2.z.string().trim().min(1).nullish(),
  kind: import_zod2.z.string().trim().min(1).nullish(),
  scope: AssessmentScope.nullish(),
  includeLocked: import_zod2.z.boolean().optional().default(true)
}).passthrough();
var DeleteTemplateBody = import_zod2.z.object({
  templateId: import_zod2.z.string().trim().min(1),
  force: import_zod2.z.boolean().optional().default(false)
});
var AssessmentAnswer = import_zod2.z.object({
  qId: import_zod2.z.string().trim().min(1),
  answer: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()])
});
var AssessmentComputed = import_zod2.z.object({
  score: import_zod2.z.number().nullable().optional(),
  level: import_zod2.z.string().nullable().optional(),
  // for future computed outputs (priority buckets, derived flags, etc.)
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).optional()
}).passthrough();
var AssessmentSubmission = import_zod2.z.object({
  id: import_zod2.z.string().optional(),
  // org/team access (server authoritative)
  orgId: import_zod2.z.string().trim().min(1).nullish(),
  teamIds: import_zod2.z.array(import_zod2.z.string().trim().min(1)).max(10).optional(),
  // linkage
  templateId: import_zod2.z.string().trim().min(1),
  templateVersion: import_zod2.z.number().int().min(1).nullish(),
  // pointer to the /versions subcollection doc used when this was scored
  templateVersionId: import_zod2.z.string().trim().nullish(),
  kind: import_zod2.z.string().trim().min(1).default("custom"),
  scope: AssessmentScope.default("enrollment"),
  // subject — all present on every doc for sort/filter without joins
  customerId: import_zod2.z.string().trim().min(1).nullish(),
  enrollmentId: import_zod2.z.string().trim().min(1).nullish(),
  grantId: import_zod2.z.string().trim().min(1).nullish(),
  // contextId — stable stack key for this entity+kind combo, persists across reassessments
  // customer-scoped: "{customerId}_{kind}"
  // enrollment-scoped: "{enrollmentId}_{kind}"
  contextId: import_zod2.z.string().trim().nullish(),
  // payload
  answers: import_zod2.z.array(AssessmentAnswer).default([]),
  computed: AssessmentComputed.nullish(),
  // provenance
  computedBy: import_zod2.z.enum(["server", "client"]).optional().default("server"),
  byUid: import_zod2.z.string().trim().nullish(),
  updatedBy: import_zod2.z.string().trim().nullish(),
  lastPushSurface: import_zod2.z.string().trim().nullish(),
  lastPushAt: import_zod2.z.string().nullish(),
  // run lifecycle (new — all optional for backward compat)
  status: AssessmentRunStatus.optional().default("scored"),
  openedReason: AssessmentOpenedReason.optional().default("manual"),
  periodKey: import_zod2.z.string().trim().nullish(),
  // "2026-03" | "2026-W11" | null
  supersedes: import_zod2.z.string().trim().nullish(),
  // prior submissionId this replaces
  supersededByRunId: import_zod2.z.string().trim().nullish(),
  supersededAt: import_zod2.z.string().nullish(),
  // timestamps
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional()
}).passthrough();
var SubmitAssessmentBody = import_zod2.z.union([
  import_zod2.z.object({
    templateId: import_zod2.z.string().trim().min(1),
    customerId: import_zod2.z.string().trim().min(1).nullish(),
    enrollmentId: import_zod2.z.string().trim().min(1).nullish(),
    answers: import_zod2.z.array(AssessmentAnswer).default([]),
    // optional: FE can send a preview, but server should recompute anyway
    computedClient: AssessmentComputed.nullish()
  }).passthrough(),
  import_zod2.z.array(import_zod2.z.object({
    templateId: import_zod2.z.string().trim().min(1),
    customerId: import_zod2.z.string().trim().min(1).nullish(),
    enrollmentId: import_zod2.z.string().trim().min(1).nullish(),
    answers: import_zod2.z.array(AssessmentAnswer).default([]),
    // optional: FE can send a preview, but server should recompute anyway
    computedClient: AssessmentComputed.nullish()
  }).passthrough()).min(1).max(50)
  // Reasonable batch limit
]);
var GetSubmissionBody = import_zod2.z.object({
  submissionId: import_zod2.z.string().trim().min(1)
});
var ListSubmissionsBody = import_zod2.z.object({
  customerId: import_zod2.z.string().trim().min(1).nullish(),
  enrollmentId: import_zod2.z.string().trim().min(1).nullish(),
  templateId: import_zod2.z.string().trim().min(1).nullish(),
  // contextId — fetch the full history stack for one entity+kind combo
  contextId: import_zod2.z.string().trim().min(1).nullish(),
  status: AssessmentRunStatus.nullish(),
  limit: import_zod2.z.number().int().min(1).max(500).optional().default(50)
}).passthrough();
var RecalcTemplateBody = import_zod2.z.object({
  templateId: import_zod2.z.string().trim().min(1),
  activeOnly: import_zod2.z.boolean().optional().default(true)
});
var PushAnswerBody = import_zod2.z.object({
  submissionId: import_zod2.z.string().trim().min(1),
  answers: import_zod2.z.array(AssessmentAnswer).min(1).max(100),
  // where in the UI this push came from — stored for audit trail
  sourceSurface: import_zod2.z.string().trim().optional().default("inlineUI"),
  // optional period bucket, e.g. "2026-03" for monthly rolling assessments
  periodKey: import_zod2.z.string().trim().nullish()
});
var OpenReassessmentBody = import_zod2.z.object({
  // direct reference
  priorSubmissionId: import_zod2.z.string().trim().min(1).nullish(),
  // lookup by entity + kind
  customerId: import_zod2.z.string().trim().min(1).nullish(),
  enrollmentId: import_zod2.z.string().trim().min(1).nullish(),
  kind: import_zod2.z.string().trim().min(1).nullish(),
  // options
  prefillAnswers: import_zod2.z.boolean().optional().default(true),
  openedReason: import_zod2.z.enum(["manual", "reassessment", "scheduled"]).optional().default("reassessment")
});
var ListVersionsBody = import_zod2.z.object({
  templateId: import_zod2.z.string().trim().min(1),
  status: import_zod2.z.enum(["draft", "published", "deprecated"]).nullish()
});

// src/customers.ts
var customers_exports = {};
__export(customers_exports, {
  AssistanceLength: () => AssistanceLength,
  CustomerAcuity: () => CustomerAcuity,
  CustomerEntity: () => CustomerEntity,
  CustomerInputSchema: () => CustomerInputSchema,
  CustomerMeta: () => CustomerMeta,
  CustomerOtherContact: () => CustomerOtherContact,
  CustomerPatchBody: () => CustomerPatchBody,
  CustomerStatus: () => CustomerStatus,
  CustomerUpsertBody: () => CustomerUpsertBody,
  CustomersAdminDeleteBody: () => CustomersAdminDeleteBody,
  CustomersBackfillAssistanceLengthBody: () => CustomersBackfillAssistanceLengthBody,
  CustomersBackfillCaseManagerNamesBody: () => CustomersBackfillCaseManagerNamesBody,
  CustomersBackfillNamesBody: () => CustomersBackfillNamesBody,
  CustomersDeleteBody: () => CustomersDeleteBody,
  CustomersGetQuery: () => CustomersGetQuery,
  CustomersListQuery: () => CustomersListQuery,
  CustomersPatchBody: () => CustomersPatchBody,
  CustomersPatchRow: () => CustomersPatchRow,
  CustomersUpsertBody: () => CustomersUpsertBody,
  Population: () => Population,
  toArray: () => toArray
});
var Population = import_zod2.z.enum(["Youth", "Individual", "Family"]).nullable();
var CustomerStatus = import_zod2.z.enum(["active", "inactive", "deleted"]).nullable();
var CustomerAcuity = import_zod2.z.object({
  templateId: Id.nullish(),
  templateVersion: import_zod2.z.number().int().nullish(),
  submissionId: Id.nullish(),
  score: import_zod2.z.number().nullish(),
  level: import_zod2.z.string().trim().nullish(),
  computedAt: TsLike.nullish(),
  // tolerated during migration / transitional UI
  answers: import_zod2.z.array(import_zod2.z.unknown()).optional()
}).passthrough().nullish();
var CustomerMeta = import_zod2.z.object({
  // Legacy Drive folder link list. Compatibility read order is:
  // customerDrive.folderId -> meta.driveFolderId -> meta.driveFolders[0].id.
  // New structured Drive state should live under customerDrive, not meta.
  driveFolders: import_zod2.z.array(
    import_zod2.z.object({
      id: import_zod2.z.string(),
      // NOTE: gdrive ids aren't your Id shape; keep string
      alias: import_zod2.z.string().trim().nullish().optional(),
      name: import_zod2.z.string().trim().nullish().optional(),
      driveId: import_zod2.z.string().trim().nullish().optional(),
      kind: import_zod2.z.literal("gdrive").default("gdrive")
    })
  ).optional(),
  // Legacy primary folder pointer kept for backward compatibility. Prefer
  // customerDrive.folderId for new resolvers and mirror writes during migration.
  driveFolderId: import_zod2.z.string().nullish(),
  notes: import_zod2.z.string().nullish(),
  // Household / family linking (Customer-Collection-Update). Denormalized
  // pointer to the canonical households/{id} doc this customer belongs to; the
  // member list itself lives on the household doc. Scalar = one primary
  // household per customer. See contracts/src/households.ts.
  householdId: import_zod2.z.string().trim().nullish(),
  householdRelationship: import_zod2.z.string().trim().nullish()
}).passthrough().nullish();
var AssistanceLength = import_zod2.z.object({
  firstDateOfAssistance: ISO10.nullish(),
  lastExpectedDateOfAssistance: ISO10.nullish()
}).passthrough().nullable().optional();
var CustomerOtherContact = import_zod2.z.object({
  uid: Id,
  name: import_zod2.z.string().trim().nullish(),
  role: import_zod2.z.string().trim().nullish().optional()
}).passthrough();
var CustomerInputSchema = import_zod2.z.object({
  id: Id.optional(),
  // org/team (server authoritative)
  orgId: Id.nullish(),
  teamIds: import_zod2.z.array(Id).max(10).optional(),
  // Identity fields
  firstName: import_zod2.z.string().trim().min(1).nullish(),
  lastName: import_zod2.z.string().trim().min(1).nullish(),
  name: import_zod2.z.string().trim().min(1).nullish(),
  // lenient; backend does not enforce ISO10
  dob: import_zod2.z.string().nullish(),
  // case manager binding
  caseManagerId: Id.nullish(),
  caseManagerName: import_zod2.z.string().trim().nullish(),
  secondaryCaseManagerId: Id.nullish(),
  secondaryCaseManagerName: import_zod2.z.string().trim().nullish(),
  otherContacts: import_zod2.z.array(CustomerOtherContact).max(3).optional(),
  contactCaseManagerIds: import_zod2.z.array(Id).max(5).optional(),
  // state (backend coerces/derives coherence)
  status: CustomerStatus.optional(),
  active: import_zod2.z.boolean().optional(),
  enrolled: import_zod2.z.boolean().optional(),
  deleted: import_zod2.z.boolean().optional(),
  // Canonical population + acuity
  population: Population.nullish(),
  assistanceLength: AssistanceLength,
  acuityScore: import_zod2.z.number().nullish(),
  acuity: CustomerAcuity,
  // Simple single-select acuity tier (1–3). Kept top-level (not nested under
  // acuity) so Firestore single-field indexes make it directly queryable.
  tier: import_zod2.z.number().int().min(1).max(3).nullish(),
  // Drive folders + misc metadata. Drive fields here are compatibility
  // fallbacks; new structured Drive state belongs under customerDrive.
  meta: CustomerMeta,
  // Customer workbook integration — persisted separately from meta to keep it top-level queryable
  customerDrive: import_zod2.z.object({
    // Current primary customer folder pointer for Drive/workbook flows.
    folderId: import_zod2.z.string().nullish(),
    folderUrl: import_zod2.z.string().nullish(),
    linkedWorkbooks: import_zod2.z.object({
      tss: import_zod2.z.object({
        spreadsheetId: import_zod2.z.string().nullish(),
        spreadsheetUrl: import_zod2.z.string().nullish(),
        spreadsheetName: import_zod2.z.string().nullish(),
        standardKey: import_zod2.z.string().nullish(),
        linkedEnrollmentId: import_zod2.z.string().nullish(),
        status: import_zod2.z.enum(["linked", "needsReview", "notFound", "error"]).nullish(),
        linkedBy: import_zod2.z.string().nullish(),
        linkedAt: import_zod2.z.string().nullish(),
        updatedAt: import_zod2.z.string().nullish(),
        detectedSheets: import_zod2.z.array(import_zod2.z.string()).nullish(),
        defaultEmbedSheetName: import_zod2.z.string().nullish(),
        defaultSheetGid: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).nullish(),
        progressNotesGid: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).nullish(),
        variant: import_zod2.z.enum(["payer", "nonpayer"]).nullish(),
        lastValidatedAt: import_zod2.z.string().nullish()
      }).passthrough().nullish()
    }).passthrough().nullish()
  }).passthrough().nullish(),
  // server-managed timestamps (accepted but ignored on write)
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional(),
  // alternative display name for search
  alias: import_zod2.z.string().trim().nullish(),
  // tolerated legacy / common fields
  hmisId: import_zod2.z.string().trim().nullish(),
  cwId: import_zod2.z.string().trim().nullish(),
  phone: import_zod2.z.string().nullish(),
  email: import_zod2.z.string().nullish(),
  // keep lenient unless you want z.email()
  address: import_zod2.z.string().nullish()
}).passthrough();
var CustomerEntity = CustomerInputSchema.extend({
  id: Id
}).passthrough();
var CustomerUpsertSchema = CustomerInputSchema.extend({
  enrolled: import_zod2.z.boolean().optional().default(true)
}).passthrough();
var CustomersUpsertBody = import_zod2.z.union([
  CustomerUpsertSchema,
  import_zod2.z.array(CustomerUpsertSchema).min(1)
]);
var CustomerUpsertBody = CustomersUpsertBody;
var CustomersPatchRow = import_zod2.z.object({
  id: Id,
  patch: CustomerInputSchema.partial().passthrough().optional(),
  unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional(),
  coerceNulls: BoolFromLike.optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var CustomersPatchBody = import_zod2.z.union([
  CustomersPatchRow,
  import_zod2.z.array(CustomersPatchRow).min(1)
]);
var CustomerPatchBody = CustomersPatchBody;
var CustomersDeleteIdShape = import_zod2.z.object({
  id: IdLike.optional(),
  ids: import_zod2.z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    return v;
  }, import_zod2.z.array(IdLike).min(1).optional()),
  cascade: BoolFromLike.optional()
  // aligns with handler’s cascade behavior
}).passthrough();
var hasIdOrIds = (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0;
var CustomersDeleteIdObj = CustomersDeleteIdShape.refine(
  (v) => hasIdOrIds(v),
  { message: "missing_id_or_ids" }
);
var CustomersDeleteBody = import_zod2.z.union([
  IdLike,
  import_zod2.z.array(IdLike).min(1),
  CustomersDeleteIdObj
]);
var CustomersAdminDeleteIdObj = CustomersDeleteIdShape.omit({ cascade: true }).refine(
  (v) => hasIdOrIds(v),
  { message: "missing_id_or_ids" }
);
var CustomersAdminDeleteBody = import_zod2.z.union([
  IdLike,
  import_zod2.z.array(IdLike).min(1),
  CustomersAdminDeleteIdObj
]);
var CustomersGetQuery = import_zod2.z.object({ id: IdLike }).passthrough();
var ActiveFilter = import_zod2.z.preprocess(
  (v) => {
    if (v === "" || v == null) return "all";
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
    if (Array.isArray(v)) return v[0];
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "" || s === "all" || s === "undefined" || s === "null")
        return "all";
      if (["true", "1", "yes", "y", "active"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
    }
    return "all";
  },
  import_zod2.z.union([import_zod2.z.literal(true), import_zod2.z.literal(false), import_zod2.z.literal("all")])
);
var CustomersListQuery = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  active: ActiveFilter.optional(),
  deleted: import_zod2.z.enum(["exclude", "only", "include"]).optional(),
  caseManagerId: IdLike.optional(),
  contactCaseManagerId: IdLike.optional()
}).passthrough();
var CustomersBackfillNamesBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();
var CustomersBackfillCaseManagerNamesBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();
var CustomersBackfillAssistanceLengthBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();

// src/households.ts
var households_exports = {};
__export(households_exports, {
  HouseholdEntity: () => HouseholdEntity,
  HouseholdInputSchema: () => HouseholdInputSchema,
  HouseholdMember: () => HouseholdMember,
  HouseholdRelationship: () => HouseholdRelationship,
  HouseholdStatus: () => HouseholdStatus,
  HouseholdsAddMemberBody: () => HouseholdsAddMemberBody,
  HouseholdsDeleteBody: () => HouseholdsDeleteBody,
  HouseholdsGetQuery: () => HouseholdsGetQuery,
  HouseholdsListQuery: () => HouseholdsListQuery,
  HouseholdsPatchBody: () => HouseholdsPatchBody,
  HouseholdsPatchRow: () => HouseholdsPatchRow,
  HouseholdsRemoveMemberBody: () => HouseholdsRemoveMemberBody,
  HouseholdsSetHeadBody: () => HouseholdsSetHeadBody,
  HouseholdsUpsertBody: () => HouseholdsUpsertBody,
  deriveHeadCustomerId: () => deriveHeadCustomerId,
  householdRelationshipLabel: () => householdRelationshipLabel
});
var HouseholdRelationship = import_zod2.z.enum([
  "head",
  "spouse",
  // spouse / partner
  "child",
  "dependent",
  "other"
]);
var HouseholdStatus = import_zod2.z.enum(["active", "archived"]);
var HouseholdMember = import_zod2.z.object({
  customerId: Id,
  // Denormalized display name; cascade-maintained, may be stale until reconciled.
  name: import_zod2.z.string().trim().nullish(),
  relationship: HouseholdRelationship.default("other"),
  // Free-text override for anything outside the enum (e.g. "grandparent").
  relationshipLabel: import_zod2.z.string().trim().nullish(),
  // Exactly one member should be the head; server normalizes/derives headCustomerId.
  isHead: import_zod2.z.boolean().optional()
}).passthrough();
var HouseholdInputSchema = import_zod2.z.object({
  id: Id.optional(),
  // org (server authoritative — reject cross-org writes)
  orgId: Id.nullish(),
  // Household label, e.g. "Smith Household". Server may derive from head name.
  name: import_zod2.z.string().trim().nullish(),
  // Convenience pointer; if omitted, server derives from members[].isHead.
  headCustomerId: Id.nullish(),
  members: import_zod2.z.array(HouseholdMember).max(40).optional(),
  status: HouseholdStatus.optional(),
  notes: import_zod2.z.string().nullish(),
  // server-managed (accepted but ignored on write)
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional()
}).passthrough();
var HouseholdEntity = HouseholdInputSchema.extend({
  id: Id,
  orgId: Id,
  memberIds: import_zod2.z.array(Id).default([]),
  members: import_zod2.z.array(HouseholdMember).default([])
}).passthrough();
var HouseholdsUpsertBody = HouseholdInputSchema;
var HouseholdsPatchRow = import_zod2.z.object({
  id: Id,
  patch: HouseholdInputSchema.partial().passthrough().optional(),
  unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var HouseholdsPatchBody = import_zod2.z.union([
  HouseholdsPatchRow,
  import_zod2.z.array(HouseholdsPatchRow).min(1)
]);
var HouseholdsAddMemberBody = import_zod2.z.object({
  householdId: Id.optional(),
  member: HouseholdMember,
  // When creating a new household inline, optional label.
  name: import_zod2.z.string().trim().nullish()
}).passthrough();
var HouseholdsRemoveMemberBody = import_zod2.z.object({
  householdId: Id,
  customerId: Id
}).passthrough();
var HouseholdsSetHeadBody = import_zod2.z.object({
  householdId: Id,
  customerId: Id
}).passthrough();
var HouseholdsDeleteBody = import_zod2.z.object({
  id: IdLike.optional(),
  ids: import_zod2.z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    return v;
  }, import_zod2.z.array(IdLike).min(1).optional())
}).passthrough().refine(
  (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0,
  { message: "missing_id_or_ids" }
);
var HouseholdsGetQuery = import_zod2.z.object({
  id: IdLike.optional(),
  customerId: IdLike.optional()
}).passthrough().refine((v) => !!v.id || !!v.customerId, { message: "missing_id_or_customerId" });
var HouseholdsListQuery = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  // Filter to households containing this member (array-contains memberIds).
  memberCustomerId: IdLike.optional(),
  status: HouseholdStatus.optional()
}).passthrough();
function householdRelationshipLabel(member) {
  const free = String(member.relationshipLabel || "").trim();
  if (free) return free;
  const rel = String(member.relationship || "other").trim();
  switch (rel) {
    case "head":
      return "Head of Household";
    case "spouse":
      return "Spouse / Partner";
    case "child":
      return "Child";
    case "dependent":
      return "Dependent";
    default:
      return "Other";
  }
}
function deriveHeadCustomerId(members) {
  const flagged = members.find((m) => m.isHead === true);
  if (flagged) return flagged.customerId;
  const byRole = members.find((m) => String(m.relationship || "") === "head");
  if (byRole) return byRole.customerId;
  return members[0]?.customerId ?? null;
}

// src/creditCards.ts
var creditCards_exports = {};
__export(creditCards_exports, {
  CreditCard: () => CreditCard,
  CreditCardCycleType: () => CreditCardCycleType,
  CreditCardEntity: () => CreditCardEntity,
  CreditCardInputSchema: () => CreditCardInputSchema,
  CreditCardKind: () => CreditCardKind,
  CreditCardLimitOverride: () => CreditCardLimitOverride,
  CreditCardMatching: () => CreditCardMatching,
  CreditCardPatchBody: () => CreditCardPatchBody,
  CreditCardStatus: () => CreditCardStatus,
  CreditCardUpsertBody: () => CreditCardUpsertBody,
  CreditCardsAdminDeleteBody: () => CreditCardsAdminDeleteBody,
  CreditCardsDeleteBody: () => CreditCardsDeleteBody,
  CreditCardsGetQuery: () => CreditCardsGetQuery,
  CreditCardsListQuery: () => CreditCardsListQuery,
  CreditCardsPatchBody: () => CreditCardsPatchBody,
  CreditCardsPatchRow: () => CreditCardsPatchRow,
  CreditCardsSummaryQuery: () => CreditCardsSummaryQuery,
  CreditCardsUpsertBody: () => CreditCardsUpsertBody,
  toArray: () => toArray
});
var Num = import_zod2.z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var ISO7 = import_zod2.z.string().regex(/^\d{4}-\d{2}$/);
var CreditCardStatus = import_zod2.z.enum(["active", "draft", "closed", "deleted"]);
var CreditCardKind = import_zod2.z.literal("credit_card");
var CreditCardCycleType = import_zod2.z.enum(["calendar_month", "statement_cycle"]);
var CreditCardLimitOverride = import_zod2.z.object({
  month: ISO7,
  limitCents: import_zod2.z.coerce.number().int().min(0)
}).passthrough();
var CreditCardMatching = import_zod2.z.object({
  aliases: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
  cardAnswerValues: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
  formIds: import_zod2.z.object({
    creditCard: import_zod2.z.string().trim().nullish(),
    invoice: import_zod2.z.string().trim().nullish()
  }).partial().nullish()
}).passthrough();
var CreditCardInputSchema = import_zod2.z.object({
  id: Id.optional(),
  orgId: Id.nullish(),
  kind: CreditCardKind.optional(),
  name: import_zod2.z.string().trim().min(1),
  code: import_zod2.z.string().trim().nullish(),
  status: CreditCardStatus.optional(),
  active: import_zod2.z.boolean().optional(),
  deleted: import_zod2.z.boolean().optional(),
  issuer: import_zod2.z.string().trim().nullish(),
  network: import_zod2.z.string().trim().nullish(),
  last4: import_zod2.z.string().trim().regex(/^\d{4}$/).nullish(),
  cycleType: CreditCardCycleType.optional(),
  statementCloseDay: import_zod2.z.coerce.number().int().min(1).max(31).nullish(),
  monthlyLimitCents: import_zod2.z.coerce.number().int().min(0).default(0),
  limitOverrides: import_zod2.z.array(CreditCardLimitOverride).default([]),
  matching: CreditCardMatching.nullish(),
  notes: import_zod2.z.string().nullish(),
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var CreditCard = CreditCardInputSchema;
var CreditCardEntity = CreditCardInputSchema.extend({
  id: Id,
  kind: CreditCardKind
}).passthrough();
var CreditCardsUpsertBody = import_zod2.z.union([
  CreditCardInputSchema,
  import_zod2.z.array(CreditCardInputSchema).min(1)
]);
var CreditCardUpsertBody = CreditCardsUpsertBody;
var CreditCardsPatchRow = import_zod2.z.object({
  id: Id,
  patch: CreditCardInputSchema.partial().passthrough(),
  unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var CreditCardsPatchBody = import_zod2.z.union([
  CreditCardsPatchRow,
  import_zod2.z.array(CreditCardsPatchRow).min(1)
]);
var CreditCardPatchBody = CreditCardsPatchBody;
var CreditCardsDeleteBody = import_zod2.z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  import_zod2.z.union([IdLike, import_zod2.z.array(IdLike).min(1)])
);
var CreditCardsAdminDeleteBody = CreditCardsDeleteBody;
var ActiveFilter2 = import_zod2.z.preprocess(
  (v) => {
    if (v === "" || v == null) return void 0;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
    if (Array.isArray(v)) return v[0];
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "y", "active"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
    }
    return v;
  },
  import_zod2.z.union([import_zod2.z.literal(true), import_zod2.z.literal(false)])
);
var CreditCardsListQuery = import_zod2.z.object({
  status: import_zod2.z.string().trim().optional(),
  active: import_zod2.z.union([ActiveFilter2, BoolLike, import_zod2.z.string()]).optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  orgId: IdLike.optional()
}).passthrough();
var CreditCardsGetQuery = import_zod2.z.object({
  id: IdLike,
  orgId: IdLike.optional()
}).passthrough();
var CreditCardsSummaryQuery = import_zod2.z.object({
  id: IdLike.optional(),
  month: ISO7.optional(),
  active: import_zod2.z.union([ActiveFilter2, BoolLike, import_zod2.z.string()]).optional(),
  orgId: IdLike.optional()
}).passthrough();

// src/enrollments.ts
var enrollments_exports = {};
__export(enrollments_exports, {
  Enrollment: () => Enrollment,
  EnrollmentActionHistoryEventType: () => EnrollmentActionHistoryEventType,
  EnrollmentActionHistoryRecord: () => EnrollmentActionHistoryRecord,
  EnrollmentActions: () => EnrollmentActions,
  EnrollmentActionsApplyBody: () => EnrollmentActionsApplyBody,
  EnrollmentClientAllocation: () => EnrollmentClientAllocation,
  EnrollmentCompliance: () => EnrollmentCompliance,
  EnrollmentContinuity: () => EnrollmentContinuity,
  EnrollmentCycleRolloverPreviewItem: () => EnrollmentCycleRolloverPreviewItem,
  EnrollmentGetByIdQuery: () => EnrollmentGetByIdQuery,
  EnrollmentMedicaid: () => EnrollmentMedicaid,
  EnrollmentMedicaidStatus: () => EnrollmentMedicaidStatus,
  EnrollmentProgramAutomation: () => EnrollmentProgramAutomation,
  EnrollmentServiceStatus: () => EnrollmentServiceStatus,
  EnrollmentUnenrollmentReview: () => EnrollmentUnenrollmentReview,
  EnrollmentsAdminDeleteBody: () => EnrollmentsAdminDeleteBody,
  EnrollmentsAdminDeleteResp: () => EnrollmentsAdminDeleteResp,
  EnrollmentsAdminReverseLedgerEntryBody: () => EnrollmentsAdminReverseLedgerEntryBody,
  EnrollmentsAllocationSetBody: () => EnrollmentsAllocationSetBody,
  EnrollmentsBackfillNamesBody: () => EnrollmentsBackfillNamesBody,
  EnrollmentsBulkEnrollBody: () => EnrollmentsBulkEnrollBody,
  EnrollmentsCheckDualQuery: () => EnrollmentsCheckDualQuery,
  EnrollmentsCheckOverlapsQuery: () => EnrollmentsCheckOverlapsQuery,
  EnrollmentsContinuumSummaryQuery: () => EnrollmentsContinuumSummaryQuery,
  EnrollmentsCycleRolloverPreviewBody: () => EnrollmentsCycleRolloverPreviewBody,
  EnrollmentsCycleRolloverRunBody: () => EnrollmentsCycleRolloverRunBody,
  EnrollmentsDeleteBody: () => EnrollmentsDeleteBody,
  EnrollmentsDeleteCoreOutput: () => EnrollmentsDeleteCoreOutput,
  EnrollmentsDeleteResp: () => EnrollmentsDeleteResp,
  EnrollmentsDeleteResultItem: () => EnrollmentsDeleteResultItem,
  EnrollmentsEnrollCustomerBody: () => EnrollmentsEnrollCustomerBody,
  EnrollmentsLinkedProgramsReconcileBody: () => EnrollmentsLinkedProgramsReconcileBody,
  EnrollmentsListQuery: () => EnrollmentsListQuery,
  EnrollmentsMigrateBody: () => EnrollmentsMigrateBody,
  EnrollmentsPatchBody: () => EnrollmentsPatchBody,
  EnrollmentsPatchRow: () => EnrollmentsPatchRow,
  EnrollmentsUndoMigrationBody: () => EnrollmentsUndoMigrationBody,
  EnrollmentsUpsertBody: () => EnrollmentsUpsertBody,
  ScheduleMeta: () => ScheduleMeta,
  ScheduleMetaMigrated: () => ScheduleMetaMigrated,
  ScheduleMetaV1: () => ScheduleMetaV1,
  TaskScheduleMeta: () => TaskScheduleMeta
});

// src/payments.ts
var payments_exports = {};
__export(payments_exports, {
  ComplianceCheckItem: () => ComplianceCheckItem,
  Payment: () => Payment,
  PaymentCompliance: () => PaymentCompliance,
  PaymentCompliancePatch: () => PaymentCompliancePatch,
  PaymentEntity: () => PaymentEntity,
  PaymentProjectionInput: () => PaymentProjectionInput,
  PaymentRentCert: () => PaymentRentCert,
  PaymentsAdjustProjectionsBody: () => PaymentsAdjustProjectionsBody,
  PaymentsAdjustSpendBody: () => PaymentsAdjustSpendBody,
  PaymentsBulkCopyScheduleBody: () => PaymentsBulkCopyScheduleBody,
  PaymentsDeleteRowsBody: () => PaymentsDeleteRowsBody,
  PaymentsDeleteRowsResp: () => PaymentsDeleteRowsResp,
  PaymentsGenerateProjectionsBody: () => PaymentsGenerateProjectionsBody,
  PaymentsRecalcGrantProjectedBody: () => PaymentsRecalcGrantProjectedBody,
  PaymentsRecalcGrantProjectedResp: () => PaymentsRecalcGrantProjectedResp,
  PaymentsRecalculateFutureGrantReq: () => PaymentsRecalculateFutureGrantReq,
  PaymentsRecalculateFutureReq: () => PaymentsRecalculateFutureReq,
  PaymentsRecalculateFutureResp: () => PaymentsRecalculateFutureResp,
  PaymentsRecalculateFutureSingleReq: () => PaymentsRecalculateFutureSingleReq,
  PaymentsRentCertSetBody: () => PaymentsRentCertSetBody,
  PaymentsSpendBody: () => PaymentsSpendBody,
  PaymentsUpdateComplianceBody: () => PaymentsUpdateComplianceBody,
  PaymentsUpdateGrantBudgetBody: () => PaymentsUpdateGrantBudgetBody,
  PaymentsUpsertProjectionsBody: () => PaymentsUpsertProjectionsBody,
  RentCertStatus: () => RentCertStatus,
  RentCertToggle: () => RentCertToggle,
  Spend: () => Spend,
  SpendSource: () => SpendSource
});
var ISO10ish = import_zod2.z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return s;
  return s.length >= 10 ? s.slice(0, 10) : s;
}, ISO10);
var PaymentType = import_zod2.z.enum(["monthly", "deposit", "prorated", "service", "arrears"]);
var ComplianceCheckItem = import_zod2.z.object({
  key: import_zod2.z.string().min(1),
  label: import_zod2.z.string().optional(),
  done: import_zod2.z.boolean().default(false),
  doneAt: import_zod2.z.string().nullish(),
  // ISO timestamp when marked done
  doneBy: import_zod2.z.string().nullish()
  // uid or display name of who marked it done
});
var PaymentCompliance = import_zod2.z.object({
  hmisComplete: import_zod2.z.boolean().nullish(),
  caseworthyComplete: import_zod2.z.boolean().nullish(),
  items: import_zod2.z.array(ComplianceCheckItem).default([]),
  status: import_zod2.z.string().nullish(),
  note: import_zod2.z.string().nullish()
});
var RentCertStatus = import_zod2.z.enum(["due", "completed", "effective"]);
var PaymentRentCert = import_zod2.z.object({
  dueDate: import_zod2.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetPaymentDate: import_zod2.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: import_zod2.z.enum(["calculated", "manual"]).default("calculated"),
  taskIds: import_zod2.z.array(import_zod2.z.string()).default([]),
  status: RentCertStatus.default("due")
}).passthrough();
var Payment = import_zod2.z.object({
  id: import_zod2.z.string().optional(),
  // core
  type: PaymentType,
  amount: import_zod2.z.coerce.number(),
  dueDate: ISO10ish,
  // YYYY-MM-DD
  lineItemId: import_zod2.z.string().nullable().optional(),
  // status
  paid: import_zod2.z.boolean().nullish(),
  paidAt: ISO10ish.nullish(),
  // if you ever store full timestamps, switch this to TsLike
  paidFromGrant: import_zod2.z.boolean().nullish(),
  void: import_zod2.z.boolean().nullish(),
  // notes / vendor
  note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
  vendor: import_zod2.z.string().nullish(),
  comment: import_zod2.z.string().nullish(),
  notifyCM: import_zod2.z.boolean().nullish(),
  // used by inbox trigger logic
  // compliance
  compliance: PaymentCompliance.nullish(),
  rentCert: PaymentRentCert.nullish(),
  /**
   * Sticky "not due": set when an operator clears a rent cert so the
   * calculated continuum sync does not regenerate one for this payment.
   */
  rentCertOptOut: import_zod2.z.boolean().nullish()
});
var PaymentEntity = Payment.extend({
  id: import_zod2.z.string().min(1)
});
var SpendSource = import_zod2.z.enum([
  "enrollment",
  // current default for enrollment-level spends
  "card",
  // future credit-card feed
  "org",
  // future org/program-wide spend
  "manual"
  // admin/manual adjustment
]);
var Spend = import_zod2.z.object({
  id: import_zod2.z.string(),
  // Required
  paymentId: import_zod2.z.string(),
  lineItemId: import_zod2.z.string().nullable(),
  amount: import_zod2.z.coerce.number(),
  // +spend / -reversal
  // Metadata
  source: SpendSource.optional(),
  orgId: import_zod2.z.string().nullish(),
  grantId: import_zod2.z.string().nullish(),
  enrollmentId: import_zod2.z.string().nullish(),
  customerId: import_zod2.z.string().nullish(),
  caseManagerId: import_zod2.z.string().nullish(),
  paid: import_zod2.z.boolean().nullish(),
  status: import_zod2.z.enum(["paid", "unpaid", "voided"]).or(import_zod2.z.string()).nullish(),
  voidedAt: TsLike.nullish(),
  reversed: import_zod2.z.boolean().nullish(),
  reversedAt: TsLike.nullish(),
  reversalOf: import_zod2.z.string().nullish(),
  amountCents: import_zod2.z.coerce.number().int().nullish(),
  month: import_zod2.z.string().nullish(),
  // YYYY-MM
  note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
  ts: TsLike.nullish(),
  by: import_zod2.z.object({
    uid: import_zod2.z.string().nullish(),
    email: import_zod2.z.string().nullish(),
    name: import_zod2.z.string().nullish()
  }).partial().nullish(),
  byUid: import_zod2.z.string().nullish(),
  byName: import_zod2.z.string().nullish(),
  migratedFromSpendId: import_zod2.z.string().nullish(),
  migratedReversalOf: import_zod2.z.string().nullish(),
  customerNameAtSpend: import_zod2.z.string().nullish(),
  grantNameAtSpend: import_zod2.z.string().nullish(),
  lineItemLabelAtSpend: import_zod2.z.string().nullish(),
  paymentLabelAtSpend: import_zod2.z.string().nullish(),
  dueDate: ISO10ish.nullish(),
  date: ISO10ish.nullish(),
  paymentSnapshot: import_zod2.z.object({
    amount: import_zod2.z.coerce.number().nullish(),
    type: PaymentType.nullish(),
    lineItemId: import_zod2.z.string().nullish(),
    dueDate: ISO10ish.nullish(),
    dueMonth: import_zod2.z.string().nullish(),
    note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
    vendor: import_zod2.z.string().nullish(),
    comment: import_zod2.z.string().nullish()
  }).partial().nullish()
});
var PaymentsGenerateProjectionsBody = import_zod2.z.object({
  startDate: ISO10ish,
  months: import_zod2.z.coerce.number().int().positive(),
  monthlyAmount: import_zod2.z.coerce.number().positive(),
  deposit: import_zod2.z.coerce.number().nonnegative().optional()
});
var PaymentsRecalculateFutureSingleReq = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  newMonthlyAmount: import_zod2.z.coerce.number().positive(),
  projectionIds: import_zod2.z.array(import_zod2.z.string().min(1)).max(2e3).optional(),
  lineItemId: import_zod2.z.string().min(1).optional(),
  effectiveFrom: ISO10ish.optional(),
  // inclusive
  dryRun: import_zod2.z.boolean().optional()
});
var PaymentsRecalculateFutureGrantReq = import_zod2.z.object({
  grantId: import_zod2.z.string().min(1),
  newMonthlyAmount: import_zod2.z.coerce.number().positive(),
  lineItemId: import_zod2.z.string().min(1).optional(),
  effectiveFrom: ISO10ish.optional(),
  // inclusive
  dryRun: import_zod2.z.boolean().optional()
});
var PaymentsRecalculateFutureReq = import_zod2.z.union([
  PaymentsRecalculateFutureSingleReq,
  PaymentsRecalculateFutureGrantReq
]);
var PaymentsRecalcGrantProjectedBody = import_zod2.z.object({
  grantId: import_zod2.z.string().min(1),
  effectiveFrom: ISO10ish.optional(),
  // metadata only
  activeOnly: import_zod2.z.boolean().optional().default(true),
  // Ledger is the authoritative spend source. Accept only source=1.
  source: import_zod2.z.literal(1).optional().default(1),
  dryRun: import_zod2.z.boolean().optional()
});
var PaymentsAdjustSpendBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  spendId: import_zod2.z.string().min(1).optional(),
  // optional; backend resolves via paymentId if absent/stale
  paymentId: import_zod2.z.string().min(1).optional(),
  // alternative to spendId for subcollection lookup
  patch: import_zod2.z.object({
    amount: import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).optional(),
    type: PaymentType.optional(),
    lineItemId: import_zod2.z.string().min(1).optional(),
    dueDate: ISO10ish.optional(),
    // normalized to ISO10
    note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).optional(),
    vendor: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.null()]).optional(),
    comment: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.null()]).optional()
  }).default({}),
  reason: import_zod2.z.string().optional()
});
var PaymentProjectionInput = import_zod2.z.object({
  id: import_zod2.z.string().optional(),
  type: PaymentType,
  amount: import_zod2.z.coerce.number(),
  lineItemId: import_zod2.z.string().min(1),
  dueDate: ISO10ish.optional(),
  date: ISO10ish.optional(),
  // legacy alias accepted on input
  paid: import_zod2.z.boolean().nullish(),
  paidAt: ISO10ish.nullish(),
  // if you ever store full timestamps, switch this to TsLike
  paidFromGrant: import_zod2.z.boolean().nullish(),
  note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
  vendor: import_zod2.z.string().nullish(),
  comment: import_zod2.z.string().nullish(),
  compliance: PaymentCompliance.nullish(),
  rentCert: PaymentRentCert.nullish(),
  rentCertOptOut: import_zod2.z.boolean().nullish()
}).superRefine((v, ctx) => {
  const hasDue = !!v.dueDate;
  const hasDate = !!v.date;
  if (!hasDue && !hasDate) {
    ctx.addIssue({
      code: import_zod2.z.ZodIssueCode.custom,
      message: "PaymentProjectionInput requires dueDate or date",
      path: ["dueDate"]
    });
  }
  if (!Number.isFinite(Number(v.amount)) || Number(v.amount) <= 0) {
    ctx.addIssue({
      code: import_zod2.z.ZodIssueCode.custom,
      message: "amount must be a positive number",
      path: ["amount"]
    });
  }
});
var PaymentsAdjustProjectionsBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  payments: import_zod2.z.array(PaymentProjectionInput).default([]),
  replaceUnpaid: import_zod2.z.boolean().optional().default(true)
});
var PaymentsBulkCopyScheduleBody = import_zod2.z.object({
  sourceEnrollmentId: import_zod2.z.string().min(1),
  targetEnrollmentIds: import_zod2.z.array(import_zod2.z.string().min(1)).min(1),
  mode: import_zod2.z.enum(["replace", "merge"]).optional().default("replace"),
  includeTypes: import_zod2.z.array(import_zod2.z.string().min(1)).optional().nullable(),
  anchorByStartDate: import_zod2.z.boolean().optional().default(true)
});
var PaymentsSpendBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  paymentId: import_zod2.z.string().min(1),
  note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).optional(),
  reverse: import_zod2.z.boolean().optional().default(false),
  forceSync: import_zod2.z.boolean().optional().default(false),
  vendor: import_zod2.z.string().optional(),
  comment: import_zod2.z.string().optional()
});
var PaymentCompliancePatch = PaymentCompliance.partial();
var PaymentsUpdateComplianceBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  paymentId: import_zod2.z.string().min(1),
  // patch semantics: allow partial updates (also allows nullish because base schema does)
  patch: PaymentCompliancePatch
});
var RentCertToggle = import_zod2.z.enum(["notDue", "due", "completed", "effective"]);
var PaymentsRentCertSetBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  paymentId: import_zod2.z.string().min(1),
  status: RentCertToggle.optional(),
  dueDate: ISO10ish.nullish(),
  /** Inbox bucket for the generated reminder tasks. Default: "compliance". */
  bucket: import_zod2.z.enum(["task", "compliance"]).optional(),
  /** Custom title for the generated reminder tasks. Default: derived "{month} rent cert due {date}". */
  title: import_zod2.z.string().trim().max(200).optional(),
  /** Mark older open ("due") certs on other payments of this enrollment completed. */
  supersedeOlderOpenCerts: import_zod2.z.boolean().optional()
});
var PaymentsDeleteRowsBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  paymentIds: import_zod2.z.array(import_zod2.z.string().min(1)).max(500).optional(),
  deleteAll: import_zod2.z.boolean().optional().default(false),
  preservePaid: import_zod2.z.boolean().optional().default(true),
  updateBudgets: import_zod2.z.boolean().optional().default(false),
  removeSpends: import_zod2.z.boolean().optional().default(true),
  reverseLedger: import_zod2.z.boolean().optional().default(true)
});
var PaymentsUpdateGrantBudgetBody = PaymentsRecalcGrantProjectedBody;
var PaymentsUpsertProjectionsBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().min(1),
  payments: import_zod2.z.array(PaymentProjectionInput).default([])
});
var PaymentsRecalculateFutureResp = import_zod2.z.union([
  import_zod2.z.object({
    mode: import_zod2.z.literal("single"),
    fromISO: ISO10ish,
    dryRun: import_zod2.z.boolean(),
    id: import_zod2.z.string(),
    payments: import_zod2.z.array(Payment).optional(),
    deltaByLI: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.number()).optional(),
    noChange: import_zod2.z.literal(true).optional(),
    preview: import_zod2.z.object({
      deltaByLI: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.number()),
      willUpdate: import_zod2.z.boolean()
    }).optional(),
    sample: import_zod2.z.array(Payment).optional()
  }),
  import_zod2.z.object({
    mode: import_zod2.z.literal("grant"),
    fromISO: ISO10ish,
    dryRun: import_zod2.z.boolean(),
    grantId: import_zod2.z.string(),
    stats: import_zod2.z.object({
      touched: import_zod2.z.number(),
      noChange: import_zod2.z.number(),
      errors: import_zod2.z.number()
    }),
    summaries: import_zod2.z.array(import_zod2.z.object({
      enrollmentId: import_zod2.z.string(),
      deltaByLI: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.number())
    }))
  })
]);
var PaymentsRecalcGrantProjectedResp = import_zod2.z.object({
  totals: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()),
  warnings: import_zod2.z.array(import_zod2.z.string()),
  dryRun: import_zod2.z.boolean(),
  effectiveFromISO: ISO10ish,
  activeOnly: import_zod2.z.boolean(),
  source: import_zod2.z.literal(1)
});
var PaymentsDeleteRowsResp = import_zod2.z.object({
  ok: import_zod2.z.boolean(),
  enrollmentId: import_zod2.z.string(),
  deletedPaymentIds: import_zod2.z.array(import_zod2.z.string()),
  skippedPaidIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  reversedSpendIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  removedSpendSubdocIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  counts: import_zod2.z.object({
    deletedPayments: import_zod2.z.number().int().nonnegative(),
    skippedPaid: import_zod2.z.number().int().nonnegative(),
    reversedSpends: import_zod2.z.number().int().nonnegative(),
    removedSpendSubdocs: import_zod2.z.number().int().nonnegative()
  })
});

// src/tasks.ts
var tasks_exports = {};
__export(tasks_exports, {
  AssignedGroup: () => AssignedGroup,
  TaskScheduleItem: () => TaskScheduleItem,
  TaskStats: () => TaskStats,
  TasksAdminRegenerateForGrantBody: () => TasksAdminRegenerateForGrantBody,
  TasksAdminRegenerateForGrantResultItem: () => TasksAdminRegenerateForGrantResultItem,
  TasksAssignBody: () => TasksAssignBody,
  TasksBulkStatusBody: () => TasksBulkStatusBody,
  TasksDeleteBody: () => TasksDeleteBody,
  TasksGenerateScheduleWriteBody: () => TasksGenerateScheduleWriteBody,
  TasksGenerateScheduleWriteResult: () => TasksGenerateScheduleWriteResult,
  TasksListItem: () => TasksListItem,
  TasksListQuery: () => TasksListQuery,
  TasksOtherAssignBody: () => TasksOtherAssignBody,
  TasksOtherCreateBody: () => TasksOtherCreateBody,
  TasksOtherListMyQuery: () => TasksOtherListMyQuery,
  TasksOtherStatusBody: () => TasksOtherStatusBody,
  TasksOtherUpdateBody: () => TasksOtherUpdateBody,
  TasksRescheduleBody: () => TasksRescheduleBody,
  TasksUpdateFieldsBody: () => TasksUpdateFieldsBody,
  TasksUpdateStatusBody: () => TasksUpdateStatusBody,
  TasksUpsertManualBody: () => TasksUpsertManualBody
});
var AssignedGroup = import_zod2.z.union([
  import_zod2.z.literal("admin"),
  import_zod2.z.literal("casemanager"),
  import_zod2.z.literal("compliance")
]);
var TaskScheduleItem = import_zod2.z.object({
  id: import_zod2.z.string(),
  // NOTE: schedule uses `type` (manual upsert maps title -> type)
  type: import_zod2.z.string().default("Task"),
  dueDate: import_zod2.z.string().optional().default(""),
  // YYYY-MM-DD when date-based; optional for notes
  dueMonth: import_zod2.z.string().nullish(),
  // YYYY-MM
  // --- deprecated lifecycle/status fields
  completed: import_zod2.z.boolean().nullish(),
  completedAt: import_zod2.z.string().nullish(),
  completedBy: import_zod2.z.string().nullish(),
  // verified hard-lock
  status: import_zod2.z.string().nullish(),
  // keep permissive for now ("verified" in prod)
  verified: import_zod2.z.boolean().nullish(),
  verifiedAt: import_zod2.z.string().nullish(),
  verifiedBy: import_zod2.z.string().nullish(),
  // reopen metadata
  reopenedAt: import_zod2.z.string().nullish(),
  reopenedBy: import_zod2.z.string().nullish(),
  reopenReason: import_zod2.z.string().nullish(),
  // --- ownership / routing
  assignedToUid: import_zod2.z.string().nullish(),
  assignedToGroup: AssignedGroup.nullish(),
  assignedAt: import_zod2.z.string().nullish(),
  assignedBy: import_zod2.z.string().nullish(),
  // --- multiparty / linked approvals (optional)
  multiParentId: import_zod2.z.string().nullish(),
  multiStepIndex: import_zod2.z.number().int().nullish(),
  multiStepCount: import_zod2.z.number().int().nullish(),
  multiMode: import_zod2.z.enum(["parallel", "sequential"]).nullish(),
  // --- meta
  notify: import_zod2.z.boolean().nullish(),
  notes: import_zod2.z.string().nullish(),
  // legacy-ish, but keep: older code reads it in carryStatus()
  byUid: import_zod2.z.string().nullish(),
  // UI bucket / grouping
  bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).nullish(),
  // managed tasks from definitions
  defId: import_zod2.z.string().nullish(),
  managed: import_zod2.z.boolean().nullish(),
  // audit-ish (functions already writes these on manual upsert / updateFields)
  createdAt: import_zod2.z.string().nullish(),
  createdBy: import_zod2.z.string().nullish(),
  updatedAt: import_zod2.z.string().nullish(),
  updatedBy: import_zod2.z.string().nullish()
}).passthrough();
var TaskStats = import_zod2.z.object({
  total: import_zod2.z.number().nullable().default(null),
  completed: import_zod2.z.number().nullable().default(null),
  overdue: import_zod2.z.number().nullable().default(null),
  nextDue: import_zod2.z.string().nullable().optional()
});
var TasksBulkStatusBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  changes: import_zod2.z.array(import_zod2.z.object({
    taskId: import_zod2.z.string(),
    action: import_zod2.z.enum(["complete", "reopen", "verify"]).optional().default("complete"),
    reason: import_zod2.z.string().optional(),
    notes: import_zod2.z.string().optional()
  })).min(1).max(500)
});
var TasksAssignBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  taskId: import_zod2.z.string(),
  assign: import_zod2.z.object({
    group: AssignedGroup.nullish().optional(),
    uid: import_zod2.z.string().nullish().optional()
  })
});
var TasksUpdateStatusBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  taskId: import_zod2.z.string(),
  action: import_zod2.z.enum(["complete", "reopen", "verify"]).optional().default("complete"),
  reason: import_zod2.z.string().optional(),
  notes: import_zod2.z.string().optional()
});
var TasksRescheduleBody = import_zod2.z.union([
  import_zod2.z.object({
    enrollmentId: import_zod2.z.string(),
    taskId: import_zod2.z.string(),
    newDueDate: import_zod2.z.string()
    // YYYY-MM-DD
  }),
  import_zod2.z.object({
    enrollmentId: import_zod2.z.string(),
    taskIds: import_zod2.z.array(import_zod2.z.string()).min(1).max(500),
    shiftDays: import_zod2.z.number().int().min(-3660).max(3660)
  })
]);
var TasksUpsertManualBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  task: import_zod2.z.object({
    id: import_zod2.z.string().optional(),
    title: import_zod2.z.string().min(1).default("Reminder"),
    notes: import_zod2.z.string().optional(),
    dueDate: import_zod2.z.string().optional().default(""),
    // optional for note/reminder mode
    bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).optional().default("task"),
    notify: import_zod2.z.boolean().optional().default(true)
  })
});
var TasksListQuery = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().optional(),
  enrollmentIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  dueMonth: import_zod2.z.string().optional(),
  // YYYY-MM
  status: import_zod2.z.enum(["open", "done", "verified"]).optional(),
  bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).optional(),
  assigneeUid: import_zod2.z.string().optional(),
  assigneeGroup: AssignedGroup.optional(),
  notify: import_zod2.z.boolean().optional(),
  limit: import_zod2.z.number().int().min(1).max(1e3).optional().default(200)
});
var TasksListItem = import_zod2.z.object({
  id: import_zod2.z.string(),
  // `${enrollmentId}__${taskId}`
  taskId: import_zod2.z.string(),
  enrollmentId: import_zod2.z.string(),
  customerId: import_zod2.z.string().nullable(),
  grantId: import_zod2.z.string().nullable(),
  title: import_zod2.z.string(),
  note: import_zod2.z.string(),
  bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).nullable(),
  defId: import_zod2.z.string().nullable(),
  managed: import_zod2.z.boolean(),
  multiParentId: import_zod2.z.string().nullable(),
  multiStepIndex: import_zod2.z.number().nullable(),
  multiStepCount: import_zod2.z.number().nullable(),
  multiMode: import_zod2.z.enum(["parallel", "sequential"]).nullable(),
  dueDate: import_zod2.z.string().optional().default(""),
  dueMonth: import_zod2.z.string().nullable(),
  /** @deprecated Use reminder visibility/notify fields instead of workflow status. */
  status: import_zod2.z.enum(["open", "done", "verified"]).optional().default("open"),
  notify: import_zod2.z.boolean().optional().default(true),
  assignedToUid: import_zod2.z.string().nullable(),
  assignedToGroup: AssignedGroup.nullable(),
  assignedAt: import_zod2.z.string().nullable().optional()
});
var TasksAdminRegenerateForGrantBody = import_zod2.z.object({
  grantId: import_zod2.z.string(),
  activeOnly: import_zod2.z.boolean().optional().default(true),
  keepManual: import_zod2.z.boolean().optional().default(true),
  mode: import_zod2.z.enum(["replaceManaged", "mergeManaged"]).optional().default("replaceManaged"),
  preserveCompletedManaged: import_zod2.z.boolean().optional().default(true),
  pinCompletedManaged: import_zod2.z.boolean().optional().default(true),
  pageSize: import_zod2.z.number().int().min(1).max(1e3).optional().default(200),
  dryRun: import_zod2.z.boolean().optional().default(false)
});
var TasksAdminRegenerateForGrantResultItem = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  ok: import_zod2.z.boolean(),
  total: import_zod2.z.number().optional(),
  closed: import_zod2.z.boolean().optional(),
  error: import_zod2.z.string().optional()
}).passthrough();
var OtherGroup = AssignedGroup;
var TasksOtherCreateBody = import_zod2.z.object({
  title: import_zod2.z.string().min(1).max(200),
  notes: import_zod2.z.string().max(2e3).optional(),
  dueDate: import_zod2.z.string().optional(),
  dueMonth: import_zod2.z.string().optional(),
  notify: import_zod2.z.boolean().optional().default(true),
  assign: import_zod2.z.object({
    group: OtherGroup.nullish(),
    uids: import_zod2.z.array(import_zod2.z.string()).max(20).nullish()
  }).optional()
});
var TasksOtherUpdateBody = import_zod2.z.object({
  id: import_zod2.z.string(),
  patch: import_zod2.z.object({
    title: import_zod2.z.string().min(1).max(200).optional(),
    notes: import_zod2.z.string().max(2e3).optional(),
    dueDate: import_zod2.z.union([ISO10, import_zod2.z.literal(""), import_zod2.z.null()]).optional(),
    notify: import_zod2.z.boolean().optional()
  })
});
var TasksOtherAssignBody = import_zod2.z.object({
  id: import_zod2.z.string(),
  assign: import_zod2.z.object({
    group: OtherGroup.nullish(),
    uids: import_zod2.z.array(import_zod2.z.string()).max(20).nullish()
  })
});
var TasksOtherStatusBody = import_zod2.z.object({
  id: import_zod2.z.string(),
  /** @deprecated Other-task completion lifecycle is deprecated; keep for back-compat only. */
  action: import_zod2.z.enum(["complete", "reopen"]).optional().default("complete")
});
var TasksOtherListMyQuery = import_zod2.z.object({
  month: import_zod2.z.string().optional(),
  // YYYY-MM
  includeGroup: import_zod2.z.union([import_zod2.z.literal("true"), import_zod2.z.literal("false")]).optional()
});
var TasksUpdateFieldsBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  taskId: import_zod2.z.string(),
  patch: import_zod2.z.object({
    notify: import_zod2.z.boolean().optional(),
    notes: import_zod2.z.string().optional(),
    type: import_zod2.z.string().optional(),
    bucket: import_zod2.z.enum(["task", "assessment", "compliance", "other"]).optional()
  })
});
var TasksDeleteBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  taskId: import_zod2.z.string().optional(),
  all: import_zod2.z.union([import_zod2.z.boolean(), import_zod2.z.string(), import_zod2.z.number()]).optional()
});
var TaskDefUnknown = import_zod2.z.unknown();
var TasksGenerateScheduleWriteBody = import_zod2.z.object({
  enrollmentId: import_zod2.z.string().optional(),
  enrollmentIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  startDate: import_zod2.z.string().optional(),
  keepManual: import_zod2.z.boolean().optional().default(true),
  mode: import_zod2.z.enum(["replaceManaged", "mergeManaged"]).optional().default("replaceManaged"),
  preserveCompletedManaged: import_zod2.z.boolean().optional().default(true),
  pinCompletedManaged: import_zod2.z.boolean().optional().default(true),
  taskDef: import_zod2.z.union([TaskDefUnknown, import_zod2.z.array(TaskDefUnknown)]).optional(),
  taskDefs: import_zod2.z.array(TaskDefUnknown).optional(),
  replaceTaskDefPrefixes: import_zod2.z.array(import_zod2.z.string()).optional().default([])
});
var TasksGenerateScheduleWriteResult = import_zod2.z.object({
  enrollmentId: import_zod2.z.string(),
  ok: import_zod2.z.boolean(),
  total: import_zod2.z.number().optional(),
  error: import_zod2.z.string().optional(),
  note: import_zod2.z.string().optional(),
  closed: import_zod2.z.boolean().optional()
});

// src/enrollments.ts
var EnrollmentCompliance = import_zod2.z.object({
  caseworthyEntryComplete: import_zod2.z.boolean().nullish(),
  caseworthyExitComplete: import_zod2.z.boolean().nullish(),
  hmisEntryComplete: import_zod2.z.boolean().nullish(),
  hmisExitComplete: import_zod2.z.boolean().nullish()
});
var EnrollmentServiceStatus = import_zod2.z.enum(["active", "paused", "expired"]);
var EnrollmentMedicaidStatus = import_zod2.z.enum(["active", "closed"]);
var EnrollmentMedicaid = import_zod2.z.object({
  status: EnrollmentMedicaidStatus.default("active"),
  closedDate: import_zod2.z.string().trim().nullable().optional(),
  reopenedDate: import_zod2.z.string().trim().nullable().optional(),
  note: import_zod2.z.string().trim().nullable().optional()
}).passthrough();
var EnrollmentActions = import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown());
var EnrollmentActionHistoryEventType = import_zod2.z.enum([
  "actionChanged",
  "serviceStatusChanged",
  "medicaidStatusChanged",
  "renewalReminderCreated",
  "enrollmentExpired",
  "automationFailed"
]);
var EnrollmentActionHistoryRecord = import_zod2.z.object({
  id: Id.optional(),
  eventType: EnrollmentActionHistoryEventType,
  actionId: import_zod2.z.string().trim().nullable().optional(),
  actorType: import_zod2.z.enum(["user", "system", "automation"]).default("user"),
  actorId: import_zod2.z.string().trim().nullable().optional(),
  before: import_zod2.z.unknown().optional(),
  after: import_zod2.z.unknown().optional(),
  note: import_zod2.z.string().trim().nullable().optional(),
  createdAt: TsLike.nullish().optional()
}).passthrough();
var EnrollmentActionsApplyBody = import_zod2.z.object({
  enrollmentId: Id,
  actionId: import_zod2.z.string().trim().min(1).optional(),
  value: import_zod2.z.unknown().optional(),
  serviceStatus: EnrollmentServiceStatus.optional(),
  medicaid: EnrollmentMedicaid.partial().optional(),
  note: import_zod2.z.string().trim().nullable().optional()
}).passthrough().refine(
  (v) => !!v.serviceStatus || !!v.medicaid || typeof v.actionId === "string" && Object.prototype.hasOwnProperty.call(v, "value"),
  { message: "missing_action_update" }
);
var ScheduleMetaV1 = import_zod2.z.object({
  version: import_zod2.z.literal(1),
  rentPlans: import_zod2.z.array(
    import_zod2.z.object({
      firstDue: import_zod2.z.string(),
      months: import_zod2.z.string(),
      monthly: import_zod2.z.string(),
      lineItemId: import_zod2.z.string(),
      vendor: import_zod2.z.string().optional(),
      comment: import_zod2.z.string().optional()
    })
  ),
  utilPlans: import_zod2.z.array(
    import_zod2.z.object({
      firstDue: import_zod2.z.string(),
      months: import_zod2.z.string(),
      monthly: import_zod2.z.string(),
      lineItemId: import_zod2.z.string(),
      vendor: import_zod2.z.string().optional(),
      comment: import_zod2.z.string().optional()
    })
  ),
  deposit: import_zod2.z.object({
    enabled: import_zod2.z.boolean(),
    date: import_zod2.z.string(),
    amount: import_zod2.z.string(),
    lineItemId: import_zod2.z.string(),
    vendor: import_zod2.z.string().optional(),
    comment: import_zod2.z.string().optional()
  }).optional(),
  prorated: import_zod2.z.object({
    enabled: import_zod2.z.boolean(),
    date: import_zod2.z.string(),
    amount: import_zod2.z.string(),
    lineItemId: import_zod2.z.string(),
    vendor: import_zod2.z.string().optional(),
    comment: import_zod2.z.string().optional()
  }).optional(),
  services: import_zod2.z.array(
    import_zod2.z.object({
      id: import_zod2.z.string(),
      note: import_zod2.z.string(),
      date: import_zod2.z.string(),
      amount: import_zod2.z.string(),
      lineItemId: import_zod2.z.string(),
      vendor: import_zod2.z.string().optional(),
      comment: import_zod2.z.string().optional()
    })
  ),
  migratedOut: import_zod2.z.object({
    toEnrollmentId: import_zod2.z.string(),
    toGrantId: import_zod2.z.string(),
    cutover: import_zod2.z.string()
  }).nullable().optional(),
  /** ISO timestamp of the last manual projection edit after the initial build. Cleared on full rebuild. */
  editedAt: import_zod2.z.string().optional()
});
var ScheduleMetaMigrated = import_zod2.z.object({
  mode: import_zod2.z.literal("migrated"),
  cutover: import_zod2.z.string(),
  defaultEditMode: import_zod2.z.enum(["keepManual", "rebuildUnpaid"]).optional(),
  fromEnrollmentId: import_zod2.z.string(),
  fromGrantId: import_zod2.z.string(),
  lineItemMapSnapshot: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
  migratedOut: import_zod2.z.object({
    toEnrollmentId: import_zod2.z.string(),
    toGrantId: import_zod2.z.string(),
    cutover: import_zod2.z.string()
  }).nullable().optional()
});
var ScheduleMeta = import_zod2.z.union([ScheduleMetaMigrated, ScheduleMetaV1]);
var TaskScheduleMeta = import_zod2.z.object({
  version: import_zod2.z.literal(1),
  defs: import_zod2.z.array(import_zod2.z.unknown()).default([]),
  savedAt: TsLike.nullish().optional()
}).passthrough();
var EnrollmentContinuity = import_zod2.z.object({
  continuumId: Id,
  kind: import_zod2.z.literal("grantCycle").default("grantCycle"),
  previousEnrollmentId: Id.nullable().optional(),
  nextEnrollmentId: Id.nullable().optional(),
  rolloverSource: import_zod2.z.enum(["admin", "migration", "backfill"]).nullish(),
  cutoffDate: ISO10.nullish()
}).passthrough();
var EnrollmentClientAllocation = import_zod2.z.object({
  amount: import_zod2.z.number().min(0).nullable().optional(),
  note: import_zod2.z.string().trim().max(1e3).nullable().optional(),
  updatedAt: TsLike.nullish().optional(),
  updatedBy: import_zod2.z.string().trim().nullable().optional()
}).passthrough();
var EnrollmentProgramAutomation = import_zod2.z.object({
  targetGrantId: Id.nullish(),
  sourceEnrollmentIds: import_zod2.z.array(Id).default([]),
  createdByRule: import_zod2.z.boolean().default(false)
}).passthrough();
var EnrollmentUnenrollmentReview = import_zod2.z.object({
  required: import_zod2.z.boolean().default(false),
  reason: import_zod2.z.string().trim().nullable().optional(),
  sourceEnrollmentIds: import_zod2.z.array(Id).default([]),
  flaggedAt: TsLike.nullish().optional(),
  clearedAt: TsLike.nullish().optional()
}).passthrough();
var Enrollment = import_zod2.z.object({
  id: Id,
  grantId: import_zod2.z.string(),
  customerId: import_zod2.z.string(),
  // org/team access (server authoritative)
  orgId: import_zod2.z.string().trim().min(1).nullish(),
  teamIds: import_zod2.z.array(import_zod2.z.string().trim().min(1)).max(10).optional(),
  startDate: import_zod2.z.string().nullable().optional(),
  // YYYY-MM-DD
  endDate: import_zod2.z.string().nullable().optional(),
  migratedFrom: import_zod2.z.object({
    enrollmentId: import_zod2.z.string(),
    grantId: import_zod2.z.string(),
    cutover: import_zod2.z.string(),
    migrationId: import_zod2.z.string().optional()
  }).nullable().optional(),
  migratedTo: import_zod2.z.object({
    enrollmentId: import_zod2.z.string(),
    grantId: import_zod2.z.string(),
    cutover: import_zod2.z.string(),
    migrationId: import_zod2.z.string().optional()
  }).nullable().optional(),
  continuity: EnrollmentContinuity.nullish(),
  clientAllocation: EnrollmentClientAllocation.nullish(),
  programAutomation: EnrollmentProgramAutomation.nullish(),
  unenrollmentReview: EnrollmentUnenrollmentReview.nullish(),
  active: import_zod2.z.boolean().nullable().optional(),
  status: import_zod2.z.enum(["active", "deleted", "closed"]).nullable().optional(),
  deleted: import_zod2.z.boolean().nullable().optional(),
  // Service status is separate from enrollment lifecycle. Medicaid loss can pause service
  // while the enrollment lifecycle remains active for authorization/renewal tracking.
  serviceStatus: EnrollmentServiceStatus.nullable().optional(),
  medicaid: EnrollmentMedicaid.nullish(),
  actions: EnrollmentActions.nullish(),
  // Operational stage (waitlist → tenant, etc.) kept separate from lifecycle status.
  stage: import_zod2.z.enum(["waitlisted", "offered", "tenant", "exited"]).nullable().optional(),
  // First-class priority snapshot for waitlist ordering (computed from an assessment).
  priorityScore: import_zod2.z.number().nullable().optional(),
  priorityLevel: import_zod2.z.string().nullable().optional(),
  priorityAt: TsLike.nullish().optional(),
  priorityTemplateId: import_zod2.z.string().nullable().optional(),
  priorityTemplateVersion: import_zod2.z.number().int().nullable().optional(),
  priorityAssessmentId: import_zod2.z.string().nullable().optional(),
  // Optional generic latest-results cache (templateId → small snapshot)
  latestAssessments: import_zod2.z.record(
    import_zod2.z.string(),
    import_zod2.z.object({
      at: TsLike.nullish().optional(),
      assessmentId: import_zod2.z.string().nullable().optional(),
      templateVersion: import_zod2.z.number().int().nullable().optional(),
      computed: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).optional()
    }).passthrough()
  ).nullish().optional(),
  compliance: EnrollmentCompliance.nullish(),
  customerName: import_zod2.z.string().nullable().optional(),
  clientName: import_zod2.z.string().nullable().optional(),
  grantName: import_zod2.z.string().nullable().optional(),
  name: import_zod2.z.string().nullable().optional(),
  population: Population.optional(),
  caseManagerId: import_zod2.z.string().nullable().optional(),
  caseManagerName: import_zod2.z.string().nullable().optional(),
  maxAssistanceMonthsAtEnrollment: import_zod2.z.number().int().min(1).max(240).nullable().optional(),
  maxAssistanceCutoffDate: import_zod2.z.string().nullable().optional(),
  // --- Finance (kept here for now; payments & spends also live in dedicated features)
  payments: import_zod2.z.array(Payment).nullable().optional(),
  spends: import_zod2.z.array(Spend).nullable().optional(),
  // --- Tasks (single model for tasks & compliance)
  taskSchedule: import_zod2.z.array(TaskScheduleItem).nullable().optional(),
  taskStats: TaskStats.nullish(),
  scheduleMeta: ScheduleMeta.nullish(),
  taskScheduleMeta: TaskScheduleMeta.nullish(),
  /**
   * Whether to auto-generate the task schedule from grant.tasks when this
   * enrollment is created.  Defaults to true when absent.
   * Set to false to enroll the client without creating managed tasks.
   */
  generateTaskSchedule: import_zod2.z.boolean().default(true),
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike
  // required by convention
});
var EnrollmentGetByIdQuery = import_zod2.z.object({ id: Id }).passthrough();
var EnrollmentsListQuery = import_zod2.z.object({
  active: BoolLike.optional(),
  customerId: Id.optional(),
  grantId: Id.optional(),
  limit: import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).optional(),
  startAfter: import_zod2.z.string().optional(),
  status: import_zod2.z.string().optional()
}).passthrough();
var EnrollmentsBackfillNamesBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: BoolFromLike.optional(),
  dryRun: BoolFromLike.optional()
}).passthrough();
var EnrollmentsUpsertBody = import_zod2.z.union([
  Enrollment.partial(),
  import_zod2.z.array(Enrollment.partial()).min(1)
]);
var EnrollmentsPatchRow = import_zod2.z.object({
  id: Id,
  patch: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).optional(),
  unset: import_zod2.z.array(import_zod2.z.string()).optional()
}).refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var EnrollmentsPatchBody = import_zod2.z.union([
  EnrollmentsPatchRow,
  import_zod2.z.array(EnrollmentsPatchRow).min(1)
]);
var EnrollmentDeleteIdObj = import_zod2.z.object({
  id: Id.optional(),
  ids: Ids.optional()
}).refine(
  (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0,
  { message: "missing_id_or_ids" }
);
var EnrollmentsDeleteBody = import_zod2.z.union([
  Id,
  Ids,
  EnrollmentDeleteIdObj.extend({
    voidPaid: import_zod2.z.boolean().optional(),
    hard: import_zod2.z.boolean().optional(),
    unlinkSpends: import_zod2.z.boolean().optional()
  })
]);
var EnrollmentsAdminDeleteBody = import_zod2.z.union([
  Id,
  Ids,
  EnrollmentDeleteIdObj.extend({
    voidPaid: import_zod2.z.boolean().optional(),
    mode: import_zod2.z.enum(["safe", "hard"]).optional(),
    purgeSpends: import_zod2.z.boolean().optional(),
    purgeSubcollections: import_zod2.z.boolean().optional(),
    unlinkSpends: import_zod2.z.boolean().optional()
  })
]);
var EnrollmentsDeleteResultItem = import_zod2.z.object({
  id: import_zod2.z.string(),
  ok: import_zod2.z.literal(true).optional(),
  error: import_zod2.z.string().optional()
});
var EnrollmentsDeleteCoreOutput = import_zod2.z.object({
  ok: import_zod2.z.boolean(),
  results: import_zod2.z.array(EnrollmentsDeleteResultItem)
});
var EnrollmentsDeleteResp = EnrollmentsDeleteCoreOutput.extend({
  deleted: import_zod2.z.literal(true)
});
var EnrollmentsAdminDeleteResp = EnrollmentsDeleteCoreOutput.extend({
  deleted: import_zod2.z.literal(true),
  mode: import_zod2.z.enum(["safe", "hard"]),
  purged: import_zod2.z.object({
    spends: import_zod2.z.number().int().nonnegative(),
    enrollments: import_zod2.z.number().int().nonnegative()
  }).optional(),
  purgeErrors: import_zod2.z.array(import_zod2.z.object({ id: import_zod2.z.string(), error: import_zod2.z.string() })).optional()
});
var EnrollmentsEnrollCustomerBody = import_zod2.z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return v;
    const o = { ...v };
    if (o.grantId == null && o.grant_id != null) o.grantId = o.grant_id;
    if (o.customerId == null && o.clientId != null) o.customerId = o.clientId;
    if (o.customerId == null && o.customer_id != null) o.customerId = o.customer_id;
    return o;
  },
  import_zod2.z.object({
    grantId: IdLike,
    customerId: IdLike,
    extra: JsonObjLike.default({})
  }).passthrough()
);
var EnrollmentsBulkEnrollBody = import_zod2.z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return v;
    const o = { ...v };
    if (o.grantId == null && o.grant_id != null) o.grantId = o.grant_id;
    if (o.customerIds == null && o.clientIds != null) o.customerIds = o.clientIds;
    if (o.perCustomerExtra == null && o.perClientExtra != null) o.perCustomerExtra = o.perClientExtra;
    return o;
  },
  import_zod2.z.object({
    grantId: IdLike,
    customerIds: import_zod2.z.preprocess((v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
      return v;
    }, import_zod2.z.array(IdLike).min(1)),
    // options used by the handler (normalized + defaulted)
    skipIfExists: BoolFromLike.default(true),
    existsMode: import_zod2.z.enum(["nonDeleted", "activeOnly"]).default("nonDeleted"),
    // payloads used by the handler (normalized + defaulted)
    extra: JsonObjLike.default({}),
    perCustomerExtra: import_zod2.z.preprocess((v) => {
      if (v && typeof v === "object") return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }
      return v;
    }, import_zod2.z.record(import_zod2.z.string(), JsonObjLike).default({}))
  }).passthrough()
);
var EnrollmentsCheckOverlapsQuery = import_zod2.z.object({
  customerId: Id.optional(),
  clientId: Id.optional(),
  grantIds: GrantIdsLike.optional(),
  window: import_zod2.z.object({ start: ISO10.optional(), end: ISO10.optional() }).optional(),
  activeOnly: import_zod2.z.boolean().optional()
}).passthrough();
var EnrollmentLikeForDual = import_zod2.z.object({
  customerId: Id.optional(),
  clientId: Id.optional(),
  status: import_zod2.z.string().optional()
}).passthrough();
var EnrollmentsCheckDualQuery = import_zod2.z.object({
  enrollments: import_zod2.z.array(EnrollmentLikeForDual).min(1)
}).passthrough();
var EnrollmentsMigrateBody = import_zod2.z.object({
  enrollmentId: Id,
  toGrantId: Id,
  cutoverDate: ISO10,
  lineItemMap: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
  closeSource: import_zod2.z.boolean().optional(),
  moveSpends: import_zod2.z.boolean().optional(),
  moveTasks: import_zod2.z.boolean().optional(),
  preserveTaskIds: import_zod2.z.boolean().optional(),
  movePaidPayments: import_zod2.z.boolean().optional(),
  rebuildScheduleMeta: import_zod2.z.boolean().optional(),
  closeSourceTaskMode: import_zod2.z.enum(["complete", "delete"]).optional(),
  closeSourcePaymentMode: import_zod2.z.enum(["spendUnpaid", "deleteUnpaid", "keep"]).optional()
}).passthrough();
var EnrollmentsContinuumSummaryQuery = import_zod2.z.object({ enrollmentId: Id }).passthrough();
var EnrollmentsAllocationSetBody = import_zod2.z.object({
  enrollmentId: Id,
  amount: import_zod2.z.number().min(0).nullable(),
  note: import_zod2.z.string().trim().max(1e3).nullable().optional()
}).passthrough();
var EnrollmentsCycleRolloverPreviewBody = import_zod2.z.object({
  grantId: Id,
  cutoverDate: ISO10.optional()
}).passthrough();
var EnrollmentCycleRolloverPreviewItem = import_zod2.z.object({
  enrollmentId: Id,
  customerId: Id,
  customerName: import_zod2.z.string().nullable(),
  eligible: import_zod2.z.boolean(),
  blockers: import_zod2.z.array(import_zod2.z.string()),
  warnings: import_zod2.z.array(import_zod2.z.string()),
  futureUnpaidPayments: import_zod2.z.number().int().nonnegative(),
  futureOpenReminders: import_zod2.z.number().int().nonnegative(),
  calculatedAllocation: import_zod2.z.number().nonnegative()
});
var EnrollmentsCycleRolloverRunBody = EnrollmentsCycleRolloverPreviewBody.extend({
  enrollmentIds: import_zod2.z.array(Id).min(1).max(500).optional(),
  confirm: import_zod2.z.literal("ROLLOVER")
});
var EnrollmentsLinkedProgramsReconcileBody = import_zod2.z.object({
  grantIds: import_zod2.z.array(Id).max(50).optional(),
  dryRun: import_zod2.z.boolean().default(true)
}).passthrough();
var EnrollmentsUndoMigrationBody = import_zod2.z.object({
  migrationId: Id
}).passthrough();
var EnrollmentsAdminReverseLedgerEntryBody = import_zod2.z.object({
  ledgerId: Id,
  mode: import_zod2.z.enum(["ledger", "budget", "both"]).optional(),
  note: import_zod2.z.string().optional()
}).passthrough();

// src/formSessions.ts
var formSessions_exports = {};
__export(formSessions_exports, {
  FORM_CONTEXT_KEYS: () => FORM_CONTEXT_KEYS,
  FormPrefillSnapshot: () => FormPrefillSnapshot,
  FormRenderMode: () => FormRenderMode,
  FormSessionCompleteBody: () => FormSessionCompleteBody,
  FormSessionCreateBody: () => FormSessionCreateBody,
  FormSessionEntity: () => FormSessionEntity,
  FormSessionResolveBody: () => FormSessionResolveBody,
  FormSessionSource: () => FormSessionSource,
  FormSessionStatus: () => FormSessionStatus,
  FormSubmissionSnapshot: () => FormSubmissionSnapshot,
  FormWorkflowConfig: () => FormWorkflowConfig,
  FormWorkflowId: () => FormWorkflowId,
  WORKFLOW_CONFIGS: () => WORKFLOW_CONFIGS,
  getWorkflowConfig: () => getWorkflowConfig
});
var FormWorkflowId = import_zod2.z.enum([
  "credit-card-checkout",
  "credit-card-status",
  "customer-prefill",
  "invoice-request"
]);
var FormRenderMode = import_zod2.z.enum(["auto", "custom"]);
var FormSessionStatus = import_zod2.z.enum([
  "created",
  // session minted, not yet opened
  "opened",
  // resolved at least once by the forms surface
  "submitted",
  // a Jotform submission was linked
  "completed",
  // downstream linking/updates finished
  "expired",
  // past expiresAt
  "revoked"
  // manually revoked
]);
var FormSessionSource = import_zod2.z.enum(["main_app", "qr", "direct_link"]);
var FormWorkflowConfig = import_zod2.z.object({
  workflowId: FormWorkflowId,
  /** Jotform form id this workflow renders (empty until configured). */
  jotformFormId: import_zod2.z.string().trim().default(""),
  /** "auto" = render embedded Jotform; "custom" = use a bespoke screen. */
  mode: FormRenderMode.default("auto"),
  /** Auth model for the render link. Currently only signed (tokenized) links. */
  auth: import_zod2.z.literal("signed-link").default("signed-link"),
  /** Context ids that MUST be supplied to createFormSession for this workflow. */
  requiredContext: import_zod2.z.array(import_zod2.z.string()).default([]),
  /** Which context ids get linked onto the resulting submission. */
  linkTo: import_zod2.z.array(import_zod2.z.string()).default([]),
  /** snapshotField -> dotted source path resolved server-side at create time. */
  prefill: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).default({}),
  afterSubmit: import_zod2.z.object({
    linkJotformSubmission: import_zod2.z.boolean().default(true),
    updatePaymentQueueStatus: import_zod2.z.boolean().default(false),
    showStatusPage: import_zod2.z.boolean().default(true)
  }).default({
    linkJotformSubmission: true,
    updatePaymentQueueStatus: false,
    showStatusPage: true
  })
});
var FORM_CONTEXT_KEYS = [
  "customerId",
  "userId",
  "caseManagerId",
  "grantId",
  "paymentQueueId",
  "ledgerItemId",
  "creditCardId"
];
var WORKFLOW_CONFIGS = {
  "credit-card-checkout": {
    workflowId: "credit-card-checkout",
    jotformFormId: "",
    mode: "custom",
    auth: "signed-link",
    requiredContext: ["paymentQueueId"],
    linkTo: ["customerId", "userId", "paymentQueueId", "grantId", "creditCardId"],
    prefill: {
      customerName: "customer.fullName",
      amount: "payment.amount",
      grantName: "grant.name",
      caseManagerName: "caseManager.displayName",
      paymentMonth: "payment.month",
      vendor: "payment.merchant"
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: true,
      showStatusPage: true
    }
  },
  "credit-card-status": {
    workflowId: "credit-card-status",
    jotformFormId: "",
    mode: "custom",
    auth: "signed-link",
    requiredContext: [],
    linkTo: ["creditCardId", "userId"],
    prefill: {},
    afterSubmit: {
      linkJotformSubmission: false,
      updatePaymentQueueStatus: false,
      showStatusPage: true
    }
  },
  "customer-prefill": {
    workflowId: "customer-prefill",
    jotformFormId: "",
    mode: "auto",
    auth: "signed-link",
    requiredContext: ["customerId"],
    linkTo: ["customerId", "userId", "grantId"],
    prefill: {
      customerName: "customer.fullName",
      grantName: "grant.name",
      caseManagerName: "caseManager.displayName"
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: false,
      showStatusPage: true
    }
  },
  "invoice-request": {
    workflowId: "invoice-request",
    jotformFormId: "",
    // Embed the Invoice Requests Jotform directly (no bespoke screen needed).
    mode: "auto",
    auth: "signed-link",
    // Can be launched standalone or from an invoice queue row; nothing required.
    requiredContext: [],
    linkTo: ["customerId", "userId", "grantId", "paymentQueueId"],
    prefill: {
      customerName: "customer.fullName",
      amount: "payment.amount",
      grantName: "grant.name",
      caseManagerName: "caseManager.displayName",
      paymentMonth: "payment.month",
      vendor: "payment.merchant"
    },
    afterSubmit: {
      linkJotformSubmission: true,
      updatePaymentQueueStatus: true,
      showStatusPage: true
    }
  }
};
var FormPrefillSnapshot = import_zod2.z.object({
  customerName: import_zod2.z.string().nullish(),
  grantId: IdLike.nullish(),
  grantName: import_zod2.z.string().nullish(),
  caseManagerName: import_zod2.z.string().nullish(),
  amountCents: import_zod2.z.number().int().nullish(),
  paymentMonth: import_zod2.z.string().nullish(),
  vendor: import_zod2.z.string().nullish(),
  checkoutStatus: import_zod2.z.string().nullish(),
  cardId: IdLike.nullish(),
  cardName: import_zod2.z.string().nullish(),
  /** Current-month credit-card spend total (cents). Null = unavailable. */
  currentMonthCardSpendCents: import_zod2.z.number().int().nullable().optional(),
  monthlyLimitCents: import_zod2.z.number().int().nullable().optional()
}).passthrough();
var FormSubmissionSnapshot = import_zod2.z.object({
  jotformFormId: import_zod2.z.string().nullish(),
  jotformSubmissionId: import_zod2.z.string().nullish(),
  submittedAt: import_zod2.z.string().nullish(),
  amountCents: import_zod2.z.number().int().nullish()
}).passthrough();
var FormSessionEntity = import_zod2.z.object({
  id: Id,
  orgId: Id,
  workflowId: FormWorkflowId,
  status: FormSessionStatus,
  source: FormSessionSource,
  // Linked context (all nullable)
  customerId: Id.nullable(),
  userId: Id.nullable(),
  caseManagerId: Id.nullable(),
  grantId: Id.nullable(),
  paymentQueueId: Id.nullable(),
  ledgerItemId: Id.nullable(),
  creditCardId: Id.nullable(),
  jotformFormId: import_zod2.z.string().nullable(),
  jotformSubmissionId: import_zod2.z.string().nullable(),
  /** sha256(token). Never store the raw token. */
  tokenHash: import_zod2.z.string(),
  expiresAt: TsLike,
  prefillSnapshot: FormPrefillSnapshot.nullable(),
  submissionSnapshot: FormSubmissionSnapshot.nullable(),
  createdByUid: Id.nullable(),
  createdAt: TsLike.nullish(),
  submittedAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var FormSessionCreateBody = import_zod2.z.object({
  workflowId: FormWorkflowId,
  source: FormSessionSource.default("main_app"),
  customerId: IdLike.nullish(),
  userId: IdLike.nullish(),
  caseManagerId: IdLike.nullish(),
  grantId: IdLike.nullish(),
  paymentQueueId: IdLike.nullish(),
  ledgerItemId: IdLike.nullish(),
  creditCardId: IdLike.nullish(),
  /** Optional override; defaults to a server-side TTL. */
  ttlMinutes: import_zod2.z.coerce.number().int().min(1).max(60 * 24 * 30).optional(),
  orgId: IdLike.optional()
}).passthrough();
var FormSessionResolveBody = import_zod2.z.object({
  token: import_zod2.z.string().trim().min(8)
}).passthrough();
var FormSessionCompleteBody = import_zod2.z.object({
  token: import_zod2.z.string().trim().min(8),
  jotformSubmissionId: import_zod2.z.string().trim().nullish(),
  /** Optional normalized payload from the custom render path. */
  submission: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish()
}).passthrough();
function getWorkflowConfig(workflowId) {
  return WORKFLOW_CONFIGS[workflowId];
}

// src/gdrive.ts
var gdrive_exports = {};
__export(gdrive_exports, {
  GDRIVE_TEMPLATE_TYPES: () => GDRIVE_TEMPLATE_TYPES,
  GDriveBuildCustomerFolderBody: () => GDriveBuildCustomerFolderBody,
  GDriveConfigPatchBody: () => GDriveConfigPatchBody,
  GDriveCopyGrantTemplatesBody: () => GDriveCopyGrantTemplatesBody,
  GDriveCreateFolderBody: () => GDriveCreateFolderBody,
  GDriveCustomerFolderIndexQuery: () => GDriveCustomerFolderIndexQuery,
  GDriveCustomerFolderSyncBody: () => GDriveCustomerFolderSyncBody,
  GDriveListQuery: () => GDriveListQuery,
  GDriveUploadBody: () => GDriveUploadBody
});
var OptionalParentId = import_zod2.z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : void 0;
}, import_zod2.z.string().min(3).optional());
var GDriveCustomerFolderIndexQuery = import_zod2.z.object({
  activeParentId: OptionalParentId,
  exitedParentId: OptionalParentId
});
var OptionalDriveRef = import_zod2.z.preprocess((value) => {
  if (value == null) return value;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}, import_zod2.z.union([import_zod2.z.string(), import_zod2.z.null()]).optional());
var GDRIVE_TEMPLATE_TYPES = ["doc", "sheet", "pdf", "folder", "other"];
var GDriveTemplateVariantsSchema = import_zod2.z.object({
  payer: import_zod2.z.string().max(300).default(""),
  nonpayer: import_zod2.z.string().max(300).default("")
});
var GDriveTemplateSchema = import_zod2.z.object({
  key: import_zod2.z.string().min(1).max(100),
  // Relaxed from min(1): a variant-only template (e.g. TSS payer/non-payer)
  // carries its source ids in `variants` and may leave `fileId` empty.
  fileId: import_zod2.z.string().max(300).default(""),
  fileUrl: import_zod2.z.string().max(500).optional(),
  type: import_zod2.z.enum(GDRIVE_TEMPLATE_TYPES),
  alias: import_zod2.z.string().min(1).max(200),
  description: import_zod2.z.string().max(500).optional(),
  defaultChecked: import_zod2.z.boolean().optional(),
  variants: GDriveTemplateVariantsSchema.optional(),
  role: import_zod2.z.string().max(40).optional()
}).refine(
  (t) => t.fileId.trim().length >= 3 || !!(t.variants && (t.variants.payer.trim() || t.variants.nonpayer.trim())),
  { message: "Template requires a fileId or payer/non-payer variant file ids." }
);
var GDriveBuildSettingsSchema = import_zod2.z.object({
  defaultSubfolders: import_zod2.z.array(import_zod2.z.string().min(1).max(200)).optional(),
  defaultTemplateKeys: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
});
var GDriveConfigPatchBody = import_zod2.z.object({
  activeParent: OptionalDriveRef,
  exitedParent: OptionalDriveRef,
  customerIndexSheet: OptionalDriveRef,
  orgId: import_zod2.z.string().trim().min(1).optional(),
  templates: import_zod2.z.array(GDriveTemplateSchema).optional(),
  buildSettings: GDriveBuildSettingsSchema.optional()
});
var GDriveListQuery = import_zod2.z.object({
  folderId: import_zod2.z.string().trim().optional()
  // falls back to sandbox (if set)
});
var GDriveCreateFolderBody = import_zod2.z.object({
  parentId: import_zod2.z.string().min(3),
  name: import_zod2.z.string().min(1).max(255)
});
var GDriveUploadBody = import_zod2.z.object({
  parentId: import_zod2.z.string().min(3),
  name: import_zod2.z.string().min(1).max(255),
  contentBase64: import_zod2.z.string().min(10),
  mimeType: import_zod2.z.string().min(3).optional().default("application/pdf")
});
var GDriveBuildCustomerFolderBody = import_zod2.z.object({
  name: import_zod2.z.string().min(1).max(255),
  parentId: import_zod2.z.string().min(3),
  templates: import_zod2.z.array(import_zod2.z.object({
    fileId: import_zod2.z.string().min(3),
    name: import_zod2.z.string().min(1).max(255),
    // "tssWorkbook" flags the TSS workbook template so the build can return
    // the created file for auto-linking as the customer's workbook.
    role: import_zod2.z.string().max(40).optional()
  })).optional().default([]),
  subfolders: import_zod2.z.array(import_zod2.z.string().min(1).max(255)).optional().default([]),
  customerId: import_zod2.z.string().trim().min(1).optional(),
  // Payer/non-payer variant of the TSS workbook template being copied. Written
  // onto the auto-linked workbook metadata (AI case-note eligibility gate).
  workbookVariant: import_zod2.z.enum(["payer", "nonpayer"]).optional()
});
var GDriveCopyGrantTemplatesBody = import_zod2.z.object({
  customerId: import_zod2.z.string().trim().min(1),
  grantId: import_zod2.z.string().trim().min(1),
  enrollmentId: import_zod2.z.string().trim().optional(),
  startDate: import_zod2.z.string().trim().optional(),
  templateKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).optional(),
  createCustomerFolderIfMissing: import_zod2.z.boolean().optional().default(false),
  parentId: import_zod2.z.string().trim().min(3).optional()
});
var GDriveCustomerFolderSyncBody = import_zod2.z.object({
  mode: import_zod2.z.enum(["setFolderState", "reconcile", "folderCwIdFromCustomer", "customerCwIdFromFolder"]),
  customerId: import_zod2.z.string().trim().optional(),
  folderId: import_zod2.z.string().trim().optional(),
  active: import_zod2.z.boolean().optional(),
  direction: import_zod2.z.enum(["customer_to_folder", "folder_to_customer"]).optional(),
  apply: import_zod2.z.boolean().optional().default(false),
  onlyLinked: import_zod2.z.boolean().optional().default(false),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional().default(250)
});

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

// src/grants.ts
var grants_exports = {};
__export(grants_exports, {
  AgeOperator: () => AgeOperator,
  ConditionalTaskRule: () => ConditionalTaskRule,
  ConditionalTaskRuleType: () => ConditionalTaskRuleType,
  GRANT_PIN_COLORS: () => GRANT_PIN_COLORS,
  Grant: () => Grant,
  GrantBudget: () => GrantBudget,
  GrantBudgetBreakdownValidation: () => GrantBudgetBreakdownValidation,
  GrantBudgetDateRange: () => GrantBudgetDateRange,
  GrantBudgetDisplayLevel: () => GrantBudgetDisplayLevel,
  GrantBudgetItemDisplayConfig: () => GrantBudgetItemDisplayConfig,
  GrantBudgetLineItem: () => GrantBudgetLineItem,
  GrantBudgetRollForwardBehavior: () => GrantBudgetRollForwardBehavior,
  GrantBudgetSplitGoal: () => GrantBudgetSplitGoal,
  GrantBudgetSplitMode: () => GrantBudgetSplitMode,
  GrantBudgetTotals: () => GrantBudgetTotals,
  GrantComplianceConfig: () => GrantComplianceConfig,
  GrantComplianceControl: () => GrantComplianceControl,
  GrantCompliancePreset: () => GrantCompliancePreset,
  GrantCycleLink: () => GrantCycleLink,
  GrantDriveTemplate: () => GrantDriveTemplate,
  GrantDriveTemplateType: () => GrantDriveTemplateType,
  GrantEnrollmentDefaults: () => GrantEnrollmentDefaults,
  GrantEnrollmentLinkRule: () => GrantEnrollmentLinkRule,
  GrantEnrollmentRequirement: () => GrantEnrollmentRequirement,
  GrantEntity: () => GrantEntity,
  GrantFinancialConfig: () => GrantFinancialConfig,
  GrantFinancialConfigPatch: () => GrantFinancialConfigPatch,
  GrantFinancialModel: () => GrantFinancialModel,
  GrantInputSchema: () => GrantInputSchema,
  GrantInvoiceOption: () => GrantInvoiceOption,
  GrantInvoicing: () => GrantInvoicing,
  GrantInvoicingFrequency: () => GrantInvoicingFrequency,
  GrantKind: () => GrantKind,
  GrantLedgerMode: () => GrantLedgerMode,
  GrantLineItemCap: () => GrantLineItemCap,
  GrantLineItemInvoicing: () => GrantLineItemInvoicing,
  GrantLineItemType: () => GrantLineItemType,
  GrantLinking: () => GrantLinking,
  GrantPatchBody: () => GrantPatchBody,
  GrantPinDigest: () => GrantPinDigest,
  GrantPinImportant: () => GrantPinImportant,
  GrantPinInvoice: () => GrantPinInvoice,
  GrantPinRentalAssistance: () => GrantPinRentalAssistance,
  GrantPins: () => GrantPins,
  GrantStatus: () => GrantStatus,
  GrantTaskDefinitions: () => GrantTaskDefinitions,
  GrantUpsertBody: () => GrantUpsertBody,
  GrantsActivityQuery: () => GrantsActivityQuery,
  GrantsAdminClearEnrollmentsBody: () => GrantsAdminClearEnrollmentsBody,
  GrantsAdminClearPaymentsBody: () => GrantsAdminClearPaymentsBody,
  GrantsAdminDeleteBody: () => GrantsAdminDeleteBody,
  GrantsAdminPreviewQuery: () => GrantsAdminPreviewQuery,
  GrantsAdminReconcileBudgetBody: () => GrantsAdminReconcileBudgetBody,
  GrantsDeleteBody: () => GrantsDeleteBody,
  GrantsGetQuery: () => GrantsGetQuery,
  GrantsListQuery: () => GrantsListQuery,
  GrantsPatchBody: () => GrantsPatchBody,
  GrantsPatchRow: () => GrantsPatchRow,
  GrantsUpsertBody: () => GrantsUpsertBody,
  computeGrantLineItemOverCap: () => computeGrantLineItemOverCap,
  extractGoogleDriveFileId: () => extractGoogleDriveFileId,
  getGrantFinancialCapabilities: () => getGrantFinancialCapabilities,
  getGrantLineItemAmountSemantics: () => getGrantLineItemAmountSemantics,
  normalizeGrantComplianceConfig: () => normalizeGrantComplianceConfig,
  normalizeGrantDriveTemplates: () => normalizeGrantDriveTemplates,
  normalizeGrantFinancialConfig: () => normalizeGrantFinancialConfig,
  parseGrantMaxAssistanceMonths: () => parseGrantMaxAssistanceMonths,
  shouldRetainGrantBudget: () => shouldRetainGrantBudget,
  toArray: () => toArray
});
var GrantStatus = import_zod2.z.enum(["active", "draft", "closed", "deleted"]);
var GrantKind = import_zod2.z.enum(["grant", "program"]);
var GrantFinancialModel = import_zod2.z.enum(["budgeted", "billable", "serviceOnly"]);
var GrantLedgerMode = import_zod2.z.enum(["spendDown", "billing", "none"]);
var GrantCompliancePreset = import_zod2.z.enum(["hmisCaseworthy", "custom", "none"]);
var GrantComplianceControl = import_zod2.z.object({
  key: import_zod2.z.string().trim().min(1),
  label: import_zod2.z.string().trim().min(1),
  field: import_zod2.z.string().trim().min(1).optional(),
  type: import_zod2.z.enum(["boolean"]).default("boolean")
}).passthrough();
var GrantComplianceConfig = import_zod2.z.object({
  preset: GrantCompliancePreset.nullable().optional(),
  active: import_zod2.z.array(GrantComplianceControl).optional(),
  inactive: import_zod2.z.array(GrantComplianceControl).optional()
}).passthrough();
var GrantDriveTemplateType = import_zod2.z.enum(["doc", "sheet", "pdf", "other"]);
var DIRECT_DRIVE_ID_RE = /^[-\w]{20,}$/;
function extractGoogleDriveFileId(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  const byDoc = text.match(/\/document\/d\/([-\w]{20,})/i)?.[1];
  const bySheet = text.match(/\/spreadsheets\/d\/([-\w]{20,})/i)?.[1];
  const byFile = text.match(/\/file\/d\/([-\w]{20,})/i)?.[1];
  const byPresentation = text.match(/\/presentation\/d\/([-\w]{20,})/i)?.[1];
  const byOpen = text.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byDoc || bySheet || byFile || byPresentation || byOpen) {
    return byDoc || bySheet || byFile || byPresentation || byOpen || "";
  }
  return DIRECT_DRIVE_ID_RE.test(text) ? text : "";
}
function inferDriveTemplateType(input) {
  const text = String(input || "").toLowerCase();
  if (text.includes("/document/")) return "doc";
  if (text.includes("/spreadsheets/")) return "sheet";
  if (text.includes(".pdf") || text.includes("application/pdf")) return "pdf";
  return "other";
}
function normalizeGrantDriveTemplateInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value;
  const fileUrl = String(raw.fileUrl || raw.url || "").trim();
  const rawFileId = String(raw.fileId || raw.id || "").trim();
  const fileId = extractGoogleDriveFileId(rawFileId) || extractGoogleDriveFileId(fileUrl);
  return {
    ...raw,
    key: String(raw.key || fileId || rawFileId || raw.label || "").trim(),
    label: String(raw.label || raw.name || raw.key || "Template").trim(),
    fileId,
    fileUrl: fileUrl || (rawFileId && rawFileId !== fileId ? rawFileId : raw.fileUrl),
    type: raw.type || inferDriveTemplateType(fileUrl || rawFileId)
  };
}
var GrantDriveTemplate = import_zod2.z.preprocess(
  normalizeGrantDriveTemplateInput,
  import_zod2.z.object({
    key: import_zod2.z.string().trim().min(1).max(100),
    label: import_zod2.z.string().trim().min(1).max(200),
    fileId: import_zod2.z.string().trim().min(3).max(300),
    fileUrl: import_zod2.z.string().trim().max(800).nullish(),
    type: GrantDriveTemplateType.optional().default("other"),
    description: import_zod2.z.string().trim().max(500).nullish(),
    defaultChecked: import_zod2.z.boolean().optional().default(true)
  }).passthrough()
);
function normalizeGrantDriveTemplates(input) {
  const rows = Array.isArray(input) ? input : [];
  return rows.map((row) => GrantDriveTemplate.safeParse(row)).filter((result) => result.success).map((result) => result.data);
}
var GrantFinancialConfig = import_zod2.z.object({
  model: GrantFinancialModel,
  budgetEnabled: import_zod2.z.boolean(),
  billingEnabled: import_zod2.z.boolean(),
  allocationEnabled: import_zod2.z.boolean(),
  ledgerEnabled: import_zod2.z.boolean(),
  ledgerMode: GrantLedgerMode
}).passthrough();
var GrantFinancialConfigPatch = GrantFinancialConfig.partial().passthrough();
var FINANCIAL_CONFIG_DEFAULTS = {
  budgeted: {
    model: "budgeted",
    budgetEnabled: true,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: true,
    ledgerMode: "spendDown"
  },
  billable: {
    model: "billable",
    budgetEnabled: false,
    billingEnabled: true,
    allocationEnabled: false,
    ledgerEnabled: true,
    ledgerMode: "billing"
  },
  serviceOnly: {
    model: "serviceOnly",
    budgetEnabled: false,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: false,
    ledgerMode: "none"
  }
};
var HMIS_CASEWORTHY_COMPLIANCE_CONFIG = {
  preset: "hmisCaseworthy",
  active: [
    {
      key: "caseworthyEntryComplete",
      label: "CW Entry",
      field: "compliance.caseworthyEntryComplete",
      type: "boolean"
    },
    {
      key: "hmisEntryComplete",
      label: "HMIS Entry",
      field: "compliance.hmisEntryComplete",
      type: "boolean"
    }
  ],
  inactive: [
    {
      key: "caseworthyExitComplete",
      label: "CW Exit",
      field: "compliance.caseworthyExitComplete",
      type: "boolean"
    },
    {
      key: "hmisExitComplete",
      label: "HMIS Exit",
      field: "compliance.hmisExitComplete",
      type: "boolean"
    }
  ]
};
function normalizeComplianceControl(value) {
  if (!isPlainObject(value)) return null;
  const key = String(value.key || "").trim();
  const label = String(value.label || key).trim();
  if (!key || !label) return null;
  const field = String(value.field || `compliance.${key}`).trim();
  return {
    ...value,
    key,
    label,
    field,
    type: "boolean"
  };
}
function normalizeComplianceControls(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeComplianceControl(entry)).filter((entry) => !!entry);
}
function grantKindOf(value) {
  return String(value?.kind || "").trim().toLowerCase() === "program" ? "program" : "grant";
}
function parseFinancialModel(value) {
  const parsed = GrantFinancialModel.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function parseLedgerMode(value) {
  const parsed = GrantLedgerMode.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function parseCompliancePreset(value) {
  const parsed = GrantCompliancePreset.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function normalizeGrantFinancialConfig(grant) {
  const raw = isPlainObject(grant?.financialConfig) ? grant.financialConfig : {};
  const legacyAllocationEnabled = isPlainObject(grant?.budget) && grant.budget.allocationEnabled === true;
  const fallbackModel = grantKindOf(grant) === "grant" ? "budgeted" : "serviceOnly";
  const model = parseFinancialModel(raw.model) ?? fallbackModel;
  const defaults = FINANCIAL_CONFIG_DEFAULTS[model];
  const rawLedgerMode = parseLedgerMode(raw.ledgerMode);
  const next = {
    ...defaults,
    model,
    budgetEnabled: typeof raw.budgetEnabled === "boolean" ? raw.budgetEnabled : defaults.budgetEnabled,
    billingEnabled: typeof raw.billingEnabled === "boolean" ? raw.billingEnabled : defaults.billingEnabled,
    allocationEnabled: typeof raw.allocationEnabled === "boolean" ? raw.allocationEnabled : legacyAllocationEnabled || defaults.allocationEnabled,
    ledgerEnabled: typeof raw.ledgerEnabled === "boolean" ? raw.ledgerEnabled : defaults.ledgerEnabled,
    ledgerMode: rawLedgerMode ?? defaults.ledgerMode
  };
  if (next.ledgerMode === "none") next.ledgerEnabled = false;
  if (!next.ledgerEnabled) next.ledgerMode = "none";
  return next;
}
function normalizeGrantComplianceConfig(grant) {
  const raw = isPlainObject(grant?.complianceConfig) ? grant.complianceConfig : {};
  const preset = parseCompliancePreset(raw.preset) ?? "hmisCaseworthy";
  if (preset === "none") {
    return {
      ...raw,
      preset: "none",
      active: normalizeComplianceControls(raw.active),
      inactive: normalizeComplianceControls(raw.inactive)
    };
  }
  if (preset === "hmisCaseworthy" && !Array.isArray(raw.active) && !Array.isArray(raw.inactive)) {
    return HMIS_CASEWORTHY_COMPLIANCE_CONFIG;
  }
  return {
    ...raw,
    preset,
    active: normalizeComplianceControls(raw.active),
    inactive: normalizeComplianceControls(raw.inactive)
  };
}
function getGrantFinancialCapabilities(grant) {
  const config = normalizeGrantFinancialConfig(grant);
  const ledgerEnabled = config.ledgerEnabled && config.ledgerMode !== "none";
  const budgetEnabled = config.budgetEnabled;
  const billingEnabled = config.billingEnabled;
  const allocationEnabled = config.allocationEnabled;
  const drawsDownBudget = ledgerEnabled && config.ledgerMode === "spendDown" && budgetEnabled;
  const usesBillingLedger = ledgerEnabled && config.ledgerMode === "billing";
  return {
    config,
    budgetEnabled,
    billingEnabled,
    allocationEnabled,
    ledgerEnabled,
    ledgerMode: config.ledgerMode,
    drawsDownBudget,
    usesBillingLedger,
    hasFinancialActivity: budgetEnabled || billingEnabled || allocationEnabled || ledgerEnabled
  };
}
function shouldRetainGrantBudget(grant) {
  return getGrantFinancialCapabilities(grant).hasFinancialActivity;
}
function getGrantLineItemAmountSemantics(grant) {
  const capabilities = getGrantFinancialCapabilities(grant);
  const amountIsBudgetAllocation = capabilities.drawsDownBudget;
  return {
    drawsDownBudget: capabilities.drawsDownBudget,
    amountIsBudgetAllocation,
    amountIsBillingReference: capabilities.usesBillingLedger && !amountIsBudgetAllocation,
    amountCreatesOverCap: amountIsBudgetAllocation
  };
}
function computeGrantLineItemOverCap(grant, lineItem) {
  if (!getGrantLineItemAmountSemantics(grant).amountCreatesOverCap) return null;
  const amount = Number(lineItem?.amount || 0);
  const spent = Number(lineItem?.spent || 0);
  const projected = Number(lineItem?.projected || 0);
  if (!Number.isFinite(amount) || !Number.isFinite(spent) || !Number.isFinite(projected)) {
    return null;
  }
  const over = Math.max(0, spent + projected - amount);
  return over > 0 ? over : null;
}
var Num2 = import_zod2.z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var NullablePositiveInt = import_zod2.z.coerce.number().int().min(1).max(240).nullable();
function parseGrantMaxAssistanceMonths(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1) return null;
    return Math.max(1, Math.min(240, Math.floor(value)));
  }
  const text = String(value || "").trim();
  if (!text) return null;
  const direct = Number(text);
  if (Number.isFinite(direct) && direct >= 1) {
    return Math.max(1, Math.min(240, Math.floor(direct)));
  }
  const match = text.match(/(\d{1,3})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.max(1, Math.min(240, Math.floor(parsed)));
}
var GrantLineItemTypeInput = import_zod2.z.preprocess((v) => {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || ["na", "n/a", "none", "null"].includes(s.toLowerCase())) return null;
    return { label: s };
  }
  if (typeof v === "object") {
    const o = v;
    const raw = String(o.label ?? o.name ?? o.id ?? "").trim();
    if (!raw || ["na", "n/a", "none", "null"].includes(raw.toLowerCase())) return null;
    if (!o.label) return { ...o, label: raw };
  }
  return v;
}, import_zod2.z.object({
  id: import_zod2.z.string().trim().min(1).optional(),
  label: import_zod2.z.string().trim().min(1)
}).passthrough().nullable());
var GrantLineItemType = GrantLineItemTypeInput;
var GrantLineItemCap = import_zod2.z.object({
  /** Hard cap (USD) per enrolled customer for this line item. null = no cap. */
  perCustomerCap: import_zod2.z.number().min(0).nullish(),
  /** Whether the cap is actively enforced (shows warnings / blocks posting when exceeded). */
  capEnabled: import_zod2.z.boolean().default(false)
}).passthrough();
var GrantBudgetSplitMode = import_zod2.z.enum(["none", "fixed", "monthly", "quarterly", "custom"]);
var GrantBudgetRollForwardBehavior = import_zod2.z.enum([
  "none",
  "rollToNext",
  "rollToEnd",
  "rebalanceFuture",
  "manual"
]);
var GrantBudgetDisplayLevel = import_zod2.z.enum(["grant", "lineItem", "split"]);
var GrantBudgetDateRange = import_zod2.z.object({
  startDate: import_zod2.z.string().trim().nullish(),
  endDate: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantBudgetSplitGoal = import_zod2.z.object({
  id: import_zod2.z.string().trim().min(1).optional(),
  label: import_zod2.z.string().trim().nullish(),
  startDate: import_zod2.z.string().trim().nullish(),
  endDate: import_zod2.z.string().trim().nullish(),
  amount: Num2,
  spent: Num2.optional(),
  projected: Num2.optional(),
  balance: Num2.optional(),
  projectedBalance: Num2.optional(),
  includeAllBudgetItems: import_zod2.z.boolean().optional(),
  notes: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantBudgetItemDisplayConfig = import_zod2.z.object({
  /** Budget card cycle presentation. Missing values preserve the legacy total view. */
  cycleDisplayMode: import_zod2.z.enum(["split", "total"]).optional(),
  /** Explicit digest participation. `appearInDigest` remains a legacy read alias. */
  displayOnDigest: import_zod2.z.boolean().optional(),
  digestDisplayMode: import_zod2.z.enum(["currentCycle", "total", "both"]).optional(),
  showGrantTotal: import_zod2.z.boolean().optional(),
  showLineItemTotal: import_zod2.z.boolean().optional(),
  showSplitGoals: import_zod2.z.boolean().optional(),
  appearInDigest: import_zod2.z.boolean().optional(),
  displayAs: import_zod2.z.enum(["main", "nested"]).optional(),
  mainDisplayLevel: GrantBudgetDisplayLevel.optional(),
  groupUnderParentGrant: import_zod2.z.boolean().optional(),
  expandedByDefault: import_zod2.z.boolean().optional()
}).passthrough();
var GrantBudgetBreakdownValidation = import_zod2.z.object({
  status: import_zod2.z.enum(["ok", "warning"]).default("ok"),
  message: import_zod2.z.string().trim().optional(),
  splitTotal: Num2.optional(),
  variance: Num2.optional()
}).passthrough();
var GrantInvoiceOption = import_zod2.z.object({
  id: import_zod2.z.string().trim().min(1),
  label: import_zod2.z.string().trim().min(1),
  code: import_zod2.z.string().trim().nullish(),
  template: import_zod2.z.string().trim().nullish(),
  enabled: import_zod2.z.boolean().optional(),
  custom: import_zod2.z.boolean().optional()
}).passthrough();
var GrantLineItemInvoicing = import_zod2.z.object({
  functionalGroup: import_zod2.z.string().trim().nullish(),
  grantCode: import_zod2.z.string().trim().nullish(),
  programCode: import_zod2.z.string().trim().nullish(),
  hmisCode: import_zod2.z.string().trim().nullish(),
  expenseCategories: import_zod2.z.array(GrantInvoiceOption).nullish(),
  descriptionTemplates: import_zod2.z.array(GrantInvoiceOption).nullish()
}).passthrough();
var GrantBudgetLineItem = import_zod2.z.object({
  id: Id.optional(),
  // server fills if missing
  label: import_zod2.z.string().trim().nullish(),
  amount: Num2,
  projected: Num2,
  spent: Num2,
  projectedInWindow: Num2.optional(),
  spentInWindow: Num2.optional(),
  locked: import_zod2.z.boolean().nullish(),
  /**
   * Open line-item grouping object for reporting across grants.
   * null = uncategorized / N/A. Frontend can add new categories by writing
   * any { id, label } pair; current defaults include Rental Assistance,
   * Program Spending, and Customer Support Service.
   */
  type: GrantLineItemType.nullish(),
  // ── Per-customer cap (optional) ──────────────────────────────────────────
  /** USD cap per enrolled customer on this line item. Only enforced if capEnabled. */
  perCustomerCap: import_zod2.z.number().min(0).nullish(),
  capEnabled: import_zod2.z.boolean().default(false),
  /**
   * Optional planning breakdown under this line item. The line-item amount
   * remains the budget source of truth; split goals are planning windows.
   */
  splitMode: GrantBudgetSplitMode.optional().default("none"),
  rollForward: GrantBudgetRollForwardBehavior.optional().default("none"),
  splitStartDate: import_zod2.z.string().trim().nullish(),
  splitEndDate: import_zod2.z.string().trim().nullish(),
  splitGoals: import_zod2.z.array(GrantBudgetSplitGoal).optional().default([]),
  display: GrantBudgetItemDisplayConfig.nullish(),
  breakdownValidation: GrantBudgetBreakdownValidation.nullish(),
  /** Invoice metadata for this line item. Grant-level invoicing remains legacy read compatibility. */
  invoicing: GrantLineItemInvoicing.nullish()
}).passthrough();
var GrantBudgetTotals = import_zod2.z.object({
  total: Num2,
  projected: Num2,
  spent: Num2,
  balance: Num2.optional(),
  projectedBalance: Num2.optional(),
  /** spent + projected — total dollars allocated (committed + future obligations) */
  projectedSpend: Num2.optional(),
  // compat alias (service writes this)
  remaining: Num2.optional(),
  projectedInWindow: Num2.optional(),
  spentInWindow: Num2.optional(),
  windowBalance: Num2.optional(),
  windowProjectedBalance: Num2.optional()
}).passthrough();
var GrantBudget = import_zod2.z.object({
  total: Num2,
  totals: GrantBudgetTotals.nullish(),
  lineItems: import_zod2.z.array(GrantBudgetLineItem).default([]),
  digestDisplay: import_zod2.z.object({
    showOverallSummary: import_zod2.z.boolean().optional().default(true),
    showGrantTotals: import_zod2.z.boolean().optional().default(true),
    mainDisplayLevel: GrantBudgetDisplayLevel.optional().default("grant"),
    expandNestedRowsByDefault: import_zod2.z.boolean().optional().default(false),
    groupChildrenUnderParentGrant: import_zod2.z.boolean().optional().default(true)
  }).passthrough().nullish(),
  /**
   * When true, this grant/program tracks per-customer allocations and shows
   * the Allocation tab on budget cards and grant detail.
   */
  allocationEnabled: import_zod2.z.boolean().optional(),
  /**
   * Optional grant-level cap per customer (USD across all line items).
   * null = no grant-level cap (line items may still have their own caps).
   */
  perCustomerCap: import_zod2.z.number().min(0).nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var ConditionalTaskRuleType = import_zod2.z.enum(["age", "population", "concurrent_enrollment"]);
var AgeOperator = import_zod2.z.enum([">=", "<=", ">", "<"]);
var ConditionalTaskRule = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  /** Human-readable description of this rule (e.g. "Under 18 — youth compliance") */
  name: import_zod2.z.string().trim().min(1),
  type: ConditionalTaskRuleType,
  // ── Age condition ────────────────────────────────────────────────────────
  /** Comparison operator applied to the enrollee's age in years */
  ageOperator: AgeOperator.optional(),
  /** Age threshold in years */
  ageThreshold: import_zod2.z.number().int().min(0).optional(),
  // ── Concurrent-enrollment condition ──────────────────────────────────────
  /**
   * Grant name (or substring) to match in the enrollee's other active
   * enrollments on the start date.  Case-insensitive substring match.
   */
  programName: import_zod2.z.string().trim().optional(),
  /** Match against customer/enrollment population. Accepts Youth, Individual, or Family. */
  population: import_zod2.z.enum(["Youth", "Individual", "Family"]).optional(),
  populations: import_zod2.z.array(import_zod2.z.enum(["Youth", "Individual", "Family"])).optional(),
  // ── Task definition ──────────────────────────────────────────────────────
  taskName: import_zod2.z.string().trim().min(1),
  taskDescription: import_zod2.z.string().trim().nullish(),
  taskBucket: import_zod2.z.string().trim().default("task"),
  /** Days from enrollment.startDate until the task is due. null → due on start date. */
  dueOffsetDays: import_zod2.z.number().int().nullish(),
  assignToGroup: import_zod2.z.enum(["admin", "compliance", "casemanager"]).default("casemanager"),
  taskNotes: import_zod2.z.string().trim().nullish(),
  /** Optional recurrence for condition-created reminders. Defaults to one-off. */
  kind: import_zod2.z.enum(["one-off", "recurring"]).optional(),
  frequency: import_zod2.z.string().trim().nullish(),
  every: import_zod2.z.number().int().min(1).nullish(),
  dueDate: import_zod2.z.string().trim().nullish(),
  endDate: import_zod2.z.string().trim().nullish(),
  notify: import_zod2.z.boolean().optional()
}).passthrough();
var GrantTaskDefinitions = import_zod2.z.union([
  import_zod2.z.array(import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown())),
  import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown())
]);
var GRANT_PIN_COLORS = ["red", "amber", "emerald", "sky", "violet", "rose", "orange"];
var GrantPinImportant = import_zod2.z.object({
  enabled: import_zod2.z.boolean().default(false),
  label: import_zod2.z.string().trim().nullish(),
  color: import_zod2.z.enum(GRANT_PIN_COLORS).nullish(),
  note: import_zod2.z.string().trim().nullish(),
  pinnedAt: TsLike.nullish(),
  pinnedBy: import_zod2.z.string().trim().nullish(),
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish()
}).passthrough();
var GrantPinDigest = import_zod2.z.object({
  enabled: import_zod2.z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantPinRentalAssistance = import_zod2.z.object({
  enabled: import_zod2.z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantPinInvoice = import_zod2.z.object({
  enabled: import_zod2.z.boolean().default(false),
  pinnedAt: TsLike.nullish(),
  pinnedBy: import_zod2.z.string().trim().nullish(),
  label: import_zod2.z.string().trim().nullish(),
  note: import_zod2.z.string().trim().nullish()
}).passthrough();
var GrantPins = import_zod2.z.object({
  // System pins
  digest: GrantPinDigest.nullish(),
  rentalAssistance: GrantPinRentalAssistance.nullish(),
  invoice: GrantPinInvoice.nullish(),
  // Legacy
  important: GrantPinImportant.nullish()
}).passthrough();
var GrantInvoicingFrequency = import_zod2.z.enum(["monthly", "quarterly", "annually", "on-demand"]);
var GrantInvoicing = import_zod2.z.object({
  /** Grant identifier used on invoices / reimbursement requests */
  grantCode: import_zod2.z.string().trim().nullish(),
  /** Functional group used by invoice/payment exports */
  functionalGroup: import_zod2.z.string().trim().nullish(),
  /** Expense category options this grant can surface in invoice/payment workflows */
  expenseCategories: import_zod2.z.array(GrantInvoiceOption).nullish(),
  /** Description templates this grant can surface in invoice/payment workflows */
  descriptionTemplates: import_zod2.z.array(GrantInvoiceOption).nullish(),
  /** Separate invoice code if the invoicing code differs from the grant code */
  invoiceCode: import_zod2.z.string().trim().nullish(),
  /** Program or funding-source code (e.g. federal program code) */
  programCode: import_zod2.z.string().trim().nullish(),
  /** Contract number with the funder */
  contractNumber: import_zod2.z.string().trim().nullish(),
  /** Vendor or supplier number assigned by the funder */
  vendorNumber: import_zod2.z.string().trim().nullish(),
  /** Name of the funder / grantor agency */
  funder: import_zod2.z.string().trim().nullish(),
  /** Primary contact name at the funder for invoicing */
  funderContact: import_zod2.z.string().trim().nullish(),
  /** Funder contact email */
  funderEmail: import_zod2.z.string().trim().nullish(),
  /** How often invoices are submitted */
  frequency: GrantInvoicingFrequency.nullish(),
  /** Day of month the invoice is due (1–28) */
  dueDayOfMonth: import_zod2.z.number().int().min(1).max(28).nullish(),
  /** Payment terms (e.g. "Net 30", "Net 60") */
  paymentTerms: import_zod2.z.string().trim().nullish(),
  /** Billing address (free-form) */
  billingAddress: import_zod2.z.string().trim().nullish(),
  /** Submission portal URL or platform name */
  submissionPortal: import_zod2.z.string().trim().nullish(),
  /** Reporting requirements or schedule */
  reportingNotes: import_zod2.z.string().trim().nullish(),
  /** General invoicing notes */
  notes: import_zod2.z.string().trim().nullish(),
  /** Open-ended meta for org-specific invoicing fields */
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish()
}).passthrough();
var GrantEnrollmentDefaults = import_zod2.z.object({
  authorizationMonths: import_zod2.z.number().int().min(1).max(120).nullable().optional(),
  serviceStatus: import_zod2.z.enum(["active", "paused"]).nullable().optional(),
  medicaidStatus: import_zod2.z.enum(["active", "closed"]).nullable().optional()
}).passthrough();
var GrantCycleLink = import_zod2.z.object({
  previousGrantId: Id.nullable().optional(),
  nextGrantId: Id.nullable().optional()
}).passthrough();
var GrantEnrollmentLinkRule = import_zod2.z.object({
  targetGrantId: Id,
  onEnroll: import_zod2.z.literal("ensureActive").default("ensureActive"),
  onAllSourcesClosed: import_zod2.z.literal("flagShouldUnenroll").default("flagShouldUnenroll")
}).passthrough();
var GrantEnrollmentRequirement = import_zod2.z.object({
  operator: import_zod2.z.enum(["all", "any"]).default("all"),
  targetGrantIds: import_zod2.z.array(Id).min(1).max(20),
  behavior: import_zod2.z.literal("warnOnly").default("warnOnly")
}).passthrough();
var GrantLinking = import_zod2.z.object({
  cycle: GrantCycleLink.nullish(),
  /** Enrollment eligibility requirement. Consumers surface warnings only. */
  enrollmentRequirement: GrantEnrollmentRequirement.nullish(),
  /** Legacy enrollment automation rules retained for read compatibility. */
  enrollmentRules: import_zod2.z.array(GrantEnrollmentLinkRule).max(20).default([])
}).passthrough();
var GrantInputSchema = import_zod2.z.object({
  id: Id.optional(),
  name: import_zod2.z.string().trim().min(1),
  status: GrantStatus.optional(),
  active: import_zod2.z.boolean().optional(),
  // server-derived
  deleted: import_zod2.z.boolean().optional(),
  // server-derived
  // server authoritative (but accepted for dev/explicit org targeting)
  orgId: Id.nullish(),
  kind: GrantKind.optional(),
  financialConfig: GrantFinancialConfigPatch.nullish(),
  duration: import_zod2.z.string().trim().nullish().default("1 Year"),
  lengthOfAssistance: import_zod2.z.string().trim().nullish(),
  maxAssistanceMonths: NullablePositiveInt.nullish(),
  // Date | Timestamp | ISO string; server normalizes
  startDate: import_zod2.z.unknown().optional(),
  endDate: import_zod2.z.unknown().optional(),
  // Only allowed when kind="grant" (service enforces)
  budget: GrantBudget.nullish(),
  taskTypes: import_zod2.z.array(import_zod2.z.string().trim()).nullish(),
  tasks: GrantTaskDefinitions.nullish(),
  complianceConfig: GrantComplianceConfig.nullish(),
  driveTemplates: import_zod2.z.array(GrantDriveTemplate).nullish(),
  /** Conditional task rules evaluated on each new enrollment. */
  conditionalTaskRules: import_zod2.z.array(ConditionalTaskRule).nullish(),
  /**
   * Org-visible pins on the grant object itself. Distinct from user-level
   * dashboard/favorite pins (those live in userExtras).
   */
  pins: GrantPins.nullish(),
  /** Optional invoicing metadata: codes, funder contacts, billing details. */
  invoicing: GrantInvoicing.nullish(),
  /** Optional enrollment defaults such as TSS authorization windows. */
  enrollmentDefaults: GrantEnrollmentDefaults.nullish(),
  /** Explicit lifecycle links. Navigation-only related* fields below do not drive automation. */
  linking: GrantLinking.nullish(),
  /** Optional documents expected for payment/invoice processing. */
  invoiceDocuments: import_zod2.z.array(import_zod2.z.string().trim()).nullish(),
  /** Optional internal guidance mapping assistance levels to eligibility criteria. */
  levelOfAssistance: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).nullish(),
  /**
   * Optional relationship hints for reporting/navigation.
   * These are not required for enrollment; enrollments still use grantId/grantName.
   */
  programIds: import_zod2.z.array(IdLike).nullish(),
  fundingGrantIds: import_zod2.z.array(IdLike).nullish(),
  relatedProgramIds: import_zod2.z.array(IdLike).nullish(),
  relatedGrantIds: import_zod2.z.array(IdLike).nullish(),
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var Grant = GrantInputSchema;
var GrantEntity = GrantInputSchema.extend({
  id: Id
}).passthrough();
function stripPatchServerFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const row = { ...value };
  const rawPatch = row.patch;
  if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) return row;
  const patch = { ...rawPatch };
  delete patch.createdAt;
  delete patch.updatedAt;
  delete patch.deletedAt;
  delete patch.active;
  delete patch.deleted;
  delete patch._tags;
  delete patch.system;
  if (patch.budget && typeof patch.budget === "object" && !Array.isArray(patch.budget)) {
    const budget = { ...patch.budget };
    delete budget.createdAt;
    delete budget.updatedAt;
    patch.budget = budget;
  }
  row.patch = patch;
  return row;
}
function stripGrantServerFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const grant = { ...value };
  delete grant.createdAt;
  delete grant.updatedAt;
  delete grant.deletedAt;
  delete grant.active;
  delete grant.deleted;
  delete grant._tags;
  delete grant.system;
  if (grant.budget && typeof grant.budget === "object" && !Array.isArray(grant.budget)) {
    const budget = { ...grant.budget };
    delete budget.createdAt;
    delete budget.updatedAt;
    grant.budget = budget;
  }
  return grant;
}
var GrantsUpsertBody = import_zod2.z.union([
  import_zod2.z.preprocess(stripGrantServerFields, GrantInputSchema),
  import_zod2.z.array(import_zod2.z.preprocess(stripGrantServerFields, GrantInputSchema)).min(1)
]);
var GrantUpsertBody = GrantsUpsertBody;
var GrantsPatchRow = import_zod2.z.preprocess(
  stripPatchServerFields,
  import_zod2.z.object({
    id: Id,
    patch: GrantInputSchema.partial().passthrough(),
    unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
  }).passthrough()
).refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var GrantsPatchBody = import_zod2.z.union([
  GrantsPatchRow,
  import_zod2.z.array(GrantsPatchRow).min(1)
]);
var GrantPatchBody = GrantsPatchBody;
var GrantsDeleteBody = import_zod2.z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  import_zod2.z.union([IdLike, import_zod2.z.array(IdLike).min(1)])
);
var GrantsAdminDeleteBody = GrantsDeleteBody;
var ActiveFilter3 = import_zod2.z.preprocess(
  (v) => {
    if (v === "" || v == null) return void 0;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
    if (Array.isArray(v)) return v[0];
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "y", "active"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
    }
    return v;
  },
  import_zod2.z.union([import_zod2.z.literal(true), import_zod2.z.literal(false)])
);
var GrantsListQuery = import_zod2.z.object({
  status: import_zod2.z.string().trim().optional(),
  active: import_zod2.z.union([ActiveFilter3, BoolLike, import_zod2.z.string()]).optional(),
  kind: import_zod2.z.union([GrantKind, import_zod2.z.string()]).optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  // dev explicit org targeting (matches handler behavior)
  orgId: IdLike.optional()
}).passthrough();
var GrantsGetQuery = import_zod2.z.object({ id: IdLike, orgId: IdLike.optional() }).passthrough();
var GrantsActivityQuery = import_zod2.z.object({
  grantId: IdLike,
  limit: import_zod2.z.coerce.number().int().min(1).max(1e3).optional(),
  cursor: import_zod2.z.string().trim().optional(),
  includeProjected: import_zod2.z.union([BoolLike, import_zod2.z.string()]).optional(),
  orgId: IdLike.optional()
}).passthrough();
var GrantsAdminPreviewQuery = import_zod2.z.object({ grantId: IdLike });
var GrantsAdminClearPaymentsBody = import_zod2.z.object({
  grantId: IdLike,
  confirm: import_zod2.z.literal("DELETE")
});
var GrantsAdminClearEnrollmentsBody = import_zod2.z.object({
  grantId: IdLike,
  confirm: import_zod2.z.literal("DELETE"),
  statuses: import_zod2.z.array(import_zod2.z.enum(["active", "inactive", "deleted"])).min(1).optional()
});
var GrantsAdminReconcileBudgetBody = import_zod2.z.object({
  grantId: IdLike
});

// src/grantBudgetManager.ts
var grantBudgetManager_exports = {};
__export(grantBudgetManager_exports, {
  GrantBudgetManagerLineItem: () => GrantBudgetManagerLineItem,
  GrantBudgetManagerLoadBody: () => GrantBudgetManagerLoadBody,
  GrantBudgetManagerOriginal: () => GrantBudgetManagerOriginal,
  GrantBudgetManagerReconcileBody: () => GrantBudgetManagerReconcileBody,
  GrantBudgetManagerRollup: () => GrantBudgetManagerRollup,
  GrantBudgetManagerRow: () => GrantBudgetManagerRow,
  GrantBudgetManagerSaveBody: () => GrantBudgetManagerSaveBody,
  GrantBudgetManagerSaveMode: () => GrantBudgetManagerSaveMode,
  GrantBudgetManagerSourceType: () => GrantBudgetManagerSourceType
});
var GrantBudgetManagerSourceType = import_zod2.z.enum(["ledger", "paymentQueue", "newProjection"]);
var GrantBudgetManagerSaveMode = import_zod2.z.enum(["preview", "applyOpen", "applyAll"]);
var GrantBudgetManagerOriginal = import_zod2.z.object({
  grantId: import_zod2.z.string().nullable().optional(),
  lineItemId: import_zod2.z.string().nullable().optional(),
  customerId: import_zod2.z.string().nullable().optional(),
  caseManagerId: import_zod2.z.string().nullable().optional(),
  amount: import_zod2.z.number().nullable().optional(),
  date: import_zod2.z.string().nullable().optional(),
  serviceDate: import_zod2.z.string().nullable().optional(),
  paymentDate: import_zod2.z.string().nullable().optional(),
  description: import_zod2.z.string().nullable().optional(),
  memo: import_zod2.z.string().nullable().optional(),
  category: import_zod2.z.string().nullable().optional(),
  vendor: import_zod2.z.string().nullable().optional(),
  status: import_zod2.z.string().nullable().optional(),
  updatedAt: import_zod2.z.string().nullable().optional()
}).passthrough();
var GrantBudgetManagerRow = import_zod2.z.object({
  rowId: import_zod2.z.string().min(1),
  sourceType: GrantBudgetManagerSourceType,
  sourceId: import_zod2.z.string().optional().default(""),
  ledgerItemId: import_zod2.z.string().nullable().optional(),
  paymentQueueItemId: import_zod2.z.string().nullable().optional(),
  enrollmentId: import_zod2.z.string().nullable().optional(),
  paymentId: import_zod2.z.string().nullable().optional(),
  rentCertDueOn: import_zod2.z.string().nullable().optional(),
  grantId: import_zod2.z.string().min(1),
  lineItemId: import_zod2.z.string().nullable().optional(),
  customerId: import_zod2.z.string().nullable().optional(),
  customerName: import_zod2.z.string().nullable().optional(),
  caseManagerId: import_zod2.z.string().nullable().optional(),
  caseManagerName: import_zod2.z.string().nullable().optional(),
  amount: import_zod2.z.coerce.number(),
  date: import_zod2.z.string().nullable().optional(),
  serviceDate: import_zod2.z.string().nullable().optional(),
  paymentDate: import_zod2.z.string().nullable().optional(),
  description: import_zod2.z.string().nullable().optional(),
  memo: import_zod2.z.string().nullable().optional(),
  category: import_zod2.z.string().nullable().optional(),
  vendor: import_zod2.z.string().nullable().optional(),
  status: import_zod2.z.string().nullable().optional(),
  reversalOf: import_zod2.z.string().nullable().optional(),
  reversedByLedgerItemIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  isWritable: import_zod2.z.boolean().optional().default(false),
  lockedReason: import_zod2.z.string().nullable().optional(),
  rowState: import_zod2.z.enum(["clean", "changed", "new", "deleted"]).optional().default("clean"),
  original: GrantBudgetManagerOriginal.optional()
}).passthrough();
var GrantBudgetManagerLineItem = import_zod2.z.object({
  grantId: import_zod2.z.string(),
  id: import_zod2.z.string(),
  label: import_zod2.z.string(),
  typeLabel: import_zod2.z.string().optional().default(""),
  budget: import_zod2.z.number().optional().default(0),
  locked: import_zod2.z.boolean().optional().default(false)
});
var GrantBudgetManagerRollup = import_zod2.z.object({
  grantId: import_zod2.z.string(),
  lineItemId: import_zod2.z.string().nullable().optional(),
  budget: import_zod2.z.number().default(0),
  spent: import_zod2.z.number().default(0),
  projected: import_zod2.z.number().default(0),
  total: import_zod2.z.number().default(0),
  remaining: import_zod2.z.number().default(0)
});
var GrantBudgetManagerLoadBody = import_zod2.z.object({
  grantIds: import_zod2.z.array(import_zod2.z.string().min(1)).min(1).max(50)
});
var GrantBudgetManagerSaveBody = import_zod2.z.object({
  mode: GrantBudgetManagerSaveMode,
  grantIds: import_zod2.z.array(import_zod2.z.string().min(1)).min(1).max(50),
  rows: import_zod2.z.array(GrantBudgetManagerRow).max(5e3),
  reason: import_zod2.z.string().trim().optional(),
  loadedAt: import_zod2.z.string().trim().optional()
});
var GrantBudgetManagerReconcileBody = import_zod2.z.object({
  grantIds: import_zod2.z.array(import_zod2.z.string().min(1)).min(1).max(50)
});

// src/inbox.ts
var inbox_exports = {};
__export(inbox_exports, {
  InboxAssignedGroupEnum: () => InboxAssignedGroupEnum,
  InboxDigestPreviewQuerySchema: () => InboxDigestPreviewQuerySchema,
  InboxDigestSubRecordSchema: () => InboxDigestSubRecordSchema,
  InboxDigestTypeSchema: () => InboxDigestTypeSchema,
  InboxItemEntitySchema: () => InboxItemEntitySchema,
  InboxItemSchema: () => InboxItemSchema,
  InboxListMyQuerySchema: () => InboxListMyQuerySchema,
  InboxMetricsMyQuerySchema: () => InboxMetricsMyQuerySchema,
  InboxMetricsScopeSchema: () => InboxMetricsScopeSchema,
  InboxScheduleDigestBodySchema: () => InboxScheduleDigestBodySchema,
  InboxSendDigestNowBodySchema: () => InboxSendDigestNowBodySchema,
  InboxSendInviteBodySchema: () => InboxSendInviteBodySchema,
  InboxSendMonthlySummaryBodySchema: () => InboxSendMonthlySummaryBodySchema,
  InboxSourceEnum: () => InboxSourceEnum,
  InboxStatusEnum: () => InboxStatusEnum,
  InboxWorkloadListQuerySchema: () => InboxWorkloadListQuerySchema
});
var InboxSourceEnum = import_zod2.z.enum([
  "task",
  "payment",
  "paymentCompliance",
  "userVerification",
  "adminEnrollment",
  "other",
  "jotform",
  "otherTask"
  // back-compat alias written by old trigger versions
]);
var InboxStatusEnum = import_zod2.z.enum(["open", "done"]);
var InboxAssignedGroupEnum = import_zod2.z.enum(["admin", "casemanager", "compliance"]);
var YYYY_MM = import_zod2.z.string().regex(/^\d{4}-\d{2}$/);
var UrlOrHash = import_zod2.z.union([import_zod2.z.url(), import_zod2.z.literal("#")]);
var InboxDigestTypeSchema = import_zod2.z.enum(["caseload", "budget", "enrollments", "caseManagers", "rentalAssistance"]);
var InboxDigestSubRecordSchema = import_zod2.z.object({
  uid: import_zod2.z.string().min(1),
  email: import_zod2.z.email(),
  displayName: import_zod2.z.string().optional(),
  roles: import_zod2.z.array(import_zod2.z.string()),
  topRole: import_zod2.z.string(),
  subs: import_zod2.z.partialRecord(InboxDigestTypeSchema, import_zod2.z.boolean()),
  effective: import_zod2.z.record(InboxDigestTypeSchema, import_zod2.z.boolean())
});
var IsoString = import_zod2.z.string().min(1);
var InboxItemSchema = import_zod2.z.object({
  utid: import_zod2.z.string().min(1),
  source: InboxSourceEnum,
  status: InboxStatusEnum,
  enrollmentId: import_zod2.z.string().nullable(),
  clientId: import_zod2.z.string().nullable(),
  grantId: import_zod2.z.string().nullable(),
  sourcePath: import_zod2.z.string().min(1),
  dueDate: ISO10.nullish(),
  // YYYY-MM-DD
  dueMonth: YYYY_MM.nullish(),
  // YYYY-MM
  createdAtISO: IsoString.nullish(),
  updatedAtISO: IsoString.nullish(),
  assignedToUid: import_zod2.z.string().nullable(),
  assignedToGroup: InboxAssignedGroupEnum.nullish(),
  cmUid: import_zod2.z.string().nullable(),
  // org scoping / projection
  orgId: import_zod2.z.string().nullish(),
  teamIds: import_zod2.z.array(import_zod2.z.string().min(1)).nullish(),
  notify: import_zod2.z.boolean().nullish(),
  title: import_zod2.z.string().default(""),
  subtitle: import_zod2.z.string().nullish(),
  labels: import_zod2.z.array(import_zod2.z.string().min(1)).nullish(),
  completedAtISO: IsoString.nullish()
}).passthrough();
var InboxItemEntitySchema = InboxItemSchema.extend({
  id: import_zod2.z.string().min(1)
});
var InboxListMyQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional(),
  includeOverdue: Boolish.optional(),
  includeGroup: Boolish.optional()
}).partial();
var InboxWorkloadListQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional(),
  assigneeUid: import_zod2.z.string().optional(),
  includeUnassigned: Boolish.optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional()
}).partial();
var InboxSendInviteBodySchema = import_zod2.z.object({
  to: import_zod2.z.email(),
  name: import_zod2.z.string().trim().optional().default(""),
  resetLink: UrlOrHash.optional().default("#"),
  subject: import_zod2.z.string().trim().optional(),
  html: import_zod2.z.string().trim().optional()
});
var InboxSendMonthlySummaryBodySchema = import_zod2.z.object({
  to: import_zod2.z.email(),
  clientId: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).transform(String),
  tasksDue: import_zod2.z.array(
    import_zod2.z.object({
      id: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).transform(String).optional(),
      type: import_zod2.z.string().optional(),
      dueDate: import_zod2.z.string().optional(),
      completed: import_zod2.z.boolean().optional(),
      completedAt: import_zod2.z.string().optional()
    })
  ).optional().default([]),
  monthsRemaining: import_zod2.z.number().int().nonnegative().nullable().optional(),
  dashboardLink: UrlOrHash.optional().default("#"),
  subject: import_zod2.z.string().trim().optional(),
  html: import_zod2.z.string().trim().optional()
});
var InboxSendDigestNowBodySchema = import_zod2.z.object({
  digestType: InboxDigestTypeSchema.optional().default("caseload"),
  months: import_zod2.z.array(YYYY_MM).min(1),
  cmUid: import_zod2.z.string().optional(),
  combine: import_zod2.z.boolean().optional().default(false),
  subject: import_zod2.z.string().optional(),
  subjectTemplate: import_zod2.z.string().optional(),
  message: import_zod2.z.string().optional()
});
var InboxScheduleDigestBodySchema = import_zod2.z.object({
  digestType: InboxDigestTypeSchema.optional().default("caseload"),
  months: import_zod2.z.array(YYYY_MM).min(1),
  cmUid: import_zod2.z.string().min(1),
  combine: import_zod2.z.boolean().optional().default(true),
  subject: import_zod2.z.string().optional(),
  subjectTemplate: import_zod2.z.string().optional(),
  message: import_zod2.z.string().optional(),
  sendAt: import_zod2.z.string().datetime()
});
var InboxDigestPreviewQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional(),
  cmUid: import_zod2.z.string().optional()
});
var InboxMetricsScopeSchema = import_zod2.z.object({
  assignedCount: import_zod2.z.number().int().nonnegative(),
  openCount: import_zod2.z.number().int().nonnegative(),
  completedCount: import_zod2.z.number().int().nonnegative(),
  completionPct: import_zod2.z.number().nonnegative(),
  // 0-100
  overdueCount: import_zod2.z.number().int().nonnegative(),
  sharedCount: import_zod2.z.number().int().nonnegative(),
  assignedToMeCount: import_zod2.z.number().int().nonnegative()
});
var InboxMetricsMyQuerySchema = import_zod2.z.object({
  month: YYYY_MM.optional()
}).partial();

// src/jotform.ts
var jotform_exports = {};
__export(jotform_exports, {
  JotformApiGetQuery: () => JotformApiGetQuery,
  JotformApiListQuery: () => JotformApiListQuery,
  JotformBudget: () => JotformBudget,
  JotformBudgetLineItem: () => JotformBudgetLineItem,
  JotformBudgetTotals: () => JotformBudgetTotals,
  JotformDigestField: () => JotformDigestField,
  JotformDigestFieldType: () => JotformDigestFieldType,
  JotformDigestGetQuery: () => JotformDigestGetQuery,
  JotformDigestHeader: () => JotformDigestHeader,
  JotformDigestListQuery: () => JotformDigestListQuery,
  JotformDigestMap: () => JotformDigestMap,
  JotformDigestSection: () => JotformDigestSection,
  JotformDigestUpsertBody: () => JotformDigestUpsertBody,
  JotformFormQuestionsGetQuery: () => JotformFormQuestionsGetQuery,
  JotformFormSummary: () => JotformFormSummary,
  JotformFormsListQuery: () => JotformFormsListQuery,
  JotformLinkSubmissionBody: () => JotformLinkSubmissionBody,
  JotformQuestionField: () => JotformQuestionField,
  JotformQuestionFieldType: () => JotformQuestionFieldType,
  JotformQuestionLogicType: () => JotformQuestionLogicType,
  JotformSubmission: () => JotformSubmission,
  JotformSubmissionCalc: () => JotformSubmissionCalc,
  JotformSubmissionEntity: () => JotformSubmissionEntity,
  JotformSubmissionInputSchema: () => JotformSubmissionInputSchema,
  JotformSubmissionPatchBody: () => JotformSubmissionPatchBody,
  JotformSubmissionSource: () => JotformSubmissionSource,
  JotformSubmissionStatus: () => JotformSubmissionStatus,
  JotformSubmissionUpsertBody: () => JotformSubmissionUpsertBody,
  JotformSubmissionsAdminDeleteBody: () => JotformSubmissionsAdminDeleteBody,
  JotformSubmissionsDeleteBody: () => JotformSubmissionsDeleteBody,
  JotformSubmissionsGetQuery: () => JotformSubmissionsGetQuery,
  JotformSubmissionsListQuery: () => JotformSubmissionsListQuery,
  JotformSubmissionsPatchBody: () => JotformSubmissionsPatchBody,
  JotformSubmissionsPatchRow: () => JotformSubmissionsPatchRow,
  JotformSubmissionsUpsertBody: () => JotformSubmissionsUpsertBody,
  JotformSyncBody: () => JotformSyncBody,
  JotformSyncSelectionBody: () => JotformSyncSelectionBody,
  toArray: () => toArray
});
var JotformSubmissionStatus = import_zod2.z.enum(["active", "archived", "deleted"]);
var JotformSubmissionSource = import_zod2.z.enum([
  "api",
  "webhook",
  "sync",
  "manual"
]);
var Num3 = import_zod2.z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var JotformBudgetLineItem = import_zod2.z.object({
  id: Id.optional(),
  label: import_zod2.z.string().trim().nullish(),
  amount: Num3,
  projected: Num3,
  spent: Num3,
  projectedInWindow: Num3.optional(),
  spentInWindow: Num3.optional(),
  locked: import_zod2.z.boolean().nullish()
}).passthrough();
var JotformBudgetTotals = import_zod2.z.object({
  total: Num3,
  projected: Num3,
  spent: Num3,
  balance: Num3.optional(),
  projectedBalance: Num3.optional(),
  remaining: Num3.optional(),
  projectedInWindow: Num3.optional(),
  spentInWindow: Num3.optional(),
  windowBalance: Num3.optional(),
  windowProjectedBalance: Num3.optional()
}).passthrough();
var JotformBudget = import_zod2.z.object({
  total: Num3,
  totals: JotformBudgetTotals.nullish(),
  lineItems: import_zod2.z.array(JotformBudgetLineItem).default([]),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var JotformSubmissionCalc = import_zod2.z.object({
  amount: Num3,
  currency: import_zod2.z.string().trim().nullish(),
  amounts: import_zod2.z.array(Num3).optional(),
  budgetKey: import_zod2.z.string().trim().nullish(),
  lineItems: import_zod2.z.array(
    import_zod2.z.object({
      key: import_zod2.z.string().trim().min(1),
      label: import_zod2.z.string().trim().nullish(),
      amount: Num3
    }).passthrough()
  ).optional()
}).passthrough();
var JotformSubmissionInputSchema = import_zod2.z.object({
  id: Id.optional(),
  orgId: Id.nullish(),
  formId: Id,
  formTitle: import_zod2.z.string().trim().nullish(),
  submissionId: Id.optional(),
  status: JotformSubmissionStatus.optional(),
  source: JotformSubmissionSource.optional(),
  // Optional linkage to grants/programs
  grantId: Id.nullish(),
  programId: Id.nullish(),
  customerId: Id.nullish(),
  enrollmentId: Id.nullish(),
  cwId: import_zod2.z.string().trim().nullish(),
  hmisId: import_zod2.z.string().trim().nullish(),
  formAlias: import_zod2.z.string().trim().min(1).nullish(),
  fieldMap: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).nullish(),
  // Basic Jotform metadata
  ip: import_zod2.z.string().trim().nullish(),
  statusRaw: import_zod2.z.string().trim().nullish(),
  submissionUrl: import_zod2.z.url().nullish(),
  editUrl: import_zod2.z.url().nullish(),
  pdfUrl: import_zod2.z.url().nullish(),
  // Submission payload
  answers: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish(),
  raw: import_zod2.z.unknown().nullish(),
  // Budget / calc payload
  budget: JotformBudget.nullish(),
  calc: JotformSubmissionCalc.nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var JotformSubmission = JotformSubmissionInputSchema;
var JotformSubmissionEntity = JotformSubmissionInputSchema.extend({
  id: Id
}).passthrough();
var JotformSubmissionsUpsertBody = import_zod2.z.union([
  JotformSubmissionInputSchema,
  import_zod2.z.array(JotformSubmissionInputSchema).min(1)
]);
var JotformSubmissionUpsertBody = JotformSubmissionsUpsertBody;
var JotformSubmissionsPatchRow = import_zod2.z.object({
  id: Id,
  patch: JotformSubmissionInputSchema.partial().passthrough(),
  unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var JotformSubmissionsPatchBody = import_zod2.z.union([
  JotformSubmissionsPatchRow,
  import_zod2.z.array(JotformSubmissionsPatchRow).min(1)
]);
var JotformSubmissionPatchBody = JotformSubmissionsPatchBody;
var JotformSubmissionsDeleteBody = import_zod2.z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  import_zod2.z.union([IdLike, import_zod2.z.array(IdLike).min(1)])
);
var JotformSubmissionsAdminDeleteBody = JotformSubmissionsDeleteBody;
var ActiveFilter4 = import_zod2.z.preprocess((v) => {
  if (v === "" || v == null) return void 0;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
  if (Array.isArray(v)) return v[0];
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "active"].includes(s)) return true;
    if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
  }
  return v;
}, import_zod2.z.union([import_zod2.z.literal(true), import_zod2.z.literal(false)]));
var JotformSubmissionsListQuery = import_zod2.z.object({
  status: import_zod2.z.string().trim().optional(),
  active: import_zod2.z.union([ActiveFilter4, BoolLike, import_zod2.z.string()]).optional(),
  formId: IdLike.optional(),
  formAlias: IdLike.optional(),
  submissionId: IdLike.optional(),
  grantId: IdLike.optional(),
  programId: IdLike.optional(),
  customerId: IdLike.optional(),
  enrollmentId: IdLike.optional(),
  cwId: import_zod2.z.string().trim().optional(),
  hmisId: import_zod2.z.string().trim().optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  // dev explicit org targeting
  orgId: IdLike.optional()
}).passthrough();
var JotformSubmissionsGetQuery = import_zod2.z.object({ id: IdLike, orgId: IdLike.optional() }).passthrough();
var JotformFormsListQuery = import_zod2.z.object({
  search: import_zod2.z.string().trim().optional(),
  includeNoSubmissions: BoolFromLike.optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional()
}).passthrough();
var JotformFormSummary = import_zod2.z.object({
  id: Id,
  title: import_zod2.z.string().trim().default(""),
  alias: import_zod2.z.string().trim().min(1),
  count: import_zod2.z.coerce.number().int().nonnegative().default(0),
  lastSubmission: import_zod2.z.string().trim().nullish(),
  url: import_zod2.z.url().nullish(),
  isSign: import_zod2.z.boolean().optional()
}).passthrough();
var JotformQuestionFieldType = import_zod2.z.enum(["text", "number", "date", "boolean", "select"]);
var JotformQuestionLogicType = import_zod2.z.enum([
  "dropdown",
  "single_select",
  "multi_select",
  "date",
  "text",
  "number",
  "email",
  "phone",
  "file",
  "unknown"
]);
var JotformQuestionField = import_zod2.z.object({
  key: import_zod2.z.string().trim().min(1),
  rawFieldId: import_zod2.z.string().trim().min(1),
  label: import_zod2.z.string().trim().default(""),
  rawType: import_zod2.z.string().trim().default(""),
  type: JotformQuestionFieldType,
  logicType: JotformQuestionLogicType,
  typeLabel: import_zod2.z.string().trim().min(1),
  options: import_zod2.z.array(import_zod2.z.string()).optional(),
  order: import_zod2.z.coerce.number().int().nonnegative()
}).passthrough();
var JotformFormQuestionsGetQuery = import_zod2.z.object({
  formId: IdLike
}).passthrough();
var JotformLinkSubmissionBody = import_zod2.z.object({
  id: IdLike.optional(),
  submissionId: IdLike.optional(),
  formAlias: import_zod2.z.string().trim().min(1).nullish(),
  grantId: IdLike.nullish(),
  customerId: IdLike.nullish(),
  enrollmentId: IdLike.nullish(),
  cwId: import_zod2.z.string().trim().nullish(),
  hmisId: import_zod2.z.string().trim().nullish(),
  fieldMap: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).nullish(),
  notes: import_zod2.z.string().trim().nullish(),
  orgId: IdLike.optional()
}).passthrough().refine((v) => !!(v.id || v.submissionId), { message: "missing_id_or_submissionId" });
var JotformSyncSelectionBody = import_zod2.z.object({
  mode: import_zod2.z.enum(["all", "formIds", "aliases"]).default("all"),
  formIds: import_zod2.z.array(IdLike).optional(),
  aliases: import_zod2.z.array(import_zod2.z.string().trim().min(1)).optional(),
  includeNoSubmissions: BoolFromLike.optional(),
  since: TsLike.optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(1e3).optional(),
  maxPages: import_zod2.z.coerce.number().int().min(1).max(25).optional(),
  includeRaw: BoolFromLike.optional(),
  orgId: IdLike.optional()
}).passthrough();
var JotformDigestFieldType = import_zod2.z.enum(["question", "header", "section"]);
var JotformDigestHeader = import_zod2.z.object({
  show: import_zod2.z.boolean().default(true),
  title: import_zod2.z.string().trim().nullish(),
  subtitle: import_zod2.z.string().trim().nullish()
}).passthrough();
var JotformDigestSection = import_zod2.z.object({
  id: import_zod2.z.string().trim().min(1),
  label: import_zod2.z.string().trim().min(1),
  show: import_zod2.z.boolean().default(true),
  order: import_zod2.z.coerce.number().int().default(0)
}).passthrough();
var JotformDigestField = import_zod2.z.object({
  key: import_zod2.z.string().trim().min(1),
  label: import_zod2.z.string().trim().min(1),
  questionLabel: import_zod2.z.string().trim().nullish(),
  type: JotformDigestFieldType.default("question"),
  sectionId: import_zod2.z.string().trim().nullish(),
  show: import_zod2.z.boolean().default(true),
  hideIfEmpty: import_zod2.z.boolean().default(true),
  order: import_zod2.z.coerce.number().int().default(0)
}).passthrough();
var JotformDigestMap = import_zod2.z.object({
  id: Id.optional(),
  orgId: Id.nullish(),
  formId: Id,
  formAlias: import_zod2.z.string().trim().min(1).nullish(),
  formTitle: import_zod2.z.string().trim().nullish(),
  header: JotformDigestHeader.default({ show: true, title: null, subtitle: null }),
  sections: import_zod2.z.array(JotformDigestSection).default([]),
  fields: import_zod2.z.array(JotformDigestField).default([]),
  options: import_zod2.z.object({
    hideEmptyFields: import_zod2.z.boolean().default(true),
    showQuestions: import_zod2.z.boolean().default(true),
    showAnswers: import_zod2.z.boolean().default(true),
    task: import_zod2.z.object({
      enabled: import_zod2.z.boolean().default(false),
      assignedToGroup: import_zod2.z.enum(["admin", "compliance", "casemanager"]).default("admin"),
      titlePrefix: import_zod2.z.string().trim().nullish(),
      titleFieldKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
      subtitleFieldKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([])
    }).passthrough().default({
      enabled: false,
      assignedToGroup: "admin",
      titlePrefix: null,
      titleFieldKeys: [],
      subtitleFieldKeys: []
    }),
    spending: import_zod2.z.object({
      enabled: import_zod2.z.boolean().default(false),
      schemaKind: import_zod2.z.enum(["credit-card", "invoice", "other"]).default("other"),
      grantFieldKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
      lineItemFieldKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
      customerFieldKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
      amountFieldKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
      merchantFieldKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
      keywordRules: import_zod2.z.array(import_zod2.z.unknown()).default([]),
      notes: import_zod2.z.string().trim().nullish()
    }).passthrough().default({
      enabled: false,
      schemaKind: "other",
      grantFieldKeys: [],
      lineItemFieldKeys: [],
      customerFieldKeys: [],
      amountFieldKeys: [],
      merchantFieldKeys: [],
      keywordRules: [],
      notes: null
    })
  }).passthrough().default({
    hideEmptyFields: true,
    showQuestions: true,
    showAnswers: true,
    task: {
      enabled: false,
      assignedToGroup: "admin",
      titlePrefix: null,
      titleFieldKeys: [],
      subtitleFieldKeys: []
    },
    spending: {
      enabled: false,
      schemaKind: "other",
      grantFieldKeys: [],
      lineItemFieldKeys: [],
      customerFieldKeys: [],
      amountFieldKeys: [],
      merchantFieldKeys: [],
      keywordRules: [],
      notes: null
    }
  }),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var JotformDigestUpsertBody = JotformDigestMap;
var JotformDigestGetQuery = import_zod2.z.object({
  formId: IdLike.optional(),
  formAlias: import_zod2.z.string().trim().optional(),
  id: IdLike.optional(),
  orgId: IdLike.optional()
}).passthrough().refine((v) => !!(v.formId || v.formAlias || v.id), { message: "missing_form_id_or_alias" });
var JotformDigestListQuery = import_zod2.z.object({
  search: import_zod2.z.string().trim().optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  orgId: IdLike.optional()
}).passthrough();
var JotformSyncBody = import_zod2.z.object({
  formId: IdLike,
  since: TsLike.optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(1e3).optional(),
  maxPages: import_zod2.z.coerce.number().int().min(1).max(25).optional(),
  startOffset: import_zod2.z.coerce.number().int().min(0).optional(),
  includeRaw: BoolFromLike.optional(),
  orgId: IdLike.optional()
}).passthrough();
var JotformApiListQuery = import_zod2.z.object({
  formId: IdLike,
  limit: import_zod2.z.coerce.number().int().min(1).max(200).optional(),
  offset: import_zod2.z.coerce.number().int().min(0).optional(),
  status: import_zod2.z.string().optional(),
  since: TsLike.optional()
}).passthrough();
var JotformApiGetQuery = import_zod2.z.object({ id: IdLike }).passthrough();

// src/ledger.ts
var ledger_exports = {};
__export(ledger_exports, {
  LedgerAutoAssignBody: () => LedgerAutoAssignBody,
  LedgerBalanceQuery: () => LedgerBalanceQuery,
  LedgerClassifyBody: () => LedgerClassifyBody,
  LedgerClassifyItem: () => LedgerClassifyItem,
  LedgerCreateBody: () => LedgerCreateBody,
  LedgerEntry: () => LedgerEntry,
  LedgerGetByIdParams: () => LedgerGetByIdParams,
  LedgerListBody: () => LedgerListBody,
  LedgerOrigin: () => LedgerOrigin,
  LedgerSource: () => LedgerSource
});
var ISO10ish2 = import_zod2.z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return s;
  return s.length >= 10 ? s.slice(0, 10) : s;
}, ISO10);
var ISO72 = import_zod2.z.string().regex(/^\d{4}-\d{2}$/);
var isPresent = (v) => v != null && String(v).trim() !== "";
var addCustomIssue = (ctx, message, path) => {
  ctx.addIssue({ code: "custom", message, path });
};
function deriveLedgerDates(v) {
  if (!v || typeof v !== "object") return v;
  const o = { ...v };
  const d = o.dueDate ?? o.date;
  if (d != null) {
    if (o.dueDate == null) o.dueDate = d;
    if (o.date == null) o.date = d;
  }
  const dd = o.dueDate ?? o.date;
  if (dd && o.month == null) {
    const m = String(dd).slice(0, 7);
    if (m) o.month = m;
  }
  return o;
}
var LedgerSource = import_zod2.z.enum([
  "enrollment",
  // emitted from paymentsSpend (current path)
  "manual",
  // manual entry (future /ledgerCreate)
  "card",
  // credit card/imported expenses
  "migration",
  // backfills or grant-year transitions
  "adjustment",
  // admin corrections
  "system"
  // schedulers, auto-repairs, etc.
]);
var LedgerOrigin = import_zod2.z.object({
  app: import_zod2.z.string().nullish(),
  // "hdb"
  baseId: import_zod2.z.string().nullish(),
  // e.g. paymentId
  sourcePath: import_zod2.z.string().nullish(),
  // firestore path
  paymentQueueId: import_zod2.z.string().nullish(),
  paymentQueueSource: import_zod2.z.string().nullish(),
  jotformSubmissionId: import_zod2.z.string().nullish(),
  idempotencyKey: import_zod2.z.string().nullish()
}).partial();
var LedgerEntry = import_zod2.z.preprocess(
  deriveLedgerDates,
  import_zod2.z.object({
    id: import_zod2.z.string().min(1).optional(),
    // allow system to generate
    source: LedgerSource,
    orgId: import_zod2.z.string().nullable().optional(),
    amountCents: import_zod2.z.coerce.number().int(),
    amount: import_zod2.z.coerce.number().optional(),
    // derived; do NOT rely on being stored
    grantId: import_zod2.z.string().nullable().optional(),
    lineItemId: import_zod2.z.string().nullable().optional(),
    creditCardId: import_zod2.z.string().nullable().optional(),
    enrollmentId: import_zod2.z.string().nullable().optional(),
    paymentId: import_zod2.z.string().nullable().optional(),
    customerId: import_zod2.z.string().nullable().optional(),
    caseManagerId: import_zod2.z.string().nullable().optional(),
    note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
    vendor: import_zod2.z.string().nullish(),
    comment: import_zod2.z.string().nullish(),
    labels: import_zod2.z.array(import_zod2.z.string()).default([]),
    ts: TsLike.nullish(),
    dueDate: ISO10ish2.nullish(),
    // YYYY-MM-DD
    date: ISO10ish2.nullish(),
    // alias; kept for back-compat / readability
    month: ISO72.nullish(),
    // YYYY-MM
    origin: LedgerOrigin.nullish(),
    grantNameAtSpend: import_zod2.z.string().nullish(),
    lineItemLabelAtSpend: import_zod2.z.string().nullish(),
    // Canonical name
    customerNameAtSpend: import_zod2.z.string().nullish(),
    paymentLabelAtSpend: import_zod2.z.string().nullish(),
    // Optional audit
    byUid: import_zod2.z.string().nullish(),
    byEmail: import_zod2.z.string().nullish(),
    byName: import_zod2.z.string().nullish(),
    // Payment status — always true for migrated historical records
    paid: import_zod2.z.boolean().nullish(),
    paidAt: TsLike.nullish(),
    // Optional audit linkage for reversals (recommended)
    reversalOf: import_zod2.z.string().nullish(),
    // Compliance snapshot (enrollment payments only)
    compliance: import_zod2.z.object({
      hmisComplete: import_zod2.z.boolean().nullish(),
      caseworthyComplete: import_zod2.z.boolean().nullish()
    }).nullish(),
    createdAt: TsLike.nullish(),
    updatedAt: TsLike.nullish()
  }).superRefine((v, ctx) => {
    if (v.amount != null) {
      const a = Number(v.amount);
      const c = Number(v.amountCents);
      if (Number.isFinite(a) && Number.isFinite(c)) {
        const expect = Math.round(a * 100);
        if (expect !== c) {
          addCustomIssue(ctx, "amount must match amountCents (rounded to cents)", [
            "amount"
          ]);
        }
      }
    }
    const hasGrant = isPresent(v.grantId);
    const hasLI = isPresent(v.lineItemId);
    if (hasGrant !== hasLI) {
      addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
        "lineItemId"
      ]);
    }
    if (v.source === "enrollment") {
      const req = [
        ["grantId", "grantId required for enrollment ledger rows"],
        ["lineItemId", "lineItemId required for enrollment ledger rows"],
        ["enrollmentId", "enrollmentId required for enrollment ledger rows"],
        ["paymentId", "paymentId required for enrollment ledger rows"]
      ];
      for (const [k, msg] of req) {
        const val = v[k];
        if (!isPresent(val)) addCustomIssue(ctx, msg, [k]);
      }
      const d2 = v.dueDate || v.date;
      if (!d2) {
        addCustomIssue(ctx, "dueDate required for enrollment ledger rows", ["dueDate"]);
      }
    }
    const d = v.dueDate || v.date;
    if (d && v.month) {
      const m = String(d).slice(0, 7);
      if (m && String(v.month) !== m) {
        addCustomIssue(ctx, "month must equal dueDate.slice(0,7)", ["month"]);
      }
    }
  }).strip()
);
var LedgerListBody = import_zod2.z.object({
  orgId: import_zod2.z.string().nullish(),
  grantId: import_zod2.z.string().nullish(),
  creditCardId: import_zod2.z.string().nullish(),
  enrollmentId: import_zod2.z.string().nullish(),
  customerId: import_zod2.z.string().nullish(),
  source: LedgerSource.nullish(),
  month: ISO72.nullish(),
  // GET query values arrive as strings, so coerce here
  limit: import_zod2.z.coerce.number().int().min(1).max(500).default(50),
  cursor: import_zod2.z.string().nullish(),
  // Back-compat: accept "amount" but map it to "amountCents"
  sortBy: import_zod2.z.preprocess(
    (v) => v === "amount" ? "amountCents" : v,
    import_zod2.z.enum(["createdAt", "dueDate", "amountCents"])
  ).default("createdAt"),
  sortOrder: import_zod2.z.enum(["asc", "desc"]).default("desc")
}).strip();
var LedgerCreateBody = import_zod2.z.preprocess(
  deriveLedgerDates,
  import_zod2.z.object({
    id: import_zod2.z.string().min(1).optional(),
    // optional now
    source: import_zod2.z.enum(["manual", "card", "adjustment"]),
    amountCents: import_zod2.z.coerce.number().int(),
    amount: import_zod2.z.coerce.number().optional(),
    grantId: import_zod2.z.string().nullish(),
    lineItemId: import_zod2.z.string().nullish(),
    creditCardId: import_zod2.z.string().nullish(),
    enrollmentId: import_zod2.z.string().nullish(),
    paymentId: import_zod2.z.string().nullish(),
    customerId: import_zod2.z.string().nullish(),
    note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
    vendor: import_zod2.z.string().nullish(),
    comment: import_zod2.z.string().nullish(),
    labels: import_zod2.z.array(import_zod2.z.string()).default([]),
    dueDate: ISO10ish2.nullish(),
    date: ISO10ish2.nullish(),
    month: ISO72.nullish()
  }).superRefine((v, ctx) => {
    const hasGrant = isPresent(v.grantId);
    const hasLI = isPresent(v.lineItemId);
    if (hasGrant !== hasLI) {
      addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
        "lineItemId"
      ]);
    }
    const d = v.dueDate || v.date;
    if (d && v.month && String(v.month) !== String(d).slice(0, 7)) {
      addCustomIssue(ctx, "month must equal dueDate.slice(0,7)", ["month"]);
    }
  }).strip()
);
var LedgerClassifyItem = import_zod2.z.object({
  entryId: import_zod2.z.string().min(1),
  grantId: import_zod2.z.string().nullish(),
  lineItemId: import_zod2.z.string().nullish(),
  clear: import_zod2.z.boolean().optional()
}).superRefine((v, ctx) => {
  const clear = v.clear === true;
  const hasGrant = isPresent(v.grantId);
  const hasLi = isPresent(v.lineItemId);
  if (!clear && hasGrant !== hasLi) {
    addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
      "lineItemId"
    ]);
  }
});
var LedgerClassifyBody = import_zod2.z.object({
  items: import_zod2.z.array(LedgerClassifyItem).min(1),
  dryRun: import_zod2.z.boolean().optional().default(false),
  reason: import_zod2.z.string().trim().nullish()
});
var LedgerAutoAssignBody = import_zod2.z.object({
  entryIds: import_zod2.z.array(import_zod2.z.string().min(1)).optional(),
  month: ISO72.nullish(),
  grantId: import_zod2.z.string().nullish(),
  limit: import_zod2.z.coerce.number().int().min(1).max(1e3).optional().default(200),
  apply: import_zod2.z.boolean().optional().default(false),
  forceReclass: import_zod2.z.boolean().optional().default(false)
}).strip();
var LedgerGetByIdParams = import_zod2.z.object({
  entryId: import_zod2.z.string().min(1)
});
var LedgerBalanceQuery = import_zod2.z.object({
  orgId: import_zod2.z.string().nullish(),
  grantId: import_zod2.z.string().nullish(),
  month: ISO72.nullish(),
  groupBy: import_zod2.z.enum(["grant", "month", "source"]).default("grant")
}).strip();

// src/tours.ts
var tours_exports = {};
__export(tours_exports, {
  TourFlow: () => TourFlow,
  TourStep: () => TourStep,
  ToursDeleteBody: () => ToursDeleteBody,
  ToursGetQuery: () => ToursGetQuery,
  ToursListQuery: () => ToursListQuery,
  ToursPatchBody: () => ToursPatchBody,
  ToursPatchItem: () => ToursPatchItem,
  ToursUpsertBody: () => ToursUpsertBody
});
var TourStep = import_zod2.z.object({
  id: Id,
  route: import_zod2.z.string().trim().min(1),
  selector: import_zod2.z.string().optional(),
  title: import_zod2.z.string().optional(),
  body: import_zod2.z.string().optional(),
  placement: import_zod2.z.enum(["auto", "top", "bottom", "left", "right"]).default("auto"),
  padding: import_zod2.z.number().int().nonnegative().default(8),
  offsetX: import_zod2.z.number().default(0),
  offsetY: import_zod2.z.number().default(0),
  requireClick: import_zod2.z.boolean().default(false),
  nextOn: import_zod2.z.enum(["auto", "button", "click"]).default("button").optional(),
  advanceWhen: import_zod2.z.string().optional()
});
var TourFlow = import_zod2.z.object({
  id: Id,
  name: import_zod2.z.string().trim().min(1),
  steps: import_zod2.z.array(TourStep),
  updatedAt: TsLike.optional(),
  // <-- core timestamp-like
  version: import_zod2.z.literal(2).default(2),
  active: import_zod2.z.boolean().default(true),
  deleted: import_zod2.z.boolean().default(false),
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).default({})
  // <-- no optional+default combo
});
var ToursUpsertBody = import_zod2.z.union([TourFlow, import_zod2.z.array(TourFlow)]);
var ToursPatchItem = import_zod2.z.object({
  id: Id,
  data: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).refine((v) => v && Object.keys(v).length > 0, "data must have fields")
});
var ToursPatchBody = import_zod2.z.union([ToursPatchItem, import_zod2.z.array(ToursPatchItem)]);
var ToursDeleteBody = import_zod2.z.union([
  Id,
  Ids,
  import_zod2.z.object({ id: Id }),
  import_zod2.z.object({ ids: Ids })
]);
var ToursGetQuery = import_zod2.z.object({ id: Id });
var ToursListQuery = import_zod2.z.object({
  active: BoolFromLike.optional(),
  // <-- better query semantics, from core
  deleted: BoolFromLike.optional(),
  limit: import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).optional(),
  startAfter: import_zod2.z.string().optional(),
  version: import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).optional()
});

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

// src/metrics.ts
var metrics_exports = {};
__export(metrics_exports, {
  CaseManagerMonthMetrics: () => CaseManagerMonthMetrics,
  CaseManagerSummaryMetrics: () => CaseManagerSummaryMetrics,
  CustomerRefLite: () => CustomerRefLite,
  GrantMonthMetrics: () => GrantMonthMetrics,
  GrantSummaryMetrics: () => GrantSummaryMetrics,
  MetricChipDefinition: () => MetricChipDefinition,
  MetricChipId: () => MetricChipId,
  MetricWorkspaceChipInstance: () => MetricWorkspaceChipInstance,
  MetricWorkspaceLayout: () => MetricWorkspaceLayout,
  MetricWorkspacePrefs: () => MetricWorkspacePrefs,
  NameRef: () => NameRef,
  PopulationSummary: () => PopulationSummary,
  SystemMonthMetrics: () => SystemMonthMetrics,
  SystemSummaryMetrics: () => SystemSummaryMetrics
});
var import_zod4 = require("zod");
var NameRef = import_zod4.z.object({
  id: import_zod4.z.string(),
  name: import_zod4.z.string().nullable()
});
var CustomerRefLite = import_zod4.z.object({
  id: import_zod4.z.string(),
  name: import_zod4.z.string().nullable(),
  caseManagerId: import_zod4.z.string().nullable(),
  caseManagerName: import_zod4.z.string().nullable(),
  population: import_zod4.z.enum(["Youth", "Family", "Individual", "unknown"]),
  active: import_zod4.z.boolean()
});
var PopulationSummary = import_zod4.z.object({
  customerTotal: import_zod4.z.number(),
  activeCustomerTotal: import_zod4.z.number(),
  inactiveCustomerTotal: import_zod4.z.number(),
  caseManagerTotal: import_zod4.z.number(),
  caseManagers: import_zod4.z.array(NameRef)
});
var SystemSummaryMetrics = import_zod4.z.object({
  updatedAt: import_zod4.z.any(),
  // Firestore Timestamp or ISO string
  reconciledAt: import_zod4.z.any().nullish(),
  caseManagers: import_zod4.z.object({
    total: import_zod4.z.number(),
    active: import_zod4.z.number(),
    inactive: import_zod4.z.number()
  }),
  customers: import_zod4.z.object({
    total: import_zod4.z.number(),
    active: import_zod4.z.number(),
    inactive: import_zod4.z.number()
  }),
  populations: import_zod4.z.object({
    youth: PopulationSummary,
    family: PopulationSummary,
    individual: PopulationSummary
  }),
  enrollments: import_zod4.z.object({
    total: import_zod4.z.number(),
    active: import_zod4.z.number(),
    inactive: import_zod4.z.number()
  }),
  grants: import_zod4.z.object({
    total: import_zod4.z.number(),
    active: import_zod4.z.number(),
    inactive: import_zod4.z.number()
  })
});
var SystemMonthMetrics = import_zod4.z.object({
  month: import_zod4.z.string(),
  // YYYY-MM
  updatedAt: import_zod4.z.any(),
  reconciledAt: import_zod4.z.any().nullish(),
  tasks: import_zod4.z.object({
    total: import_zod4.z.number(),
    open: import_zod4.z.number(),
    done: import_zod4.z.number()
  }),
  payments: import_zod4.z.object({
    total: import_zod4.z.number(),
    unpaid: import_zod4.z.number(),
    amount: import_zod4.z.number()
  }),
  spending: import_zod4.z.object({
    spent: import_zod4.z.number(),
    projected: import_zod4.z.number(),
    grantsWithActiveSpendItems: import_zod4.z.array(NameRef)
  }),
  jotform: import_zod4.z.object({
    submissionsTotal: import_zod4.z.number(),
    locallyTrackedOnly: import_zod4.z.boolean()
  })
});
var CaseManagerSummaryMetrics = import_zod4.z.object({
  uid: import_zod4.z.string(),
  caseManager: NameRef,
  updatedAt: import_zod4.z.any(),
  reconciledAt: import_zod4.z.any().nullish(),
  customers: import_zod4.z.object({
    total: import_zod4.z.number(),
    active: import_zod4.z.number(),
    inactive: import_zod4.z.number(),
    byPopulation: import_zod4.z.object({
      youth: import_zod4.z.number(),
      family: import_zod4.z.number(),
      individual: import_zod4.z.number(),
      unknown: import_zod4.z.number()
    }),
    refs: import_zod4.z.array(CustomerRefLite).optional()
  }),
  enrollments: import_zod4.z.object({
    total: import_zod4.z.number(),
    active: import_zod4.z.number(),
    inactive: import_zod4.z.number(),
    byPopulation: import_zod4.z.object({
      youth: import_zod4.z.number(),
      family: import_zod4.z.number(),
      individual: import_zod4.z.number(),
      unknown: import_zod4.z.number()
    })
  }),
  acuity: import_zod4.z.object({
    scoreSum: import_zod4.z.number(),
    scoreCount: import_zod4.z.number(),
    scoreAvg: import_zod4.z.number().nullable()
  }),
  tasks: import_zod4.z.object({
    openThisMonth: import_zod4.z.number(),
    openNextMonth: import_zod4.z.number(),
    byType: import_zod4.z.object({
      assessment: import_zod4.z.object({ thisMonth: import_zod4.z.number(), nextMonth: import_zod4.z.number() }),
      compliance: import_zod4.z.object({ thisMonth: import_zod4.z.number(), nextMonth: import_zod4.z.number() }),
      other: import_zod4.z.object({ thisMonth: import_zod4.z.number(), nextMonth: import_zod4.z.number() })
    })
  }),
  payments: import_zod4.z.object({
    unpaidThisMonth: import_zod4.z.number(),
    unpaidNextMonth: import_zod4.z.number(),
    unpaidTotal: import_zod4.z.number(),
    amountThisMonth: import_zod4.z.number(),
    amountNextMonth: import_zod4.z.number(),
    amountTotal: import_zod4.z.number()
  })
});
var CaseManagerMonthMetrics = import_zod4.z.object({
  month: import_zod4.z.string(),
  uid: import_zod4.z.string(),
  name: import_zod4.z.string().nullable().optional(),
  updatedAt: import_zod4.z.any(),
  reconciledAt: import_zod4.z.any().nullish(),
  tasks: import_zod4.z.object({
    total: import_zod4.z.number(),
    open: import_zod4.z.number(),
    done: import_zod4.z.number()
  }),
  payments: import_zod4.z.object({
    unpaidCount: import_zod4.z.number(),
    unpaidAmount: import_zod4.z.number()
  }),
  spending: import_zod4.z.object({
    projected: import_zod4.z.number(),
    spent: import_zod4.z.number()
  }).optional()
});
var GrantSummaryMetrics = import_zod4.z.object({
  grantId: import_zod4.z.string(),
  grant: NameRef,
  updatedAt: import_zod4.z.any(),
  reconciledAt: import_zod4.z.any().nullish(),
  enrollments: import_zod4.z.object({
    total: import_zod4.z.number(),
    active: import_zod4.z.number(),
    inactive: import_zod4.z.number(),
    byPopulation: import_zod4.z.object({
      youth: import_zod4.z.number(),
      family: import_zod4.z.number(),
      individual: import_zod4.z.number(),
      unknown: import_zod4.z.number()
    })
  }),
  customers: import_zod4.z.object({
    uniqueTotal: import_zod4.z.number(),
    activeUniqueTotal: import_zod4.z.number(),
    inactiveUniqueTotal: import_zod4.z.number(),
    refs: import_zod4.z.array(CustomerRefLite).optional()
  }),
  caseManagers: import_zod4.z.object({
    total: import_zod4.z.number(),
    refs: import_zod4.z.array(NameRef)
  }),
  spending: import_zod4.z.object({
    projected: import_zod4.z.number(),
    spent: import_zod4.z.number(),
    projectedInWindow: import_zod4.z.number(),
    spentInWindow: import_zod4.z.number(),
    lineItemsActive: import_zod4.z.number()
  })
});
var GrantMonthMetrics = import_zod4.z.object({
  month: import_zod4.z.string(),
  grantId: import_zod4.z.string(),
  name: import_zod4.z.string().nullable().optional(),
  updatedAt: import_zod4.z.any(),
  reconciledAt: import_zod4.z.any().nullish(),
  enrollments: import_zod4.z.object({
    active: import_zod4.z.number(),
    inactive: import_zod4.z.number(),
    total: import_zod4.z.number()
  }),
  payments: import_zod4.z.object({
    unpaidCount: import_zod4.z.number(),
    unpaidAmount: import_zod4.z.number()
  }),
  spending: import_zod4.z.object({
    projected: import_zod4.z.number(),
    spent: import_zod4.z.number(),
    activeLineItems: import_zod4.z.array(import_zod4.z.object({ id: import_zod4.z.string(), label: import_zod4.z.string().nullable() }))
  })
});
var MetricChipId = import_zod4.z.enum([
  "system.caseManagers.total",
  "system.customers.total",
  "system.population.youth.caseManagers",
  "system.population.youth.customers",
  "system.population.family.caseManagers",
  "system.population.family.customers",
  "system.population.individual.caseManagers",
  "system.population.individual.customers",
  "system.month.tasks.total",
  "system.month.payments.total",
  "system.month.spending.spent",
  "system.month.spending.projected",
  "system.month.jotform.submissions",
  "cm.customers.total",
  "cm.tasks.total",
  "cm.acuity.sum",
  "grant.enrollments.total",
  "grant.customers.total",
  "grant.spending.spent",
  "grant.spending.projected"
]);
var MetricChipDefinition = import_zod4.z.object({
  id: MetricChipId,
  label: import_zod4.z.string(),
  scope: import_zod4.z.enum(["system", "caseManager", "grant"]),
  period: import_zod4.z.enum(["current", "month", "allTime"]),
  valueType: import_zod4.z.enum(["count", "currency"]),
  supportsDrilldown: import_zod4.z.boolean(),
  drilldownKind: import_zod4.z.enum(["caseManagers", "customers", "grants", "lineItems"]).nullish()
});
var MetricWorkspaceChipInstance = import_zod4.z.object({
  instanceId: import_zod4.z.string(),
  chipId: MetricChipId,
  size: import_zod4.z.enum(["sm", "md", "lg"]).default("md"),
  scopeOverride: import_zod4.z.object({
    caseManagerUid: import_zod4.z.string().nullish(),
    grantId: import_zod4.z.string().nullish()
  }).nullish(),
  monthMode: import_zod4.z.enum(["current", "selected"]).default("current"),
  selectedMonth: import_zod4.z.string().nullish(),
  visible: import_zod4.z.boolean().default(true)
});
var MetricWorkspaceLayout = import_zod4.z.object({
  id: import_zod4.z.string(),
  name: import_zod4.z.string(),
  chips: import_zod4.z.array(MetricWorkspaceChipInstance),
  updatedAt: import_zod4.z.any().nullish()
});
var MetricWorkspacePrefs = import_zod4.z.object({
  layouts: import_zod4.z.array(MetricWorkspaceLayout).default([]),
  defaultLayoutId: import_zod4.z.string().nullish()
});

// src/tss.ts
var tss_exports = {};
__export(tss_exports, {
  TSS_BUDGET_ENTITY: () => TSS_BUDGET_ENTITY,
  TSS_COVER_ENTITY: () => TSS_COVER_ENTITY,
  TSS_CUSTOMER_STRENGTHS_ENTITY: () => TSS_CUSTOMER_STRENGTHS_ENTITY,
  TSS_DISPLAY_ENTITIES: () => TSS_DISPLAY_ENTITIES,
  TSS_DROPDOWN_LISTS: () => TSS_DROPDOWN_LISTS,
  TSS_GOALS_ENTITY: () => TSS_GOALS_ENTITY,
  TSS_HEADER_ALIASES: () => TSS_HEADER_ALIASES,
  TSS_HOUSING_BARRIERS_ENTITY: () => TSS_HOUSING_BARRIERS_ENTITY,
  TSS_PROGRESS_NOTES_ENTITY: () => TSS_PROGRESS_NOTES_ENTITY,
  TSS_SHEETS: () => TSS_SHEETS,
  TSS_SMART_GOALS_ACRONYM_ENTITY: () => TSS_SMART_GOALS_ACRONYM_ENTITY,
  TSS_WORKBOOK_VARIANT_RULES: () => TSS_WORKBOOK_VARIANT_RULES,
  TSS_WORKSHEET_CONFIG: () => TSS_WORKSHEET_CONFIG,
  TssDataTypeSchema: () => TssDataTypeSchema,
  TssDirectionSchema: () => TssDirectionSchema,
  TssDisplayEntityConfigSchema: () => TssDisplayEntityConfigSchema,
  TssDropdownListSchema: () => TssDropdownListSchema,
  TssEntitySectionSchema: () => TssEntitySectionSchema,
  TssExtractedCellSchema: () => TssExtractedCellSchema,
  TssExtractedEntitySchema: () => TssExtractedEntitySchema,
  TssExtractedEntityStatusSchema: () => TssExtractedEntityStatusSchema,
  TssExtractedRowSchema: () => TssExtractedRowSchema,
  TssExtractionWarningSchema: () => TssExtractionWarningSchema,
  TssHeaderResolutionModeSchema: () => TssHeaderResolutionModeSchema,
  TssInlineDropdownListSchema: () => TssInlineDropdownListSchema,
  TssKeyValueCellConfigSchema: () => TssKeyValueCellConfigSchema,
  TssNoteSectionBreakSchema: () => TssNoteSectionBreakSchema,
  TssOrgConfigOverrideSchema: () => TssOrgConfigOverrideSchema,
  TssParsingDefaultsSchema: () => TssParsingDefaultsSchema,
  TssRenderKindSchema: () => TssRenderKindSchema,
  TssSheetConfigSchema: () => TssSheetConfigSchema,
  TssSheetDropdownListSchema: () => TssSheetDropdownListSchema,
  TssSheetResolutionModeSchema: () => TssSheetResolutionModeSchema,
  TssSmartHeaderConfigSchema: () => TssSmartHeaderConfigSchema,
  TssTableRangeConfigSchema: () => TssTableRangeConfigSchema,
  TssVariantRuleSchema: () => TssVariantRuleSchema,
  TssWorkbookExtractSchema: () => TssWorkbookExtractSchema,
  TssWorkbookVariantSchema: () => TssWorkbookVariantSchema,
  TssWorksheetConfigSchema: () => TssWorksheetConfigSchema,
  resolveTssWorksheetConfig: () => resolveTssWorksheetConfig,
  resolveWorkbookVariant: () => resolveWorkbookVariant,
  smartHeaderId: () => smartHeaderId
});
var TssWorkbookVariantSchema = import_zod2.z.enum(["payer", "nonPayer", "unknown"]);
var TssDirectionSchema = import_zod2.z.enum(["worksheetToApp", "appToWorksheet", "bidirectional"]);
var TssDataTypeSchema = import_zod2.z.enum([
  "string",
  "longText",
  "number",
  "currency",
  "date",
  "time",
  "duration",
  "url",
  "select",
  "signature",
  "computed"
]);
var TssRenderKindSchema = import_zod2.z.enum([
  "keyValueCard",
  "summaryBox",
  "sectionedTable",
  "dataTable",
  "budgetTable",
  "acronymCard"
]);
var TssSheetResolutionModeSchema = import_zod2.z.enum([
  "exactOrAlias",
  "containsAnyAlias",
  "anchorScanFallback"
]);
var TssHeaderResolutionModeSchema = import_zod2.z.enum([
  "fixedRowPreferred",
  "anchorThenOffset",
  "scanWindow"
]);
var TssEntitySectionSchema = import_zod2.z.enum([
  "cover",
  "housingPlan",
  "notes",
  "budget",
  "reference"
]);
var TssSmartHeaderConfigSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  expected: import_zod2.z.string(),
  aliases: import_zod2.z.array(import_zod2.z.string()).optional(),
  required: import_zod2.z.boolean().optional(),
  dataType: TssDataTypeSchema.optional(),
  optionSourceId: import_zod2.z.string().optional(),
  appField: import_zod2.z.string().optional(),
  clientDocField: import_zod2.z.string().optional(),
  display: import_zod2.z.object({
    label: import_zod2.z.string().optional(),
    width: import_zod2.z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    multiline: import_zod2.z.boolean().optional(),
    hideInCompact: import_zod2.z.boolean().optional(),
    badge: import_zod2.z.boolean().optional()
  }).passthrough().optional(),
  write: import_zod2.z.object({
    enabled: import_zod2.z.boolean(),
    lockIfFormula: import_zod2.z.boolean().optional()
  }).passthrough().optional()
}).passthrough();
var TssSheetConfigSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  expectedNames: import_zod2.z.array(import_zod2.z.string()),
  aliases: import_zod2.z.array(import_zod2.z.string()).optional(),
  hidden: import_zod2.z.boolean().optional(),
  resolutionMode: TssSheetResolutionModeSchema,
  headerIdStrategy: import_zod2.z.object({
    normalize: import_zod2.z.literal("smartHeaderIdV1"),
    collisionPolicy: import_zod2.z.enum(["preferExactThenAliasThenLeftmost", "throw"])
  }).passthrough().optional()
}).passthrough();
var TssTableRangeConfigSchema = import_zod2.z.object({
  sheetId: import_zod2.z.string(),
  anchorText: import_zod2.z.string().optional(),
  headerRow: import_zod2.z.number().int().optional(),
  headerRowCandidates: import_zod2.z.array(import_zod2.z.number().int()).optional(),
  headerScan: import_zod2.z.object({
    mode: TssHeaderResolutionModeSchema,
    minRow: import_zod2.z.number().int(),
    maxRow: import_zod2.z.number().int(),
    mustContainHeaderIds: import_zod2.z.array(import_zod2.z.string()),
    scoreHeaderIds: import_zod2.z.array(import_zod2.z.string()).optional()
  }).passthrough().optional(),
  dataStartRowOffset: import_zod2.z.number().int().optional(),
  dataStartRow: import_zod2.z.number().int().optional(),
  dataEnd: import_zod2.z.object({
    mode: import_zod2.z.enum(["firstBlankRow", "untilNextAnchor", "fixedRow", "worksheetUsedRange"]),
    fixedRow: import_zod2.z.number().int().optional(),
    nextAnchorText: import_zod2.z.string().optional(),
    minConsecutiveBlankRows: import_zod2.z.number().int().optional()
  }).passthrough().optional(),
  expectedColumns: import_zod2.z.array(import_zod2.z.string()).optional()
}).passthrough();
var TssKeyValueCellConfigSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  label: import_zod2.z.string(),
  aliases: import_zod2.z.array(import_zod2.z.string()).optional(),
  appField: import_zod2.z.string(),
  clientDocField: import_zod2.z.string().optional(),
  dataType: TssDataTypeSchema,
  sheetLabelCell: import_zod2.z.string().optional(),
  sheetValueCell: import_zod2.z.string().optional(),
  labelSearch: import_zod2.z.object({
    sheetId: import_zod2.z.string(),
    labelAliases: import_zod2.z.array(import_zod2.z.string()),
    scanRange: import_zod2.z.string(),
    valueOffset: import_zod2.z.object({ rows: import_zod2.z.number().int(), cols: import_zod2.z.number().int() }).optional(),
    fallbackValueOffsets: import_zod2.z.array(import_zod2.z.object({ rows: import_zod2.z.number().int(), cols: import_zod2.z.number().int() })).optional()
  }).passthrough().optional(),
  tunnelToClientDoc: import_zod2.z.boolean().optional(),
  required: import_zod2.z.boolean().optional()
}).passthrough();
var TssEntitySourceSchema = import_zod2.z.object({
  sheetId: import_zod2.z.string().optional(),
  range: TssTableRangeConfigSchema.optional(),
  keyValues: import_zod2.z.array(TssKeyValueCellConfigSchema).optional(),
  staticContent: import_zod2.z.unknown().optional()
}).passthrough();
var TssEntityDisplaySchema = import_zod2.z.object({
  titleField: import_zod2.z.string().optional(),
  subtitleField: import_zod2.z.string().optional(),
  emptyState: import_zod2.z.string().optional(),
  compactFields: import_zod2.z.array(import_zod2.z.string()).optional(),
  sort: import_zod2.z.array(import_zod2.z.object({ field: import_zod2.z.string(), direction: import_zod2.z.enum(["asc", "desc"]) })).optional(),
  groupBy: import_zod2.z.string().optional(),
  totalFields: import_zod2.z.array(import_zod2.z.string()).optional()
}).passthrough();
var TssVariantOverrideSchema = import_zod2.z.object({
  source: TssEntitySourceSchema.optional(),
  fields: import_zod2.z.array(TssSmartHeaderConfigSchema).optional(),
  display: TssEntityDisplaySchema.optional()
}).passthrough();
var TssDisplayEntityConfigSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  label: import_zod2.z.string(),
  section: TssEntitySectionSchema,
  renderKind: TssRenderKindSchema,
  direction: TssDirectionSchema,
  source: TssEntitySourceSchema,
  fields: import_zod2.z.array(TssSmartHeaderConfigSchema).optional(),
  dropdowns: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
  display: TssEntityDisplaySchema.optional(),
  // Per-variant source/field overrides — keyed by TssWorkbookVariant value.
  variantOverrides: import_zod2.z.record(import_zod2.z.string(), TssVariantOverrideSchema).optional()
}).passthrough();
var TssSheetDropdownListSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  sheetId: import_zod2.z.string(),
  namedRange: import_zod2.z.string(),
  expectedHeader: import_zod2.z.string(),
  expectedColumn: import_zod2.z.string(),
  values: import_zod2.z.array(import_zod2.z.string())
}).passthrough();
var TssInlineDropdownListSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  inlineValues: import_zod2.z.literal(true),
  values: import_zod2.z.array(import_zod2.z.string())
}).passthrough();
var TssDropdownListSchema = import_zod2.z.union([
  TssSheetDropdownListSchema,
  TssInlineDropdownListSchema
]);
var TssVariantRuleSchema = import_zod2.z.object({
  variant: TssWorkbookVariantSchema,
  ifSheetExists: import_zod2.z.string(),
  notes: import_zod2.z.string().optional()
}).passthrough();
var TssParsingDefaultsSchema = import_zod2.z.object({
  rowDriftTolerance: import_zod2.z.number().int().optional(),
  emptyRowPolicy: import_zod2.z.string().optional(),
  mergedCellPolicy: import_zod2.z.string().optional(),
  coverSheetTunnelPolicy: import_zod2.z.string().optional(),
  datePolicy: import_zod2.z.string().optional()
}).passthrough();
var TssWorksheetConfigSchema = import_zod2.z.object({
  version: import_zod2.z.string(),
  workbookKind: import_zod2.z.string(),
  smartHeaderIdVersion: import_zod2.z.string(),
  sheets: import_zod2.z.record(import_zod2.z.string(), TssSheetConfigSchema),
  variantRules: import_zod2.z.array(TssVariantRuleSchema),
  dropdownLists: import_zod2.z.record(import_zod2.z.string(), TssDropdownListSchema),
  headerAliases: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string()).or(import_zod2.z.array(import_zod2.z.string()).readonly())),
  entities: import_zod2.z.record(import_zod2.z.string(), TssDisplayEntityConfigSchema),
  parsingDefaults: TssParsingDefaultsSchema.optional()
}).passthrough();
var TssOrgConfigOverrideSchema = import_zod2.z.object({
  // Force a specific variant instead of auto-detecting from sheet names.
  forceVariant: TssWorkbookVariantSchema.optional(),
  // Disable specific entity IDs (e.g. ["budget"] for orgs that don't use budget sheet).
  disabledEntityIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  // Extend (not replace) sheet tab name aliases per sheet ID.
  // e.g. { progressNotes: ["Service Notes", "Case Notes"] }
  sheetAliasExtensions: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())).optional(),
  // Extend header aliases per entity ID → field ID → extra alias strings.
  // e.g. { progressNotes: { summary: ["Note Summary", "What Happened"] } }
  fieldAliasExtensions: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.record(import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string()))).optional(),
  // Override display properties per entity ID → field ID.
  // e.g. { goals: { status: { label: "Goal Status", badge: true } } }
  fieldDisplayOverrides: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.record(
    import_zod2.z.string(),
    import_zod2.z.object({
      label: import_zod2.z.string().optional(),
      width: import_zod2.z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
      hideInCompact: import_zod2.z.boolean().optional(),
      badge: import_zod2.z.boolean().optional()
    }).passthrough()
  )).optional(),
  // Override the empty state message per entity ID.
  entityEmptyStateOverrides: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
  // Override entity label (display name) per entity ID.
  entityLabelOverrides: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional()
}).passthrough();
var TssExtractionWarningSchema = import_zod2.z.object({
  code: import_zod2.z.string(),
  message: import_zod2.z.string(),
  entityId: import_zod2.z.string().optional(),
  sheetId: import_zod2.z.string().optional(),
  fieldId: import_zod2.z.string().optional(),
  severity: import_zod2.z.enum(["info", "warning", "error"]).optional()
}).passthrough();
var TssExtractedEntityStatusSchema = import_zod2.z.enum([
  "extracted",
  // data found and mapped
  "empty",
  // sheet+headers resolved, but no data rows / values
  "unsupported",
  // renderKind not implemented in this slice
  "missing_sheet",
  // entity's sheet could not be resolved in the workbook
  "missing_headers",
  // sheet found but required headers/anchors not located
  "error"
  // unexpected failure extracting this entity
]);
var TssExtractedCellSchema = import_zod2.z.object({
  value: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number(), import_zod2.z.boolean(), import_zod2.z.null()]),
  displayValue: import_zod2.z.string().optional(),
  kind: import_zod2.z.enum(["string", "number", "boolean", "date", "empty"]).optional()
}).passthrough();
var TssExtractedRowSchema = import_zod2.z.object({
  // Stable per-row key for React keys and future write targeting. NOT an A1 range.
  rowKey: import_zod2.z.string(),
  values: import_zod2.z.record(import_zod2.z.string(), TssExtractedCellSchema),
  warnings: import_zod2.z.array(TssExtractionWarningSchema).optional()
}).passthrough();
var TssNoteSectionBreakSchema = import_zod2.z.object({
  rowKey: import_zod2.z.string(),
  text: import_zod2.z.string()
}).passthrough();
var TssExtractedEntitySchema = import_zod2.z.object({
  entityId: import_zod2.z.string(),
  renderKind: TssRenderKindSchema,
  label: import_zod2.z.string(),
  section: TssEntitySectionSchema,
  status: TssExtractedEntityStatusSchema,
  // keyValueCard / summaryBox — single record of fieldId → cell
  values: import_zod2.z.record(import_zod2.z.string(), TssExtractedCellSchema).optional(),
  // dataTable — ordered rows. For stacked multi-variant tables (progress notes),
  // each row's values are mapped per ITS OWN section's column layout.
  rows: import_zod2.z.array(TssExtractedRowSchema).optional(),
  // Status-change banners separating stacked sections (progress notes).
  sectionBreaks: import_zod2.z.array(TssNoteSectionBreakSchema).optional(),
  // budgetTable — structured later; left loose for now
  budget: import_zod2.z.unknown().optional(),
  warnings: import_zod2.z.array(TssExtractionWarningSchema).optional()
}).passthrough();
var TssWorkbookExtractSchema = import_zod2.z.object({
  customerId: import_zod2.z.string(),
  spreadsheetId: import_zod2.z.string(),
  spreadsheetName: import_zod2.z.string().optional(),
  variant: TssWorkbookVariantSchema,
  entities: import_zod2.z.array(TssExtractedEntitySchema),
  warnings: import_zod2.z.array(TssExtractionWarningSchema),
  extractedAt: import_zod2.z.string(),
  // ISO
  // Deferred: requires Drive metadata, not just Sheets scope. Optional for slice A.
  spreadsheetModifiedTime: import_zod2.z.string().nullable().optional(),
  configVersion: import_zod2.z.string().optional()
}).passthrough();
function smartHeaderId(value) {
  return String(value || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[≤]/g, " less than or equal ").replace(/[≥]/g, " greater than or equal ").replace(/[#]/g, " number ").replace(/[&/+]/g, " and ").replace(/[()\[\]{}:;,.!?"""'`]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
var TSS_SHEETS = {
  lists: {
    id: "lists",
    expectedNames: ["_Lists"],
    aliases: ["Lists", "Dropdown Lists", "_lists"],
    hidden: true,
    resolutionMode: "exactOrAlias",
    headerIdStrategy: { normalize: "smartHeaderIdV1", collisionPolicy: "preferExactThenAliasThenLeftmost" }
  },
  cover: {
    id: "cover",
    expectedNames: ["1. Cover Sheet"],
    aliases: ["Cover Sheet", "Client Cover Sheet", "1 Cover Sheet"],
    resolutionMode: "exactOrAlias"
  },
  housingPlan: {
    id: "housingPlan",
    expectedNames: ["4. Housing Plan"],
    aliases: ["Housing Plan", "4 Housing Plan", "Plan"],
    resolutionMode: "exactOrAlias",
    headerIdStrategy: { normalize: "smartHeaderIdV1", collisionPolicy: "preferExactThenAliasThenLeftmost" }
  },
  progressNotes: {
    id: "progressNotes",
    expectedNames: ["6. Progress Notes", "Progress Notes"],
    aliases: ["Progress Notes", "Notes", "Service Notes", "6 Progress Notes"],
    resolutionMode: "exactOrAlias",
    headerIdStrategy: { normalize: "smartHeaderIdV1", collisionPolicy: "preferExactThenAliasThenLeftmost" }
  },
  budget: {
    id: "budget",
    expectedNames: ["Budget"],
    aliases: ["Client Budget", "Monthly Budget"],
    resolutionMode: "exactOrAlias",
    headerIdStrategy: { normalize: "smartHeaderIdV1", collisionPolicy: "preferExactThenAliasThenLeftmost" }
  }
};
var TSS_WORKBOOK_VARIANT_RULES = [
  {
    variant: "payer",
    ifSheetExists: "6. Progress Notes",
    notes: "Full worksheet. Progress Notes header usually row 3; Housing Plan goal table usually starts row 22."
  },
  {
    variant: "nonPayer",
    ifSheetExists: "Progress Notes",
    notes: "Simplified worksheet. Progress Notes header usually row 1; Housing Plan goal table usually starts row 19."
  }
];
var TSS_HEADER_ALIASES = {
  clientName: ["Client Name", "Member Name", "Customer Name", "Participant Name"],
  dob: ["DOB", "Date of Birth"],
  hmisCwId: ["HMIS/CW ID", "HMIS ID", "CWID", "CaseWorthy ID", "Caseworthy ID", "HMIS/CWID"],
  medicaidId: ["Medicaid ID", "MA ID", "Montana Medicaid ID"],
  primaryCaseManager: ["Primary CM", "Case Manager", "Primary Case Manager", "Staff Name"],
  phone: ["Phone", "Phone Number", "Client Phone"],
  email: ["Email", "Email Address", "Client Email"],
  providerSelection: ["Provider Selection", "Provider Choice"],
  otherProviderName: ["If Other, Provider Name", "Other Provider Name", "Provider Name"],
  quickLinks: ["Quick Links (paste URLs to tabs/docs)", "Quick Links", "Links"],
  currentPaNumber: ["Current PA Number", "PA Number", "Prior Authorization Number"],
  paEffective: ["PA Effective", "PA Effective Date", "Authorization Start"],
  paExpiration: ["PA Expiration", "PA Expiration Date", "Authorization End"],
  next120DayReviewDue: ["Next 120-day Review Due", "Review Due (\u2264120 days)", "Next Review Due"],
  nextAnnualReAuthDue: ["Next Annual Re-Auth Due", "Next Annual Reauth Due", "Annual Re-Authorization Due"],
  planDate: ["Plan Date", "Housing Plan Date"],
  reviewDue: ["Review Due (\u2264120 days)", "Review Due", "Next Review Due"],
  clientStrengths: ["Client Strengths", "Strengths", "Customer Strengths"],
  cmSummary: ["CM Summary", "Case Manager Summary", "Staff Summary"],
  barrier: ["Barrier", "Housing Barrier", "Housing Barriers"],
  mitigationSupports: ["Mitigation/Supports", "Mitigation Supports", "Supports", "Plan to Address Barrier"],
  serviceTier: ["Service Tier (U1/U2/U3)", "Service Tier: cheatsheets here and here ", "Service Tier", "Tier"],
  goalSmart: ["Goal (SMART)", "SMART Goal", "Goal"],
  objective: ["Objective", "Objectives"],
  interventionTask: ["Intervention/Task", "Intervention", "Task"],
  goalCompletionCriteria: ["Goal Completion Criteria", "Completion Criteria", "Success Criteria"],
  responsible: ["Responsible", "Responsible Party", "Owner"],
  targetDate: ["Target Date", "Due Date"],
  status: ["Status", "Goal Status"],
  notes: ["Notes", "Goal Notes"],
  progressDate: ["Date", "Service Date", "Note Date"],
  startTime: ["Start Time"],
  endTime: ["End Time"],
  totalTime: ["Total Time", "Duration"],
  summary: ["Summary (what & why)", "Summary", "Note Summary"],
  clientResponseProgress: ["Client Response/Progress", "Client Response", "Progress"],
  linkedPlanGoal: ["Linked Plan Goal", "Linked Goal", "Goal #"],
  location: ["Location of appointment", "Location", "Appointment Location"],
  staffName: ["Staff name ", "Staff Name", "Staff"],
  staffInitial: ["Staff initial", "Staff Initial", "Staff Initials"],
  staffSignature: ["Staff signature", "Staff Signature", "Signature"],
  completionDate: ["Date of completion", "Completion Date"]
};
var TSS_DROPDOWN_LISTS = {
  yesNo: { id: "yesNo", sheetId: "lists", namedRange: "YesNo", expectedHeader: "YesNo", expectedColumn: "A", values: ["Yes", "No"] },
  providerChoice: { id: "providerChoice", sheetId: "lists", namedRange: "ProviderChoice", expectedHeader: "ProviderChoice", expectedColumn: "B", values: ["HRDC", "Other"] },
  supportItem: { id: "supportItem", sheetId: "lists", namedRange: "SupportItem", expectedHeader: "SupportItem", expectedColumn: "C", values: ["Application Fee (H0044-UA)", "Security Deposit (H0044-UD)"] },
  serviceTier: { id: "serviceTier", sheetId: "lists", namedRange: "ServiceTier", expectedHeader: "ServiceTier", expectedColumn: "D", values: ["U1 - Assessment & Planning", "U2 - Pre-Tenancy", "U3 - Tenancy Sustaining"] },
  method: { id: "method", sheetId: "lists", namedRange: "Method", expectedHeader: "Method", expectedColumn: "E", values: ["Portal", "IVR", "Email", "Phone", "In Person"] },
  placeOfService: { id: "placeOfService", sheetId: "lists", namedRange: "POS_List", expectedHeader: "POS_List", expectedColumn: "F", values: ["11 - Office", "12 - Home", "99 - Other"] },
  statusList: { id: "statusList", sheetId: "lists", namedRange: "StatusList", expectedHeader: "StatusList", expectedColumn: "G", values: ["Open", "Closed", "On Hold"] },
  hardshipDetermination: { id: "hardshipDetermination", sheetId: "lists", namedRange: "HardshipDet", expectedHeader: "HardshipDet", expectedColumn: "H", values: ["Full Waiver", "Partial Waiver", "Denied", "N/A"] },
  finalStatus: { id: "finalStatus", sheetId: "lists", namedRange: "FinalStatus", expectedHeader: "FinalStatus", expectedColumn: "I", values: ["Paid in Full", "Partially Paid", "Unpaid", "Waived (Hardship)"] },
  denialReason: { id: "denialReason", sheetId: "lists", namedRange: "DenialReason", expectedHeader: "DenialReason", expectedColumn: "J", values: ["Missing PA", "Eligibility Issue", "Incorrect Code/Modifier", "Missing Documentation", "Other"] },
  actionTaken: { id: "actionTaken", sheetId: "lists", namedRange: "ActionTaken", expectedHeader: "ActionTaken", expectedColumn: "K", values: ["Initial Invoice", "Reminder Sent", "Follow-Up Call", "Hardship Offered", "Hardship Reviewed", "Final Notice", "Payment Received"] },
  contactMethod: { id: "contactMethod", sheetId: "lists", namedRange: "ContactMethod", expectedHeader: "ContactMethod", expectedColumn: "L", values: ["Email", "Phone", "Mail", "In Person"] },
  clientResponse: { id: "clientResponse", sheetId: "lists", namedRange: "ClientResponse", expectedHeader: "ClientResponse", expectedColumn: "M", values: ["Engaged", "No Response", "Partial Payment", "Requested Hardship", "Unable to Contact", "Declined"] },
  responsibleParty: { id: "responsibleParty", inlineValues: true, values: ["Client", "Case Manager", "Client and Case Manager", "Other", "Select"] },
  appointmentLocation: { id: "appointmentLocation", inlineValues: true, values: ["Market Place", "Tracy Office", "Homeward Point", "LWC", "Livingston Office", "Wheat Suites", "Other"] }
};
var TSS_COVER_ENTITY = {
  id: "coverSheet",
  label: "Cover Sheet",
  section: "cover",
  renderKind: "keyValueCard",
  direction: "bidirectional",
  source: {
    sheetId: "cover",
    keyValues: [
      { id: "clientName", label: "Client Name", appField: "clientName", clientDocField: "client.name", dataType: "string", sheetLabelCell: "A3", sheetValueCell: "B3", tunnelToClientDoc: true, required: true },
      { id: "dob", label: "DOB", appField: "dob", clientDocField: "client.dob", dataType: "date", sheetLabelCell: "C3", sheetValueCell: "D3", labelSearch: { sheetId: "cover", labelAliases: [...TSS_HEADER_ALIASES.dob], scanRange: "A1:E12", valueOffset: { rows: 0, cols: 1 }, fallbackValueOffsets: [{ rows: 1, cols: 0 }, { rows: 0, cols: -1 }] }, tunnelToClientDoc: true },
      { id: "hmisCwId", label: "HMIS/CW ID", appField: "hmisCwId", clientDocField: "client.caseworthyId", dataType: "string", labelSearch: { sheetId: "cover", labelAliases: [...TSS_HEADER_ALIASES.hmisCwId], scanRange: "A1:E12", valueOffset: { rows: 0, cols: 1 }, fallbackValueOffsets: [{ rows: 1, cols: 0 }, { rows: 0, cols: -1 }] }, tunnelToClientDoc: true },
      { id: "medicaidId", label: "Medicaid ID", appField: "medicaidId", clientDocField: "client.medicaidId", dataType: "string", sheetLabelCell: "E3", labelSearch: { sheetId: "cover", labelAliases: [...TSS_HEADER_ALIASES.medicaidId], scanRange: "A1:E12", valueOffset: { rows: 0, cols: 1 }, fallbackValueOffsets: [{ rows: 1, cols: 0 }, { rows: 0, cols: -1 }] }, tunnelToClientDoc: true },
      { id: "primaryCaseManager", label: "Primary CM", appField: "primaryCaseManager", clientDocField: "client.caseManager", dataType: "string", sheetLabelCell: "A4", sheetValueCell: "B4", tunnelToClientDoc: true },
      { id: "phone", label: "Phone", appField: "phone", clientDocField: "client.phone", dataType: "string", sheetLabelCell: "C4", sheetValueCell: "D4", tunnelToClientDoc: true },
      { id: "email", label: "Email", appField: "email", clientDocField: "client.email", dataType: "string", sheetLabelCell: "E4", labelSearch: { sheetId: "cover", labelAliases: [...TSS_HEADER_ALIASES.email], scanRange: "A1:E12", valueOffset: { rows: 0, cols: 1 }, fallbackValueOffsets: [{ rows: 1, cols: 0 }, { rows: 0, cols: -1 }] }, tunnelToClientDoc: true },
      { id: "providerSelection", label: "Provider Selection", appField: "providerSelection", dataType: "select", sheetLabelCell: "A5", sheetValueCell: "B5", aliases: [...TSS_HEADER_ALIASES.providerSelection] },
      { id: "otherProviderName", label: "If Other, Provider Name", appField: "otherProviderName", dataType: "string", sheetLabelCell: "C5", sheetValueCell: "D5" },
      { id: "quickLinks", label: "Quick Links", appField: "quickLinks", dataType: "url", sheetLabelCell: "E5" },
      { id: "currentPaNumber", label: "Current PA Number", appField: "currentPaNumber", dataType: "string", sheetLabelCell: "A8", sheetValueCell: "A9" },
      { id: "paEffective", label: "PA Effective", appField: "paEffective", dataType: "date", sheetLabelCell: "B8", sheetValueCell: "B9" },
      { id: "paExpiration", label: "PA Expiration", appField: "paExpiration", dataType: "date", sheetLabelCell: "C8", sheetValueCell: "C9" },
      { id: "next120DayReviewDue", label: "Next 120-day Review Due", appField: "next120DayReviewDue", dataType: "date", sheetLabelCell: "D8", sheetValueCell: "D9" },
      { id: "nextAnnualReAuthDue", label: "Next Annual Re-Auth Due", appField: "nextAnnualReAuthDue", dataType: "date", sheetLabelCell: "E8", sheetValueCell: "E9" }
    ]
  },
  dropdowns: { providerSelection: "providerChoice" },
  display: { titleField: "clientName", compactFields: ["dob", "phone", "hmisCwId", "medicaidId", "primaryCaseManager"], emptyState: "No cover sheet values found." }
};
var TSS_CUSTOMER_STRENGTHS_ENTITY = {
  id: "customerStrengths",
  label: "Customer Strengths",
  section: "housingPlan",
  renderKind: "summaryBox",
  direction: "bidirectional",
  source: {
    sheetId: "housingPlan",
    range: {
      sheetId: "housingPlan",
      anchorText: "Client Strengths",
      headerRowCandidates: [4, 7],
      headerScan: { mode: "scanWindow", minRow: 1, maxRow: 12, mustContainHeaderIds: ["client_strengths"], scoreHeaderIds: ["client_strengths", "cm_summary"] },
      dataStartRowOffset: 1,
      dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Barrier", minConsecutiveBlankRows: 2 },
      expectedColumns: ["clientStrengths", "cmSummary"]
    }
  },
  fields: [
    { id: "clientStrengths", expected: "Client Strengths", appField: "clientStrengths", dataType: "longText", required: true, display: { label: "Customer Strengths", width: "xl", multiline: true } },
    { id: "cmSummary", expected: "CM Summary", appField: "cmSummary", dataType: "longText", display: { label: "Case Manager Summary", width: "xl", multiline: true } }
  ],
  variantOverrides: {
    payer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "Client Strengths", headerRow: 7, dataStartRow: 8, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Barrier", minConsecutiveBlankRows: 2 }, expectedColumns: ["clientStrengths"] } } },
    nonPayer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "Client Strengths", headerRow: 4, dataStartRow: 5, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Barrier", minConsecutiveBlankRows: 2 }, expectedColumns: ["clientStrengths", "cmSummary"] } } }
  },
  display: { emptyState: "No customer strengths entered yet." }
};
var TSS_HOUSING_BARRIERS_ENTITY = {
  id: "housingBarriers",
  label: "Housing Barriers",
  section: "housingPlan",
  renderKind: "dataTable",
  direction: "bidirectional",
  source: {
    sheetId: "housingPlan",
    range: {
      sheetId: "housingPlan",
      anchorText: "Barrier",
      headerRowCandidates: [10, 13],
      headerScan: { mode: "scanWindow", minRow: 8, maxRow: 20, mustContainHeaderIds: ["barrier"], scoreHeaderIds: ["barrier", "mitigation_supports", "service_tier_u1_u2_u3", "service_tier"] },
      dataStartRowOffset: 1,
      dataEnd: { mode: "untilNextAnchor", nextAnchorText: "SMART Goals / Objectives / Interventions", minConsecutiveBlankRows: 2 },
      expectedColumns: ["barrier", "mitigationSupports", "serviceTier"]
    }
  },
  fields: [
    { id: "barrier", expected: "Barrier", appField: "barrier", dataType: "longText", required: true, display: { label: "Barrier", width: "lg", multiline: true } },
    { id: "mitigationSupports", expected: "Mitigation/Supports", appField: "mitigationSupports", dataType: "longText", display: { label: "Mitigation / Supports", width: "xl", multiline: true } },
    { id: "serviceTier", expected: "Service Tier (U1/U2/U3)", appField: "serviceTier", dataType: "select", optionSourceId: "serviceTier", display: { label: "Tier", width: "md", badge: true } }
  ],
  dropdowns: { serviceTier: "serviceTier" },
  variantOverrides: {
    payer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "Barrier", headerRow: 13, dataStartRow: 14, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "SMART Goals / Objectives / Interventions", minConsecutiveBlankRows: 2 }, expectedColumns: ["barrier", "mitigationSupports", "serviceTier"] } } },
    nonPayer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "Barrier", headerRow: 10, dataStartRow: 11, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "SMART Goals / Objectives / Interventions", minConsecutiveBlankRows: 2 }, expectedColumns: ["barrier", "mitigationSupports"] } } }
  },
  display: { emptyState: "No housing barriers entered yet.", compactFields: ["barrier", "serviceTier"] }
};
var TSS_GOALS_ENTITY = {
  id: "goals",
  label: "Goals",
  section: "housingPlan",
  renderKind: "dataTable",
  direction: "bidirectional",
  source: {
    sheetId: "housingPlan",
    range: {
      sheetId: "housingPlan",
      anchorText: "SMART Goals / Objectives / Interventions",
      headerRowCandidates: [19, 22],
      headerScan: { mode: "anchorThenOffset", minRow: 15, maxRow: 28, mustContainHeaderIds: ["goal_smart", "objective", "intervention_task"], scoreHeaderIds: ["goal_smart", "objective", "intervention_task", "goal_completion_criteria", "responsible", "target_date", "service_tier", "status", "notes"] },
      dataStartRowOffset: 1,
      dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Plan Reviews", minConsecutiveBlankRows: 3 },
      expectedColumns: ["goalSmart", "objective", "interventionTask", "goalCompletionCriteria", "responsible", "targetDate", "serviceTier", "status", "notes"]
    }
  },
  fields: [
    { id: "goalSmart", expected: "Goal (SMART)", appField: "goalSmart", dataType: "longText", required: true, display: { label: "Goal", width: "xl", multiline: true } },
    { id: "objective", expected: "Objective", appField: "objective", dataType: "longText", required: true, display: { label: "Objective", width: "xl", multiline: true } },
    { id: "interventionTask", expected: "Intervention/Task", appField: "interventionTask", dataType: "longText", display: { label: "Intervention / Task", width: "xl", multiline: true } },
    { id: "goalCompletionCriteria", expected: "Goal Completion Criteria", appField: "goalCompletionCriteria", dataType: "longText", display: { label: "Completion Criteria", width: "lg", multiline: true } },
    { id: "responsible", expected: "Responsible", appField: "responsible", dataType: "select", optionSourceId: "responsibleParty", display: { label: "Responsible", width: "md" } },
    { id: "targetDate", expected: "Target Date", appField: "targetDate", dataType: "date", display: { label: "Target Date", width: "sm" } },
    { id: "serviceTier", expected: "Service Tier", appField: "serviceTier", dataType: "select", optionSourceId: "serviceTier", display: { label: "Tier", width: "md", badge: true } },
    { id: "status", expected: "Status", appField: "status", dataType: "select", optionSourceId: "statusList", display: { label: "Status", width: "sm", badge: true } },
    { id: "notes", expected: "Notes", appField: "notes", dataType: "longText", display: { label: "Notes", width: "xl", multiline: true, hideInCompact: true } }
  ],
  dropdowns: { responsible: "responsibleParty", serviceTier: "serviceTier", status: "statusList" },
  variantOverrides: {
    payer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "SMART Goals / Objectives / Interventions", headerRow: 22, dataStartRow: 23, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Plan Reviews", minConsecutiveBlankRows: 3 }, expectedColumns: ["goalSmart", "objective", "interventionTask", "goalCompletionCriteria", "responsible", "targetDate", "serviceTier", "status", "notes"] } } },
    nonPayer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "SMART Goals / Objectives / Interventions", headerRow: 19, dataStartRow: 20, dataEnd: { mode: "firstBlankRow", minConsecutiveBlankRows: 3 }, expectedColumns: ["goalSmart", "objective", "interventionTask", "responsible"] } } }
  },
  display: { titleField: "goalSmart", subtitleField: "objective", compactFields: ["goalSmart", "objective", "responsible", "targetDate", "status"], emptyState: "No SMART goals entered yet.", sort: [{ field: "targetDate", direction: "asc" }] }
};
var TSS_SMART_GOALS_ACRONYM_ENTITY = {
  id: "smartGoalsAcronym",
  label: "SMART Goals",
  section: "reference",
  renderKind: "acronymCard",
  direction: "worksheetToApp",
  source: { staticContent: { title: "SMART GOALS", items: [{ letter: "S", label: "Specific" }, { letter: "M", label: "Measurable" }, { letter: "A", label: "Achievable" }, { letter: "R", label: "Realistic" }, { letter: "T", label: "Timely" }] } },
  display: { emptyState: "Use SMART criteria to keep goals concrete, reviewable, and tied to service activity." }
};
var TSS_PROGRESS_NOTES_ENTITY = {
  id: "progressNotes",
  label: "Progress Notes",
  section: "notes",
  renderKind: "dataTable",
  direction: "bidirectional",
  source: {
    sheetId: "progressNotes",
    range: {
      sheetId: "progressNotes",
      headerRowCandidates: [1, 3],
      headerScan: { mode: "scanWindow", minRow: 1, maxRow: 6, mustContainHeaderIds: ["date", "summary_what_and_why"], scoreHeaderIds: ["date", "start_time", "end_time", "total_time", "service_tier_cheatsheets_here_and_here", "summary_what_and_why", "client_response_progress", "linked_plan_goal", "location_of_appointment", "staff_name", "staff_initial", "staff_signature", "date_of_completion"] },
      dataStartRowOffset: 1,
      dataEnd: { mode: "firstBlankRow", minConsecutiveBlankRows: 10 },
      expectedColumns: ["progressDate", "startTime", "endTime", "totalTime", "serviceTier", "summary", "clientResponseProgress", "linkedPlanGoal", "location", "staffName", "staffSignature", "completionDate"]
    }
  },
  fields: [
    { id: "progressDate", expected: "Date", appField: "progressDate", dataType: "date", required: true, display: { label: "Date", width: "sm" } },
    { id: "startTime", expected: "Start Time", appField: "startTime", dataType: "time", display: { label: "Start", width: "xs" } },
    { id: "endTime", expected: "End Time", appField: "endTime", dataType: "time", display: { label: "End", width: "xs" } },
    { id: "totalTime", expected: "Total Time", appField: "totalTime", dataType: "duration", display: { label: "Total", width: "xs" }, write: { enabled: false, lockIfFormula: true } },
    { id: "serviceTier", expected: "Service Tier", appField: "serviceTier", dataType: "select", optionSourceId: "serviceTier", display: { label: "Tier", width: "md", badge: true } },
    { id: "summary", expected: "Summary (what & why)", appField: "summary", dataType: "longText", required: true, display: { label: "Summary", width: "xl", multiline: true } },
    { id: "clientResponseProgress", expected: "Client Response/Progress", appField: "clientResponseProgress", dataType: "longText", display: { label: "Client Response / Progress", width: "xl", multiline: true } },
    { id: "linkedPlanGoal", expected: "Linked Plan Goal", appField: "linkedPlanGoal", dataType: "string", display: { label: "Linked Goal", width: "sm" } },
    { id: "location", expected: "Location of appointment", appField: "location", dataType: "select", optionSourceId: "appointmentLocation", display: { label: "Location", width: "md" } },
    { id: "staffName", expected: "Staff name", appField: "staffName", dataType: "string", display: { label: "Staff", width: "md" } },
    { id: "staffInitial", expected: "Staff initial", appField: "staffInitial", dataType: "string", display: { label: "Staff Initial", width: "xs" } },
    { id: "staffSignature", expected: "Staff signature", appField: "staffSignature", dataType: "signature", display: { label: "Signature", width: "md", hideInCompact: true } },
    { id: "completionDate", expected: "Date of completion", appField: "completionDate", dataType: "date", display: { label: "Completed", width: "sm", hideInCompact: true } }
  ],
  dropdowns: { serviceTier: "serviceTier", location: "appointmentLocation" },
  variantOverrides: {
    payer: { source: { sheetId: "progressNotes", range: { sheetId: "progressNotes", headerRow: 3, dataStartRow: 4, dataEnd: { mode: "firstBlankRow", minConsecutiveBlankRows: 10 }, expectedColumns: ["progressDate", "startTime", "endTime", "totalTime", "serviceTier", "summary", "clientResponseProgress", "linkedPlanGoal", "location", "staffName", "staffSignature", "completionDate"] } } },
    nonPayer: { source: { sheetId: "progressNotes", range: { sheetId: "progressNotes", headerRow: 1, dataStartRow: 2, dataEnd: { mode: "firstBlankRow", minConsecutiveBlankRows: 5 }, expectedColumns: ["progressDate", "summary", "clientResponseProgress", "linkedPlanGoal", "staffInitial"] } } }
  },
  display: { titleField: "summary", subtitleField: "progressDate", compactFields: ["progressDate", "serviceTier", "summary", "linkedPlanGoal", "staffName", "staffInitial"], emptyState: "No progress notes entered yet.", sort: [{ field: "progressDate", direction: "desc" }] }
};
var TSS_BUDGET_ENTITY = {
  id: "budget",
  label: "Budget",
  section: "budget",
  renderKind: "budgetTable",
  direction: "bidirectional",
  source: {
    sheetId: "budget",
    staticContent: {
      amountColumn: "B",
      itemColumn: "A",
      sections: [
        { id: "monthlyIncome", label: "Monthly Income", anchorText: "Monthly income", expectedHeaderRow: 1, itemRows: [2, 3], optionalRows: [4], totalRow: 9, totalLabel: "Total", expectedFormula: "SUM(B2:B4,B6:B8)" },
        { id: "benefitsIncomeSupports", label: "Benefits + Income Supports", anchorText: "Benefits + income supports (SNAP, WIC, TANF, child support, etc.)", expectedHeaderRow: 5, itemRows: [6, 7], optionalRows: [8], totalRow: 9, rollsInto: "monthlyIncome" },
        { id: "fixedExpenses", label: "Fixed Expenses", anchorText: "Fixed Expenses (Monthly)", expectedHeaderRow: 11, itemRows: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], subsections: [{ id: "insurance", label: "Insurance", anchorText: "Insurance", expectedHeaderRow: 25, itemRows: [26, 27] }, { id: "debts", label: "Debts", anchorText: "Debts", expectedHeaderRow: 28, itemRows: [29, 30, 31, 32], totalRow: 33, expectedFormula: "SUM(B29:B32)" }], totalRow: 34, totalLabel: "Fixed Expenses Total", expectedFormula: "SUM(B12:B24,B26:B27,B33)" },
        { id: "flexibleExpenses", label: "Flexible Expenses", anchorText: "Flexible Expenses (Monthly)", expectedHeaderRow: 36, itemRows: [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47], subsections: [{ id: "children", label: "Children", anchorText: "Children", expectedHeaderRow: 48, itemRows: [49, 50, 51, 52, 53] }], totalRow: 54, totalLabel: "Flexible Expenses Total", expectedFormula: "SUM(B37:B47,B49:B53)" },
        { id: "annualExpenses", label: "Annual Expenses", anchorText: "Annual Expenses", expectedHeaderRow: 56, itemRows: [57, 58], subsections: [{ id: "vehicle", label: "Vehicle", anchorText: "Vehicle", expectedHeaderRow: 59, itemRows: [60, 61, 62, 63] }], totalRow: 64, totalLabel: "Annual Expenses Total \xF7 12", expectedFormula: "SUM(B57:B58,B60:B63)/12" },
        { id: "savings", label: "Savings", anchorText: "Savings (Monthly)", expectedHeaderRow: 66, itemRows: [67, 68, 69, 70], totalRow: 71, totalLabel: "Savings Total", expectedFormula: "SUM(B67:B70)", countAsExpense: false }
      ],
      summaryRows: [
        { id: "totalExpenses", label: "Total Expenses", row: 73, expectedFormula: "SUM(B34,B54, B64)" },
        { id: "incomeRemaining", label: "Income Remaining", row: 74, expectedFormula: "(B9 - B73)" }
      ],
      signatureRow: 77
    }
  },
  fields: [
    { id: "budgetItem", expected: "Budget Item", appField: "budgetItem", dataType: "string", display: { label: "Item", width: "xl" } },
    { id: "amount", expected: "Amount", appField: "amount", dataType: "currency", display: { label: "Amount", width: "sm" } },
    { id: "section", expected: "Section", appField: "section", dataType: "string", display: { label: "Section", width: "md" } },
    { id: "isTotal", expected: "Is Total", appField: "isTotal", dataType: "computed", write: { enabled: false } }
  ],
  display: { titleField: "section", totalFields: ["monthlyIncome.total", "totalExpenses", "incomeRemaining"], emptyState: "No budget values entered yet." }
};
var TSS_DISPLAY_ENTITIES = {
  coverSheet: TSS_COVER_ENTITY,
  customerStrengths: TSS_CUSTOMER_STRENGTHS_ENTITY,
  housingBarriers: TSS_HOUSING_BARRIERS_ENTITY,
  goals: TSS_GOALS_ENTITY,
  smartGoalsAcronym: TSS_SMART_GOALS_ACRONYM_ENTITY,
  progressNotes: TSS_PROGRESS_NOTES_ENTITY,
  budget: TSS_BUDGET_ENTITY
};
var TSS_WORKSHEET_CONFIG = {
  version: "2026-06-02.tss-display-config.v1",
  workbookKind: "tssWorksheet",
  smartHeaderIdVersion: "smartHeaderIdV1",
  sheets: TSS_SHEETS,
  variantRules: TSS_WORKBOOK_VARIANT_RULES,
  dropdownLists: TSS_DROPDOWN_LISTS,
  headerAliases: TSS_HEADER_ALIASES,
  entities: TSS_DISPLAY_ENTITIES,
  parsingDefaults: {
    rowDriftTolerance: 8,
    emptyRowPolicy: "skipRowsWhereAllMappedFieldsBlank",
    mergedCellPolicy: "topLeftValueAppliesToMergedRange",
    coverSheetTunnelPolicy: "sheetValueOverridesClientDocWhenNonBlank",
    datePolicy: "excelSerialOrIsoToIsoDate"
  }
};
function deepCloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}
function uniqStrings(...lists) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const list of lists) {
    if (!list) continue;
    for (const s of list) {
      const v = String(s).trim();
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}
function entityFieldsForAlias(entity) {
  const out = [];
  if (Array.isArray(entity.fields)) out.push(...entity.fields);
  if (Array.isArray(entity.source?.keyValues)) out.push(...entity.source.keyValues);
  return out;
}
function matchesFieldKey(field, key) {
  return field.id === key || field.appField === key;
}
function resolveTssWorksheetConfig(override) {
  const cfg = deepCloneConfig(TSS_WORKSHEET_CONFIG);
  if (!override) return cfg;
  if (override.disabledEntityIds?.length) {
    for (const id of override.disabledEntityIds) {
      delete cfg.entities[id];
    }
  }
  if (override.sheetAliasExtensions) {
    for (const [sheetId, extra] of Object.entries(override.sheetAliasExtensions)) {
      const sheet = cfg.sheets[sheetId];
      if (!sheet) continue;
      sheet.aliases = uniqStrings(sheet.aliases, extra);
    }
  }
  if (override.fieldAliasExtensions) {
    for (const [entityId, fieldMap] of Object.entries(override.fieldAliasExtensions)) {
      const entity = cfg.entities[entityId];
      if (!entity) continue;
      const fields = entityFieldsForAlias(entity);
      for (const [fieldKey, extra] of Object.entries(fieldMap)) {
        for (const field of fields) {
          if (matchesFieldKey(field, fieldKey)) {
            field.aliases = uniqStrings(field.aliases, extra);
          }
        }
      }
    }
  }
  if (override.fieldDisplayOverrides) {
    for (const [entityId, fieldMap] of Object.entries(override.fieldDisplayOverrides)) {
      const entity = cfg.entities[entityId];
      if (!entity?.fields) continue;
      for (const [fieldKey, displayPatch] of Object.entries(fieldMap)) {
        for (const field of entity.fields) {
          if (matchesFieldKey(field, fieldKey)) {
            field.display = { ...field.display ?? {}, ...displayPatch };
          }
        }
      }
    }
  }
  if (override.entityEmptyStateOverrides) {
    for (const [entityId, emptyState] of Object.entries(override.entityEmptyStateOverrides)) {
      const entity = cfg.entities[entityId];
      if (!entity) continue;
      entity.display = { ...entity.display ?? {}, emptyState };
    }
  }
  if (override.entityLabelOverrides) {
    for (const [entityId, label] of Object.entries(override.entityLabelOverrides)) {
      const entity = cfg.entities[entityId];
      if (!entity) continue;
      entity.label = label;
    }
  }
  return cfg;
}
function resolveWorkbookVariant(override, detectedVariant) {
  if (override?.forceVariant) return override.forceVariant;
  return detectedVariant ?? "unknown";
}

// src/transactionWindows.ts
var transactionWindows_exports = {};
__export(transactionWindows_exports, {
  TRANSACTION_WINDOW_FORM_IDS: () => TRANSACTION_WINDOW_FORM_IDS,
  TransactionWindowSchemaError: () => TransactionWindowSchemaError,
  cleanVisibleLabel: () => cleanVisibleLabel,
  inferTransactionWindowModel: () => inferTransactionWindowModel,
  transactionFieldKey: () => transactionFieldKey
});
var TRANSACTION_WINDOW_FORM_IDS = {
  creditCard: "251878265158166",
  invoice: "252674777246167"
};
var STRUCTURAL_RAW_TYPES = /* @__PURE__ */ new Set([
  "control_head",
  "control_text",
  "control_divider",
  "control_collapse",
  "control_pagebreak",
  "control_button"
]);
var TransactionWindowSchemaError = class extends Error {
  code = "TRANSACTION_WINDOW_SCHEMA_ERROR";
  constructor(message) {
    super(message);
    this.name = "TransactionWindowSchemaError";
  }
};
function cleanVisibleLabel(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}
function transactionFieldKey(label) {
  const slug = cleanVisibleLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `tx:${slug || "field"}`;
}
function normalizedOptions(options) {
  return [...new Set((options ?? []).map((option) => String(option).trim()).filter(Boolean))].sort();
}
function normalizeFields(fields) {
  return fields.map((field) => {
    const cleanLabel = cleanVisibleLabel(field.label);
    return {
      ...field,
      cleanLabel,
      key: transactionFieldKey(cleanLabel),
      order: Number(field.order) || 0
    };
  }).filter((field) => !!field.rawFieldId && !!field.cleanLabel).sort((a, b) => a.order - b.order || Number(a.rawFieldId) - Number(b.rawFieldId));
}
function isAnswerable(field) {
  return !!field.cleanLabel && !STRUCTURAL_RAW_TYPES.has(String(field.rawType || "")) && String(field.rawType || "") !== "control_fileupload";
}
function signature(fields) {
  return fields.map(
    (field) => [
      field.cleanLabel.toLowerCase(),
      field.type,
      field.logicType ?? ""
    ].join("::")
  ).join("||");
}
function assertSameSignature(windows, label) {
  if (!windows.length) {
    throw new TransactionWindowSchemaError(`${label}: no transaction windows were detected.`);
  }
  const [first, ...rest] = windows;
  const expected = signature(first.fields);
  for (const [offset, window] of rest.entries()) {
    if (signature(window.fields) !== expected) {
      throw new TransactionWindowSchemaError(
        `${label}: transaction window ${offset + 2} does not match transaction window 1.`
      );
    }
  }
}
function buildFieldDefinitions(windows) {
  const byKey = /* @__PURE__ */ new Map();
  for (const window of windows) {
    for (const field of window.fields) {
      const rows = byKey.get(field.key) ?? [];
      rows.push(field);
      byKey.set(field.key, rows);
    }
  }
  return [...byKey.values()].sort((a, b) => a[0].order - b[0].order).map((instances) => {
    const first = instances[0];
    return {
      key: first.key,
      label: first.cleanLabel,
      type: first.type,
      logicType: first.logicType,
      typeLabel: first.typeLabel,
      rawType: first.rawType,
      options: normalizedOptions(instances.flatMap((field) => field.options ?? []))
    };
  });
}
function toLogicalWindow(index, windows) {
  const fieldIdsByKey = {};
  const fieldOrdersByKey = {};
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const window of windows) {
    start = Math.min(start, window.orderRange[0]);
    end = Math.max(end, window.orderRange[1]);
    for (const field of window.fields) {
      fieldIdsByKey[field.key] = [...fieldIdsByKey[field.key] ?? [], field.rawFieldId];
      fieldOrdersByKey[field.key] = [...fieldOrdersByKey[field.key] ?? [], field.order];
    }
  }
  return {
    index,
    orderRange: [
      Number.isFinite(start) ? start : 0,
      Number.isFinite(end) ? end : 0
    ],
    fieldIdsByKey,
    fieldOrdersByKey
  };
}
function inferCreditCardModel(fields) {
  const rows = normalizeFields(fields);
  const returnBoundary = rows.find((field) => /return documentation|return record/i.test(field.cleanLabel))?.order ?? Number.POSITIVE_INFINITY;
  const anchorOrders = /* @__PURE__ */ new Map();
  for (const field of rows) {
    if (field.order >= returnBoundary) continue;
    const match = field.cleanLabel.match(/\btransaction\s+(\d+)\b/i);
    if (!match) continue;
    const index = Number(match[1]);
    if (!Number.isFinite(index) || index <= 0) continue;
    anchorOrders.set(index, Math.max(anchorOrders.get(index) ?? 0, field.order));
  }
  const anchors = [...anchorOrders.entries()].sort((a, b) => a[0] - b[0]).map(([index, order]) => ({ index, order }));
  if (anchors.length < 2) {
    throw new TransactionWindowSchemaError(
      "credit-card: fewer than two repeated purchase transaction headers were detected."
    );
  }
  const windows = anchors.map((anchor, offset) => {
    const nextOrder = anchors[offset + 1]?.order ?? returnBoundary;
    const windowFields = rows.filter(
      (field) => field.order > anchor.order && field.order < nextOrder && isAnswerable(field)
    );
    return {
      orderRange: [anchor.order, Number.isFinite(nextOrder) ? nextOrder - 1 : anchor.order],
      fields: windowFields
    };
  });
  assertSameSignature(windows, "credit-card");
  return {
    formId: TRANSACTION_WINDOW_FORM_IDS.creditCard,
    kind: "credit-card",
    fields: buildFieldDefinitions(windows),
    windows: windows.map((window, index) => toLogicalWindow(index + 1, [window]))
  };
}
function splitByDividers(rows) {
  const blocks = [];
  let pending = [];
  let start = 0;
  let end = 0;
  const flush = () => {
    const fields = pending.filter(isAnswerable);
    if (fields.length) {
      blocks.push({
        orderRange: [start || fields[0].order, end || fields[fields.length - 1].order],
        fields
      });
    }
    pending = [];
    start = 0;
    end = 0;
  };
  for (const row of rows) {
    if (String(row.rawType || "") === "control_divider") {
      flush();
      continue;
    }
    if (!start) start = row.order;
    end = row.order;
    pending.push(row);
  }
  flush();
  return blocks;
}
function suffixMatchingWindow(block, expected) {
  if (block.fields.length < expected.length) return null;
  const suffix = block.fields.slice(block.fields.length - expected.length);
  if (signature(suffix) !== signature(expected)) return null;
  return {
    orderRange: [suffix[0].order, suffix[suffix.length - 1].order],
    fields: suffix
  };
}
function inferRepeatedInvoiceGroups(rows) {
  const blocks = splitByDividers(rows);
  const repeated = /* @__PURE__ */ new Map();
  for (const block of blocks) {
    const sig = signature(block.fields);
    if (!sig) continue;
    const group = repeated.get(sig) ?? [];
    group.push(block);
    repeated.set(sig, group);
  }
  const signatures = [...repeated.entries()].filter(([, windows]) => windows.length >= 2).sort((a, b) => a[1][0].orderRange[0] - b[1][0].orderRange[0]);
  return signatures.map(([, windows]) => {
    const expected = windows[0].fields;
    return blocks.map((block) => suffixMatchingWindow(block, expected)).filter(Boolean);
  }).filter((windows) => windows.length >= 2);
}
function inferInvoiceModel(fields) {
  const rows = normalizeFields(fields);
  const groups = inferRepeatedInvoiceGroups(rows);
  if (groups.length < 2) {
    throw new TransactionWindowSchemaError(
      "invoice: expected customer-side and program-side repeated transaction windows."
    );
  }
  const [customerSide, programSide] = groups.slice(0, 2);
  assertSameSignature(customerSide, "invoice customer-side");
  assertSameSignature(programSide, "invoice program-side");
  if (customerSide.length !== programSide.length) {
    throw new TransactionWindowSchemaError(
      "invoice: customer-side and program-side transaction window counts differ."
    );
  }
  const combinedWindows = customerSide.map((window, index) => [window, programSide[index]]);
  const logicalWindows = combinedWindows.map((pair, index) => toLogicalWindow(index + 1, pair));
  const logicalFieldWindows = combinedWindows.map((pair) => {
    const byKey = /* @__PURE__ */ new Map();
    for (const field of [...pair[0].fields, ...pair[1].fields]) {
      if (!byKey.has(field.key)) byKey.set(field.key, field);
    }
    const fieldsForSignature = [...byKey.values()].sort((a, b) => a.order - b.order);
    return {
      orderRange: [pair[0].orderRange[0], pair[1].orderRange[1]],
      fields: fieldsForSignature
    };
  });
  assertSameSignature(logicalFieldWindows, "invoice logical");
  return {
    formId: TRANSACTION_WINDOW_FORM_IDS.invoice,
    kind: "invoice",
    fields: buildFieldDefinitions([...customerSide, ...programSide]),
    windows: logicalWindows
  };
}
function inferTransactionWindowModel(formId, fields) {
  if (formId === TRANSACTION_WINDOW_FORM_IDS.creditCard) {
    return inferCreditCardModel(fields);
  }
  if (formId === TRANSACTION_WINDOW_FORM_IDS.invoice) {
    return inferInvoiceModel(fields);
  }
  throw new TransactionWindowSchemaError(`unsupported form "${formId}" for transaction window inference.`);
}

// src/cmActivities.ts
var cmActivities_exports = {};
__export(cmActivities_exports, {
  CmActivitiesListQuery: () => CmActivitiesListQuery,
  CmActivitiesListResp: () => CmActivitiesListResp,
  CmActivity: () => CmActivity,
  CmActivityCreateBody: () => CmActivityCreateBody,
  CmActivityType: () => CmActivityType,
  CmActivityUpdateBody: () => CmActivityUpdateBody
});
var CmActivityType = import_zod2.z.enum([
  "in-person",
  "phone",
  "data-entry",
  "other"
]);
var CmActivity = import_zod2.z.object({
  id: Id,
  orgId: Id,
  caseManagerId: Id,
  caseManagerName: import_zod2.z.string().trim().optional(),
  customerId: Id,
  customerName: import_zod2.z.string().trim().optional(),
  type: CmActivityType,
  date: ISO10,
  startTime: import_zod2.z.string().trim().optional(),
  // "HH:MM"
  endTime: import_zod2.z.string().trim().optional(),
  // "HH:MM"
  note: import_zod2.z.string().trim().optional(),
  calendarEventId: import_zod2.z.string().trim().optional(),
  calendarSynced: import_zod2.z.boolean().optional(),
  // Set true once the session has been pushed to the customer's TSS workbook as a
  // progress-note row (mirrors calendarSynced). workbookRowKey is the appended
  // row's key returned by appendCustomerWorkbookRow.
  workbookSynced: import_zod2.z.boolean().optional(),
  workbookSyncedAt: import_zod2.z.string().optional(),
  workbookRowKey: import_zod2.z.string().trim().optional(),
  archived: import_zod2.z.boolean().optional(),
  createdAt: import_zod2.z.string(),
  updatedAt: import_zod2.z.string().optional()
});
var CmActivityCreateBody = import_zod2.z.object({
  customerId: Id,
  customerName: import_zod2.z.string().trim().optional(),
  type: CmActivityType,
  date: ISO10,
  startTime: import_zod2.z.string().trim().optional(),
  endTime: import_zod2.z.string().trim().optional(),
  note: import_zod2.z.string().trim().optional(),
  postToCalendar: import_zod2.z.boolean().optional()
});
var CmActivityUpdateBody = import_zod2.z.object({
  type: CmActivityType.optional(),
  date: ISO10.optional(),
  startTime: import_zod2.z.string().trim().optional(),
  endTime: import_zod2.z.string().trim().optional(),
  note: import_zod2.z.string().trim().optional()
});
var CmActivitiesListQuery = import_zod2.z.object({
  month: import_zod2.z.string().optional(),
  // "YYYY-MM"
  customerId: import_zod2.z.string().optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional()
});
var CmActivitiesListResp = import_zod2.z.object({
  items: import_zod2.z.array(CmActivity)
});

// src/caseNoteAssistant.ts
var caseNoteAssistant_exports = {};
__export(caseNoteAssistant_exports, {
  CaseNoteActionSchema: () => CaseNoteActionSchema,
  CaseNoteInterviewFieldsSchema: () => CaseNoteInterviewFieldsSchema,
  CaseNoteModeSchema: () => CaseNoteModeSchema,
  GenerateCaseNoteSuggestionBodySchema: () => GenerateCaseNoteSuggestionBodySchema,
  GenerateCaseNoteSuggestionResponseSchema: () => GenerateCaseNoteSuggestionResponseSchema,
  RecordCaseNoteSuggestionDecisionBodySchema: () => RecordCaseNoteSuggestionDecisionBodySchema
});
var import_zod5 = require("zod");
var CaseNoteActionSchema = import_zod5.z.enum([
  "improve",
  "grammar_only",
  "shorten",
  "add_detail",
  "professional_tone",
  "compliance_review",
  "neutral_language",
  "missing_questions",
  "interview_draft"
]);
var CaseNoteModeSchema = import_zod5.z.enum(["freeform", "interview"]);
var CaseNoteInterviewFieldsSchema = import_zod5.z.object({
  clientResponse: import_zod5.z.string().max(4e3).nullish(),
  caseManagerAction: import_zod5.z.string().max(4e3).nullish(),
  barrier: import_zod5.z.string().max(4e3).nullish(),
  progress: import_zod5.z.string().max(4e3).nullish(),
  nextStep: import_zod5.z.string().max(4e3).nullish()
});
var GenerateCaseNoteSuggestionBodySchema = import_zod5.z.object({
  customerId: import_zod5.z.string().min(1).max(128),
  sessionId: import_zod5.z.string().max(128).nullish(),
  mode: CaseNoteModeSchema,
  action: CaseNoteActionSchema,
  program: import_zod5.z.string().max(120).nullish(),
  serviceType: import_zod5.z.string().max(120).nullish(),
  contactType: import_zod5.z.string().max(60).nullish(),
  visitLengthMinutes: import_zod5.z.number().int().min(0).max(1440).nullish(),
  draft: import_zod5.z.string().max(12e3).nullish(),
  clientLabel: import_zod5.z.string().min(1).max(40).default("client"),
  staffLabel: import_zod5.z.string().min(1).max(40).default("case manager"),
  interviewFields: CaseNoteInterviewFieldsSchema.nullish()
}).superRefine((value, ctx) => {
  const hasInterviewText = value.interviewFields && Object.values(value.interviewFields).some((v) => String(v ?? "").trim());
  if (value.mode === "freeform" && !String(value.draft ?? "").trim()) ctx.addIssue({ code: "custom", message: "Draft is required.", path: ["draft"] });
  if (value.mode === "interview" && !hasInterviewText) ctx.addIssue({ code: "custom", message: "At least one interview field is required.", path: ["interviewFields"] });
});
var GenerateCaseNoteSuggestionResponseSchema = import_zod5.z.object({
  ok: import_zod5.z.literal(true),
  suggestion: import_zod5.z.string(),
  requestId: import_zod5.z.string(),
  action: CaseNoteActionSchema,
  model: import_zod5.z.string(),
  missingOrUnclear: import_zod5.z.array(import_zod5.z.string()).default([]),
  complianceSuggestions: import_zod5.z.array(import_zod5.z.string()).default([]),
  usage: import_zod5.z.object({ inputTokens: import_zod5.z.number().int().nonnegative(), outputTokens: import_zod5.z.number().int().nonnegative() })
});
var RecordCaseNoteSuggestionDecisionBodySchema = import_zod5.z.object({
  requestId: import_zod5.z.string().uuid(),
  accepted: import_zod5.z.boolean()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BoolFromLike,
  BoolLike,
  Boolish,
  BudgetPipeline,
  BudgetPipelineDeleteBody,
  BudgetPipelineListQuery,
  BudgetPipelinePreviewBody,
  BudgetPipelineUpsertBody,
  CmActivitiesListQuery,
  CmActivitiesListResp,
  CmActivity,
  CmActivityCreateBody,
  CmActivityType,
  CmActivityUpdateBody,
  CreateUserBody,
  FORM_CONTEXT_KEYS,
  FormPrefillSnapshot,
  FormRenderMode,
  FormSessionCompleteBody,
  FormSessionCreateBody,
  FormSessionEntity,
  FormSessionResolveBody,
  FormSessionSource,
  FormSessionStatus,
  FormSubmissionSnapshot,
  FormWorkflowConfig,
  FormWorkflowId,
  GDRIVE_TEMPLATE_TYPES,
  GRANT_PIN_COLORS,
  GenerateCaseNoteSuggestionBodySchema,
  GenerateCaseNoteSuggestionResponseSchema,
  GoogleAuthMode,
  GoogleConnectStartBody,
  GoogleIntegrationMode,
  GoogleIntegrationStatus,
  GooglePermissionStatus,
  GoogleService,
  GrantBudgetManagerLineItem,
  GrantBudgetManagerLoadBody,
  GrantBudgetManagerOriginal,
  GrantBudgetManagerReconcileBody,
  GrantBudgetManagerRollup,
  GrantBudgetManagerRow,
  GrantBudgetManagerSaveBody,
  GrantBudgetManagerSaveMode,
  GrantBudgetManagerSourceType,
  GrantComplianceConfig,
  GrantComplianceControl,
  GrantCompliancePreset,
  GrantDriveTemplate,
  GrantDriveTemplateType,
  GrantFinancialConfig,
  GrantFinancialConfigPatch,
  GrantFinancialModel,
  GrantIdsLike,
  GrantLedgerMode,
  HouseholdEntity,
  HouseholdInputSchema,
  HouseholdMember,
  HouseholdRelationship,
  HouseholdStatus,
  HouseholdsAddMemberBody,
  HouseholdsDeleteBody,
  HouseholdsGetQuery,
  HouseholdsListQuery,
  HouseholdsPatchBody,
  HouseholdsPatchRow,
  HouseholdsRemoveMemberBody,
  HouseholdsSetHeadBody,
  HouseholdsUpsertBody,
  ISO10,
  Id,
  IdLike,
  Ids,
  InboxItemSchema,
  InviteUserBody,
  JsonObj,
  JsonObjLike,
  ListUsersBody,
  MetricChipId,
  MetricWorkspaceChipInstance,
  MetricWorkspaceLayout,
  MetricWorkspacePrefs,
  OrgManagerListOrgsBody,
  OrgManagerOrg,
  OrgManagerPatchTeamsBody,
  OrgManagerTeam,
  OrgManagerUpsertOrgBody,
  PipelineCondition,
  PipelineConditionGroup,
  PipelineFormSchema,
  PipelineOperator,
  PipelineRuleNode,
  PipelineStatus,
  RecordCaseNoteSuggestionDecisionBodySchema,
  ResendInviteBody,
  RevokeSessionsBody,
  RoleInput,
  RoleTagCanonical,
  RolesArray,
  SetActiveBody,
  SetRoleBody,
  TRANSACTION_WINDOW_FORM_IDS,
  TasksAdminRegenerateForGrantBody,
  TasksAssignBody,
  TasksBulkStatusBody,
  TasksDeleteBody,
  TasksGenerateScheduleWriteBody,
  TasksListQuery,
  TasksOtherAssignBody,
  TasksOtherCreateBody,
  TasksOtherListMyQuery,
  TasksOtherStatusBody,
  TasksOtherUpdateBody,
  TasksRescheduleBody,
  TasksUpdateFieldsBody,
  TasksUpdateStatusBody,
  TasksUpsertManualBody,
  TimestampLike,
  TopRoleCanonical,
  TopRoleLadder,
  TourFlow,
  TourProgressEntry,
  TourProgressStatus,
  TourStep,
  ToursDeleteBody,
  ToursGetQuery,
  ToursListQuery,
  ToursPatchBody,
  ToursPatchItem,
  ToursUpsertBody,
  TransactionWindowSchemaError,
  TsLike,
  UpdateMeBody,
  UpdateUserProfileBody,
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
  UserToursState,
  WORKFLOW_CONFIGS,
  assessments,
  budgetPipeline,
  caseNoteAssistant,
  cleanVisibleLabel,
  cmActivities,
  computeGrantLineItemOverCap,
  creditCards,
  customers,
  deriveHeadCustomerId,
  enrollments,
  formSessions,
  gdrive,
  getGrantFinancialCapabilities,
  getGrantLineItemAmountSemantics,
  getWorkflowConfig,
  google,
  grantBudgetManager,
  grants,
  householdRelationshipLabel,
  households,
  inbox,
  inferTransactionWindowModel,
  jotform,
  ledger,
  metrics,
  normalizeGrantComplianceConfig,
  normalizeGrantDriveTemplates,
  normalizeGrantFinancialConfig,
  parseGrantMaxAssistanceMonths,
  payments,
  shouldRetainGrantBudget,
  tasks,
  toArray,
  tours,
  transactionFieldKey,
  transactionWindows,
  tss,
  users,
  z
});
