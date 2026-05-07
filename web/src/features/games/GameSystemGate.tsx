"use client";
// web/src/features/games/GameSystemGate.tsx
// Lightweight gate: reads the admin kill-switch flags from the cached org config,
// then dynamically imports the heavy game chunks only when games are actually on.
//
// What stays out of the main bundle when games are disabled:
//   - registry.ts  (RunnerGame, SnakeGame, SpaceInvadersGame, TowerDefenseGame)
//   - GameEngine.ts (DK physics)
//   - BugGameCanvas.tsx
//   - All four trigger components
//   - GameMiniPlayer.tsx (the Float + drag/resize UI)
//   - GameTriggersHost.tsx

import React from "react";
import dynamic from "next/dynamic";
import { useOrgConfig } from "@hooks/useOrgConfig";
import { readSecretGamesAdminConfig } from "@features/secret-games/adminConfig";
import CardPhysicsProvider from "./effects/CardPhysicsContext";
import BlockLayerProvider from "./blocks/BlockLayerContext";
import CardCharacterLayer from "./effects/CardCharacterLayer";
import BlockOverlayLayer from "./blocks/BlockOverlayLayer";
import GameTriggersHost from "./GameTriggersHost";

// Dynamic imports — these chunks are only downloaded when `active` becomes true.
const GameMiniPlayerFloatLazy = dynamic(
  () => import("./GameMiniPlayer").then((m) => ({ default: m.GameMiniPlayerFloat })),
  { ssr: false },
);

export default function GameSystemGate() {
  const { data: orgConfig } = useOrgConfig();

  // readSecretGamesAdminConfig returns safe defaults (all disabled) when config is
  // undefined (still loading), so we never accidentally enable games before the
  // config is known.
  const config = readSecretGamesAdminConfig(orgConfig?.secretGames);
  const active = config.flags.masterEnabled && !config.flags.killSwitch;

  if (!active) return null;

  return (
    <BlockLayerProvider>
      <CardPhysicsProvider>
        <GameMiniPlayerFloatLazy />
        <GameTriggersHost />
      </CardPhysicsProvider>
      <CardCharacterLayer />
      <BlockOverlayLayer />
    </BlockLayerProvider>
  );
}
