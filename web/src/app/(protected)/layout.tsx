/* ===== FILE: web/src/app/(protected)/layout.tsx ===== */
// src/app/(protected)/layout.tsx
import React from "react";
import RequireAuth from "../_guards/RequireAuth";
import RequireVerified from "../_guards/RequireVerified";
import TourHost from "@tour/TourHost";
import IncompleteToursBanner from "@tour/IncompleteToursBanner";
import TourPickerModal from "@tour/TourPickerModal";
// TourProfileSyncClient is a "use client" wrapper that loads TourProfileSync with
// ssr:false — keeps useMutation out of server/static pre-render entirely.
import TourProfileSyncClient from "@tour/TourProfileSyncClient";
import TourBuilderGate from "@tour/TourBuilderGate";
import { TaskModeGate } from "@widgets/TaskModeGate";
import GameSystemGate from "@features/games/GameSystemGate";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <RequireVerified>
        <TourProfileSyncClient />
        <IncompleteToursBanner />
        {children}
        <TourPickerModal />
        <TourBuilderGate />
        <TourHost />
        <TaskModeGate />
        <GameSystemGate />
      </RequireVerified>
    </RequireAuth>
  );
}
/* ===== END FILE: web/src/app/(protected)/layout.tsx ===== */
