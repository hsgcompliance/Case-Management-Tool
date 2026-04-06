"use client";

import React from "react";
import { GAME_REGISTRY, getGameById } from "./registry";
import { CompactGamePicker } from "./GameSelector";

// ─── Types ───────────────────────────────────────────────────────────────────

type MiniScreen = "playing" | "ended" | "locked";

type MiniPlayerState = {
  open: boolean;
  screen: MiniScreen;
  gameId: string;
  sessionKey: number;
  gamesPlayed: number;   // consecutive session starts; resets after lockout expires
  lockedUntil: number;   // epoch ms; 0 = unlocked
  isCelebration: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type MiniPlayerContextValue = {
  // public API
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

type DragState = {
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  baseW: number;
  baseH: number;
  dir: "drag" | ResizeDir;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GAMES_PER_BURST = 3;
const LOCKOUT_MS = 60_000;
const MIN_W = 320;
const MIN_H = 260;

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_STATE: MiniPlayerState = {
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

// ─── Context ─────────────────────────────────────────────────────────────────

const MiniPlayerCtx = React.createContext<MiniPlayerContextValue | null>(null);

export function useGameMiniPlayer() {
  const ctx = React.useContext(MiniPlayerCtx);
  if (!ctx) {
    return {
      openMiniPlayer: (_gameId: string, _opts?: { celebration?: boolean }) => {},
      closeMiniPlayer: () => {},
      state: DEFAULT_STATE,
      handleHeaderClose: () => {},
      handlePlayAgain: () => {},
      handlePickGame: (_gameId: string) => {},
      handleEmbeddedSessionStart: () => {},
      handleExit: () => {},
      handleResizeMouseDown: (_e: React.MouseEvent, _dir: ResizeDir) => {},
      handleHeaderDragMouseDown: (_e: React.MouseEvent) => {},
    };
  }
  return ctx;
}

// ─── Drag dots ───────────────────────────────────────────────────────────────

function DragDots() {
  return (
    <span className="flex flex-col gap-[3px] opacity-40" aria-hidden>
      {[0, 1].map((row) => (
        <span key={row} className="flex gap-[3px]">
          {[0, 1, 2].map((col) => (
            <span key={col} className="h-[3px] w-[3px] rounded-full bg-slate-500 dark:bg-white" />
          ))}
        </span>
      ))}
    </span>
  );
}

// ─── Lockout screen ──────────────────────────────────────────────────────────

function LockoutScreen({ lockedUntil, onExit }: { lockedUntil: number; onExit: () => void }) {
  const [secsLeft, setSecsLeft] = React.useState(() =>
    Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
  );

  React.useEffect(() => {
    const tick = () => setSecsLeft(Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-slate-100 px-6 py-8 text-slate-900 dark:bg-slate-950 dark:text-white">
      <span className="text-5xl leading-none">⏱️</span>
      <div className="text-center">
        <p className="text-lg font-bold">Break time&apos;s up!</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Back to work — arcade unlocks in</p>
        <p className="mt-3 text-5xl font-black tabular-nums text-amber-400">
          {String(Math.floor(secsLeft / 60)).padStart(2, "0")}:
          {String(secsLeft % 60).padStart(2, "0")}
        </p>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="text-[11px] text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-600 dark:hover:text-slate-400"
      >
        Close
      </button>
    </div>
  );
}

// ─── Ended screen ────────────────────────────────────────────────────────────

function EndedScreen({
  gameId,
  onPlayAgain,
  onPickGame,
  onExit,
}: {
  gameId: string;
  onPlayAgain: () => void;
  onPickGame: (id: string) => void;
  onExit: () => void;
}) {
  const game = getGameById(gameId);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-100 px-5 py-6 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="flex flex-col items-center gap-1">
        <span className="text-5xl leading-none">{game.icon}</span>
        <span className="text-base font-bold tracking-wide">{game.title}</span>
      </div>
      <button
        type="button"
        onClick={onPlayAgain}
        className={[
          "w-full max-w-xs rounded-xl py-2.5 text-sm font-bold tracking-wide text-white shadow-lg transition-opacity hover:opacity-90",
          game.accent.bg,
        ].join(" ")}
      >
        ▶ Play Again
      </button>
      <div className="w-full max-w-xs space-y-2">
        <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">
          or switch to
        </p>
        <CompactGamePicker currentGameId={gameId} onPick={onPickGame} />
      </div>
      <button
        type="button"
        onClick={onExit}
        className="text-[11px] text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-600 dark:hover:text-slate-400"
      >
        Exit arcade
      </button>
    </div>
  );
}

// ─── Resize handle ───────────────────────────────────────────────────────────

const RESIZE_POS: Record<ResizeDir, string> = {
  n:  "inset-x-4 top-0 h-1.5 cursor-n-resize",
  s:  "inset-x-4 bottom-0 h-1.5 cursor-s-resize",
  e:  "inset-y-4 right-0 w-1.5 cursor-e-resize",
  w:  "inset-y-4 left-0 w-1.5 cursor-w-resize",
  ne: "top-0 right-0 h-4 w-4 cursor-ne-resize",
  nw: "top-0 left-0 h-4 w-4 cursor-nw-resize",
  se: "bottom-0 right-0 h-4 w-4 cursor-se-resize",
  sw: "bottom-0 left-0 h-4 w-4 cursor-sw-resize",
};

function ResizeHandle({
  dir,
  onMouseDown,
}: {
  dir: ResizeDir;
  onMouseDown: (e: React.MouseEvent, dir: ResizeDir) => void;
}) {
  return (
    <div
      className={`absolute z-20 ${RESIZE_POS[dir]}`}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown(e, dir);
      }}
    />
  );
}

// ─── Floating window (layout-level, reads from context) ──────────────────────

export function GameMiniPlayerFloat() {
  const {
    state,
    handleHeaderClose,
    handlePlayAgain,
    handlePickGame,
    handleEmbeddedSessionStart,
    handleExit,
    handleResizeMouseDown,
    handleHeaderDragMouseDown,
  } = useGameMiniPlayer();

  if (!state.open) return null;

  const activeGame = getGameById(state.gameId);
  const isPlaying = state.screen === "playing";
  const isEnded = state.screen === "ended";
  const isLocked = state.screen === "locked";

  return (
    <div
      className="fixed z-[1600] flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl shadow-slate-900/30 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/60"
      style={{ left: state.x, top: state.y, width: state.width, height: state.height }}
    >
      {/* Resize handles */}
      {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeDir[]).map((dir) => (
        <ResizeHandle key={dir} dir={dir} onMouseDown={handleResizeMouseDown} />
      ))}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 cursor-move select-none items-center justify-between gap-2 bg-slate-100 px-3 py-2 dark:bg-slate-900"
        onMouseDown={handleHeaderDragMouseDown}
      >
        <div className="flex items-center gap-2">
          <DragDots />
          <span className="text-lg leading-none">{activeGame.icon}</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{activeGame.title}</span>
          {isPlaying && (
            <span
              className={[
                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white",
                activeGame.accent.bg,
              ].join(" ")}
            >
              {state.isCelebration ? "🎉 Break" : "Live"}
            </span>
          )}
          {isEnded && (
            <span className="rounded bg-slate-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              Paused
            </span>
          )}
          {isLocked && (
            <span className="rounded bg-amber-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
              Locked
            </span>
          )}
        </div>

        {/* Game switcher — only while playing */}
        {isPlaying && (
          <select
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={activeGame.id}
            onChange={(e) => handlePickGame(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {GAME_REGISTRY.map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon} {g.title}
              </option>
            ))}
          </select>
        )}

        {/* Close / confirm-close */}
        <button
          type="button"
          title={isEnded || isLocked ? "Close arcade" : "Pause / exit options"}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          onClick={handleHeaderClose}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor">
            <path d="M1 1l10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 bg-white dark:bg-slate-900">
        {isLocked ? (
          <LockoutScreen lockedUntil={state.lockedUntil} onExit={handleExit} />
        ) : isEnded ? (
          <EndedScreen
            gameId={state.gameId}
            onPlayAgain={handlePlayAgain}
            onPickGame={handlePickGame}
            onExit={handleExit}
          />
        ) : (
          <div className="h-full">
            <activeGame.Component
              key={state.sessionKey}
              embedded
              renderStyle="embedded"
              onSessionStart={handleEmbeddedSessionStart}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function GameMiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<MiniPlayerState>(DEFAULT_STATE);
  const dragRef = React.useRef<DragState | null>(null);
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Lockout helpers ────────────────────────────────────────────────────────

  /** Returns updated gamesPlayed, lockedUntil, and screen based on starting a new session. */
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

  // ── Public API ─────────────────────────────────────────────────────────────

  const openMiniPlayer = React.useCallback((gameId: string, opts?: { celebration?: boolean }) => {
    const normalized = getGameById(gameId)?.id ?? "runner";
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

  // ── Internal actions (exposed via context for GameMiniPlayerFloat) ──────────

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

  // ── Drag + Resize ──────────────────────────────────────────────────────────

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

        // Clamp to viewport
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

  // ── Render ─────────────────────────────────────────────────────────────────

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
