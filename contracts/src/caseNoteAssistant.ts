import { z } from "zod";

export const CaseNoteActionSchema = z.enum([
  "improve", "grammar_only", "shorten", "add_detail", "professional_tone",
  "compliance_review", "neutral_language", "missing_questions", "interview_draft",
]);
export const CaseNoteModeSchema = z.enum(["freeform", "interview"]);
export const CaseNoteInterviewFieldsSchema = z.object({
  clientResponse: z.string().max(4000).nullish(),
  caseManagerAction: z.string().max(4000).nullish(),
  barrier: z.string().max(4000).nullish(),
  progress: z.string().max(4000).nullish(),
  nextStep: z.string().max(4000).nullish(),
});
export const GenerateCaseNoteSuggestionBodySchema = z.object({
  customerId: z.string().min(1).max(128),
  sessionId: z.string().max(128).nullish(),
  mode: CaseNoteModeSchema,
  action: CaseNoteActionSchema,
  program: z.string().max(120).nullish(),
  serviceType: z.string().max(120).nullish(),
  contactType: z.string().max(60).nullish(),
  visitLengthMinutes: z.number().int().min(0).max(1440).nullish(),
  draft: z.string().max(12000).nullish(),
  clientLabel: z.string().min(1).max(40).default("client"),
  staffLabel: z.string().min(1).max(40).default("case manager"),
  interviewFields: CaseNoteInterviewFieldsSchema.nullish(),
}).superRefine((value, ctx) => {
  const hasInterviewText = value.interviewFields && Object.values(value.interviewFields).some((v) => String(v ?? "").trim());
  if (value.mode === "freeform" && !String(value.draft ?? "").trim()) ctx.addIssue({ code: "custom", message: "Draft is required.", path: ["draft"] });
  if (value.mode === "interview" && !hasInterviewText) ctx.addIssue({ code: "custom", message: "At least one interview field is required.", path: ["interviewFields"] });
});

export const GenerateCaseNoteSuggestionResponseSchema = z.object({
  ok: z.literal(true),
  suggestion: z.string(), requestId: z.string(), action: CaseNoteActionSchema, model: z.string(),
  missingOrUnclear: z.array(z.string()).default([]),
  complianceSuggestions: z.array(z.string()).default([]),
  usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }),
});
export type TCaseNoteAction = z.infer<typeof CaseNoteActionSchema>;
export type TGenerateCaseNoteSuggestionReq = z.infer<typeof GenerateCaseNoteSuggestionBodySchema>;
export type TGenerateCaseNoteSuggestionResp = z.infer<typeof GenerateCaseNoteSuggestionResponseSchema>;

export const RecordCaseNoteSuggestionDecisionBodySchema = z.object({
  requestId: z.string().uuid(),
  accepted: z.boolean(),
});
export type TRecordCaseNoteSuggestionDecisionReq = z.infer<typeof RecordCaseNoteSuggestionDecisionBodySchema>;
export type TRecordCaseNoteSuggestionDecisionResp = { ok: true };
