"use client";
// web/src/features/games/GameTriggersHost.tsx
// Renders ambient game triggers, gated by admin config + current route.
// Each trigger maps to a specific game:
//   Bug       → fullscreen Donkey Kong canvas game
//   Asteroid  → Space Invaders (mini-player)
//   Plant     → Tower Defense (mini-player)
//   Snake     → Snake (mini-player)

import React from "react";
import { usePathname } from "next/navigation";
import BugFloat from "./triggers/BugFloat";
import BugGameCanvas from "./BugGameCanvas";
import AsteroidFloat from "./triggers/AsteroidFloat";
import PlantFloat from "./triggers/PlantSprout";
import SnakeFloat from "./triggers/SnakeFloat";
import { padPlatforms, type Platform } from "./GameEngine";
import { useLegacySecretGameLauncher } from "@features/secret-games";
import { useOrgConfig } from "@hooks/useOrgConfig";
import {
  readSecretGamesAdminConfig,
  type AmbientTriggerId,
  type AmbientTriggerAdminEntry,
  type SecretGameRouteId,
} from "@features/secret-games/adminConfig";
import { useCardPhysics } from "./effects/CardPhysicsContext";
import { computeAsteroidHits, type AsteroidTrajectory } from "./effects/cardPhysicsEngine";

// ─── Route matching ───────────────────────────────────────────────────────────

function routeMatchesPathname(routeId: SecretGameRouteId, pathname: string): boolean {
  switch (routeId) {
    case "all":       return true;
    case "home":      return pathname === "/";
    case "customers": return pathname === "/customers" || pathname.startsWith("/customers/");
    case "grants":    return pathname === "/grants" || pathname.startsWith("/grants/");
    case "reports":   return pathname === "/reports" || pathname.startsWith("/reports/");
    default:          return false;
  }
}

function isTriggerAllowedOnRoute(
  entry: AmbientTriggerAdminEntry,
  pathname: string,
): boolean {
  return entry.allowedRoutes.some((routeId) => routeMatchesPathname(routeId, pathname));
}

// ─── DOM platform scanner (for bug's DK-style game) ──────────────────────────

function scanPlatforms(): Platform[] {
  try {
    const VW = window.innerWidth;
    const VH = window.innerHeight;
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-game-platform], .rounded-xl, .rounded-2xl, article, section",
      ),
    );
    const rects = els
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(
        ({ rect }) =>
          rect.width >= 120 &&
          rect.height >= 36 &&
          rect.top >= 20 &&
          rect.bottom <= VH - 20 &&
          rect.left >= 0 &&
          rect.right <= VW,
      );

    if (rects.length < 3) return [];

    const rows: Array<typeof rects> = [];
    for (const item of rects) {
      const existing = rows.find(
        (row) => Math.abs(row[0].rect.top - item.rect.top) < 50,
      );
      if (existing) existing.push(item);
      else rows.push([item]);
    }

    if (rows.length < 2) return [];
    rows.sort((a, b) => a[0].rect.top - b[0].rect.top);

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

function syntheticPlatforms(): Platform[] {
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const h = 56;
  const gap = Math.round((VH - 120) / 4);
  return [0, 1, 2, 3].map((row) => ({
    x: 40,
    y: 70 + row * gap,
    width: VW - 80,
    height: h,
    row,
  }));
}

// ─── Error boundary wrapping the bug canvas ───────────────────────────────────

class BugCanvasErrorBoundary extends React.Component<
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
    return this.state.crashed ? null : this.props.children;
  }
}

// ─── Host ─────────────────────────────────────────────────────────────────────

