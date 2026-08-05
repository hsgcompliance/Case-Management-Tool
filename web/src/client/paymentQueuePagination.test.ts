import { describe, expect, it, vi } from "vitest";
import type { PaymentQueueListResp } from "./paymentQueue";
import { fetchAllPaymentQueuePages } from "../lib/paymentQueuePagination";

function page(ids: string[], hasMore: boolean, nextCursor: string | null): PaymentQueueListResp {
  return {
    ok: true,
    items: ids.map((id) => ({ id })),
    count: ids.length,
    hasMore,
    nextCursor,
  };
}

describe("payment queue complete pagination", () => {
  it("retrieves every page and deduplicates overlapping records", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(page(["a", "b"], true, "b"))
      .mockResolvedValueOnce(page(["b", "c"], false, null));
    const result = await fetchAllPaymentQueuePages(fetchPage, { dueDateFrom: "2026-01-01" }, { pageSize: 2 });
    expect(result.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result).toMatchObject({ pagesFetched: 2, complete: true, partialError: null });
    expect(fetchPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "b", limit: 2 }));
  });

  it("keeps successfully retrieved rows when a later page fails", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(page(["a", "b"], true, "b"))
      .mockRejectedValueOnce(new Error("page unavailable"));
    const result = await fetchAllPaymentQueuePages(fetchPage, {}, { pageSize: 2 });
    expect(result.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.complete).toBe(false);
    expect(result.partialError).toContain("page unavailable");
  });

  it("fails normally when the initial page cannot load", async () => {
    await expect(fetchAllPaymentQueuePages(async () => { throw new Error("offline"); }))
      .rejects.toThrow("offline");
  });
});
