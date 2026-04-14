"use client";

import React from "react";
import CustomerCardGameHost from "@features/secret-games/CustomerCardGameHost";
import { getSecretGameById, listSecretGames } from "@features/secret-games";
import { hasSecretGameRuntimeComponent } from "@features/secret-games/runtimeRegistry";
import type { FakeCaseManager, FakeCustomerRecord } from "./fixtures";

export type FakeCustomerGameSession = {
  open: boolean;
  gameId: string;
};

function statusClasses(status: FakeCustomerRecord["status"]) {
  if (status === "urgent") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300";
  if (status === "watch") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300";
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300";
}

const SELECTABLE_CARD_GAMES = listSecretGames().filter((game) => {
  if (hasSecretGameRuntimeComponent(game.id)) return true;
  return game.kind === "legacy-adapter" && game.legacyAdapter?.launchHost === "mini-player";
});

export default function FakeCustomerGameCard({
  customer,
  manager,
  session,
  onSessionChange,
  availableWidth,
  availableHeight,
}: {
  customer: FakeCustomerRecord;
  manager: FakeCaseManager | null;
  session: FakeCustomerGameSession;
  onSessionChange: (next: FakeCustomerGameSession) => void;
  availableWidth: number;
  availableHeight: number;
}) {
  const activeGame = React.useMemo(() => getSecretGameById(session.gameId), [session.gameId]);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{customer.name}</h2>
              <span className={["rounded-full border px-2 py-0.5 text-[11px] font-medium", statusClasses(customer.status)].join(" ")}>
                {customer.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{customer.note}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div>
              <div className="font-semibold uppercase tracking-wide">Case Manager</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{manager?.name || "Unassigned"}</div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide">Population</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {customer.population} / {customer.householdSize}
              </div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide">Acuity</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{customer.acuity}</div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide">Mounted Game</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{activeGame?.title || "Unknown"}</div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wide">Lab Size</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {availableWidth} x {availableHeight}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SELECTABLE_CARD_GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => onSessionChange({ ...session, gameId: game.id })}
              className={[
                "rounded-full border px-3 py-1 text-xs transition",
                session.gameId === game.id
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              {game.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSessionChange({ ...session, open: !session.open })}
            className={[
              "ml-auto rounded-md px-3 py-1.5 text-xs font-medium transition",
              session.open
                ? "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                : "bg-blue-600 text-white hover:bg-blue-500",
            ].join(" ")}
          >
            {session.open ? "Close card game" : "Mount in card"}
          </button>
        </div>

        {session.open ? (
          <CustomerCardGameHost
            customer={customer}
            manager={manager}
            gameId={session.gameId}
            open={session.open}
            availableWidth={availableWidth}
            availableHeight={availableHeight}
            onOpenChange={(next) => onSessionChange({ ...session, open: next })}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Card host idle. Pick a legacy game and mount it without touching the real customer page.
          </div>
        )}
      </div>
    </article>
  );
}
