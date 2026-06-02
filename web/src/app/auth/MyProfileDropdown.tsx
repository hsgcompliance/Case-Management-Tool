// web/src/app/auth/MyProfileDropdown.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { isAdminLike, isDevLike, isSuperDevLike } from "@lib/roles";
import { useOverlayLayer } from "@entities/ui/overlayLayers";

export default function MyProfileDropdown() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { zIndex, bringToFront } = useOverlayLayer(open, "appChromePopover");

  const roles: string[] = Array.isArray(profile?.roles)
    ? (profile!.roles as string[])
    : profile?.role
    ? [profile.role]
    : [];

  const isAdmin = isAdminLike(profile as { topRole?: unknown; role?: unknown } | null);
  const isDev = isDevLike(profile as { topRole?: unknown; role?: unknown } | null);
  const isSuperDev = isSuperDevLike(profile as { topRole?: unknown; role?: unknown; roles?: unknown } | null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = React.useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  // click-away
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        open &&
        ref.current &&
        !ref.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  // escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const initials =
    profile?.displayName?.trim()?.[0] || user.email?.trim()?.[0] || "?";

  const openTourPicker = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tourPicker", "1");
    setOpen(false);
    router.replace(`${pathname}?${sp.toString()}`);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        ref={btnRef}
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen((o) => !o);
        }}
        className="flex items-center gap-2 text-sm focus:outline-none"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="profile-menu"
      >
        {profile?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photoURL}
            alt="profile"
            className="w-8 h-8 rounded-full border"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-slate-100">
            {initials}
          </span>
        )}
        <span className="hidden sm:block">
          {profile?.displayName || user.email}
        </span>
      </button>

      {open && mounted && createPortal((
        <div
          id="profile-menu"
          role="menu"
          ref={menuRef}
          className="fixed w-64 rounded border border-slate-200 bg-white shadow dark:border-slate-700 dark:bg-slate-900"
          style={{ top: menuPos.top, right: menuPos.right, zIndex }}
          onMouseDown={bringToFront}
        >
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="truncate font-medium text-slate-900 dark:text-slate-100">
              {profile?.displayName || user.email}
            </div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {profile?.email || user.email}
            </div>
            {!!roles.length && (
              <div className="mt-2 flex flex-wrap gap-1">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="py-1">
            <Link
              href="/settings"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>

            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={openTourPicker}
            >
              Tours
            </button>

            {isAdmin && (
              <Link
                href="/admin/debug"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setOpen(false)}
              >
                Debug tokens
              </Link>
            )}
            {isDev && (
              <>
                <Link
                  href="/dev/functions"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => setOpen(false)}
                >
                  Endpoints
                </Link>
                {isSuperDev && (
                  <Link
                    href="/dev/org-manager"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => setOpen(false)}
                  >
                    Org Manager
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700" />

          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50 dark:text-red-400 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      ), document.body)}
    </div>
  );
}
