import { describe, expect, it } from "vitest";
import { getCustomerCardMountSize, resolveCustomerCardMountContext } from "./CustomerCardGameHost";

describe("CustomerCardGameHost helpers", () => {
  it("falls back to sandbox dimensions when measured size is unavailable", () => {
    expect(
      getCustomerCardMountSize({
        measured: { width: 0, height: 0 },
        fallbackWidth: 320,
        fallbackHeight: 240,
      }),
    ).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("builds customer-card mount context with customer scope", () => {
    const context = resolveCustomerCardMountContext({
      customer: { id: "cust-1" },
      manager: { id: "cm-1", name: "Mina" },
      width: 480,
      height: 300,
    });

    expect(context).toEqual({
      routeKind: "customer-card",
      customerId: "cust-1",
      availableWidth: 480,
      availableHeight: 300,
      featureFlags: {},
      userId: "cm-1",
    });
  });
});
