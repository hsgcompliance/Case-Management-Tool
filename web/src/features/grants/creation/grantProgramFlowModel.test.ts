import { describe, expect, it } from "vitest";
import {
  applyTssPreset,
  buildGrantProgramPayload,
  copyGrantProgramToDraft,
  createInitialGrantProgramDraft,
  FINANCIAL_CONFIG_PRESETS,
} from "./grantProgramFlowModel";

describe("grant program flow payload", () => {
  it("creates the canonical TSS billable program preset", () => {
    const draft = applyTssPreset(createInitialGrantProgramDraft({ name: "TSS" }));
    const payload = buildGrantProgramPayload(draft);

    expect(payload).toMatchObject({
      name: "TSS",
      kind: "program",
      financialConfig: FINANCIAL_CONFIG_PRESETS.billable,
      enrollmentDefaults: { authorizationMonths: 12 },
      complianceConfig: {
        preset: "custom",
        active: expect.arrayContaining([
          expect.objectContaining({ field: "compliance.caseworthyEntryComplete", label: "CW Entry" }),
          expect.objectContaining({ field: "compliance.hmisEntryComplete", label: "HMIS Entry" }),
          expect.objectContaining({ field: "serviceStatus", label: "Service Active" }),
          expect.objectContaining({ field: "medicaid.status", label: "Medicaid Active" }),
        ]),
      },
      budget: {
        total: 0,
        allocationEnabled: true,
      },
    });
  });

  it("preserves budgeted grant totals and line item amounts", () => {
    const draft = createInitialGrantProgramDraft({
      name: "RRH 2026",
      kind: "grant",
      financialConfig: FINANCIAL_CONFIG_PRESETS.budgeted,
      budget: {
        total: 10000,
        lineItems: [{ id: "rent", label: "Rent", amount: 7500 }],
      },
    });
    const payload = buildGrantProgramPayload(draft);

    expect(payload.budget).toMatchObject({
      total: 10000,
      lineItems: [{ id: "rent", label: "Rent", amount: 7500, spent: 0, projected: 0 }],
    });
  });

  it("keeps billable line item categories without spend-down amounts", () => {
    const draft = createInitialGrantProgramDraft({
      name: "TSS",
      kind: "program",
      financialConfig: FINANCIAL_CONFIG_PRESETS.billable,
      budget: {
        total: 12000,
        lineItems: [{ id: "tss", label: "TSS Monthly", amount: 1000 }],
      },
    });
    const payload = buildGrantProgramPayload(draft);

    expect(payload).toMatchObject({
      kind: "program",
      financialConfig: FINANCIAL_CONFIG_PRESETS.billable,
      budget: {
        total: 0,
        lineItems: [{ id: "tss", label: "TSS Monthly", amount: 0 }],
      },
    });
  });

  it("writes no meaningful budget for service-only programs", () => {
    const draft = createInitialGrantProgramDraft({
      name: "Navigation",
      kind: "program",
      financialConfig: FINANCIAL_CONFIG_PRESETS.serviceOnly,
      budget: {
        total: 1000,
        lineItems: [{ id: "old", label: "Old Budget", amount: 1000 }],
      },
    });
    const payload = buildGrantProgramPayload(draft);

    expect(payload).toMatchObject({
      financialConfig: FINANCIAL_CONFIG_PRESETS.serviceOnly,
      budget: { total: 0, lineItems: [] },
    });
  });

  it("copies existing grants without server fields and resets activity values", () => {
    const draft = copyGrantProgramToDraft({
      id: "grant_1",
      orgId: "org_1",
      createdAt: "old",
      updatedAt: "old",
      metrics: { enrollmentCounts: { active: 9 } },
      name: "Source Grant",
      kind: "grant",
      budget: {
        total: 5000,
        lineItems: [{ id: "rent", label: "Rent", amount: 5000, spent: 100, projected: 200 }],
      },
    });
    const payload = buildGrantProgramPayload(draft);

    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("orgId");
    expect(payload).not.toHaveProperty("metrics");
    expect(payload.name).toBe("Source Grant Copy");
    expect(payload.budget).toMatchObject({
      lineItems: [{ label: "Rent", amount: 5000, spent: 0, projected: 0 }],
    });
  });
});
