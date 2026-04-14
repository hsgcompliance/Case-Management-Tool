import { describe, expect, it } from "vitest";
import { createSecretGameRegistry, SECRET_GAME_DEFINITIONS, getSecretGameById } from "./registry";
import type { SecretGameDefinition } from "./types";

const baseDefinition = getSecretGameById("flip") as SecretGameDefinition;

function makeDefinition(patch: Partial<SecretGameDefinition>): SecretGameDefinition {
  return {
    ...baseDefinition,
    triggers: baseDefinition.triggers.map((trigger) => ({ ...trigger })),
    allowedContainerModes: [...baseDefinition.allowedContainerModes],
    playProfile: {
      ...baseDefinition.playProfile,
      sessionLengthSeconds: { ...baseDefinition.playProfile.sessionLengthSeconds },
    },
    ...patch,
  };
}

describe("secret games registry", () => {
  it("exposes the default seeded secret games", () => {
    expect(SECRET_GAME_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
    expect(getSecretGameById("farm")?.title).toBe("Farm");
    expect(getSecretGameById("legacy-runner")?.kind).toBe("legacy-adapter");
    expect(getSecretGameById("unknown-game")).toBeNull();
  });

  it("rejects duplicate game ids", () => {
    const duplicate = makeDefinition({ title: "Duplicate Flip" });

    expect(() => createSecretGameRegistry([baseDefinition, duplicate])).toThrow(
      /Duplicate secret game id "flip"/,
    );
  });

  it("rejects duplicate exact-match commands across games", () => {
    const duplicateCommand = makeDefinition({
      id: "flip-two",
      title: "Flip Two",
      triggers: [
        {
          id: "search-flip-two",
          kind: "search-exact",
          command: "flip",
          description: "Conflicting flip command.",
        },
      ],
    });

    expect(() => createSecretGameRegistry([baseDefinition, duplicateCommand])).toThrow(
      /Duplicate secret search command "flip"/,
    );
  });

  it("rejects duplicate trigger ids across games", () => {
    const duplicateTriggerId = makeDefinition({
      id: "flip-two",
      title: "Flip Two",
      triggers: [
        {
          id: baseDefinition.triggers[0]!.id,
          kind: "sandbox-control",
          description: "Conflicting trigger id.",
        },
      ],
    });

    expect(() => createSecretGameRegistry([baseDefinition, duplicateTriggerId])).toThrow(
      /Duplicate secret trigger id/,
    );
  });

  it("rejects immersive games that declare card container modes", () => {
    const invalidImmersive = makeDefinition({
      id: "immersive-invalid",
      title: "Immersive Invalid",
      presentation: "immersive",
      allowedContainerModes: ["inline", "overlay"],
      preferredContainerMode: "overlay",
    });

    expect(() => createSecretGameRegistry([invalidImmersive])).toThrow(
      /cannot register card-only container modes/,
    );
  });

  it("rejects preferred modes that are not allowed", () => {
    const invalidPreferredMode = makeDefinition({
      id: "bad-mode",
      title: "Bad Mode",
      allowedContainerModes: ["card-expanded", "card-focus"],
      preferredContainerMode: "overlay",
    });

    expect(() => createSecretGameRegistry([invalidPreferredMode])).toThrow(
      /does not allow it/,
    );
  });

  it("rejects legacy adapter entries that omit legacy adapter metadata", () => {
    const invalidLegacy = makeDefinition({
      id: "legacy-invalid",
      title: "Legacy Invalid",
      kind: "legacy-adapter",
      featureFlag: "secretGamesLegacyAdaptersEnabled",
      legacyAdapter: undefined,
    });

    expect(() => createSecretGameRegistry([invalidLegacy])).toThrow(
      /must declare legacy adapter metadata/,
    );
  });
});
