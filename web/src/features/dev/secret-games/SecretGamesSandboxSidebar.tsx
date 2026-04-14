"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createDirectSecretLaunchRequest,
  resolveSecretGameLaunch,
  type SecretLaunchRequest,
} from "@features/secret-games";
import { buildSandboxLaunchHref, createSandboxLaunchEnvironment } from "@features/secret-games/sandboxLaunch";
import SecretGamesRegistryPanel from "./SecretGamesRegistryPanel";
import SecretGamesStoragePanel from "./SecretGamesStoragePanel";
import { useSecretGamesSandbox } from "./SecretGamesSandboxContext";
import { SANDBOX_ALL_CASE_MANAGERS } from "./fixtures";

const SANDBOX_ROUTES = [
  { href: "/dev/secret-games", label: "Customers Clone" },
  { href: "/dev/secret-games/cards", label: "Card Lab" },
  { href: "/dev/secret-games/overlay", label: "Overlay Lab" },
  { href: "/dev/secret-games/legacy", label: "Legacy Lab" },
];

const DIRECT_TRIGGER_OPTIONS = [
  {
    title: "Konami",
    detail: "Launch necromancer through the typed Konami trigger path.",
    request: createDirectSecretLaunchRequest("konami", { gameId: "necromancer" }),
  },
  {
    title: "Hidden Asteroids",
    detail: "Launch asteroids through the hidden trigger path.",
    request: createDirectSecretLaunchRequest("hidden-ui", { triggerId: "hidden-asteroids" }),
  },
  {
    title: "Legacy Runner",
    detail: "Exercise the migrated legacy-launcher path.",
    request: createDirectSecretLaunchRequest("legacy-launcher", { gameId: "legacy-runner" }),
  },
  {
    title: "Broken Data --dev",
    detail: "Force the dev override path for broken data.",
    request: createDirectSecretLaunchRequest("sandbox-control", {
      gameId: "broken-data",
      devOverrideRequested: true,
    }),
  },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dev/secret-games") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SecretGamesSandboxSidebar() {
  const pathname = usePathname() || "/dev/secret-games";
  const router = useRouter();
  const {
    caseManagers,
    activeCaseManager,
    activeCaseManagerId,
    visibleCustomers,
    setActiveCaseManagerId,
  } = useSecretGamesSandbox();
  const [status, setStatus] = React.useState<string>("");

  const fallbackCustomerId = visibleCustomers[0]?.id || null;

  const handleResolvedLaunch = React.useCallback(
    (request: SecretLaunchRequest) => {
      const environment = createSandboxLaunchEnvironment();
      const decision = resolveSecretGameLaunch(request, environment);
      const href = buildSandboxLaunchHref({
        decision,
        request,
        fallbackCustomerId,
      });

      if (!href) {
        setStatus(decision.blockers[0]?.reason || "Resolver did not produce a sandbox route.");
        return;
      }

      setStatus(`Launching ${decision.game?.title || request.gameId || "secret game"}.`);
      router.push(href);
    },
    [fallbackCustomerId, router],
  );

  return (
    <div className="space-y-4 xl:sticky xl:top-[calc(var(--topbar-height)+16px)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Sandbox Routes
        </div>
        <div className="space-y-2">
          {SANDBOX_ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={[
                "block rounded-xl border px-3 py-2 text-sm transition",
                isActive(pathname, route.href)
                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              {route.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Card Lab Scope
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Narrow the fake customer pool for the card and overlay lab routes. The main customer-page clone uses a live 10-customer sample instead.
          </p>
        </div>
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
        <div className="mt-3 text-xs text-slate-500">
          Active: <span className="font-medium text-slate-700 dark:text-slate-200">{activeCaseManager ? activeCaseManager.name : "All managers"}</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">Visible fake customers: {visibleCustomers.length}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Launch Shortcuts
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Exact search commands now live in the cloned customer search bar. These buttons cover the non-search trigger paths.
          </p>
        </div>
        <div className="space-y-2">
          {DIRECT_TRIGGER_OPTIONS.map((entry) => (
            <button
              key={entry.title}
              type="button"
              onClick={() => handleResolvedLaunch(entry.request)}
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.title}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.detail}</div>
            </button>
          ))}
        </div>
        {status ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
            {status}
          </div>
        ) : null}
      </section>

      <SecretGamesRegistryPanel />
      <SecretGamesStoragePanel />
    </div>
  );
}
