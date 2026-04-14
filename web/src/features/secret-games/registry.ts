import {
  CONTAINER_MODES,
  SECRET_GAME_PRESENTATIONS,
  SECRET_GAME_KINDS,
  SECRET_PERSISTENCE_SCOPES,
  type ContainerMode,
  type SecretGameDefinition,
  type SecretGameRegistry,
  type SecretTrigger,
} from "./types";

const CARD_CONTAINER_MODES: readonly ContainerMode[] = ["inline", "card-expanded", "card-focus"];

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

function validateTrigger(trigger: SecretTrigger, gameId: string) {
  if (!trigger.id.trim()) throw new Error(`Secret game "${gameId}" has a trigger with an empty id.`);
  if (!trigger.description.trim()) {
    throw new Error(`Secret game "${gameId}" has trigger "${trigger.id}" without a description.`);
  }
  if (trigger.kind === "search-exact") {
    const command = normalizeCommand(trigger.command || "");
    if (!command) {
      throw new Error(`Secret game "${gameId}" has search trigger "${trigger.id}" without a command.`);
    }
  }
}

function validateDefinition(definition: SecretGameDefinition) {
  if (!definition.id.trim()) throw new Error("Secret game definition has an empty id.");
  if (!definition.title.trim()) throw new Error(`Secret game "${definition.id}" is missing a title.`);
  if (!definition.description.trim()) {
    throw new Error(`Secret game "${definition.id}" is missing a description.`);
  }
  if (!SECRET_GAME_KINDS.includes(definition.kind)) {
    throw new Error(`Secret game "${definition.id}" uses unsupported kind "${definition.kind}".`);
  }
  if (!SECRET_GAME_PRESENTATIONS.includes(definition.presentation)) {
    throw new Error(
      `Secret game "${definition.id}" uses unsupported presentation "${definition.presentation}".`,
    );
  }
  if (!SECRET_PERSISTENCE_SCOPES.includes(definition.persistenceScope)) {
    throw new Error(
      `Secret game "${definition.id}" uses unsupported persistence scope "${definition.persistenceScope}".`,
    );
  }
  if (!definition.allowedContainerModes.length) {
    throw new Error(`Secret game "${definition.id}" must allow at least one container mode.`);
  }
  if (!definition.allowedContainerModes.every((mode) => CONTAINER_MODES.includes(mode))) {
    throw new Error(`Secret game "${definition.id}" declares an unsupported container mode.`);
  }
  if (!definition.allowedContainerModes.includes(definition.preferredContainerMode)) {
    throw new Error(
      `Secret game "${definition.id}" prefers "${definition.preferredContainerMode}" but does not allow it.`,
    );
  }
  if (definition.playProfile.minWidth <= 0 || definition.playProfile.minHeight <= 0) {
    throw new Error(`Secret game "${definition.id}" must declare positive minimum dimensions.`);
  }
  if (
    definition.playProfile.sessionLengthSeconds.min <= 0 ||
    definition.playProfile.sessionLengthSeconds.max < definition.playProfile.sessionLengthSeconds.min
  ) {
    throw new Error(`Secret game "${definition.id}" has an invalid session-length range.`);
  }
  if (!definition.featureFlag.trim()) {
    throw new Error(`Secret game "${definition.id}" must declare a feature flag.`);
  }
  if (definition.kind === "legacy-adapter") {
    if (!definition.legacyAdapter) {
      throw new Error(`Legacy secret game "${definition.id}" must declare legacy adapter metadata.`);
    }
    if (definition.legacyAdapter.launchHost === "mini-player" && !definition.legacyAdapter.legacyGameId) {
      throw new Error(`Legacy mini-player game "${definition.id}" must declare a legacy game id.`);
    }
  }
  if (definition.presentation === "immersive") {
    const hasCardMode = definition.allowedContainerModes.some((mode) => CARD_CONTAINER_MODES.includes(mode));
    if (hasCardMode) {
      throw new Error(`Immersive secret game "${definition.id}" cannot register card-only container modes.`);
    }
  }
  if (definition.presentation === "card-native" && definition.preferredContainerMode === "overlay") {
    throw new Error(`Card-native secret game "${definition.id}" cannot prefer overlay as its first mount mode.`);
  }

  definition.triggers.forEach((trigger) => validateTrigger(trigger, definition.id));
}

