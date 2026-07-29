import { describe, expect, it } from "vitest";
import { budgetAssignment } from "@hdb/contracts";

describe("payment queue budget assignment provenance", () => {
  it("uses an explicit pipeline or user flag", () => {
    expect(budgetAssignment.inferBudgetAssignmentSource({
      source: "invoice",
      grantId: "grant-1",
      lineItemId: "line-1",
      budgetAssignmentSource: "pipeline",
    })).toBe("pipeline");
    expect(budgetAssignment.inferBudgetAssignmentSource({
      source: "credit-card",
      grantId: "grant-1",
      lineItemId: "line-1",
      budgetAssignmentSource: "user",
    })).toBe("user");
  });

  it("infers provenance for historical credit-card and invoice rows", () => {
    expect(budgetAssignment.inferBudgetAssignmentSource({
      source: "credit-card",
      grantId: "grant-1",
      lineItemId: "line-1",
      pipelineId: "pipeline-1",
    })).toBe("pipeline");
    expect(budgetAssignment.inferBudgetAssignmentSource({
      source: "invoice",
      grantId: "grant-1",
      lineItemId: "line-1",
    })).toBe("user");
  });

  it("does not classify unlinked or enrollment projection rows", () => {
    expect(budgetAssignment.inferBudgetAssignmentSource({
      source: "invoice",
      grantId: "grant-1",
      lineItemId: null,
      pipelineId: "pipeline-1",
    })).toBeNull();
    expect(budgetAssignment.inferBudgetAssignmentSource({
      source: "projection",
      grantId: "grant-1",
      lineItemId: "line-1",
    })).toBeNull();
  });
});
