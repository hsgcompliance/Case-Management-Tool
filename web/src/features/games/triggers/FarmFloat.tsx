"use client";
// web/src/features/games/triggers/FarmFloat.tsx
// A tractor that trundles across the screen horizontally.
// Clicking it launches the Farm game (card-native → prototype for now).
// Same props pattern as SnakeFloat / AsteroidFloat.

import React from "react";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
  /** Dev sandbox: immediately spawn without waiting for the timer */
  forceShow?: boolean;
}

const DEFAULT_INTERVAL_MS = 15 * 60_000;
const DEFAULT_JITTER_MS   = 5 * 60_000;
const DRIVE_MS = 9_000;

type Phase = "hidden" | "driving";

export default function FarmFloat({ onActivate, minIntervalMs, jitterMs, forceShow }: Props) {
  const intervalMs  = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase]       = React.useState<Phase>("hidden");
  const [fromRight, setFromRight] = React.useState(false);
  const [yFrac, setYFrac]       = React.useState(0.65);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawn = React.useCallback(() => {
    setFromRight(Math.random() > 0.5);
    setYFrac(0.55 + Math.random() * 0.3);
    setPhase("driving");
  }, []);

  const scheduleNext = React.useCallback(() => {
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(spawn, delay);
  }, [intervalMs, jitterMsVal, spawn]);

  // First appearance
  React.useEffect(() => {
    const firstDelay = 6 * 60_000 + Math.random() * 120_000;
    timerRef.current = setTimeout(spawn, firstDelay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // forceShow
  React.useEffect(() => {
    if (!forceShow || phase !== "hidden") return;
    spawn();
  }, [forceShow, phase, spawn]);

  // Auto-hide after animation
  React.useEffect(() => {
    if (phase !== "driving") return;
    const t = setTimeout(() => {
      setPhase("hidden");
      scheduleNext();
    }, DRIVE_MS + 300);
    return () => clearTimeout(t);
  }, [phase, scheduleNext]);

  const handleClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("hidden");
    onActivate();
  }, [onActivate]);

  if (phase === "hidden") return null;

  const dx = fromRight ? "calc(-100vw - 320px)" : "calc(100vw + 320px)";

  return (
    <>
      <style>{`
        @keyframes tractorDrive {
          from { transform: translateX(0); opacity: 0; }
          5%   { opacity: 1; }
          90%  { opacity: 1; }
          to   { transform: translateX(${dx}); opacity: 0; }
        }
        @keyframes tractorBounce {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-3px); }
        }
        @keyframes wheelSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes exhaustPuff {
          0%   { opacity: 0.9; transform: translateY(0) scale(1); }
          100% { opacity: 0;   transform: translateY(-18px) scale(1.6); }
        }
      `}</style>

      <button
        type="button"
        onClick={handleClick}
        title="Farm game 🚜"
        style={{
          position: "fixed",
          top: `${yFrac * 100}vh`,
          ...(fromRight ? { right: -290 } : { left: -290 }),
          zIndex: 9990,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          animation: `tractorDrive ${DRIVE_MS}ms linear forwards`,
        }}
      >
        <div style={{ animation: "tractorBounce 0.45s ease-in-out infinite" }}>
          <TractorSprite fromRight={fromRight} />
        </div>
      </button>
    </>
  );
}

