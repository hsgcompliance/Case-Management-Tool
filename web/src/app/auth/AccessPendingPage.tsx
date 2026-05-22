// web/src/app/auth/AccessPendingPage.tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import { useDevGrantAdmin, useUpdateMe } from "@hooks/useUsers";
import { auth } from "@lib/firebase";
import { api } from "@client/api";
import Orgs, { type RequestableOrg } from "@client/orgs";
import { shouldUseEmulators } from "@lib/runtimeEnv";
import { toast } from "@lib/toast";

function isLocalEmulator() {
  return shouldUseEmulators();
}

export default function AccessPendingPage() {
  const { user, profile, loading, reloadProfile } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const updateMe = useUpdateMe();
  const orgsQuery = useQuery({
    queryKey: ["orgs", "requestable"],
    queryFn: Orgs.listRequestable,
    enabled: !!user && !loading,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const topRole = String(profile?.topRole || profile?.role || "unverified").toLowerCase();
  const isActive = profile?.active !== false;
  const extras = ((profile as any)?.extras || {}) as Record<string, any>;
  const meta = (extras.meta || {}) as Record<string, any>;
  const accessRequest = (meta.accessRequest || {}) as Record<string, any>;
  const requestedOrgId = String(accessRequest.orgId || "");
  const requestableOrgs = orgsQuery.data?.items || [];

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
      router.replace(topRole === "viewer" ? "/customers" : "/reports");
    }
  }, [loading, user, topRole, isActive, router]);

  const requestOrgAccess = async (org: RequestableOrg) => {
    const nextMeta = {
      ...meta,
      accessRequest: {
        orgId: org.orgId || org.id,
        orgName: org.name,
        status: "pending",
        requestedAt: new Date().toISOString(),
      },
    };
    try {
      await updateMe.mutateAsync({ meta: nextMeta } as any);
      await reloadProfile();
      toast(`Access requested for ${org.name}.`, { type: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not request org access.";
      toast(message, { type: "error" });
    }
  };

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
        <div>
          <b>Role:</b> {blockedByRole ? "unverified" : topRole || "unverified"}
        </div>
        <div>
          <b>Active:</b>{" "}
          {isActive ? "Yes" : isActive === false ? "No" : "-"}
        </div>
        {requestedOrgId && (
          <div>
            <b>Requested org:</b> {accessRequest.orgName || requestedOrgId}
          </div>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Request organization access</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Pick the organization an administrator should approve for this account.
          </p>
        </div>

        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {orgsQuery.isLoading && (
            <div className="rounded border border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Loading organizations...
            </div>
          )}
          {!orgsQuery.isLoading && requestableOrgs.length === 0 && (
            <div className="rounded border border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No requestable organizations were found.
            </div>
          )}
          {requestableOrgs.map((org) => {
            const orgId = org.orgId || org.id;
            const requested = requestedOrgId === orgId;
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => void requestOrgAccess(org)}
                disabled={updateMe.isPending || requested}
                className="w-full rounded border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-default disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:disabled:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{org.name}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{orgId}</div>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-200">
                    {requested ? "Requested" : updateMe.isPending ? "Saving..." : "Request"}
                  </span>
                </div>
                {org.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{org.description}</p>
                )}
              </button>
            );
          })}
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
