import { describe, expect, it } from "vitest";
import { assistanceUsage, linkedEnrollmentIds } from "./rentalAssistanceModel";

describe("rental assistance continuum metrics", () => {
  it("links grant-cycle enrollments through continuum and legacy migration references", () => {
    const linked = linkedEnrollmentIds([
      { id: "old", continuity: { continuumId: "customer-cycle" } },
      { id: "current", continuity: { continuumId: "customer-cycle", previousEnrollmentId: "old" } },
      { id: "future", migratedFrom: { enrollmentId: "current" } },
    ]);

    expect(new Set(linked.get("old"))).toEqual(new Set(["old", "current", "future"]));
    expect(new Set(linked.get("future"))).toEqual(new Set(["old", "current", "future"]));
  });

  it("counts distinct assisted months across rollover grants without resetting the limit", () => {
    const usage = assistanceUsage([
      { dueDate: "2025-10-01" },
      { dueDate: "2025-11-01" },
      { dueDate: "2025-12-01" },
      { dueDate: "2026-01-01" }, // first row on the next grant
      { dueDate: "2026-01-15" }, // duplicate service month is counted once
      { dueDate: "2026-02-01" },
    ], 12, "2026-03-10");

    expect(usage.startDate).toBe("2025-10-01");
    expect(usage.monthsUsed).toBe(5);
    expect(usage.remaining).toBe(7);
    expect(usage.cutoff).toBe("2026-09-30");
  });
});
