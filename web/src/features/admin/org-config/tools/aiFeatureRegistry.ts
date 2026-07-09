// web/src/features/admin/org-config/tools/aiFeatureRegistry.ts
//
// Registry of AI features controllable from the "AI Control" org-config tool.
// Each entry owns a lens (readEligibility/writeEligibility) over its own full
// config shape (quotas, model, etc.) so the tool only ever touches the
// enable/disable + eligibility slice — adding a future AI feature means adding
// one entry here, not changing AiControlTool.tsx.

export type AiFeatureEligibility = {
  enabled: boolean;
  allowedWorkbookVariants: string[];
};

export type AiFeatureRegistryEntry = {
  id: string;
  title: string;
  description: string;
  /** Shown under the description as a reminder of gates this tool does not control. */
  personalOptInNote?: string;
  readEligibility: (raw: Record<string, unknown> | undefined) => AiFeatureEligibility;
  writeEligibility: (
    raw: Record<string, unknown> | undefined,
    patch: AiFeatureEligibility,
  ) => Record<string, unknown>;
};

export const CASE_NOTE_ASSISTANT_DEFAULTS: Record<string, unknown> = {
  enabled: false,
  allowedWorkbookVariants: ["payer"],
  defaultClientLabel: "client",
  defaultStaffLabel: "case manager",
  monthlyTokenLimit: 25_000_000,
  monthlyRequestLimit: 10_000,
  dailyUserRequestLimit: 25,
  dailyUserTokenLimit: 100_000,
  userQuotaOverrides: {},
  defaultModel: "gemini-2.5-flash-lite",
  fallbackModel: null,
  maxInputChars: 12_000,
  maxOutputTokens: 800,
  temperature: 0.2,
};

export const AI_FEATURE_REGISTRY: AiFeatureRegistryEntry[] = [
  {
    id: "caseNoteAssistantBeta",
    title: "AI Case Note Assistant (Beta)",
    description:
      "Preview-only writing suggestions for eligible customers. Gated below by which linked-workbook variants qualify.",
    personalOptInNote:
      "Also requires the individual staff member to enable \"Allow AI assistance\" under their personal Settings.",
    readEligibility: (raw) => ({
      enabled: raw?.enabled === true,
      allowedWorkbookVariants: Array.isArray(raw?.allowedWorkbookVariants)
        ? (raw!.allowedWorkbookVariants as string[])
        : ["payer"],
    }),
    writeEligibility: (raw, patch) => ({
      ...CASE_NOTE_ASSISTANT_DEFAULTS,
      ...(raw ?? {}),
      ...patch,
    }),
  },
];
