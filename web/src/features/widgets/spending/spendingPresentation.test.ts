import { describe, expect, it } from "vitest";
import {
  enrollmentPaymentStatus,
  isClosedGrantRecord,
  spendingChargeGroupLabel,
  spendingDisplayTypeLabel,
} from "./spendingPresentation";

describe("spending transaction presentation", () => {
  it.each([
    [{ status: "closed" }, true],
    [{ status: "deleted" }, true],
    [{ deleted: true, status: "active" }, true],
    [{ active: false }, true],
    [{ status: "draft", active: false }, false],
    [{ status: "active", active: true }, false],
  ] as const)("identifies terminal grant state for %j", (grant, expected) => {
    expect(isClosedGrantRecord(grant)).toBe(expected);
  });

  it.each([
    ["queue-projection", "Enrollment"],
    ["grant-ledger", "Enrollment"],
    ["queue-invoice", "Invoice"],
    ["queue-credit-card", "Credit Card"],
    ["card-ledger", "Credit Card"],
  ] as const)("labels %s rows as %s", (kind, label) => {
    expect(spendingChargeGroupLabel(kind)).toBe(label);
  });

  it.each([
    ["queue-projection", "monthly", "Rent"],
    ["grant-ledger", "Rental Assistance", "Rent"],
    ["queue-projection", "utility", "Rent"],
    ["queue-projection", "service", "Rent"],
    ["queue-projection", "deposit", "Deposit"],
    ["queue-projection", "Prorated Rent", "Prorated"],
    ["grant-ledger", "2026-07-01 · Arrears", "Arrears"],
    ["queue-invoice", "arrears", "Invoice"],
    ["queue-credit-card", "deposit", "Credit Card"],
  ] as const)("displays %s with %s as %s", (kind, hint, label) => {
    expect(spendingDisplayTypeLabel(kind, hint)).toBe(label);
  });

  it("keeps enrollment as the charge group while status changes from projected to paid", () => {
    expect(spendingChargeGroupLabel("queue-projection")).toBe("Enrollment");
    expect(enrollmentPaymentStatus("queue-projection", "open")).toBe("Projected");
    expect(enrollmentPaymentStatus("queue-projection", "closed")).toBe("Paid · Needs HMIS + CW");
    expect(enrollmentPaymentStatus("grant-ledger", "closed", "Posted; HMIS Only")).toBe("Paid · Needs CW");
    expect(enrollmentPaymentStatus("grant-ledger", "closed", "Posted; CW Only")).toBe("Paid · Needs HMIS");
    expect(enrollmentPaymentStatus("grant-ledger", "closed", "Data Entry Complete")).toBe(
      "Paid · Data Entry Complete",
    );
  });
});
