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
module.exports = __toCommonJS(jotform_exports);

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
function toArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

// src/jotform.ts
var JotformSubmissionStatus = import_zod2.z.enum(["active", "archived", "deleted"]);
var JotformSubmissionSource = import_zod2.z.enum([
  "api",
  "webhook",
  "sync",
  "manual"
]);
var Num = import_zod2.z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var JotformBudgetLineItem = import_zod2.z.object({
  id: Id.optional(),
  label: import_zod2.z.string().trim().nullish(),
  amount: Num,
  projected: Num,
  spent: Num,
  projectedInWindow: Num.optional(),
  spentInWindow: Num.optional(),
  locked: import_zod2.z.boolean().nullish()
}).passthrough();
var JotformBudgetTotals = import_zod2.z.object({
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
var JotformBudget = import_zod2.z.object({
  total: Num,
  totals: JotformBudgetTotals.nullish(),
  lineItems: import_zod2.z.array(JotformBudgetLineItem).default([]),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var JotformSubmissionCalc = import_zod2.z.object({
  amount: Num,
  currency: import_zod2.z.string().trim().nullish(),
  amounts: import_zod2.z.array(Num).optional(),
  budgetKey: import_zod2.z.string().trim().nullish(),
  lineItems: import_zod2.z.array(
    import_zod2.z.object({
      key: import_zod2.z.string().trim().min(1),
      label: import_zod2.z.string().trim().nullish(),
      amount: Num
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
var ActiveFilter = import_zod2.z.preprocess((v) => {
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
  active: import_zod2.z.union([ActiveFilter, BoolLike, import_zod2.z.string()]).optional(),
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  JotformApiGetQuery,
  JotformApiListQuery,
  JotformBudget,
  JotformBudgetLineItem,
  JotformBudgetTotals,
  JotformDigestField,
  JotformDigestFieldType,
  JotformDigestGetQuery,
  JotformDigestHeader,
  JotformDigestListQuery,
  JotformDigestMap,
  JotformDigestSection,
  JotformDigestUpsertBody,
  JotformFormQuestionsGetQuery,
  JotformFormSummary,
  JotformFormsListQuery,
  JotformLinkSubmissionBody,
  JotformQuestionField,
  JotformQuestionFieldType,
  JotformQuestionLogicType,
  JotformSubmission,
  JotformSubmissionCalc,
  JotformSubmissionEntity,
  JotformSubmissionInputSchema,
  JotformSubmissionPatchBody,
  JotformSubmissionSource,
  JotformSubmissionStatus,
  JotformSubmissionUpsertBody,
  JotformSubmissionsAdminDeleteBody,
  JotformSubmissionsDeleteBody,
  JotformSubmissionsGetQuery,
  JotformSubmissionsListQuery,
  JotformSubmissionsPatchBody,
  JotformSubmissionsPatchRow,
  JotformSubmissionsUpsertBody,
  JotformSyncBody,
  JotformSyncSelectionBody,
  toArray
});
