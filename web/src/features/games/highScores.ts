// web/src/features/games/highScores.ts
// Flexible per-game metadata storage backed by userExtras.game_meta.
// Each game gets a GameRecord keyed by a stable game ID string.
// Games that only need a high score use getHighScore / buildHighScoreUpdate.
// Games that carry richer cross-session state use getGameRecord / buildGameRecordUpdate.

import type { TUserGameRecord, TUserGameMeta } from "@hdb/contracts";

export type GameRecord = TUserGameRecord;
export type GameMeta = TUserGameMeta;

// ─── Game ID constants ────────────────────────────────────────────────────────

export const GAME_IDS = {
  runner:       "runner",
  snake:        "snake",
  spaceInvaders:"space_invaders",
  towerDefense: "tower_defense",
  bugGame:      "bug_game",
} as const;

export type GameId = (typeof GAME_IDS)[keyof typeof GAME_IDS];

// ─── Legacy key map (old gameHighScores → new game ID) ───────────────────────

const LEGACY_SCORE_KEY: Record<string, string> = {
  runner:        "runner",
  snake:         "snake",
  space_invaders:"space_invaders",
  tower_defense: "tower_defense_round",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type UserLike = { extras?: Record<string, unknown> | null } | null | undefined;

function getRawMeta(me: UserLike): GameMeta {
  const extras = me?.extras as Record<string, unknown> | undefined;
  const meta = extras?.game_meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as GameMeta;
  }
  return {};
}

/** Full record for a game, with legacy migration fallback. */
export function getGameRecord(me: UserLike, gameId: string): GameRecord {
  const meta = getRawMeta(me);
  const record = meta[gameId];
  if (record && typeof record === "object" && !Array.isArray(record)) {
    return record as GameRecord;
  }

  // Legacy migration: pull from old gameHighScores field
  const extras = me?.extras as Record<string, unknown> | undefined;
  const oldScores = extras?.gameHighScores as Record<string, number> | undefined;
  if (oldScores) {
    const legacyKey = LEGACY_SCORE_KEY[gameId];
    const legacyScore = legacyKey != null ? oldScores[legacyKey] : undefined;
    if (typeof legacyScore === "number") return { highScore: legacyScore };
  }

  // Runner legacy: quickBreakHighScore
  if (gameId === GAME_IDS.runner) {
    const legacy = extras?.quickBreakHighScore;
    if (typeof legacy === "number" && legacy > 0) return { highScore: legacy };
  }

  return {};
}

/** Convenience: just the high score number. */
export function getHighScore(me: UserLike, gameId: string, fallback = 0): number {
  const score = getGameRecord(me, gameId).highScore;
  return typeof score === "number" ? score : fallback;
}

/** Build an extras patch that merges `patch` into the existing game record. */
export function buildGameRecordUpdate(
  me: UserLike,
  gameId: string,
  patch: Partial<GameRecord>,
): { game_meta: GameMeta } {
  const currentMeta = getRawMeta(me);
  const currentRecord = getGameRecord(me, gameId);
  const merged: GameRecord = { ...currentRecord, ...patch };
  return { game_meta: { ...currentMeta, [gameId]: merged } };
}

/**
 * Build a high-score-only update. Returns null if `candidate` is not a new record,
 * so callers can skip the network call.
 */
export function buildHighScoreUpdate(
  me: UserLike,
  gameId: string,
  candidate: number,
): { game_meta: GameMeta } | null {
  const newScore = Math.floor(candidate);
  if (!Number.isFinite(newScore) || newScore <= 0) return null;
  const current = getGameRecord(me, gameId);
  if (newScore <= (current.highScore ?? 0)) return null;
  return buildGameRecordUpdate(me, gameId, { highScore: newScore });
}

// ─── Backward-compat shims (old callers migrated below) ───────────────────────

/** @deprecated Use getHighScore(me, GAME_IDS.xxx) */
export const GAME_SCORE_KEYS = {
  runner:             GAME_IDS.runner,
  snake:              GAME_IDS.snake,
  spaceInvaders:      GAME_IDS.spaceInvaders,
  towerDefenseRound:  GAME_IDS.towerDefense,
} as const;

/** @deprecated Use getHighScore() */
export function getGameHighScore(me: UserLike, gameId: string, fallback = 0): number {
  return getHighScore(me, gameId, fallback);
}
