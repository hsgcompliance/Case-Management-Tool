"use client";

import React, { useRef, useState } from "react";
import GrantSelect from "@entities/selectors/GrantSelect";
import { AssessmentBuilder, type AssessmentTemplateDraft } from "@entities/assessments/AssessmentBuilder";
import { TaskBuilder, type TaskTemplateDraft } from "@entities/tasks/TaskBuilder";
import { useAssessmentTemplates, useAssessmentTemplatesUpsert } from "@hooks/useAssessments";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import { HelpDialogButton } from "./AssessmentBuilderHelpDialogs";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalcField = {
  key: string;
  label: string;
  expression: string;
  format?: "number" | "percent" | "rank";
};

type ToolTemplateDraft = AssessmentTemplateDraft & {
  taskDefs: TaskTemplateDraft[];
  calculation: {
    fields: CalcField[];
    rankStrategy: "sum" | "weightedSum" | "max" | "custom";
  };
};

const RANK_STRATEGY_HELP: Record<ToolTemplateDraft["calculation"]["rankStrategy"], string> = {
  sum: "Simple sum of selected answer points.",
  weightedSum: "Weighted sum where some inputs contribute more than others.",
  max: "Uses only the single highest contributing value.",
  custom: "Use custom backend logic and formula fields.",
};

// ── Defaults & Presets ────────────────────────────────────────────────────────

const DEFAULT_DRAFT = (): ToolTemplateDraft => ({
  title: "",
  kind: "custom",
  scope: "enrollment",
  description: "",
  locked: false,
  editPolicy: "team",
  version: 1,
  schema: {
    type: "rubric",
    rubric: { title: "", version: "v1", questions: [], levels: [{ min: 0, label: "Default" }] },
  },
  taskDefs: [],
  calculation: {
    rankStrategy: "sum",
    fields: [{ key: "total_score", label: "Total Score", expression: "sum(points)", format: "number" }],
  },
});

const REFERRAL_PRESET = (): ToolTemplateDraft => ({
  ...DEFAULT_DRAFT(),
  title: "Referral Priority Template",
  kind: "waitlistPriority",
  scope: "enrollment",
  description: "Ranks referrals by vulnerability and urgency.",
  schema: {
    type: "rubric",
    rubric: {
      title: "Referral Priority",
      version: "v1",
      questions: [
        {
          id: "housing_status",
          label: "Current housing status",
          options: [
            { value: "street", label: "Unsheltered", points: 5 },
            { value: "shelter", label: "Emergency shelter", points: 4 },
            { value: "doubled", label: "Doubled-up", points: 2 },
            { value: "stable", label: "Stable housing", points: 0 },
          ],
        },
        {
          id: "medical_risk",
          label: "Medical/behavioral risk",
          options: [
            { value: "high", label: "High", points: 5 },
            { value: "moderate", label: "Moderate", points: 3 },
            { value: "low", label: "Low", points: 1 },
          ],
        },
        {
          id: "family_composition",
          label: "Household vulnerability",
          options: [
            { value: "children", label: "Children present", points: 3 },
            { value: "senior", label: "Senior/disabled", points: 3 },
            { value: "single", label: "Single adult", points: 1 },
          ],
        },
      ],
      levels: [
        { min: 0, max: 5, label: "Low" },
        { min: 6, max: 10, label: "Medium" },
        { min: 11, label: "High" },
      ],
    },
  },
  taskDefs: [
    {
      id: "referral_review_weekly",
      name: "Referral queue review",
      kind: "recurring",
      frequency: "weekly",
      notify: true,
      bucket: "assessment",
      multiparty: { mode: "sequential", steps: [{ group: "casemanager" }, { group: "compliance" }] },
    },
    {
      id: "eligibility_packet",
      name: "Eligibility packet check",
      kind: "one-off",
      dueDate: null,
      notify: true,
      bucket: "compliance",
      multiparty: null,
    },
  ],
  calculation: {
    rankStrategy: "weightedSum",
    fields: [
      { key: "risk_score", label: "Risk Score", expression: "sum(points)", format: "number" },
      { key: "priority_rank", label: "Priority Rank", expression: "rank_desc(risk_score)", format: "rank" },
    ],
  },
});

