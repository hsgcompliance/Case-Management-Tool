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
module.exports = __toCommonJS(caseNoteAssistant_exports);
var import_zod = require("zod");
var CaseNoteActionSchema = import_zod.z.enum([
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
var CaseNoteModeSchema = import_zod.z.enum(["freeform", "interview"]);
var CaseNoteInterviewFieldsSchema = import_zod.z.object({
  clientResponse: import_zod.z.string().max(4e3).nullish(),
  caseManagerAction: import_zod.z.string().max(4e3).nullish(),
  barrier: import_zod.z.string().max(4e3).nullish(),
  progress: import_zod.z.string().max(4e3).nullish(),
  nextStep: import_zod.z.string().max(4e3).nullish()
});
var GenerateCaseNoteSuggestionBodySchema = import_zod.z.object({
  customerId: import_zod.z.string().min(1).max(128),
  sessionId: import_zod.z.string().max(128).nullish(),
  mode: CaseNoteModeSchema,
  action: CaseNoteActionSchema,
  program: import_zod.z.string().max(120).nullish(),
  serviceType: import_zod.z.string().max(120).nullish(),
  contactType: import_zod.z.string().max(60).nullish(),
  visitLengthMinutes: import_zod.z.number().int().min(0).max(1440).nullish(),
  draft: import_zod.z.string().max(12e3).nullish(),
  clientLabel: import_zod.z.string().min(1).max(40).default("client"),
  staffLabel: import_zod.z.string().min(1).max(40).default("case manager"),
  interviewFields: CaseNoteInterviewFieldsSchema.nullish()
}).superRefine((value, ctx) => {
  const hasInterviewText = value.interviewFields && Object.values(value.interviewFields).some((v) => String(v ?? "").trim());
  if (value.mode === "freeform" && !String(value.draft ?? "").trim()) ctx.addIssue({ code: "custom", message: "Draft is required.", path: ["draft"] });
  if (value.mode === "interview" && !hasInterviewText) ctx.addIssue({ code: "custom", message: "At least one interview field is required.", path: ["interviewFields"] });
});
var GenerateCaseNoteSuggestionResponseSchema = import_zod.z.object({
  ok: import_zod.z.literal(true),
  suggestion: import_zod.z.string(),
  requestId: import_zod.z.string(),
  action: CaseNoteActionSchema,
  model: import_zod.z.string(),
  missingOrUnclear: import_zod.z.array(import_zod.z.string()).default([]),
  complianceSuggestions: import_zod.z.array(import_zod.z.string()).default([]),
  usage: import_zod.z.object({ inputTokens: import_zod.z.number().int().nonnegative(), outputTokens: import_zod.z.number().int().nonnegative() })
});
var RecordCaseNoteSuggestionDecisionBodySchema = import_zod.z.object({
  requestId: import_zod.z.string().uuid(),
  accepted: import_zod.z.boolean()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CaseNoteActionSchema,
  CaseNoteInterviewFieldsSchema,
  CaseNoteModeSchema,
  GenerateCaseNoteSuggestionBodySchema,
  GenerateCaseNoteSuggestionResponseSchema,
  RecordCaseNoteSuggestionDecisionBodySchema
});
