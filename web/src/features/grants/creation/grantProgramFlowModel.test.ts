import { describe, expect, it } from "vitest";
import {
  buildGrantProgramPayload,
  copyGrantProgramToDraft,
  copyLineItemInvoicing,
  createInitialGrantProgramDraft,
  FINANCIAL_CONFIG_PRESETS,
} from "./grantProgramFlowModel";

describe("grant program flow payload", () => {
  it("starts a blank grant without HRDC-specific field defaults", () => {
    const draft = createInitialGrantProgramDraft({ kind: "grant" });

    expect(draft).toMatchObject({
      status: "active",
      duration: "",
      maxAssistanceMonths: "",
      authorizationMonths: "",
      servicesOffered: [],
      eligibility: {},
      levelOfAssistance: {},
      complianceConfig: { preset: "none", active: [], inactive: [] },
      lineItems: [],
      invoicing: {
        expenseCategories: [],
        descriptionTemplates: [],
      },
    });
    expect(buildGrantProgramPayload(draft)).not.toHaveProperty("eligibility");
    expect(buildGrantProgramPayload(draft)).not.toHaveProperty("levelOfAssistance");
    expect(buildGrantProgramPayload(draft)).not.toHaveProperty("servicesOffered");
  });

  it("preserves the entered name and end date and defaults new records active", () => {
    const payload = buildGrantProgramPayload(createInitialGrantProgramDraft({
      name: "FY27 Housing Grant",
      endDate: "2027-06-30",
    }));

    expect(payload).toMatchObject({
      name: "FY27 Housing Grant",
      endDate: "2027-06-30",
      status: "active",
    });
  });

  it("honors an explicitly requested draft status", () => {
    const payload = buildGrantProgramPayload(createInitialGrantProgramDraft({
      name: "Planning record",
      status: "draft",
    }));

    expect(payload.status).toBe("draft");
  });

  it("keeps unknown lifecycle dates and grant links explicitly nullable", () => {
    const payload = buildGrantProgramPayload(createInitialGrantProgramDraft({ name: "Future cycle" }));

    expect(payload).toMatchObject({
      startDate: null,
      endDate: null,
      linking: {
        cycle: { previousGrantId: null, nextGrantId: null },
        enrollmentRules: [],
      },
    });
  });

  it("writes multi-enrollment warning requirements with explicit all/any logic", () => {
    const draft = createInitialGrantProgramDraft({
      name: "YHDP RRH",
      linking: {
        cycle: { previousGrantId: "rrh_25", nextGrantId: "rrh_27" },
        enrollmentRequirement: { operator: "any", targetGrantIds: ["blueprint", "navigation"] },
      },
    });

    expect(buildGrantProgramPayload(draft).linking).toEqual({
      cycle: { previousGrantId: "rrh_25", nextGrantId: "rrh_27" },
      enrollmentRequirement: { operator: "any", targetGrantIds: ["blueprint", "navigation"], behavior: "warnOnly" },
      enrollmentRules: [],
    });
  });

  it("preserves spaces while editing object values and trims only at payload creation", () => {
    const draft = createInitialGrantProgramDraft({ name: "Housing", eligibility: { Income: "Below 80% AMI" } });
    draft.eligibility.Income = "Below 80% AMI ";
    expect(buildGrantProgramPayload(draft).eligibility).toEqual({ Income: "Below 80% AMI" });
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
      duration: "18 months",
      eligibility: { Income: "80% AMI" },
      levelOfAssistance: { ShortTerm: "3 months" },
      servicesOffered: ["Rental assistance"],
      invoicing: {
        grantCode: "GR-10",
        expenseCategories: [{ id: "rent", label: "Rent", code: "100", enabled: true }],
      },
    });
    const payload = buildGrantProgramPayload(draft);

    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("orgId");
    expect(payload).not.toHaveProperty("metrics");
    expect(payload.name).toBe("Source Grant Copy");
    expect(payload).toMatchObject({
      duration: "18 months",
      eligibility: { Income: "80% AMI" },
      levelOfAssistance: { ShortTerm: "3 months" },
      servicesOffered: ["Rental assistance"],
      invoicing: {
        grantCode: "GR-10",
        expenseCategories: [{ id: "rent", label: "Rent", code: "100", enabled: true }],
      },
    });
    expect(payload.budget).toMatchObject({
      lineItems: [{ label: "Rent", amount: 5000, spent: 0, projected: 0 }],
    });
  });

  it("reads legacy grant invoicing into each line item and writes canonical line-item invoicing", () => {
    const draft = createInitialGrantProgramDraft({
      name: "Legacy",
      invoicing: { grantCode: "G-1", expenseCategories: [{ id: "rent", label: "Rent", enabled: true }] },
      budget: { lineItems: [{ id: "rent", label: "Rent", amount: 100 }] },
    });
    expect(draft.lineItems[0].invoicing.grantCode).toBe("G-1");
    expect((buildGrantProgramPayload(draft).budget as any).lineItems[0].invoicing.grantCode).toBe("G-1");
  });

  it("copies line-item invoicing as an independent value", () => {
    const source = createInitialGrantProgramDraft({
      budget: { lineItems: [{ id: "rent", label: "Rent", amount: 100, invoicing: { grantCode: "G-1", expenseCategories: [{ id: "rent", label: "Rent" }] } }] },
    }).lineItems[0];
    const copied = copyLineItemInvoicing(source);
    copied.grantCode = "G-2";
    copied.expenseCategories[0].label = "Changed";
    expect(source.invoicing.grantCode).toBe("G-1");
    expect(source.invoicing.expenseCategories[0].label).toBe("Rent");
  });
});
