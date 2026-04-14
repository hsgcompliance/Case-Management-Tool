"use client";
// web/src/features/games/triggers/PlantSprout.tsx
// A plant that sprouts from the bottom edge of the screen and sways gently.
// Clicking it opens Tower Defense via the mini-player.

import React from "react";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
}

const DEFAULT_INTERVAL_MS = 12 * 60_000;
const DEFAULT_JITTER_MS = 4 * 60_000;
const GROW_MS = 1_100;
const SWAY_MS = 22_000;
const WILT_MS = 1_200;

type Phase = "hidden" | "growing" | "swaying" | "wilting";

export default function PlantSprout({ onActivate, minIntervalMs, jitterMs }: Props) {
  const intervalMs = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase] = React.useState<Phase>("hidden");
  const [xFrac, setXFrac] = React.useState(0.5);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = React.useCallback(() => {
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(() => {
      setXFrac(0.1 + Math.random() * 0.8);
      setPhase("growing");
    }, delay);
  }, [intervalMs, jitterMsVal]);

  React.useEffect(() => {
    const firstDelay = 3.5 * 60_000 + Math.random() * 90_000;
    timerRef.current = setTimeout(() => {
      setXFrac(0.1 + Math.random() * 0.8);
      setPhase("growing");
    }, firstDelay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (phase === "growing") {
      const t = setTimeout(() => setPhase("swaying"), GROW_MS);
      return () => clearTimeout(t);
    }
    if (phase === "swaying") {
      const t = setTimeout(() => setPhase("wilting"), SWAY_MS);
      return () => clearTimeout(t);
    }
    if (phase === "wilting") {
      const t = setTimeout(() => {
        setPhase("hidden");
        scheduleNext();
      }, WILT_MS);
      return () => clearTimeout(t);
    }
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

  const animation =
    phase === "growing"
      ? `plantGrow ${GROW_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards`
      : phase === "wilting"
        ? `plantWilt ${WILT_MS}ms ease-in forwards`
        : "plantSway 3.5s ease-in-out infinite";

  return (
    <>
      <style>{`
        @keyframes plantGrow {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        @keyframes plantWilt {
          from { transform: scaleY(1) rotate(0deg); }
          55%  { transform: scaleY(0.85) rotate(-7deg); }
          to   { transform: scaleY(0) rotate(-14deg); }
        }
        @keyframes plantSway {
          0%,100% { transform: scaleY(1) rotate(0deg); }
          28%     { transform: scaleY(1) rotate(-4deg); }
          72%     { transform: scaleY(1) rotate(4deg); }
        }
        @keyframes petalPulse {
          0%,100% { opacity: 0.85; }
          50%     { opacity: 1; }
        }
      `}</style>

      <button
        type="button"
        onClick={handleClick}
        title="Tower defense 🌱"
        style={{
          position: "fixed",
          bottom: 0,
          left: `calc(${xFrac * 100}vw - 30px)`,
          transformOrigin: "bottom center",
          zIndex: 9990,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          animation,
        }}
      >
        <PlantSprite />
      </button>
    </>
  );
}

function PlantSprite() {
  const petals = [0, 60, 120, 180, 240, 300].map((deg) => ({
    cx: 30 + 10 * Math.cos((deg * Math.PI) / 180),
    cy: 26 + 10 * Math.sin((deg * Math.PI) / 180),
    deg,
  }));

  return (
    <svg
      width={60}
      height={92}
      viewBox="0 0 60 92"
      style={{ display: "block", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }}
    >
      <ellipse cx="30" cy="90" rx="23" ry="6" fill="#92400e" opacity="0.55" />
      <path d="M30 90 C29 80 30 62 30 32" stroke="#16a34a" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <ellipse cx="16" cy="68" rx="15" ry="7" fill="#22c55e" transform="rotate(-38 16 68)" />
      <path d="M30 70 Q22 67 13 65" stroke="#15803d" strokeWidth="1" fill="none" strokeLinecap="round" />
      <ellipse cx="44" cy="52" rx="15" ry="7" fill="#22c55e" transform="rotate(35 44 52)" />
      <path d="M30 53 Q37 51 45 49" stroke="#15803d" strokeWidth="1" fill="none" strokeLinecap="round" />
      <ellipse cx="15" cy="40" rx="12" ry="5.5" fill="#4ade80" transform="rotate(-42 15 40)" />
      <path d="M30 42 Q22 40 14 38" stroke="#15803d" strokeWidth="1" fill="none" strokeLinecap="round" />
      {petals.map(({ cx, cy, deg }) => (
        <ellipse
          key={deg}
          cx={cx}
          cy={cy}
          rx="5.5"
          ry="4"
          fill="#facc15"
          style={{ animation: "petalPulse 2.2s ease-in-out infinite", animationDelay: `${(deg / 300) * 0.6}s` }}
        />
      ))}
      <circle cx="30" cy="26" r="5.5" fill="#f97316" />
      <circle cx="30" cy="26" r="2.5" fill="#fde68a" />
      <ellipse cx="25" cy="22" rx="3" ry="2.5" fill="#dc2626" />
      <ellipse cx="25" cy="22" rx="3" ry="2.5" fill="none" stroke="#1a1a0a" strokeWidth="0.5" />
      <circle cx="23.5" cy="21" r="1" fill="#1a1a0a" />
      <circle cx="24.5" cy="22.5" r="0.7" fill="#1a1a0a" />
      <circle cx="26.5" cy="22.5" r="0.7" fill="#1a1a0a" />
      <path d="M25 19.5 L24 17.5 M25 19.5 L26.5 17.5" stroke="#1a1a0a" strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  );
}
