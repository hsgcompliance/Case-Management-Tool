"use client";
// web/src/features/games/triggers/MoonRise.tsx
// Ambient trigger: the page darkens, stars come in, and the moon materialises
// in the center of the viewport BEHIND the customer cards, which gently drift
// downward to reveal it.
//
// Phase flow (normal dismiss):  rising → full → dismissing → hidden
// Phase flow (game activated):  rising → full → spawning → hidden
//
// During "spawning" the customer cards animate into circles and shrink away
// rather than returning upward — visually they are becoming soldiers.

import React from "react";

interface Props {
  onActivate: () => void;
  minIntervalMs?: number;
  jitterMs?: number;
  /** Dev sandbox: immediately spawn without waiting for the timer */
  forceShow?: boolean;
}

const DEFAULT_INTERVAL_MS = 20 * 60_000;
const DEFAULT_JITTER_MS   = 8 * 60_000;

const RISE_MS    = 2_500;  // overlay + card drift + moon fade-in
const STAY_MS    = 12_000; // moon fully visible, stars twinkling
const DISMISS_MS = 1_400;  // cards return, moon fades out (normal dismiss)
const SPAWN_MS   = 1_300;  // cards round → circle → shrink (game-activated dismiss)

// Cards drift this far down during the ambient reveal
const CARD_DRIFT_PX = 90;

type Phase = "hidden" | "rising" | "full" | "dismissing" | "spawning";

// Deterministic star field — concentrated in upper 52% of viewport
const STARS = (() => {
  let seed = 0xdeadbeef;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  return Array.from({ length: 55 }, () => ({
    x: rand() * 100,
    y: rand() * 52,
    r: 0.7 + rand() * 1.5,
    delay: rand() * 2.5,
    dur: 1.5 + rand() * 2.5,
    bright: rand() > 0.65,
  }));
})();

