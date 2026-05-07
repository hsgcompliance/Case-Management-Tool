import { listSecretGames } from "./registry";
import type { SecretLaunchDecision, SecretLaunchEnvironment, SecretLaunchRequest } from "./types";

export const SANDBOX_SECRET_GAME_FLAGS = {
  secretGamesMasterEnabled: true,
  secretGamesSandboxEnabled: true,
  secretGamesLegacyAdaptersEnabled: true,
  secretGamesCustomerPageEnabled: false,
  secretGamesAmbientTriggersEnabled: true,
  secretGamesKillSwitch: false,
  ...Object.fromEntries(listSecretGames().map((game) => [game.featureFlag, true])),
} as const;

export function createSandboxLaunchEnvironment(): SecretLaunchEnvironment {
  return {
    isDevUser: true,
    flags: {
      ...SANDBOX_SECRET_GAME_FLAGS,
      secretGamesSandboxEnabled: true,
    },
    mountContext: {
      routeKind: "sandbox",
      featureFlags: {},
    },
  };
}

export function buildSandboxLaunchHref(args: {
  decision: SecretLaunchDecision;
  request: SecretLaunchRequest;
  fallbackCustomerId?: string | null;
}): string | null {
  const { decision, request, fallbackCustomerId } = args;
  if (!decision.ok || !decision.game) return null;

  const params = new URLSearchParams();
  params.set("game", decision.game.id);
  if (request.source) params.set("source", request.source);
  if (request.triggerId) params.set("triggerId", request.triggerId);
  if (request.command) params.set("command", request.command);
  if (request.devOverrideRequested) params.set("dev", "1");

  if (fallbackCustomerId) {
    params.set("customer", fallbackCustomerId);
  }
  return `/dev/secret-games?${params.toString()}`;
}
