// app/layout/Topbar.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import UsersClient from "@client/users";
import MyProfileDropdown from "@app/auth/MyProfileDropdown";
import AdminMenu from "./AdminMenu";
import DevMenu from "./DevMenu";
import { shouldUseEmulators } from "@lib/runtimeEnv";
import { isAdminLike, isDevLike } from "@lib/roles";

const nav = [
  { to: "/reports", label: "Reports" },
  { to: "/customers", label: "Customers" },
  { to: "/budget", label: "Budget" },
  { to: "/programs", label: "Programs" },
  { to: "/tools", label: "Tools" },
];

function isRouteActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

type ThemeMode = "light" | "dark" | "system";

export function Topbar() {
  const { user, profile, loading, reloadProfile } = useAuth();
  const pathname = usePathname() || "";
  const [themeBusy, setThemeBusy] = React.useState(false);
  const [currentThemeMode, setCurrentThemeMode] = React.useState<ThemeMode>("system");

  const topRole = String(profile?.topRole || profile?.role || "").toLowerCase();
  const isActive = profile?.active !== false;

  const isApproved =
    !!topRole && topRole !== "unverified" && topRole !== "public_user" && isActive;

  const isAdmin = isAdminLike(profile as { topRole?: unknown; role?: unknown } | null);
  const isDev = isDevLike(profile as { topRole?: unknown; role?: unknown } | null);

  // Landing page can show nav affordances even for signed-out users.
  // Actual route security remains enforced by each protected page.
  const showNav = !loading && ((!!user && (isApproved || isAdmin)) || pathname === "/");

  const EMU = shouldUseEmulators();

  React.useEffect(() => {
    const profileMode = String(
      (profile?.settings as { themeMode?: string } | undefined)?.themeMode || "",
    ).toLowerCase();
    if (profileMode === "light" || profileMode === "dark" || profileMode === "system") {
      setCurrentThemeMode(profileMode);
      return;
    }
    if (typeof window === "undefined") return;
    const local = String(window.localStorage.getItem("hdb_theme_mode") || "system").toLowerCase();
    if (local === "light" || local === "dark" || local === "system") {
      setCurrentThemeMode(local);
    } else {
      setCurrentThemeMode("system");
    }
  }, [profile]);

  const applyThemeMode = (mode: ThemeMode) => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = mode === "dark" || (mode === "system" && prefersDark);
    root.classList.toggle("dark", dark);
    window.localStorage.setItem("hdb_theme_mode", mode);
  };

  const toggleTheme = async () => {
    const nextMode: ThemeMode = currentThemeMode === "dark" ? "light" : "dark";
    applyThemeMode(nextMode);
    setCurrentThemeMode(nextMode);

    const baseSettings =
      profile && typeof profile.settings === "object" && profile.settings
        ? (profile.settings as Record<string, unknown>)
        : {};

    try {
      setThemeBusy(true);
      await UsersClient.meUpdate({
        settings: {
          ...baseSettings,
          themeMode: nextMode,
        },
      });
      await reloadProfile();
    } finally {
      setThemeBusy(false);
    }
  };

  return (
    <header className="topbar z-40" data-tour="topbar">
      <div className="topbar-inner gap-4" data-tour="topbar-inner">
        <div className="flex items-center gap-3 min-w-0" data-tour="topbar-brand">
          <Link
            href="/"
            className="truncate font-semibold text-slate-900 dark:text-slate-100"
            data-tour="topbar-home"
          >
            Case Management Dashboard
          </Link>
          {EMU ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200" data-tour="topbar-emu-badge">
              EMU
            </span>
          ) : null}
        </div>

        {showNav ? (
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1" data-tour="topbar-nav">
            {nav.map((n) => {
              const active = isRouteActive(pathname, n.to);
              return (
                <Link
                  key={n.to}
                  href={n.to}
                  data-tour={`topbar-nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={[
                    "px-3 py-1.5 rounded-md text-sm transition-colors",
                    active
                      ? "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                  ].join(" ")}
                >
                  {n.label}
                </Link>
              );
            })}
            {isDev ? <DevMenu profile={profile as { topRole?: unknown; role?: unknown; roles?: unknown } | null} /> : null}
            {isAdmin ? <AdminMenu /> : null}
          </nav>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2" data-tour="topbar-actions">
          <button
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={toggleTheme}
            disabled={themeBusy}
            title={`Switch theme (current: ${currentThemeMode})`}
            data-tour="topbar-theme-toggle"
          >
            {currentThemeMode === "dark" ? "Dark" : currentThemeMode === "light" ? "Light" : "System"}
          </button>
          {user ? (
            <MyProfileDropdown />
          ) : (
            <Link
              href="/login"
              data-tour="topbar-signin"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