export default function MoonRise({ onActivate, minIntervalMs, jitterMs, forceShow }: Props) {
  const intervalMs  = minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const jitterMsVal = jitterMs ?? DEFAULT_JITTER_MS;

  const [phase, setPhase] = React.useState<Phase>("hidden");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawn = React.useCallback(() => setPhase("rising"), []);

  const scheduleNext = React.useCallback(() => {
    const delay = intervalMs + Math.random() * jitterMsVal;
    timerRef.current = setTimeout(spawn, delay);
  }, [intervalMs, jitterMsVal, spawn]);

  // First appearance
  React.useEffect(() => {
    const firstDelay = 8 * 60_000 + Math.random() * 180_000;
    timerRef.current = setTimeout(spawn, firstDelay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // forceShow
  React.useEffect(() => {
    if (!forceShow || phase !== "hidden") return;
    spawn();
  }, [forceShow, phase, spawn]);

  // Phase transitions
  React.useEffect(() => {
    if (phase === "rising") {
      const t = setTimeout(() => setPhase("full"), RISE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "full") {
      const t = setTimeout(() => setPhase("dismissing"), STAY_MS);
      return () => clearTimeout(t);
    }
    if (phase === "dismissing") {
      const t = setTimeout(() => {
        setPhase("hidden");
        scheduleNext();
      }, DISMISS_MS);
      return () => clearTimeout(t);
    }
    if (phase === "spawning") {
      // Cards are transforming into soldiers; just wait then reset.
      const t = setTimeout(() => {
        setPhase("hidden");
        scheduleNext();
      }, SPAWN_MS);
      return () => clearTimeout(t);
    }
  }, [phase, scheduleNext]);

  // Drive card drift + transformation via body data-attribute
  React.useEffect(() => {
    if (phase === "hidden") {
      delete document.body.dataset.moonPhase;
    } else {
      document.body.dataset.moonPhase = phase;
    }
    return () => { delete document.body.dataset.moonPhase; };
  }, [phase]);

  // Clicking the moon starts the game (spawning) instead of a normal dismiss
  const handleActivate = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("spawning");
    onActivate();
  }, [onActivate]);

  const handleDismiss = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("dismissing");
  }, []);

  if (phase === "hidden") return null;

  // Both dismissing and spawning fade out the overlay + moon
  const isFadingOut = phase === "dismissing" || phase === "spawning";
  const fadeMs = phase === "spawning" ? SPAWN_MS : DISMISS_MS;

  return (
    <>
      <style>{`
        /* ── Card drift (rising / full) ───────────────────────────────────── */
        body[data-moon-phase="rising"] [data-card-physics-id],
        body[data-moon-phase="full"]   [data-card-physics-id] {
          position: relative !important;
          z-index: 9995 !important;
          pointer-events: none !important;
          transform: translateY(${CARD_DRIFT_PX}px) !important;
          transition:
            transform ${RISE_MS}ms cubic-bezier(0.15, 0, 0.45, 1) !important;
        }

        /* ── Card return (normal dismiss) ─────────────────────────────────── */
        body[data-moon-phase="dismissing"] [data-card-physics-id] {
          position: relative !important;
          z-index: 9995 !important;
          pointer-events: none !important;
          transform: translateY(0px) !important;
          transition:
            transform ${DISMISS_MS}ms cubic-bezier(0.55, 0, 0.85, 1) !important;
        }

        /* ── Card → circle → soldier (game-activated) ─────────────────────── */
        /* Cards stay at their drifted position and contract into glowing      */
        /* circles, then vanish. The game canvas soldiers materialise on top.  */
        body[data-moon-phase="spawning"] [data-card-physics-id] {
          position: relative !important;
          z-index: 9995 !important;
          pointer-events: none !important;
          border-radius: 50% !important;
          transform: translateY(${CARD_DRIFT_PX}px) scale(0.08) !important;
          opacity: 0 !important;
          box-shadow: 0 0 18px 6px rgba(139, 92, 246, 0.55) !important;
          transition:
            border-radius 0.48s ease !important,
            transform 0.88s 0.12s cubic-bezier(0.55, 0, 0.85, 1) !important,
            opacity 0.32s 0.78s ease !important,
            box-shadow 0.45s ease !important;
        }

        /* ── Moon keyframes ────────────────────────────────────────────────── */
        @keyframes moonReveal {
          from { opacity: 0; transform: translate(-50%, -44%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes moonFadeOut {
          from { opacity: 1; transform: translate(-50%, -50%); }
          to   { opacity: 0; transform: translate(-50%, -56%); }
        }
        @keyframes moonGlow {
          0%,100% { filter: drop-shadow(0 0 18px rgba(216,180,254,0.5))
                             drop-shadow(0 0 40px rgba(139,92,246,0.3)); }
          50%     { filter: drop-shadow(0 0 30px rgba(216,180,254,0.8))
                             drop-shadow(0 0 64px rgba(139,92,246,0.55)); }
        }

        /* ── Star keyframes ────────────────────────────────────────────────── */
        @keyframes moonStarAppear {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes moonStarTwinkle {
          0%,100% { opacity: 0.15; transform: scale(0.8); }
          50%     { opacity: 1;    transform: scale(1.15); }
        }

        /* ── Overlay ───────────────────────────────────────────────────────── */
        @keyframes moonOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Crater shimmer ────────────────────────────────────────────────── */
        @keyframes craterShimmer {
          0%,100% { opacity: 0.5; }
          50%     { opacity: 0.8; }
        }
      `}</style>

      {/* Semi-transparent dark overlay — behind cards (z 9990) */}
      <div
        aria-hidden
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9990,
          background: [
            "radial-gradient(ellipse 80% 60% at 50% 40%,",
            "  rgba(30,10,60,0.92) 0%,",
            "  rgba(10,0,20,0.86) 45%,",
            "  rgba(0,0,0,0.80) 100%)",
          ].join(""),
          opacity: isFadingOut ? 0 : undefined,
          transition: isFadingOut ? `opacity ${fadeMs}ms ease` : undefined,
          animation: !isFadingOut ? `moonOverlayIn ${RISE_MS}ms ease forwards` : undefined,
          cursor: "default",
        }}
      />

      {/* Stars — also behind cards (z 9991) */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9991,
          pointerEvents: "none",
          opacity: isFadingOut ? 0 : 1,
          transition: isFadingOut ? `opacity ${fadeMs}ms ease` : undefined,
        }}
      >
        {STARS.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.r * 2,
              height: s.r * 2,
              borderRadius: "50%",
              background: s.bright ? "#f5f3ff" : "#c4b5fd",
              animation: [
                `moonStarAppear ${RISE_MS * 0.85}ms ease forwards`,
                `moonStarTwinkle ${s.dur}s ease-in-out infinite ${s.delay}s`,
              ].join(", "),
              boxShadow: s.bright
                ? `0 0 ${s.r * 3}px rgba(245,243,255,0.8)`
                : undefined,
            }}
          />
        ))}
      </div>

      {/* Moon — centered, z 9992 (behind cards at 9995, above overlay) */}
      <button
        type="button"
        onClick={handleActivate}
        title="Click to Play 🌕"
        style={{
          position: "fixed",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9992,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          animation: isFadingOut
            ? `moonFadeOut ${fadeMs}ms ease-in forwards`
            : [
                `moonReveal ${RISE_MS}ms cubic-bezier(0.15, 0, 0.35, 1) forwards`,
                phase === "full" ? "moonGlow 3.5s ease-in-out infinite" : "",
              ].filter(Boolean).join(", "),
        }}
      >
        <MoonSprite />

        <div style={{
          position: "absolute",
          bottom: -28,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: 11,
          fontFamily: "system-ui, sans-serif",
          color: "rgba(216,180,254,0.7)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}>
          Click to Play
        </div>
      </button>
    </>
  );
}

