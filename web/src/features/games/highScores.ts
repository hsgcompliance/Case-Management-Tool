"use client";

type UserLike = { extras?: Record<string, unknown> | null } | null | undefined;

export const GAME_SCORE_KEYS = {
  runner: "runner",
  snake: "snake",
  spaceInvaders: "space_invaders",
  towerDefenseRound: "tower_defense_round",
} as const;

export type GameScoreKey = (typeof GAME_SCORE_KEYS)[keyof typeof GAME_SCORE_KEYS];

function readMap(me: UserLike): Record<string, number> {
  const raw = me?.extras && typeof me.extras === "object" ? (me.extras as Record<string, unknown>).gameHighScores : null;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
  }
  return out;
}

export function getGameHighScore(me: UserLike, key: GameScoreKey, fallback = 0) {
  const map = readMap(me);
  const value = map[key];
  return typeof value === "number" ? value : fallback;
}

export function buildHighScoreUpdate(me: UserLike, key: GameScoreKey, candidate: number) {
  const map = readMap(me);
  const prev = typeof map[key] === "number" ? map[key] : 0;
  if (candidate <= prev) return null;
  return { gameHighScores: { ...map, [key]: Math.floor(candidate) } };
}
