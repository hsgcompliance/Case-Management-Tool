// app/layout/GlobalPending.tsx
"use client";

import React, { useEffect, useState } from "react";
import { pending } from "@lib/pending";

export function GlobalPending() {
  const [{ heavy, route, api }, setCounts] = useState(pending.counts);

  useEffect(() => pending.subscribe((s) => setCounts(s.counts)), []);

  // Full-screen overlay only for heavy work
  if (heavy > 0) {
    return (
      <div className="fixed inset-0 z-[9999]">
        {/* scrim */}
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px]" />
        {/* center spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin h-9 w-9 rounded-full border-2 border-black/20 border-t-black" />
        </div>
      </div>
    );
  }

  // Optional route indicator (thin top bar)
  if (route > 0) {
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]">
        <div className="absolute top-0 left-0 right-0 h-0.5 animate-pulse bg-black/60" />
      </div>
    );
  }

  // api > 0 intentionally does nothing globally (optimistic UX).
  return null;
}

export default GlobalPending;
