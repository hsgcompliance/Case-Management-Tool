"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import QuickBreakModal from "@features/games/QuickBreakModal";
import { useGameMiniPlayer } from "@features/games/GameMiniPlayerContext";
import { GAME_REGISTRY } from "@features/games/registry";
import SecretOverlayGameHost from "@features/secret-games/SecretOverlayGameHost";
import { listSecretGames } from "@features/secret-games";

const TYPED_OVERLAY_GAMES = listSecretGames().filter((game) => game.allowedContainerModes.includes("overlay"));

export default function SecretGamesOverlayPage() {
  const searchParams = useSearchParams();
  const { openMiniPlayer, closeMiniPlayer, state } = useGameMiniPlayer();
  const [quickBreakOpen, setQuickBreakOpen] = React.useState(false);
  const [typedOverlayOpen, setTypedOverlayOpen] = React.useState(false);
  const [activeTypedGameId, setActiveTypedGameId] = React.useState<string>("necromancer");
  const requestedGameId = searchParams.get("game");

  React.useEffect(() => {
    if (!requestedGameId || !TYPED_OVERLAY_GAMES.some((game) => game.id === requestedGameId)) return;
    setActiveTypedGameId(requestedGameId);
    setTypedOverlayOpen(true);
  }, [requestedGameId]);

  return (
    <>
      <QuickBreakModal open={quickBreakOpen} onClose={() => setQuickBreakOpen(false)} />
      <SecretOverlayGameHost
        gameId={activeTypedGameId}
        open={typedOverlayOpen}
        availableWidth={1280}
        availableHeight={720}
        onOpenChange={setTypedOverlayOpen}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Typed Overlay Host</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Launch immersive secret games through the shared typed overlay host. This is the sandbox path for
              `necromancer` and `asteroids`, separate from the legacy mini-player.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTypedOverlayOpen(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Force close typed host
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Typed Overlay Launch Controls</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {TYPED_OVERLAY_GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => {
                setActiveTypedGameId(game.id);
                setTypedOverlayOpen(true);
              }}
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {game.presentation}
              </div>
              <div className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">{game.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{game.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Legacy Overlay and Modal Stress Tests</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              The existing floating mini-player still stays available here for drag, resize, celebration, and
              close/restore verification while the typed overlay path grows beside it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQuickBreakOpen(true)}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-400"
            >
              Quick-break shim
            </button>
            <button
              type="button"
              onClick={closeMiniPlayer}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Force close legacy host
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Legacy Launch Controls</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {GAME_REGISTRY.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => openMiniPlayer(game.id)}
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="text-2xl leading-none">{game.icon}</div>
              <div className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">{game.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{game.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Overlay Host Snapshot</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {JSON.stringify(
              {
                typedOverlayOpen,
                activeTypedGameId,
              },
              null,
              2,
            )}
          </pre>
          <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {JSON.stringify(state, null, 2)}
          </pre>
        </div>
      </section>
    </>
  );
}
