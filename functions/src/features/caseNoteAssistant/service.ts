import { randomUUID } from "node:crypto";
import { getApp } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import type { TGenerateCaseNoteSuggestionReq } from "@hdb/contracts";
import { canAccessDoc, db, requireOrgId, requireUid } from "../../core";
import { assemblePrompt, promptTemplateIds } from "./prompts";
import { hydrateCaseNoteBetaConfig } from "./config";
import { estimateAiCostUsd } from "./pricing";
import { buildAiUsageAudit } from "./privacy";

export class CaseNoteAssistantError extends Error { constructor(public status: number, public safeMessage: string) { super(safeMessage); } }
// Canonical variant token: lowercase, no spaces/dashes ("nonpayer", "payer").
// Applied to BOTH the stored workbook variant and the org-config allowlist so
// admin-entered spellings ("non-payer", "Non Payer") can't silently mismatch.
function normVariant(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}
function variantOf(customer: Record<string, any>): string {
  const wb = customer.customerDrive?.linkedWorkbooks?.tss;
  return normVariant(wb?.variant ?? wb?.workbookVariant ?? wb?.detectedVariant ?? "");
}
// The prompt asks for {"draftNote", "missingOrUnclear", "complianceSuggestions"}.
// Falls back to treating the whole text as the note so a model that ignores
// JSON mode degrades to the old single-suggestion behavior instead of failing.
function parseStructuredSuggestion(text: string): { draftNote: string; missingOrUnclear: string[]; complianceSuggestions: string[] } {
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    const obj = JSON.parse(stripped) as Record<string, unknown>;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 5) : []);
      return { draftNote: String(obj.draftNote ?? "").trim(), missingOrUnclear: list(obj.missingOrUnclear), complianceSuggestions: list(obj.complianceSuggestions).slice(0, 3) };
    }
  } catch { /* not JSON — fall through to raw text */ }
  return { draftNote: text, missingOrUnclear: [], complianceSuggestions: [] };
}
function monthKey(now = new Date()) { return now.toISOString().slice(0, 7); }
function dayKey(now = new Date()) { return now.toISOString().slice(0, 10); }

