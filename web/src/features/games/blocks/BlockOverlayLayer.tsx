"use client";
// web/src/features/games/blocks/BlockOverlayLayer.tsx
// Renders SVG overlays directly over cards in non-normal block states:
//   • cracked-1  → orange hairline crack
//   • cracked-0  → deep red spiderweb cracks + dark vignette
//   • error      → red ⚠ badge in corner
//   • farming    → crop emoji + harvest bar
//
// Uses position:fixed, reads card rects from DOM via data-block-id.
// Refreshes on scroll/resize and whenever blocks state changes.

import React from "react";
import { useBlockLayerMaybe } from "./BlockLayerContext";
import type { BlockRecord, CropType } from "./blockTypes";
import { CROP_MATURE_MS } from "./blockTypes";

interface OverlayEntry {
  blockId: string;
  mode: BlockRecord["mode"];
  hp: number;
  rect: DOMRect;
  errorMessage?: string;
  farmPlots?: BlockRecord["farmPlots"];
}

function collectEntries(blocks: Record<string, BlockRecord>): OverlayEntry[] {
  const result: OverlayEntry[] = [];
  for (const [blockId, rec] of Object.entries(blocks)) {
    if (rec.mode !== "cracked" && rec.mode !== "error" && rec.mode !== "farming") continue;
    const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4) continue;
    result.push({ blockId, mode: rec.mode, hp: rec.hp, rect, errorMessage: rec.errorMessage, farmPlots: rec.farmPlots });
  }
  return result;
}

export default function BlockOverlayLayer() {
  const layer = useBlockLayerMaybe();
  const [entries, setEntries] = React.useState<OverlayEntry[]>([]);

  React.useEffect(() => {
    if (!layer) return;
    const refresh = () => setEntries(collectEntries(layer.blocks));
    refresh();
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh, { passive: true });
    return () => {
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [layer, layer?.blocks]);

  if (!entries.length) return null;

  return (
    <>
      {entries.map((e) => (
        <OverlaySprite key={e.blockId} entry={e} />
      ))}
    </>
  );
}

// ─── Individual overlay ───────────────────────────────────────────────────────

function OverlaySprite({ entry }: { entry: OverlayEntry }) {
  const { rect, mode, hp, errorMessage, farmPlots } = entry;
  const { left, top, width, height } = rect;

  const style: React.CSSProperties = {
    position: "fixed",
    left, top, width, height,
    pointerEvents: "none",
    zIndex: 9970,
    overflow: "hidden",
    borderRadius: 20,
  };

  if (mode === "cracked") {
    return (
      <svg style={style} viewBox={`0 0 ${Math.round(width)} ${Math.round(height)}`} preserveAspectRatio="none">
        {hp === 2 ? (
          // Light crack — single diagonal hairline
          <CrackLight w={width} h={height} />
        ) : (
          // Heavy cracks — spiderweb + vignette
          <CrackHeavy w={width} h={height} />
        )}
      </svg>
    );
  }

  if (mode === "error") {
    return (
      <div style={style}>
        <ErrorBadge message={errorMessage} />
      </div>
    );
  }

  if (mode === "farming" && farmPlots && farmPlots.length > 0) {
    return (
      <div style={style}>
        <FarmOverlay plots={farmPlots} />
      </div>
    );
  }

  return null;
}

// ─── Crack overlays ───────────────────────────────────────────────────────────

function CrackLight({ w, h }: { w: number; h: number }) {
  // Single diagonal crack from upper-right area downward
  const cx = w * 0.65, cy = h * 0.12;
  const mx = w * 0.52, my = h * 0.45;
  const ex = w * 0.7,  ey = h * 0.78;
  return (
    <g opacity={0.7}>
      <path
        d={`M${cx},${cy} L${mx},${my} L${ex},${ey}`}
        stroke="#f97316" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <path
        d={`M${mx},${my} L${w * 0.38},${h * 0.6}`}
        stroke="#f97316" strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.6}
      />
    </g>
  );
}

