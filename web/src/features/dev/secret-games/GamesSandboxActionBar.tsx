"use client";
// web/src/features/dev/secret-games/GamesSandboxActionBar.tsx
// Action bar for the secret-games lab.
// The bug game has been intentionally siloed from this page so the lab only
// exercises the game systems that still belong to the live app shell.
// Its old fullscreen canvas and DOM-scanning launch path are left out on
// purpose to keep the dev page clean while preserving reusable overlay code.

import React from "react";
import AsteroidFloat from "@features/games/triggers/AsteroidFloat";
import PlantSprout from "@features/games/triggers/PlantSprout";
import SnakeFloat from "@features/games/triggers/SnakeFloat";
import FarmFloat from "@features/games/triggers/FarmFloat";
import AlertBadge from "@features/games/triggers/AlertBadge";
import MoonRise from "@features/games/triggers/MoonRise";
import { useGameMiniPlayer } from "@features/games/GameMiniPlayerContext";
import { toast } from "@lib/toast";
import NecromancerGame, { scanCustomersFromDOM } from "@features/games/necromancer/NecromancerGame";

type AmbientTriggerKey = "asteroid" | "snake" | "moon";
type CardTriggerKey = "plant" | "farm" | "alert";
type TriggerKey = AmbientTriggerKey | CardTriggerKey;

const AMBIENT_TRIGGER_DEFS: { id: AmbientTriggerKey; emoji: string; label: string }[] = [
  { id: "asteroid", emoji: "☄️", label: "Asteroid" },
  { id: "snake", emoji: "🐍", label: "Snake" },
  { id: "moon", emoji: "🌕", label: "Moon" },
];

const CARD_TRIGGER_DEFS: { id: CardTriggerKey; emoji: string; label: string }[] = [
  { id: "plant", emoji: "🌱", label: "Plant" },
  { id: "farm", emoji: "🚜", label: "Farm" },
  { id: "alert", emoji: "⚠️", label: "Alert" },
];

const MINI_PLAYER_DEFS: { gameId: string; label: string }[] = [
  { gameId: "runner", label: "Runner" },
  { gameId: "snake", label: "Snake" },
  { gameId: "space-invaders", label: "1945" },
  { gameId: "tower-defense", label: "Tower" },
];

const IMMERSIVE_DEFS: { id: string; label: string; available: boolean; hint?: string }[] = [
  { id: "necromancer", label: "Necromancer", available: true, hint: "triggers Moon Rise" },
  { id: "asteroids", label: "Asteroids", available: false, hint: "prototype, not playable" },
];

