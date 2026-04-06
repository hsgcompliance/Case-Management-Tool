// web/src/app/auth/AccessPendingPage.tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { useDevGrantAdmin } from "@hooks/useUsers";
import { auth } from "@lib/firebase";
import { api } from "@client/api";
import { shouldUseEmulators } from "@lib/runtimeEnv";

function isLocalEmulator() {
  return shouldUseEmulators();
}

export default function AccessPendingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const roles: string[] = Array.isArray(profile?.roles)
    ? (profile!.roles as string[])
    : profile?.role
    ? [profile.role]
    : [];

  const topRole = String(profile?.topRole || profile?.role || "unverified").toLowerCase();
  const isActive = profile?.active !== false;

  const blockedByRole =
    !topRole || topRole === "unverified" || topRole === "public_user";
  const blockedByDeactivation = !isActive;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const isBlocked =
      !topRole || topRole === "unverified" || topRole === "public_user" || !isActive;

    if (!isBlocked) {
      router.replace("/reports");
    }
  }, [loading, user, topRole, isActive, router]);


  return (
    <div className="mx-auto max-w-lg p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Access pending</h1>

      {blockedByRole && (
        <p className="text-slate-700 dark:text-slate-300">
          Your account is created but not approved yet. An administrator needs to assign a role.
        </p>
      )}
      {blockedByDeactivation && (
        <p className="text-slate-700 dark:text-slate-300">
          Your account has been deactivated. Please contact an administrator if you believe this is an error.
        </p>
      )}

      <div className="card space-y-1 p-4 text-sm">
        <div>
          <b>Email:</b> {user?.email}
        </div>
        <div className="flex items-center gap-2">
          <b>Roles:</b>
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <span
                key={r}
                className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                {r}
              </span>
            ))}
            {!roles.length && <span className="text-xs text-slate-500 dark:text-slate-400">none</span>}
          </div>
        </div>
        <div>
          <b>Top role:</b> {topRole || "unverified"}
        </div>
        <div>
          <b>Active:</b>{" "}
          {isActive ? "Yes" : isActive === false ? "No" : "-"}
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <Link href="/login" className="btn-secondary">
          Back to sign-in
        </Link>
        <button
          onClick={() => location.reload()}
          className="btn"
        >
          Refresh
        </button>

        {mounted && isLocalEmulator() && <DevGrantMyself />}
      </div>
    </div>
  );
}

function DevGrantMyself() {
  const { user, reloadProfile } = useAuth();
  const { mutateAsync, isPending } = useDevGrantAdmin();
  const router = useRouter();

  const onClick = async () => {
    if (!user?.uid) return;

    await mutateAsync(user.uid);
    await auth.currentUser?.getIdToken(true);
    await new Promise((r) => setTimeout(r, 75));
    api.resetAuthToken();
    await reloadProfile();
    router.replace("/reports");
  };

  return (
    <button
      onClick={onClick}
      disabled={!user || isPending}
      className="btn-secondary btn-sm text-xs"
      title="Local dev helper: grants the 'admin' role using the functions emulator"
    >
      {isPending ? "Granting admin..." : "Grant me admin (dev)"}
    </button>
  );
}
