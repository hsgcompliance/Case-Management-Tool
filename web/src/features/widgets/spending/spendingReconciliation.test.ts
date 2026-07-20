import { describe, expect, it } from "vitest";
import { buildQueueLedgerIndex, paymentQueueIdFromLedger, queueLedgerIssue } from "./spendingReconciliation";

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
});
