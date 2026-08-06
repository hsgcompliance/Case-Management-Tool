import { describe, expect, it } from "vitest";
import { extractedQueueDate, paymentQueueDueDateForUpsert } from "./queueDates";

describe("payment queue canonical dates", () => {
  it("derives new credit-card and invoice due dates from extracted createdAt", () => {
    expect(paymentQueueDueDateForUpsert("credit-card", null, "2026-08-06T14:30:00.000Z"))
      .toBe("2026-08-06");
    expect(paymentQueueDueDateForUpsert("invoice", undefined, "2026-07-01"))
      .toBe("2026-07-01");
  });

  it("fills a null date during re-extraction", () => {
    expect(paymentQueueDueDateForUpsert("credit-card", null, "2026-06-15T00:00:00-06:00"))
      .toBe("2026-06-15");
  });

  it("preserves an existing due date override", () => {
    expect(paymentQueueDueDateForUpsert("invoice", "2026-09-01", "2026-08-06T00:00:00Z"))
      .toBe("2026-09-01");
  });

  it("rejects invalid extracted dates and leaves projections unchanged", () => {
    expect(extractedQueueDate("2026-02-30T00:00:00Z")).toBeNull();
    expect(extractedQueueDate("not-a-date")).toBeNull();
    expect(extractedQueueDate("2026-08-06-not-iso")).toBeNull();
    expect(paymentQueueDueDateForUpsert("projection", null, "2026-08-06T00:00:00Z"))
      .toBeNull();
  });
});
