"use client";
// web/src/features/games/triggers/PlantSprout.tsx
// A plant that sprouts from behind a random customer card.
// The card's top edge receives a dirt + grass strip for the full duration.
// Grows over 3.5 s, sways for 5 s, wilts over 1.5 s — 10 s total visible.
// Works for 1, 2, and 3-column cards — width is read from the DOM at spawn time.

import React from "react";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
  /** Dev sandbox: immediately spawn the floater without waiting for the timer */
  forceShow?: boolean;
}

const DEFAULT_INTERVAL_MS = 12 * 60_000;
const DEFAULT_JITTER_MS   = 4 * 60_000;

const GROW_MS = 3_500;
const STAY_MS = 5_000;
const WILT_MS = 1_500;

const STRIP_H = 30;              // total grass + dirt strip height (px)
const DIRT_H  = 12;              // dirt portion at bottom of strip (px)
const GRASS_H = STRIP_H - DIRT_H; // 18 px of grass blades above dirt
const PLANT_H = 90;              // plant sprite rendered height (px)
const PLANT_W = 60;              // plant sprite rendered width (px)

type Phase = "hidden" | "growing" | "swaying" | "wilting";

interface CardTarget {
  top: number;
  left: number;
  width: number;
  seedX: number; // integer seed for deterministic blade layout
}

