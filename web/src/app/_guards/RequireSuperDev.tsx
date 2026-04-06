"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { isSuperDevLike } from "@lib/roles";

export default function RequireSuperDev({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const isSuperDev = isSuperDevLike(profile as { topRole?: unknown; role?: unknown } | null);

  useEffect(() => {
    if (!loading && !isSuperDev) router.replace("/dev");
  }, [loading, isSuperDev, router]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!isSuperDev) return null;
  return <>{children}</>;
}

