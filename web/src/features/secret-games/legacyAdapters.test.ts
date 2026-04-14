import { describe, expect, it } from "vitest";
import {
  buildLegacySecretLaunchDecision,
  getLegacySecretGameByLegacyGameId,
  getLegacyStorageGameId,
  listLegacySecretGames,
} from "./legacyAdapterData";

describe("legacy secret-game adapters", () => {
  it("exposes legacy games through the typed registry", () => {
    const legacyGames = listLegacySecretGames();
    expect(legacyGames.length).toBeGreaterThanOrEqual(5);
    expect(getLegacySecretGameByLegacyGameId("runner")?.id).toBe("legacy-runner");
    expect(getLegacySecretGameByLegacyGameId("snake")?.id).toBe("legacy-snake");
  });

  it("keeps legacy storage ids explicit", () => {
    expect(getLegacyStorageGameId("legacy-runner")).toBe("runner");
    expect(getLegacyStorageGameId("legacy-space-invaders")).toBe("space_invaders");
    expect(getLegacyStorageGameId("flip")).toBeNull();
  });

  it("routes quick-break and arcade launches through the legacy-launcher source", () => {
    const runnerDecision = buildLegacySecretLaunchDecision({
      secretGameId: "legacy-runner",
      source: "legacy-launcher",
      routeKind: "legacy-host",
    });

    expect(runnerDecision.ok).toBe(true);
    expect(runnerDecision.game?.legacyAdapter?.legacyGameId).toBe("runner");
    expect(runnerDecision.trigger?.kind).toBe("legacy-launcher");
  });

  it("routes ambient legacy triggers through hidden-ui and ambient gating", () => {
    const asteroidDecision = buildLegacySecretLaunchDecision({
      secretGameId: "legacy-space-invaders",
      source: "hidden-ui",
      routeKind: "overlay-host",
    });

    expect(asteroidDecision.ok).toBe(true);
    expect(asteroidDecision.trigger?.id).toBe("legacy-ambient-asteroid");
  });
});
