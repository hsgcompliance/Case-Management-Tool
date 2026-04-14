import type {
  SecretGameDefinition,
  SecretGameFeatureFlags,
  SecretLaunchBlocker,
  SecretLaunchDecision,
  SecretLaunchEnvironment,
  SecretLaunchRequest,
  SecretTrigger,
} from "./types";

export const DEFAULT_SECRET_GAME_FLAGS: SecretGameFeatureFlags = {
  secretGamesMasterEnabled: false,
  secretGamesSandboxEnabled: false,
  secretGamesLegacyAdaptersEnabled: false,
  secretGamesCustomerPageEnabled: false,
  secretGamesAmbientTriggersEnabled: false,
  secretGamesKillSwitch: false,
};

function blocker(
  code: SecretLaunchBlocker["code"],
  reason: string,
  bypassableWithDev: boolean,
): SecretLaunchBlocker {
  return { code, reason, bypassableWithDev };
}

function isBypassApplied(request: SecretLaunchRequest, environment: SecretLaunchEnvironment) {
  return request.devOverrideRequested === true && environment.isDevUser;
}

function uniqueBlockers(blockers: SecretLaunchBlocker[]) {
  const seen = new Set<string>();
  return blockers.filter((entry) => {
    if (seen.has(entry.code)) return false;
    seen.add(entry.code);
    return true;
  });
}

export function evaluateSecretLaunchBlockers(args: {
  request: SecretLaunchRequest;
  environment: SecretLaunchEnvironment;
  game: SecretGameDefinition | null;
  trigger: SecretTrigger | null;
}): Pick<SecretLaunchDecision, "blockers" | "devOverrideApplied"> {
  const { request, environment, game, trigger } = args;
  const flags = environment.flags;
  const blockers: SecretLaunchBlocker[] = [];
  const activeFlagBlockers = new Set<string>();

  if (flags.secretGamesKillSwitch) {
    blockers.push(blocker("kill-switch-active", "Secret-games kill switch is active.", false));
  }
  if (!flags.secretGamesMasterEnabled) {
    blockers.push(blocker("master-disabled", "Secret-games master flag is disabled.", false));
  }
  if (!game) {
    blockers.push(blocker("game-not-found", "No registered secret game matched this request.", false));
  }
  if (!trigger) {
    blockers.push(blocker("trigger-not-found", "No registered trigger matched this request.", false));
  }
  if (request.devOverrideRequested && !environment.isDevUser) {
    blockers.push(blocker("dev-override-disallowed", "Dev override requires a dev-only context.", false));
  }

  if (environment.mountContext.routeKind === "sandbox" && !flags.secretGamesSandboxEnabled) {
    blockers.push(blocker("sandbox-disabled", "Sandbox flag is disabled.", true));
    activeFlagBlockers.add("secretGamesSandboxEnabled");
  }
  if (environment.mountContext.routeKind === "customer-card" && !flags.secretGamesCustomerPageEnabled) {
    blockers.push(blocker("customer-page-disabled", "Customer-page integration is disabled.", true));
    activeFlagBlockers.add("secretGamesCustomerPageEnabled");
  }
  if (request.source === "legacy-launcher" && !flags.secretGamesLegacyAdaptersEnabled) {
    blockers.push(blocker("legacy-adapters-disabled", "Legacy adapters are disabled.", true));
    activeFlagBlockers.add("secretGamesLegacyAdaptersEnabled");
  }
  if (
    (request.source === "konami" || request.source === "hidden-ui") &&
    environment.mountContext.routeKind !== "sandbox" &&
    !flags.secretGamesAmbientTriggersEnabled
  ) {
    blockers.push(blocker("ambient-triggers-disabled", "Ambient secret-game triggers are disabled.", true));
    activeFlagBlockers.add("secretGamesAmbientTriggersEnabled");
  }
  if (game && !flags[game.featureFlag] && !activeFlagBlockers.has(game.featureFlag)) {
    blockers.push(
      blocker("game-feature-disabled", `Feature flag "${game.featureFlag}" is disabled for this game.`, true),
    );
  }

  const deduped = uniqueBlockers(blockers);
  const canBypass = isBypassApplied(request, environment);
  const effectiveBlockers = canBypass ? deduped.filter((entry) => !entry.bypassableWithDev) : deduped;
  const devOverrideApplied = canBypass && deduped.length !== effectiveBlockers.length;

  return {
    blockers: effectiveBlockers,
    devOverrideApplied,
  };
}
