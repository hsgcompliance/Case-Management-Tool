"use client";
// web/src/features/games/GameMiniPlayerContext.tsx
// Lightweight context + provider for the mini player state machine.
// Intentionally imports NOTHING from the game registry or game engines —
// this file stays in the main bundle even when games are disabled.

import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MiniScreen = "playing" | "ended" | "locked";

export type MiniPlayerState = {
  open: boolean;
  screen: MiniScreen;
  gameId: string;
  sessionKey: number;
  gamesPlayed: number;
  lockedUntil: number;
  isCelebration: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type DragState = {
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  baseW: number;
  baseH: number;
  dir: "drag" | ResizeDir;
};

export type MiniPlayerContextValue = {
  openMiniPlayer: (gameId: string, opts?: { celebration?: boolean }) => void;
  closeMiniPlayer: () => void;
  state: MiniPlayerState;
  // internal — used by GameMiniPlayerFloat
  handleHeaderClose: () => void;
  handlePlayAgain: () => void;
  handlePickGame: (gameId: string) => void;
  handleEmbeddedSessionStart: () => void;
  handleExit: () => void;
  handleResizeMouseDown: (e: React.MouseEvent, dir: ResizeDir) => void;
  handleHeaderDragMouseDown: (e: React.MouseEvent) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GAMES_PER_BURST = 3;
const LOCKOUT_MS = 60_000;
const MIN_W = 320;
const MIN_H = 260;

// Keep in sync with registry.ts — avoids importing the registry here.
const KNOWN_GAME_IDS = ["runner", "snake", "space-invaders", "tower-defense"] as const;

function normalizeGameId(id: string): string {
  return (KNOWN_GAME_IDS as readonly string[]).includes(id) ? id : "runner";
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_STATE: MiniPlayerState = {
  open: false,
  screen: "playing",
  gameId: "runner",
  sessionKey: 0,
  gamesPlayed: 0,
  lockedUntil: 0,
  isCelebration: false,
  x: 22,
  y: 88,
  width: 580,
  height: 400,
};

// ─── Context ──────────────────────────────────────────────────────────────────

export const MiniPlayerCtx = React.createContext<MiniPlayerContextValue | null>(null);

export function useGameMiniPlayer(): MiniPlayerContextValue {
  const ctx = React.useContext(MiniPlayerCtx);
  if (!ctx) {
    return {
      openMiniPlayer: () => {},
      closeMiniPlayer: () => {},
      state: DEFAULT_STATE,
      handleHeaderClose: () => {},
      handlePlayAgain: () => {},
      handlePickGame: () => {},
      handleEmbeddedSessionStart: () => {},
      handleExit: () => {},
      handleResizeMouseDown: () => {},
      handleHeaderDragMouseDown: () => {},
    };
  }
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function GameMiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<MiniPlayerState>(DEFAULT_STATE);
  const dragRef = React.useRef<DragState | null>(null);
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  function calcGameStart(prev: MiniPlayerState): Pick<MiniPlayerState, "gamesPlayed" | "lockedUntil" | "screen"> {
    const now = Date.now();
    const lockExpired = prev.lockedUntil > 0 && prev.lockedUntil <= now;
    const basePlayed = lockExpired ? 0 : prev.gamesPlayed;
    const newPlayed = basePlayed + 1;
    if (newPlayed >= GAMES_PER_BURST) {
      return { gamesPlayed: newPlayed, lockedUntil: now + LOCKOUT_MS, screen: "locked" };
    }
    return { gamesPlayed: newPlayed, lockedUntil: lockExpired ? 0 : prev.lockedUntil, screen: "playing" };
  }

  const openMiniPlayer = React.useCallback((gameId: string, opts?: { celebration?: boolean }) => {
    const normalized = normalizeGameId(gameId);
    const isCelebration = opts?.celebration ?? false;

    setState((prev) => {
      const { gamesPlayed, lockedUntil, screen } = calcGameStart(prev);

      let { width, height, x, y } = prev;
      if (isCelebration) {
        width = Math.min(800, window.innerWidth - 32);
        height = Math.min(580, window.innerHeight - 32);
        x = Math.round((window.innerWidth - width) / 2);
        y = Math.round((window.innerHeight - height) / 2);
      }

      return {
        ...prev,
        open: true,
        screen,
        gameId: normalized,
        sessionKey: screen === "locked" ? prev.sessionKey : prev.sessionKey + 1,
        gamesPlayed,
        lockedUntil,
        isCelebration,
        width,
        height,
        x,
        y,
      };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeMiniPlayer = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false, screen: "playing" }));
  }, []);

  const handleHeaderClose = React.useCallback(() => {
    setState((prev) => {
      if (prev.screen === "playing") return { ...prev, screen: "ended" };
      return { ...prev, open: false, screen: "playing" };
    });
  }, []);

  const handlePlayAgain = React.useCallback(() => {
    setState((prev) => {
      const { gamesPlayed, lockedUntil, screen } = calcGameStart(prev);
      return {
        ...prev,
        screen,
        sessionKey: screen === "locked" ? prev.sessionKey : prev.sessionKey + 1,
        gamesPlayed,
        lockedUntil,
      };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePickGame = React.useCallback((gameId: string) => {
    setState((prev) => {
      const { gamesPlayed, lockedUntil, screen } = calcGameStart(prev);
      return {
        ...prev,
        screen,
        gameId,
        sessionKey: screen === "locked" ? prev.sessionKey : prev.sessionKey + 1,
        gamesPlayed,
        lockedUntil,
      };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEmbeddedSessionStart = React.useCallback(() => {
    setState((prev) => {
      if (!prev.open || prev.screen === "locked") return prev;
      const { gamesPlayed, lockedUntil, screen } = calcGameStart(prev);
      return { ...prev, screen, gamesPlayed, lockedUntil };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false, screen: "playing" }));
  }, []);

  const handleResizeMouseDown = React.useCallback((e: React.MouseEvent, dir: ResizeDir) => {
    e.preventDefault();
    const s = stateRef.current;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: s.x,
      baseY: s.y,
      baseW: s.width,
      baseH: s.height,
      dir,
    };
  }, []);

  const handleHeaderDragMouseDown = React.useCallback((e: React.MouseEvent) => {
    const s = stateRef.current;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: s.x,
      baseY: s.y,
      baseW: s.width,
      baseH: s.height,
      dir: "drag",
    };
  }, []);

  // Auto-unlock when timer expires
  React.useEffect(() => {
    if (!state.open || state.screen !== "locked" || state.lockedUntil === 0) return;
    const remaining = state.lockedUntil - Date.now();
    if (remaining <= 0) {
      setState((prev) => ({
        ...prev,
        screen: "playing",
        gamesPlayed: 0,
        lockedUntil: 0,
        sessionKey: prev.sessionKey + 1,
      }));
      return;
    }
    const id = window.setTimeout(() => {
      setState((prev) => ({
        ...prev,
        screen: "playing",
        gamesPlayed: 0,
        lockedUntil: 0,
        sessionKey: prev.sessionKey + 1,
      }));
    }, remaining);
    return () => window.clearTimeout(id);
  }, [state.open, state.screen, state.lockedUntil]);

  // Drag + Resize
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      setState((prev) => {
        if (drag.dir === "drag") {
          const maxX = Math.max(8, window.innerWidth - prev.width - 8);
          const maxY = Math.max(8, window.innerHeight - prev.height - 8);
          return {
            ...prev,
            x: Math.max(8, Math.min(maxX, drag.baseX + dx)),
            y: Math.max(8, Math.min(maxY, drag.baseY + dy)),
          };
        }

        const dir = drag.dir as ResizeDir;
        let { x, y, width, height } = prev;

        if (dir.includes("w")) {
          const newW = Math.max(MIN_W, drag.baseW - dx);
          x = drag.baseX + drag.baseW - newW;
          width = newW;
        }
        if (dir.includes("e")) width = Math.max(MIN_W, drag.baseW + dx);
        if (dir.includes("n")) {
          const newH = Math.max(MIN_H, drag.baseH - dy);
          y = drag.baseY + drag.baseH - newH;
          height = newH;
        }
        if (dir.includes("s")) height = Math.max(MIN_H, drag.baseH + dy);

        x = Math.max(0, Math.min(window.innerWidth - width, x));
        y = Math.max(0, Math.min(window.innerHeight - height, y));

        return { ...prev, x, y, width, height };
      });
    };

    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <MiniPlayerCtx.Provider
      value={{
        openMiniPlayer,
        closeMiniPlayer,
        state,
        handleHeaderClose,
        handlePlayAgain,
        handlePickGame,
        handleEmbeddedSessionStart,
        handleExit,
        handleResizeMouseDown,
        handleHeaderDragMouseDown,
      }}
    >
      {children}
    </MiniPlayerCtx.Provider>
  );
}
