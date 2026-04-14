import type { ContainerMode, SecretGameDefinition } from "./types";

export const CONTAINER_PROMOTION_ORDER: readonly ContainerMode[] = [
  "inline",
  "card-expanded",
  "card-focus",
  "modal",
  "overlay",
] as const;

const MODE_SCALE_PRESETS: Record<ContainerMode, { widthScale: number; heightScale: number; minWidth: number; minHeight: number }> = {
  inline: { widthScale: 1, heightScale: 1, minWidth: 0, minHeight: 0 },
  "card-expanded": { widthScale: 1.2, heightScale: 1.15, minWidth: 320, minHeight: 220 },
  "card-focus": { widthScale: 1.45, heightScale: 1.35, minWidth: 420, minHeight: 280 },
  modal: { widthScale: 1.7, heightScale: 1.6, minWidth: 640, minHeight: 420 },
  overlay: { widthScale: 2.1, heightScale: 1.9, minWidth: 960, minHeight: 640 },
};

export type SecretContainerCandidate = {
  mode: ContainerMode;
  width: number;
  height: number;
  fits: boolean;
};

export type SecretContainerResolution = {
  mode: ContainerMode;
  preferredMode: ContainerMode;
  fallbackChain: readonly ContainerMode[];
  candidateDimensions: Readonly<Record<ContainerMode, { width: number; height: number }>>;
  resolvedFromFallback: boolean;
};

function uniqueModes(modes: readonly ContainerMode[]) {
  return Array.from(new Set(modes));
}

export function buildContainerFallbackChain(
  preferredMode: ContainerMode,
  allowedModes: readonly ContainerMode[],
): readonly ContainerMode[] {
  const preferredIndex = CONTAINER_PROMOTION_ORDER.indexOf(preferredMode);
  const tail = CONTAINER_PROMOTION_ORDER.slice(Math.max(0, preferredIndex));
  const chain = [...tail, ...CONTAINER_PROMOTION_ORDER.slice(0, Math.max(0, preferredIndex))];
  return uniqueModes(chain.filter((mode) => allowedModes.includes(mode)));
}

export function getContainerCandidateDimensions(args: {
  availableWidth: number;
  availableHeight: number;
}): Readonly<Record<ContainerMode, { width: number; height: number }>> {
  const { availableWidth, availableHeight } = args;

  return Object.fromEntries(
    CONTAINER_PROMOTION_ORDER.map((mode) => {
      const preset = MODE_SCALE_PRESETS[mode];
      return [
        mode,
        {
          width: Math.max(preset.minWidth, Math.round(availableWidth * preset.widthScale)),
          height: Math.max(preset.minHeight, Math.round(availableHeight * preset.heightScale)),
        },
      ];
    }),
  ) as Readonly<Record<ContainerMode, { width: number; height: number }>>;
}

export function resolveSecretContainerMode(args: {
  game: SecretGameDefinition;
  availableWidth: number;
  availableHeight: number;
}): SecretContainerResolution {
  const { game, availableWidth, availableHeight } = args;
  const fallbackChain = buildContainerFallbackChain(game.preferredContainerMode, game.allowedContainerModes);
  const candidateDimensions = getContainerCandidateDimensions({ availableWidth, availableHeight });

  const firstFit = fallbackChain.find((mode) => {
    const candidate = candidateDimensions[mode];
    return candidate.width >= game.playProfile.minWidth && candidate.height >= game.playProfile.minHeight;
  });

  const resolvedMode =
    firstFit ||
    (game.playProfile.allowsOverlayFallback && game.allowedContainerModes.includes("overlay")
      ? "overlay"
      : fallbackChain[fallbackChain.length - 1] || game.preferredContainerMode);

  return {
    mode: resolvedMode,
    preferredMode: game.preferredContainerMode,
    fallbackChain,
    candidateDimensions,
    resolvedFromFallback: resolvedMode !== game.preferredContainerMode,
  };
}

export function getSecretContainerStateClasses(mode: ContainerMode): string {
  switch (mode) {
    case "inline":
      return "secret-mode-inline";
    case "card-expanded":
      return "secret-mode-card-expanded ring-1 ring-blue-200 dark:ring-blue-900/60";
    case "card-focus":
      return "secret-mode-card-focus ring-2 ring-blue-300 shadow-lg dark:ring-blue-900";
    case "modal":
      return "secret-mode-modal ring-2 ring-violet-300 shadow-xl dark:ring-violet-900";
    case "overlay":
      return "secret-mode-overlay ring-2 ring-fuchsia-300 shadow-2xl dark:ring-fuchsia-900";
    default:
      return "";
  }
}