function CrackHeavy({ w, h }: { w: number; h: number }) {
  // Spiderweb radiating from upper-center impact point
  const ox = w * 0.5, oy = h * 0.22;
  const lines: [number, number, number, number][] = [
    [ox, oy, w * 0.12, h * 0.85],
    [ox, oy, w * 0.82, h * 0.9],
    [ox, oy, w * 0.04, h * 0.45],
    [ox, oy, w * 0.9, h * 0.55],
    [ox, oy, w * 0.42, h * 0.95],
    [ox, oy, w * 0.7, h * 0.1],
    [ox, oy, w * 0.22, h * 0.15],
  ];
  return (
    <g>
      {/* Dark vignette tint */}
      <rect x={0} y={0} width={w} height={h} fill="rgba(127,17,17,0.08)" />
      {/* Impact burst */}
      <circle cx={ox} cy={oy} r={6} fill="rgba(239,68,68,0.25)" />
      <circle cx={ox} cy={oy} r={3} fill="rgba(239,68,68,0.55)" />
      {/* Crack lines */}
      {lines.map(([x1, y1, x2, y2], i) => (
        <g key={i}>
          <path
            d={crackPath(x1, y1, x2, y2)}
            stroke="#dc2626" strokeWidth={i < 2 ? 1.8 : 1.2} strokeLinecap="round"
            fill="none" opacity={0.75}
          />
          {/* Sub-branch on longer cracks */}
          {i < 3 && (
            <path
              d={crackPath(
                x1 + (x2 - x1) * 0.5, y1 + (y2 - y1) * 0.5,
                x1 + (x2 - x1) * 0.5 + (y2 - y1) * 0.18,
                y1 + (y2 - y1) * 0.5 - (x2 - x1) * 0.18,
              )}
              stroke="#ef4444" strokeWidth={0.8} fill="none" opacity={0.55}
            />
          )}
        </g>
      ))}
    </g>
  );
}

// Add slight jaggediness to a straight line
function crackPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2 + (y2 - y1) * 0.07;
  const my = (y1 + y2) / 2 - (x2 - x1) * 0.07;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

// ─── Error badge ──────────────────────────────────────────────────────────────

function ErrorBadge({ message }: { message?: string }) {
  const short = message ? message.split(":")[0].slice(0, 28) : "System error";
  return (
    <>
      <style>{`
        @keyframes errBadgePop {
          0%   { opacity: 0; transform: scale(0.6) translateY(-4px); }
          18%  { opacity: 1; transform: scale(1.05) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes errPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50%      { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "rgba(127,0,0,0.92)",
          border: "1px solid rgba(239,68,68,0.7)",
          borderRadius: 6,
          padding: "3px 7px",
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "monospace",
          color: "#fca5a5",
          letterSpacing: "0.03em",
          maxWidth: "calc(100% - 12px)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          animation: "errBadgePop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards, errPulse 1.4s ease-in-out 0.35s infinite",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        {/* Warning triangle SVG */}
        <svg width={11} height={11} viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
          <polygon points="6,0.5 11.5,11 0.5,11" fill="#ef4444" />
          <text x="6" y="9.5" textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">!</text>
        </svg>
        {short}
      </div>
    </>
  );
}

// ─── Farm overlay ─────────────────────────────────────────────────────────────

const CROP_ICONS: Record<CropType, string> = {
  wheat:    "🌾",
  carrot:   "🥕",
  flower:   "🌸",
  mushroom: "🍄",
};

function FarmOverlay({ plots }: { plots: BlockRecord["farmPlots"] }) {
  const now = Date.now();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 6,
        left: 8,
        display: "flex",
        gap: 4,
        alignItems: "flex-end",
      }}
    >
      {plots.filter(p => !p.harvested).map((plot) => {
        const elapsed = now - plot.plantedAt;
        const total = CROP_MATURE_MS[plot.crop];
        const pct = Math.min(1, elapsed / total);
        const mature = pct >= 1;
        return (
          <div
            key={plot.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            {/* Crop icon */}
            <span
              style={{
                fontSize: mature ? 14 : 10 + pct * 4,
                lineHeight: 1,
                filter: mature ? "drop-shadow(0 0 4px rgba(74,222,128,0.7))" : undefined,
                transition: "font-size 0.5s",
              }}
              title={`${plot.crop} — ${mature ? "Ready!" : `${Math.round(pct * 100)}%`}`}
            >
              {CROP_ICONS[plot.crop]}
            </span>
            {/* Growth bar */}
            <div
              style={{
                width: 14,
                height: 3,
                borderRadius: 2,
                background: "rgba(0,0,0,0.3)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(pct * 100)}%`,
                  background: mature ? "#4ade80" : "#86efac",
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
