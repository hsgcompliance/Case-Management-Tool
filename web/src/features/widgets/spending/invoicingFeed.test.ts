import { describe, expect, it } from "vitest";
import {
  dateFilterToRange,
  dateRangeContains,
  defaultInvoicingDateRange,
  extendDateRange,
  selectedInvoicingSources,
  sourceMatchesSelection,
  validateInvoicingDateRange,
} from "./invoicingFeed";

describe("invoicing feed date coverage", () => {
  it("defaults to the previous two full calendar months through today", () => {
    expect(defaultInvoicingDateRange(new Date(2026, 7, 5))).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-08-05",
    });
  });

  it("normalizes blank dates to default coverage and keeps inclusive boundaries", () => {
    const fallback = { startDate: "2026-06-01", endDate: "2026-08-05" };
    expect(validateInvoicingDateRange("", "", fallback)).toEqual({ range: fallback, error: null });
    expect(dateFilterToRange({ mode: "between", startDate: "2026-07-01", endDate: "2026-07-31" }, fallback))
      .toEqual({ startDate: "2026-07-01", endDate: "2026-07-31" });
  });

  it("rejects a reversed range instead of silently swapping it", () => {
    const result = validateInvoicingDateRange("2026-08-01", "2026-07-01");
    expect(result.range).toBeNull();
    expect(result.error).toMatch(/must not be later/);
  });

  it("detects cached ranges and extends them without gaps", () => {
    const cached = { startDate: "2026-06-01", endDate: "2026-08-05" };
    expect(dateRangeContains(cached, { startDate: "2026-07-01", endDate: "2026-07-31" })).toBe(true);
    expect(dateRangeContains(cached, { startDate: "2026-01-01", endDate: "2026-08-05" })).toBe(false);
    expect(extendDateRange(cached, { startDate: "2026-01-01", endDate: "2026-12-31" }))
      .toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
  });
});

describe("invoicing source union", () => {
  it("matches credit card only", () => {
    const selected = selectedInvoicingSources("card");
    expect(sourceMatchesSelection("credit-card", selected)).toBe(true);
    expect(sourceMatchesSelection("invoice", selected)).toBe(false);
  });

  it("matches invoice only", () => {
    const selected = selectedInvoicingSources("invoice");
    expect(sourceMatchesSelection("credit-card", selected)).toBe(false);
    expect(sourceMatchesSelection("invoice", selected)).toBe(true);
  });

  it("uses inclusive OR semantics when both sources are selected", () => {
    const selected = selectedInvoicingSources("forms");
    expect(sourceMatchesSelection("credit-card", selected)).toBe(true);
    expect(sourceMatchesSelection("invoice", selected)).toBe(true);
    expect(sourceMatchesSelection("projection", selected)).toBe(false);
  });
});
