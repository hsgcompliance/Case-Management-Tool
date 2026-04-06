//src/features/tutorial/IncompleteToursBanner.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useStartTour } from "./useStartTour";
import { listAllTourSummaries } from "@features/admin/tourBuilder/tourStore";
import { getAllProgress } from "./progress";

const SESSION_ALL_KEY = "hdb.tours.prompted.ALL";
const ELIGIBLE_PATH_PREFIXES = ["/reports", "/customers", "/grants"];

export default function IncompleteToursBanner() {
  const pathname = usePathname();
  const routeEligible = React.useMemo(
    () => ELIGIBLE_PATH_PREFIXES.some((p) => String(pathname || "").startsWith(p)),
    [pathname]
  );
  const startTour = useStartTour();
  const [ready, setReady] = React.useState(false);
  const [candidate, setCandidate] = React.useState<{ id: string; name: string } | null>(null);
  const [dismissedNow, setDismissedNow] = React.useState(false);
  const [dismissedAll, setDismissedAll] = React.useState(false);

  React.useEffect(() => {
    setDismissedAll(sessionStorage.getItem(SESSION_ALL_KEY) === "1");
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!routeEligible) {
        if (!cancelled) {
          setCandidate(null);
          setReady(true);
        }
        return;
      }
      if (sessionStorage.getItem(SESSION_ALL_KEY) === "1") {
        if (!cancelled) setReady(true);
        return;
      }
      const summaries = await listAllTourSummaries().catch(() => []);
      const progress = getAllProgress(); // uid keyed inside

      // Fallback: if nothing matched this page, suggest the first incomplete tour
      const first = summaries.find(s => progress[s.id]?.status !== "completed");
      if (first && !cancelled) setCandidate({ id: first.id, name: first.name });
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, routeEligible]);

  if (dismissedAll || dismissedNow) return null;
  if (!ready || !candidate) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-2 my-2 rounded border bg-amber-50 text-amber-900 flex items-center justify-between">
      <span>Heads up - you have not completed &quot;{candidate.name}&quot;.</span>
      <div className="flex gap-2">
        <button
          className="text-sm px-3 py-1.5 rounded border"
          onClick={() => startTour(candidate.id, { resume: true })}
        >
          Resume
        </button>
        <button
          className="text-sm px-3 py-1.5 rounded border"
          onClick={() => startTour(candidate.id, { resume: false })}
        >
          Start
        </button>
        <button
          className="text-sm px-3 py-1.5 rounded border"
          onClick={() => { sessionStorage.setItem(SESSION_ALL_KEY, "1"); setDismissedNow(true); }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
