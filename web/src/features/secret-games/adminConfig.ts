import Routes from "@lib/Routes";
import type { SecretGameFeatureFlags } from "./types";
import { listSecretGames } from "./registry";

export const SECRET_GAME_ROUTE_OPTIONS = {
  customers: {
    id: "customers",
    label: "Customers Page",
    description: "Allow launch from the main /customers route.",
    path: Routes.protected.customers(),
    routeKind: "customer-card",
  },
  grants: {
    id: "grants",
    label: "Grants / Programs Page",
    description: "Allow launch from the /grants route.",
    path: Routes.protected.grants(),
    routeKind: "grants",
  },
  home: {
    id: "home",
    label: "Dashboard (Home)",
    description: "Allow launch from the main / dashboard.",
    path: Routes.protected.home(),
    routeKind: "home",
  },
  reports: {
    id: "reports",
    label: "Reports",
    description: "Allow launch from the /reports route.",
    path: Routes.protected.reports(),
    routeKind: "reports",
  },
  all: {
    id: "all",
    label: "All Pages",
    description: "Allow launch from any page in the app.",
    path: "*",
    routeKind: "all",
  },
} as const;

export type SecretGameRouteId = keyof typeof SECRET_GAME_ROUTE_OPTIONS;

export type SecretGamesAdminFlags = {
  masterEnabled: boolean;
  sandboxEnabled: boolean;
  legacyAdaptersEnabled: boolean;
  customerPageEnabled: boolean;
  ambientTriggersEnabled: boolean;
  killSwitch: boolean;
};

export type SecretGameAdminEntry = {
  enabled: boolean;
  allowedRoutes: SecretGameRouteId[];
};

// ─── Ambient Trigger settings ──────────────────────────────────────────────────

export type AmbientTriggerId = "bug" | "asteroid" | "plant" | "snake";

export type AmbientTriggerAdminEntry = {
  enabled: boolean;
  allowedRoutes: SecretGameRouteId[];
  /** Minimum minutes between appearances */
  minIntervalMinutes: number;
  /** Random jitter added on top of minInterval (minutes) */
  jitterMinutes: number;
};

export const AMBIENT_TRIGGER_DEFAULTS: Record<AmbientTriggerId, AmbientTriggerAdminEntry> = {
  bug:      { enabled: true, allowedRoutes: ["customers"], minIntervalMinutes: 10, jitterMinutes: 2  },
  asteroid: { enabled: true, allowedRoutes: ["customers"], minIntervalMinutes: 14, jitterMinutes: 5  },
  plant:    { enabled: true, allowedRoutes: ["customers"], minIntervalMinutes: 12, jitterMinutes: 4  },
  snake:    { enabled: true, allowedRoutes: ["customers"], minIntervalMinutes: 13, jitterMinutes: 4  },
};

export const AMBIENT_TRIGGER_LABELS: Record<AmbientTriggerId, { emoji: string; label: string; hint: string }> = {
  bug:      { emoji: "🪲", label: "Bug (Cockroach)",  hint: "Wanders across the screen; click to play Donkey Kong." },
  asteroid: { emoji: "☄️",  label: "Asteroid",         hint: "Streaks diagonally across the screen; click for Space Invaders." },
  plant:    { emoji: "🌱", label: "Plant Sprout",     hint: "Grows from the bottom edge; click for Tower Defense." },
  snake:    { emoji: "🐍", label: "Snake",             hint: "Slithers across the screen; click to play Snake." },
};

export type SecretGamesAdminConfig = {
  flags: SecretGamesAdminFlags;
  routesEnabled: SecretGameRouteId[];
  games: Record<string, SecretGameAdminEntry>;
  triggers: Record<AmbientTriggerId, AmbientTriggerAdminEntry>;
};

const DEFAULT_SECRET_GAMES_ADMIN_FLAGS: SecretGamesAdminFlags = {
  masterEnabled: false,
  sandboxEnabled: false,
  legacyAdaptersEnabled: false,
  customerPageEnabled: false,
  ambientTriggersEnabled: false,
  killSwitch: false,
};

const DEFAULT_ROUTE_IDS = Object.keys(SECRET_GAME_ROUTE_OPTIONS) as SecretGameRouteId[];

function normalizeRouteIds(value: unknown, fallback: readonly SecretGameRouteId[]): SecretGameRouteId[] {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set<SecretGameRouteId>();
  const normalized: SecretGameRouteId[] = [];

  for (const entry of value) {
    const routeId = String(entry || "").trim() as SecretGameRouteId;
    if (!(routeId in SECRET_GAME_ROUTE_OPTIONS)) continue;
    if (seen.has(routeId)) continue;
    seen.add(routeId);
    normalized.push(routeId);
  }

  return normalized.length ? normalized : [...fallback];
}

