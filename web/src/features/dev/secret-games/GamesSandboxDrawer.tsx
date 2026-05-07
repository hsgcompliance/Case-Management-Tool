"use client";
// web/src/features/dev/secret-games/GamesSandboxDrawer.tsx
// Right-side slide-in drawer for all lab settings.
// Sections: Test Scope · Games (unified game picker with container/trigger/info) · Storage Debug.

import React from "react";
import { getSecretGameById, listSecretGames } from "@features/secret-games";
import SecretGamesStoragePanel from "./SecretGamesStoragePanel";
import { useSecretGamesSandbox } from "./SecretGamesSandboxContext";
import { SANDBOX_ALL_CASE_MANAGERS } from "./fixtures";

// ─── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={[
      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
      accent
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    ].join(" ")}>
      {children}
    </span>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function DrawerSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        {title}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Test scope section ───────────────────────────────────────────────────────

function TestScopeSection() {
  const {
    caseManagers, activeCaseManagerId, activeCaseManager, visibleCustomers,
    setActiveCaseManagerId, useRealCustomers, setUseRealCustomers,
  } = useSecretGamesSandbox();

  return (
    <div className="space-y-4">
      {/* Real vs fake customers toggle */}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Customer source</p>
        <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setUseRealCustomers(true)}
            className={[
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition",
              useRealCustomers
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
          >
            Real customers
          </button>
          <button
            type="button"
            onClick={() => setUseRealCustomers(false)}
            className={[
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition",
              !useRealCustomers
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
          >
            Fake fixtures
          </button>
        </div>
      </div>

      {/* Fake customer case manager filter — only relevant when using fake customers */}
      {!useRealCustomers && (
        <div>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Filter fixture customers by case manager.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCaseManagerId(SANDBOX_ALL_CASE_MANAGERS)}
              className={[
                "rounded-full border px-3 py-1 text-xs transition",
                activeCaseManagerId === SANDBOX_ALL_CASE_MANAGERS
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              All managers
            </button>
            {caseManagers.map((manager) => (
              <button
                key={manager.id}
                type="button"
                onClick={() => setActiveCaseManagerId(manager.id)}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition",
                  activeCaseManagerId === manager.id
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                {manager.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Active: <span className="font-medium text-slate-600 dark:text-slate-300">
              {activeCaseManager ? activeCaseManager.name : "All managers"}
            </span>
            {" · "}{visibleCustomers.length} fixture customers
          </p>
        </div>
      )}

      {useRealCustomers && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Showing live Firestore customers. Switch to Fake fixtures to test with controlled data.
        </p>
      )}
    </div>
  );
}

// ─── Games section ────────────────────────────────────────────────────────────

const TRIGGER_KIND_LABELS: Record<string, string> = {
  "search-exact":    "Search",
  "konami":          "Konami",
  "hidden-ui":       "Hidden UI",
  "sandbox-control": "Sandbox",
  "legacy-launcher": "Legacy",
};

function GameDetailPanel({ gameId }: { gameId: string }) {
  const game = getSecretGameById(gameId);
  if (!game) return <p className="text-xs text-slate-400">Game not found.</p>;

  const searchTriggers = game.triggers.filter((t) => t.kind === "search-exact");
  const otherTriggers  = game.triggers.filter((t) => t.kind !== "search-exact");

  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{game.description}</p>

      {/* Kind + presentation */}
      <div className="flex flex-wrap gap-1.5">
        <Chip>{game.kind}</Chip>
        <Chip accent>{game.presentation}</Chip>
        <Chip>{game.persistenceScope}</Chip>
      </div>

      {/* Secret words / triggers */}
      {searchTriggers.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Secret words
          </p>
          <div className="flex flex-wrap gap-1.5">
            {searchTriggers.map((t) => (
              <code
                key={t.id}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-900/20 dark:text-indigo-300"
              >
                {t.command}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Other triggers */}
      {otherTriggers.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Other triggers
          </p>
          <div className="space-y-1">
            {otherTriggers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-300">{t.description}</span>
                <div className="flex items-center gap-1">
                  <Chip>{TRIGGER_KIND_LABELS[t.kind] ?? t.kind}</Chip>
                  {t.devOnly && <Chip>dev</Chip>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Container modes */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Container
        </p>
        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-slate-400">Preferred</span>
            <Chip accent>{game.preferredContainerMode}</Chip>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-20 shrink-0 text-slate-400 pt-0.5">Allowed</span>
            <div className="flex flex-wrap gap-1">
              {game.allowedContainerModes.map((m) => <Chip key={m}>{m}</Chip>)}
            </div>
          </div>
        </div>
      </div>

      {/* Play profile */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Play profile
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <div>Min size <span className="font-medium text-slate-700 dark:text-slate-200">{game.playProfile.minWidth}×{game.playProfile.minHeight}</span></div>
          <div>Session <span className="font-medium text-slate-700 dark:text-slate-200">{game.playProfile.sessionLengthSeconds.min}–{game.playProfile.sessionLengthSeconds.max}s</span></div>
          {game.playProfile.prefersFocus && <div className="col-span-2 text-amber-600 dark:text-amber-400">Prefers focus</div>}
          {game.playProfile.allowsOverlayFallback && <div className="col-span-2">Overlay fallback OK</div>}
        </div>
      </div>

      {/* Notes */}
      {game.notes && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {game.notes}
        </p>
      )}

      {/* Feature flag */}
      <div className="text-[11px] text-slate-400 dark:text-slate-500">
        Flag: <code className="text-slate-600 dark:text-slate-300">{game.featureFlag}</code>
      </div>
    </div>
  );
}

function GamesSection() {
  const games = listSecretGames();
  const [selectedId, setSelectedId] = React.useState<string>(games[0]?.id ?? "flip");

  return (
    <div className="space-y-3">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.currentTarget.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title} ({g.kind === "legacy-adapter" ? "legacy" : g.presentation})
          </option>
        ))}
      </select>

      <GameDetailPanel gameId={selectedId} />
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function GamesSandboxDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={[
          "fixed inset-0 z-[55] bg-black/20 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Drawer panel */}
      <div
        className={[
          "fixed right-0 top-0 z-[60] flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lab Settings</span>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Secret Games sandbox controls</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M11 2L2 11M2 2l9 9" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <DrawerSection title="Test Scope">
            <TestScopeSection />
          </DrawerSection>

          <DrawerSection title="Games" defaultOpen={false}>
            <GamesSection />
          </DrawerSection>

          <DrawerSection title="Storage Debug" defaultOpen={false}>
            <div className="-mx-5">
              <SecretGamesStoragePanel />
            </div>
          </DrawerSection>
        </div>
      </div>
    </>
  );
}
