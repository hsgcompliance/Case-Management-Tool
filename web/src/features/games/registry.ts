"use client";

import type React from "react";
import RunnerGame from "./runner/RunnerGame";
import SnakeGame from "./snake/SnakeGame";
import SpaceInvadersGame from "./space/SpaceInvadersGame";
import TowerDefenseGame from "./tower/TowerDefenseGame";

export type GameCardProps = {
  embedded?: boolean;
  renderStyle?: "embedded" | "fullscreen";
  onSessionStart?: () => void;
};

export type GameAccent = {
  border: string;   // full Tailwind class e.g. "border-amber-400"
  ring: string;     // e.g. "ring-amber-400"
  text: string;     // e.g. "text-amber-400"
  bg: string;       // e.g. "bg-amber-500"
  glow: string;     // e.g. "shadow-amber-500/40"
};

export type GameDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: GameAccent;
  Component: React.ComponentType<GameCardProps>;
};

export const GAME_REGISTRY: readonly GameDefinition[] = [
  {
    id: "runner",
    title: "Runner",
    description: "Jump obstacles, chain score, and chase your high score.",
    icon: "🏃",
    accent: {
      border: "border-amber-400",
      ring: "ring-amber-400",
      text: "text-amber-400",
      bg: "bg-amber-500",
      glow: "shadow-amber-500/40",
    },
    Component: RunnerGame,
  },
  {
    id: "snake",
    title: "Snake",
    description: "Classic snake with a board that keeps expanding until it fills your window.",
    icon: "🐍",
    accent: {
      border: "border-emerald-400",
      ring: "ring-emerald-400",
      text: "text-emerald-400",
      bg: "bg-emerald-500",
      glow: "shadow-emerald-500/40",
    },
    Component: SnakeGame,
  },
  {
    id: "space-invaders",
    title: "1945",
    description: "Aerial shooter — survive enemy waves, dodge bullets, beat the boss.",
    icon: "✈️",
    accent: {
      border: "border-violet-400",
      ring: "ring-violet-400",
      text: "text-violet-400",
      bg: "bg-violet-500",
      glow: "shadow-violet-500/40",
    },
    Component: SpaceInvadersGame,
  },
  {
    id: "tower-defense",
    title: "Tower Defense",
    description: "Endless lane defense with bosses, upgrades, map themes, and speed controls.",
    icon: "🏰",
    accent: {
      border: "border-sky-400",
      ring: "ring-sky-400",
      text: "text-sky-400",
      bg: "bg-sky-500",
      glow: "shadow-sky-500/40",
    },
    Component: TowerDefenseGame,
  },
] as const;

export function getGameById(gameId: string): GameDefinition {
  return (GAME_REGISTRY.find((g) => g.id === gameId) ?? GAME_REGISTRY[0]) as GameDefinition;
}
