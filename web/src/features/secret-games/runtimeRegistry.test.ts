import { describe, expect, it } from "vitest";
import { getSecretGameRuntimeComponent, hasSecretGameRuntimeComponent } from "./runtimeRegistry";

describe("secret game runtime registry", () => {
  it("exposes native runtime components for implemented card games", () => {
    expect(hasSecretGameRuntimeComponent("flip")).toBe(true);
    expect(hasSecretGameRuntimeComponent("broken-data")).toBe(true);
    expect(hasSecretGameRuntimeComponent("farm")).toBe(true);
    expect(hasSecretGameRuntimeComponent("necromancer")).toBe(true);
    expect(hasSecretGameRuntimeComponent("asteroids")).toBe(true);
    expect(getSecretGameRuntimeComponent("flip")).not.toBeNull();
    expect(getSecretGameRuntimeComponent("broken-data")).not.toBeNull();
    expect(getSecretGameRuntimeComponent("farm")).not.toBeNull();
    expect(getSecretGameRuntimeComponent("necromancer")).not.toBeNull();
    expect(getSecretGameRuntimeComponent("asteroids")).not.toBeNull();
  });

  it("still returns null for unknown ids", () => {
    expect(hasSecretGameRuntimeComponent("unknown-secret-game")).toBe(false);
    expect(getSecretGameRuntimeComponent("unknown-secret-game")).toBeNull();
  });
});
