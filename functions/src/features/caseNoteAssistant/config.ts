export type UserQuotaOverride = { dailyRequestLimit?: number; dailyTokenLimit?: number };
export type CaseNoteBetaConfig = {
  enabled: boolean; allowedWorkbookVariants: string[]; defaultClientLabel: string; defaultStaffLabel: string;
  monthlyTokenLimit: number; monthlyRequestLimit: number; dailyUserRequestLimit: number; dailyUserTokenLimit: number;
  userQuotaOverrides: Record<string, UserQuotaOverride>;
  defaultModel: string; fallbackModel: string | null; maxInputChars: number; maxOutputTokens: number; temperature: number;
};
export const DEFAULT_CASE_NOTE_BETA_CONFIG: CaseNoteBetaConfig = {
  enabled: false, allowedWorkbookVariants: ["payer"], defaultClientLabel: "client", defaultStaffLabel: "case manager",
  monthlyTokenLimit: 25_000_000, monthlyRequestLimit: 10_000, dailyUserRequestLimit: 25, dailyUserTokenLimit: 100_000,
  userQuotaOverrides: {}, defaultModel: "gemini-2.5-flash-lite", fallbackModel: null, maxInputChars: 12_000, maxOutputTokens: 800, temperature: 0.2,
};
export function hydrateCaseNoteBetaConfig(raw: Partial<CaseNoteBetaConfig> | null | undefined): CaseNoteBetaConfig {
  return { ...DEFAULT_CASE_NOTE_BETA_CONFIG, ...(raw ?? {}), allowedWorkbookVariants: Array.isArray(raw?.allowedWorkbookVariants) ? raw.allowedWorkbookVariants : ["payer"], userQuotaOverrides: raw?.userQuotaOverrides && typeof raw.userQuotaOverrides === "object" ? raw.userQuotaOverrides : {} };
}
