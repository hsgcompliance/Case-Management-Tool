"use client";
// web/src/features/games/blocks/BlockLayerContext.tsx
// Global context for the customer-card block layer.
// Manages block state, DOM effects, CSS animations, and random events.

import React from "react";
import { useAuth } from "@app/auth/AuthProvider";
import {
  ALL_CROPS,
  CROP_MATURE_MS,
  FAKE_ERRORS,
  INITIAL_HP,
  type BlockMode,
  type BlockRecord,
  type CropType,
  type FarmPlot,
} from "./blockTypes";
import {
  loadBlocks,
  loadBlockStats,
  saveBlocks,
  saveBlockStats,
  type BlockStats,
} from "./blockStore";

// ─── Context value ────────────────────────────────────────────────────────────

export interface BlockLayerContextValue {
  // Read
  blocks: Record<string, BlockRecord>;
  stats: BlockStats;
  // Actions
  hitBlock: (blockId: string) => void;
  farmBlock: (blockId: string) => void;
  tendFarm: (blockId: string) => void;
  errorBlock: (blockId: string, message?: string) => void;
  fallBlock: (blockId: string) => void;
  resetBlock: (blockId: string) => void;
  dissolveToCharacter: (blockId: string) => void;
  // Helpers
  getBlock: (blockId: string) => BlockRecord | null;
  triggerRandomError: () => void;
}

const BlockLayerCtx = React.createContext<BlockLayerContextValue | null>(null);

export function useBlockLayer(): BlockLayerContextValue {
  const ctx = React.useContext(BlockLayerCtx);
  if (!ctx) throw new Error("useBlockLayer must be inside BlockLayerProvider");
  return ctx;
}

/** Safe version — returns null outside provider (e.g. before mount) */
export function useBlockLayerMaybe(): BlockLayerContextValue | null {
  return React.useContext(BlockLayerCtx);
}

// ─── CSS injection ────────────────────────────────────────────────────────────

const BLOCK_CSS = `
  [data-block-id] {
    transition: box-shadow 0.3s ease;
  }
  [data-block-shaking] {
    animation: blkShake 0.55s cubic-bezier(0.36,0.07,0.19,0.97) both !important;
  }
  [data-block-falling] {
    animation: blkFall 1.4s ease-in forwards !important;
    pointer-events: none !important;
  }
  [data-block-dissolving] {
    animation: blkDissolve 1.1s ease-out forwards !important;
    pointer-events: none !important;
  }
  [data-block-error] {
    outline: 3px solid #ef4444 !important;
    outline-offset: 2px !important;
    animation: blkError 2.8s ease-in-out !important;
  }
  [data-block-cracked-1] {
    box-shadow: inset 0 0 0 2px rgba(251,146,60,0.35) !important;
  }
  [data-block-cracked-0] {
    box-shadow: inset 0 0 0 2px rgba(239,68,68,0.5) !important;
    filter: brightness(0.92) saturate(0.7) !important;
  }
  [data-block-farming] {
    box-shadow: inset 0 0 0 2px rgba(34,197,94,0.5) !important;
  }
  [data-block-character] {
    opacity: 0.55 !important;
    filter: grayscale(0.4) !important;
  }
  @keyframes blkShake {
    0%,100% { transform: translateX(0) rotate(0deg); }
    15%     { transform: translateX(-7px) rotate(-1.5deg); }
    30%     { transform: translateX(6px) rotate(1deg); }
    45%     { transform: translateX(-5px) rotate(-0.8deg); }
    60%     { transform: translateX(5px) rotate(0.6deg); }
    75%     { transform: translateX(-3px); }
    90%     { transform: translateX(3px); }
  }
  @keyframes blkFall {
    0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
    30%  { transform: translateY(8px) rotate(3deg) scale(1); opacity: 1; }
    100% { transform: translateY(130vh) rotate(18deg) scale(0.6); opacity: 0; }
  }
  @keyframes blkDissolve {
    0%   { opacity: 1; filter: blur(0); transform: scale(1); }
    40%  { opacity: 0.7; filter: blur(3px); }
    100% { opacity: 0; filter: blur(14px); transform: scale(1.06); }
  }
  @keyframes blkError {
    0%,100%   { outline-color: transparent; background-color: transparent; }
    12%,36%,60% { outline-color: #ef4444; background-color: rgba(239,68,68,0.07); }
    24%,48%,72% { outline-color: transparent; background-color: transparent; }
  }
`;

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function getBlockEl(blockId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
}

