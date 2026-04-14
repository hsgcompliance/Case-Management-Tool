"use client";
// web/src/features/games/triggers/AsteroidFloat.tsx
// Flaming asteroid that streaks diagonally across the screen.
// Clicking it opens Space Invaders via the mini-player.

import React from "react";
import type { AsteroidTrajectory } from "../effects/cardPhysicsEngine";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
  /** Called at streak start with the asteroid's computed viewport path */
  onTrajectory?: (t: AsteroidTrajectory) => void;
}

const DEFAULT_INTERVAL_MS = 14 * 60_000;
const DEFAULT_JITTER_MS = 5 * 60_000;
const STREAK_MS = 2_400;

type Phase = "hidden" | "streaking";

export default function AsteroidFloat({ onActivate, minIntervalMs, jitterMs, onTrajectory }: Props) {
  const intervalMs = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase] = React.useState<Phase>("hidden");
  const [fromRight, setFromRight] = React.useState(false);
  const [yFrac, setYFrac] = React.useState(0.2);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTrajectoryRef = React.useRef(onTrajectory);
  React.useEffect(() => { onTrajectoryRef.current = onTrajectory; }, [onTrajectory]);

  /** Compute and broadcast the trajectory for the given streak params. */
  const fireTrajectory = React.useCallback((fr: boolean, yf: number) => {
    if (!onTrajectoryRef.current || typeof window === "undefined") return;
    const VW = window.innerWidth;
    const VH = window.innerHeight;
    const r = 22; // half of the 44px asteroid SVG
    // Asteroid center start/end derived from the CSS animation values
    const startX = fr ? VW + r : -r;
    const startY = yf * VH + r;
    const endX   = fr ? -r - 258 : VW + r + 258;
    const endY   = startY + 0.18 * VH;
    onTrajectoryRef.current({ startX, startY, endX, endY, durationMs: STREAK_MS });
  }, []);

  const scheduleNext = React.useCallback(() => {
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(() => {
      const fr = Math.random() > 0.5;
      const yf = 0.05 + Math.random() * 0.4;
      setFromRight(fr);
      setYFrac(yf);
      setPhase("streaking");
      fireTrajectory(fr, yf);
    }, delay);
  }, [intervalMs, jitterMsVal, fireTrajectory]);

  React.useEffect(() => {
    const firstDelay = 2 * 60_000 + Math.random() * 90_000;
    timerRef.current = setTimeout(() => {
      const fr = Math.random() > 0.5;
      const yf = 0.05 + Math.random() * 0.4;
      setFromRight(fr);
      setYFrac(yf);
      setPhase("streaking");
      fireTrajectory(fr, yf);
    }, firstDelay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (phase !== "streaking") return;
    const t = setTimeout(() => {
      setPhase("hidden");
      scheduleNext();
    }, STREAK_MS + 200);
    return () => clearTimeout(t);
  }, [phase, scheduleNext]);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase("hidden");
      onActivate();
    },
    [onActivate],
  );

  if (phase === "hidden") return null;

  const dx = fromRight ? "calc(-100vw - 280px)" : "calc(100vw + 280px)";
  const spinDir = fromRight ? "-" : "";

  return (
    <>
      <style>{`
        @keyframes asteroidFly {
          from { transform: translate(0, 0); opacity: 0; }
          8%   { opacity: 1; }
          85%  { opacity: 1; }
          to   { transform: translate(${dx}, 18vh); opacity: 0; }
        }
        @keyframes asteroidSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(${spinDir}300deg); }
        }
      `}</style>

      <button
        type="button"
        onClick={handleClick}
        title="Space game 🚀"
        style={{
          position: "fixed",
          top: `${yFrac * 100}vh`,
          ...(fromRight ? { right: -60 } : { left: -60 }),
          zIndex: 9990,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          display: "flex",
          alignItems: "center",
          animation: `asteroidFly ${STREAK_MS}ms cubic-bezier(0.2, 0.1, 0.3, 1) forwards`,
        }}
      >
        {!fromRight && <AsteroidTrail side="left" />}

        <svg
          width={44}
          height={44}
          viewBox="0 0 44 44"
          style={{
            display: "block",
            flexShrink: 0,
            animation: `asteroidSpin ${STREAK_MS}ms linear forwards`,
            filter:
              "drop-shadow(0 0 10px rgba(251,146,60,1)) drop-shadow(0 0 5px rgba(239,68,68,0.9))",
          }}
        >
          <ellipse cx="22" cy="22" rx="21" ry="21" fill="rgba(239,68,68,0.18)" />
          <polygon points="22,2 34,7 41,18 38,31 28,41 14,41 5,31 4,18 12,7" fill="#78716c" />
          <polygon points="22,2 34,7 41,18 38,31 28,41 14,41 5,31 4,18 12,7" fill="none" stroke="#d6d3d1" strokeWidth="1" />
          <path d="M12 11 Q17 16 15 21" stroke="#57534e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M23 17 Q28 22 25 28" stroke="#57534e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="13" cy="27" r="2" fill="#57534e" />
          <ellipse cx="22" cy="22" rx="7" ry="7" fill="rgba(251,146,60,0.4)" />
        </svg>

        {fromRight && <AsteroidTrail side="right" />}
      </button>
    </>
  );
}

function AsteroidTrail({ side }: { side: "left" | "right" }) {
  const gradient =
    side === "left"
      ? "linear-gradient(to left, rgba(251,146,60,0.95), rgba(239,68,68,0.55), rgba(250,204,21,0.15), transparent)"
      : "linear-gradient(to right, rgba(251,146,60,0.95), rgba(239,68,68,0.55), rgba(250,204,21,0.15), transparent)";
  return (
    <div
      style={{
        width: 120,
        height: 13,
        background: gradient,
        filter: "blur(3px)",
        borderRadius: 8,
        flexShrink: 0,
      }}
    />
  );
}
