import { describe, expect, it } from "vitest";
import {
  KONAMI_SEQUENCE,
  advanceKonamiSequence,
  createDirectSecretLaunchRequest,
  matchesKonamiSequence,
  parseSecretSearchTrigger,
} from "./triggerParser";

describe("secret trigger parser", () => {
  it("matches exact search commands only", () => {
    const parsed = parseSecretSearchTrigger("broken data");
    expect(parsed.matched).toBe(true);
    if (!parsed.matched) throw new Error("Expected a match.");
    expect(parsed.gameId).toBe("broken-data");
    expect(parsed.request.command).toBe("broken data");

    expect(parseSecretSearchTrigger("broken")).toEqual({
      matched: false,
      reason: "not-exact-command",
      normalizedInput: "broken",
    });
    expect(parseSecretSearchTrigger("flip now")).toEqual({
      matched: false,
      reason: "not-exact-command",
      normalizedInput: "flip now",
    });
  });

  it("parses a predictable trailing --dev override", () => {
    const parsed = parseSecretSearchTrigger("  FARM   --DEV ");
    expect(parsed.matched).toBe(true);
    if (!parsed.matched) throw new Error("Expected a match.");
    expect(parsed.command).toBe("farm");
    expect(parsed.request.devOverrideRequested).toBe(true);

    expect(parseSecretSearchTrigger("farm --dev extra")).toEqual({
      matched: false,
      reason: "not-exact-command",
      normalizedInput: "farm --dev extra",
    });
  });

  it("supports direct request creation for non-search trigger families", () => {
    expect(createDirectSecretLaunchRequest("hidden-ui", { triggerId: "hidden-asteroids" })).toEqual({
      source: "hidden-ui",
      triggerId: "hidden-asteroids",
      devOverrideRequested: false,
    });

    expect(createDirectSecretLaunchRequest("konami", { gameId: "necromancer" })).toEqual({
      source: "konami",
      gameId: "necromancer",
      triggerId: "konami-necromancer",
      devOverrideRequested: false,
    });
  });

  it("tracks konami sequence progress deterministically", () => {
    let progress = 0;
    let matched = false;

    for (const key of KONAMI_SEQUENCE) {
      const next = advanceKonamiSequence(progress, key);
      progress = next.progress;
      matched = next.matched;
    }

    expect(matched).toBe(true);
    expect(progress).toBe(0);
    expect(matchesKonamiSequence(KONAMI_SEQUENCE)).toBe(true);
    expect(matchesKonamiSequence(["arrowup", "arrowdown", "b", "a"])).toBe(false);
  });
});
