"use client";

import React from "react";
import { toApiError } from "@client/api";
import { AssessmentInput } from "@entities/assessments/AssessmentInput";
import type { AssessmentTemplateDraft } from "@entities/assessments/AssessmentBuilder";
import { DEFAULT_ACUITY_TEMPLATE } from "@entities/assessments/defaultAcuityTemplate";
import AssessmentSelect from "@entities/selectors/AssessmentSelect";
import { useAssessmentSubmissions, useAssessmentTemplate, useAssessmentTemplates } from "@hooks/useAssessments";
import { useCustomerEnrollments } from "@hooks/useEnrollments";
import { useTasksGenerateScheduleWrite } from "@hooks/useTasks";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { toast } from "@lib/toast";
import type { ReqOf } from "@hdb/contracts";

type EnrollmentLite = {
  id: string;
  grantId?: string | null;
  grantName?: string | null;
  status?: string | null;
};

type TemplateDoc = {
  id?: string;
  title?: string;
  kind?: string;
  scope?: string;
  schema?: AssessmentTemplateDraft["schema"];
  taskDefs?: unknown;
};

type SubmissionLite = {
  id?: string;
  templateId?: string;
  kind?: string;
  computed?: {
    score?: number | null;
    level?: string | null;
  } | null;
};

function asTaskDefs(raw: unknown): NonNullable<ReqOf<"tasksGenerateScheduleWrite">["taskDefs"]> {
  return Array.isArray(raw) ? (raw as NonNullable<ReqOf<"tasksGenerateScheduleWrite">["taskDefs"]>) : [];
}

export function AcuityTab({ customerId }: { customerId: string }) {
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useCustomerEnrollments(customerId);
  const taskGenerate = useTasksGenerateScheduleWrite();

  const [selectedEnrollmentId, setSelectedEnrollmentId] = React.useState<string>("");
  const [selectedAcuityTemplateId, setSelectedAcuityTemplateId] = React.useState<string>("");

  const enrollmentRows = React.useMemo(
    () => (enrollments as EnrollmentLite[]).filter((e) => String(e.status || "").toLowerCase() !== "deleted"),
    [enrollments],
  );
  const selectedEnrollment =
    enrollmentRows.find((row) => String(row.id || "") === selectedEnrollmentId) || null;
  const selectedEnrollmentLabel = selectedEnrollment ? formatEnrollmentLabel(selectedEnrollment) : null;

  React.useEffect(() => {
    if (!enrollmentRows.length) {
      setSelectedEnrollmentId("");
      return;
    }
    setSelectedEnrollmentId((prev) => {
      if (prev && enrollmentRows.some((row) => String(row.id || "") === prev)) return prev;
      return String(enrollmentRows[0]?.id || "");
    });
  }, [enrollmentRows]);

  const acuityTemplatesQ = useAssessmentTemplates(
    {
      kind: "acuity",
      scope: "customer",
      includeLocked: true,
    },
    { enabled: true, staleTime: 15_000 },
  );

  React.useEffect(() => {
    const list = (acuityTemplatesQ.data || []) as Array<Record<string, unknown>>;
    const firstId = String(list[0]?.id || "");
    setSelectedAcuityTemplateId((prev) => {
      if (!prev) return firstId;
      const exists = list.some((row) => String(row.id || "") === prev);
      return exists ? prev : firstId;
    });
  }, [acuityTemplatesQ.data]);

  const acuityTemplateQ = useAssessmentTemplate(selectedAcuityTemplateId || undefined, {
    enabled: !!selectedAcuityTemplateId,
  });

  const acuityHasNoTemplates =
    !acuityTemplatesQ.isLoading && (acuityTemplatesQ.data || []).length === 0;
  const acuityTemplate = acuityHasNoTemplates
    ? DEFAULT_ACUITY_TEMPLATE
    : ((acuityTemplateQ.data as TemplateDoc | null) ?? null);

  const acuitySubmissionsQ = useAssessmentSubmissions(
    customerId ? { customerId, limit: 20 } : { limit: 20 },
    { enabled: !!customerId, staleTime: 10_000 },
  );

  const maybeGenerateTasks = async (template: TemplateDoc | null, enrollmentId: string | null) => {
    if (!template || !enrollmentId) return;
    const defs = asTaskDefs(template.taskDefs);
    if (!defs.length) return;
    const body: ReqOf<"tasksGenerateScheduleWrite"> = {
      enrollmentId,
      taskDefs: defs,
      mode: "mergeManaged",
      keepManual: true,
      preserveCompletedManaged: true,
      pinCompletedManaged: true,
    };
    await taskGenerate.mutateAsync(body);
    toast("Template-linked tasks generated.", { type: "success" });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-sm font-medium text-slate-900">Acuity Assessment</div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-sm">
          <div className="text-xs text-slate-600">Linked Enrollment</div>
          <select
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
            value={selectedEnrollmentId}
            onChange={(e) => setSelectedEnrollmentId(e.currentTarget.value)}
            disabled={enrollmentsLoading || !enrollmentRows.length}
          >
            {!enrollmentRows.length ? <option value="">No enrollment available</option> : null}
            {enrollmentRows.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {formatEnrollmentLabel(row)}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-slate-500">
            Used only if this acuity template generates linked tasks.
          </div>
        </label>

        {acuityHasNoTemplates ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Using default acuity rubric - create a custom template in the Assessment Builder to override.
          </div>
        ) : (
          <label className="text-sm">
            <div className="text-xs text-slate-600">Acuity Template</div>
            <AssessmentSelect
              className="mt-1 w-full"
              value={selectedAcuityTemplateId || null}
              onChange={(id) => setSelectedAcuityTemplateId(String(id || ""))}
              includeUnassigned
              placeholderLabel="-- Select acuity template --"
              filters={{ kind: "acuity", scope: "customer", includeLocked: true }}
            />
          </label>
        )}
      </div>

      <div className="mt-3">
        <AssessmentInput
          template={acuityTemplate}
          customerId={customerId}
          enrollmentLabel={selectedEnrollmentLabel}
          title="Fill Out Acuity Assessment"
          onSubmitted={async () => {
            try {
              await maybeGenerateTasks(
                (acuityTemplateQ.data as TemplateDoc | null) || null,
                selectedEnrollmentId || null,
              );
            } catch (e: unknown) {
              toast(toApiError(e).error, { type: "error" });
            }
          }}
        />
      </div>

      <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-medium text-slate-700">Recent Acuity Submissions</div>
        {(acuitySubmissionsQ.data || []).length === 0 ? (
          <div className="mt-1 text-xs text-slate-600">No submissions yet.</div>
        ) : (
          <div className="mt-2 space-y-1">
            {(acuitySubmissionsQ.data as SubmissionLite[])
              .filter((s) => {
                const templateId = String(s.templateId || "");
                if (!selectedAcuityTemplateId) {
                  return acuityHasNoTemplates ? templateId === DEFAULT_ACUITY_TEMPLATE.id : true;
                }
                return (
                  templateId === selectedAcuityTemplateId ||
                  (acuityHasNoTemplates && templateId === DEFAULT_ACUITY_TEMPLATE.id)
                );
              })
              .map((s) => (
                <div key={String(s.id)} className="text-xs text-slate-700">
                  {String(s.kind || "acuity")} | score: {String(s.computed?.score ?? "-")} | level: {String(s.computed?.level ?? "-")}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AcuityTab;
