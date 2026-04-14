import { describe, expect, it } from "vitest";
import { evaluateSecretLaunchBlockers, DEFAULT_SECRET_GAME_FLAGS } from "./launchBlockers";
import { resolveSecretGameLaunch } from "./launchResolver";
import { listSecretGames } from "./registry";
import { createDirectSecretLaunchRequest, parseSecretSearchTrigger } from "./triggerParser";
import type { SecretLaunchEnvironment } from "./types";

function makeEnvironment(
  patch?: Partial<SecretLaunchEnvironment>,
  flagPatch?: Partial<SecretLaunchEnvironment["flags"]>,
): SecretLaunchEnvironment {
  return {
    isDevUser: true,
    flags: {
      ...DEFAULT_SECRET_GAME_FLAGS,
      ...Object.fromEntries(listSecretGames().map((game) => [game.featureFlag, true])),
      secretGamesMasterEnabled: true,
      secretGamesSandboxEnabled: true,
      ...flagPatch,
    },
    mountContext: {
      routeKind: "sandbox",
    },
    ...patch,
  };
}

describe("secret launch resolver", () => {
  it("resolves exact-match search launches into typed game decisions", () => {
    const parsed = parseSecretSearchTrigger("flip");
    if (!parsed.matched) throw new Error("Expected a parsed search trigger.");

    const decision = resolveSecretGameLaunch(parsed.request, makeEnvironment());
    expect(decision.ok).toBe(true);
    expect(decision.game?.id).toBe("flip");
    expect(decision.preferredContainerMode).toBe("inline");
    expect(decision.allowedContainerModes).toEqual(["inline", "card-expanded", "card-focus"]);
    expect(decision.blockers).toEqual([]);
  });

  it("resolves konami and hidden-ui requests", () => {
    const konamiDecision = resolveSecretGameLaunch(
      createDirectSecretLaunchRequest("konami", { gameId: "necromancer" }),
      makeEnvironment({
        mountContext: { routeKind: "overlay-host" },
      }, { secretGamesAmbientTriggersEnabled: true }),
    );
    expect(konamiDecision.ok).toBe(true);
    expect(konamiDecision.game?.id).toBe("necromancer");

    const hiddenDecision = resolveSecretGameLaunch(
      createDirectSecretLaunchRequest("hidden-ui", { triggerId: "hidden-asteroids" }),
      makeEnvironment({
        mountContext: { routeKind: "overlay-host" },
      }, { secretGamesAmbientTriggersEnabled: true }),
    );
    expect(hiddenDecision.ok).toBe(true);
    expect(hiddenDecision.game?.id).toBe("asteroids");
  });

  it("treats kill switch as a hard blocker that dev override cannot bypass", () => {
    const parsed = parseSecretSearchTrigger("flip --dev");
    if (!parsed.matched) throw new Error("Expected a parsed search trigger.");

    const decision = resolveSecretGameLaunch(
      parsed.request,
      makeEnvironment(undefined, {
        secretGamesKillSwitch: true,
      }),
    );

    expect(decision.ok).toBe(false);
    expect(decision.devOverrideApplied).toBe(false);
    expect(decision.blockers.map((entry) => entry.code)).toContain("kill-switch-active");
  });

  it("allows dev override to bypass non-safety rollout blockers", () => {
    const parsed = parseSecretSearchTrigger("flip --dev");
    if (!parsed.matched) throw new Error("Expected a parsed search trigger.");

    const withoutOverride = resolveSecretGameLaunch(
      { ...parsed.request, devOverrideRequested: false },
      makeEnvironment(undefined, {
        secretGamesSandboxEnabled: false,
      }),
    );
    expect(withoutOverride.ok).toBe(false);
    expect(withoutOverride.blockers.map((entry) => entry.code)).toContain("sandbox-disabled");

    const withOverride = resolveSecretGameLaunch(
      parsed.request,
      makeEnvironment(undefined, {
        secretGamesSandboxEnabled: false,
      }),
    );
    expect(withOverride.ok).toBe(true);
    expect(withOverride.devOverrideApplied).toBe(true);
    expect(withOverride.blockers).toEqual([]);
  });

  it("blocks dev override for non-dev users", () => {
    const parsed = parseSecretSearchTrigger("flip --dev");
    if (!parsed.matched) throw new Error("Expected a parsed search trigger.");

    const decision = resolveSecretGameLaunch(
      parsed.request,
      makeEnvironment({ isDevUser: false }, { secretGamesSandboxEnabled: false }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.blockers.map((entry) => entry.code)).toContain("dev-override-disallowed");
    expect(decision.blockers.map((entry) => entry.code)).toContain("sandbox-disabled");
  });

  it("exposes blocker evaluation independently for future legacy adapter routing", () => {
    const request = createDirectSecretLaunchRequest("legacy-launcher", { gameId: "flip" });
    const decision = resolveSecretGameLaunch(
      request,
      makeEnvironment({
        mountContext: { routeKind: "legacy-host" },
      }, {
        secretGamesLegacyAdaptersEnabled: false,
      }),
    );

    const blockersOnly = evaluateSecretLaunchBlockers({
      request,
      environment: makeEnvironment({
        mountContext: { routeKind: "legacy-host" },
      }, {
        secretGamesLegacyAdaptersEnabled: false,
      }),
      game: decision.game,
      trigger: decision.trigger,
    });

    expect(decision.ok).toBe(false);
    expect(blockersOnly.blockers.map((entry) => entry.code)).toContain("legacy-adapters-disabled");
  });
});
