import type {
  CompletePaymentQueueResult,
  PaymentQueueItem,
  PaymentQueueListReq,
  PaymentQueueListResp,
} from "@client/paymentQueue";

export async function fetchAllPaymentQueuePages(
  fetchPage: (query: PaymentQueueListReq) => Promise<PaymentQueueListResp>,
  query: PaymentQueueListReq = {},
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<CompletePaymentQueueResult> {
  const pageSize = Math.max(1, Math.min(1000, options.pageSize ?? query.limit ?? 500));
  const maxPages = Math.max(1, options.maxPages ?? 100);
  const byId = new Map<string, PaymentQueueItem>();
  let cursor = query.cursor;
  let pagesFetched = 0;

  for (let page = 0; page < maxPages; page += 1) {
    try {
      const response = await fetchPage({ ...query, limit: pageSize, ...(cursor ? { cursor } : {}) });
      pagesFetched += 1;
      const items = Array.isArray(response.items) ? response.items : [];
      for (const item of items) byId.set(item.id, item);
      if (!response.hasMore) {
        return { items: Array.from(byId.values()), pagesFetched, complete: true, partialError: null };
      }
      const nextCursor = String(response.nextCursor || items[items.length - 1]?.id || "").trim();
      if (!nextCursor || nextCursor === cursor) {
        return {
          items: Array.from(byId.values()), pagesFetched, complete: false,
          partialError: "The transaction feed returned an invalid continuation cursor.",
        };
      }
      cursor = nextCursor;
    } catch (error) {
      if (pagesFetched === 0) throw error;
      return {
        items: Array.from(byId.values()), pagesFetched, complete: false,
        partialError: error instanceof Error ? error.message : "A later transaction page failed to load.",
      };
    }
  }

  return {
    items: Array.from(byId.values()), pagesFetched, complete: false,
    partialError: `Transaction pagination stopped after ${maxPages} pages.`,
  };
}