function setBlockAttr(blockId: string, attr: string, value: string | null) {
  const el = getBlockEl(blockId);
  if (!el) return;
  if (value === null) el.removeAttribute(attr);
  else el.setAttribute(attr, value);
}

function clearBlockAttrs(blockId: string) {
  const el = getBlockEl(blockId);
  if (!el) return;
  el.removeAttribute("data-block-shaking");
  el.removeAttribute("data-block-falling");
  el.removeAttribute("data-block-dissolving");
  el.removeAttribute("data-block-error");
  el.removeAttribute("data-block-cracked-1");
  el.removeAttribute("data-block-cracked-0");
  el.removeAttribute("data-block-farming");
  el.removeAttribute("data-block-character");
}

function applyPersistentAttr(blockId: string, mode: BlockMode, hp: number) {
  const el = getBlockEl(blockId);
  if (!el) return;
  // Remove all persistent attrs first
  el.removeAttribute("data-block-cracked-1");
  el.removeAttribute("data-block-cracked-0");
  el.removeAttribute("data-block-farming");
  el.removeAttribute("data-block-character");
  if (mode === "cracked" && hp === 2) el.setAttribute("data-block-cracked-1", "");
  if (mode === "cracked" && hp <= 1) el.setAttribute("data-block-cracked-0", "");
  if (mode === "farming") el.setAttribute("data-block-farming", "");
  if (mode === "character") el.setAttribute("data-block-character", "");
}

// ─── Farm helpers ─────────────────────────────────────────────────────────────

function randomCrop(): CropType {
  return ALL_CROPS[Math.floor(Math.random() * ALL_CROPS.length)];
}

function makePlot(): FarmPlot {
  const crop = randomCrop();
  const now = Date.now();
  return {
    id: `plot_${now}_${Math.random().toString(36).slice(2, 7)}`,
    crop,
    plantedAt: now,
    matureAt: now + CROP_MATURE_MS[crop],
    harvested: false,
  };
}

