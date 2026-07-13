import { randomUUID } from "node:crypto";
import { getApp } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import { tss } from "@hdb/contracts";
import type { TGenerateCaseNoteSuggestionReq, TGenerateSmartGoalSuggestionReq } from "@hdb/contracts";
import { canAccessDoc, db, isDev, requireOrgId, requireUid } from "../../core";
import { assemblePrompt, promptTemplateIds } from "./prompts";
import { assembleSmartGoalPrompt, SMART_GOAL_TEMPLATE_IDS } from "./smartGoalPrompts";
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

async function readCaseNoteConfig(orgId: string) {
  const configDocs = await db.collection("orgs").doc(orgId).collection("Config").where("kind", "==", "display").get();
  const displayConfig = configDocs.docs.find((doc) => /grant|budget|display/i.test(String(doc.data().label || ""))) ?? configDocs.docs[0];
  return hydrateCaseNoteBetaConfig(displayConfig?.data()?.value?.aiFeatures?.caseNoteAssistantBeta ?? {});
}

export async function getCaseNoteUsageSummary(
  caller: Record<string, unknown>,
  input: { month?: string; orgId?: string },
) {
  const callerOrgId = requireOrgId(caller);
  const requestedOrgId = String(input.orgId || callerOrgId).trim();
  if (requestedOrgId !== callerOrgId && !isDev(caller)) {
    throw new CaseNoteAssistantError(403, "You do not have access to this organization.");
  }

  const month = /^\d{4}-\d{2}$/.test(String(input.month || "")) ? String(input.month) : monthKey();
  const config = await readCaseNoteConfig(requestedOrgId);
  const quotaRef = db.collection("aiCaseNoteUsage").doc(`${requestedOrgId}_${month}`);
  const [orgUsageSnap, usersSnap] = await Promise.all([quotaRef.get(), quotaRef.collection("users").get()]);
  const byUid = new Map<string, { uid: string; requests: number; tokens: number; days: Set<string> }>();

  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    const uid = String(data.uid || doc.id.split("_")[0] || "").trim();
    if (!uid) continue;
    const day = String(data.day || doc.id.slice(uid.length + 1) || "").trim();
    const current = byUid.get(uid) ?? { uid, requests: 0, tokens: 0, days: new Set<string>() };
    current.requests += Math.max(0, Number(data.requests) || 0);
    current.tokens += Math.max(0, Number(data.tokens) || 0);
    if (day) current.days.add(day);
    byUid.set(uid, current);
  }

  const userRows = Array.from(byUid.values()).map((row) => {
    const override = config.userQuotaOverrides[row.uid] ?? {};
    return {
      uid: row.uid,
      requests: row.requests,
      tokens: row.tokens,
      daysActive: row.days.size,
      dailyRequestLimit: Math.max(0, Number(override.dailyRequestLimit ?? config.dailyUserRequestLimit) || 0),
      dailyTokenLimit: Math.max(0, Number(override.dailyTokenLimit ?? config.dailyUserTokenLimit) || 0),
      enabled: override.enabled === true,
    };
  }).sort((a, b) => b.requests - a.requests || b.tokens - a.tokens || a.uid.localeCompare(b.uid));

  const orgData = orgUsageSnap.data() || {};
  const summedRequests = userRows.reduce((total, row) => total + row.requests, 0);
  const summedTokens = userRows.reduce((total, row) => total + row.tokens, 0);

  return {
    month,
    org: {
      requests: Math.max(Number(orgData.requests) || 0, summedRequests),
      tokens: Math.max(Number(orgData.tokens) || 0, summedTokens),
      monthlyRequestLimit: config.monthlyRequestLimit,
      monthlyTokenLimit: config.monthlyTokenLimit,
    },
    users: userRows,
  };
}

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

