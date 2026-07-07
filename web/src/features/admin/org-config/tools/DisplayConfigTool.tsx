"use client";

import React from "react";
import type { OrgConfigDoc } from "@client/orgs";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { BudgetDigestConfigEditor } from "@features/budget/BudgetDigestConfigEditor";
import { useOrgConfig, useSaveOrgConfig, type OrgDisplayConfig } from "@hooks/useOrgConfig";
import { useUsers } from "@hooks/useUsers";
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

const DEFAULT_AI_CONFIG: NonNullable<NonNullable<OrgDisplayConfig["aiFeatures"]>["caseNoteAssistantBeta"]> = { enabled: false, allowedWorkbookVariants: ["payer"], defaultClientLabel: "client", defaultStaffLabel: "case manager", monthlyTokenLimit: 25_000_000, monthlyRequestLimit: 10_000, dailyUserRequestLimit: 25, dailyUserTokenLimit: 100_000, userQuotaOverrides: {}, defaultModel: "gemini-2.5-flash-lite", fallbackModel: null, maxInputChars: 12_000, maxOutputTokens: 800, temperature: 0.2 };

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
  const usersQuery = useUsers({ status: "active", limit: 500 });
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [savingBudgetDigest, setSavingBudgetDigest] = React.useState(false);
  const [savingAi, setSavingAi] = React.useState(false);
  const [savingAiUser, setSavingAiUser] = React.useState<string | null>(null);
  const docs = docsByKind.display.filter((doc) => matchesSearch(doc, filterState.search));
  const selectedDoc = docs.find((doc) => doc.id === selection?.docId) ?? docs[0] ?? null;
  const aiConfig = orgConfig?.aiFeatures?.caseNoteAssistantBeta ?? DEFAULT_AI_CONFIG;

  const saveUserAiPermission = async (uid: string, patch: { enabled?: boolean; dailyRequestLimit?: number; dailyTokenLimit?: number }) => {
    if (!orgConfig) return;
    setSavingAiUser(uid);
    try {
      const previous = aiConfig.userQuotaOverrides?.[uid] ?? {};
      await saveOrgConfig.mutateAsync({
        ...orgConfig,
        aiFeatures: {
          ...orgConfig.aiFeatures,
          caseNoteAssistantBeta: {
            ...aiConfig,
            userQuotaOverrides: { ...aiConfig.userQuotaOverrides, [uid]: { ...previous, ...patch } },
          },
        },
      });
      toast("User AI permission saved.", { type: "success" });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Save failed.", { type: "error" });
    } finally {
      setSavingAiUser(null);
    }
  };

  React.useEffect(() => {
    if (!selection && selectedDoc) onSelect({ docId: selectedDoc.id });
  }, [onSelect, selectedDoc, selection]);

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;
  if (isError) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load org config."}</div>;
  if (!selectedDoc) return <div className="py-12 text-center text-sm text-slate-400">No display config docs found.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {orgConfig ? (
        <section className="card">
          <div className="card-section flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Case Note Assistant Beta</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Allows eligible payer-linked customers to use preview-only writing suggestions. Disabled by default.</p>
            </div>
            <button
              type="button"
              disabled={savingAi}
              aria-pressed={orgConfig.aiFeatures?.caseNoteAssistantBeta?.enabled === true}
              onClick={async () => {
                setSavingAi(true);
                const current = orgConfig.aiFeatures?.caseNoteAssistantBeta ?? DEFAULT_AI_CONFIG;
                try {
                  await saveOrgConfig.mutateAsync({ ...orgConfig, aiFeatures: { ...orgConfig.aiFeatures, caseNoteAssistantBeta: { ...current, enabled: !current.enabled } } });
                  toast(`AI Case Note Assistant ${current.enabled ? "disabled" : "enabled"}.`, { type: "success" });
                } catch (e: unknown) { toast(e instanceof Error ? e.message : "Save failed.", { type: "error" }); }
                finally { setSavingAi(false); }
              }}
              className={`btn btn-sm ${orgConfig.aiFeatures?.caseNoteAssistantBeta?.enabled ? "btn-primary" : ""}`}
            >
              {savingAi ? "Saving..." : orgConfig.aiFeatures?.caseNoteAssistantBeta?.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <div className="card-section border-t border-slate-200 dark:border-slate-700">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Per-user access</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Admin access and the user’s personal “Allow AI assistance” preference must both be enabled.</p>
            </div>
            {usersQuery.isLoading ? <p className="text-xs text-slate-500">Loading users...</p> : (
              <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                {(usersQuery.data ?? []).map((user) => {
                  const override = aiConfig.userQuotaOverrides?.[user.uid] ?? {};
                  const personalOptIn = user.extras?.settings?.allowAiAssistance === true;
                  return (
                    <div key={user.uid} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto_110px_130px] sm:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.displayName || user.email || user.uid}</div>
                        <div className="truncate text-xs text-slate-500">{user.email || user.uid} · Personal opt-in: {personalOptIn ? "On" : "Off"}</div>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={override.enabled === true} disabled={savingAiUser === user.uid} onChange={(event) => void saveUserAiPermission(user.uid, { enabled: event.target.checked })} />
                        Org access
                      </label>
                      <label className="text-[11px] text-slate-500">Daily requests
                        <input type="number" min={1} max={1000} defaultValue={override.dailyRequestLimit ?? aiConfig.dailyUserRequestLimit} disabled={savingAiUser === user.uid} onBlur={(event) => void saveUserAiPermission(user.uid, { dailyRequestLimit: Math.max(1, Number(event.target.value) || aiConfig.dailyUserRequestLimit) })} className="input mt-1 h-8 w-full" />
                      </label>
                      <label className="text-[11px] text-slate-500">Daily tokens
                        <input type="number" min={1000} step={1000} defaultValue={override.dailyTokenLimit ?? aiConfig.dailyUserTokenLimit} disabled={savingAiUser === user.uid} onBlur={(event) => void saveUserAiPermission(user.uid, { dailyTokenLimit: Math.max(1000, Number(event.target.value) || aiConfig.dailyUserTokenLimit) })} className="input mt-1 h-8 w-full" />
                      </label>
                    </div>
                  );
                })}
                {!usersQuery.data?.length ? <p className="p-3 text-xs text-slate-500">No active users found.</p> : null}
              </div>
            )}
          </div>
        </section>
      ) : null}
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
