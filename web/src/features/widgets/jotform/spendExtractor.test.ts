import { describe, expect, it } from "vitest";
import { extractSpendLineItems, LINE_ITEMS_FORM_IDS } from "./spendExtractor";

function answer(value: unknown, extras: Record<string, unknown> = {}) {
  return { answer: value, ...extras };
}

describe("spending form first-class dates and invoice details", () => {
  it("uses checkout time before return time for a credit-card transaction", () => {
    const [item] = extractSpendLineItems({
      id: "cc-return",
      form_id: LINE_ITEMS_FORM_IDS.creditCard,
      created_at: "2026-08-03 09:00:00",
      answers: {
        "222": answer("Made a Return"),
        "101": answer("08/01/2026 10:30 AM"),
        "28": answer("08/02/2026 04:00 PM"),
        "281": answer("Youth Card"),
        "284": answer("Vendor"),
        "291": answer("25.00"),
      },
    });

    expect(item.createdAt).toBe("2026-08-01T10:30:00");
    expect(item.schemaVersion).toBe(2);
  });

  it("falls back to submission time when checkout time is absent", () => {
    const [item] = extractSpendLineItems({
      id: "cc-purchase",
      form_id: LINE_ITEMS_FORM_IDS.creditCard,
      created_at: "2026-08-03 09:00:00",
      answers: {
        "82": answer("Vendor"),
        "86": answer("10.00"),
      },
    });

    expect(item.createdAt).toBe("2026-08-03T09:00:00");
  });

  it("uses invoice date and promotes purpose detail", () => {
    const [item] = extractSpendLineItems({
      id: "invoice",
      form_id: LINE_ITEMS_FORM_IDS.invoice,
      created_at: "2026-08-05 09:00:00",
      answers: {
        "31": answer("08/04/2026"),
        "4": answer("08/05/2026"),
        "34": answer("For a Customer"),
        "74": answer("Vendor"),
        "75": answer("Required work boots"),
        "17": answer("80.00"),
        "84": answer("Submitted"),
        "85": answer("Customer"),
      },
    });

    expect(item.createdAt).toBe("2026-08-04T00:00:00");
    expect(item.purpose).toBe("Required work boots");
    expect(item.customer).toBe("Submitted Customer");
  });
});
