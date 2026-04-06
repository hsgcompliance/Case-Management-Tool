// contracts/src/assessments.ts
import { z, TsLike, ISO10 } from "./core";

/* ============================================================
   Assessment run lifecycle
============================================================ */

export const AssessmentRunStatus = z.enum([
  "draft",
  "active",
  "submitted",
  "scored",
  "closed",
  "superseded",
  "voided",
]);
export type TAssessmentRunStatus = z.infer<typeof AssessmentRunStatus>;

export const AssessmentOpenedReason = z.enum([
  "manual",
  "intake",
  "reassessment",
  "scheduled",
]);

/* ============================================================
   Output entry — flexible, template-defined
   Base fields are always present; computed.meta extras are spread in
============================================================ */

export const AssessmentOutputEntry = z
  .object({
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
    scoredBy: z.string(),
  })
  .passthrough(); // template-defined extras from computed.meta spread here

export type TAssessmentOutputEntry = z.infer<typeof AssessmentOutputEntry>;

/* ============================================================
   Template version (lives in assessmentTemplates/{id}/versions/{id})
============================================================ */

export const AssessmentTemplateVersion = z
  .object({
    id: z.string().optional(),
    templateId: z.string(),
    orgId: z.string(),
    versionNumber: z.number().int().min(1),
    status: z.enum(["draft", "published", "deprecated"]).default("published"),
    schema: z.unknown(), // AssessmentSchema — typed as unknown here to avoid circular dep
    title: z.string(),
    kind: z.string(),
    publishedAt: z.string().nullable().optional(),
    publishedByUid: z.string().nullable().optional(),
    createdAt: z.unknown().optional(),
  })
  .passthrough();

export type TAssessmentTemplateVersion = z.infer<typeof AssessmentTemplateVersion>;

/* ============================================================
   Assessment primitives
   - Templates live independently (can optionally reference grantId)
   - Submissions are separate docs (enrollment-scoped by default)
   - Acuity is customer-scoped
============================================================ */

/** Canonical scope for an assessment template / submission. */
export const AssessmentScope = z.enum(["customer", "enrollment"]);

/**
 * Assessment "kind" is intentionally flexible (string),
 * but these are canonical defaults you can standardize on.
 */
export const CanonicalAssessmentKind = z.enum([
  "acuity",
  "waitlistPriority",
  "progress",
  "custom",
]);

/** Who can edit a template (server-enforced). */
export const TemplateEditPolicy = z.enum([
  "adminOnly",
  "ownerOrAdmin",
  "team",
  "org",
]);

/* ============================================================
   Rubric schema (your current acuity model)
============================================================ */

export const RubricOption = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string().trim().min(1),
  points: z.number().default(0),
});

export const RubricQuestion = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  options: z.array(RubricOption).min(1),
});

export const RubricLevel = z.object({
  min: z.number().default(0),
  max: z.number().optional(), // undefined → +∞
  label: z.string().trim().min(1),
});

export const RubricDef = z.object({
  title: z.string().trim().min(1),
  version: z.string().trim().default("v1"),
  questions: z.array(RubricQuestion).min(1),
  levels: z.array(RubricLevel).min(1),
});

/**
 * Template "schema" is a discriminated union so you can add more builders later.
 * For now: rubric-based assessments cover acuity + priority scoring.
 */
export const AssessmentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rubric"),
    rubric: RubricDef,
  }),
]);

/* ============================================================
   Template
============================================================ */

export const AssessmentTemplate = z
  .object({
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
    updatedAt: z.unknown().optional(),
  })
  .passthrough();

/** Type includes dynamic keys. */
export type AssessmentTemplateInput = z.infer<typeof AssessmentTemplate> & Record<string, unknown>;

/** "Doc" variants: what the server returns (id is required). */
export type TAssessmentTemplateDoc = AssessmentTemplateInput & { id: string };

export const AssessmentTemplateUpsertBody = z.union([
  AssessmentTemplate,
  z.array(AssessmentTemplate),
]);

// ---- Endpoint request-body types (so endpointMap.ts can stay type-only) ----
export type TAssessmentTemplateUpsertReq = z.infer<typeof AssessmentTemplateUpsertBody>;
export type TGetTemplateReq = z.infer<typeof GetTemplateBody>;
export type TListTemplatesReq = z.infer<typeof ListTemplatesBody>;
export type TDeleteTemplateReq = z.infer<typeof DeleteTemplateBody>;

export const GetTemplateBody = z.object({
  templateId: z.string().trim().min(1),
});

export const ListTemplatesBody = z
  .object({
    grantId: z.string().trim().min(1).nullish(),
    kind: z.string().trim().min(1).nullish(),
    scope: AssessmentScope.nullish(),
    includeLocked: z.boolean().optional().default(true),
  })
  .passthrough();

export const DeleteTemplateBody = z.object({
  templateId: z.string().trim().min(1),
  force: z.boolean().optional().default(false),
});

