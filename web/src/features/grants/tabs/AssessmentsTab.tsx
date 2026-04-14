"use client";

import React from "react";
import type { TGrant as Grant } from "@types";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import {
  useAssessmentTemplate,
  useAssessmentTemplatesUpsert,
  useAssessmentTemplateDelete,
  useAssessmentTemplateRecalc,
} from "@hooks/useAssessments";
import {
  AssessmentBuilder,
  type AssessmentTemplateDraft,
} from "@entities/assessments/AssessmentBuilder";
import AssessmentSelect from "@entities/selectors/AssessmentSelect";

const DEFAULT_TEMPLATE = (grantId?: string | null): AssessmentTemplateDraft => ({
  title: "",
  kind: "custom",
  scope: "enrollment",
  description: "",
  locked: false,
  editPolicy: "team",
  version: 1,
  schema: {
    type: "rubric",
    rubric: {
      title: "",
      version: "v1",
      questions: [],
      levels: [{ min: 0, label: "Default" }],
    },
  },
  ...(grantId ? { id: undefined } : {}),
});

export function AssessmentsTab({
  editing,
  model,
  setModel,
  grant,
  affected = [],
}: {
  editing: boolean;
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  grant: Grant | null;
  affected?: ReadonlyArray<{
    clientName: string;
    startDate: string | null;
    enrollmentId: string;
    enrollmentName?: string | null;
    name?: string | null;
  }>;
}) {
  const grantId = String(grant?.id || "");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");
  const [draft, setDraft] = React.useState<AssessmentTemplateDraft>(DEFAULT_TEMPLATE(grantId));

  const templateQ = useAssessmentTemplate(selectedTemplateId || undefined, { enabled: !!selectedTemplateId });

  const upsert = useAssessmentTemplatesUpsert();
  const del = useAssessmentTemplateDelete();
  const recalc = useAssessmentTemplateRecalc();

  React.useEffect(() => {
    if (!templateQ.data) return;
    const t = templateQ.data as Record<string, any>;
    const schema = t.schema?.type === "rubric" ? t.schema : DEFAULT_TEMPLATE(grantId).schema;
    setDraft({
      id: String(t.id || selectedTemplateId || ""),
      title: String(t.title || ""),
      description: String(t.description || ""),
      kind: String(t.kind || "custom"),
      scope: String(t.scope || "enrollment") as "customer" | "enrollment",
      locked: !!t.locked,
      editPolicy: String(t.editPolicy || "team") as "adminOnly" | "ownerOrAdmin" | "team" | "org",
      version: Number(t.version || 1),
      schema,
    });
  }, [templateQ.data, grantId, selectedTemplateId]);

  const saveTemplate = async () => {
    if (!draft.title.trim()) {
      toast("Template title is required.", { type: "error" });
      return;
    }
    if (!draft.schema.rubric.questions.length) {
      toast("At least one question is required.", { type: "error" });
      return;
    }
    if (!draft.schema.rubric.levels.length) {
      toast("At least one level is required.", { type: "error" });
      return;
    }
    try {
      const body = {
        ...(draft.id ? { id: draft.id } : {}),
        grantId: grantId || null,
        title: draft.title,
        description: draft.description || null,
        kind: draft.kind || "custom",
        scope: draft.scope,
        version: Number(draft.version || 1),
        locked: !!draft.locked,
        editPolicy: draft.editPolicy || "team",
        schema: draft.schema,
      };
      const resp = await upsert.mutateAsync(body as any);
      const id = Array.isArray((resp as any)?.ids) ? String((resp as any).ids[0] || "") : "";
      if (id) setSelectedTemplateId(id);
      toast("Assessment template saved.", { type: "success" });
      setModel((prev) => ({ ...prev }));
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const removeTemplate = async () => {
    const id = String(selectedTemplateId || draft.id || "");
    if (!id) return;
    if (!window.confirm("Delete this assessment template?")) return;
    try {
      await del.mutateAsync({ templateId: id });
      setSelectedTemplateId("");
      setDraft(DEFAULT_TEMPLATE(grantId));
      toast("Template deleted.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const runRecalc = async () => {
    const id = String(selectedTemplateId || draft.id || "");
    if (!id) return;
    try {
      await recalc.mutateAsync({ templateId: id, activeOnly: true } as any);
      toast("Recompute started.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Description banner */}
      {!editing && (
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">About Assessments</div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Assessment templates define the structured intake, acuity, and compliance forms used for clients in this program.
            Templates are linked to this grant and appear on each enrollment for case managers to complete.
            Rubric-based assessments calculate an acuity score that rolls up to case manager dashboards and workload metrics.
            Changes to templates do not automatically update past submissions — use <strong>Recompute Scores</strong> for that.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex-1 min-w-[220px] text-sm">
          <div className="text-xs text-slate-600">Template</div>
          <AssessmentSelect
            className="mt-1 w-full"
            value={selectedTemplateId || null}
            onChange={(id) => setSelectedTemplateId(id || "")}
            includeUnassigned
            placeholderLabel="-- New template --"
            filters={{ includeLocked: true, grantId: grantId || undefined }}
          />
        </label>

        <button
          type="button"
          className="btn-secondary btn-sm text-xs"
          onClick={() => {
            setSelectedTemplateId("");
            setDraft(DEFAULT_TEMPLATE(grantId));
          }}
        >
          Reset
        </button>
      </div>

      <AssessmentBuilder editing={editing} value={draft} onChange={setDraft} />

      {editing && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm border-red-300 text-xs text-red-700 dark:border-red-900/60 dark:text-red-300"
            onClick={removeTemplate}
            disabled={!selectedTemplateId || del.isPending}
          >
            Delete Template
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm text-xs"
            onClick={runRecalc}
            disabled={!selectedTemplateId || recalc.isPending}
          >
            Recompute Scores
          </button>
          <button
            type="button"
            className="btn btn-sm text-xs"
            onClick={saveTemplate}
            disabled={upsert.isPending}
          >
            {upsert.isPending ? "Saving..." : "Save Template"}
          </button>
        </div>
      )}

      <div className="card p-3">
        <div className="text-sm font-medium text-slate-800">Grant Assessment Templates</div>
        <div className="mt-2 text-sm text-slate-600">
          Build and maintain grant/program-specific assessment templates here. Customer enrollment tabs are where staff complete assessments and trigger linked task schedules.
        </div>
        {affected.length > 0 ? (
          <div className="mt-2 text-xs text-slate-500">
            This grant currently has {affected.length} enrollment{affected.length === 1 ? "" : "s"}. Use <b>Recompute Scores</b> after rubric changes if needed.
          </div>
        ) : null}
      </div>
    </div>
  );
}