// The smart-goal prompt asks for the four TSS goal fields + missingInfo. Same
// fail-open JSON handling philosophy as parseStructuredSuggestion, but there is
// no sensible raw-text fallback here: without the structure we can't fill the
// form, so empty fields make the caller throw a safe 502.
function parseSmartGoalSuggestion(text: string): { goalSmart: string; objective: string; interventionTask: string; goalCompletionCriteria: string; missingInfo: string[] } {
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    const obj = JSON.parse(stripped) as Record<string, unknown>;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const str = (value: unknown) => String(value ?? "").trim();
      const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 5) : []);
      return { goalSmart: str(obj.goalSmart), objective: str(obj.objective), interventionTask: str(obj.interventionTask), goalCompletionCriteria: str(obj.goalCompletionCriteria), missingInfo: list(obj.missingInfo) };
    }
  } catch { /* not JSON */ }
  return { goalSmart: "", objective: "", interventionTask: "", goalCompletionCriteria: "", missingInfo: [] };
}

// SMART goal assistant — same eligibility gate order and quota buckets as
// generateSuggestion (org config enabled → per-user override enabled → personal
// allowAiAssistance → payer-variant workbook → daily/monthly quotas), so the
// existing AI admin controls govern both features.
export async function generateSmartGoalSuggestion(caller: Record<string, unknown>, input: TGenerateSmartGoalSuggestionReq) {
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

  const normalized: TGenerateSmartGoalSuggestionReq = { ...input, clientLabel: input.clientLabel || config.defaultClientLabel, staffLabel: input.staffLabel || config.defaultStaffLabel };
  if (String(input.description ?? "").length > config.maxInputChars) throw new CaseNoteAssistantError(400, "Description is too long. Please shorten it and try again.");
  const prompt = assembleSmartGoalPrompt(normalized, {
    clientNames: [customer.name, customer.firstName, customer.lastName, ...(Array.isArray(customer.aliases) ? customer.aliases : [])].filter(Boolean),
    staffNames: [profile.displayName, profile.name, profile.firstName, profile.lastName, ...(Array.isArray(profile.aliases) ? profile.aliases : [])].filter(Boolean),
    serviceTiers: [...tss.TSS_DROPDOWN_LISTS.serviceTier.values],
  });
  const model = process.env.CASE_NOTE_VERTEX_MODEL || config.defaultModel;
  const location = process.env.CASE_NOTE_VERTEX_LOCATION || "us-central1";
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!project) throw new CaseNoteAssistantError(503, "Could not generate the goal. Please try again.");
  const token = await getApp().options.credential?.getAccessToken();
  const started = Date.now();
  const response = await fetch(`https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`, {
    method: "POST", headers: { Authorization: `Bearer ${token?.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: config.temperature, responseMimeType: "application/json", maxOutputTokens: Math.min(config.maxOutputTokens, 700) } }),
  });
  if (!response.ok) throw new CaseNoteAssistantError(502, "Could not generate the goal. Please try again.");
  const data: any = await response.json();
  const rawText = String(data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim();
  if (!rawText) throw new CaseNoteAssistantError(502, "Could not generate the goal. Please try again.");
  const parsed = parseSmartGoalSuggestion(rawText);
  if (!parsed.goalSmart) throw new CaseNoteAssistantError(502, "Could not generate the goal. Please try again.");
  const inputTokens = Number(data.usageMetadata?.promptTokenCount) || 0; const outputTokens = Number(data.usageMetadata?.candidatesTokenCount) || 0; const tokens = inputTokens + outputTokens;
  const estimatedCostUsd = estimateAiCostUsd(model, inputTokens, outputTokens);
  await Promise.all([
    quotaRef.set({ orgId, month: monthKey(), requests: FieldValue.increment(1), tokens: FieldValue.increment(tokens), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    dailyRef.set({ uid, day: dayKey(), requests: FieldValue.increment(1), tokens: FieldValue.increment(tokens), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    db.collection("aiCaseNoteAudit").doc(requestId).set(buildAiUsageAudit({ requestId, uid, orgId, action: "smart_goal", feature: "smart-goal-assistant", promptTemplateIds: SMART_GOAL_TEMPLATE_IDS, model, inputTokens, outputTokens, estimatedCostUsd, latencyMs: Date.now() - started })),
  ]);
  return {
    goal: { goalSmart: parsed.goalSmart, objective: parsed.objective, interventionTask: parsed.interventionTask, goalCompletionCriteria: parsed.goalCompletionCriteria },
    missingInfo: parsed.missingInfo,
    requestId, model, usage: { inputTokens, outputTokens },
  };
}
