"use client";

import React from "react";
import { useMe, useUpdateMe, type CompositeUser } from "@hooks/useUsers";
import { GAME_IDS, getGameRecord } from "@features/games/highScores";
import { blockStoreKey, loadBlocks, loadBlockStats } from "@features/games/blocks/blockStore";
import { clearAllSecretStorage, listSecretStorageEntries } from "@features/secret-games";

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function localStatsKey(uid: string) {
  return `hdb_bstats_${uid}`;
}

export default function SecretGamesStoragePanel() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const [snapshotVersion, setSnapshotVersion] = React.useState(0);
  const [status, setStatus] = React.useState<string>("");
  const uid = String((me as CompositeUser | null)?.uid || "");

  const normalizedRecords = React.useMemo(() => {
    const entries = [
      { label: "Runner", gameId: GAME_IDS.runner },
      { label: "Snake", gameId: GAME_IDS.snake },
      { label: "1945", gameId: GAME_IDS.spaceInvaders },
      { label: "Tower Defense", gameId: GAME_IDS.towerDefense },
      { label: "Bug Game", gameId: GAME_IDS.bugGame },
    ];
    return entries.map((entry) => ({
      ...entry,
      record: getGameRecord(me as CompositeUser | null, entry.gameId),
    }));
  }, [me]);

  const localSnapshot = React.useMemo(() => {
    if (typeof window === "undefined") return [];
    const refreshSeed = snapshotVersion;
    void refreshSeed;

    const entries: Array<{ label: string; key: string; parsed: unknown; raw: string | null }> = [
      {
        label: "Runner High Score",
        key: "dino_high_score",
        parsed: window.localStorage.getItem("dino_high_score"),
        raw: window.localStorage.getItem("dino_high_score"),
      },
    ];

    if (uid) {
      entries.push({
        label: "Blocks Prototype State",
        key: blockStoreKey(uid),
        parsed: loadBlocks(uid),
        raw: window.localStorage.getItem(blockStoreKey(uid)),
      });
      entries.push({
        label: "Blocks Prototype Stats",
        key: localStatsKey(uid),
        parsed: loadBlockStats(uid),
        raw: window.localStorage.getItem(localStatsKey(uid)),
      });
    }

    entries.push(
      ...listSecretStorageEntries().map((entry) => ({
        label: "Secret Arcade State",
        key: entry.key,
        parsed: entry.parsed,
        raw: entry.raw,
      })),
    );

    return entries;
  }, [snapshotVersion, uid]);

  const refreshSnapshot = React.useCallback(() => {
    setSnapshotVersion((current) => current + 1);
    setStatus("Refreshed storage snapshot.");
  }, []);

  const clearLocalOnly = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("dino_high_score");
    if (uid) {
      window.localStorage.removeItem(blockStoreKey(uid));
      window.localStorage.removeItem(localStatsKey(uid));
    }
    setSnapshotVersion((current) => current + 1);
    setStatus("Cleared browser-side legacy game keys.");
  }, [uid]);

  const clearSecretNamespace = React.useCallback(() => {
    clearAllSecretStorage();
    setSnapshotVersion((current) => current + 1);
    setStatus("Cleared secretArcade sandbox storage.");
  }, []);

  const resetLegacyExtras = React.useCallback(async () => {
    if (!uid || updateMe.isPending) return;
    setStatus("Resetting legacy user game extras...");
    try {
      await updateMe.mutateAsync({
        game_meta: {},
        gameHighScores: {},
        quickBreakHighScore: 0,
      });
      setSnapshotVersion((current) => current + 1);
      setStatus("Reset current-user legacy game extras.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to reset user extras.");
    }
  }, [uid, updateMe]);

  const extras = (me as CompositeUser | null)?.extras || {};

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Storage Debug</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Current-user only. Customer and compliance records are untouched.
          </p>
        </div>
        <code className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          uid: {uid || "unknown"}
        </code>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={refreshSnapshot}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Refresh snapshot
        </button>
        <button
          type="button"
          onClick={clearLocalOnly}
          className="rounded-md border border-amber-300 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-950/40"
        >
          Reset local only
        </button>
        <button
          type="button"
          onClick={clearSecretNamespace}
          className="rounded-md border border-sky-300 px-3 py-1.5 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-900/60 dark:text-sky-300 dark:hover:bg-sky-950/40"
        >
          Reset secret arcade
        </button>
        <button
          type="button"
          onClick={() => void resetLegacyExtras()}
          disabled={!uid || updateMe.isPending}
          className="rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/40"
        >
          {updateMe.isPending ? "Resetting..." : "Reset user extras games"}
        </button>
      </div>

      {status ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
          {status}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Normalized Game Records
          </h3>
          <div className="mt-2 space-y-2">
            {normalizedRecords.map((entry) => (
              <div key={entry.gameId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.label}</span>
                  <code className="text-[11px] text-slate-500 dark:text-slate-400">{entry.gameId}</code>
                </div>
                <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  {prettyJson(entry.record)}
                </pre>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Raw Current-User Extras
          </h3>
          <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {prettyJson({
              game_meta: (extras as Record<string, unknown>)?.game_meta ?? null,
              gameHighScores: (extras as Record<string, unknown>)?.gameHighScores ?? null,
              quickBreakHighScore: (extras as Record<string, unknown>)?.quickBreakHighScore ?? null,
            })}
          </pre>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Browser Keys
          </h3>
          <div className="mt-2 space-y-2">
            {localSnapshot.map((entry) => (
              <div key={entry.key} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.label}</span>
                  <code className="text-[11px] text-slate-500 dark:text-slate-400">{entry.key}</code>
                </div>
                <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  {prettyJson(entry.parsed)}
                </pre>
                {entry.raw == null ? null : (
                  <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Raw length: {entry.raw.length}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
