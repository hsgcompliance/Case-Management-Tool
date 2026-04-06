// functions/src/features/assessments/schemas.ts
export { z } from "@hdb/contracts";

export {
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
} from "@hdb/contracts/assessments";

// ---------- Legacy aliases (acuity/rubric language) ----------
export {
  RubricDef as AcuityRubricDef,
  RubricQuestion as AcuityRubricQuestion,
  RubricOption as AcuityRubricOption,
  RubricLevel as AcuityRubricLevel,
  AssessmentAnswer as AcuityAnswer,
  SubmitAssessmentBody as AcuitySubmitBody,
} from "@hdb/contracts/assessments";

// ---------- New schemas (defined locally until contracts rebuild) ----------
// These mirror contracts/src/assessments.ts additions. After contracts rebuild
// and vendor sync, move these imports above to the @hdb/contracts/assessments block.

import { z } from "zod";

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

/**
 * Flexible output entry stored under assessmentOutputs.{kind} on customer/enrollment docs.
 * Base fields are always present. Template-defined extras from computed.meta are spread in.
 */
export const AssessmentOutputEntry = z
  .object({
    assessmentName: z.string(),
    metric: z.string(),
    score: z.number().nullable().optional(),
    level: z.string().nullable().optional(),
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
  .passthrough();
export type TAssessmentOutputEntry = z.infer<typeof AssessmentOutputEntry>;

/**
 * Push partial answers into an existing open submission.
 */
export const PushAnswerBody = z.object({
  submissionId: z.string().trim().min(1),
  answers: z
    .array(z.object({ qId: z.string().trim().min(1), answer: z.union([z.string(), z.number()]) }))
    .min(1)
    .max(100),
  sourceSurface: z.string().trim().optional().default("inlineUI"),
  periodKey: z.string().trim().nullish(),
});
export type TPushAnswerReq = z.infer<typeof PushAnswerBody>;

/**
 * Open a reassessment run superseding the prior submission.
 */
export const OpenReassessmentBody = z.object({
  priorSubmissionId: z.string().trim().min(1).nullish(),
  customerId: z.string().trim().min(1).nullish(),
  enrollmentId: z.string().trim().min(1).nullish(),
  kind: z.string().trim().min(1).nullish(),
  prefillAnswers: z.boolean().optional().default(true),
  openedReason: z.enum(["manual", "reassessment", "scheduled"]).optional().default("reassessment"),
});
export type TOpenReassessmentReq = z.infer<typeof OpenReassessmentBody>;

/**
 * List published versions for a template.
 */
export const ListVersionsBody = z.object({
  templateId: z.string().trim().min(1),
  status: z.enum(["draft", "published", "deprecated"]).nullish(),
});
export type TListVersionsReq = z.infer<typeof ListVersionsBody>;
