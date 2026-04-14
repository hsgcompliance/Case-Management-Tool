import { describe, expect, it } from "vitest";
import {
  buildSecretGameFeatureFlagsForRoute,
  createDefaultSecretGamesAdminConfig,
  readSecretGamesAdminConfig,
} from "./adminConfig";

describe("secret games admin config", () => {
  it("defaults every game to disabled while keeping the customers route selected", () => {
    const config = createDefaultSecretGamesAdminConfig();

    expect(config.flags.masterEnabled).toBe(false);
    expect(config.routesEnabled).toEqual(["customers"]);
    expect(config.games.flip?.enabled).toBe(false);
    expect(config.games.necromancer?.allowedRoutes).toEqual(["customers"]);
  });

  it("hydrates unknown input into a normalized config shape", () => {
    const config = readSecretGamesAdminConfig({
      flags: {
        masterEnabled: true,
        customerPageEnabled: true,
      },
      routesEnabled: ["customers", "nope"],
      games: {
        flip: {
          enabled: true,
          allowedRoutes: ["customers", "bogus"],
        },
      },
    });

    expect(config.flags.masterEnabled).toBe(true);
    expect(config.flags.customerPageEnabled).toBe(true);
    expect(config.routesEnabled).toEqual(["customers"]);
    expect(config.games.flip?.enabled).toBe(true);
    expect(config.games.flip?.allowedRoutes).toEqual(["customers"]);
    expect(config.games.asteroids?.enabled).toBe(false);
  });

  it("builds launch flags that combine global and per-game state", () => {
    const config = createDefaultSecretGamesAdminConfig();
    config.flags.masterEnabled = true;
    config.flags.customerPageEnabled = true;
    config.games.flip.enabled = true;

    const flags = buildSecretGameFeatureFlagsForRoute(config, "customers");

    expect(flags.secretGamesMasterEnabled).toBe(true);
    expect(flags.secretGamesCustomerPageEnabled).toBe(true);
    expect(flags.secretGamesGameFlipEnabled).toBe(true);
    expect(flags.secretGamesGameFarmEnabled).toBe(false);
  });
});
