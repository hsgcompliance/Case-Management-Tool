import { describe, expect, it } from "vitest";
import { summarizeGrantDeletionSafety } from "./deletionSafety";

describe("grant hard-delete safety", () => {
  it("blocks active financial references, including orphaned mirrors", () => {
    expect(summarizeGrantDeletionSafety({
      enrollments: [{ payments: [{ id: "p1" }] }, { spends: [{ id: "s1" }] }],
      ledgerCount: 1,
      paymentQueueCount: 2,
      spendMirrorCount: 1,
    })).toEqual({
      ledger: 1,
      paymentQueue: 2,
      enrollmentPaymentSchedules: 1,
      embeddedSpendMirrors: 1,
      spendSubcollectionMirrors: 1,
      blocked: true,
    });
  });

  it("allows hard delete only after financial relationships are absent", () => {
    expect(summarizeGrantDeletionSafety({
      enrollments: [{ payments: [], spends: [] }],
      ledgerCount: 0,
      paymentQueueCount: 0,
      spendMirrorCount: 0,
    }).blocked).toBe(false);
  });
});
