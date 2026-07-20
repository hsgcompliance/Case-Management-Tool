import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@lib/stable", () => ({ stableSortObject: (value: unknown) => value }));
import { qk } from "./queryKeys";
import { optimisticPostPaymentQueuePatches } from "./paymentQueueOptimistic";

function applyPatches(qc: QueryClient, patches: ReturnType<typeof optimisticPostPaymentQueuePatches>) {
  for (const patch of patches) {
    const keys = Array.isArray(patch.key[0]) ? patch.key as ReadonlyArray<ReadonlyArray<unknown>> : [patch.key as ReadonlyArray<unknown>];
    for (const key of keys) qc.setQueryData(key, patch.update(qc.getQueryData(key)));
  }
}

describe("payment queue optimistic posting", () => {
  it("updates broad queue lists in place but removes rows from pending-only lists", () => {
    const qc = new QueryClient();
    const item = { id: "pq-1", queueStatus: "pending" as const, amount: 10 };
    const broadKey = qk.paymentQueue.list({ month: "2026-07" });
    const pendingKey = qk.paymentQueue.list({ month: "2026-07", queueStatus: "pending" });
    qc.setQueryData(broadKey, [item]);
    qc.setQueryData(pendingKey, [item]);

    applyPatches(qc, optimisticPostPaymentQueuePatches(qc, item));

    expect(qc.getQueryData<Array<typeof item>>(broadKey)?.[0]?.queueStatus).toBe("posted");
    expect(qc.getQueryData(pendingKey)).toEqual([]);
  });
});
