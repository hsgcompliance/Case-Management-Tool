"use client";
// web/src/features/games/effects/CardCharacterLayer.tsx
// Renders fixed-position character sprites for every block in "character" mode.
// Each sprite is a circle head + downward-triangle body + floating name tag,
// colored deterministically from the block's characterSeed.
// Name is read from the DOM element's data-block-name attribute.

import React from "react";
import { useBlockLayerMaybe } from "../blocks/BlockLayerContext";
import type { BlockRecord } from "../blocks/blockTypes";

const CHAR_COLORS = [
  "#f87171", // red
  "#fb923c", // orange
  "#fbbf24", // amber
  "#34d399", // emerald
  "#38bdf8", // sky
  "#818cf8", // indigo
  "#f472b6", // pink
  "#a78bfa", // violet
];

function pickColor(seed: number, offset: number): string {
  const idx = (Math.floor(seed * CHAR_COLORS.length) + offset) % CHAR_COLORS.length;
  return CHAR_COLORS[idx];
}

interface CharPos {
  blockId: string;
  name: string;
  cx: number;
  cy: number;
  headColor: string;
  bodyColor: string;
  seed: number;
}

function computePositions(blocks: Record<string, BlockRecord>): CharPos[] {
  const result: CharPos[] = [];
  for (const [blockId, rec] of Object.entries(blocks)) {
    if (rec.mode !== "character") continue;
    const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4) continue;
    const seed = rec.characterSeed ?? 0.42;
    const s = ((seed * 2654435761) >>> 0) / 0xffffffff; // one-pass mix
    result.push({
      blockId,
      name: el.getAttribute("data-block-name") ?? blockId,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      headColor: pickColor(s, 0),
      bodyColor: pickColor(s, 3),
      seed: s,
    });
  }
  return result;
}

export default function CardCharacterLayer() {
  const layer = useBlockLayerMaybe();
  const [chars, setChars] = React.useState<CharPos[]>([]);

  React.useEffect(() => {
    if (!layer) return;

    const refresh = () => setChars(computePositions(layer.blocks));

    refresh();

    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh, { passive: true });
    return () => {
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [layer, layer?.blocks]);

  if (!chars.length) return null;

  return (
    <>
      <style>{`
        @keyframes charPopIn {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0); }
          65%  { opacity: 1; transform: translate(-50%, -50%) scale(1.18); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes charBob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes nameTagPulse {
          0%, 100% { opacity: 0.92; }
          50%       { opacity: 1; }
        }
      `}</style>
      {chars.map((c) => (
        <CharacterSprite key={c.blockId} {...c} />
      ))}
    </>
  );
}

// ─── Character sprite ─────────────────────────────────────────────────────────

function CharacterSprite({ cx, cy, name, headColor, bodyColor }: CharPos) {
  return (
    // Outer: fixed position anchor + bob animation
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: cx,
        top: cy,
        zIndex: 9975,
        pointerEvents: "none",
        animation: "charBob 2.6s ease-in-out 0.55s infinite",
      }}
    >
      {/* Inner: centering + pop-in */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          animation: "charPopIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Name tag */}
        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 999,
            padding: "2px 9px",
            fontSize: 10,
            fontWeight: 700,
            color: "#334155",
            whiteSpace: "nowrap",
            maxWidth: 130,
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
            letterSpacing: "0.02em",
            animation: "nameTagPulse 3s ease-in-out infinite",
          }}
        >
          {name}
        </div>

        {/* Head */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: headColor,
            border: "2.5px solid rgba(0,0,0,0.14)",
            boxShadow: `0 2px 8px rgba(0,0,0,0.22), inset 0 1px 2px rgba(255,255,255,0.35)`,
            flexShrink: 0,
          }}
        />

        {/* Body — downward-pointing triangle */}
        <svg
          width={38}
          height={30}
          viewBox="0 0 38 30"
          style={{ display: "block", flexShrink: 0 }}
        >
          {/* Shadow ellipse */}
          <ellipse cx={19} cy={29} rx={12} ry={2.5} fill="rgba(0,0,0,0.12)" />
          {/* Triangle torso */}
          <polygon
            points="19,30 3,3 35,3"
            fill={bodyColor}
            stroke="rgba(0,0,0,0.14)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Highlight sheen */}
          <polygon
            points="19,30 3,3 11,3"
            fill="rgba(255,255,255,0.18)"
          />
        </svg>
      </div>
    </div>
  );
}
