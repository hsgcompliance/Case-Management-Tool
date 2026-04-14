"use client";

import React from "react";
import { buildSecretStorageKey, readSecretStorage, writeSecretStorage } from "../storage";
import type { SecretGameRuntimeProps } from "../runtimeRegistry";

type BrokenDataStats = {
  resolvedRuns: number;
  totalRepairs: number;
  fastestRepairMs: number | null;
};

type BrokenField = {
  id: string;
  label: string;
  value: string;
  corrupted: boolean;
};

const INITIAL_STATS: BrokenDataStats = {
  resolvedRuns: 0,
  totalRepairs: 0,
  fastestRepairMs: null,
};

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 2147483647;
  }
  return hash;
}

function buildBrokenFields(customerId: string, runSeed: number): BrokenField[] {
  const seed = hashSeed(`${customerId}:${runSeed}`);
  const acuity = 20 + (seed % 70);
  const householdSize = 1 + (seed % 5);
  const followUpDay = 10 + (seed % 18);
  const queue = 100 + (seed % 800);

  return [
    { id: "acuity", label: "Acuity", value: String(acuity), corrupted: false },
    { id: "household", label: "Household", value: `${householdSize} people`, corrupted: false },
    { id: "queue", label: "Queue", value: `CM-${queue}`, corrupted: false },
    { id: "follow-up", label: "Follow Up", value: `Apr ${followUpDay}`, corrupted: false },
    { id: "status", label: "Status", value: "stable", corrupted: false },
  ].map((field, index) => {
    const corrupted = ((seed + index * 13) % 5) < 2;
    if (!corrupted) return field;

    if (field.id === "acuity") return { ...field, value: "999", corrupted: true };
    if (field.id === "household") return { ...field, value: "0 people", corrupted: true };
    if (field.id === "queue") return { ...field, value: "null/null", corrupted: true };
    if (field.id === "follow-up") return { ...field, value: "0000-00-00", corrupted: true };
    return { ...field, value: "undefined", corrupted: true };
  });
}

export default function BrokenDataGameCard({ definition, mountContext, onRequestClose }: SecretGameRuntimeProps) {
  const customerId = String(mountContext.customerId || "sandbox-customer");
  const storageKey = React.useMemo(
    () => buildSecretStorageKey({ game: definition, mountContext }),
    [definition, mountContext],
  );
  const [stats, setStats] = React.useState<BrokenDataStats>(() => readSecretStorage(storageKey, INITIAL_STATS));
  const [runSeed, setRunSeed] = React.useState(0);
  const [repaired, setRepaired] = React.useState<string[]>([]);
  const [startedAt, setStartedAt] = React.useState(() => Date.now());

  React.useEffect(() => {
    setStats(readSecretStorage(storageKey, INITIAL_STATS));
  }, [storageKey]);

  React.useEffect(() => {
    writeSecretStorage(storageKey, stats);
  }, [stats, storageKey]);

  const fields = React.useMemo(() => buildBrokenFields(customerId, runSeed), [customerId, runSeed]);
  const corruptedIds = React.useMemo(
    () => fields.filter((field) => field.corrupted).map((field) => field.id),
    [fields],
  );
  const resolved = corruptedIds.length > 0 && corruptedIds.every((id) => repaired.includes(id));

  React.useEffect(() => {
    if (!resolved) return;

    const elapsed = Date.now() - startedAt;
    setStats((current) => ({
      resolvedRuns: current.resolvedRuns + 1,
      totalRepairs: current.totalRepairs + corruptedIds.length,
      fastestRepairMs:
        current.fastestRepairMs == null ? elapsed : Math.min(current.fastestRepairMs, elapsed),
    }));
  }, [corruptedIds.length, resolved, startedAt]);

  const restart = () => {
    setRunSeed((current) => current + 1);
    setRepaired([]);
    setStartedAt(Date.now());
  };

  const handleRepair = (field: BrokenField) => {
    if (!field.corrupted || repaired.includes(field.id) || resolved) return;
    setRepaired((current) => [...current, field.id]);
  };

  return (
    <div className="flex h-full flex-col gap-4 bg-gradient-to-br from-sky-50 via-white to-rose-50 p-4 dark:from-slate-900 dark:via-slate-900 dark:to-rose-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
            Broken Data
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Repair the corrupted rows.</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            The suspicious values are obvious. Tap them to restore the record.
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

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Snapshot
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{customerId}</div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Repairs left: {Math.max(0, corruptedIds.length - repaired.length)}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {fields.map((field) => {
            const isRepaired = repaired.includes(field.id);
            const isBroken = field.corrupted && !isRepaired;

            return (
              <button
                key={field.id}
                type="button"
                onClick={() => handleRepair(field)}
                disabled={!field.corrupted || isRepaired || resolved}
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition",
                  isBroken
                    ? "border-rose-300 bg-rose-50 hover:border-rose-400 dark:border-rose-900/70 dark:bg-rose-950/40"
                    : isRepaired
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950",
                ].join(" ")}
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {field.label}
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {isRepaired ? "Repaired" : field.value}
                  </div>
                </div>
                <div className={isBroken ? "text-xs font-semibold text-rose-700 dark:text-rose-300" : "text-xs text-slate-400 dark:text-slate-500"}>
                  {isBroken ? "Fix" : isRepaired ? "OK" : "Normal"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/80 md:grid-cols-[1fr,auto]">
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Resolved Runs</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.resolvedRuns}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total Repairs</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.totalRepairs}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Fastest Repair</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {stats.fastestRepairMs == null ? "-" : `${(stats.fastestRepairMs / 1000).toFixed(1)}s`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={resolved ? "text-sm font-medium text-emerald-700 dark:text-emerald-300" : "text-sm text-slate-500 dark:text-slate-400"}>
            {resolved ? "Snapshot restored." : "Tap the broken values."}
          </div>
          <button
            type="button"
            onClick={restart}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
          >
            {resolved ? "Inject anomaly" : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
}
