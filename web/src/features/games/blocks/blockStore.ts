// web/src/features/games/blocks/blockStore.ts
// localStorage persistence for per-user block state.

import type { BlockRecord } from "./blockTypes";

const PREFIX = "hdb_blocks_";

export function blockStoreKey(uid: string): string {
  return PREFIX + uid;
}

export function loadBlocks(uid: string): Record<string, BlockRecord> {
  try {
    const raw = localStorage.getItem(blockStoreKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Sanitize: only keep valid records
    const out: Record<string, BlockRecord> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === "object" && "blockId" in v && "mode" in v) {
        out[k] = v as BlockRecord;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveBlocks(uid: string, blocks: Record<string, BlockRecord>): void {
  try {
    // Prune fallen/dissolved blocks older than 7 days so storage stays lean
    const cutoff = Date.now() - 7 * 24 * 3_600_000;
    const pruned: Record<string, BlockRecord> = {};
    for (const [k, v] of Object.entries(blocks)) {
      const isStale =
        (v.mode === "fallen" || v.mode === "dissolving") &&
        v.lastInteractedAt < cutoff;
      if (!isStale) pruned[k] = v;
    }
    localStorage.setItem(blockStoreKey(uid), JSON.stringify(pruned));
  } catch {
    // localStorage unavailable or full — silently ignore
  }
}

// ─── Block stats (separate key from block states) ─────────────────────────────

export interface BlockStats {
  destroyed: number;
  farmed: number;
  errored: number;
  lastUpdated: number;
}

const STATS_PREFIX = "hdb_bstats_";

export function loadBlockStats(uid: string): BlockStats {
  try {
    const raw = localStorage.getItem(STATS_PREFIX + uid);
    if (!raw) return { destroyed: 0, farmed: 0, errored: 0, lastUpdated: 0 };
    return JSON.parse(raw) as BlockStats;
  } catch {
    return { destroyed: 0, farmed: 0, errored: 0, lastUpdated: 0 };
  }
}

export function saveBlockStats(uid: string, stats: BlockStats): void {
  try {
    localStorage.setItem(STATS_PREFIX + uid, JSON.stringify(stats));
  } catch {}
}
