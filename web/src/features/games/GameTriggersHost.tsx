"use client";
// web/src/features/games/GameTriggersHost.tsx
// Live ambient-trigger host for production routes.
// The bug game is intentionally siloed out of this host: we keep its renderer
// in the repo for later reuse, but we do not mount, scan, or launch it here.
// That keeps the rest of the app disconnected from the old bug-specific logic
// while preserving the cleaner overlay patterns for future immersive games.

import React from "react";
import { usePathname } from "next/navigation";
import AsteroidFloat from "./triggers/AsteroidFloat";
import PlantFloat from "./triggers/PlantSprout";
import SnakeFloat from "./triggers/SnakeFloat";
import FarmFloat from "./triggers/FarmFloat";
import AlertBadge from "./triggers/AlertBadge";
import MoonRise from "./triggers/MoonRise";
import { useLegacySecretGameLauncher } from "@features/secret-games";
import { toast } from "@lib/toast";
import { useOrgConfig } from "@hooks/useOrgConfig";
import {
  readSecretGamesAdminConfig,
  type AmbientTriggerId,
  type AmbientTriggerAdminEntry,
  type SecretGameRouteId,
} from "@features/secret-games/adminConfig";
import { useCardPhysics } from "./effects/CardPhysicsContext";
import { computeAsteroidHits, type AsteroidTrajectory } from "./effects/cardPhysicsEngine";
import NecromancerGame, { scanCustomersFromDOM } from "./necromancer/NecromancerGame";

function routeMatchesPathname(routeId: SecretGameRouteId, pathname: string): boolean {
  switch (routeId) {
    case "all":
      return true;
    case "home":
      return pathname === "/";
    case "customers":
      return pathname === "/customers" || pathname.startsWith("/customers/");
    case "grants":
      return pathname === "/grants" || pathname.startsWith("/grants/");
    case "reports":
      return pathname === "/reports" || pathname.startsWith("/reports/");
    default:
      return false;
  }
}

function isTriggerAllowedOnRoute(entry: AmbientTriggerAdminEntry, pathname: string): boolean {
  return entry.allowedRoutes.some((routeId) => routeMatchesPathname(routeId, pathname));
}

export default function GameTriggersHost() {
  const pathname = usePathname();
  const { data: orgConfig } = useOrgConfig();
  const launchLegacySecretGame = useLegacySecretGameLauncher("overlay-host");

  const config = React.useMemo(
    () => readSecretGamesAdminConfig(orgConfig?.secretGames),
    [orgConfig],
  );

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

  // Necromancer still mounts as a zero-DOM-disruption overlay over the page.
  const [necroOpen, setNecroOpen] = React.useState(false);
  const [necroCustomers, setNecroCustomers] = React.useState<ReturnType<typeof scanCustomersFromDOM>>([]);

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
  const handleFarmActivate = React.useCallback(() => {
    toast("Farm game - prototype, not yet playable", { type: "info" });
  }, []);
  const handleAlertActivate = React.useCallback(() => {
    toast("Broken Data - prototype, not yet playable", { type: "info" });
  }, []);
  const handleMoonActivate = React.useCallback(() => {
    const customers = scanCustomersFromDOM();
    setNecroCustomers(customers);
    setNecroOpen(true);
  }, []);

  const asteroidMs = triggerMs("asteroid");
  const plantMs = triggerMs("plant");
  const snakeMs = triggerMs("snake");
  const moonMs = triggerMs("moon");
  const farmMs = triggerMs("farm");
  const alertMs = triggerMs("alert");

  return (
    <>
      {triggerEnabled("asteroid") && (
        <AsteroidFloat
          onActivate={handleAsteroidActivate}
          onTrajectory={handleAsteroidTrajectory}
          minIntervalMs={asteroidMs.minIntervalMs}
          jitterMs={asteroidMs.jitterMs}
        />
      )}

      {triggerEnabled("plant") && (
        <PlantFloat
          onActivate={handlePlantActivate}
          minIntervalMs={plantMs.minIntervalMs}
          jitterMs={plantMs.jitterMs}
        />
      )}

      {triggerEnabled("snake") && (
        <SnakeFloat
          onActivate={handleSnakeActivate}
          minIntervalMs={snakeMs.minIntervalMs}
          jitterMs={snakeMs.jitterMs}
        />
      )}

      {triggerEnabled("moon") && (
        <MoonRise
          onActivate={handleMoonActivate}
          minIntervalMs={moonMs.minIntervalMs}
          jitterMs={moonMs.jitterMs}
        />
      )}

      {triggerEnabled("farm") && (
        <FarmFloat
          onActivate={handleFarmActivate}
          minIntervalMs={farmMs.minIntervalMs}
          jitterMs={farmMs.jitterMs}
        />
      )}

      {triggerEnabled("alert") && (
        <AlertBadge
          onActivate={handleAlertActivate}
          minIntervalMs={alertMs.minIntervalMs}
          jitterMs={alertMs.jitterMs}
        />
      )}

      {necroOpen && (
        <NecromancerGame
          customers={necroCustomers}
          onEnd={() => setNecroOpen(false)}
        />
      )}
    </>
  );
}
