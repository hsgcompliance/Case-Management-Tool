"use client";

import React from "react";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { toast } from "@lib/toast";
import { useOrgConfigDashboard } from "../orgConfigContext";

type DevOrgControlsFilterState = Record<string, never>;
type DevOrgControlsSelection = null;

export const DevOrgControlsTopbar: DashboardToolDefinition<DevOrgControlsFilterState, DevOrgControlsSelection>["ToolTopbar"] = () => {
  const { isDev, targetOrgId, setTargetOrgId, org } = useOrgConfigDashboard();
  if (!isDev) return <div className="text-xs text-slate-500">Dev role required.</div>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="input h-8 w-72"
        placeholder="org ID to view (empty = own org)"
        value={targetOrgId}
        onChange={(event) => setTargetOrgId(event.currentTarget.value)}
      />
      <span className="text-xs text-slate-500 dark:text-slate-400">Current: {org?.id || "own org"}</span>
    </div>
  );
};

export const DevOrgControlsMain: DashboardToolDefinition<DevOrgControlsFilterState, DevOrgControlsSelection>["Main"] = () => {
  const { isDev, org, createOrg, deleteCurrentOrg, isCreatingOrg, isDeletingOrg } = useOrgConfigDashboard();
  const [createId, setCreateId] = React.useState("");
  const [createName, setCreateName] = React.useState("");

  if (!isDev) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Dev org controls require a dev-like role.
      </div>
    );
  }

  const handleCreate = async () => {
    const id = createId.trim();
    const name = createName.trim();
    if (!id || !name) {
      toast("Org ID and name are required.", { type: "error" });
      return;
    }
    try {
      const created = await createOrg(id, name);
      toast(`Org ${created.id} created.`, { type: "success" });
      setCreateId("");
      setCreateName("");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Create failed.", { type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!org) return;
    if (!confirm(`Delete org "${org.id}"? This cannot be undone.`)) return;
    try {
      await deleteCurrentOrg();
      toast(`Org ${org.id} deleted.`, { type: "success" });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Delete failed.", { type: "error" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Current Target Org</div>
        {org ? (
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{org.name}</div>
            <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{org.id}</div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">No org loaded.</div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Create New Org</div>
        <div className="flex flex-wrap gap-2">
          <input className="input w-56" placeholder="org ID (e.g. HRDC_IX)" value={createId} onChange={(event) => setCreateId(event.currentTarget.value)} />
          <input className="input w-72" placeholder="org name" value={createName} onChange={(event) => setCreateName(event.currentTarget.value)} />
          <button type="button" disabled={isCreatingOrg || !createId || !createName} className="btn btn-sm btn-primary" onClick={handleCreate}>
            {isCreatingOrg ? "Creating..." : "Create Org"}
          </button>
        </div>
      </section>

      {org ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <div className="mb-3 text-sm font-semibold text-red-900 dark:text-red-100">Delete Target Org</div>
          <button type="button" disabled={isDeletingOrg} className="btn btn-sm border border-red-300 bg-white text-red-700 hover:bg-red-100" onClick={handleDelete}>
            {isDeletingOrg ? "Deleting..." : `Delete Org "${org.id}"`}
          </button>
        </section>
      ) : null}
    </div>
  );
};

