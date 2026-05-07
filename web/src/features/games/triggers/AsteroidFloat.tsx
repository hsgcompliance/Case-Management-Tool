"use client";
// web/src/features/games/triggers/AsteroidFloat.tsx
// Flaming asteroid that plunges from the top of the screen downward.
// Clicking it opens Space Invaders via the mini-player.
// Trajectory is broadcast via onTrajectory so GameTriggersHost can schedule
// card-physics hits on any [data-card-physics-id] elements in the path.

import React from "react";
import type { AsteroidTrajectory } from "../effects/cardPhysicsEngine";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
  /** Called at streak start with the asteroid's computed viewport path */
  onTrajectory?: (t: AsteroidTrajectory) => void;
  /** Dev sandbox: immediately spawn the floater without waiting for the timer */
  forceShow?: boolean;
}

const DEFAULT_INTERVAL_MS = 14 * 60_000;
const DEFAULT_JITTER_MS   = 5 * 60_000;
const STREAK_MS           = 2_800; // slightly slower than horizontal — feels like gravity

type Phase = "hidden" | "streaking";

export default function AsteroidFloat({ onActivate, minIntervalMs, jitterMs, onTrajectory, forceShow }: Props) {
  const intervalMs  = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase]       = React.useState<Phase>("hidden");
  const [xFrac, setXFrac]       = React.useState(0.5);   // 0–1 across viewport width
  const [driftPx, setDriftPx]   = React.useState(0);     // px of horizontal drift during fall

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTrajectoryRef = React.useRef(onTrajectory);
  React.useEffect(() => { onTrajectoryRef.current = onTrajectory; }, [onTrajectory]);

  /** Compute and broadcast the top-down trajectory. */
  const fireTrajectory = React.useCallback((xf: number, drift: number) => {
    if (!onTrajectoryRef.current || typeof window === "undefined") return;
    const VW = window.innerWidth;
    const VH = window.innerHeight;
    const r  = 22; // half of the 44px asteroid SVG
    const startX = xf * VW;
    const startY = -r;          // above viewport
    const endX   = startX + drift;
    const endY   = VH + r;      // below viewport — full vertical sweep hits everything in path
    onTrajectoryRef.current({ startX, startY, endX, endY, durationMs: STREAK_MS });
  }, []);

  const pickAndFire = React.useCallback(() => {
    const xf    = 0.1 + Math.random() * 0.8;           // keep away from edges
    const drift = (Math.random() - 0.5) * 0.25 * (typeof window !== "undefined" ? window.innerWidth : 1200);
    setXFrac(xf);
    setDriftPx(drift);
    setPhase("streaking");
    fireTrajectory(xf, drift);
  }, [fireTrajectory]);

  const scheduleNext = React.useCallback(() => {
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(pickAndFire, delay);
  }, [intervalMs, jitterMsVal, pickAndFire]);

  // First appearance after 2–3.5 min
  React.useEffect(() => {
    const firstDelay = 2 * 60_000 + Math.random() * 90_000;
    timerRef.current = setTimeout(pickAndFire, firstDelay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!forceShow || phase !== "hidden") return;
    pickAndFire();
  }, [forceShow, phase, pickAndFire]);

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

  return (
    <>
      <style>{`
        @keyframes asteroidFall {
          from { transform: translate(0, 0);                                    opacity: 0; }
          6%   { transform: translate(0, 0);                                    opacity: 1; }
          88%  { transform: translate(${driftPx}px, calc(100vh + 80px));        opacity: 1; }
          to   { transform: translate(${driftPx}px, calc(100vh + 120px));       opacity: 0; }
        }
        @keyframes asteroidSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(420deg); }
        }
      `}</style>

      <button
        type="button"
        onClick={handleClick}
        title="Space game 🚀"
        style={{
          position: "fixed",
          top: -80,                      // starts just above viewport
          left: `calc(${xFrac * 100}% - 22px)`, // center the 44px rock on xFrac; no transform needed
          zIndex: 9990,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: `asteroidFall ${STREAK_MS}ms cubic-bezier(0.3, 0.05, 0.5, 1) forwards`,
        }}
      >
        {/* Comet tail — streams upward above the falling rock */}
        <AsteroidTail />

        {/* Rock */}
        <svg
          width={44}
          height={44}
          viewBox="0 0 44 44"
          style={{
            display: "block",
            flexShrink: 0,
            animation: `asteroidSpin ${STREAK_MS}ms linear forwards`,
            filter:
              "drop-shadow(0 0 12px rgba(251,146,60,1)) drop-shadow(0 0 6px rgba(239,68,68,0.9))",
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
      </button>
    </>
  );
}

/** Vertical comet tail that streams upward behind the falling asteroid. */
function AsteroidTail() {
  return (
    <div
      style={{
        width: 14,
        height: 110,
        background:
          "linear-gradient(to bottom, transparent, rgba(250,204,21,0.15), rgba(239,68,68,0.5), rgba(251,146,60,0.9))",
        filter: "blur(3.5px)",
        borderRadius: 8,
        flexShrink: 0,
      }}
    />
  );
}