const ACUITY_PRESET = (): ToolTemplateDraft => ({
  ...DEFAULT_DRAFT(),
  title: "Acuity Assessment Template",
  kind: "acuity",
  scope: "customer",
  description: "Computes an acuity level from weighted social determinants.",
  schema: {
    type: "rubric",
    rubric: {
      title: "Customer Acuity",
      version: "v1",
      questions: [
        {
          id: "income_stability",
          label: "Income stability",
          options: [
            { value: "none", label: "No income", points: 4 },
            { value: "unstable", label: "Unstable", points: 2 },
            { value: "stable", label: "Stable", points: 0 },
          ],
        },
        {
          id: "health_needs",
          label: "Health needs",
          options: [
            { value: "complex", label: "Complex unmanaged", points: 5 },
            { value: "managed", label: "Managed chronic", points: 2 },
            { value: "low", label: "Low", points: 0 },
          ],
        },
        {
          id: "legal_barriers",
          label: "Legal/document barriers",
          options: [
            { value: "severe", label: "Severe", points: 4 },
            { value: "moderate", label: "Moderate", points: 2 },
            { value: "none", label: "None", points: 0 },
          ],
        },
      ],
      levels: [
        { min: 0, max: 4, label: "Low acuity" },
        { min: 5, max: 9, label: "Moderate acuity" },
        { min: 10, label: "High acuity" },
      ],
    },
  },
  taskDefs: [
    {
      id: "acuity_monthly_recheck",
      name: "Acuity re-check",
      kind: "recurring",
      frequency: "monthly",
      notify: true,
      bucket: "assessment",
      multiparty: { mode: "parallel", steps: [{ group: "casemanager" }, { group: "admin" }] },
    },
  ],
  calculation: {
    rankStrategy: "sum",
    fields: [
      { key: "acuity_score", label: "Acuity Score", expression: "sum(points)", format: "number" },
      { key: "acuity_band", label: "Acuity Band", expression: "level_by_threshold(acuity_score)", format: "rank" },
    ],
  },
});

// ── Settings Drawer ───────────────────────────────────────────────────────────

