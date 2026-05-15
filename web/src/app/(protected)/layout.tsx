/* ===== FILE: web/src/app/(protected)/layout.tsx ===== */
// src/app/(protected)/layout.tsx
import React from "react";
import RequireAuth from "../_guards/RequireAuth";
import RequireVerified from "../_guards/RequireVerified";
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
        {children}
        <TaskModeGate />
        <GameSystemGate />
      </RequireVerified>
    </RequireAuth>
  );
}
/* ===== END FILE: web/src/app/(protected)/layout.tsx ===== */
