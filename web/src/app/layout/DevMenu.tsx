"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSuperDevLike } from "@lib/roles";

function isRouteActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

export default function DevMenu({
  profile,
}: {
  profile: { topRole?: unknown; role?: unknown; roles?: unknown } | null;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname() || "/dev";
  const isSuperDev = isSuperDevLike(profile);
  const active = isRouteActive(pathname, "/dev");

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "px-3 py-1.5 rounded-md text-sm transition-colors",
          active || open
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300"
            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="dev-menu"
      >
        Dev
      </button>

      {open && (
        <div
          id="dev-menu"
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded border border-slate-200 bg-white shadow dark:border-slate-700 dark:bg-slate-900"
        >
          <Link
            href="/dev/secret-games"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            Secret Games
          </Link>
          <Link
            href="/dev/functions"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            Endpoints
          </Link>
          {isSuperDev ? (
            <Link
              href="/dev/org-manager"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              Org Manager
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
