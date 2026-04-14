"use client";

import React from "react";
import { GAME_REGISTRY, getGameById, type GameDefinition } from "./registry";
import { useGameMiniPlayer } from "./GameMiniPlayerContext";

export type GameSelectorProps = {
  embedded?: boolean;
  initialGameId?: string;
  renderStyle?: "embedded" | "fullscreen";
  onMinimize?: () => void;
};

function GameCard({
  game,
  active,
  onClick,
  compact = false,
}: {
  game: GameDefinition;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "group relative flex flex-col items-center rounded-xl border-2 transition-all duration-150 select-none",
        compact ? "gap-1.5 p-3" : "gap-2 p-4",
        "bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100",
        active
          ? `${game.accent.border} ring-1 ${game.accent.ring} shadow-lg ${game.accent.glow}`
          : "border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      <span className={compact ? "text-2xl" : "text-4xl leading-none"}>{game.icon}</span>
      <span className={`font-bold leading-tight ${compact ? "text-xs" : "text-sm"}`}>
        {game.title}
      </span>
      {!compact && (
        <span className="text-center text-[11px] leading-snug text-slate-500 dark:text-slate-300">
          {game.description}
        </span>
      )}
      {active && (
        <span
          className={[
            "absolute right-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
            game.accent.bg,
            "text-white",
          ].join(" ")}
        >
          Selected
        </span>
      )}
    </button>
  );
}

export function GameSelector({
  embedded = false,
  initialGameId,
  renderStyle = "embedded",
  onMinimize,
}: GameSelectorProps) {
  const { openMiniPlayer } = useGameMiniPlayer();
  const fullscreen = !embedded && renderStyle === "fullscreen";
  const defaultId =
    initialGameId && getGameById(initialGameId)?.id ? initialGameId : GAME_REGISTRY[0]?.id ?? "runner";
  const [activeGameId, setActiveGameId] = React.useState(defaultId);
  const activeGame = getGameById(activeGameId);

  if (!activeGame) return null;

  return (
    <div
      className={
        fullscreen
          ? "grid h-[calc(100dvh-1rem)] grid-rows-[auto,1fr] gap-3 overflow-hidden"
          : embedded
            ? "space-y-3"
            : "space-y-5"
      }
    >
      {/* Game picker grid */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Choose a game
          </span>
          {onMinimize && (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-white"
              onClick={() => {
                openMiniPlayer(activeGame.id);
                onMinimize();
              }}
            >
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="9" width="10" height="2" rx="1" />
              </svg>
              Pop out
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {GAME_REGISTRY.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              active={game.id === activeGame.id}
              onClick={() => setActiveGameId(game.id)}
            />
          ))}
        </div>
      </div>

      {/* Game viewport */}
      <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white ring-1 ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-700">
        <div className={fullscreen ? "h-full" : undefined}>
          <activeGame.Component embedded={embedded} renderStyle={renderStyle} />
        </div>
      </div>
    </div>
  );
}

export default GameSelector;

/** Compact inline picker used inside the mini player ended-state prompt. */
export function CompactGamePicker({
  currentGameId,
  onPick,
}: {
  currentGameId: string;
  onPick: (gameId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {GAME_REGISTRY.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          active={game.id === currentGameId}
          onClick={() => onPick(game.id)}
          compact
        />
      ))}
    </div>
  );
}
