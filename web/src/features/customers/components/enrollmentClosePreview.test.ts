import { describe, expect, it } from "vitest";
import { buildEnrollmentClosePreview } from "@hdb/contracts/enrollments";

describe("buildEnrollmentClosePreview", () => {
  const payments = [
    { id: "paid-march", dueDate: "2026-03-05", paid: true, amount: 900 },
    { id: "unpaid-april", dueDate: "2026-04-01", paid: false, amount: 900 },
    { id: "unpaid-may", dueDate: "2026-05-01", paid: false, amount: 900 },
  ];

  it("defaults assistance end to the last day of the last paid month", () => {
    const preview = buildEnrollmentClosePreview({ payments, fallbackDate: "2026-07-20" });

    expect(preview.closeDate).toBe("2026-03-31");
    expect(preview.lastPaidDate).toBe("2026-03-05");
    expect(preview.futureUnpaid.map((payment) => payment.id)).toEqual(["unpaid-april", "unpaid-may"]);
    expect(preview.retainedPayments.map((payment) => payment.id)).toEqual(["paid-march"]);
  });

  it("normalizes a requested close date to month end", () => {
    const preview = buildEnrollmentClosePreview({ payments, requestedCloseDate: "2026-04-09" });

    expect(preview.closeDate).toBe("2026-04-30");
    expect(preview.futureUnpaid.map((payment) => payment.id)).toEqual(["unpaid-may"]);
  });

  it("blocks a close date before an already-paid item", () => {
    const preview = buildEnrollmentClosePreview({
      payments: [{ id: "paid-june", dueDate: "2026-06-01", paid: true }],
      requestedCloseDate: "2026-05-01",
    });

    expect(preview.closeDate).toBe("2026-05-31");
    expect(preview.paidAfterClose.map((payment) => payment.id)).toEqual(["paid-june"]);
  });
});
