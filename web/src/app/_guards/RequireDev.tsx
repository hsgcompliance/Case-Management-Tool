// app/_guards/RequireDev.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { isDevLike } from "@lib/roles";

export default function RequireDev({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const isDev = isDevLike(profile as { topRole?: unknown; role?: unknown } | null);

  useEffect(() => {
    if (!loading && !isDev) router.replace("/reports");
  }, [loading, isDev, router]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!isDev) return null;
  return <>{children}</>;
}
