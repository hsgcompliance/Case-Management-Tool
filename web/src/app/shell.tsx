// app/shell.tsx
"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { parseTextScalePreference, parseThemeMode, type TextScalePreference, type ThemeMode } from "@lib/userSettings";

type ShellProfile = {
  settings?: {
    textScale?: TextScalePreference | "text-xs" | "text-sm" | "text-base";
    themeMode?: ThemeMode | string;
  };
};

/** Routes that use the full-bleed panel layout (no side padding, overflow-scroll). */
const PANEL_STYLE_ROOTS = ["/", "/reports", "/tools"] as const;

function isPanelStyleRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PANEL_STYLE_ROOTS.some(
    (root) => pathname === root || (root !== "/" && pathname.startsWith(root + "/")),
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPanelStyle = isPanelStyleRoute(pathname);
  const { profile } = useAuth();
  const shellProfile = (profile || null) as ShellProfile | null;
  const textScalePref = parseTextScalePreference(shellProfile?.settings?.textScale);
  const themeMode = parseThemeMode(shellProfile?.settings?.themeMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const shouldDark = themeMode === "dark" || (themeMode === "system" && mql.matches);
      root.classList.toggle("dark", shouldDark);
      window.localStorage.setItem("hdb_theme_mode", themeMode);
    };

    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [themeMode]);

  return (
    <div className={`min-h-screen flex flex-col text-sm hdb-text-scale-${textScalePref}`}>
      <main className={isPanelStyle ? "flex-1 overflow-auto dashboard-padding" : "px-6 py-6"}>
        {isPanelStyle ? (
          <div className="dashboard-viewport">{children}</div>
        ) : (
          <div className="container-card">{children}</div>
        )}
      </main>
    </div>
  );
}
