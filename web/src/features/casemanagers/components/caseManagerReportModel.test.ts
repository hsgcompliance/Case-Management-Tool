import { describe, expect, it } from "vitest";
import { buildCaseManagerReport, effectiveEnrollmentAllocation } from "./caseManagerReportModel";

describe("case manager report model", () => {
  it("uses an explicit allocation before the payment schedule", () => {
    expect(effectiveEnrollmentAllocation({
      clientAllocation: { amount: 900 },
      payments: [{ amount: 500 }, { amount: 500 }],
    })).toBe(900);
  });

  it("builds primary caseload, tier, monthly change, and allocation stats", () => {
    const result = buildCaseManagerReport({
      caseManagerIds: ["cm-1", "cm-2"],
      month: "2026-07",
      customers: [
        { id: "c-1", active: true, caseManagerId: "cm-1", secondaryCaseManagerId: "cm-2", tier: 1 },
        { id: "c-2", active: true, caseManagerId: "cm-1", tier: 3 },
        { id: "c-3", active: false, caseManagerId: "cm-1", tier: 2 },
      ],
      enrollments: [
        {
          id: "e-1",
          customerId: "c-1",
          caseManagerId: "cm-1",
          active: true,
          status: "active",
          startDate: "2026-07-02",
          payments: [{ amount: 400 }, { amount: 600 }, { amount: 99, void: true }],
        },
        {
          id: "e-2",
          customerId: "c-1",
          caseManagerId: "cm-1",
          active: false,
          status: "closed",
          startDate: "2026-01-01",
          endDate: "2026-07-15",
        },
        {
          id: "e-3",
          customerId: "c-2",
          caseManagerId: "cm-1",
          active: true,
          status: "active",
          startDate: "2026-06-01",
          clientAllocation: { amount: 2500 },
        },
      ],
    });

    expect(result.statsByUid.get("cm-1")).toMatchObject({
      activeCaseload: 2,
      inactiveCustomers: 1,
      newCustomersThisMonth: 1,
      changedCustomersThisMonth: 1,
      activeEnrollments: 2,
      totalAllocation: 3500,
      tier1: 1,
      tier2: 0,
      tier3: 1,
      untiered: 0,
    });
    expect(result.customersByUid.get("cm-2")?.map((row) => row.id)).toEqual(["c-1"]);
  });
});
