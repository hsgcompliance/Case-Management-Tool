import { describe, expect, it } from "vitest";
import { resolveSecretGameLaunch } from "./launchResolver";
import { createDirectSecretLaunchRequest, parseSecretSearchTrigger } from "./triggerParser";
import { buildSandboxLaunchHref, createSandboxLaunchEnvironment } from "./sandboxLaunch";

describe("sandbox launch routing", () => {
  it("routes card-native search launches to the cards sandbox page", () => {
    const parsed = parseSecretSearchTrigger("flip");
    if (!parsed.matched) throw new Error("Expected flip to parse.");

    const decision = resolveSecretGameLaunch(parsed.request, createSandboxLaunchEnvironment());
    const href = buildSandboxLaunchHref({
      decision,
      request: parsed.request,
      fallbackCustomerId: "cust-1",
    });

    expect(href).toBe("/dev/secret-games/cards?game=flip&source=search-exact&triggerId=search-flip&command=flip&customer=cust-1");
  });

  it("routes immersive triggers to the overlay sandbox page", () => {
    const request = createDirectSecretLaunchRequest("konami", { gameId: "necromancer" });
    const decision = resolveSecretGameLaunch(request, createSandboxLaunchEnvironment());
    const href = buildSandboxLaunchHref({
      decision,
      request,
      fallbackCustomerId: "cust-1",
    });

    expect(href).toBe("/dev/secret-games/overlay?game=necromancer&source=konami&triggerId=konami-necromancer");
  });
});
