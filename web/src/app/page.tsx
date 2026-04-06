"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ArcadeFolder } from "@features/games/ArcadeFolder";

// ssr:false — RunnerGame calls useMutation (via useUpdateMe) at render time.
// The game has no SSR value; skip pre-render entirely.
const RunnerGame = dynamic(() => import("@features/games/runner/RunnerGame"), { ssr: false });

export default function Home() {
  return (
    <div className="relative min-h-[calc(100dvh-1rem)]">
      <RunnerGame />
      {/* Arcade launcher — discrete folder widget, opens games as floating windows */}
      <div className="fixed bottom-4 left-4 z-50">
        <ArcadeFolder />
      </div>
    </div>
  );
}
