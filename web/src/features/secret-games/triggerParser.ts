import { SECRET_GAME_REGISTRY } from "./registry";
import type { SecretLaunchRequest, SecretTrigger, SecretTriggerKind } from "./types";

export const KONAMI_SEQUENCE = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
] as const;

export type SearchTriggerParseResult =
  | {
      matched: true;
      request: SecretLaunchRequest;
      gameId: string;
      triggerId: string;
      command: string;
    }
  | {
      matched: false;
      reason: "empty" | "not-exact-command";
      normalizedInput: string;
    };

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeKey(value: string): string {
  return normalizeWhitespace(value).replace(/\s+/g, "");
}

function getTriggerCommand(trigger: SecretTrigger) {
  return normalizeWhitespace(trigger.command || "");
}

function getFirstTriggerId(gameId: string, kind: SecretTriggerKind) {
  const game = SECRET_GAME_REGISTRY.byId.get(gameId);
  return game?.triggers.find((trigger) => trigger.kind === kind)?.id || null;
}

export function parseSecretSearchTrigger(input: string): SearchTriggerParseResult {
  const normalizedInput = normalizeWhitespace(input);
  if (!normalizedInput) {
    return { matched: false, reason: "empty", normalizedInput };
  }

  for (const game of SECRET_GAME_REGISTRY.all) {
    for (const trigger of game.triggers) {
      if (trigger.kind !== "search-exact") continue;
      const command = getTriggerCommand(trigger);
      if (normalizedInput === command) {
        return {
          matched: true,
          request: {
            source: "search-exact",
            rawInput: input,
            command,
            gameId: game.id,
            triggerId: trigger.id,
            devOverrideRequested: false,
          },
          gameId: game.id,
          triggerId: trigger.id,
          command,
        };
      }
      if (normalizedInput === `${command} --dev`) {
        return {
          matched: true,
          request: {
            source: "search-exact",
            rawInput: input,
            command,
            gameId: game.id,
            triggerId: trigger.id,
            devOverrideRequested: true,
          },
          gameId: game.id,
          triggerId: trigger.id,
          command,
        };
      }
    }
  }

  return {
    matched: false,
    reason: "not-exact-command",
    normalizedInput,
  };
}

export function createDirectSecretLaunchRequest(
  source: Exclude<SecretTriggerKind, "search-exact">,
  value: { gameId?: string; triggerId?: string; devOverrideRequested?: boolean },
): SecretLaunchRequest {
  const gameId = value.gameId || (value.triggerId ? null : null);
  return {
    source,
    gameId: gameId || undefined,
    triggerId: value.triggerId || (gameId ? getFirstTriggerId(gameId, source) || undefined : undefined),
    devOverrideRequested: value.devOverrideRequested === true,
  };
}

export function advanceKonamiSequence(progress: number, key: string): { progress: number; matched: boolean } {
  const normalizedKey = normalizeKey(key);
  const expected = KONAMI_SEQUENCE[progress];

  if (normalizedKey === expected) {
    const nextProgress = progress + 1;
    if (nextProgress === KONAMI_SEQUENCE.length) {
      return { progress: 0, matched: true };
    }
    return { progress: nextProgress, matched: false };
  }

  if (normalizedKey === KONAMI_SEQUENCE[0]) {
    return { progress: 1, matched: false };
  }

  return { progress: 0, matched: false };
}

export function matchesKonamiSequence(keys: readonly string[]): boolean {
  let progress = 0;
  for (const key of keys) {
    const next = advanceKonamiSequence(progress, key);
    if (next.matched) return true;
    progress = next.progress;
  }
  return false;
}