function tendPlots(plots: FarmPlot[]): { next: FarmPlot[]; harvested: number } {
  const now = Date.now();
  let harvested = 0;
  const next = plots.map((p): FarmPlot => {
    if (!p.harvested && p.matureAt <= now) {
      harvested++;
      return { ...p, harvested: true };
    }
    return p;
  });
  // Replace harvested slots with new plants (keep max 4)
  const active = next.filter((p) => !p.harvested).slice(0, 4);
  while (active.length < Math.min(plots.length, 4)) {
    active.push(makePlot());
  }
  return { next: active, harvested };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function BlockLayerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "anon";

  const [blocks, setBlocks] = React.useState<Record<string, BlockRecord>>(() =>
    typeof window !== "undefined" ? loadBlocks(uid) : {}
  );
  const [stats, setStats] = React.useState<BlockStats>(() =>
    typeof window !== "undefined" ? loadBlockStats(uid) : { destroyed: 0, farmed: 0, errored: 0, lastUpdated: 0 }
  );

  // Reload from localStorage when uid changes (login)
  const prevUidRef = React.useRef(uid);
  React.useEffect(() => {
    if (uid !== prevUidRef.current) {
      prevUidRef.current = uid;
      setBlocks(loadBlocks(uid));
      setStats(loadBlockStats(uid));
    }
  }, [uid]);

  // Persist blocks whenever they change
  React.useEffect(() => {
    saveBlocks(uid, blocks);
  }, [uid, blocks]);

  // Persist stats whenever they change
  React.useEffect(() => {
    saveBlockStats(uid, stats);
  }, [uid, stats]);

  // Inject CSS once
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const existing = document.getElementById("block-layer-css");
    if (existing) return;
    const style = document.createElement("style");
    style.id = "block-layer-css";
    style.textContent = BLOCK_CSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Re-apply persistent DOM attrs when blocks change (handles page navigation / new card mounts)
  React.useEffect(() => {
    for (const [blockId, record] of Object.entries(blocks)) {
      applyPersistentAttr(blockId, record.mode, record.hp);
    }
  }, [blocks]);

  // ── Random ambient error (every 8–14 min) ────────────────────────────────

  const statsRef = React.useRef(stats);
  statsRef.current = stats;
  const blocksRef = React.useRef(blocks);
  blocksRef.current = blocks;
  const uidRef = React.useRef(uid);
  uidRef.current = uid;

  const triggerRandomError = React.useCallback(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-block-id]"));
    if (!els.length) return;
    const el = els[Math.floor(Math.random() * els.length)];
    const blockId = el.getAttribute("data-block-id");
    if (!blockId) return;
    const msg = FAKE_ERRORS[Math.floor(Math.random() * FAKE_ERRORS.length)];
    // Fire the error action
    setBlocks((prev) => {
      const rec = prev[blockId] ?? { blockId, mode: "normal", hp: INITIAL_HP, farmPlots: [], lastInteractedAt: Date.now() };
      if (rec.mode === "fallen" || rec.mode === "dissolving") return prev;
      return { ...prev, [blockId]: { ...rec, mode: "error", errorMessage: msg, lastInteractedAt: Date.now() } };
    });
    setStats((s) => ({ ...s, errored: s.errored + 1, lastUpdated: Date.now() }));
    // DOM effect
    setBlockAttr(blockId, "data-block-error", "");
    setTimeout(() => {
      setBlockAttr(blockId, "data-block-error", null);
      setBlocks((prev) => {
        const rec = prev[blockId];
        if (!rec || rec.mode !== "error") return prev;
        return { ...prev, [blockId]: { ...rec, mode: "normal", errorMessage: undefined } };
      });
    }, 3_200);
  }, []);

  React.useEffect(() => {
    function scheduleError() {
      const delay = 8 * 60_000 + Math.random() * 6 * 60_000;
      return window.setTimeout(() => {
        triggerRandomError();
        timerRef.current = scheduleError();
      }, delay);
    }
    const timerRef = { current: scheduleError() };
    return () => window.clearTimeout(timerRef.current);
  }, [triggerRandomError]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const getBlock = React.useCallback((blockId: string): BlockRecord | null => {
    return blocksRef.current[blockId] ?? null;
  }, []);

  const hitBlock = React.useCallback((blockId: string) => {
    setBlocks((prev) => {
      const rec = prev[blockId] ?? { blockId, mode: "normal" as BlockMode, hp: INITIAL_HP, farmPlots: [], lastInteractedAt: 0 };
      if (rec.mode === "fallen" || rec.mode === "dissolving" || rec.mode === "character") return prev;

      const newHp = rec.hp - 1;
      // Shake DOM element
      const el = getBlockEl(blockId);
      if (el) {
        el.setAttribute("data-block-shaking", "");
        setTimeout(() => el.removeAttribute("data-block-shaking"), 600);
      }

      if (newHp <= 0) {
        // Trigger dissolve
        setBlockAttr(blockId, "data-block-dissolving", "");
        setTimeout(() => {
          setBlockAttr(blockId, "data-block-dissolving", null);
          setBlocks((p2) => {
            const r2 = p2[blockId];
            if (!r2) return p2;
            const seed = Math.random();
            applyPersistentAttr(blockId, "character", 0);
            return { ...p2, [blockId]: { ...r2, mode: "character", hp: 0, characterSeed: seed, lastInteractedAt: Date.now() } };
          });
        }, 1_200);
        setStats((s) => ({ ...s, destroyed: s.destroyed + 1, lastUpdated: Date.now() }));
        return { ...prev, [blockId]: { ...rec, mode: "dissolving", hp: 0, lastInteractedAt: Date.now() } };
      }

      const nextMode: BlockMode = newHp <= 2 ? "cracked" : "normal";
      applyPersistentAttr(blockId, nextMode, newHp);
      return { ...prev, [blockId]: { ...rec, mode: nextMode, hp: newHp, lastInteractedAt: Date.now() } };
    });
  }, []);

  const farmBlock = React.useCallback((blockId: string) => {
    setBlocks((prev) => {
      const rec = prev[blockId] ?? { blockId, mode: "normal" as BlockMode, hp: INITIAL_HP, farmPlots: [], lastInteractedAt: 0 };
      if (rec.mode === "fallen" || rec.mode === "dissolving") return prev;
      const plots = rec.farmPlots.length ? rec.farmPlots : [makePlot(), makePlot()];
      applyPersistentAttr(blockId, "farming", rec.hp);
      return { ...prev, [blockId]: { ...rec, mode: "farming", farmPlots: plots, lastInteractedAt: Date.now() } };
    });
    setStats((s) => ({ ...s, farmed: s.farmed + 1, lastUpdated: Date.now() }));
  }, []);

  const tendFarm = React.useCallback((blockId: string) => {
    setBlocks((prev) => {
      const rec = prev[blockId];
      if (!rec || rec.mode !== "farming") return prev;
      const { next } = tendPlots(rec.farmPlots);
      return { ...prev, [blockId]: { ...rec, farmPlots: next, lastInteractedAt: Date.now() } };
    });
  }, []);

  const errorBlock = React.useCallback((blockId: string, message?: string) => {
    const msg = message ?? FAKE_ERRORS[Math.floor(Math.random() * FAKE_ERRORS.length)];
    setBlocks((prev) => {
      const rec = prev[blockId] ?? { blockId, mode: "normal" as BlockMode, hp: INITIAL_HP, farmPlots: [], lastInteractedAt: 0 };
      if (rec.mode === "fallen" || rec.mode === "dissolving") return prev;
      return { ...prev, [blockId]: { ...rec, mode: "error", errorMessage: msg, lastInteractedAt: Date.now() } };
    });
    setStats((s) => ({ ...s, errored: s.errored + 1, lastUpdated: Date.now() }));
    setBlockAttr(blockId, "data-block-error", "");
    setTimeout(() => {
      setBlockAttr(blockId, "data-block-error", null);
      setBlocks((prev) => {
        const rec = prev[blockId];
        if (!rec || rec.mode !== "error") return prev;
        return { ...prev, [blockId]: { ...rec, mode: "normal", errorMessage: undefined } };
      });
    }, 3_200);
  }, []);

  const fallBlock = React.useCallback((blockId: string) => {
    setBlocks((prev) => {
      const rec = prev[blockId] ?? { blockId, mode: "normal" as BlockMode, hp: INITIAL_HP, farmPlots: [], lastInteractedAt: 0 };
      if (rec.mode === "fallen") return prev;
      clearBlockAttrs(blockId);
      setBlockAttr(blockId, "data-block-falling", "");
      setTimeout(() => setBlockAttr(blockId, "data-block-falling", null), 1_500);
      return { ...prev, [blockId]: { ...rec, mode: "fallen", lastInteractedAt: Date.now() } };
    });
  }, []);

  const resetBlock = React.useCallback((blockId: string) => {
    setBlocks((prev) => {
      clearBlockAttrs(blockId);
      const rec: BlockRecord = {
        blockId,
        mode: "normal",
        hp: INITIAL_HP,
        farmPlots: [],
        lastInteractedAt: Date.now(),
      };
      return { ...prev, [blockId]: rec };
    });
  }, []);

  const dissolveToCharacter = React.useCallback((blockId: string) => {
    setBlockAttr(blockId, "data-block-dissolving", "");
    setTimeout(() => {
      setBlockAttr(blockId, "data-block-dissolving", null);
      setBlocks((prev) => {
        const rec = prev[blockId] ?? { blockId, mode: "normal" as BlockMode, hp: 0, farmPlots: [], lastInteractedAt: 0 };
        applyPersistentAttr(blockId, "character", 0);
        return { ...prev, [blockId]: { ...rec, mode: "character", hp: 0, characterSeed: Math.random(), lastInteractedAt: Date.now() } };
      });
    }, 1_200);
  }, []);

  const value = React.useMemo<BlockLayerContextValue>(
    () => ({
      blocks,
      stats,
      getBlock,
      hitBlock,
      farmBlock,
      tendFarm,
      errorBlock,
      fallBlock,
      resetBlock,
      dissolveToCharacter,
      triggerRandomError,
    }),
    [blocks, stats, getBlock, hitBlock, farmBlock, tendFarm, errorBlock, fallBlock, resetBlock, dissolveToCharacter, triggerRandomError],
  );

  return <BlockLayerCtx.Provider value={value}>{children}</BlockLayerCtx.Provider>;
}
