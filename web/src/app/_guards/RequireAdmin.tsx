// app/_guards/RequireAdmin.tsx
"use client";
import React, { useEffect } from "react";
import { useAuth } from "@app/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { isAdminLike } from "@lib/roles";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  // admin pages allow admin + dev ladder roles (matches backend LEVEL_RANK logic)
  const isAdmin = isAdminLike(profile as { topRole?: unknown; role?: unknown } | null);

  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/reports");
  }, [loading, isAdmin, router]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!isAdmin) return null;
  return <>{children}</>;
}
