import { describe, expect, it } from "vitest";
import {
  inNullableDateRange,
  ledgerPostBlockers,
  matchesSubmissionAdvancedFilters,
  matchesSourceFilter,
} from "./matchingModalUtils";

const EMPTY_ADVANCED_FILTERS = {
  vendor: "",
  purchaser: "",
  startDate: "",
  endDate: "",
  purpose: "",
  projectOption: "",
  projectRaw: "",
};

describe("budget pipeline matching modal utils", () => {
  it("filters source rows by invoice, card, or all", () => {
    expect(matchesSourceFilter({ source: "invoice" }, "invoice")).toBe(true);
    expect(matchesSourceFilter({ source: "credit-card" }, "card")).toBe(true);
    expect(matchesSourceFilter({ source: "credit-card" }, "invoice")).toBe(false);
    expect(matchesSourceFilter({ source: "unknown", formTitle: "Invoice Request" }, "invoice")).toBe(true);
    expect(matchesSourceFilter({ source: "invoice" }, "all")).toBe(true);
  });

  it("handles nullable start and end dates independently", () => {
    const row = { createdAt: "2026-06-15T12:00:00Z" };
    expect(inNullableDateRange(row, "", "")).toBe(true);
    expect(inNullableDateRange(row, "2026-06-01", "")).toBe(true);
    expect(inNullableDateRange(row, "", "2026-06-30")).toBe(true);
    expect(inNullableDateRange(row, "2026-06-16", "")).toBe(false);
    expect(inNullableDateRange(row, "", "2026-06-14")).toBe(false);
  });

  it("blocks ledger posting when allocation is unsafe", () => {
    expect(ledgerPostBlockers({ id: "a", queueStatus: "pending" })).toContain("missing allocation");
    expect(ledgerPostBlockers({ id: "a", grantId: "g", lineItemId: "li", queueStatus: "pending" }, { unsaved: true })).toContain("unsaved allocation");
    expect(ledgerPostBlockers({ id: "a", grantId: "g", lineItemId: "li", queueStatus: "pending" }, { conflict: true })).toContain("pipeline conflict");
    expect(ledgerPostBlockers({ id: "a", grantId: "g", lineItemId: "li", ledgerEntryId: "ledger", queueStatus: "posted" })).toContain("duplicate/posting risk");
    expect(ledgerPostBlockers({ id: "a", grantId: "g", lineItemId: "li", queueStatus: "pending" })).toEqual([]);
  });

  it("searches advanced submission filters across normalized project and raw fields", () => {
    const row = {
      id: "a",
      createdAt: "2026-06-12T12:00:00Z",
      merchant: "Staples",
      purchaser: "Alex Purchaser",
      purpose: "School supplies",
      billedTo: "Chafee",
      transactionFields: { programOperationsFor: "Youth Services" },
      rawAnswers: { supportiveServiceProgram: "Supportive Service Program A" },
    };

    expect(matchesSubmissionAdvancedFilters(row, {
      ...EMPTY_ADVANCED_FILTERS,
      vendor: "stap",
      purchaser: "alex",
      purpose: "school",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      projectOption: "chafee",
      projectRaw: "supportive",
    })).toBe(true);
    expect(matchesSubmissionAdvancedFilters(row, {
      ...EMPTY_ADVANCED_FILTERS,
      projectRaw: "does not match",
    })).toBe(false);
  });
});
