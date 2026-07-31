import { describe, expect, it } from "vitest";
import { ledger } from "@hdb/contracts";
import { budgetPreviewActivityDelta } from "../../../entities/grants/budgetPreview";

describe("payment workflow hardening", () => {
  it("retains queue identity and explicit reversal linkage in manual ledger creates", () => {
    const parsed = ledger.LedgerCreateBody.parse({
      id: "pqledger_queue-1",
      source: "adjustment",
      amountCents: -12500,
      amount: -125,
      grantId: "grant-1",
      lineItemId: "line-1",
      paymentQueueId: "queue-1",
      reversalOf: "ledger-original",
      dueDate: "2026-07-30",
      labels: ["reversal", "reversalOf:ledger-original"],
    });

    expect(parsed.paymentQueueId).toBe("queue-1");
    expect(parsed.reversalOf).toBe("ledger-original");
    expect(parsed.labels).toContain("reversalOf:ledger-original");
  });

  it("previews a pending-to-posted transition without double-counting activity", () => {
    expect(budgetPreviewActivityDelta(125, -125)).toBe(0);
    expect(budgetPreviewActivityDelta(125, 0)).toBe(125);
    expect(budgetPreviewActivityDelta(-125, 0)).toBe(-125);
  });
});
