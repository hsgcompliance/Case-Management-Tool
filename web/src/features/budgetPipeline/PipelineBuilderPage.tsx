"use client";
// web/src/features/budgetPipeline/PipelineBuilderPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGrants } from "@hooks/useGrants";
import { useJotformForms } from "@hooks/useJotform";
import { usePipelineUpsert, usePipelinePreview, usePipeline } from "@hooks/useBudgetPipeline";
import { toast } from "@lib/toast";
import type {
  TBudgetPipeline,
  TPipelineConditionGroup,
  TPipelineCondition,
  TPipelineStatus,
  TBudgetPipelinePreviewResult,
} from "@types";
import { defaultOperatorForField, NORMALIZED_FIELDS } from "./fieldDefs";
import { ConditionGroupBox } from "./components/ConditionGroupBox";
import { FieldSidebar } from "./components/FieldSidebar";
import { PreviewTable } from "./components/PreviewTable";

// ─── Local state shape ────────────────────────────────────────────────────────

type Draft = {
  id: string | null;
  name: string;
  status: TPipelineStatus;
  grantId: string | null;
  lineItemId: string | null;
  sourceFormId: string | null;
  sourceFormTitle: string | null;
  includeGroups: TPipelineConditionGroup[];
  excludeGroups: TPipelineConditionGroup[];
};

const EMPTY_DRAFT: Draft = {
  id: null,
  name: "New Pipeline",
  status: "draft",
  grantId: null,
  lineItemId: null,
  sourceFormId: null,
  sourceFormTitle: null,
  includeGroups: [],
  excludeGroups: [],
};

function pipelineToDraft(p: TBudgetPipeline): Draft {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    grantId: p.grantId,
    lineItemId: p.lineItemId,
    sourceFormId: p.sourceFormId,
    sourceFormTitle: p.sourceFormTitle,
    includeGroups: p.includeGroups,
    excludeGroups: p.excludeGroups,
  };
}

function newGroup(kind: "include" | "exclude", logic: "AND" | "OR"): TPipelineConditionGroup {
  return { id: crypto.randomUUID(), logic, kind, conditions: [] };
}

function newCondition(field: string): TPipelineCondition {
  return { id: crypto.randomUUID(), field, operator: defaultOperatorForField(field), value: "" };
}

// ─── Sticky target bar ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TPipelineStatus }) {
  const colors: Record<TPipelineStatus, string> = {
    draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  pipelineId?: string | null;
  onBack?: () => void;          // provided when embedded in a tool panel
  onSaved?: (id: string) => void; // called after save instead of router.push
};

