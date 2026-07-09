"use client";

import React from "react";
import type { OrgConfigDoc } from "@client/orgs";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { BudgetDigestConfigEditor } from "@features/budget/BudgetDigestConfigEditor";
import { useOrgConfig, useSaveOrgConfig } from "@hooks/useOrgConfig";
import { toast } from "@lib/toast";
import { useOrgConfigDashboard } from "../orgConfigContext";
import { ConfigDocEditorCard } from "./configEditors";

export type DisplayConfigFilterState = { search: string };
export type DisplayConfigSelection = { docId: string };

function matchesSearch(doc: OrgConfigDoc, search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return `${doc.id} ${doc.label}`.toLowerCase().includes(q);
}

export const DisplayConfigTopbar: DashboardToolDefinition<DisplayConfigFilterState, DisplayConfigSelection>["ToolTopbar"] = ({
  value,
  onChange,
}) => {
  const { docsByKind } = useOrgConfigDashboard();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="input h-8 w-64"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.currentTarget.value })}
        placeholder="Search display config..."
      />
      <span className="text-xs text-slate-500 dark:text-slate-400">{docsByKind.display.length} docs</span>
    </div>
  );
};

export const DisplayConfigSidebar: DashboardToolDefinition<DisplayConfigFilterState, DisplayConfigSelection>["Sidebar"] = ({
  filterState,
  selection,
  onSelect,
}) => {
  const { docsByKind } = useOrgConfigDashboard();
  const docs = docsByKind.display.filter((doc) => matchesSearch(doc, filterState.search));

  return (
    <div className="space-y-2 p-3">
      {docs.map((doc) => {
        const active = selection?.docId === doc.id;
        return (
          <button
            key={doc.id}
            type="button"
            className={[
              "w-full rounded-md border px-3 py-2 text-left text-sm",
              active
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
            ].join(" ")}
            onClick={() => onSelect({ docId: doc.id })}
          >
            <span className="block font-semibold">{doc.label}</span>
            <span className="block truncate font-mono text-xs opacity-70">{doc.id}</span>
          </button>
        );
      })}
      {!docs.length ? <div className="p-3 text-xs text-slate-500">No display config docs.</div> : null}
    </div>
  );
};

export const DisplayConfigMain: DashboardToolDefinition<DisplayConfigFilterState, DisplayConfigSelection>["Main"] = ({
  filterState,
  selection,
  onSelect,
}) => {
  const { docsByKind, patchConfigDoc, isLoading, isError, error } = useOrgConfigDashboard();
  const { data: orgConfig } = useOrgConfig();
  const saveOrgConfig = useSaveOrgConfig();
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [savingBudgetDigest, setSavingBudgetDigest] = React.useState(false);
  const docs = docsByKind.display.filter((doc) => matchesSearch(doc, filterState.search));
  const selectedDoc = docs.find((doc) => doc.id === selection?.docId) ?? docs[0] ?? null;

  React.useEffect(() => {
    if (!selection && selectedDoc) onSelect({ docId: selectedDoc.id });
  }, [onSelect, selectedDoc, selection]);

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;
  if (isError) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load org config."}</div>;
  if (!selectedDoc) return <div className="py-12 text-center text-sm text-slate-400">No display config docs found.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <BudgetDigestConfigEditor
        config={orgConfig}
        saving={savingBudgetDigest}
        onSave={async (next) => {
          setSavingBudgetDigest(true);
          try {
            await saveOrgConfig.mutateAsync(next);
            toast("Budget digest settings saved.", { type: "success" });
          } catch (e: unknown) {
            toast(e instanceof Error ? e.message : "Save failed.", { type: "error" });
          } finally {
            setSavingBudgetDigest(false);
          }
        }}
      />
      <ConfigDocEditorCard
        doc={selectedDoc}
        saving={savingId === selectedDoc.id}
        onSave={async (patch) => {
          setSavingId(selectedDoc.id);
          try {
            await patchConfigDoc(selectedDoc.id, patch);
            toast(`${selectedDoc.label} saved.`, { type: "success" });
          } catch (e: unknown) {
            toast(e instanceof Error ? e.message : "Save failed.", { type: "error" });
          } finally {
            setSavingId(null);
          }
        }}
      />
    </div>
  );
};
