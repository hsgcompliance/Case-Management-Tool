"use client";
import React from "react";
import { useAuth } from "@app/auth/AuthProvider";
import UsersClient from "@client/users";

export function TaskModeGate() {
  const { profile, reloadProfile } = useAuth();
  const extras = (profile as any)?.extras;
  const taskMode = extras?.taskMode ?? (profile as any)?.taskMode ?? null;

  // Auto-default new users to "workflow" without showing the selection modal.
  React.useEffect(() => {
    if (!profile || taskMode != null) return;
    UsersClient.meUpdate({
      taskMode: "workflow",
      taskModeSetAt: new Date().toISOString(),
      taskModeSetBy: "system",
    }).then(() => reloadProfile()).catch(() => null);
  }, [profile, taskMode, reloadProfile]);

  return null;
}
