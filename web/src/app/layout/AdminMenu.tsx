// app/layout/AdminMenu.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function AdminMenu() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname() || "/reports";
  const searchParams = useSearchParams();

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
          "px-3 py-1.5 rounded-md text-sm border border-amber-200",
          open ? "bg-amber-50 text-amber-700" : "text-amber-700 hover:bg-amber-50",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="admin-menu"
      >
        Admin
      </button>

      {open && (
        <div
          id="admin-menu"
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded border border-slate-200 bg-white shadow dark:border-slate-700 dark:bg-slate-900"
        >
          <Link
            href="/admin/users" //swap to Routes.protected.admin.users()
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            Manage Users
          </Link>
          <Link
            href="/admin/acuity"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            Manage Acuity Rubric
          </Link>
          <Link
            href="/admin/org-config"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            Org Configuration
          </Link>
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => {
              const sp = new URLSearchParams(searchParams.toString());
              sp.set("builder", "1");
              router.replace(`${pathname}?${sp.toString()}`);
              setOpen(false);
            }}
          >
            Open Tour Builder
          </button>
        </div>
      )}
    </div>
  );
}
