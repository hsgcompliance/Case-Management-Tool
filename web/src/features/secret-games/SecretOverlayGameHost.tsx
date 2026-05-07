"use client";

import React from "react";
import { getSecretContainerStateClasses, resolveSecretContainerMode } from "./containerResolver";
import { getSecretGameById } from "./registry";
import { getSecretGameRuntimeComponent } from "./runtimeRegistry";
import type { MinigameMountContext } from "./types";

type SecretOverlayGameHostProps = {
  gameId: string | null;
  open: boolean;
  availableWidth: number;
  availableHeight: number;
  onOpenChange: (next: boolean) => void;
};

export function createOverlayMountContext(args: {
  availableWidth: number;
  availableHeight: number;
}): MinigameMountContext {
  return {
    routeKind: "overlay-host",
    availableWidth: args.availableWidth,
    availableHeight: args.availableHeight,
    featureFlags: {},
  };
}

export function SecretOverlayGameHost({
  gameId,
  open,
  availableWidth,
  availableHeight,
  onOpenChange,
}: SecretOverlayGameHostProps) {
  const game = React.useMemo(() => (gameId ? getSecretGameById(gameId) : null), [gameId]);
  const runtimeComponent = React.useMemo(() => (game ? getSecretGameRuntimeComponent(game.id) : null), [game]);
  const mountContext = React.useMemo(
    () =>
      createOverlayMountContext({
        availableWidth,
        availableHeight,
      }),
    [availableHeight, availableWidth],
  );
  const resolution = React.useMemo(
    () =>
      game
        ? resolveSecretContainerMode({
            game,
            availableWidth,
            availableHeight,
          })
        : null,
    [availableHeight, availableWidth, game],
  );

  if (!open || !game) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
      <section
        className={[
          "flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 shadow-2xl",
          resolution ? getSecretContainerStateClasses(resolution.mode) : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Typed Overlay Host</div>
            <div className="mt-1 text-lg font-semibold text-white">{game.title}</div>
            <div className="mt-1 text-xs text-slate-400">
              {resolution ? `${resolution.mode} -> ${resolution.fallbackChain.join(" -> ")}` : "No resolution"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="min-h-[560px] flex-1 overflow-auto bg-slate-950">
          {runtimeComponent
            ? React.createElement(runtimeComponent, {
                definition: game,
                mountContext,
                onRequestClose: () => onOpenChange(false),
              })
            : (
              <div className="flex min-h-[560px] items-center justify-center px-6 text-sm text-slate-400">
                No typed overlay runtime is registered for this game yet.
              </div>
            )}
        </div>
      </section>
    </div>
  );
}

export default SecretOverlayGameHost;