function SettingsDrawer({
  open,
  onClose,
  draft,
  setDraft,
  grantId,
  setGrantId,
  templates,
  selectedExistingId,
  loadPreset,
  loadExisting,
  expressionOptions,
  explainExpression,
  lockedKind,
}: {
  open: boolean;
  onClose: () => void;
  draft: ToolTemplateDraft;
  setDraft: React.Dispatch<React.SetStateAction<ToolTemplateDraft>>;
  grantId: string | null;
  setGrantId: (v: string | null) => void;
  templates: Array<Record<string, unknown>>;
  selectedExistingId: string;
  loadPreset: (type: "referral" | "acuity" | "blank") => void;
  loadExisting: (id: string) => void;
  expressionOptions: Array<{ value: string; label: string }>;
  explainExpression: (expr: string) => string;
  lockedKind?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const calc = draft.calculation;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className={[
          "fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Drawer */}
      <div
        className={[
          "fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <span className="text-sm font-semibold text-slate-800">Template Settings</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M12 2L2 12M2 2l10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Presets */}
          <section>
            <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Presets</span>
              <HelpDialogButton helpKey="presets" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["blank", "referral", "acuity"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { loadPreset(p); onClose(); }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 capitalize hover:bg-slate-50 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </section>

          {/* Load existing */}
          <section>
            <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Load Existing</span>
              <HelpDialogButton helpKey="load_existing" />
            </div>
            <select
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={selectedExistingId}
              onChange={(e) => { loadExisting(e.currentTarget.value); onClose(); }}
            >
              <option value="">— Select template —</option>
              {templates.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {String(t.title || t.id)} ({String(t.kind || "custom")})
                </option>
              ))}
            </select>
          </section>

          <div className="border-t border-slate-100" />

          {/* Meta fields */}
          <section className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template Properties</div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Kind / Metric key</label>
              <input
                className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${lockedKind ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-slate-50"}`}
                value={lockedKind ?? draft.kind}
                readOnly={!!lockedKind}
                onChange={lockedKind ? undefined : (e) => { const v = e.currentTarget.value; setDraft((prev) => ({ ...prev, kind: v })); }}
                placeholder="e.g. acuity, waitlistPriority"
              />
              {lockedKind && (
                <p className="mt-1 text-[11px] text-slate-400">Kind is locked to "{lockedKind}" for this tool.</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Scope</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={draft.scope}
                onChange={(e) => { const v = e.currentTarget.value as "customer" | "enrollment"; setDraft((prev) => ({ ...prev, scope: v })); }}
              >
                <option value="enrollment">Enrollment</option>
                <option value="customer">Customer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                rows={2}
                value={draft.description || ""}
                onChange={(e) => { const v = e.currentTarget.value; setDraft((prev) => ({ ...prev, description: v })); }}
                placeholder="Brief description of this assessment's purpose…"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Version label</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={draft.schema.rubric.version}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setDraft((prev) => ({
                    ...prev,
                    schema: { ...prev.schema, rubric: { ...prev.schema.rubric, version: v } },
                  }));
                }}
                placeholder="v1"
              />
            </div>
          </section>

          <div className="border-t border-slate-100" />

          {/* Grant link */}
          <section>
            <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Grant / Program Link</span>
              <HelpDialogButton helpKey="grant_link" />
            </div>
            <GrantSelect value={grantId} onChange={setGrantId} includeUnassigned mode="all" groupByKind className="w-full" />
          </section>

          <div className="border-t border-slate-100" />

          {/* Permissions */}
          <section className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permissions</div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Edit policy</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={draft.editPolicy || "team"}
                onChange={(e) => {
                  const v = e.currentTarget.value as ToolTemplateDraft["editPolicy"];
                  setDraft((prev) => ({ ...prev, editPolicy: v }));
                }}
              >
                <option value="org">Anyone in org</option>
                <option value="team">Team members</option>
                <option value="ownerOrAdmin">Owner or admin</option>
                <option value="adminOnly">Admin only</option>
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={!!draft.locked}
                onChange={(e) => setDraft((prev) => ({ ...prev, locked: e.currentTarget.checked }))}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              <div>
                <div className="text-sm font-medium text-slate-700">Lock template</div>
                <div className="text-xs text-slate-500">Prevent non-admin edits after publish</div>
              </div>
            </label>
          </section>

          <div className="border-t border-slate-100" />

          {/* Calculation fields */}
          <section className="space-y-3">
            <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Calculation Fields</span>
              <HelpDialogButton helpKey="calculation_fields" />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Rank strategy</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={calc.rankStrategy}
                onChange={(e) => {
                  const next = e.currentTarget.value as ToolTemplateDraft["calculation"]["rankStrategy"];
                  setDraft((prev) => ({ ...prev, calculation: { ...prev.calculation, rankStrategy: next } }));
                }}
              >
                <option value="sum">sum</option>
                <option value="weightedSum">weightedSum</option>
                <option value="max">max</option>
                <option value="custom">custom</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">{RANK_STRATEGY_HELP[calc.rankStrategy]}</p>
            </div>

            {/* Formula guide */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 space-y-0.5">
              <div className="font-semibold text-slate-600 mb-1">Formula guide</div>
              <div><code>sum(points)</code> — total rubric score</div>
              <div><code>rank_desc(field)</code> — descending rank by field</div>
              <div><code>level_by_threshold(field)</code> — maps to configured level</div>
            </div>

            {/* Field rows */}
            <div className="space-y-3">
              {calc.fields.map((f, idx) => (
                <div key={`${f.key}_${idx}`} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      value={f.key}
                      placeholder="field id"
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setDraft((prev) => {
                          const fields = prev.calculation.fields.slice();
                          fields[idx] = { ...fields[idx], key: next };
                          return { ...prev, calculation: { ...prev.calculation, fields } };
                        });
                      }}
                    />
                    <input
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      value={f.label}
                      placeholder="display label"
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setDraft((prev) => {
                          const fields = prev.calculation.fields.slice();
                          fields[idx] = { ...fields[idx], label: next };
                          return { ...prev, calculation: { ...prev.calculation, fields } };
                        });
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      value={expressionOptions.some((o) => o.value === f.expression) ? f.expression : "__custom__"}
                      onChange={(e) => {
                        const selected = e.currentTarget.value;
                        setDraft((prev) => {
                          const fields = prev.calculation.fields.slice();
                          fields[idx] = {
                            ...fields[idx],
                            expression: selected === "__custom__" ? fields[idx].expression || "" : selected,
                          };
                          return { ...prev, calculation: { ...prev.calculation, fields } };
                        });
                      }}
                    >
                      {expressionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                      <option value="__custom__">Custom expression…</option>
                    </select>
                    <select
                      className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      value={f.format || "number"}
                      onChange={(e) => {
                        const next = e.currentTarget.value as CalcField["format"];
                        setDraft((prev) => {
                          const fields = prev.calculation.fields.slice();
                          fields[idx] = { ...fields[idx], format: next };
                          return { ...prev, calculation: { ...prev.calculation, fields } };
                        });
                      }}
                    >
                      <option value="number">number</option>
                      <option value="percent">%</option>
                      <option value="rank">rank</option>
                    </select>
                    <button
                      type="button"
                      title="Remove field"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          calculation: {
                            ...prev.calculation,
                            fields: prev.calculation.fields.filter((_, i) => i !== idx),
                          },
                        }))
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M9.5 3L6 6.5 2.5 3 2 3.5 5.5 7 2 10.5l.5.5L6 7.5 9.5 11l.5-.5L6.5 7 10 3.5z" />
                      </svg>
                    </button>
                  </div>
                  {!expressionOptions.some((o) => o.value === f.expression) && (
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      value={f.expression}
                      placeholder="custom formula"
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setDraft((prev) => {
                          const fields = prev.calculation.fields.slice();
                          fields[idx] = { ...fields[idx], expression: next };
                          return { ...prev, calculation: { ...prev.calculation, fields } };
                        });
                      }}
                    />
                  )}
                  <p className="text-[10px] text-slate-400">{explainExpression(f.expression)}</p>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    calculation: {
                      ...prev.calculation,
                      fields: [...prev.calculation.fields, { key: "", label: "", expression: "", format: "number" }],
                    },
                  }))
                }
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M4.5 0h1v4.5H10v1H5.5V10h-1V5.5H0v-1h4.5z" />
                </svg>
                Add field
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface AssessmentBuilderToolProps {
  lockedKind?: string;
}

