"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import CardGrid from "@entities/ui/listStyle/CardGrid";
import { getSecretGameById, listSecretGames, resolveSecretContainerMode } from "@features/secret-games";
import FakeCustomerGameCard, { type FakeCustomerGameSession } from "./FakeCustomerGameCard";
import { useSecretGamesSandbox } from "./SecretGamesSandboxContext";
import { FAKE_CASE_MANAGERS } from "./fixtures";

function buildInitialSessions(customerIds: string[]): Record<string, FakeCustomerGameSession> {
  return customerIds.reduce<Record<string, FakeCustomerGameSession>>((acc, customerId, index) => {
    const defaults = ["farm", "flip", "broken-data", "legacy-runner"] as const;
    acc[customerId] = {
      open: false,
      gameId: defaults[index % defaults.length],
    };
    return acc;
  }, {});
}

export default function SecretGamesCardsPage() {
  const searchParams = useSearchParams();
  const { visibleCustomers } = useSecretGamesSandbox();
  const requestedGameId = searchParams.get("game");
  const requestedCustomerId = searchParams.get("customer");
  const [availableWidth, setAvailableWidth] = React.useState(260);
  const [availableHeight, setAvailableHeight] = React.useState(180);
  const [previewGameId, setPreviewGameId] = React.useState("flip");
  const [sessions, setSessions] = React.useState<Record<string, FakeCustomerGameSession>>(() =>
    buildInitialSessions(visibleCustomers.map((customer) => customer.id)),
  );

  const previewGame = getSecretGameById(previewGameId);
  const previewResolution = React.useMemo(
    () =>
      previewGame
        ? resolveSecretContainerMode({
            game: previewGame,
            availableWidth,
            availableHeight,
          })
        : null,
    [availableHeight, availableWidth, previewGame],
  );

  React.useEffect(() => {
    setSessions((current) => {
      const next = { ...current };
      for (const customer of visibleCustomers) {
        if (!next[customer.id]) {
          next[customer.id] = {
            open: false,
            gameId: "flip",
          };
        }
      }
      return next;
    });
  }, [visibleCustomers]);

  React.useEffect(() => {
    if (!requestedGameId || !getSecretGameById(requestedGameId) || visibleCustomers.length === 0) return;

    const targetCustomer =
      visibleCustomers.find((customer) => customer.id === requestedCustomerId) || visibleCustomers[0] || null;
    if (!targetCustomer) return;

    setSessions((current) => ({
      ...current,
      [targetCustomer.id]: {
        open: true,
        gameId: requestedGameId,
      },
    }));
  }, [requestedCustomerId, requestedGameId, visibleCustomers]);

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Fake Customer Card Mounts</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Mount native and legacy-adapted secret games inside fake customer cards with fake case-manager scoping. This
          keeps the customer page isolated while the shared host takes shape.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Container Resolver Lab</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Adjust the available card dimensions and inspect how the typed resolver promotes a game from inline to
              expanded, focus, modal, or overlay.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              <div className="mb-1 font-semibold uppercase tracking-wide">Game</div>
              <select
                value={previewGameId}
                onChange={(event) => setPreviewGameId(event.currentTarget.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {listSecretGames().map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              <div className="mb-1 font-semibold uppercase tracking-wide">Available Width</div>
              <input
                type="range"
                min={160}
                max={640}
                step={20}
                value={availableWidth}
                onChange={(event) => setAvailableWidth(Number(event.currentTarget.value))}
                className="w-full"
              />
              <div className="mt-1">{availableWidth}px</div>
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              <div className="mb-1 font-semibold uppercase tracking-wide">Available Height</div>
              <input
                type="range"
                min={120}
                max={420}
                step={20}
                value={availableHeight}
                onChange={(event) => setAvailableHeight(Number(event.currentTarget.value))}
                className="w-full"
              />
              <div className="mt-1">{availableHeight}px</div>
            </label>
          </div>
        </div>

        {previewGame && previewResolution ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Resolution Summary
              </div>
              <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                {previewGame.title} prefers <strong>{previewResolution.preferredMode}</strong> and resolves to{" "}
                <strong>{previewResolution.mode}</strong>.
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Fallback chain: {previewResolution.fallbackChain.join(" -> ")}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Candidate Dimensions
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {previewResolution.fallbackChain.map((mode) => {
                  const candidate = previewResolution.candidateDimensions[mode];
                  return (
                    <div key={mode}>
                      {mode}: {candidate.width} x {candidate.height}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <CardGrid
        cols={2}
        isEmpty={visibleCustomers.length === 0}
        emptyState={
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No fake customers match the current case-manager filter.
          </div>
        }
      >
        {visibleCustomers.map((customer) => (
          <FakeCustomerGameCard
            key={customer.id}
            customer={customer}
            manager={FAKE_CASE_MANAGERS.find((manager) => manager.id === customer.caseManagerId) || null}
            session={sessions[customer.id] || { open: false, gameId: "flip" }}
            availableWidth={availableWidth}
            availableHeight={availableHeight}
            onSessionChange={(next) =>
              setSessions((current) => ({
                ...current,
                [customer.id]: next,
              }))
            }
          />
        ))}
      </CardGrid>
    </>
  );
}
