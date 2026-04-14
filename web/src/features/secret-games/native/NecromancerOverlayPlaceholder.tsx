"use client";

import React from "react";
import type { SecretGameRuntimeProps } from "../runtimeRegistry";

const UPGRADE_CHOICES = [
  "Raise one more unit",
  "Bone shield for the front line",
  "Faster wave clear",
  "Heal the entire army",
] as const;

export default function NecromancerOverlayPlaceholder({ mountContext, onRequestClose }: SecretGameRuntimeProps) {
  const [wave, setWave] = React.useState(1);
  const [armySize, setArmySize] = React.useState(3);
  const [pickedUpgrade, setPickedUpgrade] = React.useState<string | null>(null);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(145,30,80,0.28),_transparent_42%),linear-gradient(180deg,_#120b16_0%,_#09070c_100%)] p-6 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-300">Necromancer Placeholder</div>
            <h2 className="mt-2 text-3xl font-semibold">Overlay combat host scaffold</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              This placeholder proves the typed overlay runtime path. The future game can replace this component
              without changing registry, resolver, or host wiring.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <section className="rounded-[24px] border border-rose-900/50 bg-black/30 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Battlefield</div>
                <div className="mt-1 text-lg font-semibold">Wave {wave}</div>
              </div>
              <div className="text-sm text-slate-400">Army size: {armySize}</div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: armySize }, (_, index) => (
                <div
                  key={`unit-${index + 1}`}
                  className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-4 text-sm text-slate-200"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-rose-300">Unit {index + 1}</div>
                  <div className="mt-2 text-lg font-semibold">{index % 2 === 0 ? "Brute" : "Mage"}</div>
                  <div className="mt-1 text-xs text-slate-400">Auto-fight placeholder actor</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setWave((current) => current + 1);
                  setPickedUpgrade(null);
                }}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500"
              >
                Advance Wave
              </button>
              <button
                type="button"
                onClick={() => setArmySize((current) => current + 1)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Raise Unit
              </button>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-800 bg-black/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Upgrade Break</div>
            <div className="mt-2 text-lg font-semibold">Choose one between waves</div>
            <div className="mt-4 space-y-2">
              {UPGRADE_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setPickedUpgrade(choice)}
                  className={[
                    "w-full rounded-xl border px-4 py-3 text-left text-sm transition",
                    pickedUpgrade === choice
                      ? "border-rose-400 bg-rose-500/10 text-white"
                      : "border-slate-800 text-slate-300 hover:bg-slate-900/60",
                  ].join(" ")}
                >
                  {choice}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
              <div>Mount context: {mountContext.routeKind}</div>
              <div className="mt-1">Viewport: {mountContext.availableWidth} x {mountContext.availableHeight}</div>
              <div className="mt-1">Selected upgrade: {pickedUpgrade || "none"}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
