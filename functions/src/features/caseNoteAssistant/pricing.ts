/** Planning estimates only. Confirm current Vertex AI pricing before production. */
export const MODEL_PRICING: Record<string, { inputPerMillionUsd: number; outputPerMillionUsd: number }> = {
  "gemini-2.5-flash-lite": { inputPerMillionUsd: 0.10, outputPerMillionUsd: 0.40 },
  "gemini-3.1-flash-lite": { inputPerMillionUsd: 0.25, outputPerMillionUsd: 1.50 },
};

export function estimateAiCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  return (inputTokens / 1_000_000) * pricing.inputPerMillionUsd + (outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
}
