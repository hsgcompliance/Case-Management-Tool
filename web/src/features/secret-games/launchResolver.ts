import { SECRET_GAME_REGISTRY, getSecretGameById } from "./registry";
import { evaluateSecretLaunchBlockers } from "./launchBlockers";
import type {
  SecretGameDefinition,
  SecretLaunchDecision,
  SecretLaunchEnvironment,
  SecretLaunchRequest,
  SecretTrigger,
  SecretTriggerKind,
} from "./types";

function findByTrigger(predicate: (game: SecretGameDefinition, trigger: SecretTrigger) => boolean) {
  for (const game of SECRET_GAME_REGISTRY.all) {
    for (const trigger of game.triggers) {
      if (predicate(game, trigger)) return { game, trigger };
    }
  }
  return { game: null, trigger: null } as const;
}

function pickTriggerForSource(game: SecretGameDefinition, source: SecretTriggerKind, triggerId?: string) {
  if (triggerId) return game.triggers.find((trigger) => trigger.id === triggerId && trigger.kind === source) || null;
  return game.triggers.find((trigger) => trigger.kind === source) || null;
}

function resolveRequestTarget(request: SecretLaunchRequest) {
  if (request.source === "search-exact" && request.command) {
    return findByTrigger(
      (game, trigger) => trigger.kind === "search-exact" && trigger.command?.trim().toLowerCase() === request.command,
    );
  }

  if (request.triggerId) {
    return findByTrigger((game, trigger) => {
      if (request.gameId && game.id !== request.gameId) return false;
      return trigger.id === request.triggerId && trigger.kind === request.source;
    });
  }

  if (request.gameId) {
    const game = getSecretGameById(request.gameId);
    if (!game) return { game: null, trigger: null } as const;
    return {
      game,
      trigger: pickTriggerForSource(game, request.source, request.triggerId),
    } as const;
  }

  return findByTrigger((_game, trigger) => trigger.kind === request.source);
}

export function resolveSecretGameLaunch(
  request: SecretLaunchRequest,
  environment: SecretLaunchEnvironment,
): SecretLaunchDecision {
  const { game, trigger } = resolveRequestTarget(request);
  const { blockers, devOverrideApplied } = evaluateSecretLaunchBlockers({
    request,
    environment,
    game,
    trigger,
  });

  return {
    ok: blockers.length === 0 && !!game,
    request,
    game,
    trigger,
    preferredContainerMode: game?.preferredContainerMode || null,
    allowedContainerModes: game?.allowedContainerModes || [],
    blockers,
    devOverrideApplied,
  };
}
