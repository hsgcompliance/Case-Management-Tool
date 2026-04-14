export const CONTAINER_MODES = [
  "inline",
  "card-expanded",
  "card-focus",
  "modal",
  "overlay",
] as const;

export type ContainerMode = (typeof CONTAINER_MODES)[number];

export const SECRET_GAME_KINDS = ["native", "legacy-adapter"] as const;

export type SecretGameKind = (typeof SECRET_GAME_KINDS)[number];

export const SECRET_PERSISTENCE_SCOPES = [
  "session",
  "user",
  "customer",
  "user+customer",
] as const;

export type SecretPersistenceScope = (typeof SECRET_PERSISTENCE_SCOPES)[number];

export const SECRET_GAME_PRESENTATIONS = ["card-native", "immersive", "hybrid"] as const;

export type SecretGamePresentation = (typeof SECRET_GAME_PRESENTATIONS)[number];

export const SECRET_TRIGGER_KINDS = [
  "search-exact",
  "konami",
  "hidden-ui",
  "sandbox-control",
  "legacy-launcher",
] as const;

export type SecretTriggerKind = (typeof SECRET_TRIGGER_KINDS)[number];

export type SecretTrigger = {
  id: string;
  kind: SecretTriggerKind;
  command?: string;
  description: string;
  devOnly?: boolean;
};

export type SecretLaunchRequest = {
  source: SecretTriggerKind;
  rawInput?: string;
  command?: string;
  triggerId?: string;
  gameId?: string;
  devOverrideRequested?: boolean;
};

export const SECRET_LAUNCH_BLOCKER_CODES = [
  "kill-switch-active",
  "master-disabled",
  "game-not-found",
  "trigger-not-found",
  "dev-override-disallowed",
  "sandbox-disabled",
  "customer-page-disabled",
  "legacy-adapters-disabled",
  "ambient-triggers-disabled",
  "game-feature-disabled",
] as const;

export type SecretLaunchBlockerCode = (typeof SECRET_LAUNCH_BLOCKER_CODES)[number];

export type SecretLaunchBlocker = {
  code: SecretLaunchBlockerCode;
  reason: string;
  bypassableWithDev: boolean;
};

export type SecretGameFeatureFlags = {
  secretGamesMasterEnabled: boolean;
  secretGamesSandboxEnabled: boolean;
  secretGamesLegacyAdaptersEnabled: boolean;
  secretGamesCustomerPageEnabled: boolean;
  secretGamesAmbientTriggersEnabled: boolean;
  secretGamesKillSwitch: boolean;
} & Record<string, boolean>;

export type SecretLaunchEnvironment = {
  isDevUser: boolean;
  flags: SecretGameFeatureFlags;
  mountContext: MinigameMountContext;
};

export type SecretLaunchDecision = {
  ok: boolean;
  request: SecretLaunchRequest;
  game: SecretGameDefinition | null;
  trigger: SecretTrigger | null;
  preferredContainerMode: ContainerMode | null;
  allowedContainerModes: readonly ContainerMode[];
  blockers: readonly SecretLaunchBlocker[];
  devOverrideApplied: boolean;
};

export type MinigamePlayProfile = {
  minWidth: number;
  minHeight: number;
  prefersFocus: boolean;
  allowsOverlayFallback: boolean;
  sessionLengthSeconds: {
    min: number;
    max: number;
  };
};

export type MinigameMountContext = {
  routeKind: "sandbox" | "customer-card" | "overlay-host" | "legacy-host";
  availableWidth?: number;
  availableHeight?: number;
  customerId?: string;
  userId?: string;
  featureFlags?: Record<string, boolean>;
};

export type SecretGameDefinition = {
  id: string;
  title: string;
  description: string;
  kind: SecretGameKind;
  presentation: SecretGamePresentation;
  allowedContainerModes: readonly ContainerMode[];
  preferredContainerMode: ContainerMode;
  persistenceScope: SecretPersistenceScope;
  playProfile: MinigamePlayProfile;
  triggers: readonly SecretTrigger[];
  featureFlag: string;
  legacyGameId?: string;
  legacyAdapter?: {
    launchHost: "mini-player" | "overlay-canvas" | "page";
    legacyGameId?: string;
    storageGameId?: string;
    supportsCelebration?: boolean;
  };
  notes?: string;
};

export type SecretGameRegistry = {
  all: readonly SecretGameDefinition[];
  byId: ReadonlyMap<string, SecretGameDefinition>;
};
