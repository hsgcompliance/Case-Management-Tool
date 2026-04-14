"use client";
// web/src/features/games/BugGameHost.tsx
// Mounts the ambient bug + manages game lifecycle.
// Completely self-contained — safe to mount anywhere. If something inside
// throws, the error stays in here and doesn't affect the main app.

import React from "react";
import BugFloat from "./BugFloat";
import BugGameCanvas from "./BugGameCanvas";
import { padPlatforms, type Platform } from "./GameEngine";

// ─── DOM platform scanner ─────────────────────────────────────────────────────

/**
 * Scan the live DOM for card-like visible elements and convert to Platform structs.
 * Returns an empty array if nothing useful is found.
 */
function scanPlatforms(): Platform[] {
  try {
    const VW = window.innerWidth;
    const VH = window.innerHeight;

    // Broad selector: anything that looks like a visible card/panel with a border
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-game-platform], .rounded-xl, .rounded-2xl, article, section'
      )
    );

    const rects = els
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) =>
        rect.width >= 120 &&
        rect.height >= 36 &&
        rect.top >= 20 &&
        rect.bottom <= VH - 20 &&
        rect.left >= 0 &&
        rect.right <= VW
      );

    if (rects.length < 3) return [];

    // Group into rows by Y proximity (within 50px)
    const rows: Array<typeof rects> = [];
    for (const item of rects) {
      const existing = rows.find(
        (row) => Math.abs(row[0].rect.top - item.rect.top) < 50
      );
      if (existing) existing.push(item);
      else rows.push([item]);
    }

    // Need at least 2 distinct rows to be interesting
    if (rows.length < 2) return [];

    // Sort rows top-to-bottom
    rows.sort((a, b) => a[0].rect.top - b[0].rect.top);

    // Convert to Platform[]
    const platforms: Platform[] = [];
    rows.forEach((row, rowIdx) => {
      row.forEach(({ rect }) => {
        platforms.push({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          row: rowIdx,
        });
      });
    });

    return platforms;
  } catch {
    return [];
  }
}

// ─── Synthetic fallback platforms ─────────────────────────────────────────────

/** Generate 4 evenly spaced platform rows when DOM scanning yields nothing. */
function syntheticPlatforms(): Platform[] {
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const h = 56;
  const usableH = VH - 120;
  const gap = Math.round(usableH / 4);
  return [0, 1, 2, 3].map((row) => ({
    x: 40,
    y: 70 + row * gap,
    width: VW - 80,
    height: h,
    row,
  }));
}

// ─── Host ─────────────────────────────────────────────────────────────────────

export default function BugGameHost() {
  const [gameOpen, setGameOpen] = React.useState(false);
  const [platforms, setPlatforms] = React.useState<Platform[]>([]);

  const handleActivate = React.useCallback(() => {
    try {
      const VW = window.innerWidth;
      const VH = window.innerHeight;
      const detected = scanPlatforms();
      // padPlatforms requires a non-empty array (it reads the last row's geometry)
      // so fall back to synthetic before padding if DOM yielded nothing
      const base = detected.length >= 2 ? detected : syntheticPlatforms();
      setPlatforms(padPlatforms(base, VW, VH));
    } catch {
      setPlatforms(syntheticPlatforms());
    }
    setGameOpen(true);
  }, []);

  const handleEnd = React.useCallback(() => {
    setGameOpen(false);
  }, []);

  // Safety: if the canvas throws, hide it gracefully
  if (gameOpen && platforms.length === 0) {
    setGameOpen(false);
    return null;
  }

  return (
    <>
      {!gameOpen && <BugFloat onActivate={handleActivate} />}
      {gameOpen && (
        <BugGameErrorBoundary onError={handleEnd}>
          <BugGameCanvas platforms={platforms} onEnd={handleEnd} />
        </BugGameErrorBoundary>
      )}
    </>
  );
}

// ─── Tiny error boundary ──────────────────────────────────────────────────────

class BugGameErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { crashed: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.crashed) return null;
    return this.props.children;
  }
}
