import { describe, expect, it } from "vitest";
import {
  GrantFinancialConfigPatch,
  normalizeGrantComplianceConfig,
  computeGrantLineItemOverCap,
  getGrantFinancialCapabilities,
  getGrantLineItemAmountSemantics,
  grants,
  normalizeGrantFinancialConfig,
  shouldRetainGrantBudget,
} from "@hdb/contracts";

describe("normalizeGrantFinancialConfig", () => {
  it("defaults legacy grants to budgeted spend-down behavior", () => {
    expect(normalizeGrantFinancialConfig({ kind: "grant" })).toEqual({
      model: "budgeted",
      budgetEnabled: true,
      billingEnabled: false,
      allocationEnabled: false,
      ledgerEnabled: true,
      ledgerMode: "spendDown",
    });
  });

  it("defaults legacy programs to service-only behavior", () => {
    expect(normalizeGrantFinancialConfig({ kind: "program" })).toEqual({
      model: "serviceOnly",
      budgetEnabled: false,
      billingEnabled: false,
      allocationEnabled: false,
      ledgerEnabled: false,
      ledgerMode: "none",
    });
  });

  it("preserves an explicit billable program config", () => {
    expect(
      normalizeGrantFinancialConfig({
        kind: "program",
        financialConfig: {
          model: "billable",
          budgetEnabled: false,
          billingEnabled: true,
          allocationEnabled: true,
          ledgerEnabled: true,
          ledgerMode: "billing",
        },
      }),
    ).toEqual({
      model: "billable",
      budgetEnabled: false,
      billingEnabled: true,
      allocationEnabled: true,
      ledgerEnabled: true,
      ledgerMode: "billing",
    });
  });

  it("uses legacy budget allocation as a read-time compatibility signal", () => {
    expect(
      normalizeGrantFinancialConfig({
        kind: "program",
        budget: { allocationEnabled: true },
      }).allocationEnabled,
    ).toBe(true);
  });

  it("lets explicit allocation false override the legacy budget allocation signal", () => {
    expect(
      normalizeGrantFinancialConfig({
        kind: "program",
        budget: { allocationEnabled: true },
        financialConfig: {
          allocationEnabled: false,
        },
      }).allocationEnabled,
    ).toBe(false);
  });

  it("falls back safely when stored config values are malformed", () => {
    expect(
      normalizeGrantFinancialConfig({
        kind: "program",
        financialConfig: {
          model: "unknown",
          budgetEnabled: "true",
          billingEnabled: 1,
          ledgerEnabled: "yes",
          ledgerMode: "spend",
        },
      }),
    ).toEqual({
      model: "serviceOnly",
      budgetEnabled: false,
      billingEnabled: false,
      allocationEnabled: false,
      ledgerEnabled: false,
      ledgerMode: "none",
    });
  });

  it("keeps disabled ledgers normalized to ledgerMode none", () => {
    expect(
      normalizeGrantFinancialConfig({
        kind: "program",
        financialConfig: {
          model: "billable",
          ledgerEnabled: false,
          ledgerMode: "billing",
        },
      }),
    ).toMatchObject({
      model: "billable",
      ledgerEnabled: false,
      ledgerMode: "none",
    });
  });

  it("keeps ledgerMode none authoritative when ledgerEnabled is true", () => {
    expect(
      normalizeGrantFinancialConfig({
        kind: "grant",
        financialConfig: {
          ledgerEnabled: true,
          ledgerMode: "none",
        },
      }),
    ).toMatchObject({
      ledgerEnabled: false,
      ledgerMode: "none",
    });
  });

  it("treats spend-down as the only budget-drawdown ledger mode", () => {
    expect(getGrantFinancialCapabilities({ kind: "grant" })).toMatchObject({
      budgetEnabled: true,
      ledgerEnabled: true,
      ledgerMode: "spendDown",
      drawsDownBudget: true,
      usesBillingLedger: false,
    });

    expect(
      getGrantFinancialCapabilities({
        kind: "program",
        financialConfig: {
          model: "billable",
          billingEnabled: true,
          allocationEnabled: true,
          ledgerEnabled: true,
          ledgerMode: "billing",
        },
      }),
    ).toMatchObject({
      budgetEnabled: false,
      billingEnabled: true,
      allocationEnabled: true,
      ledgerEnabled: true,
      ledgerMode: "billing",
      drawsDownBudget: false,
      usesBillingLedger: true,
    });
  });

  it("reports billing activity separately from billing ledger usage", () => {
    expect(
      getGrantFinancialCapabilities({
        kind: "program",
        financialConfig: {
          model: "billable",
          billingEnabled: true,
          ledgerEnabled: false,
        },
      }),
    ).toMatchObject({
      billingEnabled: true,
      ledgerEnabled: false,
      drawsDownBudget: false,
      usesBillingLedger: false,
      hasFinancialActivity: true,
    });
  });

  it("accepts partial financial config patches without forcing defaults at parse time", () => {
    const parsed = GrantFinancialConfigPatch.parse({
      model: "billable",
      allocationEnabled: true,
      futureFlag: "kept",
    });

    expect(parsed).toEqual({
      model: "billable",
      allocationEnabled: true,
      futureFlag: "kept",
    });
  });

  it("accepts grant task definitions as the current array shape", () => {
    const parsed = grants.GrantInputSchema.safeParse({
      name: "TSS Client",
      kind: "program",
      tasks: [{ id: "taskdef_test", name: "", kind: "recurring", frequency: "monthly" }],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(Array.isArray(parsed.data.tasks)).toBe(true);
  });

  it("retains budget objects only for records with financial activity", () => {
    expect(shouldRetainGrantBudget({ kind: "grant" })).toBe(true);
    expect(shouldRetainGrantBudget({ kind: "program" })).toBe(false);
    expect(
      shouldRetainGrantBudget({
        kind: "program",
        financialConfig: { model: "billable", billingEnabled: true },
      }),
    ).toBe(true);
    expect(
      shouldRetainGrantBudget({
        kind: "grant",
        financialConfig: {
          model: "serviceOnly",
          budgetEnabled: false,
          billingEnabled: false,
          allocationEnabled: false,
          ledgerEnabled: false,
          ledgerMode: "none",
        },
      }),
    ).toBe(false);
  });
});

describe("normalizeGrantComplianceConfig", () => {
  it("defaults missing config to the legacy HMIS/Caseworthy entry and exit controls", () => {
    expect(normalizeGrantComplianceConfig({})).toEqual({
      preset: "hmisCaseworthy",
      active: [
        {
          key: "caseworthyEntryComplete",
          label: "CW Entry",
          field: "compliance.caseworthyEntryComplete",
          type: "boolean",
        },
        {
          key: "hmisEntryComplete",
          label: "HMIS Entry",
          field: "compliance.hmisEntryComplete",
          type: "boolean",
        },
      ],
      inactive: [
        {
          key: "caseworthyExitComplete",
          label: "CW Exit",
          field: "compliance.caseworthyExitComplete",
          type: "boolean",
        },
        {
          key: "hmisExitComplete",
          label: "HMIS Exit",
          field: "compliance.hmisExitComplete",
          type: "boolean",
        },
      ],
    });
  });

  it("keeps custom active and inactive compliance controls", () => {
    expect(
      normalizeGrantComplianceConfig({
        complianceConfig: {
          preset: "custom",
          active: [{ key: "intakeComplete", label: "Intake" }],
          inactive: [{ key: "exitPacketComplete", label: "Exit Packet" }],
        },
      }),
    ).toEqual({
      preset: "custom",
      active: [
        {
          key: "intakeComplete",
          label: "Intake",
          field: "compliance.intakeComplete",
          type: "boolean",
        },
      ],
      inactive: [
        {
          key: "exitPacketComplete",
          label: "Exit Packet",
          field: "compliance.exitPacketComplete",
          type: "boolean",
        },
      ],
    });
  });

  it("allows grants to explicitly disable compliance controls", () => {
    expect(
      normalizeGrantComplianceConfig({
        complianceConfig: {
          preset: "none",
        },
      }),
    ).toEqual({
      preset: "none",
      active: [],
      inactive: [],
    });
  });
});

describe("grant line-item amount semantics", () => {
  const overCapLineItem = {
    amount: 100,
    spent: 75,
    projected: 50,
  };

  it("keeps legacy budgeted grants on spend-down over-cap semantics", () => {
    expect(getGrantLineItemAmountSemantics({ kind: "grant" })).toEqual({
      drawsDownBudget: true,
      amountIsBudgetAllocation: true,
      amountIsBillingReference: false,
      amountCreatesOverCap: true,
    });

    expect(computeGrantLineItemOverCap({ kind: "grant" }, overCapLineItem)).toBe(25);
  });

  it("treats billable program line-item amounts as references, not hard caps", () => {
    const billableProgram = {
      kind: "program",
      financialConfig: {
        model: "billable",
        budgetEnabled: false,
        billingEnabled: true,
        allocationEnabled: true,
        ledgerEnabled: true,
        ledgerMode: "billing",
      },
    };

    expect(getGrantLineItemAmountSemantics(billableProgram)).toEqual({
      drawsDownBudget: false,
      amountIsBudgetAllocation: false,
      amountIsBillingReference: true,
      amountCreatesOverCap: false,
    });

    expect(computeGrantLineItemOverCap(billableProgram, overCapLineItem)).toBeNull();
  });

  it("allows explicitly budgeted programs to use spend-down line-item math", () => {
    const budgetedProgram = {
      kind: "program",
      financialConfig: {
        model: "budgeted",
        budgetEnabled: true,
        billingEnabled: false,
        allocationEnabled: true,
        ledgerEnabled: true,
        ledgerMode: "spendDown",
      },
    };

    expect(getGrantLineItemAmountSemantics(budgetedProgram)).toMatchObject({
      drawsDownBudget: true,
      amountIsBudgetAllocation: true,
      amountCreatesOverCap: true,
    });
    expect(computeGrantLineItemOverCap(budgetedProgram, overCapLineItem)).toBe(25);
  });

  it("does not create over-cap values for service-only programs", () => {
    expect(getGrantLineItemAmountSemantics({ kind: "program" })).toEqual({
      drawsDownBudget: false,
      amountIsBudgetAllocation: false,
      amountIsBillingReference: false,
      amountCreatesOverCap: false,
    });
    expect(computeGrantLineItemOverCap({ kind: "program" }, overCapLineItem)).toBeNull();
  });
});