export default function GameTriggersHost() {
  const pathname = usePathname();
  const { data: orgConfig } = useOrgConfig();
  const launchLegacySecretGame = useLegacySecretGameLauncher("overlay-host");

  const config = React.useMemo(
    () => readSecretGamesAdminConfig(orgConfig?.secretGames),
    [orgConfig],
  );

  // Global gate: master must be on, kill switch off, ambient triggers enabled
  const globallyEnabled =
    config.flags.masterEnabled &&
    !config.flags.killSwitch &&
    config.flags.ambientTriggersEnabled;

  const triggerEnabled = React.useCallback(
    (id: AmbientTriggerId): boolean => {
      if (!globallyEnabled) return false;
      const entry = config.triggers[id];
      if (!entry?.enabled) return false;
      return isTriggerAllowedOnRoute(entry, pathname ?? "/");
    },
    [globallyEnabled, config.triggers, pathname],
  );

  const triggerMs = React.useCallback(
    (id: AmbientTriggerId) => {
      const entry = config.triggers[id];
      return {
        minIntervalMs: (entry?.minIntervalMinutes ?? 10) * 60_000,
        jitterMs: (entry?.jitterMinutes ?? 2) * 60_000,
      };
    },
    [config.triggers],
  );

  // Bug game state (fullscreen canvas)
  const [bugGameOpen, setBugGameOpen] = React.useState(false);
  const [platforms, setPlatforms] = React.useState<Platform[]>([]);

  const handleBugActivate = React.useCallback(() => {
    try {
      const VW = window.innerWidth;
      const VH = window.innerHeight;
      const detected = scanPlatforms();
      const base = detected.length >= 2 ? detected : syntheticPlatforms();
      setPlatforms(padPlatforms(base, VW, VH));
    } catch {
      setPlatforms(syntheticPlatforms());
    }
    setBugGameOpen(true);
  }, []);

  const handleBugEnd = React.useCallback(() => setBugGameOpen(false), []);

  const cardPhysics = useCardPhysics();

  const handleAsteroidTrajectory = React.useCallback(
    (trajectory: AsteroidTrajectory) => {
      if (!cardPhysics) return;
      const hits = computeAsteroidHits(trajectory);
      for (const { cardId, hitTimeMs } of hits) {
        setTimeout(() => cardPhysics.hitCard(cardId), hitTimeMs);
      }
    },
    [cardPhysics],
  );

  const handleAsteroidActivate = React.useCallback(
    () => launchLegacySecretGame("legacy-space-invaders", { source: "hidden-ui" }),
    [launchLegacySecretGame],
  );
  const handlePlantActivate = React.useCallback(
    () => launchLegacySecretGame("legacy-tower-defense", { source: "hidden-ui" }),
    [launchLegacySecretGame],
  );
  const handleSnakeActivate = React.useCallback(
    () => launchLegacySecretGame("legacy-snake", { source: "hidden-ui" }),
    [launchLegacySecretGame],
  );

  const bugMs = triggerMs("bug");
  const asteroidMs = triggerMs("asteroid");
  const plantMs = triggerMs("plant");
  const snakeMs = triggerMs("snake");

  return (
    <>
      {/* 🪲 Bug → fullscreen DK-style canvas game */}
      {triggerEnabled("bug") && !bugGameOpen && (
        <BugFloat
          onActivate={handleBugActivate}
          minIntervalMs={bugMs.minIntervalMs}
          jitterMs={bugMs.jitterMs}
        />
      )}
      {bugGameOpen && platforms.length > 0 && (
        <BugCanvasErrorBoundary onError={handleBugEnd}>
          <BugGameCanvas platforms={platforms} onEnd={handleBugEnd} />
        </BugCanvasErrorBoundary>
      )}

      {/* ☄️ Asteroid → Space Invaders + card physics */}
      {triggerEnabled("asteroid") && (
        <AsteroidFloat
          onActivate={handleAsteroidActivate}
          onTrajectory={handleAsteroidTrajectory}
          minIntervalMs={asteroidMs.minIntervalMs}
          jitterMs={asteroidMs.jitterMs}
        />
      )}

      {/* 🌱 Plant → Tower Defense */}
      {triggerEnabled("plant") && (
        <PlantFloat
          onActivate={handlePlantActivate}
          minIntervalMs={plantMs.minIntervalMs}
          jitterMs={plantMs.jitterMs}
        />
      )}

      {/* 🐍 Snake → Snake */}
      {triggerEnabled("snake") && (
        <SnakeFloat
          onActivate={handleSnakeActivate}
          minIntervalMs={snakeMs.minIntervalMs}
          jitterMs={snakeMs.jitterMs}
        />
      )}
    </>
  );
}
