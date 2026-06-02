import { describe, expect, it } from "vitest";
import {
  getGrantFinancialVisibility,
  shouldRetainBudgetForGrantForm,
  shouldShowInBudgetWorkspace,
} from "./financialVisibility";

describe("grant financial visibility", () => {
  it("keeps legacy grants visible in budget workspace", () => {
    expect(shouldShowInBudgetWorkspace({ kind: "grant" })).toBe(true);
  });

  it("keeps legacy service-only programs out of budget workspace", () => {
    expect(shouldShowInBudgetWorkspace({ kind: "program" })).toBe(false);
  });

  it("allows explicit billable programs into financial workspace surfaces", () => {
    const visibility = getGrantFinancialVisibility({
      kind: "program",
      financialConfig: {
        model: "billable",
        budgetEnabled: false,
        billingEnabled: true,
        allocationEnabled: true,
        ledgerEnabled: true,
        ledgerMode: "billing",
      },
    } as any);

    expect(visibility).toMatchObject({
      showBudgetWorkspace: true,
      showBudgetEditor: false,
      showBillingActivity: true,
      showLedgerActivity: true,
      showAllocation: true,
    });
    expect(visibility.capabilities.drawsDownBudget).toBe(false);
  });

  it("allows budgeted programs while preserving budget drawdown semantics", () => {
    const visibility = getGrantFinancialVisibility({
      kind: "program",
      financialConfig: {
        model: "budgeted",
        budgetEnabled: true,
        billingEnabled: false,
        allocationEnabled: true,
        ledgerEnabled: true,
        ledgerMode: "spendDown",
      },
    } as any);

    expect(visibility).toMatchObject({
      showBudgetWorkspace: true,
      showBudgetEditor: true,
      showBillingActivity: false,
      showLedgerActivity: true,
      showAllocation: true,
    });
    expect(visibility.capabilities.drawsDownBudget).toBe(true);
  });

  it("honors legacy allocation compatibility as financial workspace activity", () => {
    const legacyAllocatedProgram = {
      kind: "program",
      budget: { allocationEnabled: true },
    } as any;

    expect(getGrantFinancialVisibility(legacyAllocatedProgram)).toMatchObject({
      showBudgetWorkspace: true,
      showAllocation: true,
    });
    expect(shouldRetainBudgetForGrantForm(legacyAllocatedProgram)).toBe(true);
  });

  it("uses the same financial activity rule for form budget retention", () => {
    expect(shouldRetainBudgetForGrantForm({ kind: "grant" })).toBe(true);
    expect(shouldRetainBudgetForGrantForm({ kind: "program" })).toBe(false);
    expect(
      shouldRetainBudgetForGrantForm({
        kind: "program",
        financialConfig: {
          model: "billable",
          budgetEnabled: false,
          billingEnabled: true,
          allocationEnabled: true,
          ledgerEnabled: true,
          ledgerMode: "billing",
        },
      } as any),
    ).toBe(true);
  });
});
