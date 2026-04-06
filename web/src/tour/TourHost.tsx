// web/src/tours/TourHost.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TourFlowT, TourStepT } from "./schema";
import { TourRegistry } from "./registry";
import { Overlay } from "./Overlay";
import { markCompleted, markIndex } from "./progress";
import { useAuth } from "@app/auth/AuthProvider";

function findElement(selector?: string): HTMLElement | null {
  if (!selector) return null;
  try {
    // Prefer [data-tour="..."] if provided
    if (selector.startsWith("[data-tour")) {
      return document.querySelector(selector) as HTMLElement | null;
    }
    return document.querySelector(selector) as HTMLElement | null;
  } catch { return null; }
}

function normalizeRoute(route: string) {
  // strip query/hash from saved routes
  try { return new URL(route, location.origin).pathname; } catch { return route; }
}

export default function TourHost() {
  const router = useRouter();
  const pathname = usePathname();
  const qs = useSearchParams();
  const { user } = useAuth();

  const tourId = qs.get("tour");
  const stepIdxRaw = qs.get("step");
  const stepIdx = Number.isFinite(Number(stepIdxRaw)) ? Number(stepIdxRaw) : 0;

  const flow: TourFlowT | null = useMemo(() => {
    if (!tourId) return null;
    const f = TourRegistry[tourId];
    return f ?? null;
  }, [tourId]);

  const step: TourStepT | null = useMemo(() => {
    if (!flow) return null;
    return flow.steps[stepIdx] ?? null;
  }, [flow, stepIdx]);

  // Route-sync: push to step.route if mismatch
  useEffect(() => {
    if (!flow || !step) return;
    const expected = normalizeRoute(step.route);
    const current = pathname;
    if (expected !== current) {
      router.push(`${expected}?tour=${flow.id}&step=${stepIdx}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, step, pathname]);

  useEffect(() => {
    if (!flow) return;
    markIndex(user?.uid, flow.id, stepIdx);
  }, [flow, stepIdx, user?.uid]);

  // Resolve target element with retries (helps after page transitions)
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!step) { setTarget(null); return; }
    let attempts = 0;
    const max = 20;
    const timer = setInterval(() => {
      attempts++;
      const el = findElement(step.selector);
      if (el || attempts >= max) {
        setTarget(el ?? null);
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [step, pathname]);

  const exit = useCallback(() => {
    const base = new URL(location.href);
    base.searchParams.delete("tour");
    base.searchParams.delete("step");
    router.replace(`${base.pathname}${base.search}`);
  }, [router]);

  const next = useCallback(() => {
    if (!flow) return;
    if (stepIdx >= flow.steps.length - 1) {
      markCompleted(user?.uid, flow.id);
      const base = new URL(location.href);
      base.searchParams.delete("tour");
      base.searchParams.delete("step");
      router.replace(`${base.pathname}${base.search}`);
      return;
    }
    const i = Math.min(stepIdx + 1, flow.steps.length - 1);
    router.replace(`${normalizeRoute(flow.steps[i].route)}?tour=${flow.id}&step=${i}`);
  }, [flow, stepIdx, router, user?.uid]);

  const prev = useCallback(() => {
    if (!flow) return;
    const i = Math.max(0, stepIdx - 1);
    router.replace(`${normalizeRoute(flow.steps[i].route)}?tour=${flow.id}&step=${i}`);
  }, [flow, stepIdx, router]);

  if (!flow || !step) return null;

  return (
    <Overlay
      target={target}
      title={step.title}
      body={step.body}
      onExit={exit}
      onNext={next}
      onPrev={prev}
      showPrev={stepIdx > 0}
      showNext={stepIdx < (flow.steps.length - 1)}
      rectPadding={step.padding ?? 8}
    />
  );
}
