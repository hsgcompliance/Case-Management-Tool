import {
  BoolFromLike,
  BoolLike,
  Id,
  IdLike,
  TsLike,
  toArray,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

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
var JotformSubmissionStatus = z.enum(["active", "archived", "deleted"]);
var JotformSubmissionSource = z.enum([
  "api",
  "webhook",
  "sync",
  "manual"
]);
var Num = z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var JotformBudgetLineItem = z.object({
  id: Id.optional(),
  label: z.string().trim().nullish(),
  amount: Num,
  projected: Num,
  spent: Num,
  projectedInWindow: Num.optional(),
  spentInWindow: Num.optional(),
  locked: z.boolean().nullish()
}).passthrough();
var JotformBudgetTotals = z.object({
  total: Num,
  projected: Num,
  spent: Num,
  balance: Num.optional(),
  projectedBalance: Num.optional(),
  remaining: Num.optional(),
  projectedInWindow: Num.optional(),
  spentInWindow: Num.optional(),
  windowBalance: Num.optional(),
  windowProjectedBalance: Num.optional()
}).passthrough();
var JotformBudget = z.object({
  total: Num,
  totals: JotformBudgetTotals.nullish(),
  lineItems: z.array(JotformBudgetLineItem).default([]),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var JotformSubmissionCalc = z.object({
  amount: Num,
  currency: z.string().trim().nullish(),
  amounts: z.array(Num).optional(),
  budgetKey: z.string().trim().nullish(),
  lineItems: z.array(
    z.object({
      key: z.string().trim().min(1),
      label: z.string().trim().nullish(),
      amount: Num
    }).passthrough()
  ).optional()
}).passthrough();
var JotformSubmissionInputSchema = z.object({
  id: Id.optional(),
  orgId: Id.nullish(),
  formId: Id,
  formTitle: z.string().trim().nullish(),
  submissionId: Id.optional(),
  status: JotformSubmissionStatus.optional(),
  source: JotformSubmissionSource.optional(),
  // Optional linkage to grants/programs
  grantId: Id.nullish(),
  programId: Id.nullish(),
  customerId: Id.nullish(),
  enrollmentId: Id.nullish(),
  cwId: z.string().trim().nullish(),
  hmisId: z.string().trim().nullish(),
  formAlias: z.string().trim().min(1).nullish(),
  fieldMap: z.record(z.string(), z.string()).nullish(),
  // Basic Jotform metadata
  ip: z.string().trim().nullish(),
  statusRaw: z.string().trim().nullish(),
  submissionUrl: z.url().nullish(),
  editUrl: z.url().nullish(),
  pdfUrl: z.url().nullish(),
  // Submission payload
  answers: z.record(z.string(), z.unknown()).nullish(),
  raw: z.unknown().nullish(),
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
var JotformSubmissionsUpsertBody = z.union([
  JotformSubmissionInputSchema,
  z.array(JotformSubmissionInputSchema).min(1)
]);
var JotformSubmissionUpsertBody = JotformSubmissionsUpsertBody;
var JotformSubmissionsPatchRow = z.object({
  id: Id,
  patch: JotformSubmissionInputSchema.partial().passthrough(),
  unset: z.array(z.string().min(1)).optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var JotformSubmissionsPatchBody = z.union([
  JotformSubmissionsPatchRow,
  z.array(JotformSubmissionsPatchRow).min(1)
]);
var JotformSubmissionPatchBody = JotformSubmissionsPatchBody;
var JotformSubmissionsDeleteBody = z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  z.union([IdLike, z.array(IdLike).min(1)])
);
var JotformSubmissionsAdminDeleteBody = JotformSubmissionsDeleteBody;
var ActiveFilter = z.preprocess((v) => {
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
}, z.union([z.literal(true), z.literal(false)]));
var JotformSubmissionsListQuery = z.object({
  status: z.string().trim().optional(),
  active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),
  formId: IdLike.optional(),
  formAlias: IdLike.optional(),
  submissionId: IdLike.optional(),
  grantId: IdLike.optional(),
  programId: IdLike.optional(),
  customerId: IdLike.optional(),
  enrollmentId: IdLike.optional(),
  cwId: z.string().trim().optional(),
  hmisId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  // dev explicit org targeting
  orgId: IdLike.optional()
}).passthrough();
var JotformSubmissionsGetQuery = z.object({ id: IdLike, orgId: IdLike.optional() }).passthrough();
var JotformFormsListQuery = z.object({
  search: z.string().trim().optional(),
  includeNoSubmissions: BoolFromLike.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
}).passthrough();
var JotformFormSummary = z.object({
  id: Id,
  title: z.string().trim().default(""),
  alias: z.string().trim().min(1),
  count: z.coerce.number().int().nonnegative().default(0),
  lastSubmission: z.string().trim().nullish(),
  url: z.url().nullish(),
  isSign: z.boolean().optional()
}).passthrough();
var JotformQuestionFieldType = z.enum(["text", "number", "date", "boolean", "select"]);
var JotformQuestionLogicType = z.enum([
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
var JotformQuestionField = z.object({
  key: z.string().trim().min(1),
  rawFieldId: z.string().trim().min(1),
  label: z.string().trim().default(""),
  rawType: z.string().trim().default(""),
  type: JotformQuestionFieldType,
  logicType: JotformQuestionLogicType,
  typeLabel: z.string().trim().min(1),
  options: z.array(z.string()).optional(),
  order: z.coerce.number().int().nonnegative()
}).passthrough();
var JotformFormQuestionsGetQuery = z.object({
  formId: IdLike
}).passthrough();
var JotformLinkSubmissionBody = z.object({
  id: IdLike.optional(),
  submissionId: IdLike.optional(),
  formAlias: z.string().trim().min(1).nullish(),
  grantId: IdLike.nullish(),
  customerId: IdLike.nullish(),
  enrollmentId: IdLike.nullish(),
  cwId: z.string().trim().nullish(),
  hmisId: z.string().trim().nullish(),
  fieldMap: z.record(z.string(), z.string()).nullish(),
  notes: z.string().trim().nullish(),
  orgId: IdLike.optional()
}).passthrough().refine((v) => !!(v.id || v.submissionId), { message: "missing_id_or_submissionId" });
var JotformSyncSelectionBody = z.object({
  mode: z.enum(["all", "formIds", "aliases"]).default("all"),
  formIds: z.array(IdLike).optional(),
  aliases: z.array(z.string().trim().min(1)).optional(),
  includeNoSubmissions: BoolFromLike.optional(),
  since: TsLike.optional(),
  limit: z.coerce.number().int().min(1).max(1e3).optional(),
  maxPages: z.coerce.number().int().min(1).max(25).optional(),
  includeRaw: BoolFromLike.optional(),
  orgId: IdLike.optional()
}).passthrough();
var JotformDigestFieldType = z.enum(["question", "header", "section"]);
var JotformDigestHeader = z.object({
  show: z.boolean().default(true),
  title: z.string().trim().nullish(),
  subtitle: z.string().trim().nullish()
}).passthrough();
var JotformDigestSection = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  show: z.boolean().default(true),
  order: z.coerce.number().int().default(0)
}).passthrough();
var JotformDigestField = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  questionLabel: z.string().trim().nullish(),
  type: JotformDigestFieldType.default("question"),
  sectionId: z.string().trim().nullish(),
  show: z.boolean().default(true),
  hideIfEmpty: z.boolean().default(true),
  order: z.coerce.number().int().default(0)
}).passthrough();
var JotformDigestMap = z.object({
  id: Id.optional(),
  orgId: Id.nullish(),
  formId: Id,
  formAlias: z.string().trim().min(1).nullish(),
  formTitle: z.string().trim().nullish(),
  header: JotformDigestHeader.default({ show: true, title: null, subtitle: null }),
  sections: z.array(JotformDigestSection).default([]),
  fields: z.array(JotformDigestField).default([]),
  options: z.object({
    hideEmptyFields: z.boolean().default(true),
    showQuestions: z.boolean().default(true),
    showAnswers: z.boolean().default(true),
    task: z.object({
      enabled: z.boolean().default(false),
      assignedToGroup: z.enum(["admin", "compliance", "casemanager"]).default("admin"),
      titlePrefix: z.string().trim().nullish(),
      titleFieldKeys: z.array(z.string().trim().min(1)).default([]),
      subtitleFieldKeys: z.array(z.string().trim().min(1)).default([])
    }).passthrough().default({
      enabled: false,
      assignedToGroup: "admin",
      titlePrefix: null,
      titleFieldKeys: [],
      subtitleFieldKeys: []
    }),
    spending: z.object({
      enabled: z.boolean().default(false),
      schemaKind: z.enum(["credit-card", "invoice", "other"]).default("other"),
      grantFieldKeys: z.array(z.string().trim().min(1)).default([]),
      lineItemFieldKeys: z.array(z.string().trim().min(1)).default([]),
      customerFieldKeys: z.array(z.string().trim().min(1)).default([]),
      amountFieldKeys: z.array(z.string().trim().min(1)).default([]),
      merchantFieldKeys: z.array(z.string().trim().min(1)).default([]),
      keywordRules: z.array(z.unknown()).default([]),
      notes: z.string().trim().nullish()
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
var JotformDigestGetQuery = z.object({
  formId: IdLike.optional(),
  formAlias: z.string().trim().optional(),
  id: IdLike.optional(),
  orgId: IdLike.optional()
}).passthrough().refine((v) => !!(v.formId || v.formAlias || v.id), { message: "missing_form_id_or_alias" });
var JotformDigestListQuery = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  orgId: IdLike.optional()
}).passthrough();
var JotformSyncBody = z.object({
  formId: IdLike,
  since: TsLike.optional(),
  limit: z.coerce.number().int().min(1).max(1e3).optional(),
  maxPages: z.coerce.number().int().min(1).max(25).optional(),
  startOffset: z.coerce.number().int().min(0).optional(),
  includeRaw: BoolFromLike.optional(),
  orgId: IdLike.optional()
}).passthrough();
var JotformApiListQuery = z.object({
  formId: IdLike,
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.string().optional(),
  since: TsLike.optional()
}).passthrough();
var JotformApiGetQuery = z.object({ id: IdLike }).passthrough();

export {
  JotformSubmissionStatus,
  JotformSubmissionSource,
  JotformBudgetLineItem,
  JotformBudgetTotals,
  JotformBudget,
  JotformSubmissionCalc,
  JotformSubmissionInputSchema,
  JotformSubmission,
  JotformSubmissionEntity,
  JotformSubmissionsUpsertBody,
  JotformSubmissionUpsertBody,
  JotformSubmissionsPatchRow,
  JotformSubmissionsPatchBody,
  JotformSubmissionPatchBody,
  JotformSubmissionsDeleteBody,
  JotformSubmissionsAdminDeleteBody,
  JotformSubmissionsListQuery,
  JotformSubmissionsGetQuery,
  JotformFormsListQuery,
  JotformFormSummary,
  JotformQuestionFieldType,
  JotformQuestionLogicType,
  JotformQuestionField,
  JotformFormQuestionsGetQuery,
  JotformLinkSubmissionBody,
  JotformSyncSelectionBody,
  JotformDigestFieldType,
  JotformDigestHeader,
  JotformDigestSection,
  JotformDigestField,
  JotformDigestMap,
  JotformDigestUpsertBody,
  JotformDigestGetQuery,
  JotformDigestListQuery,
  JotformSyncBody,
  JotformApiListQuery,
  JotformApiGetQuery,
  jotform_exports
};
