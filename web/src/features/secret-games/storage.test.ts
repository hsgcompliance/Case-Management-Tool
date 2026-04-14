import { describe, expect, it } from "vitest";
import { buildSecretStorageKey } from "./storage";
import { getSecretGameById } from "./registry";

describe("secret game storage", () => {
  it("builds user-customer keys for card-native games", () => {
    const flip = getSecretGameById("flip");
    if (!flip) throw new Error("Missing flip definition.");

    expect(
      buildSecretStorageKey({
        game: flip,
        mountContext: {
          routeKind: "customer-card",
          customerId: "cust-1",
          userId: "cm-1",
        },
      }),
    ).toBe("secretArcade:v1:flip:user-customer:cm-1:cust-1");
  });

  it("returns null when required scope identifiers are missing", () => {
    const brokenData = getSecretGameById("broken-data");
    if (!brokenData) throw new Error("Missing broken-data definition.");

    expect(
      buildSecretStorageKey({
        game: brokenData,
        mountContext: {
          routeKind: "customer-card",
          customerId: "cust-1",
        },
      }),
    ).toBeNull();
  });
});
