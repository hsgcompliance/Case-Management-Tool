// app/_guards/RequireAuth.tsx
"use client";
import React, { useEffect } from "react";
import { useAuth } from "@app/auth/AuthProvider";
import { usePathname, useRouter } from "next/navigation";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    }
  }, [loading, user, pathname, router]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;
  return <>{children}</>;
}
