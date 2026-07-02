import {
  __export
} from "./chunk-MLKGABMK.js";

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
import { z } from "zod";
var CaseNoteActionSchema = z.enum([
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
var CaseNoteModeSchema = z.enum(["freeform", "interview"]);
var CaseNoteInterviewFieldsSchema = z.object({
  clientResponse: z.string().max(4e3).nullish(),
  caseManagerAction: z.string().max(4e3).nullish(),
  barrier: z.string().max(4e3).nullish(),
  progress: z.string().max(4e3).nullish(),
  nextStep: z.string().max(4e3).nullish()
});
var GenerateCaseNoteSuggestionBodySchema = z.object({
  customerId: z.string().min(1).max(128),
  sessionId: z.string().max(128).nullish(),
  mode: CaseNoteModeSchema,
  action: CaseNoteActionSchema,
  program: z.string().max(120).nullish(),
  serviceType: z.string().max(120).nullish(),
  visitLengthMinutes: z.number().int().min(0).max(1440).nullish(),
  draft: z.string().max(12e3).nullish(),
  clientLabel: z.string().min(1).max(40).default("client"),
  staffLabel: z.string().min(1).max(40).default("case manager"),
  interviewFields: CaseNoteInterviewFieldsSchema.nullish()
}).superRefine((value, ctx) => {
  const hasInterviewText = value.interviewFields && Object.values(value.interviewFields).some((v) => String(v ?? "").trim());
  if (value.mode === "freeform" && !String(value.draft ?? "").trim()) ctx.addIssue({ code: "custom", message: "Draft is required.", path: ["draft"] });
  if (value.mode === "interview" && !hasInterviewText) ctx.addIssue({ code: "custom", message: "At least one interview field is required.", path: ["interviewFields"] });
});
var GenerateCaseNoteSuggestionResponseSchema = z.object({
  ok: z.literal(true),
  suggestion: z.string(),
  requestId: z.string(),
  action: CaseNoteActionSchema,
  model: z.string(),
  usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() })
});
var RecordCaseNoteSuggestionDecisionBodySchema = z.object({
  requestId: z.string().uuid(),
  accepted: z.boolean()
});

export {
  CaseNoteActionSchema,
  CaseNoteModeSchema,
  CaseNoteInterviewFieldsSchema,
  GenerateCaseNoteSuggestionBodySchema,
  GenerateCaseNoteSuggestionResponseSchema,
  RecordCaseNoteSuggestionDecisionBodySchema,
  caseNoteAssistant_exports
};