function pickRandomCard(): CardTarget | null {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  const els = Array.from(
    document.querySelectorAll<HTMLElement>("[data-card-physics-id]"),
  ).filter(
    (el) =>
      !el.hasAttribute("data-card-physics-fallen") &&
      !el.hasAttribute("data-card-physics-collapsing"),
  );
  if (!els.length) return null;
  const el = els[Math.floor(Math.random() * els.length)];
  const rect = el.getBoundingClientRect();
  // Skip cards that are too close to viewport edges or too narrow
  if (rect.width < 100) return null;
  if (rect.top < 80 || rect.top > window.innerHeight - 160) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    seedX: Math.round(rect.left),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlantSprout({ onActivate, minIntervalMs, jitterMs, forceShow }: Props) {
  const intervalMs  = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase]           = React.useState<Phase>("hidden");
  const [cardTarget, setCardTarget] = React.useState<CardTarget | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const trySpawn = React.useCallback(() => {
    const target = pickRandomCard();
    if (target) {
      setCardTarget(target);
      setPhase("growing");
    }
    // No visible cards — scheduleNext will retry after the full interval
  }, []);

  const scheduleNext = React.useCallback(() => {
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(trySpawn, delay);
  }, [intervalMs, jitterMsVal, trySpawn]);

  React.useEffect(() => {
    if (!forceShow || phase !== "hidden") return;
    trySpawn();
  }, [forceShow, phase, trySpawn]);

  // First appearance: 3.5–5 min after mount
  React.useEffect(() => {
    const firstDelay = 3.5 * 60_000 + Math.random() * 90_000;
    timerRef.current = setTimeout(trySpawn, firstDelay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (phase === "growing") {
      const t = setTimeout(() => setPhase("swaying"), GROW_MS);
      return () => clearTimeout(t);
    }
    if (phase === "swaying") {
      const t = setTimeout(() => setPhase("wilting"), STAY_MS);
      return () => clearTimeout(t);
    }
    if (phase === "wilting") {
      const t = setTimeout(() => {
        setPhase("hidden");
        setCardTarget(null);
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
      setCardTarget(null);
      onActivate();
    },
    [onActivate],
  );

  if (phase === "hidden" || !cardTarget) return null;

  const plantAnim =
    phase === "growing"
      ? `plantGrow ${GROW_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards`
      : phase === "wilting"
        ? `plantWilt ${WILT_MS}ms ease-in forwards`
        : "plantSway 4.5s ease-in-out infinite";

  const stripAnim =
    phase === "growing"
      ? `stripGrow ${Math.round(GROW_MS * 0.55)}ms ease-out forwards`
      : phase === "wilting"
        ? `stripWilt ${WILT_MS}ms ease-in forwards`
        : "none";

  // Strip: bottom of strip sits 4 px into the card's top edge
  const stripTop = cardTarget.top - STRIP_H + 4;

  // Plant: bottom of 90 px sprite aligns with top of dirt
  const plantTop  = cardTarget.top - DIRT_H - PLANT_H;
  const plantLeft = cardTarget.left + cardTarget.width / 2 - PLANT_W / 2;

  return (
    <>
      <style>{`
        @keyframes plantGrow {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        @keyframes plantWilt {
          from { transform: scaleY(1) rotate(0deg); opacity: 1; }
          55%  { transform: scaleY(0.85) rotate(-7deg); opacity: 0.7; }
          to   { transform: scaleY(0) rotate(-14deg); opacity: 0; }
        }
        @keyframes plantSway {
          0%,100% { transform: rotate(0deg); }
          30%     { transform: rotate(-3deg); }
          70%     { transform: rotate(3deg); }
        }
        @keyframes stripGrow {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        @keyframes stripWilt {
          from { transform: scaleY(1); opacity: 1; }
          to   { transform: scaleY(0); opacity: 0; }
        }
        @keyframes bladeSway {
          0%,100% { transform: rotate(0deg); }
          40%     { transform: rotate(-5deg); }
          70%     { transform: rotate(4deg); }
        }
        @keyframes petalPulse {
          0%,100% { opacity: 0.85; }
          50%     { opacity: 1; }
        }
      `}</style>

      {/* Dirt + grass strip — sits at the card's top edge, spans full card width */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: stripTop,
          left: cardTarget.left,
          width: cardTarget.width,
          height: STRIP_H,
          zIndex: 9984,
          transformOrigin: "bottom center",
          animation: stripAnim,
          pointerEvents: "none",
        }}
      >
        <GrassStrip
          width={cardTarget.width}
          swaying={phase === "swaying"}
          seedX={cardTarget.seedX}
        />
      </div>

      {/* Plant — grows above the grass strip, centered on the card */}
      <button
        type="button"
        onClick={handleClick}
        title="Tower defense 🌱"
        style={{
          position: "fixed",
          top: plantTop,
          left: plantLeft,
          transformOrigin: "bottom center",
          zIndex: 9985,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          animation: plantAnim,
        }}
      >
        <PlantSprite />
      </button>
    </>
  );
}

// ─── Grass + dirt strip ───────────────────────────────────────────────────────

interface GrassStripProps {
  width: number;
  swaying: boolean;
  seedX: number;
}

function GrassStrip({ width, swaying, seedX }: GrassStripProps) {
  // Deterministic blade layout — seeded by card position so the same card
  // always grows the same grass pattern, regardless of re-renders.
  const blades = React.useMemo(() => {
    type Blade = { x: number; h: number; lean: number; delay: number; thick: boolean };
    const result: Blade[] = [];

    // Linear congruential generator seeded by card left position
    let seed = (seedX * 2654435761) >>> 0;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    let x = 4;
    while (x < width - 4) {
      result.push({
        x,
        h:     8  + next() * 9,          // 8–17 px tall
        lean:  (next() - 0.5) * 8,       // –4 to +4 px lean at tip
        delay: next() * 1.8,             // 0–1.8 s sway phase offset
        thick: next() > 0.62,
      });
      x += 8 + next() * 6;              // 8–14 px spacing between blades
    }
    return result;
  }, [width, seedX]);

  return (
    <svg
      width={width}
      height={STRIP_H}
      viewBox={`0 0 ${width} ${STRIP_H}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Dirt base */}
      <rect x={0} y={GRASS_H} width={width} height={DIRT_H} fill="#92400e" />
      {/* Top edge of dirt — darker seam */}
      <rect x={0} y={GRASS_H} width={width} height={2.5} fill="#78350f" />
      {/* Scattered pebbles */}
      {blades
        .filter((_, i) => i % 5 === 2)
        .map((b, i) => (
          <ellipse
            key={`p${i}`}
            cx={b.x + 2}
            cy={GRASS_H + 6 + (i % 3) * 2}
            rx={2 + (i % 2)}
            ry={1.2}
            fill="#6b4c11"
            opacity={0.55}
          />
        ))}
      {/* Grass blades */}
      {blades.map((b, i) => (
        <path
          key={i}
          d={`M${b.x},${GRASS_H} Q${b.x + b.lean * 0.45},${GRASS_H - b.h * 0.55} ${b.x + b.lean},${GRASS_H - b.h}`}
          stroke={i % 4 === 0 ? "#4ade80" : i % 4 === 1 ? "#16a34a" : "#22c55e"}
          strokeWidth={b.thick ? 2.4 : 1.7}
          strokeLinecap="round"
          fill="none"
          style={
            swaying
              ? {
                  transformOrigin: `${b.x}px ${GRASS_H}px`,
                  animation: `bladeSway ${2.2 + (i % 6) * 0.35}s ease-in-out infinite`,
                  animationDelay: `${b.delay}s`,
                }
              : undefined
          }
        />
      ))}
    </svg>
  );
}

// ─── Plant sprite ─────────────────────────────────────────────────────────────

function PlantSprite() {
  const petals = [0, 60, 120, 180, 240, 300].map((deg) => ({
    cx: 30 + 10 * Math.cos((deg * Math.PI) / 180),
    cy: 26 + 10 * Math.sin((deg * Math.PI) / 180),
    deg,
  }));

  return (
    <svg
      width={PLANT_W}
      height={PLANT_H}
      viewBox="0 0 60 92"
      style={{ display: "block", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }}
    >
      {/* Stem */}
      <path
        d="M30 90 C29 80 30 62 30 32"
        stroke="#16a34a"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Left leaf */}
      <ellipse cx="16" cy="68" rx="15" ry="7" fill="#22c55e" transform="rotate(-38 16 68)" />
      <path d="M30 70 Q22 67 13 65" stroke="#15803d" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Right leaf */}
      <ellipse cx="44" cy="52" rx="15" ry="7" fill="#22c55e" transform="rotate(35 44 52)" />
      <path d="M30 53 Q37 51 45 49" stroke="#15803d" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Upper left leaf */}
      <ellipse cx="15" cy="40" rx="12" ry="5.5" fill="#4ade80" transform="rotate(-42 15 40)" />
      <path d="M30 42 Q22 40 14 38" stroke="#15803d" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Petals */}
      {petals.map(({ cx, cy, deg }) => (
        <ellipse
          key={deg}
          cx={cx}
          cy={cy}
          rx="5.5"
          ry="4"
          fill="#facc15"
          style={{
            animation: "petalPulse 2.2s ease-in-out infinite",
            animationDelay: `${(deg / 300) * 0.6}s`,
          }}
        />
      ))}
      {/* Flower center */}
      <circle cx="30" cy="26" r="5.5" fill="#f97316" />
      <circle cx="30" cy="26" r="2.5" fill="#fde68a" />
      {/* Tiny bug on the flower */}
      <ellipse cx="25" cy="22" rx="3" ry="2.5" fill="#dc2626" />
      <ellipse cx="25" cy="22" rx="3" ry="2.5" fill="none" stroke="#1a1a0a" strokeWidth="0.5" />
      <circle cx="23.5" cy="21" r="1" fill="#1a1a0a" />
      <circle cx="24.5" cy="22.5" r="0.7" fill="#1a1a0a" />
      <circle cx="26.5" cy="22.5" r="0.7" fill="#1a1a0a" />
      <path
        d="M25 19.5 L24 17.5 M25 19.5 L26.5 17.5"
        stroke="#1a1a0a"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
