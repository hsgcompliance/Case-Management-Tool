import api from "./api";

export type CaseNoteUsageSummaryQuery = {
  month?: string;
  orgId?: string;
};

export type CaseNoteUsageSummaryResponse = {
  ok: true;
  month: string;
  org: {
    requests: number;
    tokens: number;
    monthlyRequestLimit: number;
    monthlyTokenLimit: number;
  };
  users: Array<{
    uid: string;
    requests: number;
    tokens: number;
    daysActive: number;
    dailyRequestLimit: number;
    dailyTokenLimit: number;
    enabled: boolean;
  }>;
};

export const CaseNoteAssistant = {
  usageSummary: (query: CaseNoteUsageSummaryQuery = {}) =>
    api.get("caseNoteUsageSummary", query) as Promise<CaseNoteUsageSummaryResponse>,
};

export default CaseNoteAssistant;
