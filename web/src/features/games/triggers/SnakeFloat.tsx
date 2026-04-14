"use client";
// web/src/features/games/triggers/SnakeFloat.tsx
// A snake that slithers horizontally across the screen.
// Clicking it opens the Snake game via the mini-player.

import React from "react";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
}

const DEFAULT_INTERVAL_MS = 13 * 60_000;
const DEFAULT_JITTER_MS = 4 * 60_000;
const SLITHER_MS = 8_000;

type Phase = "hidden" | "slithering";

export default function SnakeFloat({ onActivate, minIntervalMs, jitterMs }: Props) {
  const intervalMs = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase] = React.useState<Phase>("hidden");
  const [fromRight, setFromRight] = React.useState(false);
  const [yFrac, setYFrac] = React.useState(0.5);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = React.useCallback(() => {
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(() => {
      setFromRight(Math.random() > 0.5);
      setYFrac(0.3 + Math.random() * 0.5);
      setPhase("slithering");
    }, delay);
  }, [intervalMs, jitterMsVal]);

  React.useEffect(() => {
    const firstDelay = 5 * 60_000 + Math.random() * 90_000;
    timerRef.current = setTimeout(() => {
      setFromRight(Math.random() > 0.5);
      setYFrac(0.3 + Math.random() * 0.5);
      setPhase("slithering");
    }, firstDelay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (phase !== "slithering") return;
    const t = setTimeout(() => {
      setPhase("hidden");
      scheduleNext();
    }, SLITHER_MS + 300);
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

  return (
    <>
      <style>{`
        @keyframes snakeSlither {
          from { transform: translateX(0); opacity: 0; }
          6%   { opacity: 1; }
          88%  { opacity: 1; }
          to   { transform: translateX(${dx}); opacity: 0; }
        }
        @keyframes snakeBodyWave {
          0%,100% { transform: translateY(0px); }
          25%     { transform: translateY(-4px); }
          75%     { transform: translateY(4px); }
        }
        @keyframes tongueFlit {
          0%,42%,100% { opacity: 0; }
          46%,54%     { opacity: 1; }
          58%         { opacity: 0; }
        }
      `}</style>

      <button
        type="button"
        onClick={handleClick}
        title="Snake game 🐍"
        style={{
          position: "fixed",
          top: `${yFrac * 100}vh`,
          ...(fromRight ? { right: -240 } : { left: -240 }),
          zIndex: 9990,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          animation: `snakeSlither ${SLITHER_MS}ms linear forwards`,
        }}
      >
        <div style={{ animation: "snakeBodyWave 0.55s ease-in-out infinite" }}>
          <SnakeSprite fromRight={fromRight} />
        </div>
      </button>
    </>
  );
}

function SnakeSprite({ fromRight }: { fromRight: boolean }) {
  return (
    <svg
      width={230}
      height={64}
      viewBox="0 0 230 64"
      style={{
        display: "block",
        transform: fromRight ? "scaleX(-1)" : undefined,
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
      }}
    >
      <path d="M 8,32 C 24,32 30,50 50,50 S 80,14 100,14 S 130,50 150,50 S 176,32 192,32" stroke="#15803d" strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M 8,32 C 24,32 30,50 50,50 S 80,14 100,14 S 130,50 150,50 S 176,32 192,32" stroke="#bbf7d0" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.45" />
      <path d="M 8,32 C 24,32 30,50 50,50 S 80,14 100,14 S 130,50 150,50 S 176,32 192,32" stroke="#4ade80" strokeWidth="7" strokeLinecap="butt" strokeDasharray="16 12" fill="none" opacity="0.35" />
      <ellipse cx="207" cy="32" rx="21" ry="16" fill="#166534" />
      <ellipse cx="204" cy="28" rx="11" ry="7" fill="#22c55e" opacity="0.35" />
      <ellipse cx="210" cy="36" rx="14" ry="9" fill="#14532d" />
      <circle cx="213" cy="25" r="4.5" fill="#fde68a" />
      <circle cx="214" cy="25" r="2.5" fill="#111827" />
      <circle cx="215" cy="24" r="0.9" fill="#fff" />
      <circle cx="220" cy="32" r="1.3" fill="#0f4c21" />
      <g style={{ opacity: 0, animation: "tongueFlit 2.2s ease-in-out infinite" }}>
        <line x1="222" y1="32" x2="231" y2="32" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="231" y1="32" x2="237" y2="27" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="231" y1="32" x2="237" y2="37" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <ellipse cx="8" cy="32" rx="5" ry="4" fill="#14532d" />
    </svg>
  );
}
