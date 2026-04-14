import { describe, expect, it } from "vitest";
import { buildSecretGameFeatureFlagsForRoute, createDefaultSecretGamesAdminConfig } from "./adminConfig";
import { resolveCustomerSearchSecretLaunch } from "./customerSearchLaunch";

function makeFeatureFlags() {
  const config = createDefaultSecretGamesAdminConfig();
  config.flags.masterEnabled = true;
  config.flags.customerPageEnabled = true;
  config.games.flip.enabled = true;
  config.games.necromancer.enabled = true;
  return buildSecretGameFeatureFlagsForRoute(config, "customers");
}

describe("customer search secret launch", () => {
  it("ignores non-secret search input", () => {
    const result = resolveCustomerSearchSecretLaunch({
      input: "rivera household",
      isDevUser: true,
      userId: "dev-user",
    });

    expect(result.matched).toBe(false);
  });

  it("routes card-native games into the sandbox cards surface", () => {
    const result = resolveCustomerSearchSecretLaunch({
      input: "flip",
      isDevUser: true,
      userId: "dev-user",
      fallbackCustomerId: "cust-rivera",
      featureFlags: makeFeatureFlags(),
    });

    expect(result.matched).toBe(true);
    if (!result.matched || !result.ok) throw new Error("Expected a successful launch.");
    expect(result.href).toBe("/dev/secret-games/cards?game=flip&source=search-exact&triggerId=search-flip&command=flip&customer=cust-rivera");
  });

  it("routes immersive games into the sandbox overlay surface", () => {
    const result = resolveCustomerSearchSecretLaunch({
      input: "necromancer",
      isDevUser: true,
      userId: "dev-user",
      fallbackCustomerId: "cust-rivera",
      featureFlags: makeFeatureFlags(),
    });

    expect(result.matched).toBe(true);
    if (!result.matched || !result.ok) throw new Error("Expected a successful launch.");
    expect(result.href).toBe("/dev/secret-games/overlay?game=necromancer&source=search-exact&triggerId=search-necromancer&command=necromancer");
  });

  it("surfaces rollout blockers when the sandbox flag is disabled", () => {
    const result = resolveCustomerSearchSecretLaunch({
      input: "flip",
      isDevUser: true,
      userId: "dev-user",
      featureFlags: {
        ...makeFeatureFlags(),
        secretGamesCustomerPageEnabled: false,
      },
    });

    expect(result.matched).toBe(true);
    if (!result.matched || result.ok) throw new Error("Expected a blocked launch.");
    expect(result.message).toBe("Customer-page integration is disabled.");
  });

  it("lets dev override bypass non-safety sandbox blockers", () => {
    const result = resolveCustomerSearchSecretLaunch({
      input: "flip --dev",
      isDevUser: true,
      userId: "dev-user",
      fallbackCustomerId: "cust-rivera",
      featureFlags: {
        ...makeFeatureFlags(),
        secretGamesCustomerPageEnabled: false,
      },
    });

    expect(result.matched).toBe(true);
    if (!result.matched || !result.ok) throw new Error("Expected a dev-override launch.");
    expect(result.href).toContain("/dev/secret-games/cards?");
    expect(result.href).toContain("dev=1");
  });
});
