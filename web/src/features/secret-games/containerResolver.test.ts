import { describe, expect, it } from "vitest";
import { getSecretGameById } from "./registry";
import {
  buildContainerFallbackChain,
  getContainerCandidateDimensions,
  getSecretContainerStateClasses,
  resolveSecretContainerMode,
} from "./containerResolver";

describe("secret container resolver", () => {
  it("builds fallback chains from preferred mode through allowed promotions", () => {
    expect(buildContainerFallbackChain("inline", ["inline", "card-expanded", "card-focus", "modal"])).toEqual([
      "inline",
      "card-expanded",
      "card-focus",
      "modal",
    ]);

    expect(buildContainerFallbackChain("card-expanded", ["card-expanded", "card-focus", "overlay"])).toEqual([
      "card-expanded",
      "card-focus",
      "overlay",
    ]);
  });

  it("promotes from inline to larger card and overlay modes when needed", () => {
    const flip = getSecretGameById("flip");
    if (!flip) throw new Error("Missing flip game.");

    const resolved = resolveSecretContainerMode({
      game: flip,
      availableWidth: 180,
      availableHeight: 120,
    });

    expect(resolved.mode).toBe("card-focus");
    expect(resolved.resolvedFromFallback).toBe(true);
  });

  it("keeps overlay-first games on overlay", () => {
    const asteroids = getSecretGameById("asteroids");
    if (!asteroids) throw new Error("Missing asteroids game.");

    const resolved = resolveSecretContainerMode({
      game: asteroids,
      availableWidth: 260,
      availableHeight: 180,
    });

    expect(resolved.mode).toBe("overlay");
    expect(resolved.fallbackChain).toEqual(["overlay"]);
  });

  it("returns deterministic candidate dimensions and state classes", () => {
    const candidates = getContainerCandidateDimensions({ availableWidth: 280, availableHeight: 180 });
    expect(candidates.inline).toEqual({ width: 280, height: 180 });
    expect(candidates.modal.width).toBeGreaterThanOrEqual(640);
    expect(getSecretContainerStateClasses("card-focus")).toContain("secret-mode-card-focus");
  });
});
