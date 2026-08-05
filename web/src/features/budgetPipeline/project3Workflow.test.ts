import { describe, expect, it } from "vitest";
import {
  activityBelongsToCycle,
  activityIsOutsideConfiguredCycles,
  buildAdvancedGrantOptionGroups,
  isOutOfGrantPeriod,
  normalizePipelineDateInput,
  stableCycleDisclosureId,
  stableLineItemDisclosureId,
} from "./project3Workflow";

describe("Project 3 budget-pipeline workflow helpers", () => {
  it("groups active and historical grant assignments with status and type", () => {
    const groups = buildAdvancedGrantOptionGroups([
      { id: "active", name: "Current Grant", status: "active", kind: "grant" },
      { id: "billable", name: "Billing Program", status: "active", kind: "program", financialConfig: { model: "billable" } },
      { id: "closed", name: "Closed Grant", status: "closed", kind: "grant" },
      { id: "deleted", name: "Deleted Grant", status: "deleted", deleted: true, kind: "grant" },
      { id: "service", name: "Service Program", status: "active", kind: "program", financialConfig: { model: "serviceOnly" } },
    ]);

    expect(groups.map((group) => group.label)).toEqual(["Active", "Historical"]);
    expect(groups[0].options.map((option) => option.value)).toEqual(["billable", "active"]);
    expect(groups[0].options[0].label).toContain("Active · Billable");
    expect(groups[1].options.map((option) => option.value).sort()).toEqual(["closed", "deleted"]);
    expect(groups.flatMap((group) => group.options).some((option) => option.value === "service")).toBe(false);
  });

  it("preserves a current assignment even when it is otherwise outside the policy", () => {
    const groups = buildAdvancedGrantOptionGroups([
      { id: "service", name: "Legacy Service", status: "deleted", kind: "program", financialConfig: { model: "serviceOnly" } },
    ], "service");
    expect(groups[0].label).toBe("Historical");
    expect(groups[0].options[0].value).toBe("service");
  });

  it("normalizes repeated date changes, clearing, and invalid values", () => {
    expect(normalizePipelineDateInput("2026-07-01")).toBe("2026-07-01");
    expect(normalizePipelineDateInput("2026-08-05")).toBe("2026-08-05");
    expect(normalizePipelineDateInput("")).toBe("");
    expect(normalizePipelineDateInput("2026-09-01")).toBe("2026-09-01");
    expect(normalizePipelineDateInput({ currentTarget: { value: "2026-10-01" } })).toBe("");
  });

  it("recognizes only assigned before/after-period warnings", () => {
    const base = {
      assignedToGrant: true,
      assignedToLineItem: true,
      eligibleForGrantTotals: false,
      eligibleForSpendingCycleTotals: false,
      transactionDate: "2026-06-30",
      transactionDateSource: "dueDate",
      grantStartDate: "2026-07-01",
      grantEndDate: "2027-06-30",
      lineItemId: "li",
      spendingCycleId: null,
      status: "ineligible" as const,
      reason: "before-grant-start" as const,
      reasonLabel: "before",
      suggestedCorrectiveWorkflow: "reassign-transaction" as const,
      overrideApplied: false,
    };
    expect(isOutOfGrantPeriod(base)).toBe(true);
    expect(isOutOfGrantPeriod({ ...base, reason: "missing-line-item-assignment" })).toBe(false);
    expect(isOutOfGrantPeriod({ ...base, eligibleForGrantTotals: true, status: "eligible" })).toBe(false);
  });

  it("uses stored disclosure IDs and deterministic legacy fallbacks", () => {
    expect(stableLineItemDisclosureId({ id: "line-1", label: "Rent" })).toBe("line-1");
    expect(stableLineItemDisclosureId({ label: "Rental Assistance", type: "Housing" })).toBe("legacy:rental-assistance:housing");
    expect(stableCycleDisclosureId("line-1", { id: "cycle-1" })).toBe("line-1:cycle-1");
    expect(stableCycleDisclosureId("line-1", { startDate: "2026-07-01", endDate: "2026-07-31", label: "July" }))
      .toBe("line-1:legacy:2026-07-01:2026-07-31:July");
  });

  it("partitions activity into one configured cycle or the outside-cycle disclosure", () => {
    const eligibility = {
      assignedToGrant: true,
      assignedToLineItem: true,
      eligibleForGrantTotals: true,
      eligibleForSpendingCycleTotals: true,
      transactionDate: "2026-07-15",
      transactionDateSource: "dueDate",
      grantStartDate: "2026-07-01",
      grantEndDate: "2027-06-30",
      lineItemId: "line-1",
      spendingCycleId: "cycle-1",
      status: "eligible" as const,
      reason: "eligible" as const,
      reasonLabel: "Eligible",
      suggestedCorrectiveWorkflow: "none" as const,
      overrideApplied: false,
    };
    const configured = new Set(["cycle-1", "cycle-2"]);
    expect(activityBelongsToCycle(eligibility, "cycle-1")).toBe(true);
    expect(activityBelongsToCycle(eligibility, "cycle-2")).toBe(false);
    expect(activityIsOutsideConfiguredCycles(eligibility, configured)).toBe(false);
    expect(activityIsOutsideConfiguredCycles({ ...eligibility, spendingCycleId: null }, configured)).toBe(true);
    expect(activityIsOutsideConfiguredCycles({ ...eligibility, spendingCycleId: "removed-cycle" }, configured)).toBe(true);
  });
});
