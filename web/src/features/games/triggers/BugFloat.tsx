"use client";
// web/src/features/games/triggers/BugFloat.tsx
// Ambient cockroach that wanders across the screen.
// Clicking it triggers the Donkey Kong game.

import React from "react";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
  /** Dev sandbox: immediately spawn the floater without waiting for the timer */
  forceShow?: boolean;
}

const DEFAULT_INTERVAL_MS = 600_000; // 10 minutes
const DEFAULT_JITTER_MS = 120_000;   // ± 2 minutes

const WALK_DURATION_MS = 18_000;

type BugPhase = "hidden" | "flying-in" | "walking" | "flying-out";

export default function BugFloat({ onActivate, minIntervalMs, jitterMs, forceShow }: Props) {
  const intervalMs = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase] = React.useState<BugPhase>("hidden");
  const [fromLeft, setFromLeft] = React.useState(true);
  const [yPos, setYPos] = React.useState(0.65);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(() => {
      const dir = Math.random() > 0.5;
      setFromLeft(dir);
      setYPos(0.45 + Math.random() * 0.35);
      setPhase("flying-in");
    }, delay);
  }, [intervalMs, jitterMsVal]);

  React.useEffect(() => {
    const firstDelay = 90_000 + Math.random() * 60_000;
    timerRef.current = setTimeout(() => {
      setFromLeft(Math.random() > 0.5);
      setYPos(0.5 + Math.random() * 0.3);
      setPhase("flying-in");
    }, firstDelay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!forceShow || phase !== "hidden") return;
    setFromLeft(Math.random() > 0.5);
    setYPos(0.5 + Math.random() * 0.3);
    setPhase("flying-in");
  }, [forceShow, phase]);

  React.useEffect(() => {
    if (phase !== "flying-in") return;
    const t = setTimeout(() => setPhase("walking"), 600);
    return () => clearTimeout(t);
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "walking") return;
    walkTimerRef.current = setTimeout(() => setPhase("flying-out"), WALK_DURATION_MS);
    return () => {
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    };
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "flying-out") return;
    const t = setTimeout(() => {
      setPhase("hidden");
      scheduleNext();
    }, 700);
    return () => clearTimeout(t);
  }, [phase, scheduleNext]);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
      setPhase("hidden");
      onActivate();
    },
    [onActivate],
  );

  if (phase === "hidden") return null;

  const walking = phase === "walking";
  const flyingOut = phase === "flying-out";
  const flyingIn = phase === "flying-in";

  const animStyle: React.CSSProperties = (() => {
    if (flyingIn) {
      return {
        animation: `bugFlyIn ${fromLeft ? "normal" : "reverse"} 0.6s ease-out forwards`,
        left: fromLeft ? "5vw" : undefined,
        right: fromLeft ? undefined : "5vw",
      };
    }
    if (walking) {
      return {
        animation: `bugWalk ${WALK_DURATION_MS}ms linear forwards, bugBob 0.4s ease-in-out infinite`,
        left: fromLeft ? "5vw" : undefined,
        right: fromLeft ? undefined : "5vw",
        animationFillMode: "forwards",
      };
    }
    if (flyingOut) {
      return {
        animation: `bugFlyOut ${fromLeft ? "normal" : "reverse"} 0.7s ease-in forwards`,
        left: fromLeft ? undefined : "5vw",
        right: fromLeft ? "5vw" : undefined,
      };
    }
    return {};
  })();

  return (
    <>
      <style>{`
        @keyframes bugFlyIn {
          from { transform: translateX(-120px) translateY(-30px) rotate(-20deg) scale(0.5); opacity: 0; }
          to   { transform: translateX(0) translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes bugWalk {
          from { transform: translateX(0); }
          to   { transform: translateX(${fromLeft ? "calc(90vw - 10vw)" : "calc(-90vw + 10vw)"}); }
        }
        @keyframes bugBob {
          0%,100% { margin-top: 0px; }
          50%      { margin-top: -4px; }
        }
        @keyframes bugFlyOut {
          from { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; }
          to   { transform: translateX(160px) translateY(-60px) rotate(25deg) scale(0.4); opacity: 0; }
        }
        .bug-float-btn:hover .bug-body { filter: brightness(1.3); }
      `}</style>
      <button
        type="button"
        className="bug-float-btn"
        onClick={handleClick}
        title="Click me! 🪲"
        style={{
          position: "fixed",
          top: `${yPos * 100}vh`,
          zIndex: 9990,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          ...animStyle,
        }}
      >
        <BugSprite scale={1} flip={!fromLeft} />
      </button>
    </>
  );
}

function BugSprite({ scale = 1, flip = false }: { scale?: number; flip?: boolean }) {
  return (
    <svg
      className="bug-body"
      width={32 * scale}
      height={36 * scale}
      viewBox="0 0 32 36"
      style={{
        display: "block",
        transform: flip ? "scaleX(-1)" : undefined,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
        transition: "filter 0.15s",
      }}
    >
      <ellipse cx="16" cy="22" rx="8" ry="11" fill="#1a1a0a" />
      <ellipse cx="11" cy="18" rx="5" ry="9" fill="#3d2b05" transform="rotate(-8 11 18)" />
      <ellipse cx="21" cy="18" rx="5" ry="9" fill="#3d2b05" transform="rotate(8 21 18)" />
      <ellipse cx="16" cy="8" rx="6" ry="5" fill="#2d1f00" />
      <circle cx="12.5" cy="6" r="2" fill="#ef4444" />
      <circle cx="19.5" cy="6" r="2" fill="#ef4444" />
      <circle cx="13" cy="5.5" r="0.7" fill="#fff" />
      <circle cx="20" cy="5.5" r="0.7" fill="#fff" />
      <path d="M13 4 Q6 0 4 1" stroke="#78716c" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M19 4 Q26 0 28 1" stroke="#78716c" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M8 14 L2 11" stroke="#4a4030" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 18 L1 17" stroke="#4a4030" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 22 L2 23" stroke="#4a4030" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 14 L30 11" stroke="#4a4030" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 18 L31 17" stroke="#4a4030" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 22 L30 23" stroke="#4a4030" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
