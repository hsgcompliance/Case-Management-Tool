"use client";

import { useSyncTourProgressToProfile } from "@hooks/useTours";

export default function TourProfileSync() {
  useSyncTourProgressToProfile({ enabled: true, debounceMs: 1200 });
  return null;
}

