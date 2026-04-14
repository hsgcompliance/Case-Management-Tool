"use client";

import type { ComponentType } from "react";
import type { MinigameMountContext, SecretGameDefinition } from "./types";
import AsteroidsOverlayPlaceholder from "./native/AsteroidsOverlayPlaceholder";
import BrokenDataGameCard from "./native/BrokenDataGameCard";
import FarmGameCard from "./native/FarmGameCard";
import FlipGameCard from "./native/FlipGameCard";
import NecromancerOverlayPlaceholder from "./native/NecromancerOverlayPlaceholder";

export type SecretGameRuntimeProps = {
  definition: SecretGameDefinition;
  mountContext: MinigameMountContext;
  onRequestClose: () => void;
};

const SECRET_GAME_RUNTIME_COMPONENTS: Readonly<Record<string, ComponentType<SecretGameRuntimeProps>>> = {
  flip: FlipGameCard,
  "broken-data": BrokenDataGameCard,
  farm: FarmGameCard,
  necromancer: NecromancerOverlayPlaceholder,
  asteroids: AsteroidsOverlayPlaceholder,
};

export function getSecretGameRuntimeComponent(gameId: string): ComponentType<SecretGameRuntimeProps> | null {
  return SECRET_GAME_RUNTIME_COMPONENTS[gameId] || null;
}

export function hasSecretGameRuntimeComponent(gameId: string): boolean {
  return !!SECRET_GAME_RUNTIME_COMPONENTS[gameId];
}
