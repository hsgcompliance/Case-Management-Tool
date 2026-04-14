"use client";

import React from "react";
import { GAME_REGISTRY } from "@features/games/registry";
import {
  getSecretGameById,
} from "./registry";
import { getLegacySecretGameByLegacyGameId } from "./legacyAdapterData";
import { getSecretContainerStateClasses, resolveSecretContainerMode } from "./containerResolver";
import { getSecretGameRuntimeComponent } from "./runtimeRegistry";
import type { ContainerMode, MinigameMountContext } from "./types";

type CustomerCardGameCustomer = {
  id: string;
};

type CustomerCardGameManager = {
  name?: string;
  id?: string;
} | null;

type CustomerCardGameHostProps = {
  customer: CustomerCardGameCustomer;
  manager: CustomerCardGameManager;
  gameId: string;
  open: boolean;
  availableWidth: number;
  availableHeight: number;
  onOpenChange: (next: boolean) => void;
};

type MeasuredSize = {
  width: number;
  height: number;
};

const SecretGameMountContext = React.createContext<MinigameMountContext | null>(null);

export function useSecretGameMountContext() {
  const ctx = React.useContext(SecretGameMountContext);
  if (!ctx) {
    throw new Error("useSecretGameMountContext must be used inside a CustomerCardGameHost mount.");
  }
  return ctx;
}

function useMeasuredSize<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [size, setSize] = React.useState<MeasuredSize>({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      const next = {
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      };

      setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export function resolveCustomerCardMountContext(args: {
  customer: CustomerCardGameCustomer;
  manager: CustomerCardGameManager;
  width: number;
  height: number;
}): MinigameMountContext {
  return {
    routeKind: "customer-card",
    customerId: args.customer.id,
    availableWidth: args.width,
    availableHeight: args.height,
    featureFlags: {},
    userId: args.manager?.id,
  };
}

export function getCustomerCardMountSize(args: {
  measured: MeasuredSize;
  fallbackWidth: number;
  fallbackHeight: number;
}): MeasuredSize {
  return {
    width: args.measured.width > 0 ? args.measured.width : args.fallbackWidth,
    height: args.measured.height > 0 ? args.measured.height : args.fallbackHeight,
  };
}

function getResolvedGame(gameId: string, secretGameId: string | null) {
  const direct = GAME_REGISTRY.find((game) => game.id === gameId);
  if (direct) return direct;

  if (!secretGameId) return null;
  const secretGame = getSecretGameById(secretGameId);
  const legacyGameId = secretGame?.legacyAdapter?.legacyGameId;
  return legacyGameId ? GAME_REGISTRY.find((game) => game.id === legacyGameId) ?? null : null;
}

function getSecretGame(gameId: string) {
  return getSecretGameById(gameId) || getLegacySecretGameByLegacyGameId(gameId);
}

export default function CustomerCardGameHost({
  customer,
  manager,
  gameId,
  open,
  availableWidth,
  availableHeight,
  onOpenChange,
}: CustomerCardGameHostProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const measured = useMeasuredSize(hostRef);
  const hostSize = React.useMemo(
    () => getCustomerCardMountSize({ measured, fallbackWidth: availableWidth, fallbackHeight: availableHeight }),
    [availableHeight, availableWidth, measured],
  );

  const secretGame = React.useMemo(() => getSecretGame(gameId), [gameId]);
  const activeGame = React.useMemo(
    () => getResolvedGame(gameId, secretGame?.id || null),
    [gameId, secretGame],
  );
  const runtimeComponent = React.useMemo(
    () => (secretGame ? getSecretGameRuntimeComponent(secretGame.id) : null),
    [secretGame],
  );
  const resolution = React.useMemo(
    () =>
      secretGame
        ? resolveSecretContainerMode({
            game: secretGame,
            availableWidth: hostSize.width,
            availableHeight: hostSize.height,
          })
        : null,
    [hostSize.height, hostSize.width, secretGame],
  );
  const mountContext = React.useMemo(
    () =>
      resolveCustomerCardMountContext({
        customer,
        manager,
        width: hostSize.width,
        height: hostSize.height,
      }),
    [customer, hostSize.height, hostSize.width, manager],
  );
  const stateClasses = open && resolution ? getSecretContainerStateClasses(resolution.mode) : "";
  const effectiveMode: ContainerMode | "idle" = open && resolution ? resolution.mode : "idle";

  return (
    <SecretGameMountContext.Provider value={mountContext}>
      <section
        ref={hostRef}
        className={[
          "overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950",
          stateClasses,
        ].join(" ")}
        data-game-host=""
        data-game-host-mode={effectiveMode}
        data-game-host-width={hostSize.width}
        data-game-host-height={hostSize.height}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {activeGame?.title || secretGame?.title || "Unregistered Secret Game"}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {open && resolution
                ? `Mounted inside ${resolution.mode} -> ${resolution.fallbackChain.join(" -> ")}`
                : "Card host idle"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-[11px] text-slate-500 dark:text-slate-400">{customer.id}</code>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                open
                  ? "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  : "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900",
              ].join(" ")}
            >
              {open ? "Close" : "Mount"}
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="grid gap-3 text-[11px] text-slate-500 dark:text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="font-semibold uppercase tracking-wide">Case Manager</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{manager?.name || "Unassigned"}</div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide">Mount Context</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{mountContext.routeKind}</div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide">Measured Size</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {hostSize.width} x {hostSize.height}
              </div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide">Resolved Mode</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {open && resolution ? resolution.mode : "idle"}
              </div>
            </div>
          </div>
        </div>

        {open ? (
          <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {runtimeComponent && secretGame ? (
              <div
                className="min-h-[220px]"
                style={{
                  minHeight: resolution ? resolution.candidateDimensions[resolution.mode].height : hostSize.height || 220,
                }}
              >
                {React.createElement(runtimeComponent, {
                  definition: secretGame,
                  mountContext,
                  onRequestClose: () => onOpenChange(false),
                })}
              </div>
            ) : activeGame ? (
              <div
                className="min-h-[220px]"
                style={{
                  minHeight: resolution ? resolution.candidateDimensions[resolution.mode].height : hostSize.height || 220,
                }}
              >
                <activeGame.Component embedded renderStyle="embedded" />
              </div>
            ) : secretGame ? (
              <div className="flex min-h-[220px] flex-col justify-center px-4 py-10 text-sm text-slate-500 dark:text-slate-400">
                <div className="font-medium text-slate-700 dark:text-slate-200">{secretGame.title}</div>
                <div className="mt-1">{secretGame.description}</div>
                <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950">
                  Legacy adapter wiring for this game is not mounted yet.
                </div>
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center px-4 py-10 text-sm text-slate-500 dark:text-slate-400">
                No mounted game implementation is available for this registry id.
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
            Card host idle. Open the card to mount the game without touching the production customer page.
          </div>
        )}
      </section>
    </SecretGameMountContext.Provider>
  );
}
