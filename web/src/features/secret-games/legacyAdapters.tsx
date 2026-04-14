"use client";

import React from "react";
import { getGameById, type GameDefinition } from "../games/registry";
import { useGameMiniPlayer } from "../games/GameMiniPlayerContext";
import {
  buildLegacySecretLaunchDecision,
  getLegacyGameDefinition,
} from "./legacyAdapterData";

export function getLegacyMiniPlayerGame(secretGameId: string): GameDefinition | null {
  const legacyGameId = getLegacyGameDefinition(secretGameId)?.legacyAdapter?.legacyGameId;
  if (!legacyGameId) return null;
  return getGameById(legacyGameId);
}

export function useLegacySecretGameLauncher(routeKind: "sandbox" | "customer-card" | "overlay-host" | "legacy-host") {
  const { openMiniPlayer } = useGameMiniPlayer();

  return React.useCallback(
    (
      secretGameId: string,
      options?: {
        source?: "legacy-launcher" | "hidden-ui";
        celebration?: boolean;
      },
    ) => {
      const decision = buildLegacySecretLaunchDecision({
        secretGameId,
        source: options?.source || "legacy-launcher",
        routeKind,
      });
      const adapter = decision.game?.legacyAdapter;
      if (!decision.ok || !adapter) return decision;

      if (adapter.launchHost === "mini-player" && adapter.legacyGameId) {
        openMiniPlayer(
          adapter.legacyGameId,
          adapter.supportsCelebration && options?.celebration ? { celebration: true } : undefined,
        );
      }

      return decision;
    },
    [openMiniPlayer, routeKind],
  );
}
