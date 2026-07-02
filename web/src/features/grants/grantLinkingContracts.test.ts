import { describe, expect, it } from "vitest";
import {
  EnrollmentsAllocationSetBody,
  EnrollmentsCycleRolloverRunBody,
  Enrollment,
} from "@hdb/contracts/enrollments";
import { Grant } from "@hdb/contracts/grants";

describe("grant linking contracts", () => {
  it("accepts explicit cycle links and multi-enrollment warning requirements", () => {
    const parsed = Grant.parse({
      id: "coc-26-27",
      name: "CoC RRH 26-27",
      linking: {
        cycle: { previousGrantId: "coc-25-26", nextGrantId: null },
        enrollmentRequirement: { operator: "any", targetGrantIds: ["blueprint", "navigation"] },
      },
    });
    expect(parsed.linking?.cycle?.previousGrantId).toBe("coc-25-26");
    expect(parsed.linking?.enrollmentRequirement).toEqual({
      operator: "any",
      targetGrantIds: ["blueprint", "navigation"],
      behavior: "warnOnly",
    });
  });

  it("rejects negative allocation amounts", () => {
    expect(EnrollmentsAllocationSetBody.safeParse({ enrollmentId: "e1", amount: -1 }).success).toBe(false);
    expect(EnrollmentsAllocationSetBody.safeParse({ enrollmentId: "e1", amount: null }).success).toBe(true);
  });

  it("requires explicit rollover confirmation", () => {
    expect(EnrollmentsCycleRolloverRunBody.safeParse({ grantId: "g1", confirm: "MIGRATE" }).success).toBe(false);
    expect(EnrollmentsCycleRolloverRunBody.safeParse({ grantId: "g1", confirm: "ROLLOVER" }).success).toBe(true);
  });

  it("parses continuum, allocation, and unenrollment review metadata", () => {
    const parsed = Enrollment.parse({
      id: "e2",
      grantId: "g2",
      customerId: "c1",
      updatedAt: new Date().toISOString(),
      continuity: { continuumId: "continuum-e1", previousEnrollmentId: "e1" },
      clientAllocation: { amount: 12000 },
      programAutomation: { targetGrantId: "blueprint", sourceEnrollmentIds: ["yhdp-1"], createdByRule: true },
      unenrollmentReview: { required: true, reason: "all_linked_source_enrollments_closed", sourceEnrollmentIds: ["yhdp-1"] },
    });
    expect(parsed.continuity?.kind).toBe("grantCycle");
    expect(parsed.clientAllocation?.amount).toBe(12000);
    expect(parsed.unenrollmentReview?.required).toBe(true);
  });
});
