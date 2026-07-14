"use client";

// Add/Edit goal form for the structured view's Goals section — the website
// counterpart of the mobile app's GoalEditSheet, plus the SMART goal AI assist:
// staff describe the goal in 1-2 sentences and the assistant drafts the
// structured fields (Goal, Objective, Intervention/Task, Completion Criteria).
// Responsible person, service tier, and target date are staff decisions — the
// AI never fills them; leaving them blank only surfaces a soft "missing info"
// warning and never blocks the save.

import React from "react";
import api from "@client/api";
import { useOrgConfig } from "@hooks/useOrgConfig";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";
import { toast } from "@lib/toast";
import type { tss as TssNS } from "@hdb/contracts";

function driveHeaders() {
  const token = getGoogleDriveAccessToken();
  return token ? { "x-drive-access-token": token } : undefined;
}

/** Fields a user can fill: skip computed and write-disabled (formula) fields. */
function writableFields(cfgEntity: TssNS.TssDisplayEntityConfig): TssNS.TssSmartHeaderConfig[] {
  return (cfgEntity.fields ?? []).filter(
    (f) => f.dataType !== "computed" && f.write?.enabled !== false,
  );
}

function optionsFor(
  field: TssNS.TssSmartHeaderConfig,
  config: TssNS.TssWorksheetConfig,
): string[] {
  if (!field.optionSourceId) return [];
  const list = config.dropdownLists?.[field.optionSourceId] as { values?: string[] } | undefined;
  return Array.isArray(list?.values) ? list!.values : [];
}

// Staff-decision fields the AI never fills — drive the "missing info" warning.
const MANUAL_FIELD_IDS = ["responsible", "serviceTier", "targetDate"] as const;
// Fields the SMART assist generates, in form order.
const AI_FIELD_IDS = ["goalSmart", "objective", "interventionTask", "goalCompletionCriteria"] as const;

// ── SMART AI assist box ───────────────────────────────────────────────────────

