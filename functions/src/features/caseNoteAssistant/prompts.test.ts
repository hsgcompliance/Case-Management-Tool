import { describe, expect, it } from "vitest";
import { assemblePrompt, promptTemplateIds, selectCaseNoteStaffLabel, sentenceTarget } from "./prompts";
import { hydrateCaseNoteBetaConfig } from "./config";
import { estimateAiCostUsd } from "./pricing";
import { buildAiUsageAudit } from "./privacy";
import { CaseNoteAssistantError, caseNotePhiControlsVerified, resolveCaseNoteLocation, resolveCaseNoteModel } from "./service";

describe("case-note assistant prompts", () => {
  it.each([[0, "1-2 substantive sentences"], [8, "2-3 substantive sentences"], [15, "3-4 substantive sentences"], [25, "5-6 substantive sentences"], [45, "6-8 substantive sentences"], [75, "8-10 substantive sentences"]])("maps %s minutes", (minutes, expected) => expect(sentenceTarget(Number(minutes))).toBe(expected));
  it("includes identity normalization, quote preservation, and no-invention rules", () => {
    const prompt = assemblePrompt({ customerId: "c", sessionId: null, mode: "freeform", action: "improve", program: null, serviceType: null, visitLengthMinutes: 45, draft: 'I met John. John said, "I am scared."', clientLabel: "client", staffLabel: "case manager", interviewFields: null }, { clientNames: ["John"], staffNames: ["Jane"] });
    expect(prompt).toContain("Do not invent facts");
    expect(prompt).toContain("meaningful direct client quotes");
    expect(prompt).toContain('Replace known client names/aliases (John) with "client"');
    expect(prompt).toContain("staff first-person I/me/my");
  });
  it("selects one of the requested narrator labels across the random range", () => {
    expect([0, 0.25, 0.5, 0.75].map(selectCaseNoteStaffLabel)).toEqual(["CM", "Writer", "case manager", "casemanger"]);
  });
  it("requires one staff label throughout and weaves contact context into prose", () => {
    const prompt = assemblePrompt({ customerId: "c", sessionId: null, mode: "freeform", action: "improve", program: null, serviceType: null, contactType: "in-person", visitLengthMinutes: 10, draft: "I met with the client.", clientLabel: "client", staffLabel: "Writer", interviewFields: null }, { clientNames: [], staffNames: [] });
    expect(prompt).toContain('single selected staff narrator label is "Writer"');
    expect(prompt).toContain("never switch to another staff label within the note");
    expect(prompt).toContain("Never add a standalone contact-type label or prefix");
    expect(prompt).toContain("Contact method: in-person");
  });
  it("omits blank interview fields", () => {
    const prompt = assemblePrompt({ customerId: "c", sessionId: null, mode: "interview", action: "interview_draft", program: null, serviceType: null, visitLengthMinutes: 10, draft: null, clientLabel: "client", staffLabel: "case manager", interviewFields: { clientResponse: '"I need help"', caseManagerAction: "", barrier: null, progress: null, nextStep: null } }, { clientNames: [], staffNames: [] });
    expect(prompt).toContain('Client quote or response:\n"I need help"');
    expect(prompt).not.toContain("Barrier or need:");
  });
  it("uses a source-supported fallback when session time is absent", () => expect(sentenceTarget(null)).toBe("a concise length supported by the source"));
  it("records the selected task template", () => expect(promptTemplateIds("compliance_review")).toContain("case-note-compliance-review-v3"));
  it("passes visit minutes into backend metadata and the task sentence target", () => {
    const prompt = assemblePrompt({ customerId: "c", sessionId: null, mode: "freeform", action: "improve", program: null, serviceType: null, visitLengthMinutes: 45, draft: "Draft", clientLabel: "client", staffLabel: "case manager", interviewFields: null }, { clientNames: [], staffNames: [] });
    expect(prompt).toContain("Visit length in minutes: 45");
    expect(prompt).toContain("Target sentence count: 6-8 substantive sentences");
    expect(prompt).toContain("Target approximately 6-8 substantive sentences");
  });
});

describe("case-note assistant cost controls", () => {
  it("uses conservative org and per-user defaults", () => {
    const config = hydrateCaseNoteBetaConfig(undefined);
    expect(config.enabled).toBe(false);
    expect(config.dailyUserRequestLimit).toBe(25);
    expect(config.dailyUserTokenLimit).toBe(100_000);
    expect(config.monthlyRequestLimit).toBe(10_000);
    expect(config.monthlyTokenLimit).toBe(25_000_000);
  });
  it("preserves per-user quota overrides", () => {
    const config = hydrateCaseNoteBetaConfig({ userQuotaOverrides: { user1: { enabled: true, dailyRequestLimit: 5, dailyTokenLimit: 10_000 } } });
    expect(config.userQuotaOverrides.user1).toEqual({ enabled: true, dailyRequestLimit: 5, dailyTokenLimit: 10_000 });
  });
  it("estimates known model cost and declines unknown pricing", () => {
    expect(estimateAiCostUsd("gemini-2.5-flash-lite", 3_000, 250)).toBeCloseTo(0.0004);
    expect(estimateAiCostUsd("gemini-3.1-flash-lite", 1_000_000, 1_000_000)).toBeCloseTo(1.925);
    expect(estimateAiCostUsd("unknown", 3_000, 250)).toBeNull();
  });
  it("migrates the retiring model and rejects unapproved PHI model or region overrides", () => {
    expect(resolveCaseNoteModel("gemini-2.5-flash-lite", undefined)).toBe("gemini-3.1-flash-lite");
    expect(resolveCaseNoteModel("gemini-3.1-flash-lite", undefined)).toBe("gemini-3.1-flash-lite");
    expect(() => resolveCaseNoteModel("gemini-3.5-flash-lite", undefined)).toThrow(CaseNoteAssistantError);
    expect(resolveCaseNoteLocation(undefined)).toBe("us-central1");
    expect(() => resolveCaseNoteLocation("global")).toThrow(CaseNoteAssistantError);
  });
  it("requires all three PHI control attestations", () => {
    expect(caseNotePhiControlsVerified(["true", "true", "true"])).toBe(true);
    expect(caseNotePhiControlsVerified(["true", "false", "true"])).toBe(false);
    expect(caseNotePhiControlsVerified(["true", "true"])).toBe(false);
  });
  it("keeps audit records on a strict metadata-only allowlist", () => {
    const record = buildAiUsageAudit({ requestId: "r", uid: "u", orgId: "o", action: "improve", model: "gemini-2.5-flash-lite", inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001, latencyMs: 20, promptTemplateIds: ["template"] });
    expect(Object.keys(record).sort()).toEqual(["acceptedByUser", "action", "createdAt", "estimatedCostUsd", "feature", "inputTokens", "latencyMs", "model", "orgId", "outputTokens", "promptTemplateIds", "requestId", "status", "totalTokens", "uid"].sort());
    expect(record).not.toHaveProperty("prompt");
    expect(record).not.toHaveProperty("suggestion");
    expect(record).not.toHaveProperty("customerId");
    expect(record).not.toHaveProperty("program");
  });
});
