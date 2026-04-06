// src/features/tutorial/useStartTour.ts
"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAllProgress } from "./progress";
import { useAuth } from "@app/auth/AuthProvider";
import { fetchTour, resolveTourById } from "@features/admin/tourBuilder/tourStore";

export function useStartTour() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return React.useCallback(async (tourId: string, opts?: { resume?: boolean }) => {
    const p = getAllProgress(user?.uid)[tourId];
    const tour = resolveTourById(tourId) || (await fetchTour(tourId).catch(() => null));
    const start = opts?.resume && typeof p?.stepIndex === "number" ? p.stepIndex : 0;

    // If we know the route of the starting step, go there immediately
    const startRoute = tour?.steps?.[start]?.route || tour?.steps?.[0]?.route || pathname;

    const sp = new URLSearchParams(searchParams?.toString() || "");
    sp.set("tour", tourId);
    sp.set("step", String(start));
    sp.set("run", "1");
    sp.delete("tourPicker"); // auto-close the modal

    router.replace(`${startRoute}?${sp.toString()}`);
  }, [pathname, router, searchParams, user?.uid]);
}
