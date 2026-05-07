"use client";
// web/src/features/games/triggers/AlertBadge.tsx
// An alert badge that latches onto a random customer card.
// A pulsating ⚠️ warning glyph + glitch-flicker effect appears on the card's top-right corner.
// Clicking it activates the Broken Data game (card-native / prototype).
// Same props pattern as PlantSprout.

import React from "react";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
  /** Dev sandbox: immediately spawn without waiting for the timer */
  forceShow?: boolean;
}

const DEFAULT_INTERVAL_MS = 11 * 60_000;
const DEFAULT_JITTER_MS   = 3 * 60_000;

const APPEAR_MS = 500;
const STAY_MS   = 8_000;
const FADE_MS   = 600;

type Phase = "hidden" | "appearing" | "alerting" | "fading";

interface CardTarget {
  top: number;
  right: number;
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
  if (rect.width < 100) return null;
  if (rect.top < 60 || rect.top > window.innerHeight - 120) return null;
  return { top: rect.top, right: rect.right };
}

export default function AlertBadge({ onActivate, minIntervalMs, jitterMs, forceShow }: Props) {
  const intervalMs  = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase]           = React.useState<Phase>("hidden");
  const [cardTarget, setCardTarget] = React.useState<CardTarget | null>(null);
  const [glitchFrame, setGlitchFrame] = React.useState(0);
  const timerRef  = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const glitchRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const trySpawn = React.useCallback(() => {
    const target = pickRandomCard();
    if (target) {
      setCardTarget(target);
      setPhase("appearing");
    }
  }, []);

  const scheduleNext = React.useCallback(() => {
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(trySpawn, delay);
  }, [intervalMs, jitterMsVal, trySpawn]);

  // First appearance
  React.useEffect(() => {
    const firstDelay = 4 * 60_000 + Math.random() * 90_000;
    timerRef.current = setTimeout(trySpawn, firstDelay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // forceShow
  React.useEffect(() => {
    if (!forceShow || phase !== "hidden") return;
    trySpawn();
  }, [forceShow, phase, trySpawn]);

  // Phase transitions
  React.useEffect(() => {
    if (phase === "appearing") {
      const t = setTimeout(() => setPhase("alerting"), APPEAR_MS);
      return () => clearTimeout(t);
    }
    if (phase === "alerting") {
      const t = setTimeout(() => setPhase("fading"), STAY_MS);
      return () => clearTimeout(t);
    }
    if (phase === "fading") {
      const t = setTimeout(() => {
        setPhase("hidden");
        setCardTarget(null);
        scheduleNext();
      }, FADE_MS);
      return () => clearTimeout(t);
    }
  }, [phase, scheduleNext]);

  // Glitch flicker while alerting
  React.useEffect(() => {
    if (phase !== "alerting") {
      if (glitchRef.current) clearInterval(glitchRef.current);
      return;
    }
    glitchRef.current = setInterval(() => {
      setGlitchFrame((f) => f + 1);
    }, 120);
    return () => { if (glitchRef.current) clearInterval(glitchRef.current); };
  }, [phase]);

  const handleClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (glitchRef.current) clearInterval(glitchRef.current);
    setPhase("hidden");
    setCardTarget(null);
    onActivate();
  }, [onActivate]);

  if (phase === "hidden" || !cardTarget) return null;

  const opacity =
    phase === "appearing" ? 0.9 :
    phase === "fading"    ? 0 :
    1;

  // Subtle glitch offset on every other frame
  const glitchX = phase === "alerting" && glitchFrame % 7 === 0 ? (Math.random() > 0.5 ? 2 : -2) : 0;
  const glitchY = phase === "alerting" && glitchFrame % 11 === 0 ? (Math.random() > 0.5 ? 1 : -1) : 0;

  // Position: top-right corner of card, slightly inset
  const badgeRight = window.innerWidth - cardTarget.right + 8;
  const badgeTop   = cardTarget.top - 16;

  return (
    <>
      <style>{`
        @keyframes alertPulse {
          0%,100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(239,68,68,0.5)); }
          50%     { transform: scale(1.12); filter: drop-shadow(0 0 12px rgba(239,68,68,0.9)); }
        }
        @keyframes alertRing {
          0%   { opacity: 0.7; transform: scale(1); }
          100% { opacity: 0;   transform: scale(2.2); }
        }
        @keyframes alertAppear {
          from { transform: scale(0.4) rotate(-15deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(4deg); }
          to   { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes alertFade {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.6) rotate(10deg); }
        }
        @keyframes scanLine {
          0%   { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>

      <button
        type="button"
        onClick={handleClick}
        title="⚠️ Data alert!"
        style={{
          position: "fixed",
          top: badgeTop,
          right: badgeRight,
          zIndex: 9987,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          opacity,
          transform: `translate(${glitchX}px, ${glitchY}px)`,
          transition: phase === "fading" ? `opacity ${FADE_MS}ms ease` : "opacity 0.15s",
          animation: phase === "appearing"
            ? `alertAppear ${APPEAR_MS}ms cubic-bezier(0.2,0.8,0.3,1) forwards`
            : phase === "fading"
              ? `alertFade ${FADE_MS}ms ease forwards`
              : undefined,
        }}
      >
        {/* Ripple ring */}
        {phase === "alerting" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: "50%",
              border: "2px solid rgba(239,68,68,0.6)",
              animation: "alertRing 1.2s ease-out infinite",
            }}
          />
        )}

        <AlertBadgeSprite alerting={phase === "alerting"} />
      </button>
    </>
  );
}

function AlertBadgeSprite({ alerting }: { alerting: boolean }) {
  return (
    <svg
      width={52}
      height={52}
      viewBox="0 0 52 52"
      style={{
        display: "block",
        animation: alerting ? "alertPulse 1.1s ease-in-out infinite" : undefined,
        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
      }}
    >
      {/* Badge background */}
      <circle cx="26" cy="26" r="24" fill="#1e1e2e" />
      <circle cx="26" cy="26" r="24" fill="none" stroke="#ef4444" strokeWidth="2.5" />

      {/* Warning triangle */}
      <path d="M26 10 L44 40 H8 Z" fill="#ef4444" opacity="0.15" />
      <path d="M26 10 L44 40 H8 Z" fill="none" stroke="#ef4444" strokeWidth="2.5"
        strokeLinejoin="round" />

      {/* ! body */}
      <rect x="23.5" y="20" width="5" height="12" rx="2.5" fill="#fbbf24" />
      {/* ! dot */}
      <circle cx="26" cy="36.5" r="2.5" fill="#fbbf24" />

      {/* Scan line glitch */}
      {alerting && (
        <rect
          x="2" y="0" width="48" height="3"
          fill="rgba(239,68,68,0.2)"
          style={{ animation: "scanLine 1.5s linear infinite" }}
        />
      )}

      {/* Corner screws */}
      {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx, sy], i) => (
        <circle
          key={i}
          cx={26 + sx * 18}
          cy={26 + sy * 18}
          r="1.5"
          fill="#4b5563"
        />
      ))}
    </svg>
  );
}
