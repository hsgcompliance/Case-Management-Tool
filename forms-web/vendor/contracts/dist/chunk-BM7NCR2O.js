import {
  TsLike,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

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
var AssessmentRunStatus = z.enum([
  "draft",
  "active",
  "submitted",
  "scored",
  "closed",
  "superseded",
  "voided"
]);
var AssessmentOpenedReason = z.enum([
  "manual",
  "intake",
  "reassessment",
  "scheduled"
]);
var AssessmentOutputEntry = z.object({
  // display
  assessmentName: z.string(),
  metric: z.string(),
  score: z.number().nullable().optional(),
  level: z.string().nullable().optional(),
  // provenance — all linkage fields always present for sort/filter
  contextId: z.string(),
  submissionId: z.string(),
  templateId: z.string(),
  templateVersion: z.number(),
  templateVersionId: z.string().nullable().optional(),
  orgId: z.string(),
  customerId: z.string().nullable().optional(),
  enrollmentId: z.string().nullable().optional(),
  grantId: z.string().nullable().optional(),
  scoredAt: z.string(),
  scoredBy: z.string()
}).passthrough();
var AssessmentTemplateVersion = z.object({
  id: z.string().optional(),
  templateId: z.string(),
  orgId: z.string(),
  versionNumber: z.number().int().min(1),
  status: z.enum(["draft", "published", "deprecated"]).default("published"),
  schema: z.unknown(),
  // AssessmentSchema — typed as unknown here to avoid circular dep
  title: z.string(),
  kind: z.string(),
  publishedAt: z.string().nullable().optional(),
  publishedByUid: z.string().nullable().optional(),
  createdAt: z.unknown().optional()
}).passthrough();
var AssessmentScope = z.enum(["customer", "enrollment"]);
var CanonicalAssessmentKind = z.enum([
  "acuity",
  "waitlistPriority",
  "progress",
  "custom"
]);
var TemplateEditPolicy = z.enum([
  "adminOnly",
  "ownerOrAdmin",
  "team",
  "org"
]);
var RubricOption = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string().trim().min(1),
  points: z.number().default(0)
});
var RubricQuestion = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  options: z.array(RubricOption).min(1)
});
var RubricLevel = z.object({
  min: z.number().default(0),
  max: z.number().optional(),
  // undefined → +∞
  label: z.string().trim().min(1)
});
var RubricDef = z.object({
  title: z.string().trim().min(1),
  version: z.string().trim().default("v1"),
  questions: z.array(RubricQuestion).min(1),
  levels: z.array(RubricLevel).min(1)
});
var AssessmentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rubric"),
    rubric: RubricDef
  })
]);
var AssessmentTemplate = z.object({
  id: z.string().optional(),
  // org/team access (server authoritative)
  orgId: z.string().trim().min(1).nullish(),
  teamIds: z.array(z.string().trim().min(1)).max(10).optional(),
  // optional scope to a grant/program (still stored separately)
  grantId: z.string().trim().min(1).nullish(),
  // flexible kind (keep it string so you can grow without migrating contracts)
  kind: z.string().trim().min(1).default("custom"),
  // where submissions are tied
  scope: AssessmentScope.default("enrollment"),
  // UX / identity
  title: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  // human-readable name for the primary output metric (e.g. "Acuity Score")
  outputLabel: z.string().trim().nullish(),
  // template lifecycle
  version: z.number().int().min(1).default(1),
  locked: z.boolean().optional().default(false),
  // "active" | "deprecated" — separate from version status
  templateStatus: z.enum(["active", "deprecated"]).optional().default("active"),
  // pointer to latest published version subcollection doc
  currentVersionId: z.string().trim().nullish(),
  // edit controls
  editPolicy: TemplateEditPolicy.default("team"),
  ownerUid: z.string().trim().nullish(),
  // builder output
  schema: AssessmentSchema,
  // timestamps (accepted but ignored on write)
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional()
}).passthrough();
var AssessmentTemplateUpsertBody = z.union([
  AssessmentTemplate,
  z.array(AssessmentTemplate)
]);
var GetTemplateBody = z.object({
  templateId: z.string().trim().min(1)
});
var ListTemplatesBody = z.object({
  grantId: z.string().trim().min(1).nullish(),
  kind: z.string().trim().min(1).nullish(),
  scope: AssessmentScope.nullish(),
  includeLocked: z.boolean().optional().default(true)
}).passthrough();
var DeleteTemplateBody = z.object({
  templateId: z.string().trim().min(1),
  force: z.boolean().optional().default(false)
});
var AssessmentAnswer = z.object({
  qId: z.string().trim().min(1),
  answer: z.union([z.string(), z.number()])
});
var AssessmentComputed = z.object({
  score: z.number().nullable().optional(),
  level: z.string().nullable().optional(),
  // for future computed outputs (priority buckets, derived flags, etc.)
  meta: z.record(z.string(), z.unknown()).optional()
}).passthrough();
var AssessmentSubmission = z.object({
  id: z.string().optional(),
  // org/team access (server authoritative)
  orgId: z.string().trim().min(1).nullish(),
  teamIds: z.array(z.string().trim().min(1)).max(10).optional(),
  // linkage
  templateId: z.string().trim().min(1),
  templateVersion: z.number().int().min(1).nullish(),
  // pointer to the /versions subcollection doc used when this was scored
  templateVersionId: z.string().trim().nullish(),
  kind: z.string().trim().min(1).default("custom"),
  scope: AssessmentScope.default("enrollment"),
  // subject — all present on every doc for sort/filter without joins
  customerId: z.string().trim().min(1).nullish(),
  enrollmentId: z.string().trim().min(1).nullish(),
  grantId: z.string().trim().min(1).nullish(),
  // contextId — stable stack key for this entity+kind combo, persists across reassessments
  // customer-scoped: "{customerId}_{kind}"
  // enrollment-scoped: "{enrollmentId}_{kind}"
  contextId: z.string().trim().nullish(),
  // payload
  answers: z.array(AssessmentAnswer).default([]),
  computed: AssessmentComputed.nullish(),
  // provenance
  computedBy: z.enum(["server", "client"]).optional().default("server"),
  byUid: z.string().trim().nullish(),
  updatedBy: z.string().trim().nullish(),
  lastPushSurface: z.string().trim().nullish(),
  lastPushAt: z.string().nullish(),
  // run lifecycle (new — all optional for backward compat)
  status: AssessmentRunStatus.optional().default("scored"),
  openedReason: AssessmentOpenedReason.optional().default("manual"),
  periodKey: z.string().trim().nullish(),
  // "2026-03" | "2026-W11" | null
  supersedes: z.string().trim().nullish(),
  // prior submissionId this replaces
  supersededByRunId: z.string().trim().nullish(),
  supersededAt: z.string().nullish(),
  // timestamps
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional()
}).passthrough();
var SubmitAssessmentBody = z.union([
  z.object({
    templateId: z.string().trim().min(1),
    customerId: z.string().trim().min(1).nullish(),
    enrollmentId: z.string().trim().min(1).nullish(),
    answers: z.array(AssessmentAnswer).default([]),
    // optional: FE can send a preview, but server should recompute anyway
    computedClient: AssessmentComputed.nullish()
  }).passthrough(),
  z.array(z.object({
    templateId: z.string().trim().min(1),
    customerId: z.string().trim().min(1).nullish(),
    enrollmentId: z.string().trim().min(1).nullish(),
    answers: z.array(AssessmentAnswer).default([]),
    // optional: FE can send a preview, but server should recompute anyway
    computedClient: AssessmentComputed.nullish()
  }).passthrough()).min(1).max(50)
  // Reasonable batch limit
]);
var GetSubmissionBody = z.object({
  submissionId: z.string().trim().min(1)
});
var ListSubmissionsBody = z.object({
  customerId: z.string().trim().min(1).nullish(),
  enrollmentId: z.string().trim().min(1).nullish(),
  templateId: z.string().trim().min(1).nullish(),
  // contextId — fetch the full history stack for one entity+kind combo
  contextId: z.string().trim().min(1).nullish(),
  status: AssessmentRunStatus.nullish(),
  limit: z.number().int().min(1).max(500).optional().default(50)
}).passthrough();
var RecalcTemplateBody = z.object({
  templateId: z.string().trim().min(1),
  activeOnly: z.boolean().optional().default(true)
});
var PushAnswerBody = z.object({
  submissionId: z.string().trim().min(1),
  answers: z.array(AssessmentAnswer).min(1).max(100),
  // where in the UI this push came from — stored for audit trail
  sourceSurface: z.string().trim().optional().default("inlineUI"),
  // optional period bucket, e.g. "2026-03" for monthly rolling assessments
  periodKey: z.string().trim().nullish()
});
var OpenReassessmentBody = z.object({
  // direct reference
  priorSubmissionId: z.string().trim().min(1).nullish(),
  // lookup by entity + kind
  customerId: z.string().trim().min(1).nullish(),
  enrollmentId: z.string().trim().min(1).nullish(),
  kind: z.string().trim().min(1).nullish(),
  // options
  prefillAnswers: z.boolean().optional().default(true),
  openedReason: z.enum(["manual", "reassessment", "scheduled"]).optional().default("reassessment")
});
var ListVersionsBody = z.object({
  templateId: z.string().trim().min(1),
  status: z.enum(["draft", "published", "deprecated"]).nullish()
});

export {
  AssessmentRunStatus,
  AssessmentOpenedReason,
  AssessmentOutputEntry,
  AssessmentTemplateVersion,
  AssessmentScope,
  CanonicalAssessmentKind,
  TemplateEditPolicy,
  RubricOption,
  RubricQuestion,
  RubricLevel,
  RubricDef,
  AssessmentSchema,
  AssessmentTemplate,
  AssessmentTemplateUpsertBody,
  GetTemplateBody,
  ListTemplatesBody,
  DeleteTemplateBody,
  AssessmentAnswer,
  AssessmentComputed,
  AssessmentSubmission,
  SubmitAssessmentBody,
  GetSubmissionBody,
  ListSubmissionsBody,
  RecalcTemplateBody,
  PushAnswerBody,
  OpenReassessmentBody,
  ListVersionsBody,
  assessments_exports
};
