"use client";

import React from "react";
import { useMe, useUpdateMe } from "@hooks/useUsers";
import { buildHighScoreUpdate, GAME_SCORE_KEYS, getGameHighScore } from "../highScores";
import { markGameActive, shouldHandleGlobalGameKey, usePauseOnHidden } from "../input";

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

export type SnakeGameProps = {
  embedded?: boolean;
  renderStyle?: "embedded" | "fullscreen";
  onSessionStart?: () => void;
};

const CELL_SIZE = 18;
const INITIAL_COLS = 18;
const INITIAL_ROWS = 12;
const EXPAND_EVERY_MS = 14000;
const EXPAND_STEP = 2;

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function nextHead(head: Point, dir: Direction): Point {
  if (dir === "up") return { x: head.x, y: head.y - 1 };
  if (dir === "down") return { x: head.x, y: head.y + 1 };
  if (dir === "left") return { x: head.x - 1, y: head.y };
  return { x: head.x + 1, y: head.y };
}

function randomFood(cols: number, rows: number, snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x}:${p.y}`));
  const open: Point[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!occupied.has(`${x}:${y}`)) open.push({ x, y });
    }
  }
  return open[Math.floor(Math.random() * open.length)] || { x: 0, y: 0 };
}

function maxBoardSize(style: "embedded" | "fullscreen", bounds?: { width: number; height: number }) {
  const fallbackWidth = typeof window === "undefined" ? 900 : window.innerWidth;
  const fallbackHeight = typeof window === "undefined" ? 640 : window.innerHeight;
  const baseWidth = bounds?.width || fallbackWidth;
  const baseHeight = bounds?.height || fallbackHeight;
  const reserveX = style === "fullscreen" ? 24 : 24;
  const reserveY = style === "fullscreen" ? 36 : 36;
  return {
    cols: Math.max(INITIAL_COLS, Math.floor((baseWidth - reserveX) / CELL_SIZE)),
    rows: Math.max(INITIAL_ROWS, Math.floor((baseHeight - reserveY) / CELL_SIZE)),
  };
}

export default function SnakeGame({ embedded = false, renderStyle = "embedded", onSessionStart }: SnakeGameProps) {
  const style = embedded ? "embedded" : renderStyle;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const boardViewportRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });
  const [snake, setSnake] = React.useState<Point[]>([
    { x: 8, y: 6 },
    { x: 7, y: 6 },
    { x: 6, y: 6 },
  ]);
  const [dir, setDir] = React.useState<Direction>("right");
  const [nextDir, setNextDir] = React.useState<Direction>("right");
  const [board, setBoard] = React.useState(() => ({ cols: INITIAL_COLS, rows: INITIAL_ROWS }));
  const [maxBoard, setMaxBoard] = React.useState(() => maxBoardSize(style));
  const [food, setFood] = React.useState<Point>({ x: 12, y: 6 });
  const [running, setRunning] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [best, setBest] = React.useState(0);
  const [lastExpandAt, setLastExpandAt] = React.useState(() => Date.now());
  const { data: me } = useMe();
  const meLite = (me as { extras?: Record<string, unknown> | null } | null) || null;
  const updateMe = useUpdateMe();

  React.useEffect(() => {
    const saved = getGameHighScore(meLite, GAME_SCORE_KEYS.snake);
    setBest((prev) => Math.max(prev, saved));
  }, [meLite]);

  React.useEffect(() => {
    const refreshBounds = () => {
      const el = boardViewportRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const next = { width: rect.width, height: rect.height };
        setViewportSize(next);
        setMaxBoard(maxBoardSize(style, next));
      } else {
        setMaxBoard(maxBoardSize(style));
      }
    };

    refreshBounds();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refreshBounds) : null;
    if (ro && boardViewportRef.current) ro.observe(boardViewportRef.current);
    window.addEventListener("resize", refreshBounds);
    return () => {
      window.removeEventListener("resize", refreshBounds);
      ro?.disconnect();
    };
  }, [style]);

  React.useEffect(() => {
    setBoard((prev) => ({
      cols: Math.min(prev.cols, maxBoard.cols),
      rows: Math.min(prev.rows, maxBoard.rows),
    }));
  }, [maxBoard]);

  const restart = React.useCallback(() => {
    onSessionStart?.();
    const startSnake = [
      { x: 8, y: 6 },
      { x: 7, y: 6 },
      { x: 6, y: 6 },
    ];
    setSnake(startSnake);
    setDir("right");
    setNextDir("right");
    setBoard({ cols: INITIAL_COLS, rows: INITIAL_ROWS });
    setFood(randomFood(INITIAL_COLS, INITIAL_ROWS, startSnake));
    setScore(0);
    setGameOver(false);
    setRunning(true);
    setLastExpandAt(Date.now());
  }, [onSessionStart]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!shouldHandleGlobalGameKey(rootRef.current, event)) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (gameOver) restart();
        else setRunning((v) => !v);
        return;
      }
      if (event.key === "Enter" && gameOver) {
        restart();
        return;
      }
      const key = event.key.toLowerCase();
      setNextDir((current) => {
        const candidate: Direction | null =
          key === "arrowup" || key === "w" ? "up" :
          key === "arrowdown" || key === "s" ? "down" :
          key === "arrowleft" || key === "a" ? "left" :
          key === "arrowright" || key === "d" ? "right" : null;
        if (!candidate) return current;
        if (candidate === "up" && dir === "down") return current;
        if (candidate === "down" && dir === "up") return current;
        if (candidate === "left" && dir === "right") return current;
        if (candidate === "right" && dir === "left") return current;
        return candidate;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dir, gameOver, restart]);

  usePauseOnHidden(() => setRunning(false));

  // Speed scales with score: 95ms → ~62ms at score 33+
  const tickMs = Math.max(62, 95 - Math.floor(score / 6) * 3);

  React.useEffect(() => {
    if (!running || gameOver) return;
    const interval = window.setInterval(() => {
      setSnake((currentSnake) => {
        const resolvedDir = nextDir;
        setDir(resolvedDir);
        const newHead = nextHead(currentSnake[0], resolvedDir);

        if (newHead.x < 0 || newHead.y < 0 || newHead.x >= board.cols || newHead.y >= board.rows) {
          setRunning(false);
          setGameOver(true);
          return currentSnake;
        }

        const hitSelf = currentSnake.some((seg, idx) => idx !== currentSnake.length - 1 && samePoint(seg, newHead));
        if (hitSelf) {
          setRunning(false);
          setGameOver(true);
          return currentSnake;
        }

        const grew = samePoint(newHead, food);
        const nextSnake = [newHead, ...currentSnake];
        if (!grew) nextSnake.pop();

        if (grew) {
          const nextScore = score + 1;
          setScore(nextScore);
          setBest((prev) => Math.max(prev, nextScore));
          setFood(randomFood(board.cols, board.rows, nextSnake));
        }

        return nextSnake;
      });
    }, tickMs);
    return () => window.clearInterval(interval);
  }, [board.cols, board.rows, food, gameOver, nextDir, running, score, tickMs]);

  React.useEffect(() => {
    if (!gameOver) return;
    const patch = buildHighScoreUpdate(meLite, GAME_SCORE_KEYS.snake, best);
    if (patch) updateMe.mutate(patch);
  }, [best, gameOver, meLite, updateMe]);

  React.useEffect(() => {
    if (!running || gameOver) return;
    const now = Date.now();
    if (now - lastExpandAt < EXPAND_EVERY_MS) return;
    if (board.cols >= maxBoard.cols && board.rows >= maxBoard.rows) return;

    setBoard((prev) => ({
      cols: Math.min(maxBoard.cols, prev.cols + EXPAND_STEP),
      rows: Math.min(maxBoard.rows, prev.rows + EXPAND_STEP),
    }));
    setLastExpandAt(now);
  }, [board.cols, board.rows, gameOver, lastExpandAt, maxBoard.cols, maxBoard.rows, running]);

  const width = board.cols * CELL_SIZE;
  const height = board.rows * CELL_SIZE;
  const availableWidth = Math.max(0, viewportSize.width - 16);
  const availableHeight = Math.max(0, viewportSize.height - 16);
  const rawScale = Math.min(
    1,
    availableWidth > 0 ? availableWidth / width : 1,
    availableHeight > 0 ? availableHeight / height : 1
  );
  const boardScale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  const scaledWidth = Math.max(1, Math.floor(width * boardScale));
  const scaledHeight = Math.max(1, Math.floor(height * boardScale));
  const progress = `${board.cols}x${board.rows} / ${maxBoard.cols}x${maxBoard.rows}`;
  const containerClass = style === "fullscreen"
    ? "h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    : "h-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900";

  return (
    <div
      ref={rootRef}
      data-game-instance="snake"
      tabIndex={0}
      className={`${containerClass} flex flex-col overflow-hidden`}
      onPointerDown={(e) => {
        e.currentTarget.focus();
        markGameActive(e.currentTarget);
      }}
      onFocus={(e) => markGameActive(e.currentTarget)}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
        <div className="flex items-center gap-3">
          <span>Score: {score}</span>
          <span>Best: {best}</span>
          <span>Board: {progress}</span>
          {score >= 6 && <span style={{ color: "#f97316" }}>Speed ×{(95 / tickMs).toFixed(1)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-xs" onClick={() => setRunning((v) => !v)}>
            {running ? "Pause" : "Start"}
          </button>
          <button type="button" className="btn btn-ghost btn-xs" onClick={restart}>
            Restart
          </button>
        </div>
      </div>

      <div ref={boardViewportRef} className="min-h-0 flex-1 overflow-hidden rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
        <div className="mx-auto" style={{ width: scaledWidth, height: scaledHeight }}>
          <div
            className="relative origin-top-left"
            style={{
              width,
              height,
              transform: `scale(${boardScale})`,
              transformOrigin: "top left",
              backgroundImage: "linear-gradient(to right, rgba(100,116,139,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.10) 1px, transparent 1px)",
              backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
            }}
          >
          {/* Food — red apple with shine, stem, and leaf */}
          {food ? (
            <svg
              className="absolute"
              style={{ left: food.x * CELL_SIZE, top: food.y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE, overflow: "visible" }}
              viewBox="0 0 18 18"
            >
              {/* Glow */}
              <circle cx="9" cy="11" r="8" fill="#ef4444" fillOpacity={0.18} />
              {/* Apple body */}
              <ellipse cx="9" cy="11.5" rx="6.8" ry="6.2" fill="#ef4444" />
              {/* Shine */}
              <ellipse cx="6.4" cy="8.5" rx="2.4" ry="1.8" fill="rgba(255,255,255,0.32)" transform="rotate(-22 6.4 8.5)" />
              {/* Stem */}
              <path d="M9 5.5 Q10.5 3 12 4" stroke="#92400e" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              {/* Leaf */}
              <path d="M9 5 Q12.5 2.5 13 6 Q10.5 5 9 5" fill="#16a34a" />
            </svg>
          ) : null}
          {/* Snake segments */}
          {snake.map((seg, idx) => {
            const total = snake.length;
            if (idx === 0) {
              // Head with directional eyes
              const cs = CELL_SIZE - 2;
              // Eye positions based on direction
              let eyeA = { cx: cs * 0.3, cy: cs * 0.28 };
              let eyeB = { cx: cs * 0.7, cy: cs * 0.28 };
              if (dir === "down")  { eyeA = { cx: cs * 0.3, cy: cs * 0.72 }; eyeB = { cx: cs * 0.7, cy: cs * 0.72 }; }
              if (dir === "left")  { eyeA = { cx: cs * 0.28, cy: cs * 0.3 }; eyeB = { cx: cs * 0.28, cy: cs * 0.7 }; }
              if (dir === "right") { eyeA = { cx: cs * 0.72, cy: cs * 0.3 }; eyeB = { cx: cs * 0.72, cy: cs * 0.7 }; }
              return (
                <svg
                  key={`head:${seg.x}:${seg.y}`}
                  className="absolute"
                  style={{ left: seg.x * CELL_SIZE + 1, top: seg.y * CELL_SIZE + 1, width: cs, height: cs }}
                  viewBox={`0 0 ${cs} ${cs}`}
                >
                  <rect width={cs} height={cs} rx={4.5} fill="#14532d" />
                  {/* Scales hint */}
                  <rect width={cs} height={cs} rx={4.5} fill="none" stroke="#166534" strokeWidth={1} />
                  {/* Eyes */}
                  <circle cx={eyeA.cx} cy={eyeA.cy} r={cs * 0.16} fill="white" />
                  <circle cx={eyeB.cx} cy={eyeB.cy} r={cs * 0.16} fill="white" />
                  <circle cx={eyeA.cx + 0.5} cy={eyeA.cy + 0.5} r={cs * 0.09} fill="#052e16" />
                  <circle cx={eyeB.cx + 0.5} cy={eyeB.cy + 0.5} r={cs * 0.09} fill="#052e16" />
                  {/* Eye shine */}
                  <circle cx={eyeA.cx - 0.5} cy={eyeA.cy - 0.5} r={cs * 0.04} fill="white" />
                  <circle cx={eyeB.cx - 0.5} cy={eyeB.cy - 0.5} r={cs * 0.04} fill="white" />
                </svg>
              );
            }
            // Body segments: fade green → olive toward tail
            const t = idx / Math.max(total - 1, 1);
            const g = Math.round(83 + t * 30);
            const b = Math.round(20 + t * 10);
            return (
              <div
                key={`${seg.x}:${seg.y}:${idx}`}
                className="absolute"
                style={{
                  width: CELL_SIZE - 3 - (idx > total - 4 ? 1 : 0),
                  height: CELL_SIZE - 3 - (idx > total - 4 ? 1 : 0),
                  left: seg.x * CELL_SIZE + 1 + (idx > total - 4 ? 0.5 : 0),
                  top: seg.y * CELL_SIZE + 1 + (idx > total - 4 ? 0.5 : 0),
                  borderRadius: 4,
                  background: `rgb(21, ${g}, ${b})`,
                }}
              />
            );
          })}
          {gameOver ? (
            <div className="absolute inset-0 grid place-items-center bg-white/70 dark:bg-slate-900/70">
              <div className="rounded-md border border-slate-300 bg-white/95 px-4 py-3 text-center text-slate-800 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100">
                <div className="text-sm font-semibold">Game Over</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Press Enter or Restart</div>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Use arrows or WASD. Board expands every ~14s. Snake speeds up as your score climbs.</p>
    </div>
  );
}
