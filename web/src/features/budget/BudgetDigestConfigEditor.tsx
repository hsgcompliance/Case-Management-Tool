"use client";

import React from "react";
import type { OrgDisplayConfig } from "@hooks/useOrgConfig";

type DigestConfig = NonNullable<OrgDisplayConfig["budgetDisplay"]["digest"]>;

const DEFAULT_DIGEST_CONFIG: Required<DigestConfig> = {
  showOverallSummary: true,
  showGrantTotals: true,
  mainDisplayLevel: "grant",
  expandNestedRowsByDefault: false,
  groupChildrenUnderParentGrant: true,
};

function normalizeDigestConfig(config: OrgDisplayConfig | null | undefined): Required<DigestConfig> {
  return {
    ...DEFAULT_DIGEST_CONFIG,
    ...(config?.budgetDisplay?.digest ?? {}),
  };
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-white px-3 py-2">
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

export function BudgetDigestConfigEditor({
  config,
  onSave,
  saving = false,
  compact = false,
}: {
  config: OrgDisplayConfig | null | undefined;
  onSave: (next: OrgDisplayConfig) => Promise<void> | void;
  saving?: boolean;
  compact?: boolean;
}) {
  const [draft, setDraft] = React.useState<Required<DigestConfig>>(() => normalizeDigestConfig(config));

  React.useEffect(() => {
    setDraft(normalizeDigestConfig(config));
  }, [config]);

  const canSave = !!config && !saving;

  const update = <K extends keyof Required<DigestConfig>>(key: K, value: Required<DigestConfig>[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!config) return;
    await onSave({
      ...config,
      budgetDisplay: {
        ...config.budgetDisplay,
        digest: draft,
      },
    });
  };

  return (
    <section className={compact ? "space-y-3" : "rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Budget Digest Configuration</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Controls how grant totals, line items, and split goals appear in the Budget Digest.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={!canSave}
          onClick={handleSave}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {!config ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No display config doc is available yet.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <ToggleRow
          label="Show overall budget summary"
          description="Include the digest-level summary totals at the top of the email."
          checked={draft.showOverallSummary}
          onChange={(checked) => update("showOverallSummary", checked)}
        />
        <ToggleRow
          label="Show grant totals"
          description="Render grant-level totals when line items or split cycles are shown."
          checked={draft.showGrantTotals}
          onChange={(checked) => update("showGrantTotals", checked)}
        />
        <ToggleRow
          label="Expand nested rows by default"
          description="Open line item and cycle children automatically in grouped digest views."
          checked={draft.expandNestedRowsByDefault}
          onChange={(checked) => update("expandNestedRowsByDefault", checked)}
        />
        <ToggleRow
          label="Group children under parent grant"
          description="Keep line items and split goals visually grouped under their grant."
          checked={draft.groupChildrenUnderParentGrant}
          onChange={(checked) => update("groupChildrenUnderParentGrant", checked)}
        />
      </div>

      <label className="block max-w-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Main display level</span>
        <select
          className="input w-full"
          value={draft.mainDisplayLevel}
          onChange={(event) => update("mainDisplayLevel", event.currentTarget.value as Required<DigestConfig>["mainDisplayLevel"])}
        >
          <option value="grant">Grant</option>
          <option value="lineItem">Line item</option>
          <option value="split">Split goal / cycle</option>
        </select>
      </label>
    </section>
  );
}
