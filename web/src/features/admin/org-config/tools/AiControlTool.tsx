"use client";

import React from "react";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { useOrgConfig, useSaveOrgConfig } from "@hooks/useOrgConfig";
import type { OrgDisplayConfig } from "@hooks/useOrgConfig";
import { toast } from "@lib/toast";
import { AI_FEATURE_REGISTRY } from "./aiFeatureRegistry";

type AiControlFilterState = Record<string, never>;
type AiControlSelection = null;

export const AiControlTopbar: DashboardToolDefinition<AiControlFilterState, AiControlSelection>["ToolTopbar"] = () => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">AI feature gates &amp; eligibility</span>
    </div>
  );
};

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
            ×
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
  const [savingId, setSavingId] = React.useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
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
          </section>
        );
      })}
      {!AI_FEATURE_REGISTRY.length ? (
        <div className="py-12 text-center text-sm text-slate-400">No AI features registered yet.</div>
      ) : null}
    </div>
  );
};
