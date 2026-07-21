import { describe, expect, it } from "vitest";
import { isPaymentScheduleGrantEligible, paymentScheduleGrantIds } from "./paymentScheduleEligibility";

describe("payment schedule grant eligibility", () => {
  it("includes legacy and explicit budgeted grants", () => {
    expect(isPaymentScheduleGrantEligible({ kind: "grant" })).toBe(true);
    expect(isPaymentScheduleGrantEligible({
      kind: "program",
      financialConfig: { model: "budgeted" },
    })).toBe(true);
  });

  it("includes billable programs such as TSS Client", () => {
    expect(isPaymentScheduleGrantEligible({
      id: "tss-client",
      name: "TSS Client",
      kind: "program",
      financialConfig: { model: "billable" },
    })).toBe(true);
  });

  it("excludes service-only programs even when they have an enrollment", () => {
    expect(isPaymentScheduleGrantEligible({ kind: "program" })).toBe(false);
    expect(isPaymentScheduleGrantEligible({
      kind: "program",
      financialConfig: { model: "serviceOnly" },
    })).toBe(false);
  });

  it("returns only billable and budgeted record ids", () => {
    expect(paymentScheduleGrantIds([
      { id: "legacy-grant", kind: "grant" },
      { id: "tss", kind: "program", financialConfig: { model: "billable" } },
      { id: "services", kind: "program", financialConfig: { model: "serviceOnly" } },
    ])).toEqual(new Set(["legacy-grant", "tss"]));
  });
});
