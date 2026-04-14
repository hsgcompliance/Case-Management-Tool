"use client";

import React from "react";
import { buildSecretStorageKey, readSecretStorage, writeSecretStorage } from "../storage";
import type { SecretGameRuntimeProps } from "../runtimeRegistry";

type FlipStats = {
  plays: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastResult: "win" | "loss" | null;
};

const INITIAL_STATS: FlipStats = {
  plays: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastResult: null,
};

function createWinningIndex() {
  return Math.floor(Math.random() * 3);
}

export default function FlipGameCard({ definition, mountContext, onRequestClose }: SecretGameRuntimeProps) {
  const storageKey = React.useMemo(
    () => buildSecretStorageKey({ game: definition, mountContext }),
    [definition, mountContext],
  );
  const [stats, setStats] = React.useState<FlipStats>(() => readSecretStorage(storageKey, INITIAL_STATS));
  const [winningIndex, setWinningIndex] = React.useState(() => createWinningIndex());
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    setStats(readSecretStorage(storageKey, INITIAL_STATS));
  }, [storageKey]);

  React.useEffect(() => {
    writeSecretStorage(storageKey, stats);
  }, [stats, storageKey]);

  const resolved = selectedIndex != null;
  const wonRound = selectedIndex != null && selectedIndex === winningIndex;

  const handlePick = (index: number) => {
    if (selectedIndex != null) return;

    setSelectedIndex(index);
    setStats((current) => {
      const nextWins = index === winningIndex ? current.wins + 1 : current.wins;
      const nextStreak = index === winningIndex ? current.currentStreak + 1 : 0;

      return {
        plays: current.plays + 1,
        wins: nextWins,
        currentStreak: nextStreak,
        bestStreak: Math.max(current.bestStreak, nextStreak),
        lastResult: index === winningIndex ? "win" : "loss",
      };
    });
  };

  const shuffleRound = () => {
    setSelectedIndex(null);
    setWinningIndex(createWinningIndex());
  };

  const winRate = stats.plays > 0 ? Math.round((stats.wins / stats.plays) * 100) : 0;

  return (
    <div className="flex h-full flex-col justify-between gap-4 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            Flip
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Find the good side.</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            One card hides the clean record. Tap once and see if you hit it.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestClose}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Close
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => {
          const isSelected = selectedIndex === index;
          const showFace = resolved && (isSelected || index === winningIndex);
          const isWinner = index === winningIndex;

          return (
            <button
              key={index}
              type="button"
              disabled={resolved}
              onClick={() => handlePick(index)}
              className={[
                "group rounded-2xl border p-4 text-left transition-transform",
                resolved
                  ? isWinner
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                    : "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40"
                  : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-amber-300 dark:border-slate-700 dark:bg-slate-900",
              ].join(" ")}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Card {index + 1}
              </div>
              <div className="mt-6 flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-3xl dark:border-slate-700 dark:bg-slate-950">
                {showFace ? (isWinner ? "OK" : "??") : "FLIP"}
              </div>
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {showFace ? (isWinner ? "Clean side found." : "Glitched side.") : "Tap to reveal."}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/80 md:grid-cols-[1fr,auto]">
        <div className="grid gap-2 sm:grid-cols-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Plays</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.plays}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Wins</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.wins}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Streak</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.currentStreak}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Win Rate</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{winRate}%</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {resolved ? (
            <div className={wonRound ? "text-sm font-medium text-emerald-700 dark:text-emerald-300" : "text-sm font-medium text-rose-700 dark:text-rose-300"}>
              {wonRound ? "Round cleared." : "Missed this one."}
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">Three seconds, one tap.</div>
          )}
          <button
            type="button"
            onClick={shuffleRound}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
          >
            {resolved ? "Shuffle" : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
}
