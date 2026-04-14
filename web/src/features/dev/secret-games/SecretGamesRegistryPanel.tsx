"use client";

import React from "react";
import { GAME_REGISTRY } from "@features/games/registry";
import { listSecretGames } from "@features/secret-games";

function modeChip(mode: string) {
  return (
    <span
      key={mode}
      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    >
      {mode}
    </span>
  );
}

export default function SecretGamesRegistryPanel() {
  const secretGames = listSecretGames();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Secret Registry</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Typed registry foundation for the unified secret-games platform. Legacy arcade entries remain listed below
            as a migration reference only.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {secretGames.length} typed entries
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {secretGames.map((game) => (
          <div key={game.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{game.title}</div>
                <code className="text-[11px] text-slate-500 dark:text-slate-400">{game.id}</code>
              </div>
              <div className="flex flex-wrap gap-1">
                {modeChip(game.kind)}
                {modeChip(game.presentation)}
              </div>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{game.description}</p>

            <div className="mt-3 flex flex-wrap gap-1">
              {game.allowedContainerModes.map((mode) => modeChip(mode))}
            </div>

            <div className="mt-3 grid gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <div>
                Preferred:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">{game.preferredContainerMode}</span>
              </div>
              <div>
                Persistence:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">{game.persistenceScope}</span>
              </div>
              <div>
                Trigger count:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">{game.triggers.length}</span>
              </div>
              <div>
                Feature flag:{" "}
                <code className="text-slate-700 dark:text-slate-200">{game.featureFlag}</code>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Legacy Arcade Snapshot</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Current pre-platform games registry. Ticket 8 will adapt migrated paths into the typed runtime.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {GAME_REGISTRY.length} legacy entries
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {GAME_REGISTRY.map((game) => (
            <div key={game.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{game.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{game.title}</div>
                    <code className="text-[11px] text-slate-500 dark:text-slate-400">{game.id}</code>
                  </div>
                </div>
                {modeChip("legacy")}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{game.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
