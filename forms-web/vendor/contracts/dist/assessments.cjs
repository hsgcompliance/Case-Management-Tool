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
module.exports = __toCommonJS(assessments_exports);

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

// src/assessments.ts
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AssessmentAnswer,
  AssessmentComputed,
  AssessmentOpenedReason,
  AssessmentOutputEntry,
  AssessmentRunStatus,
  AssessmentSchema,
  AssessmentScope,
  AssessmentSubmission,
  AssessmentTemplate,
  AssessmentTemplateUpsertBody,
  AssessmentTemplateVersion,
  CanonicalAssessmentKind,
  DeleteTemplateBody,
  GetSubmissionBody,
  GetTemplateBody,
  ListSubmissionsBody,
  ListTemplatesBody,
  ListVersionsBody,
  OpenReassessmentBody,
  PushAnswerBody,
  RecalcTemplateBody,
  RubricDef,
  RubricLevel,
  RubricOption,
  RubricQuestion,
  SubmitAssessmentBody,
  TemplateEditPolicy
});
