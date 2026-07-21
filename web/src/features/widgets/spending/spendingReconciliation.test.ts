import { describe, expect, it } from "vitest";
import { buildQueueLedgerIndex, linkedReversalLedgerIds, paymentQueueIdFromLedger, queueLedgerIssue } from "./spendingReconciliation";

describe("spending queue/ledger reconciliation", () => {
  it("recognizes queue provenance in both supported ledger shapes", () => {
    expect(paymentQueueIdFromLedger({ origin: { paymentQueueId: "pq-1" } })).toBe("pq-1");
    expect(paymentQueueIdFromLedger({ origin: { sourcePath: "paymentQueue/pq-2" } })).toBe("pq-2");
  });

  it("collapses a linked projection ledger into its queue row", () => {
    const queue = { id: "pq-1", queueStatus: "posted", ledgerEntryId: "led-1", amount: 10 };
    const ledger = { id: "led-1", amountCents: 1000, origin: { paymentQueueId: "pq-1" } };
    const index = buildQueueLedgerIndex([queue], [ledger]);

    expect(index.primaryLedgerForQueue(queue)).toBe(ledger);
    expect(index.isLedgerRepresentedByQueue(ledger)).toBe(true);
    expect(queueLedgerIssue(queue, index.ledgersForQueue(queue))).toBe("");
  });

  it("keeps genuine ledger-only entries visible", () => {
    const ledger = { id: "legacy-ledger", amountCents: 1000, origin: { sourcePath: "customerEnrollments/e/spends/s" } };
    const index = buildQueueLedgerIndex([], [ledger]);
    expect(index.isLedgerRepresentedByQueue(ledger)).toBe(false);
  });

  it("flags multiple postings and financial mismatches on the canonical queue row", () => {
    const queue = { id: "pq-1", queueStatus: "posted", ledgerEntryId: "led-1", amount: 10, grantId: "g1", lineItemId: "li1" };
    const first = { id: "led-1", amountCents: 1000, grantId: "g1", lineItemId: "li1", origin: { paymentQueueId: "pq-1" } };
    const second = { id: "led-2", amountCents: 1200, grantId: "g2", lineItemId: "li2", origin: { paymentQueueId: "pq-1" } };
    expect(queueLedgerIssue(queue, [first, second])).toBe("Reconciliation: 2 ledger entries linked");
    expect(queueLedgerIssue(queue, [second])).toBe("Reconciliation: amount, grant, budget mismatch");
  });

  it("links adjustment reversals to the spend they cancel", () => {
    const ids = linkedReversalLedgerIds([
      { id: "spend-1", amountCents: 1000, enrollmentId: "e1", paymentId: "p1", createdAt: "2026-01-01" },
      { id: "rev-1", amountCents: -1000, labels: ["adjustment", "reversalOf:spend-1"], createdAt: "2026-01-02" },
      { id: "replacement-1", amountCents: 1200, labels: ["adjustment", "adjusted:spend-1"], createdAt: "2026-01-02" },
    ]);
    expect([...ids].sort()).toEqual(["rev-1", "spend-1"]);
  });

  it("pairs legacy negative reversals with the latest matching spend", () => {
    const ids = linkedReversalLedgerIds([
      { id: "spend-1", amountCents: 1000, enrollmentId: "e1", paymentId: "p1", createdAt: "2026-01-01" },
      { id: "rev-1", amountCents: -1000, enrollmentId: "e1", paymentId: "p1", createdAt: "2026-01-02" },
      { id: "replacement-1", amountCents: 1200, enrollmentId: "e1", paymentId: "p1", createdAt: "2026-01-03" },
    ]);
    expect([...ids].sort()).toEqual(["rev-1", "spend-1"]);
  });
});
