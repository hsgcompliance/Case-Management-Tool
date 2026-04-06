"use client";

import React from "react";
import { GAME_REGISTRY } from "./registry";
import { useGameMiniPlayer } from "./GameMiniPlayer";

/**
 * Discrete folder-style arcade launcher.
 * Renders as a path widget: \Arcade\ → each game opens as a mini-player popup.
 * Runner is excluded since it lives as the actual page.
 */
export function ArcadeFolder() {
  const [open, setOpen] = React.useState(false);
  const { openMiniPlayer } = useGameMiniPlayer();
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const games = GAME_REGISTRY.filter((g) => g.id !== "runner");

  return (
    <div ref={ref} className="select-none font-mono text-sm">
      {/* Folder header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-slate-700/50 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-400 backdrop-blur-sm transition-all hover:border-slate-600 hover:bg-slate-800/90 hover:text-slate-200"
      >
        <span className="text-slate-600 transition-transform duration-150" style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▸</span>
        <span className="text-slate-600">\</span>
        <span className="text-amber-400/90">Arcade</span>
        <span className="text-slate-600">\</span>
      </button>

      {/* Game list — expands below */}
      {open && (
        <div className="mt-0.5 overflow-hidden rounded-md border border-slate-700/50 bg-slate-900/85 py-1 backdrop-blur-sm">
          {games.map((game, idx) => {
            const isLast = idx === games.length - 1;
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => {
                  openMiniPlayer(game.id);
                  setOpen(false);
                }}
                className="group flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-slate-500 transition-colors hover:bg-slate-700/40 hover:text-slate-200"
              >
                <span className="text-slate-700">{isLast ? "└" : "├"}</span>
                <span>{game.icon}</span>
                <span className="text-slate-400 group-hover:text-slate-100 transition-colors">{game.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
