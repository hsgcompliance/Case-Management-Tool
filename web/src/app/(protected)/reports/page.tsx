// app/(protected)/reports/page.tsx
"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { isViewerLike } from "@lib/roles";
import ReportingPage from "@features/reporting/ReportingPage";

export default function Page() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isViewerLike(profile as { roles?: unknown } | null)) {
      router.replace("/customers");
    }
  }, [loading, profile, router]);

  if (!loading && isViewerLike(profile as { roles?: unknown } | null)) return null;
  return <ReportingPage />;
}