function MoonSprite() {
  return (
    <svg
      width={110}
      height={110}
      viewBox="0 0 110 110"
      style={{ display: "block" }}
    >
      {/* Outer glow rings */}
      <circle cx="55" cy="55" r="52" fill="rgba(139,92,246,0.08)" />
      <circle cx="55" cy="55" r="48" fill="rgba(167,139,250,0.1)" />

      {/* Moon body */}
      <circle cx="55" cy="55" r="42" fill="#fef9c3" />
      <radialGradient id="moonShade" cx="38%" cy="38%" r="62%">
        <stop offset="0%"   stopColor="#fefce8" />
        <stop offset="60%"  stopColor="#fef08a" />
        <stop offset="100%" stopColor="#d4b70a" />
      </radialGradient>
      <circle cx="55" cy="55" r="42" fill="url(#moonShade)" />

      {/* Shadow crescent */}
      <path
        d="M 55,13 A 42,42 0 0 0 55,97 A 30,42 0 0 1 55,13"
        fill="rgba(20,10,40,0.18)"
      />

      {/* Craters */}
      <circle cx="40" cy="45" r="8" fill="rgba(180,150,10,0.25)"
        style={{ animation: "craterShimmer 4s ease-in-out infinite" }} />
      <circle cx="40" cy="45" r="8" fill="none" stroke="rgba(160,130,5,0.3)" strokeWidth="1.5" />

      <circle cx="65" cy="68" r="6" fill="rgba(180,150,10,0.2)"
        style={{ animation: "craterShimmer 5s ease-in-out infinite 1s" }} />
      <circle cx="65" cy="68" r="6" fill="none" stroke="rgba(160,130,5,0.25)" strokeWidth="1" />

      <circle cx="50" cy="72" r="4" fill="rgba(180,150,10,0.15)" />
      <circle cx="70" cy="40" r="3" fill="rgba(180,150,10,0.18)" />
      <circle cx="32" cy="63" r="2.5" fill="rgba(180,150,10,0.15)" />

      {/* Inner rim */}
      <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(253,230,138,0.4)" strokeWidth="1.5" />

      {/* Mysterious eye */}
      <ellipse cx="55" cy="50" rx="9" ry="7" fill="#1e0a3c" opacity="0.7" />
      <circle cx="55" cy="50" r="4" fill="#7c3aed" />
      <circle cx="55" cy="50" r="2" fill="#c4b5fd" />
      <circle cx="56.5" cy="48.5" r="0.9" fill="#f5f3ff" opacity="0.9" />
    </svg>
  );
}
