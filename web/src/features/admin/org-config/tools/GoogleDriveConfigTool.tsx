"use client";

import React from "react";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import GDriveConfigPanel from "../../GDriveConfigPanel";

type GoogleDriveFilterState = Record<string, never>;
type GoogleDriveSelection = null;

export const GoogleDriveConfigTopbar: DashboardToolDefinition<GoogleDriveFilterState, GoogleDriveSelection>["ToolTopbar"] = () => (
  <div className="text-xs text-slate-600 dark:text-slate-300">Google Drive folders, templates, workbook build settings, and TSS workbook override work.</div>
);

export const GoogleDriveConfigMain: DashboardToolDefinition<GoogleDriveFilterState, GoogleDriveSelection>["Main"] = () => (
  <div className="mx-auto max-w-6xl">
    <GDriveConfigPanel />
  </div>
);

