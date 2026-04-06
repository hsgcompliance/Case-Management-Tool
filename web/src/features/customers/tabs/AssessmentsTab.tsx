"use client";

import React from "react";
import { toApiError } from "@client/api";
import { AssessmentInput } from "@entities/assessments/AssessmentInput";
import type { AssessmentTemplateDraft } from "@entities/assessments/AssessmentBuilder";
import AssessmentSelect from "@entities/selectors/AssessmentSelect";
import { useAssessmentSubmissions, useAssessmentTemplate, useAssessmentTemplates } from "@hooks/useAssessments";
import { useCustomerEnrollments } from "@hooks/useEnrollments";
import { useTasksGenerateScheduleWrite } from "@hooks/useTasks";
import { toast } from "@lib/toast";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import type { ReqOf } from "@hdb/contracts";

type EnrollmentLite = {
  id: string;
  grantId?: string | null;
  grantName?: string | null;
  status?: string | null;
  active?: boolean | null;
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

function isEnrollmentClosed(row: EnrollmentLite): boolean {
  const status = String(row.status || "").toLowerCase();
  if (status === "closed" || status === "deleted") return true;
  if (typeof row.active === "boolean") return !row.active;
  return false;
}

export function AssessmentsTab({ customerId }: { customerId: string }) {
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useCustomerEnrollments(customerId);
  const taskGenerate = useTasksGenerateScheduleWrite();

  const [selectedEnrollmentId, setSelectedEnrollmentId] = React.useState<string>("");
  const [selectedEnrollmentTemplateId, setSelectedEnrollmentTemplateId] = React.useState<string>("");

  const enrollmentRows = React.useMemo(
    () => (enrollments as EnrollmentLite[]).filter((e) => String(e.status || "").toLowerCase() !== "deleted"),
    [enrollments],
  );
  const selectedEnrollment =
    enrollmentRows.find((e) => String(e.id || "") === selectedEnrollmentId) || null;
  const selectedEnrollmentLabel = selectedEnrollment ? formatEnrollmentLabel(selectedEnrollment) : null;
  const selectedGrantId = String(selectedEnrollment?.grantId || "");

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

  const enrollmentTemplatesQ = useAssessmentTemplates(
    {
      grantId: selectedGrantId || undefined,
      scope: "enrollment",
      includeLocked: true,
    },
    { enabled: !!selectedEnrollmentId, staleTime: 15_000 },
  );

  React.useEffect(() => {
    const list = (enrollmentTemplatesQ.data || []) as Array<Record<string, unknown>>;
    const firstId = String(list[0]?.id || "");
    setSelectedEnrollmentTemplateId((prev) => {
      if (!prev) return firstId;
      const exists = list.some((row) => String(row.id || "") === prev);
      return exists ? prev : firstId;
    });
  }, [enrollmentTemplatesQ.data]);

  const enrollmentTemplateQ = useAssessmentTemplate(selectedEnrollmentTemplateId || undefined, {
    enabled: !!selectedEnrollmentTemplateId,
  });

  const enrollmentSubmissionsQ = useAssessmentSubmissions(
    selectedEnrollmentId ? { enrollmentId: selectedEnrollmentId, limit: 20 } : { limit: 20 },
    { enabled: !!selectedEnrollmentId, staleTime: 10_000 },
  );

  const enrollmentReadOnly = !!selectedEnrollment && isEnrollmentClosed(selectedEnrollment);

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
      <div className="mb-2 text-sm font-medium text-slate-900">Enrollment Assessments</div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-sm">
          <div className="text-xs text-slate-600">Enrollment</div>
          <select
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
            value={selectedEnrollmentId}
            onChange={(e) => setSelectedEnrollmentId(e.currentTarget.value)}
            disabled={enrollmentsLoading || !enrollmentRows.length}
          >
            {enrollmentRows.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {formatEnrollmentLabel(row)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-xs text-slate-600">Template (from this grant)</div>
          <AssessmentSelect
            className="mt-1 w-full"
            value={selectedEnrollmentTemplateId || null}
            onChange={(id) => setSelectedEnrollmentTemplateId(String(id || ""))}
            includeUnassigned
            placeholderLabel={selectedGrantId ? "-- Select assessment --" : "-- Select enrollment first --"}
            filters={{ grantId: selectedGrantId || undefined, scope: "enrollment", includeLocked: true }}
            disabled={!selectedEnrollmentId}
          />
        </label>
      </div>
      {enrollmentReadOnly ? (
        <div className="mt-2 text-xs text-amber-700">
          Enrollment is closed. Assessment submission is read-only for this row.
        </div>
      ) : null}

      <div className="mt-3">
        <AssessmentInput
          template={(enrollmentTemplateQ.data as TemplateDoc | null) || null}
          enrollmentId={selectedEnrollmentId || null}
          enrollmentLabel={selectedEnrollmentLabel}
          customerId={customerId}
          title="Fill Out Assessment"
          readOnly={enrollmentReadOnly}
          onSubmitted={async () => {
            try {
              await maybeGenerateTasks(
                (enrollmentTemplateQ.data as TemplateDoc | null) || null,
                selectedEnrollmentId || null,
              );
            } catch (e: unknown) {
              toast(toApiError(e).error, { type: "error" });
            }
          }}
        />
      </div>

      <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-medium text-slate-700">Recent Enrollment Submissions</div>
        {(enrollmentSubmissionsQ.data || []).length === 0 ? (
          <div className="mt-1 text-xs text-slate-600">No submissions yet.</div>
        ) : (
          <div className="mt-2 space-y-1">
            {(enrollmentSubmissionsQ.data as SubmissionLite[]).map((s) => (
              <div key={String(s.id)} className="text-xs text-slate-700">
                {String(s.kind || "custom")} | score: {String(s.computed?.score ?? "-")} | level: {String(s.computed?.level ?? "-")}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssessmentsTab;
