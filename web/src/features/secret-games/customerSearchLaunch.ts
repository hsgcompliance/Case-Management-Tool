import { resolveSecretGameLaunch } from "./launchResolver";
import { DEFAULT_SECRET_GAME_FLAGS } from "./launchBlockers";
import { buildSandboxLaunchHref } from "./sandboxLaunch";
import { parseSecretSearchTrigger } from "./triggerParser";
import type {
  SecretGameFeatureFlags,
  SecretLaunchDecision,
  SecretLaunchEnvironment,
  SecretLaunchRequest,
} from "./types";

export const CUSTOMER_SEARCH_SECRET_GAME_FLAGS: SecretGameFeatureFlags = {
  ...DEFAULT_SECRET_GAME_FLAGS,
};

type CustomerSearchSecretLaunchMatch = {
  matched: true;
  request: SecretLaunchRequest;
  decision: SecretLaunchDecision;
};

export type CustomerSearchSecretLaunchResult =
  | {
      matched: false;
      normalizedInput: string;
    }
  | (CustomerSearchSecretLaunchMatch & {
      ok: true;
      href: string;
    })
  | (CustomerSearchSecretLaunchMatch & {
      ok: false;
      message: string;
    });

export function createCustomerSearchSecretLaunchEnvironment(args: {
  isDevUser: boolean;
  userId?: string | null;
  featureFlags?: Partial<SecretGameFeatureFlags>;
}): SecretLaunchEnvironment {
  return {
    isDevUser: args.isDevUser,
    flags: {
      ...CUSTOMER_SEARCH_SECRET_GAME_FLAGS,
      ...args.featureFlags,
    },
    mountContext: {
      routeKind: "customer-card",
      userId: args.userId || undefined,
      featureFlags: {},
    },
  };
}

export function resolveCustomerSearchSecretLaunch(args: {
  input: string;
  isDevUser: boolean;
  userId?: string | null;
  fallbackCustomerId?: string | null;
  featureFlags?: Partial<SecretGameFeatureFlags>;
}): CustomerSearchSecretLaunchResult {
  const parsed = parseSecretSearchTrigger(args.input);
  if (!parsed.matched) {
    return {
      matched: false,
      normalizedInput: parsed.normalizedInput,
    };
  }

  const environment = createCustomerSearchSecretLaunchEnvironment({
    isDevUser: args.isDevUser,
    userId: args.userId,
    featureFlags: args.featureFlags,
  });
  const decision = resolveSecretGameLaunch(parsed.request, environment);

  if (!decision.ok || !decision.game) {
    return {
      matched: true,
      ok: false,
      request: parsed.request,
      decision,
      message: decision.blockers[0]?.reason || "Secret-game launch is unavailable from customer search.",
    };
  }

  const href = buildSandboxLaunchHref({
    decision,
    request: parsed.request,
    fallbackCustomerId: args.fallbackCustomerId,
  });

  if (!href) {
    return {
      matched: true,
      ok: false,
      request: parsed.request,
      decision,
      message: "Secret-game sandbox route could not be resolved.",
    };
  }

  return {
    matched: true,
    ok: true,
    request: parsed.request,
    decision,
    href,
  };
}
