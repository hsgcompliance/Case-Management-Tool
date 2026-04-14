import { resolveSecretGameLaunch } from "./launchResolver";
import { DEFAULT_SECRET_GAME_FLAGS } from "./launchBlockers";
import { getSecretGameById, listSecretGames } from "./registry";
import { createDirectSecretLaunchRequest } from "./triggerParser";
import type {
  MinigameMountContext,
  SecretGameDefinition,
  SecretLaunchDecision,
} from "./types";

export type LegacyLaunchSource = "legacy-launcher" | "hidden-ui";

function isLegacySecretGame(game: SecretGameDefinition): boolean {
  return game.kind === "legacy-adapter" && !!game.legacyAdapter;
}

export function listLegacySecretGames(): readonly SecretGameDefinition[] {
  return listSecretGames().filter(isLegacySecretGame);
}

export function getLegacySecretGameByLegacyGameId(legacyGameId: string): SecretGameDefinition | null {
  return (
    listLegacySecretGames().find((game) => game.legacyAdapter?.legacyGameId === legacyGameId) || null
  );
}

export function getLegacyGameDefinition(secretGameId: string): SecretGameDefinition | null {
  const game = getSecretGameById(secretGameId);
  return game && isLegacySecretGame(game) ? game : null;
}

export function getLegacyStorageGameId(secretGameId: string): string | null {
  return getLegacyGameDefinition(secretGameId)?.legacyAdapter?.storageGameId || null;
}

export function buildLegacySecretLaunchDecision(args: {
  secretGameId: string;
  source: LegacyLaunchSource;
  routeKind: MinigameMountContext["routeKind"];
}): SecretLaunchDecision {
  const gameFlags = Object.fromEntries(listSecretGames().map((game) => [game.featureFlag, true]));

  return resolveSecretGameLaunch(
    createDirectSecretLaunchRequest(args.source, { gameId: args.secretGameId }),
    {
      isDevUser: false,
      flags: {
        ...DEFAULT_SECRET_GAME_FLAGS,
        ...gameFlags,
        secretGamesMasterEnabled: true,
        secretGamesLegacyAdaptersEnabled: true,
        secretGamesSandboxEnabled: args.routeKind === "sandbox",
        secretGamesAmbientTriggersEnabled: args.source === "hidden-ui",
      },
      mountContext: {
        routeKind: args.routeKind,
      },
    },
  );
}