export async function generateSuggestion(caller: Record<string, unknown>, input: TGenerateCaseNoteSuggestionReq) {
  const uid = requireUid(caller); const orgId = requireOrgId(caller); const requestId = randomUUID();
  const [customerSnap, configDocs, userSnap] = await Promise.all([
    db.collection("customers").doc(input.customerId).get(),
    db.collection("orgs").doc(orgId).collection("Config").where("kind", "==", "display").get(),
    db.collection("userExtras").doc(uid).get(),
  ]);
  if (!customerSnap.exists || !canAccessDoc(caller, customerSnap.data() || {})) throw new CaseNoteAssistantError(403, "You do not have access to this customer.");
  const customer = customerSnap.data() as Record<string, any>;
  const displayConfig = configDocs.docs.find((doc) => /grant|budget|display/i.test(String(doc.data().label || ""))) ?? configDocs.docs[0];
  const raw = displayConfig?.data()?.value?.aiFeatures?.caseNoteAssistantBeta ?? {};
  const config = hydrateCaseNoteBetaConfig(raw);
  if (!config.enabled) throw new CaseNoteAssistantError(403, "AI assistant is not enabled for this organization.");
  const profile = userSnap.data() || {};
  const userLimits = config.userQuotaOverrides[uid] ?? {};
  if (userLimits.enabled !== true) throw new CaseNoteAssistantError(403, "AI assistant access has not been enabled for your account.");
  if (profile.settings?.allowAiAssistance !== true) throw new CaseNoteAssistantError(403, "Enable AI assistance in your personal settings before using this feature.");
  const wb = customer.customerDrive?.linkedWorkbooks?.tss;
  const customerVariant = variantOf(customer);
  if (!String(wb?.spreadsheetId ?? "").trim() || !customerVariant || !config.allowedWorkbookVariants.map(normVariant).includes(customerVariant)) throw new CaseNoteAssistantError(403, "AI assistant is only available for payer-linked customers.");

  const quotaRef = db.collection("aiCaseNoteUsage").doc(`${orgId}_${monthKey()}`);
  const dailyRef = quotaRef.collection("users").doc(`${uid}_${dayKey()}`);
  const [orgUsage, dailyUsage] = await Promise.all([quotaRef.get(), dailyRef.get()]);
  const dailyRequestLimit = userLimits.dailyRequestLimit ?? config.dailyUserRequestLimit;
  const dailyTokenLimit = userLimits.dailyTokenLimit ?? config.dailyUserTokenLimit;
  if ((Number(dailyUsage.data()?.requests) || 0) >= dailyRequestLimit || (Number(dailyUsage.data()?.tokens) || 0) >= dailyTokenLimit || (Number(orgUsage.data()?.requests) || 0) >= config.monthlyRequestLimit || (Number(orgUsage.data()?.tokens) || 0) >= config.monthlyTokenLimit) throw new CaseNoteAssistantError(429, "AI suggestions are temporarily unavailable because the usage limit has been reached.");

  const normalized: TGenerateCaseNoteSuggestionReq = { ...input, clientLabel: input.clientLabel || config.defaultClientLabel, staffLabel: input.staffLabel || config.defaultStaffLabel };
  const sourceLength = input.mode === "interview"
    ? Object.values(input.interviewFields ?? {}).reduce((total, value) => total + String(value ?? "").length, 0)
    : String(input.draft ?? "").length;
  if (sourceLength > config.maxInputChars) throw new CaseNoteAssistantError(400, "Note is too long for AI cleanup. Please shorten the draft and try again.");
  const prompt = assemblePrompt(normalized, {
    clientNames: [customer.name, customer.firstName, customer.lastName, ...(Array.isArray(customer.aliases) ? customer.aliases : [])].filter(Boolean),
    staffNames: [profile.displayName, profile.name, profile.firstName, profile.lastName, ...(Array.isArray(profile.aliases) ? profile.aliases : [])].filter(Boolean),
  });
  const model = process.env.CASE_NOTE_VERTEX_MODEL || config.defaultModel;
  const location = process.env.CASE_NOTE_VERTEX_LOCATION || "us-central1";
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!project) throw new CaseNoteAssistantError(503, "Could not generate suggestion. Please try again.");
  const token = await getApp().options.credential?.getAccessToken();
  const started = Date.now();
  const response = await fetch(`https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`, {
    method: "POST", headers: { Authorization: `Bearer ${token?.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: config.temperature, responseMimeType: "application/json", maxOutputTokens: Math.min(config.maxOutputTokens, ["grammar_only", "shorten", "missing_questions", "compliance_review"].includes(input.action) ? 500 : 900) } }),
  });
  if (!response.ok) throw new CaseNoteAssistantError(502, "Could not generate suggestion. Please try again.");
  const data: any = await response.json();
  const rawText = String(data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim();
  if (!rawText) throw new CaseNoteAssistantError(502, "Could not generate suggestion. Please try again.");
  const parsed = parseStructuredSuggestion(rawText);
  if (!parsed.draftNote && !parsed.missingOrUnclear.length && !parsed.complianceSuggestions.length) throw new CaseNoteAssistantError(502, "Could not generate suggestion. Please try again.");
  const inputTokens = Number(data.usageMetadata?.promptTokenCount) || 0; const outputTokens = Number(data.usageMetadata?.candidatesTokenCount) || 0; const tokens = inputTokens + outputTokens;
  const estimatedCostUsd = estimateAiCostUsd(model, inputTokens, outputTokens);
  await Promise.all([
    quotaRef.set({ orgId, month: monthKey(), requests: FieldValue.increment(1), tokens: FieldValue.increment(tokens), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    dailyRef.set({ uid, day: dayKey(), requests: FieldValue.increment(1), tokens: FieldValue.increment(tokens), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    db.collection("aiCaseNoteAudit").doc(requestId).set(buildAiUsageAudit({ requestId, uid, orgId, action: input.action, promptTemplateIds: promptTemplateIds(input.action), model, inputTokens, outputTokens, estimatedCostUsd, latencyMs: Date.now() - started })),
  ]);
  return { suggestion: parsed.draftNote, missingOrUnclear: parsed.missingOrUnclear, complianceSuggestions: parsed.complianceSuggestions, requestId, action: input.action, model, usage: { inputTokens, outputTokens } };
}