/* ============================================================
   Submission
============================================================ */

export const AssessmentAnswer = z.object({
  qId: z.string().trim().min(1),
  answer: z.union([z.string(), z.number()]),
});

export const AssessmentComputed = z
  .object({
    score: z.number().nullable().optional(),
    level: z.string().nullable().optional(),
    // for future computed outputs (priority buckets, derived flags, etc.)
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const AssessmentSubmission = z
  .object({
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
    periodKey: z.string().trim().nullish(), // "2026-03" | "2026-W11" | null
    supersedes: z.string().trim().nullish(), // prior submissionId this replaces
    supersededByRunId: z.string().trim().nullish(),
    supersededAt: z.string().nullish(),

    // timestamps
    createdAt: TsLike.nullish().optional(),
    updatedAt: TsLike.nullish().optional(),
  })
  .passthrough();

export type TAssessmentSubmission = z.infer<typeof AssessmentSubmission>;
export type TAssessmentSubmissionDoc = TAssessmentSubmission & { id: string };

/** Submit (create) a new submission. Supports single submission or array for batch processing. */
export const SubmitAssessmentBody = z.union([
  z.object({
    templateId: z.string().trim().min(1),
    customerId: z.string().trim().min(1).nullish(),
    enrollmentId: z.string().trim().min(1).nullish(),
    answers: z.array(AssessmentAnswer).default([]),

    // optional: FE can send a preview, but server should recompute anyway
    computedClient: AssessmentComputed.nullish(),
  }).passthrough(),
  z.array(z.object({
    templateId: z.string().trim().min(1),
    customerId: z.string().trim().min(1).nullish(),
    enrollmentId: z.string().trim().min(1).nullish(),
    answers: z.array(AssessmentAnswer).default([]),

    // optional: FE can send a preview, but server should recompute anyway
    computedClient: AssessmentComputed.nullish(),
  }).passthrough()).min(1).max(50), // Reasonable batch limit
]);

export const GetSubmissionBody = z.object({
  submissionId: z.string().trim().min(1),
});

export const ListSubmissionsBody = z
  .object({
    customerId: z.string().trim().min(1).nullish(),
    enrollmentId: z.string().trim().min(1).nullish(),
    templateId: z.string().trim().min(1).nullish(),
    // contextId — fetch the full history stack for one entity+kind combo
    contextId: z.string().trim().min(1).nullish(),
    status: AssessmentRunStatus.nullish(),
    limit: z.number().int().min(1).max(500).optional().default(50),
  })
  .passthrough();

/** Admin recompute scores when rules/templates change. */
export const RecalcTemplateBody = z.object({
  templateId: z.string().trim().min(1),
  activeOnly: z.boolean().optional().default(true),
});

export type TSubmitAssessmentReq = z.infer<typeof SubmitAssessmentBody>;
export type TGetSubmissionReq = z.infer<typeof GetSubmissionBody>;
export type TListSubmissionsReq = z.infer<typeof ListSubmissionsBody>;
export type TRecalcTemplateReq = z.infer<typeof RecalcTemplateBody>;

/* ============================================================
   New endpoint bodies
============================================================ */

/**
 * Push partial answers into an existing open submission without a full re-submit.
 * Merges by qId — later push for same question overwrites prior.
 */
export const PushAnswerBody = z.object({
  submissionId: z.string().trim().min(1),
  answers: z.array(AssessmentAnswer).min(1).max(100),
  // where in the UI this push came from — stored for audit trail
  sourceSurface: z.string().trim().optional().default("inlineUI"),
  // optional period bucket, e.g. "2026-03" for monthly rolling assessments
  periodKey: z.string().trim().nullish(),
});
export type TPushAnswerReq = z.infer<typeof PushAnswerBody>;

/**
 * Open a new submission as a reassessment of a prior one.
 * Provide either priorSubmissionId (direct) or customerId/enrollmentId + kind (lookup).
 * The prior submission is marked superseded atomically.
 */
export const OpenReassessmentBody = z.object({
  // direct reference
  priorSubmissionId: z.string().trim().min(1).nullish(),
  // lookup by entity + kind
  customerId: z.string().trim().min(1).nullish(),
  enrollmentId: z.string().trim().min(1).nullish(),
  kind: z.string().trim().min(1).nullish(),
  // options
  prefillAnswers: z.boolean().optional().default(true),
  openedReason: z.enum(["manual", "reassessment", "scheduled"]).optional().default("reassessment"),
});
export type TOpenReassessmentReq = z.infer<typeof OpenReassessmentBody>;

/**
 * Fetch all versions for a template (newest first).
 */
export const ListVersionsBody = z.object({
  templateId: z.string().trim().min(1),
  status: z.enum(["draft", "published", "deprecated"]).nullish(),
});
export type TListVersionsReq = z.infer<typeof ListVersionsBody>;