export function PipelineBuilderPage({ pipelineId, onBack, onSaved }: Props) {
  const router = useRouter();
  const isNew = !pipelineId || pipelineId === "new";
  const isEmbedded = !!onBack;

  const { data: existingPipeline, isLoading: isLoadingPipeline } = usePipeline(
    isNew ? null : pipelineId ?? null,
  );
  const { data: grantsData = [] } = useGrants({ active: true, limit: 200 });
  const { data: rawForms = [] } = useJotformForms();
  const forms = rawForms as Array<{ id: string; title: string }>;

  const upsert = usePipelineUpsert();
  const preview = usePipelinePreview();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [previewResult, setPreviewResult] = useState<TBudgetPipelinePreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing pipeline into draft
  useEffect(() => {
    if (existingPipeline) setDraft(pipelineToDraft(existingPipeline));
  }, [existingPipeline]);

  // Derived: selected grant's line items
  const selectedGrant = useMemo(
    () => (grantsData as any[]).find((g: any) => g.id === draft.grantId) ?? null,
    [grantsData, draft.grantId],
  );
  const lineItems: Array<{ id: string; label: string }> = useMemo(
    () => selectedGrant?.budget?.lineItems ?? [],
    [selectedGrant],
  );

  // ─── Sidebar action handler ─────────────────────────────────────────────────

  const handleSidebarAction = useCallback((action: string) => {
    setDraft((d) => {
      switch (action) {
        case "add_condition": {
          const field = NORMALIZED_FIELDS[0].key;
          const cond = newCondition(field);
          if (d.includeGroups.length === 0) {
            return { ...d, includeGroups: [{ ...newGroup("include", "AND"), conditions: [cond] }] };
          }
          const groups = [...d.includeGroups];
          const last = { ...groups[groups.length - 1], conditions: [...groups[groups.length - 1].conditions, cond] };
          groups[groups.length - 1] = last;
          return { ...d, includeGroups: groups };
        }
        case "add_and_group":
          return { ...d, includeGroups: [...d.includeGroups, newGroup("include", "AND")] };
        case "add_or_group":
          return { ...d, includeGroups: [...d.includeGroups, newGroup("include", "OR")] };
        case "add_exclusion":
          return { ...d, excludeGroups: [...d.excludeGroups, newGroup("exclude", "AND")] };
        case "add_amount_condition": {
          const cond = newCondition("amount");
          if (d.includeGroups.length === 0) {
            return { ...d, includeGroups: [{ ...newGroup("include", "AND"), conditions: [cond] }] };
          }
          const groups = [...d.includeGroups];
          const last = { ...groups[groups.length - 1], conditions: [...groups[groups.length - 1].conditions, cond] };
          groups[groups.length - 1] = last;
          return { ...d, includeGroups: groups };
        }
        case "add_date_condition": {
          const cond = newCondition("month");
          if (d.includeGroups.length === 0) {
            return { ...d, includeGroups: [{ ...newGroup("include", "AND"), conditions: [cond] }] };
          }
          const groups = [...d.includeGroups];
          const last = { ...groups[groups.length - 1], conditions: [...groups[groups.length - 1].conditions, cond] };
          groups[groups.length - 1] = last;
          return { ...d, includeGroups: groups };
        }
        default:
          return d;
      }
    });
  }, []);

  const handleAddField = useCallback((fieldKey: string) => {
    setDraft((d) => {
      const cond = newCondition(fieldKey);
      if (d.includeGroups.length === 0) {
        return { ...d, includeGroups: [{ ...newGroup("include", "AND"), conditions: [cond] }] };
      }
      const groups = [...d.includeGroups];
      const last = { ...groups[groups.length - 1], conditions: [...groups[groups.length - 1].conditions, cond] };
      groups[groups.length - 1] = last;
      return { ...d, includeGroups: groups };
    });
  }, []);

  // ─── Group CRUD ─────────────────────────────────────────────────────────────

  const updateIncludeGroup = useCallback((groupId: string, updated: TPipelineConditionGroup) => {
    setDraft((d) => ({
      ...d,
      includeGroups: d.includeGroups.map((g) => (g.id === groupId ? updated : g)),
    }));
  }, []);

  const removeIncludeGroup = useCallback((groupId: string) => {
    setDraft((d) => ({ ...d, includeGroups: d.includeGroups.filter((g) => g.id !== groupId) }));
  }, []);

  const updateExcludeGroup = useCallback((groupId: string, updated: TPipelineConditionGroup) => {
    setDraft((d) => ({
      ...d,
      excludeGroups: d.excludeGroups.map((g) => (g.id === groupId ? updated : g)),
    }));
  }, []);

  const removeExcludeGroup = useCallback((groupId: string) => {
    setDraft((d) => ({ ...d, excludeGroups: d.excludeGroups.filter((g) => g.id !== groupId) }));
  }, []);

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function handleSave(statusOverride?: TPipelineStatus) {
    setIsSaving(true);
    try {
      const result = await upsert.mutateAsync({
        id: draft.id ?? undefined,
        name: draft.name || "Unnamed Pipeline",
        status: statusOverride ?? draft.status,
        grantId: draft.grantId,
        lineItemId: draft.lineItemId,
        sourceFormId: draft.sourceFormId,
        sourceFormTitle: draft.sourceFormTitle,
        includeGroups: draft.includeGroups,
        excludeGroups: draft.excludeGroups,
      });
      const newId = (result as any)?.id as string | undefined;
      if (newId) {
        setDraft((d) => ({ ...d, id: newId, status: statusOverride ?? d.status }));
        if (onSaved) onSaved(newId);
        else if (isNew) router.push(`/budget/pipeline/${newId}`);
      }
      toast(statusOverride === "active" ? "Pipeline activated." : "Pipeline saved.", { type: "success" });
    } catch {
      toast("Failed to save pipeline.", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleActivate() {
    await handleSave("active");
  }

  async function handleDeactivate() {
    await handleSave("inactive");
  }

  // ─── Preview ────────────────────────────────────────────────────────────────

  async function handlePreview() {
    setIsPreviewLoading(true);
    try {
      const result = await preview.mutateAsync({
        grantId: draft.grantId,
        lineItemId: draft.lineItemId,
        sourceFormId: draft.sourceFormId,
        includeGroups: draft.includeGroups,
        excludeGroups: draft.excludeGroups,
        pipelineId: draft.id ?? undefined,
      });
      setPreviewResult(result as unknown as TBudgetPipelinePreviewResult);
    } catch {
      toast("Preview failed. Check your rule syntax.", { type: "error" });
    } finally {
      setIsPreviewLoading(false);
    }
  }

  if (!isNew && isLoadingPipeline) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400 dark:text-slate-500">
        Loading pipeline…
      </div>
    );
  }

  const inputCls =
    "text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500";
  const selectCls = inputCls;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Sticky target bar ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        {/* Back button — only in embedded tool mode */}
        {isEmbedded && (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mr-1 shrink-0"
          >
            ← Pipelines
          </button>
        )}
        {/* Grant selector */}
        <div className="flex items-center gap-1.5 min-w-0">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Grant</label>
          <select
            className={`${selectCls} max-w-[180px]`}
            value={draft.grantId ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, grantId: e.target.value || null, lineItemId: null }))
            }
          >
            <option value="">— any grant —</option>
            {(grantsData as any[]).map((g: any) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Line item selector */}
        <div className="flex items-center gap-1.5 min-w-0">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Line Item</label>
          <select
            className={`${selectCls} max-w-[160px]`}
            value={draft.lineItemId ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, lineItemId: e.target.value || null }))}
            disabled={!draft.grantId}
          >
            <option value="">— any line item —</option>
            {lineItems.map((li) => (
              <option key={li.id} value={li.id}>
                {li.label}
              </option>
            ))}
          </select>
        </div>

        {/* Pipe name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Name</label>
          <input
            type="text"
            className={`${inputCls} min-w-[160px] flex-1`}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Pipeline name"
          />
        </div>

        {/* Status badge */}
        <StatusBadge status={draft.status} />

        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handlePreview}
            disabled={isPreviewLoading || isSaving}
          >
            Preview
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => handleSave()}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          {draft.status !== "active" ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleActivate}
              disabled={isSaving}
            >
              Activate
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-ghost text-slate-500"
              onClick={handleDeactivate}
              disabled={isSaving}
            >
              Deactivate
            </button>
          )}
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <FieldSidebar onAction={handleSidebarAction} onAddField={handleAddField} />

        {/* Main panel */}
        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Source Form selector */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Source Form</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Restrict this pipeline to a specific Jotform. Leave blank to match all forms.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="sourceForm"
                  value=""
                  checked={!draft.sourceFormId}
                  onChange={() => setDraft((d) => ({ ...d, sourceFormId: null, sourceFormTitle: null }))}
                  className="accent-sky-500"
                />
                <span className="text-slate-700 dark:text-slate-300">All forms</span>
              </label>
              {forms.map((form) => (
                <label key={form.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="sourceForm"
                    value={form.id}
                    checked={draft.sourceFormId === form.id}
                    onChange={() =>
                      setDraft((d) => ({ ...d, sourceFormId: form.id, sourceFormTitle: form.title }))
                    }
                    className="accent-sky-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{form.title}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{form.id}</span>
                </label>
              ))}
              {forms.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                  No Jotform forms loaded. Sync forms from the Budget page first.
                </p>
              )}
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Include rules */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Include Rules</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Transactions must match at least one group below. Empty = match all.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() =>
                  setDraft((d) => ({ ...d, includeGroups: [...d.includeGroups, newGroup("include", "AND")] }))
                }
              >
                + Add group
              </button>
            </div>

            {draft.includeGroups.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No include rules — this pipeline will match all pending transactions from the selected form.
              </div>
            )}
            <div className="space-y-3">
              {draft.includeGroups.map((group) => (
                <ConditionGroupBox
                  key={group.id}
                  group={group}
                  isExclude={false}
                  onChange={(updated) => updateIncludeGroup(group.id, updated)}
                  onRemove={() => removeIncludeGroup(group.id)}
                />
              ))}
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Exclude rules */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Exclude Rules</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Transactions matching any group below are excluded even if they passed include rules.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() =>
                  setDraft((d) => ({ ...d, excludeGroups: [...d.excludeGroups, newGroup("exclude", "AND")] }))
                }
              >
                + Add exclusion
              </button>
            </div>

            {draft.excludeGroups.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No exclusion rules.
              </div>
            )}
            <div className="space-y-3">
              {draft.excludeGroups.map((group) => (
                <ConditionGroupBox
                  key={group.id}
                  group={group}
                  isExclude={true}
                  onChange={(updated) => updateExcludeGroup(group.id, updated)}
                  onRemove={() => removeExcludeGroup(group.id)}
                />
              ))}
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Preview table */}
          <PreviewTable
            result={previewResult}
            isLoading={isPreviewLoading}
            onRun={handlePreview}
          />
        </main>
      </div>
    </div>
  );
}

export default PipelineBuilderPage;