export default function GamesSandboxActionBar({
  onSettingsOpen,
}: {
  onSettingsOpen: () => void;
}) {
  const { openMiniPlayer } = useGameMiniPlayer();
  const [activeTriggerId, setActiveTriggerId] = React.useState<TriggerKey | null>(null);
  const [necroOpen, setNecroOpen] = React.useState(false);
  const [necroCustomers, setNecroCustomers] = React.useState<ReturnType<typeof scanCustomersFromDOM>>([]);
  const [status, setStatus] = React.useState<string>("");

  const isAnyActive = activeTriggerId !== null || necroOpen;

  const handleFireTrigger = (id: TriggerKey) => {
    setActiveTriggerId(id);
    setStatus(`Trigger: ${id}`);
    setTimeout(() => setActiveTriggerId(null), 22_000);
  };

  const handleAsteroidActivate = React.useCallback(() => {
    setActiveTriggerId(null);
    openMiniPlayer("space-invaders");
    setStatus("Launched: 1945");
  }, [openMiniPlayer]);

  const handlePlantActivate = React.useCallback(() => {
    setActiveTriggerId(null);
    openMiniPlayer("tower-defense");
    setStatus("Launched: Tower Defense");
  }, [openMiniPlayer]);

  const handleSnakeActivate = React.useCallback(() => {
    setActiveTriggerId(null);
    openMiniPlayer("snake");
    setStatus("Launched: Snake");
  }, [openMiniPlayer]);

  const handleMoonActivate = React.useCallback(() => {
    setActiveTriggerId(null);
    const customers = scanCustomersFromDOM();
    setNecroCustomers(customers);
    setNecroOpen(true);
    setStatus("Playing: Necromancer");
  }, []);

  const handleFarmActivate = React.useCallback(() => {
    setActiveTriggerId(null);
    toast("Farm game - prototype, not yet playable", { type: "info" });
    setStatus("Prototype: Farm");
  }, []);

  const handleAlertActivate = React.useCallback(() => {
    setActiveTriggerId(null);
    toast("Broken Data - prototype, not yet playable", { type: "info" });
    setStatus("Prototype: Broken Data");
  }, []);

  const handleMiniPlayerLaunch = (gameId: string) => {
    openMiniPlayer(gameId);
    setStatus(`Launched: ${gameId}`);
  };

  const handleImmersiveLaunch = (id: string) => {
    if (id === "necromancer") {
      handleMoonActivate();
      return;
    }
    const label = IMMERSIVE_DEFS.find((entry) => entry.id === id)?.label ?? id;
    toast(`${label} - immersive overlay game (prototype, not yet playable)`, { type: "info" });
    setStatus(`Prototype: ${label}`);
  };

  return (
    <>
      <AsteroidFloat
        forceShow={activeTriggerId === "asteroid"}
        onActivate={handleAsteroidActivate}
        minIntervalMs={999_999_999}
      />
      <SnakeFloat
        forceShow={activeTriggerId === "snake"}
        onActivate={handleSnakeActivate}
        minIntervalMs={999_999_999}
      />
      <MoonRise
        forceShow={activeTriggerId === "moon"}
        onActivate={handleMoonActivate}
        minIntervalMs={999_999_999}
      />

      <PlantSprout
        forceShow={activeTriggerId === "plant"}
        onActivate={handlePlantActivate}
        minIntervalMs={999_999_999}
      />
      <FarmFloat
        forceShow={activeTriggerId === "farm"}
        onActivate={handleFarmActivate}
        minIntervalMs={999_999_999}
      />
      <AlertBadge
        forceShow={activeTriggerId === "alert"}
        onActivate={handleAlertActivate}
        minIntervalMs={999_999_999}
      />

      {necroOpen && (
        <NecromancerGame
          customers={necroCustomers}
          onEnd={() => {
            setNecroOpen(false);
            setStatus("");
          }}
        />
      )}

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Ambient
            </span>
            {AMBIENT_TRIGGER_DEFS.map((trigger) => (
              <button
                key={trigger.id}
                type="button"
                title={`Fire ${trigger.label} ambient trigger`}
                onClick={() => handleFireTrigger(trigger.id)}
                disabled={isAnyActive}
                className={[
                  "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                  activeTriggerId === trigger.id
                    ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700/60 dark:bg-violet-900/20 dark:text-violet-300"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                <span>{trigger.emoji}</span>
                <span>{trigger.label}</span>
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Card
            </span>
            {CARD_TRIGGER_DEFS.map((trigger) => (
              <button
                key={trigger.id}
                type="button"
                title={`Fire ${trigger.label} card trigger`}
                onClick={() => handleFireTrigger(trigger.id)}
                disabled={isAnyActive}
                className={[
                  "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                  activeTriggerId === trigger.id
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                <span>{trigger.emoji}</span>
                <span>{trigger.label}</span>
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Start
            </span>
            {MINI_PLAYER_DEFS.map((game) => (
              <button
                key={game.gameId}
                type="button"
                title={`Launch ${game.label}`}
                onClick={() => handleMiniPlayerLaunch(game.gameId)}
                disabled={isAnyActive}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {game.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Immersive
            </span>
            {IMMERSIVE_DEFS.map((game) => (
              <button
                key={game.id}
                type="button"
                title={game.hint ? `${game.label} - ${game.hint}` : `Launch ${game.label}`}
                onClick={() => handleImmersiveLaunch(game.id)}
                disabled={isAnyActive}
                className={[
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                  game.available
                    ? "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    : "border-dashed border-slate-300 text-slate-400 hover:border-slate-400 dark:border-slate-700 dark:text-slate-500",
                ].join(" ")}
              >
                {game.label}
                {game.hint && game.available && <span className="ml-1 text-[10px] opacity-50">↗</span>}
                {!game.available && <span className="ml-1 opacity-60">·</span>}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {status && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {status}
              </span>
            )}
            <button
              type="button"
              onClick={onSettingsOpen}
              title="Lab settings"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="7.5" cy="7.5" r="2" />
                <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.7 2.7l1.1 1.1M11.2 11.2l1.1 1.1M11.2 2.7l-1.1 1.1M3.8 11.2l-1.1 1.1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
