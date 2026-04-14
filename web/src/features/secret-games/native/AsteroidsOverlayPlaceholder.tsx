"use client";

import React from "react";
import type { SecretGameRuntimeProps } from "../runtimeRegistry";

type ShieldCard = {
  id: string;
  label: string;
  integrity: number;
};

const INITIAL_CARDS: ShieldCard[] = [
  { id: "card-a", label: "Rivera", integrity: 3 },
  { id: "card-b", label: "Owens", integrity: 2 },
  { id: "card-c", label: "Luna", integrity: 3 },
];

export default function AsteroidsOverlayPlaceholder({ mountContext, onRequestClose }: SecretGameRuntimeProps) {
  const [score, setScore] = React.useState(0);
  const [cards, setCards] = React.useState(INITIAL_CARDS);

  const crackRandomCard = () => {
    setCards((current) => {
      const next = [...current];
      const target = next.find((card) => card.integrity > 0);
      if (!target) return current;
      target.integrity -= 1;
      return next;
    });
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(28,122,196,0.24),_transparent_38%),linear-gradient(180deg,_#07111a_0%,_#04070c_100%)] p-6 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Asteroids Placeholder</div>
            <h2 className="mt-2 text-3xl font-semibold">Overlay defense host scaffold</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              This placeholder keeps overlay registry and host wiring live until the real defense game lands.
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
          <section className="rounded-[24px] border border-sky-900/40 bg-black/30 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Defense Board</div>
                <div className="mt-1 text-lg font-semibold">Score {score}</div>
              </div>
              <div className="text-sm text-slate-400">Click actions simulate incoming hazards</div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={[
                    "rounded-2xl border p-4 text-sm transition",
                    card.integrity > 1
                      ? "border-sky-800 bg-sky-950/20 text-slate-100"
                      : card.integrity === 1
                        ? "border-amber-500/50 bg-amber-500/10 text-slate-100"
                        : "border-rose-500/60 bg-rose-500/10 text-slate-300",
                  ].join(" ")}
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Customer Shield</div>
                  <div className="mt-2 text-lg font-semibold">{card.label}</div>
                  <div className="mt-1 text-xs text-slate-400">Integrity: {card.integrity}/3</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScore((current) => current + 10)}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
              >
                Blast Asteroid
              </button>
              <button
                type="button"
                onClick={crackRandomCard}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Simulate Impact
              </button>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-800 bg-black/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Overlay Notes</div>
            <div className="mt-2 text-lg font-semibold">Reserved for the real canvas host</div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
              <div>Mount context: {mountContext.routeKind}</div>
              <div className="mt-1">Viewport: {mountContext.availableWidth} x {mountContext.availableHeight}</div>
              <div className="mt-1">Alive cards: {cards.filter((card) => card.integrity > 0).length}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