function SmartGoalAssist({
  customerId,
  disabled,
  onGenerated,
}: {
  customerId: string;
  disabled: boolean;
  onGenerated: (goal: Record<string, string>, missingInfo: string[]) => void;
}) {
  const [description, setDescription] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const generate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const resp = (await (api as any).postWith("generateSmartGoalSuggestion", {
        customerId,
        description: description.trim(),
      })) as Record<string, unknown>;
      if (!resp?.ok) {
        setError(String(resp?.message || resp?.error || "Could not generate the goal."));
        return;
      }
      const goal = (resp.goal ?? {}) as Record<string, string>;
      const missingInfo = Array.isArray(resp.missingInfo) ? (resp.missingInfo as string[]) : [];
      onGenerated(goal, missingInfo);
    } catch (e: unknown) {
      const body = (e as { meta?: { response?: { message?: string; error?: string } } })?.meta?.response;
      setError(String(body?.message || body?.error || (e as Error)?.message || "Could not generate the goal."));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <span aria-hidden>✨</span>
        <span className="text-xs font-semibold text-indigo-900">SMART goal assistant</span>
        <span className="rounded-full border border-indigo-300 bg-white px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
          Beta
        </span>
      </div>
      <textarea
        className="input w-full min-h-[56px] text-sm"
        placeholder="Describe the goal in 1-2 sentences — e.g. “Client wants to save $500 for a security deposit and apply to 3 apartments by fall.”"
        value={description}
        disabled={disabled || generating}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-indigo-700/70">
          Drafts the goal, objective, intervention, and completion criteria — you still pick responsible person, tier, and target date.
        </span>
        <button
          type="button"
          className="btn btn-sm btn-primary shrink-0"
          disabled={disabled || generating || !description.trim()}
          onClick={() => void generate()}
        >
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function GoalForm({
  customerId,
  cfgEntity,
  config,
  goalRow,
  onSaved,
  onCancel,
}: {
  customerId: string;
  cfgEntity: TssNS.TssDisplayEntityConfig;
  config: TssNS.TssWorksheetConfig;
  /** null → add a new goal; otherwise edit this extracted row in place. */
  goalRow: TssNS.TssExtractedRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!goalRow;
  const fields = React.useMemo(() => writableFields(cfgEntity), [cfgEntity]);
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (goalRow) {
      for (const f of fields) {
        const c = goalRow.values?.[f.id];
        init[f.id] = c ? String(c.displayValue ?? c.value ?? "").trim() : "";
      }
    }
    return init;
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Extra gaps the AI flagged beyond the manual fields (shown once, dismissable).
  const [aiNotes, setAiNotes] = React.useState<string[]>([]);

  const setField = (id: string, v: string) => setValues((cur) => ({ ...cur, [id]: v }));
  const missingRequired = fields.some((f) => f.required && !String(values[f.id] || "").trim());

  // AI assist is shown when the org's AI beta is on; the backend re-checks the
  // full eligibility chain (user enabled, personal opt-in, variant, quotas).
  const orgConfigQ = useOrgConfig();
  const aiEnabled = orgConfigQ.data?.aiFeatures?.caseNoteAssistantBeta?.enabled === true;

  const applyGenerated = (goal: Record<string, string>, missingInfo: string[]) => {
    setValues((cur) => {
      const next = { ...cur };
      for (const id of AI_FIELD_IDS) {
        const v = String(goal[id] ?? "").trim();
        if (v) next[id] = v;
      }
      // New goals default to Open unless the staff member already chose a status.
      if (!String(next.status ?? "").trim()) next.status = "Open";
      return next;
    });
    setAiNotes(missingInfo.filter((item) => !/responsible|target date|service tier/i.test(item)));
  };

  // Soft warning for blank staff-decision fields — informative, never blocking.
  const missingManual = MANUAL_FIELD_IDS
    .map((id) => fields.find((f) => f.id === id))
    .filter((f): f is TssNS.TssSmartHeaderConfig => !!f && !String(values[f.id] || "").trim())
    .map((f) => f.display?.label ?? f.expected);

  const save = async () => {
    if (missingRequired) { setError("Fill in the required fields."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const f of fields) {
        const v = String(values[f.id] ?? "").trim();
        // Edit sends every field (empty clears); add sends only filled fields.
        if (isEdit) payload[f.id] = v;
        else if (v) payload[f.id] = v;
      }
      const resp = (await (api as any).postWith(
        "appendCustomerWorkbookRow",
        {
          customerId,
          entityId: cfgEntity.id,
          values: payload,
          ...(isEdit ? { mode: "update", rowKey: goalRow!.rowKey } : { mode: "insert" }),
        },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (!resp?.ok) {
        setError(String(resp?.error || "Could not save the goal."));
        return;
      }
      if (!isEdit) {
        void (api as any).postWith(
          "patchCustomerWorkbookScaffold",
          { customerId, planDate: "today" },
          driveHeaders(),
        ).catch(() => null);
      }
      toast(isEdit ? "Goal updated." : "Goal added to the sheet.", { type: "success" });
      onSaved();
    } catch (e: unknown) {
      const body = (e as { meta?: { response?: { error?: string } } })?.meta?.response;
      setError(String(body?.error || (e as Error)?.message || "Could not save the goal."));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "input w-full text-sm";

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-3">
      <div className="text-xs font-semibold text-slate-700">{isEdit ? "Edit goal" : "New goal"}</div>

      {/* Available for edits too — regenerating overwrites the AI-mapped fields. */}
      {aiEnabled ? (
        <SmartGoalAssist customerId={customerId} disabled={saving} onGenerated={applyGenerated} />
      ) : null}

      {aiNotes.length > 0 ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          <span className="font-semibold">Assistant notes:</span> {aiNotes.join(" · ")}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((f) => {
          const label = f.display?.label ?? f.expected;
          const value = values[f.id] ?? "";
          const opts = optionsFor(f, config);

          // Status renders as a segmented toggle (Open / Closed / On Hold).
          if (f.id === "status" && opts.length) {
            return (
              <div key={f.id} className="field block sm:col-span-2">
                <span className="label text-xs">{label}</span>
                <div className="mt-1 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                  {opts.map((o) => (
                    <button
                      key={o}
                      type="button"
                      disabled={saving}
                      onClick={() => setField(f.id, value === o ? "" : o)}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        value === o
                          ? o === "Closed"
                            ? "bg-emerald-100 text-emerald-800"
                            : o === "On Hold"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-800"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          let control: React.ReactNode;
          if (f.dataType === "select" && opts.length) {
            control = (
              <select className="select w-full text-sm" value={value} disabled={saving} onChange={(e) => setField(f.id, e.target.value)}>
                <option value="">—</option>
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          } else if (f.dataType === "longText") {
            control = <textarea className={`${inputCls} min-h-[64px]`} value={value} disabled={saving} onChange={(e) => setField(f.id, e.target.value)} />;
          } else if (f.dataType === "date") {
            control = <input type="date" className={inputCls} value={value} disabled={saving} onChange={(e) => setField(f.id, e.target.value)} />;
          } else {
            control = <input type="text" className={inputCls} value={value} disabled={saving} onChange={(e) => setField(f.id, e.target.value)} />;
          }

          return (
            <label key={f.id} className={`field block ${f.display?.multiline ? "sm:col-span-2" : ""}`}>
              <span className="label text-xs">{label}{f.required ? <span className="text-red-500"> *</span> : null}</span>
              {control}
            </label>
          );
        })}
      </div>

      {missingManual.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Missing info:</span> {missingManual.join(", ")} — you can still save and fill these in later.
        </div>
      ) : null}

      {error ? <div className="text-xs text-red-600">{error}</div> : null}

      {!isEdit ? (
        <p className="text-[11px] text-slate-400">
          Adds a new row to the goals table — the sections below it are pushed down, never overwritten.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void save()} disabled={saving || missingRequired}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add goal"}
        </button>
      </div>
    </div>
  );
}
