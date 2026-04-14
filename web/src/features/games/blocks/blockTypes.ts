// web/src/features/games/blocks/blockTypes.ts
// Types for the customer-card block layer game system.

export type BlockMode =
  | "normal"      // default — faint glow outline
  | "cracked"     // took hits — crack overlay, red tint at low HP
  | "shaking"     // transient: shake animation playing on the DOM element
  | "dissolving"  // transient: blur/fade out animation
  | "fallen"      // card fell off screen, ghost dashed outline remains
  | "farming"     // card is hosting farm plots
  | "character"   // card dissolved into a humanoid sprite
  | "error";      // transient: fake error alert flashing

export type CropType = "wheat" | "carrot" | "flower" | "mushroom";

export interface FarmPlot {
  id: string;
  crop: CropType;
  plantedAt: number;   // ms epoch
  matureAt: number;    // ms epoch
  harvested: boolean;
}

export interface BlockRecord {
  blockId: string;
  mode: BlockMode;
  hp: number;               // 1–3; reaches 0 → dissolve → character
  farmPlots: FarmPlot[];
  lastInteractedAt: number; // ms epoch
  characterSeed?: number;   // deterministic appearance seed
  errorMessage?: string;    // set during "error" mode
}

export type BlockAction =
  | { type: "hit";       blockId: string }
  | { type: "farm";      blockId: string }
  | { type: "tend";      blockId: string }    // harvest ready crops, plant new
  | { type: "error";     blockId: string; message?: string }
  | { type: "fall";      blockId: string }
  | { type: "reset";     blockId: string }
  | { type: "character"; blockId: string }

// ─── Constants ────────────────────────────────────────────────────────────────

export const INITIAL_HP = 3;

export const CROP_MATURE_MS: Record<CropType, number> = {
  wheat:    4 * 3_600_000,   // 4h
  carrot:   8 * 3_600_000,   // 8h
  flower:   2 * 3_600_000,   // 2h
  mushroom: 24 * 3_600_000,  // 24h
};

export const CROP_EMOJI: Record<CropType, string> = {
  wheat: "🌾", carrot: "🥕", flower: "🌸", mushroom: "🍄",
};

export const ALL_CROPS: CropType[] = ["wheat", "carrot", "flower", "mushroom"];

export const FAKE_ERRORS: string[] = [
  "CRITICAL: case overload detected",
  "null pointer in feelings.ts",
  "Stack overflow: too much coffee",
  "BSOD: too many tabs open",
  "Error 418: I'm a teapot",
  "Warning: memory leak in care_capacity",
  "Segfault in form_420B.pdf",
  "PANIC: compassion buffer full",
  "ERR_UNKNOWN: vibes misaligned",
  "OutOfMemoryError: forgot lunch again",
  "Fatal: mainThread not sleeping enough",
  "UnhandledRejection: meeting ran long",
];
