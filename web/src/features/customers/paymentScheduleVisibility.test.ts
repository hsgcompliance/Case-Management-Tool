import { describe, expect, it } from "vitest";
import { activeScheduleRows, isVoidedSchedulePayment } from "./paymentScheduleVisibility";

describe("customer payment schedule void visibility", () => {
  it("recognizes canonical and legacy void markers", () => {
    expect(isVoidedSchedulePayment({ void: true })).toBe(true);
    expect(isVoidedSchedulePayment({ status: "voided" })).toBe(true);
    expect(isVoidedSchedulePayment({ void: false, status: "unpaid" })).toBe(false);
  });

  it("keeps voided rows out of active financial summaries", () => {
    const active = { enrollmentId: "e1", enrollment: {}, payment: { id: "p1", amount: 100 } };
    const voided = { enrollmentId: "e1", enrollment: {}, payment: { id: "p2", amount: 200, void: true } };
    expect(activeScheduleRows([active, voided] as never)).toEqual([active]);
  });
});