export function createSecretGameRegistry(definitions: readonly SecretGameDefinition[]): SecretGameRegistry {
  const byId = new Map<string, SecretGameDefinition>();
  const searchCommands = new Map<string, string>();
  const triggerIds = new Map<string, string>();

  definitions.forEach((definition) => {
    validateDefinition(definition);

    if (byId.has(definition.id)) {
      throw new Error(`Duplicate secret game id "${definition.id}".`);
    }
    byId.set(definition.id, definition);

    definition.triggers.forEach((trigger) => {
      if (triggerIds.has(trigger.id)) {
        throw new Error(
          `Duplicate secret trigger id "${trigger.id}" on "${definition.id}" and "${triggerIds.get(trigger.id)}".`,
        );
      }
      triggerIds.set(trigger.id, definition.id);

      if (trigger.kind === "search-exact") {
        const command = normalizeCommand(trigger.command || "");
        const existing = searchCommands.get(command);
        if (existing) {
          throw new Error(
            `Duplicate secret search command "${command}" on "${definition.id}" and "${existing}".`,
          );
        }
        searchCommands.set(command, definition.id);
      }
    });
  });

  return {
    all: definitions,
    byId,
  };
}

export const SECRET_GAME_DEFINITIONS = [
  {
    id: "legacy-runner",
    title: "Runner",
    description: "Legacy start-screen runner routed through the secret-games registry.",
    kind: "legacy-adapter",
    presentation: "hybrid",
    allowedContainerModes: ["modal", "overlay"],
    preferredContainerMode: "modal",
    persistenceScope: "user",
    playProfile: {
      minWidth: 580,
      minHeight: 400,
      prefersFocus: true,
      allowsOverlayFallback: true,
      sessionLengthSeconds: { min: 10, max: 90 },
    },
    triggers: [
      {
        id: "legacy-quick-break-runner",
        kind: "legacy-launcher",
        description: "Quick-break and legacy runner launch path.",
      },
    ],
    featureFlag: "secretGamesGameLegacyRunnerEnabled",
    legacyAdapter: {
      launchHost: "mini-player",
      legacyGameId: "runner",
      storageGameId: "runner",
      supportsCelebration: true,
    },
    notes: "Migrated first via QuickBreakModal to remove direct runner launch ownership.",
  },
  {
    id: "legacy-snake",
    title: "Snake",
    description: "Legacy snake arcade entry routed through the secret-games registry.",
    kind: "legacy-adapter",
    presentation: "hybrid",
    allowedContainerModes: ["modal", "overlay"],
    preferredContainerMode: "modal",
    persistenceScope: "user",
    playProfile: {
      minWidth: 580,
      minHeight: 400,
      prefersFocus: false,
      allowsOverlayFallback: true,
      sessionLengthSeconds: { min: 10, max: 90 },
    },
    triggers: [
      {
        id: "legacy-arcade-snake",
        kind: "legacy-launcher",
        description: "Arcade-folder launch for snake.",
      },
      {
        id: "legacy-ambient-snake",
        kind: "hidden-ui",
        description: "Ambient snake floater launch.",
      },
    ],
    featureFlag: "secretGamesGameLegacySnakeEnabled",
    legacyAdapter: {
      launchHost: "mini-player",
      legacyGameId: "snake",
      storageGameId: "snake",
    },
  },
  {
    id: "legacy-space-invaders",
    title: "1945",
    description: "Legacy 1945 arcade entry routed through the secret-games registry.",
    kind: "legacy-adapter",
    presentation: "hybrid",
    allowedContainerModes: ["modal", "overlay"],
    preferredContainerMode: "modal",
    persistenceScope: "user",
    playProfile: {
      minWidth: 580,
      minHeight: 400,
      prefersFocus: false,
      allowsOverlayFallback: true,
      sessionLengthSeconds: { min: 10, max: 90 },
    },
    triggers: [
      {
        id: "legacy-arcade-space-invaders",
        kind: "legacy-launcher",
        description: "Arcade-folder launch for 1945.",
      },
      {
        id: "legacy-ambient-asteroid",
        kind: "hidden-ui",
        description: "Ambient asteroid floater launch.",
      },
    ],
    featureFlag: "secretGamesGameLegacySpaceInvadersEnabled",
    legacyAdapter: {
      launchHost: "mini-player",
      legacyGameId: "space-invaders",
      storageGameId: "space_invaders",
    },
  },
  {
    id: "legacy-tower-defense",
    title: "Tower Defense",
    description: "Legacy tower-defense arcade entry routed through the secret-games registry.",
    kind: "legacy-adapter",
    presentation: "hybrid",
    allowedContainerModes: ["modal", "overlay"],
    preferredContainerMode: "modal",
    persistenceScope: "user",
    playProfile: {
      minWidth: 580,
      minHeight: 400,
      prefersFocus: false,
      allowsOverlayFallback: true,
      sessionLengthSeconds: { min: 10, max: 90 },
    },
    triggers: [
      {
        id: "legacy-arcade-tower-defense",
        kind: "legacy-launcher",
        description: "Arcade-folder launch for tower defense.",
      },
      {
        id: "legacy-ambient-plant",
        kind: "hidden-ui",
        description: "Ambient plant floater launch.",
      },
    ],
    featureFlag: "secretGamesGameLegacyTowerDefenseEnabled",
    legacyAdapter: {
      launchHost: "mini-player",
      legacyGameId: "tower-defense",
      storageGameId: "tower_defense",
    },
  },
  {
    id: "legacy-bug-game",
    title: "Bug Game",
    description: "Legacy fullscreen bug canvas registered for future adapter migration.",
    kind: "legacy-adapter",
    presentation: "immersive",
    allowedContainerModes: ["overlay"],
    preferredContainerMode: "overlay",
    persistenceScope: "user",
    playProfile: {
      minWidth: 960,
      minHeight: 640,
      prefersFocus: true,
      allowsOverlayFallback: true,
      sessionLengthSeconds: { min: 15, max: 90 },
    },
    triggers: [
      {
        id: "legacy-ambient-bug",
        kind: "hidden-ui",
        description: "Ambient bug floater launch.",
      },
    ],
    featureFlag: "secretGamesGameLegacyBugGameEnabled",
    legacyAdapter: {
      launchHost: "overlay-canvas",
      storageGameId: "bug_game",
    },
    notes: "Registered now; actual fullscreen adapter stays for a later host ticket.",
  },
  {
    id: "flip",
    title: "Flip",
    description: "Micro card flip game surface for tiny reversible interactions.",
    kind: "native",
    presentation: "card-native",
    allowedContainerModes: ["inline", "card-expanded", "card-focus"],
    preferredContainerMode: "inline",
    persistenceScope: "user+customer",
    playProfile: {
      minWidth: 260,
      minHeight: 180,
      prefersFocus: false,
      allowsOverlayFallback: false,
      sessionLengthSeconds: { min: 3, max: 10 },
    },
    triggers: [
      {
        id: "search-flip",
        kind: "search-exact",
        command: "flip",
        description: "Exact search launch for the flip minigame.",
      },
      {
        id: "sandbox-flip",
        kind: "sandbox-control",
        description: "Sandbox launch control for flip.",
        devOnly: true,
      },
    ],
    featureFlag: "secretGamesGameFlipEnabled",
    notes: "First native in-card candidate.",
  },
  {
    id: "broken-data",
    title: "Broken Data",
    description: "Card anomaly event where the user fixes a corrupted customer snapshot.",
    kind: "native",
    presentation: "card-native",
    allowedContainerModes: ["card-expanded", "card-focus"],
    preferredContainerMode: "card-expanded",
    persistenceScope: "user+customer",
    playProfile: {
      minWidth: 320,
      minHeight: 220,
      prefersFocus: true,
      allowsOverlayFallback: false,
      sessionLengthSeconds: { min: 5, max: 15 },
    },
    triggers: [
      {
        id: "search-broken-data",
        kind: "search-exact",
        command: "broken data",
        description: "Exact search launch for the broken-data anomaly.",
      },
      {
        id: "sandbox-broken-data",
        kind: "sandbox-control",
        description: "Sandbox launch control for broken data.",
        devOnly: true,
      },
    ],
    featureFlag: "secretGamesGameBrokenDataEnabled",
    notes: "First native anomaly-style card event.",
  },
  {
    id: "farm",
    title: "Farm",
    description: "Persistent customer-scoped farm plot that lives inside expandable cards.",
    kind: "native",
    presentation: "card-native",
    allowedContainerModes: ["card-expanded", "card-focus"],
    preferredContainerMode: "card-expanded",
    persistenceScope: "user+customer",
    playProfile: {
      minWidth: 360,
      minHeight: 260,
      prefersFocus: true,
      allowsOverlayFallback: false,
      sessionLengthSeconds: { min: 5, max: 20 },
    },
    triggers: [
      {
        id: "search-farm",
        kind: "search-exact",
        command: "farm",
        description: "Exact search launch for farm mode.",
      },
      {
        id: "sandbox-farm",
        kind: "sandbox-control",
        description: "Sandbox launch control for farm mode.",
        devOnly: true,
      },
    ],
    featureFlag: "secretGamesGameFarmEnabled",
    notes: "Persistent card-native target after flip and broken data.",
  },
  {
    id: "necromancer",
    title: "Necromancer",
    description: "Wave-based overlay battler that turns the caseload into an army.",
    kind: "native",
    presentation: "immersive",
    allowedContainerModes: ["overlay"],
    preferredContainerMode: "overlay",
    persistenceScope: "user",
    playProfile: {
      minWidth: 960,
      minHeight: 640,
      prefersFocus: true,
      allowsOverlayFallback: true,
      sessionLengthSeconds: { min: 30, max: 90 },
    },
    triggers: [
      {
        id: "search-necromancer",
        kind: "search-exact",
        command: "necromancer",
        description: "Exact search launch for necromancer mode.",
      },
      {
        id: "konami-necromancer",
        kind: "konami",
        description: "Konami-code launch for necromancer mode.",
      },
    ],
    featureFlag: "secretGamesGameNecromancerEnabled",
    notes: "Overlay-first target with no card-native mount path.",
  },
  {
    id: "asteroids",
    title: "Asteroids",
    description: "Overlay defense game where incoming hazards threaten customer cards.",
    kind: "native",
    presentation: "immersive",
    allowedContainerModes: ["overlay"],
    preferredContainerMode: "overlay",
    persistenceScope: "user",
    playProfile: {
      minWidth: 900,
      minHeight: 560,
      prefersFocus: true,
      allowsOverlayFallback: true,
      sessionLengthSeconds: { min: 15, max: 45 },
    },
    triggers: [
      {
        id: "search-asteroids",
        kind: "search-exact",
        command: "asteroids",
        description: "Exact search launch for asteroids mode.",
      },
      {
        id: "hidden-asteroids",
        kind: "hidden-ui",
        description: "Hidden UI launch for asteroids mode.",
      },
    ],
    featureFlag: "secretGamesGameAsteroidsEnabled",
    notes: "Overlay placeholder until dedicated host work lands.",
  },
] as const satisfies readonly SecretGameDefinition[];

export const SECRET_GAME_REGISTRY = createSecretGameRegistry(SECRET_GAME_DEFINITIONS);

export function getSecretGameById(gameId: string): SecretGameDefinition | null {
  return SECRET_GAME_REGISTRY.byId.get(gameId) || null;
}

export function listSecretGames(): readonly SecretGameDefinition[] {
  return SECRET_GAME_REGISTRY.all;
}
