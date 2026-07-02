import { FieldValue } from "firebase-admin/firestore";
import type { TCaseNoteAction } from "@hdb/contracts";

/**
 * Strict metadata allowlist. Never add prompts, source text, generated text,
 * names, customer/workbook identifiers, or error objects to this record.
 */
export function buildAiUsageAudit(input: {
  requestId: string; uid: string; orgId: string; action: TCaseNoteAction; model: string;
  inputTokens: number; outputTokens: number; estimatedCostUsd: number | null; latencyMs: number;
  promptTemplateIds: readonly string[];
}) {
  return {
    requestId: input.requestId,
    uid: input.uid,
    orgId: input.orgId,
    feature: "case-note-assistant",
    action: input.action,
    model: input.model,
    promptTemplateIds: [...input.promptTemplateIds],
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.inputTokens + input.outputTokens,
    estimatedCostUsd: input.estimatedCostUsd,
    status: "success",
    latencyMs: input.latencyMs,
    acceptedByUser: null,
    createdAt: FieldValue.serverTimestamp(),
  };
}
