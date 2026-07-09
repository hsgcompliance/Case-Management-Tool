"use client";

import React from "react";
import type { CaseNoteUsageSummaryResponse } from "@client/caseNoteAssistant";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { useCaseNoteAssistantUsage } from "@hooks/useCaseNoteAssistantUsage";
import { useOrgConfig, useSaveOrgConfig } from "@hooks/useOrgConfig";
import type { OrgDisplayConfig } from "@hooks/useOrgConfig";
import { useUsers } from "@hooks/useUsers";
import { toast } from "@lib/toast";
import { AI_FEATURE_REGISTRY, CASE_NOTE_ASSISTANT_DEFAULTS } from "./aiFeatureRegistry";

type AiControlFilterState = Record<string, never>;
type AiControlSelection = null;
type CaseNoteAiConfig = NonNullable<NonNullable<OrgDisplayConfig["aiFeatures"]>["caseNoteAssistantBeta"]>;

const DEFAULT_CASE_NOTE_CONFIG = CASE_NOTE_ASSISTANT_DEFAULTS as CaseNoteAiConfig;

export const AiControlTopbar: DashboardToolDefinition<AiControlFilterState, AiControlSelection>["ToolTopbar"] = () => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">AI controls, quotas, and usage</span>
    </div>
  );
};

function formatInt(value: unknown) {
  return Math.max(0, Number(value) || 0).toLocaleString();
}

function usagePct(used: number, limit: number) {
  if (!limit) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

function NumberField({
  label,
  value,
  min = 0,
  step = 1,
  disabled,
  onSave,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  disabled?: boolean;
  onSave: (value: number) => void;
}) {
  return (
    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        defaultValue={value}
        disabled={disabled}
        onBlur={(event) => {
          const next = Math.max(min, Number(event.currentTarget.value) || value);
          if (next !== value) onSave(next);
        }}
        className="input mt-1 h-8 w-full"
      />
    </label>
  );
}

function VariantEditor({
  variants,
  onChange,
  disabled,
}: {
  variants: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState("");

  function addDraft() {
    const next = draft.trim().toLowerCase();
    if (!next || variants.includes(next)) { setDraft(""); return; }
    onChange([...variants, next]);
    setDraft("");
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {variants.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {v}
          <button
            type="button"
            disabled={disabled}
            className="text-slate-400 hover:text-red-600"
            onClick={() => onChange(variants.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
          >
            x
          </button>
        </span>
      ))}
      <input
        className="input h-6 w-32 text-xs"
        placeholder="add variant"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          addDraft();
        }}
        onBlur={addDraft}
      />
    </div>
  );
}