function TractorSprite({ fromRight }: { fromRight: boolean }) {
  // Spin direction: wheels spin clockwise when moving right, counterclockwise from right
  const wheelDir = fromRight ? -1 : 1;
  const spinAnim = `wheelSpin ${0.55 / Math.abs(wheelDir)}s linear infinite`;

  return (
    <svg
      width={260}
      height={90}
      viewBox="0 0 260 90"
      style={{
        display: "block",
        transform: fromRight ? "scaleX(-1)" : undefined,
        filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))",
      }}
    >
      {/* ── Exhaust puffs ── */}
      <circle cx="82" cy="12" r="5" fill="#9ca3af" opacity="0.7"
        style={{ animation: "exhaustPuff 0.9s ease-out infinite", animationDelay: "0s" }} />
      <circle cx="86" cy="6" r="3.5" fill="#d1d5db" opacity="0.5"
        style={{ animation: "exhaustPuff 0.9s ease-out infinite", animationDelay: "0.3s" }} />
      <circle cx="79" cy="4" r="2.5" fill="#e5e7eb" opacity="0.4"
        style={{ animation: "exhaustPuff 0.9s ease-out infinite", animationDelay: "0.6s" }} />

      {/* ── Exhaust pipe ── */}
      <rect x="79" y="18" width="7" height="18" rx="2" fill="#4b5563" />
      <rect x="77" y="16" width="11" height="4" rx="2" fill="#374151" />

      {/* ── Hood / engine block ── */}
      <rect x="62" y="32" width="76" height="34" rx="5" fill="#ca8a04" />
      <rect x="62" y="32" width="76" height="10" rx="3" fill="#a16207" />
      {/* Hood stripe */}
      <rect x="80" y="35" width="4" height="28" rx="1" fill="#b45309" opacity="0.5" />
      <rect x="92" y="35" width="4" height="28" rx="1" fill="#b45309" opacity="0.5" />
      {/* Radiator grill */}
      <rect x="134" y="36" width="12" height="24" rx="2" fill="#374151" />
      {[0,1,2,3].map(i => (
        <rect key={i} x="135" y={39 + i * 5} width="10" height="2" rx="1" fill="#9ca3af" />
      ))}

      {/* ── Cab ── */}
      <rect x="38" y="20" width="56" height="48" rx="6" fill="#16a34a" />
      {/* Cab highlight */}
      <rect x="42" y="23" width="20" height="5" rx="2" fill="#4ade80" opacity="0.35" />
      {/* Cab front window */}
      <rect x="82" y="24" width="8" height="18" rx="3" fill="#bae6fd" opacity="0.75" />
      {/* Side windows */}
      <rect x="44" y="24" width="26" height="20" rx="4" fill="#bae6fd" opacity="0.75" />
      <rect x="44" y="24" width="26" height="20" rx="4" fill="none" stroke="#0c4a6e" strokeWidth="1.5" />
      {/* Window cross bar */}
      <line x1="57" y1="24" x2="57" y2="44" stroke="#0c4a6e" strokeWidth="1.2" />
      {/* Cab roof */}
      <rect x="34" y="15" width="60" height="8" rx="4" fill="#15803d" />

      {/* ── Exhaust + front details ── */}
      <rect x="138" y="48" width="16" height="8" rx="2" fill="#1c1917" />

      {/* ── Chassis / frame ── */}
      <rect x="30" y="60" width="170" height="10" rx="3" fill="#292524" />

      {/* ── Large rear wheel ── */}
      <g style={{ transformOrigin: "55px 70px", animation: `wheelSpin ${0.55}s linear infinite ${wheelDir < 0 ? "reverse" : "normal"}` }}>
        <circle cx="55" cy="70" r="22" fill="#1c1917" />
        <circle cx="55" cy="70" r="18" fill="#292524" />
        {[0,45,90,135,180,225,270,315].map(deg => (
          <line
            key={deg}
            x1={55 + 9 * Math.cos(deg * Math.PI / 180)}
            y1={70 + 9 * Math.sin(deg * Math.PI / 180)}
            x2={55 + 17 * Math.cos(deg * Math.PI / 180)}
            y2={70 + 17 * Math.sin(deg * Math.PI / 180)}
            stroke="#4b5563" strokeWidth="3" strokeLinecap="round"
          />
        ))}
        <circle cx="55" cy="70" r="4.5" fill="#ca8a04" />
        <circle cx="55" cy="70" r="2" fill="#fbbf24" />
      </g>

      {/* ── Small front wheel ── */}
      <g style={{ transformOrigin: "185px 72px", animation: spinAnim }}>
        <circle cx="185" cy="72" r="14" fill="#1c1917" />
        <circle cx="185" cy="72" r="11" fill="#292524" />
        {[0,60,120,180,240,300].map(deg => (
          <line
            key={deg}
            x1={185 + 5 * Math.cos(deg * Math.PI / 180)}
            y1={72 + 5 * Math.sin(deg * Math.PI / 180)}
            x2={185 + 10 * Math.cos(deg * Math.PI / 180)}
            y2={72 + 10 * Math.sin(deg * Math.PI / 180)}
            stroke="#4b5563" strokeWidth="2.5" strokeLinecap="round"
          />
        ))}
        <circle cx="185" cy="72" r="3" fill="#ca8a04" />
      </g>

      {/* ── Fenders ── */}
      <path d="M 33,52 Q 28,60 28,70 Q 28,84 55,84 Q 80,84 80,70 Q 80,60 75,52"
        fill="none" stroke="#15803d" strokeWidth="6" strokeLinecap="round" />
      <path d="M 165,58 Q 162,65 162,72 Q 162,82 185,82 Q 207,82 207,72 Q 207,65 204,58"
        fill="none" stroke="#374151" strokeWidth="5" strokeLinecap="round" />

      {/* ── Drawbar / hitch ── */}
      <rect x="20" y="68" width="12" height="5" rx="2" fill="#374151" />
      <circle cx="16" cy="70" r="4" fill="#1c1917" stroke="#6b7280" strokeWidth="1.5" />

      {/* ── Farmer silhouette in cab ── */}
      <ellipse cx="62" cy="36" rx="7" ry="7.5" fill="#fbbf24" opacity="0.8" />
      <rect x="56" y="43" width="14" height="10" rx="3" fill="#0f172a" opacity="0.7" />
    </svg>
  );
}
