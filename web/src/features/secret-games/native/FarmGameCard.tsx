"use client";

import React from "react";
import {
  FARM_CROP_DEFINITIONS,
  createInitialFarmState,
  getFarmPlotViews,
  getFarmSpeedUpgradeCost,
  getFarmUnlockCost,
  getFarmYieldUpgradeCost,
  plantFarmCrop,
  harvestFarmPlot,
  unlockFarmPlot,
  upgradeFarmSpeed,
  upgradeFarmYield,
  type FarmCropId,
  type FarmState,
} from "../farmState";
import { buildSecretStorageKey, readSecretStorage, writeSecretStorage } from "../storage";
import type { SecretGameRuntimeProps } from "../runtimeRegistry";

const CROP_ORDER = Object.keys(FARM_CROP_DEFINITIONS) as FarmCropId[];

export default function FarmGameCard({ definition, mountContext, onRequestClose }: SecretGameRuntimeProps) {
  const storageKey = React.useMemo(
    () => buildSecretStorageKey({ game: definition, mountContext }),
    [definition, mountContext],
  );
  const [now, setNow] = React.useState(() => Date.now());
  const [state, setState] = React.useState<FarmState>(() => readSecretStorage(storageKey, createInitialFarmState(Date.now())));
  const [selectedCrop, setSelectedCrop] = React.useState<FarmCropId>("carrot");

  React.useEffect(() => {
    setState(readSecretStorage(storageKey, createInitialFarmState(Date.now())));
  }, [storageKey]);

  React.useEffect(() => {
    writeSecretStorage(storageKey, state);
  }, [state, storageKey]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const plotViews = React.useMemo(() => getFarmPlotViews(state, now), [now, state]);
  const nextUnlockCost = getFarmUnlockCost(state.unlockedPlots);
  const nextSpeedCost = getFarmSpeedUpgradeCost(state.speedLevel);
  const nextYieldCost = getFarmYieldUpgradeCost(state.yieldLevel);

  const handlePlotClick = (plotId: string) => {
    const view = plotViews.find((plot) => plot.id === plotId);
    if (!view || view.status === "locked") return;

    const timestamp = Date.now();
    if (view.status === "ready") {
      setState((current) => harvestFarmPlot({ state: current, plotId, now: timestamp }));
      return;
    }

    if (view.status === "empty") {
      setState((current) =>
        plantFarmCrop({
          state: current,
          plotId,
          cropId: selectedCrop,
          now: timestamp,
        }),
      );
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-4 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Farm
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Customer plot scaffold.</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Plant, wait, harvest, and spend gold without touching customer records.
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

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 dark:border-slate-700 dark:bg-slate-900/80 md:grid-cols-[1fr,auto]">
        <div className="grid gap-2 sm:grid-cols-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Gold</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{state.gold}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Plots</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {state.unlockedPlots}/{plotViews.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Speed</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Lv {state.speedLevel}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Yield</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Lv {state.yieldLevel}</div>
          </div>
        </div>

        <div className="text-sm text-slate-500 dark:text-slate-400">
          Customer key: <span className="font-medium text-slate-700 dark:text-slate-200">{mountContext.customerId || "sandbox"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Plant
          </div>
          {CROP_ORDER.map((cropId) => {
            const crop = FARM_CROP_DEFINITIONS[cropId];
            return (
              <button
                key={cropId}
                type="button"
                onClick={() => setSelectedCrop(cropId)}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition",
                  selectedCrop === cropId
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                {crop.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {plotViews.map((plot) => {
            const crop = plot.plantedCrop ? FARM_CROP_DEFINITIONS[plot.plantedCrop] : null;
            return (
              <button
                key={plot.id}
                type="button"
                disabled={plot.status === "locked"}
                onClick={() => handlePlotClick(plot.id)}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  plot.status === "locked"
                    ? "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-600"
                    : plot.status === "ready"
                      ? "border-emerald-300 bg-emerald-50 hover:-translate-y-0.5 dark:border-emerald-800 dark:bg-emerald-950/40"
                      : "border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-950",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {plot.id.replace("-", " ")}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {plot.status === "locked" ? `Unlock ${nextUnlockCost}g` : plot.status}
                  </div>
                </div>
                <div className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {plot.status === "locked"
                    ? "Locked plot"
                    : crop
                      ? crop.label
                      : `Ready for ${FARM_CROP_DEFINITIONS[selectedCrop].label}`}
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {plot.status === "locked"
                    ? "Buy the next customer plot to expand the farm."
                    : plot.status === "empty"
                      ? "Click to plant the selected crop."
                      : plot.status === "ready"
                        ? `Harvest for ${plot.rewardGold} gold.`
                        : `${Math.round(plot.progress * 100)}% grown`}
                </div>
                {plot.status === "growing" ? (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width]"
                      style={{ width: `${Math.round(plot.progress * 100)}%` }}
                    />
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 dark:border-slate-700 dark:bg-slate-900/80 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setState((current) => unlockFarmPlot(current, Date.now()))}
          disabled={state.unlockedPlots >= plotViews.length || state.gold < nextUnlockCost}
          className="rounded-xl border border-slate-300 px-4 py-3 text-left text-sm text-slate-700 transition enabled:hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
        >
          <div className="font-semibold">Unlock Plot</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{nextUnlockCost} gold</div>
        </button>
        <button
          type="button"
          onClick={() => setState((current) => upgradeFarmSpeed(current, Date.now()))}
          disabled={state.gold < nextSpeedCost}
          className="rounded-xl border border-slate-300 px-4 py-3 text-left text-sm text-slate-700 transition enabled:hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
        >
          <div className="font-semibold">Faster Growth</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{nextSpeedCost} gold</div>
        </button>
        <button
          type="button"
          onClick={() => setState((current) => upgradeFarmYield(current, Date.now()))}
          disabled={state.gold < nextYieldCost}
          className="rounded-xl border border-slate-300 px-4 py-3 text-left text-sm text-slate-700 transition enabled:hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
        >
          <div className="font-semibold">Better Yield</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{nextYieldCost} gold</div>
        </button>
      </div>
    </div>
  );
}
