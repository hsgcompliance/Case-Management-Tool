"use client";

import React from "react";
import { ArcadeFolder } from "@features/games/ArcadeFolder";
import GameSelector from "@features/games/GameSelector";
import QuickBreakModal from "@features/games/QuickBreakModal";

export default function SecretGamesLegacyPage() {
  const [shimOpen, setShimOpen] = React.useState(false);

  return (
    <>
      <QuickBreakModal open={shimOpen} onClose={() => setShimOpen(false)} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Legacy Surface Lab</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          This page keeps the current launch surfaces visible in one place while Ticket 8 plans their adapter layer.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Arcade Folder Launcher</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Current folder-style launcher from the home page. Opens mini-player windows without new sandbox glue.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 dark:border-slate-700">
            <ArcadeFolder />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Celebration Shim</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Backward-compat quick-break entrypoint that opens the runner in celebration mode.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShimOpen(true)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-400"
          >
            Trigger quick-break modal
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Embedded Legacy Selector</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Current game selector rendered in-place so legacy behavior can be exercised without leaving the sandbox.
        </p>
        <div className="mt-4">
          <GameSelector embedded initialGameId="runner" />
        </div>
      </section>
    </>
  );
}
