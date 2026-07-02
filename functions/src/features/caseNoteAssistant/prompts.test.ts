import { describe, expect, it } from "vitest";
import { assemblePrompt, promptTemplateIds, sentenceTarget } from "./prompts";
import { hydrateCaseNoteBetaConfig } from "./config";
import { estimateAiCostUsd } from "./pricing";
import { buildAiUsageAudit } from "./privacy";

describe("case-note assistant prompts", () => {
  it.each([[0, "1-2 sentences"], [8, "2-3 sentences"], [15, "3-4 sentences"], [25, "3-5 sentences"], [45, "5-7 sentences"], [75, "7-10 sentences"]])("maps %s minutes", (minutes, expected) => expect(sentenceTarget(Number(minutes))).toBe(expected));
  it("includes identity normalization, quote preservation, and no-invention rules", () => {
    const prompt = assemblePrompt({ customerId: "c", sessionId: null, mode: "freeform", action: "improve", program: null, serviceType: null, visitLengthMinutes: 45, draft: 'I met John. John said, "I am scared."', clientLabel: "client", staffLabel: "case manager", interviewFields: null }, { clientNames: ["John"], staffNames: ["Jane"] });
    expect(prompt).toContain("Do not invent facts");
    expect(prompt).toContain("meaningful direct client quotes");
    expect(prompt).toContain('Replace known client names/aliases (John) with "client"');
    expect(prompt).toContain("staff first-person I/me/my");
  });
  it("omits blank interview fields", () => {
    const prompt = assemblePrompt({ customerId: "c", sessionId: null, mode: "interview", action: "interview_draft", program: null, serviceType: null, visitLengthMinutes: 10, draft: null, clientLabel: "client", staffLabel: "case manager", interviewFields: { clientResponse: '"I need help"', caseManagerAction: "", barrier: null, progress: null, nextStep: null } }, { clientNames: [], staffNames: [] });
    expect(prompt).toContain('Client quote or response:\n"I need help"');
    expect(prompt).not.toContain("Barrier or need:");
  });
  it("uses a source-supported fallback when session time is absent", () => expect(sentenceTarget(null)).toBe("a concise length supported by the source"));
  it("records the selected task template", () => expect(promptTemplateIds("compliance_review")).toContain("case-note-compliance-review-v2"));
  it("passes visit minutes into backend metadata and the task sentence target", () => {
    const prompt = assemblePrompt({ customerId: "c", sessionId: null, mode: "freeform", action: "improve", program: null, serviceType: null, visitLengthMinutes: 45, draft: "Draft", clientLabel: "client", staffLabel: "case manager", interviewFields: null }, { clientNames: [], staffNames: [] });
    expect(prompt).toContain("Visit length in minutes: 45");
    expect(prompt).toContain("Target sentence count: 5-7 sentences");
    expect(prompt).toContain("Maintain approximately 5-7 sentences");
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
    const config = hydrateCaseNoteBetaConfig({ userQuotaOverrides: { user1: { dailyRequestLimit: 5, dailyTokenLimit: 10_000 } } });
    expect(config.userQuotaOverrides.user1).toEqual({ dailyRequestLimit: 5, dailyTokenLimit: 10_000 });
  });
  it("estimates known model cost and declines unknown pricing", () => {
    expect(estimateAiCostUsd("gemini-2.5-flash-lite", 3_000, 250)).toBeCloseTo(0.0004);
    expect(estimateAiCostUsd("unknown", 3_000, 250)).toBeNull();
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
