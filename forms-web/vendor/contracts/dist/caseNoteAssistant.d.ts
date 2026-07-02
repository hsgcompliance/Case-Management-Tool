import { z } from "zod";
export declare const CaseNoteActionSchema: z.ZodEnum<{
    improve: "improve";
    grammar_only: "grammar_only";
    shorten: "shorten";
    add_detail: "add_detail";
    professional_tone: "professional_tone";
    compliance_review: "compliance_review";
    neutral_language: "neutral_language";
    missing_questions: "missing_questions";
    interview_draft: "interview_draft";
}>;
export declare const CaseNoteModeSchema: z.ZodEnum<{
    freeform: "freeform";
    interview: "interview";
}>;
export declare const CaseNoteInterviewFieldsSchema: z.ZodObject<{
    clientResponse: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerAction: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    barrier: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    progress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    nextStep: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const GenerateCaseNoteSuggestionBodySchema: z.ZodObject<{
    customerId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mode: z.ZodEnum<{
        freeform: "freeform";
        interview: "interview";
    }>;
    action: z.ZodEnum<{
        improve: "improve";
        grammar_only: "grammar_only";
        shorten: "shorten";
        add_detail: "add_detail";
        professional_tone: "professional_tone";
        compliance_review: "compliance_review";
        neutral_language: "neutral_language";
        missing_questions: "missing_questions";
        interview_draft: "interview_draft";
    }>;
    program: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serviceType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    contactType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    visitLengthMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    draft: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    clientLabel: z.ZodDefault<z.ZodString>;
    staffLabel: z.ZodDefault<z.ZodString>;
    interviewFields: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        clientResponse: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        caseManagerAction: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        barrier: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        progress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        nextStep: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const GenerateCaseNoteSuggestionResponseSchema: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    suggestion: z.ZodString;
    requestId: z.ZodString;
    action: z.ZodEnum<{
        improve: "improve";
        grammar_only: "grammar_only";
        shorten: "shorten";
        add_detail: "add_detail";
        professional_tone: "professional_tone";
        compliance_review: "compliance_review";
        neutral_language: "neutral_language";
        missing_questions: "missing_questions";
        interview_draft: "interview_draft";
    }>;
    model: z.ZodString;
    missingOrUnclear: z.ZodDefault<z.ZodArray<z.ZodString>>;
    complianceSuggestions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TCaseNoteAction = z.infer<typeof CaseNoteActionSchema>;
export type TGenerateCaseNoteSuggestionReq = z.infer<typeof GenerateCaseNoteSuggestionBodySchema>;
export type TGenerateCaseNoteSuggestionResp = z.infer<typeof GenerateCaseNoteSuggestionResponseSchema>;
export declare const RecordCaseNoteSuggestionDecisionBodySchema: z.ZodObject<{
    requestId: z.ZodString;
    accepted: z.ZodBoolean;
}, z.core.$strip>;
export type TRecordCaseNoteSuggestionDecisionReq = z.infer<typeof RecordCaseNoteSuggestionDecisionBodySchema>;
export type TRecordCaseNoteSuggestionDecisionResp = {
    ok: true;
};
