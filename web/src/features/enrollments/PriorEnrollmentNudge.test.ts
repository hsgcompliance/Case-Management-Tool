import { describe, expect, it } from "vitest";
import {
  isReopenablePriorEnrollment,
  requiresPriorEnrollmentDecision,
  type PriorEnrollment,
} from "./priorEnrollmentDecision";

function enrollment(
  id: string,
  status: PriorEnrollment["status"],
  active: PriorEnrollment["active"],
): PriorEnrollment {
  return { id, status, active };
}

describe("prior enrollment decisions", () => {
  it("requires an explicit decision when a closed enrollment can be reopened", () => {
    const prior = enrollment("closed-1", "closed", false);

    expect(isReopenablePriorEnrollment(prior)).toBe(true);
    expect(requiresPriorEnrollmentDecision([prior])).toBe(true);
  });

  it("does not offer deleted enrollments for reopening", () => {
    const deleted = enrollment("deleted-1", "deleted", false);

    expect(isReopenablePriorEnrollment(deleted)).toBe(false);
    expect(requiresPriorEnrollmentDecision([deleted])).toBe(false);
  });

  it("does not block creation when there is no prior enrollment", () => {
    expect(requiresPriorEnrollmentDecision([])).toBe(false);
  });
});
