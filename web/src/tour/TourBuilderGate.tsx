"use client";

import * as React from "react";
import { useAuth } from "@app/auth/AuthProvider";
import TourBuilderDock from "@features/admin/tourBuilder/TourBuilderDock";
import { isAdminLike } from "@lib/roles";

export default function TourBuilderGate() {
  const { profile } = useAuth();
  const isAdmin = isAdminLike(profile as { topRole?: unknown; role?: unknown } | null);

  if (!isAdmin) return null;
  return <TourBuilderDock />;
}
