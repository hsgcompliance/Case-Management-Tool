import { describe, expect, it } from "vitest";
import {
  evaluateGrantBudgetEligibility,
  resolveGrantBudgetTransactionDate,
  type GrantBudgetEligibilityGrant,
  type GrantBudgetEligibilityTransaction,
} from "@hdb/contracts";

const pathGrant: GrantBudgetEligibilityGrant = {
  id: "path-supportive-services",
  startDate: "2026-07-01",
  endDate: "2027-06-30",
  budget: {
    lineItems: [
      {
        id: "supportive-services",
        splitGoals: [
          { id: "cycle-jul", startDate: "2026-07-01", endDate: "2026-07-31" },
          { id: "cycle-aug", startDate: "2026-08-01", endDate: "2026-08-31" },
        ],
      },
    ],
  },
};

function row(date: string, patch: Partial<GrantBudgetEligibilityTransaction> = {}): GrantBudgetEligibilityTransaction {
  return {
    grantId: "path-supportive-services",
    lineItemId: "supportive-services",
    dueDate: date,
    ...patch,
  };
}

describe("shared grant budget eligibility", () => {
  it.each([
    ["exactly on the start", "2026-07-01", true, "eligible"],
    ["one day before the start", "2026-06-30", false, "before-grant-start"],
    ["exactly on the end", "2027-06-30", true, "outside-spending-cycle"],
    ["one day after the end", "2027-07-01", false, "after-grant-end"],
  ] as const)("handles a transaction %s", (_label, date, eligible, reason) => {
    const result = evaluateGrantBudgetEligibility({ transaction: row(date), grant: pathGrant });
    expect(result.eligibleForGrantTotals).toBe(eligible);
    expect(result.reason).toBe(reason);
  });

  it("allows an unbounded grant while still requiring a valid line item", () => {
    const grant = { ...pathGrant, startDate: null, endDate: null };
    const result = evaluateGrantBudgetEligibility({ transaction: row("2020-01-01"), grant });
    expect(result.eligibleForGrantTotals).toBe(true);
  });

  it("keeps an out-of-period assignment visible but excludes it from totals", () => {
    const result = evaluateGrantBudgetEligibility({ transaction: row("2026-06-30"), grant: pathGrant });
    expect(result).toMatchObject({
      assignedToGrant: true,
      assignedToLineItem: true,
      eligibleForGrantTotals: false,
      suggestedCorrectiveWorkflow: "reassign-transaction",
    });
  });

  it.each([
    ["missing", { lineItemId: "" }, "missing-line-item-assignment"],
    ["unknown", { lineItemId: "retired-line-item" }, "unknown-line-item"],
  ] as const)("excludes a %s line-item assignment", (_label, patch, reason) => {
    const result = evaluateGrantBudgetEligibility({ transaction: row("2026-07-02", patch), grant: pathGrant });
    expect(result.eligibleForGrantTotals).toBe(false);
    expect(result.reason).toBe(reason);
  });

  it("assigns an eligible row to one inclusive split spending cycle", () => {
    const result = evaluateGrantBudgetEligibility({ transaction: row("2026-07-31"), grant: pathGrant });
    expect(result).toMatchObject({
      eligibleForGrantTotals: true,
      eligibleForSpendingCycleTotals: true,
      spendingCycleId: "cycle-jul",
    });
  });

  it("keeps grant eligibility separate from spending-cycle eligibility", () => {
    const result = evaluateGrantBudgetEligibility({ transaction: row("2026-09-01"), grant: pathGrant });
    expect(result.eligibleForGrantTotals).toBe(true);
    expect(result.eligibleForSpendingCycleTotals).toBe(false);
    expect(result.reason).toBe("outside-spending-cycle");
  });

  it("uses the same rule for projected and completed records", () => {
    const projected = evaluateGrantBudgetEligibility({
      transaction: row("2026-06-29", { queueStatus: "pending" }),
      grant: pathGrant,
      sourceType: "paymentQueue",
    });
    const completed = evaluateGrantBudgetEligibility({ transaction: row("2026-06-29"), grant: pathGrant, sourceType: "ledger" });
    expect(projected.eligibleForGrantTotals).toBe(false);
    expect(completed.eligibleForGrantTotals).toBe(false);
    expect(projected.reason).toBe(completed.reason);
  });

  it("does not count a posted queue shadow in addition to its ledger", () => {
    const result = evaluateGrantBudgetEligibility({
      transaction: row("2026-07-15", { queueStatus: "posted" }),
      grant: pathGrant,
      sourceType: "paymentQueue",
    });
    expect(result.reason).toBe("posted-queue-shadow");
    expect(result.eligibleForGrantTotals).toBe(false);
  });

  it("preserves calendar boundaries across relevant timezone-shaped inputs", () => {
    expect(resolveGrantBudgetTransactionDate({ dueDate: "2026-07-01T00:30:00-06:00" })).toEqual({
      date: "2026-07-01",
      source: "dueDate",
    });
    expect(resolveGrantBudgetTransactionDate({ createdAt: new Date("2026-07-01T00:30:00Z") })).toEqual({
      date: "2026-07-01",
      source: "createdAt",
    });
  });

  it("uses transaction date before creation date", () => {
    expect(resolveGrantBudgetTransactionDate({ dueDate: "2026-06-30", createdAt: "2026-07-02" })).toEqual({
      date: "2026-06-30",
      source: "dueDate",
    });
  });

  it("requires a usable date when the grant is bounded", () => {
    const result = evaluateGrantBudgetEligibility({ transaction: row("", { createdAt: "" }), grant: pathGrant });
    expect(result.reason).toBe("missing-transaction-date");
  });

  it("accepts only a complete, trusted override and never changes assignment", () => {
    const invalid = evaluateGrantBudgetEligibility({
      transaction: row("2026-06-30"),
      grant: pathGrant,
      override: { approved: true, approvedBy: "", approvedAt: "2026-08-05", reason: "reviewed" },
    });
    const valid = evaluateGrantBudgetEligibility({
      transaction: row("2026-06-30"),
      grant: pathGrant,
      override: { approved: true, approvedBy: "admin-uid", approvedAt: "2026-08-05", reason: "contract exception" },
    });
    expect(invalid.eligibleForGrantTotals).toBe(false);
    expect(valid).toMatchObject({ assignedToGrant: true, eligibleForGrantTotals: true, overrideApplied: true });
  });

  it("gives pipeline and Grant modal selectors the same PATH eligible set and overspend math", () => {
    const records = [
      { id: "path-june-a", date: "2026-06-15", amount: 125 },
      { id: "path-june-b", date: "2026-06-30", amount: 175 },
      { id: "path-july-a", date: "2026-07-01", amount: 400 },
      { id: "path-july-b", date: "2026-07-20", amount: 350 },
    ];
    const select = () => records.filter((record) => evaluateGrantBudgetEligibility({
      transaction: row(record.date),
      grant: pathGrant,
    }).eligibleForGrantTotals);
    const pipelineRows = select();
    const grantModalRows = select();
    const spent = pipelineRows.reduce((sum, record) => sum + record.amount, 0);
    const budget = 700;
    expect(pipelineRows.map((record) => record.id)).toEqual(["path-july-a", "path-july-b"]);
    expect(grantModalRows).toEqual(pipelineRows);
    expect(spent).toBe(750);
    expect(Math.max(0, spent - budget)).toBe(50);
    expect(Math.max(0, records.reduce((sum, record) => sum + record.amount, 0) - budget)).toBe(350);
  });

  it("treats grant dates as authoritative; pipeline dates are assignment configuration only", () => {
    const pipelineStartDate = "2026-08-01";
    const result = evaluateGrantBudgetEligibility({ transaction: row("2026-07-15"), grant: pathGrant });
    expect(pipelineStartDate).not.toBe(pathGrant.startDate);
    expect(result.eligibleForGrantTotals).toBe(true);
  });
});
