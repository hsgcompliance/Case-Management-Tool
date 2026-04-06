//src/features/tutorial/useIncompleteTours.ts
import React from "react";
import { useAuth } from "@app/auth/AuthProvider";
import { getAllProgress, onProgress } from "./progress";

/**
 * Returns a simple list of tours that are NOT completed according to local progress.
 * (Banner now fetches DB summaries directly; this hook is kept for other UIs.)
 */
export function useIncompleteTours(tourIds?: string[]) {
  const { user } = useAuth();
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => onProgress(() => setTick(t => t + 1)), []);

  return React.useMemo(() => {
    const all = getAllProgress(user?.uid);
    const entries = Object.entries(all)
      .filter(([, p]) => p.status !== "completed")
      .map(([id, p]) => ({ id, p }));

    if (tourIds?.length) {
      const set = new Set(tourIds);
      return entries.filter(e => set.has(e.id));
    }
    return entries;
  }, [user?.uid, JSON.stringify(tourIds || []), tick]);
}
