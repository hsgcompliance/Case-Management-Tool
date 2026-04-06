"use client";

import React from "react";

export type InboxCompletionBalloonProps = {
  visible: boolean;
  onClick: () => void;
  onDismiss: () => void;
};

// Game accent hex colors (Runner=amber, Snake=emerald, Space=violet, Tower=sky)
// Kept as raw values so Tailwind purge doesn't affect them; mystery which is which.
const ACCENT_COLORS = ["#f59e0b", "#10b981", "#8b5cf6", "#0ea5e9"] as const;

type Particle = {
  id: number;
  color: string;
  left: number;   // % across screen
  size: number;   // px
  delay: number;  // s animation delay
  dur: number;    // s fall duration
  drift: number;  // px horizontal drift
  shape: "circle" | "square" | "star";
};

const PARTICLE_COUNT = 22;

function useParticles(): Particle[] {
  return React.useMemo(() => {
    const shapes: Particle["shape"][] = ["circle", "square", "star"];
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      color: ACCENT_COLORS[i % ACCENT_COLORS.length],
      left: 3 + (i * 4.3 + (i % 3) * 2.7) % 94, // spread across width
      size: 8 + (i % 5) * 3,
      delay: (i * 0.31) % 2.8,
      dur: 4.5 + (i % 4) * 0.6,
      drift: ((i % 5) - 2) * 18,
      shape: shapes[i % shapes.length],
    }));
  }, []);
}

function StarShape({ size, color }: { size: number; color: string }) {
  // simple 4-point star via clip-path
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
      }}
    />
  );
}

export function InboxCompletionBalloon({ visible, onClick, onDismiss }: InboxCompletionBalloonProps) {
  const particles = useParticles();

  React.useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => onDismiss(), 12000);
    return () => window.clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <style>{`
        @keyframes particleFall {
          0%   { transform: translateY(-60px) translateX(0px); opacity: 0; }
          8%   { opacity: 1; }
          80%  { opacity: 0.85; }
          100% { transform: translateY(105vh) translateX(var(--drift)); opacity: 0; }
        }
        @keyframes celebBadgeDrift {
          0%   { transform: translateY(-40px) scale(0.8); opacity: 0; }
          12%  { transform: translateY(0px) scale(1); opacity: 1; }
          85%  { transform: translateY(0px) scale(1); opacity: 1; }
          100% { transform: translateY(12px) scale(1); opacity: 0; }
        }
      `}</style>

      {/* Falling particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            animationName: "particleFall",
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: "ease-in",
            animationFillMode: "both",
            // CSS custom property for drift
            ["--drift" as string]: `${p.drift}px`,
          }}
        >
          {p.shape === "circle" && (
            <div
              style={{
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                backgroundColor: p.color,
              }}
            />
          )}
          {p.shape === "square" && (
            <div
              style={{
                width: p.size,
                height: p.size,
                borderRadius: 2,
                backgroundColor: p.color,
                transform: "rotate(30deg)",
              }}
            />
          )}
          {p.shape === "star" && <StarShape size={p.size} color={p.color} />}
        </div>
      ))}

      {/* Click-to-open badge */}
      <button
        type="button"
        className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2 rounded-xl border border-white/20 bg-gradient-to-r from-sky-600 via-violet-600 to-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm"
        style={{ animation: "celebBadgeDrift 10s ease forwards" }}
        onClick={onClick}
      >
        🎉 All tasks complete — take a quick break!
      </button>
    </div>
  );
}

export default InboxCompletionBalloon;