export const AiControlMain: DashboardToolDefinition<AiControlFilterState, AiControlSelection>["Main"] = () => {
  const { data: orgConfig, isLoading, isError, error } = useOrgConfig();
  const saveOrgConfig = useSaveOrgConfig();
  const usersQuery = useUsers({ status: "active", limit: 500 });
  const usageQuery = useCaseNoteAssistantUsage();
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [savingUser, setSavingUser] = React.useState<string | null>(null);

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error instanceof Error ? error.message : "Failed to load org config."}
      </div>
    );
  }
  if (!orgConfig) return <div className="py-12 text-center text-sm text-slate-400">No org config loaded.</div>;

  const aiFeatures = (orgConfig.aiFeatures ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const caseNoteConfig = {
    ...DEFAULT_CASE_NOTE_CONFIG,
    ...(aiFeatures.caseNoteAssistantBeta ?? {}),
  } as CaseNoteAiConfig;
  const usage = usageQuery.data;
  type UsageUser = CaseNoteUsageSummaryResponse["users"][number];
  const usageUsers: UsageUser[] = usage?.users ?? [];
  const usageByUid = new Map<string, UsageUser>(usageUsers.map((row) => [row.uid, row]));

  async function saveFeature(id: string, nextRaw: Record<string, unknown>) {
    setSavingId(id);
    try {
      const nextAiFeatures = { ...(orgConfig!.aiFeatures as Record<string, unknown> | undefined), [id]: nextRaw };
      await saveOrgConfig.mutateAsync({
        ...(orgConfig as OrgDisplayConfig),
        aiFeatures: nextAiFeatures as OrgDisplayConfig["aiFeatures"],
      });
      toast(`${id} settings saved.`, { type: "success" });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Save failed.", { type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  async function saveCaseNotePatch(patch: Partial<CaseNoteAiConfig>) {
    await saveFeature("caseNoteAssistantBeta", { ...caseNoteConfig, ...patch });
  }

  async function saveUserAiPermission(uid: string, patch: { enabled?: boolean; dailyRequestLimit?: number; dailyTokenLimit?: number }) {
    setSavingUser(uid);
    try {
      const previous = caseNoteConfig.userQuotaOverrides?.[uid] ?? {};
      await saveCaseNotePatch({
        userQuotaOverrides: {
          ...caseNoteConfig.userQuotaOverrides,
          [uid]: { ...previous, ...patch },
        },
      });
    } finally {
      setSavingUser(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {AI_FEATURE_REGISTRY.map((entry) => {
        const raw = aiFeatures[entry.id];
        const eligibility = entry.readEligibility(raw);
        const saving = savingId === entry.id;
        return (
          <section key={entry.id} className="card">
            <div className="card-section flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.title}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.description}</p>
                {entry.personalOptInNote ? (
                  <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">{entry.personalOptInNote}</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={saving}
                aria-pressed={eligibility.enabled}
                onClick={() => saveFeature(entry.id, entry.writeEligibility(raw, { ...eligibility, enabled: !eligibility.enabled }))}
                className={`btn btn-sm shrink-0 ${eligibility.enabled ? "btn-primary" : ""}`}
              >
                {saving ? "Saving..." : eligibility.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            <div className="card-section">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Allowed workbook variants</div>
              <VariantEditor
                variants={eligibility.allowedWorkbookVariants}
                disabled={saving}
                onChange={(next) => saveFeature(entry.id, entry.writeEligibility(raw, { ...eligibility, allowedWorkbookVariants: next }))}
              />
            </div>
            {entry.id === "caseNoteAssistantBeta" ? (
              <>
                <div className="card-section border-t border-slate-200 dark:border-slate-700">
                  <div className="grid gap-3 md:grid-cols-4">
                    <NumberField label="Monthly org requests" value={caseNoteConfig.monthlyRequestLimit} min={1} disabled={saving} onSave={(value) => void saveCaseNotePatch({ monthlyRequestLimit: value })} />
                    <NumberField label="Monthly org tokens" value={caseNoteConfig.monthlyTokenLimit} min={1000} step={1000} disabled={saving} onSave={(value) => void saveCaseNotePatch({ monthlyTokenLimit: value })} />
                    <NumberField label="Default daily user requests" value={caseNoteConfig.dailyUserRequestLimit} min={1} disabled={saving} onSave={(value) => void saveCaseNotePatch({ dailyUserRequestLimit: value })} />
                    <NumberField label="Default daily user tokens" value={caseNoteConfig.dailyUserTokenLimit} min={1000} step={1000} disabled={saving} onSave={(value) => void saveCaseNotePatch({ dailyUserTokenLimit: value })} />
                    <NumberField label="Max input characters" value={caseNoteConfig.maxInputChars} min={1000} step={500} disabled={saving} onSave={(value) => void saveCaseNotePatch({ maxInputChars: value })} />
                    <NumberField label="Max output tokens" value={caseNoteConfig.maxOutputTokens} min={100} step={50} disabled={saving} onSave={(value) => void saveCaseNotePatch({ maxOutputTokens: value })} />
                    <NumberField label="Temperature" value={caseNoteConfig.temperature} min={0} step={0.1} disabled={saving} onSave={(value) => void saveCaseNotePatch({ temperature: Math.min(2, value) })} />
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Default model
                      <input
                        className="input mt-1 h-8 w-full"
                        defaultValue={caseNoteConfig.defaultModel}
                        disabled={saving}
                        onBlur={(event) => {
                          const next = event.currentTarget.value.trim();
                          if (next && next !== caseNoteConfig.defaultModel) void saveCaseNotePatch({ defaultModel: next });
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="card-section border-t border-slate-200 dark:border-slate-700">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Usage</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current month request and token totals.</p>
                    </div>
                    <button type="button" className="btn btn-sm" onClick={() => void usageQuery.refetch()} disabled={usageQuery.isFetching}>
                      {usageQuery.isFetching ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>
                  {usageQuery.isError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load usage.</div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                        <div className="text-xs font-medium text-slate-500">Org requests</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatInt(usage?.org.requests)} / {formatInt(usage?.org.monthlyRequestLimit ?? caseNoteConfig.monthlyRequestLimit)}</div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${usagePct(usage?.org.requests ?? 0, usage?.org.monthlyRequestLimit ?? caseNoteConfig.monthlyRequestLimit)}%` }} />
                        </div>
                      </div>
                      <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                        <div className="text-xs font-medium text-slate-500">Org tokens</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatInt(usage?.org.tokens)} / {formatInt(usage?.org.monthlyTokenLimit ?? caseNoteConfig.monthlyTokenLimit)}</div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${usagePct(usage?.org.tokens ?? 0, usage?.org.monthlyTokenLimit ?? caseNoteConfig.monthlyTokenLimit)}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="card-section border-t border-slate-200 dark:border-slate-700">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Per-user access and usage</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Admin access and the user's personal setting must both be enabled before they can generate suggestions.</p>
                  </div>
                  {usersQuery.isLoading ? <p className="text-xs text-slate-500">Loading users...</p> : (
                    <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                      {(usersQuery.data ?? []).map((user) => {
                        const override = caseNoteConfig.userQuotaOverrides?.[user.uid] ?? {};
                        const personalOptIn = user.extras?.settings?.allowAiAssistance === true;
                        const row = usageByUid.get(user.uid);
                        return (
                          <div key={user.uid} className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_90px_90px_110px_130px_130px] lg:items-center">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.displayName || user.email || user.uid}</div>
                              <div className="truncate text-xs text-slate-500">{user.email || user.uid} | Personal opt-in: {personalOptIn ? "On" : "Off"}</div>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300"><span className="block text-[10px] uppercase text-slate-400">Requests</span>{formatInt(row?.requests)}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-300"><span className="block text-[10px] uppercase text-slate-400">Tokens</span>{formatInt(row?.tokens)}</div>
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                              <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={override.enabled === true} disabled={savingUser === user.uid} onChange={(event) => void saveUserAiPermission(user.uid, { enabled: event.target.checked })} />
                              Org access
                            </label>
                            <NumberField label="Daily requests" value={override.dailyRequestLimit ?? caseNoteConfig.dailyUserRequestLimit} min={1} disabled={savingUser === user.uid} onSave={(value) => void saveUserAiPermission(user.uid, { dailyRequestLimit: value })} />
                            <NumberField label="Daily tokens" value={override.dailyTokenLimit ?? caseNoteConfig.dailyUserTokenLimit} min={1000} step={1000} disabled={savingUser === user.uid} onSave={(value) => void saveUserAiPermission(user.uid, { dailyTokenLimit: value })} />
                          </div>
                        );
                      })}
                      {!usersQuery.data?.length ? <p className="p-3 text-xs text-slate-500">No active users found.</p> : null}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </section>
        );
      })}
      {!AI_FEATURE_REGISTRY.length ? (
        <div className="py-12 text-center text-sm text-slate-400">No AI features registered yet.</div>
      ) : null}
    </div>
  );
};