function normalizeGameEntry(value: unknown): Partial<SecretGameAdminEntry> {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    allowedRoutes: normalizeRouteIds(record.allowedRoutes, ["customers"]),
  };
}

function normalizeTriggerEntry(value: unknown, fallback: AmbientTriggerAdminEntry): AmbientTriggerAdminEntry {
  if (!value || typeof value !== "object") return { ...fallback };
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    allowedRoutes: normalizeRouteIds(record.allowedRoutes, fallback.allowedRoutes),
    minIntervalMinutes:
      typeof record.minIntervalMinutes === "number" && record.minIntervalMinutes >= 1
        ? Math.round(record.minIntervalMinutes)
        : fallback.minIntervalMinutes,
    jitterMinutes:
      typeof record.jitterMinutes === "number" && record.jitterMinutes >= 0
        ? Math.round(record.jitterMinutes)
        : fallback.jitterMinutes,
  };
}

export function createDefaultSecretGamesAdminConfig(): SecretGamesAdminConfig {
  const games = Object.fromEntries(
    listSecretGames().map((game) => [
      game.id,
      {
        enabled: false,
        allowedRoutes: ["customers"] satisfies SecretGameRouteId[],
      },
    ]),
  );

  return {
    flags: { ...DEFAULT_SECRET_GAMES_ADMIN_FLAGS },
    routesEnabled: normalizeRouteIds(DEFAULT_ROUTE_IDS, ["customers"]),
    games,
    triggers: { ...AMBIENT_TRIGGER_DEFAULTS },
  };
}

export function readSecretGamesAdminConfig(value: unknown): SecretGamesAdminConfig {
  const defaults = createDefaultSecretGamesAdminConfig();
  if (!value || typeof value !== "object") return defaults;

  const record = value as Record<string, unknown>;
  const rawFlags =
    record.flags && typeof record.flags === "object"
      ? (record.flags as Record<string, unknown>)
      : {};
  const rawGames =
    record.games && typeof record.games === "object"
      ? (record.games as Record<string, unknown>)
      : {};

  const rawTriggers =
    record.triggers && typeof record.triggers === "object"
      ? (record.triggers as Record<string, unknown>)
      : {};

  return {
    flags: {
      masterEnabled: rawFlags.masterEnabled === true,
      sandboxEnabled: rawFlags.sandboxEnabled === true,
      legacyAdaptersEnabled: rawFlags.legacyAdaptersEnabled === true,
      customerPageEnabled: rawFlags.customerPageEnabled === true,
      ambientTriggersEnabled: rawFlags.ambientTriggersEnabled === true,
      killSwitch: rawFlags.killSwitch === true,
    },
    routesEnabled: normalizeRouteIds(record.routesEnabled, defaults.routesEnabled),
    games: Object.fromEntries(
      listSecretGames().map((game) => {
        const merged = {
          ...defaults.games[game.id],
          ...normalizeGameEntry(rawGames[game.id]),
        };
        return [
          game.id,
          {
            enabled: merged.enabled === true,
            allowedRoutes: normalizeRouteIds(merged.allowedRoutes, defaults.games[game.id]?.allowedRoutes || ["customers"]),
          },
        ];
      }),
    ),
    triggers: (Object.keys(AMBIENT_TRIGGER_DEFAULTS) as AmbientTriggerId[]).reduce(
      (acc, id) => {
        acc[id] = normalizeTriggerEntry(rawTriggers[id], AMBIENT_TRIGGER_DEFAULTS[id]);
        return acc;
      },
      {} as Record<AmbientTriggerId, AmbientTriggerAdminEntry>,
    ),
  };
}

export function buildSecretGameFeatureFlagsForRoute(
  configValue: SecretGamesAdminConfig | unknown,
  routeId: SecretGameRouteId,
): SecretGameFeatureFlags {
  const config = readSecretGamesAdminConfig(configValue);
  const routeEnabled = config.routesEnabled.includes(routeId);
  const flags: SecretGameFeatureFlags = {
    secretGamesMasterEnabled: config.flags.masterEnabled,
    secretGamesSandboxEnabled: config.flags.sandboxEnabled,
    secretGamesLegacyAdaptersEnabled: config.flags.legacyAdaptersEnabled,
    secretGamesCustomerPageEnabled:
      config.flags.customerPageEnabled &&
      routeEnabled &&
      SECRET_GAME_ROUTE_OPTIONS[routeId].routeKind === "customer-card",
    secretGamesAmbientTriggersEnabled: config.flags.ambientTriggersEnabled,
    secretGamesKillSwitch: config.flags.killSwitch,
  };

  for (const game of listSecretGames()) {
    const gameConfig = config.games[game.id];
    flags[game.featureFlag] =
      gameConfig?.enabled === true &&
      routeEnabled &&
      gameConfig.allowedRoutes.includes(routeId);
  }

  return flags;
}
