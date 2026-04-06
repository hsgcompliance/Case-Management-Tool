// app/_guards/RequireVerified.tsx
"use client";
import React, { useEffect } from "react";
import { useAuth } from "@app/auth/AuthProvider";
import { useRouter } from "next/navigation";

export default function RequireVerified({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const topRole = String(profile?.topRole || profile?.role || "").toLowerCase();
  const isActive = profile?.active !== false;

  const isBlockedRole =
    !topRole || topRole === "unverified" || topRole === "public_user";

  const passes = !!profile && !isBlockedRole && isActive;

  useEffect(() => {
    if (!loading && !passes) router.replace("/access-pending");
  }, [loading, passes, router]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!passes) return null;
  return <>{children}</>;
}