export default function AssessmentBuilderTool({ lockedKind }: AssessmentBuilderToolProps = {}) {
  const [draft, setDraft] = useState<ToolTemplateDraft>(() => ({
    ...DEFAULT_DRAFT(),
    ...(lockedKind ? { kind: lockedKind } : {}),
  }));
  const [grantId, setGrantId] = useState<string | null>(null);
  const [selectedExistingId, setSelectedExistingId] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const upsert = useAssessmentTemplatesUpsert();
  const templatesQ = useAssessmentTemplates({ includeLocked: true }, { staleTime: 15_000 });
  const templates = (templatesQ.data || []) as Array<Record<string, unknown>>;

  const loadPreset = (type: "referral" | "acuity" | "blank") => {
    const base = type === "referral" ? REFERRAL_PRESET() : type === "acuity" ? ACUITY_PRESET() : DEFAULT_DRAFT();
    setDraft(lockedKind ? { ...base, kind: lockedKind } : base);
    setSelectedExistingId("");
  };

  const loadExisting = (id: string) => {
    setSelectedExistingId(id);
    const row = templates.find((t) => String(t.id) === id);
    if (!row) return;
    setDraft({
      ...DEFAULT_DRAFT(),
      id: String(row.id || ""),
      title: String(row.title || ""),
      description: String(row.description || ""),
      kind: lockedKind ?? String(row.kind || "custom"),
      scope: String(row.scope || "enrollment") as "customer" | "enrollment",
      version: Number(row.version || 1),
      locked: !!row.locked,
      editPolicy: String(row.editPolicy || "team") as ToolTemplateDraft["editPolicy"],
      schema:
        (row.schema as { type?: unknown } | undefined)?.type === "rubric"
          ? (row.schema as ToolTemplateDraft["schema"])
          : DEFAULT_DRAFT().schema,
      taskDefs: Array.isArray(row.taskDefs) ? (row.taskDefs as TaskTemplateDraft[]) : [],
      calculation:
        row.calculation && typeof row.calculation === "object"
          ? (row.calculation as ToolTemplateDraft["calculation"])
          : DEFAULT_DRAFT().calculation,
    });
    setGrantId(String(row.grantId || "") || null);
  };

  const saveTemplate = async () => {
    if (!draft.title.trim()) {
      toast("Template title is required.", { type: "error" });
      return;
    }
    if (!draft.schema.rubric.questions.length) {
      toast("Add at least one question.", { type: "error" });
      return;
    }
    try {
      const body = {
        ...(draft.id ? { id: draft.id } : {}),
        title: draft.title,
        description: draft.description || null,
        kind: draft.kind,
        scope: draft.scope,
        version: Number(draft.version || 1),
        locked: !!draft.locked,
        editPolicy: draft.editPolicy || "team",
        grantId: grantId || null,
        schema: draft.schema,
        taskDefs: draft.taskDefs,
        calculation: draft.calculation,
      };
      const resp = await upsert.mutateAsync(body as never);
      const ids = (resp as { ids?: unknown } | null)?.ids;
      const id = Array.isArray(ids) ? String(ids[0] || "") : "";
      if (id) {
        setDraft((prev) => ({ ...prev, id }));
        setSelectedExistingId(id);
      }
      toast("Template saved.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const calc = draft.calculation;

  const expressionOptions = React.useMemo(() => {
    const keys = Array.from(
      new Set(calc.fields.map((f) => String(f.key || "").trim()).filter(Boolean)),
    );
    const out: Array<{ value: string; label: string }> = [
      { value: "sum(points)", label: "Total score (sum of points)" },
    ];
    for (const key of keys) {
      out.push({ value: `rank_desc(${key})`, label: `Descending rank by ${key}` });
      out.push({ value: `level_by_threshold(${key})`, label: `Level by threshold for ${key}` });
    }
    return out;
  }, [calc.fields]);

  const explainExpression = (expr: string): string => {
    const v = String(expr || "").trim();
    if (!v) return "Enter a formula.";
    if (v === "sum(points)") return "Adds points from all selected rubric answers.";
    if (/^rank_desc\((.+)\)$/.test(v)) {
      const inner = v.match(/^rank_desc\((.+)\)$/)?.[1] || "field";
      return `Ranks records highest-to-lowest by ${inner}. Rank 1 = highest value.`;
    }
    if (/^level_by_threshold\((.+)\)$/.test(v)) {
      const inner = v.match(/^level_by_threshold\((.+)\)$/)?.[1] || "score";
      return `Maps ${inner} to a configured level range (Low / Medium / High).`;
    }
    return "Custom formula. Confirm this expression is supported by your backend evaluator.";
  };

  return (
    <div className="space-y-0">
      {/* ── Header ── */}
      <div className="tool-surface mb-4">
        <div className="mb-1 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
          Tools / Assessments
        </div>
        <div className="flex items-center gap-3">
          {/* Editable title */}
          <input
            className="flex-1 border-0 bg-transparent text-xl font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            value={draft.title}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setDraft((prev) => ({
                ...prev,
                title: v,
                schema: { ...prev.schema, rubric: { ...prev.schema.rubric, title: v } },
              }));
            }}
            placeholder="Untitled Assessment"
          />

          <div className="flex items-center gap-2 shrink-0">
            <HelpDialogButton helpKey="assessment_builder" />

            {/* Save */}
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              onClick={saveTemplate}
              disabled={upsert.isPending}
            >
              {upsert.isPending ? "Saving…" : "Save"}
            </button>

            {/* 3-dot settings */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Template settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="8" cy="13" r="1.4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Question builder ── */}
      <div className="tool-surface">
        <AssessmentBuilder
          editing
          value={draft}
          onChange={(next) => setDraft((prev) => ({ ...prev, ...next }))}
        />
      </div>

      {/* ── Linked tasks ── */}
      <div className="tool-surface-muted mt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="2" y="2" width="11" height="11" rx="2" />
            <path d="M5 7.5h5M5 5h5M5 10h3" strokeLinecap="round" />
          </svg>
          <span>Linked Tasks</span>
          <HelpDialogButton helpKey="linked_tasks" />
        </div>
        <TaskBuilder
          editing
          value={draft.taskDefs}
          onChange={(next) => setDraft((prev) => ({ ...prev, taskDefs: next }))}
        />
      </div>

      {/* ── Settings drawer ── */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        draft={draft}
        setDraft={setDraft}
        grantId={grantId}
        setGrantId={setGrantId}
        templates={templates}
        selectedExistingId={selectedExistingId}
        loadPreset={loadPreset}
        loadExisting={loadExisting}
        expressionOptions={expressionOptions}
        explainExpression={explainExpression}
        lockedKind={lockedKind}
      />
    </div>
  );
}
