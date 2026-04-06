//src/features/tutorial/TourPickerModal.tsx
"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { listAllTourSummaries } from "@features/admin/tourBuilder/tourStore";
import { useAuth } from "@app/auth/AuthProvider";
import { useStartTour } from "./useStartTour";
import { getAllProgress } from "./progress";

type TourSummaryLite = { id: string; name: string };

export default function TourPickerModal() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const qs = useSearchParams();
  const open = qs.has("tourPicker");
  const close = React.useCallback(() => {
    const sp = new URLSearchParams(qs.toString());
    sp.delete("tourPicker");
    const next = sp.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [pathname, qs, router]);

  const startTour = useStartTour();

  const [tours, setTours] = React.useState<TourSummaryLite[] | null>(null);
  const [err, setErr] = React.useState<unknown>(null);

  React.useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await listAllTourSummaries();
        if (!cancelled) { setTours(items.map(i => ({ id: i.id, name: i.name }))); setErr(null); }
      } catch (e) { if (!cancelled) setErr(e); }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  if (!open) return null;

  const progress = getAllProgress(); // local-first; server merge handled by progress.ts writes

  return (
    <div className="fixed inset-0 z-[2700] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Start a tour</h2>
          <button className="text-sm px-2 py-1 rounded border" onClick={close}>Close</button>
        </div>

        {err ? (
          <div className="py-6 text-sm text-red-600">Failed to load tours.</div>
        ) : tours === null ? (
          <div className="py-6 text-sm text-gray-600">Loading tours...</div>
        ) : tours.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">No tours published yet.</div>
        ) : (
          <div className="divide-y">
            {tours.map(t => {
              const st = progress?.[t.id];
              const canResume = !!st && st.status !== "completed" && typeof st.stepIndex === "number";
              const isDone = st?.status === "completed";
              return (
                <div key={t.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-gray-500">
                      ID: {t.id} {isDone ? "- completed" : canResume ? "- in progress" : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canResume && (
                      <button className="text-sm px-2 py-1 rounded border" onClick={() => startTour(t.id, { resume: true })}>
                        Resume
                      </button>
                    )}
                    <button className="text-sm px-2 py-1 rounded border" onClick={() => startTour(t.id, { resume: false })}>
                      Start
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
