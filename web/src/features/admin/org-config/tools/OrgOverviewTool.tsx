"use client";

import React from "react";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { useOrgConfigDashboard } from "../orgConfigContext";

type OverviewFilterState = Record<string, never>;
type OverviewSelection = null;

export const OrgOverviewTopbar: DashboardToolDefinition<OverviewFilterState, OverviewSelection>["ToolTopbar"] = () => {
  const { org, isLoading, isError, refetch } = useOrgConfigDashboard();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
        {org ? `${org.name} (${org.id})` : isLoading ? "Loading org..." : "No org loaded"}
      </span>
      {isError ? <span className="text-xs font-semibold text-red-600">Load failed</span> : null}
      <button type="button" className="btn btn-xs btn-ghost border border-slate-300 bg-white/80" onClick={refetch}>
        Refresh
      </button>
    </div>
  );
};

export const OrgOverviewMain: DashboardToolDefinition<OverviewFilterState, OverviewSelection>["Main"] = () => {
  const { org, docsByKind, configDocs, isLoading, isError, error } = useOrgConfigDashboard();

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error instanceof Error ? error.message : "Failed to load org config."}
      </div>
    );
  }
  if (!org) return <div className="py-12 text-center text-sm text-slate-400">No org loaded.</div>;

  const summaries = [
    { key: "display-config", label: "Display Configuration", count: docsByKind.display.length },
    { key: "system-config", label: "System Configuration", count: docsByKind.system.length },
    { key: "email-templates", label: "Email Templates", count: docsByKind.email_template.length },
    { key: "google-drive", label: "Google Drive / Workbooks", count: 1 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{org.name}</h1>
            <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{org.id}</div>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <div>{configDocs.length} config docs</div>
            {org.updatedAt ? <div>Updated {String(org.updatedAt)}</div> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaries.map((item) => (
          <a
            key={item.key}
            href={`/admin/org-config/${item.key}`}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-700 dark:text-slate-200">{item.count}</div>
          </a>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Config Inventory</div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {configDocs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">{doc.label}</div>
                <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{doc.id}</div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">{doc.kind}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
