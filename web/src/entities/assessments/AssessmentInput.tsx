"use client";

import React from "react";
import { useAssessmentSubmit } from "@hooks/useAssessments";
import type { AssessmentTemplateDraft } from "./AssessmentBuilder";
import { toApiError } from "@client/api";
import { toast } from "@lib/toast";
import type { ReqOf, RespOf } from "@hdb/contracts";

type TemplateLike = {
  id?: string;
  templateId?: string;
  scope?: "customer" | "enrollment" | string;
  schema?: AssessmentTemplateDraft["schema"];
};

type Props = {
  template: TemplateLike | null;
  enrollmentId?: string | null;
  enrollmentLabel?: string | null;
  customerId?: string | null;
  onSubmitted?: (result: unknown) => void;
  title?: string;
  readOnly?: boolean;
};

type ComputedPreview = { score: number; level: string | null };
type SubmitSummary = {
  submissionId: string | null;
  score: number | null;
  level: string | null;
};

function extractSummary(resp: unknown): SubmitSummary {
  const row = (resp || {}) as Record<string, unknown>;
  const computed = (row.computed || {}) as Record<string, unknown>;
  return {
    submissionId: typeof row.submissionId === "string" ? row.submissionId : null,
    score: typeof computed.score === "number" ? computed.score : null,
    level: typeof computed.level === "string" ? computed.level : null,
  };
}

const LEVEL_COLORS = [
  { bg: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-sky-500",     light: "bg-sky-100",     text: "text-sky-700"     },
  { bg: "bg-amber-400",   light: "bg-amber-100",   text: "text-amber-700"   },
  { bg: "bg-orange-500",  light: "bg-orange-100",  text: "text-orange-700"  },
  { bg: "bg-rose-500",    light: "bg-rose-100",    text: "text-rose-700"    },
];

export function AssessmentInput({
  template,
  enrollmentId,
  enrollmentLabel,
  customerId,
  onSubmitted,
  title = "Assessment",
  readOnly = false,
}: Props) {
  const submit = useAssessmentSubmit();
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [customerOverride, setCustomerOverride] = React.useState<string>(customerId || "");
  const [summary, setSummary] = React.useState<SubmitSummary | null>(null);

  React.useEffect(() => {
    setAnswers({});
    setSummary(null);
  }, [template?.id, template?.templateId]);

  const rubric = template?.schema?.type === "rubric" ? template.schema.rubric : null;
  const templateId = String(template?.id || template?.templateId || "");
  const scope = String(template?.scope || "enrollment");

  const questions = rubric?.questions || [];
  const answeredCount = questions.filter((q) => !!answers[q.id]).length;
  const progressPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const preview = React.useMemo<ComputedPreview | null>(() => {
    if (!rubric) return null;
    let score = 0;
    for (const q of rubric.questions || []) {
      const answer = answers[q.id];
      if (!answer) continue;
      const opt = (q.options || []).find((o) => String(o.value) === String(answer));
      if (opt) score += Number(opt.points || 0);
    }
    const levels = rubric.levels || [];
    const levelIdx = levels.findIndex((l) => {
      const min = Number(l.min || 0);
      const max = typeof l.max === "number" ? l.max : Number.POSITIVE_INFINITY;
      return score >= min && score <= max;
    });
    const level = levelIdx >= 0 ? levels[levelIdx].label : null;
    const color = levelIdx >= 0 ? LEVEL_COLORS[levelIdx % LEVEL_COLORS.length] : null;
    return { score, level, _levelIdx: levelIdx, _color: color } as ComputedPreview & { _levelIdx: number; _color: typeof color };
  }, [answers, rubric]);

  const canSubmit =
    !!templateId &&
    !!questions.length &&
    (scope === "enrollment" ? !!enrollmentId : !!(customerOverride || customerId)) &&
    !readOnly;

  const onSubmit = async () => {
    if (!canSubmit) {
      toast("Template and subject are required.", { type: "error" });
      return;
    }
    try {
      const body: ReqOf<"assessmentSubmit"> = {
        templateId,
        enrollmentId: scope === "enrollment" ? String(enrollmentId || "") : null,
        customerId: scope === "customer" ? String(customerOverride || customerId || "") : null,
        answers: Object.entries(answers)
          .filter(([, v]) => String(v || "").trim())
          .map(([qId, answer]) => ({ qId, answer })),
      };
      const resp = await submit.mutateAsync(body);
      setSummary(extractSummary(resp as RespOf<"assessmentSubmit">));
      onSubmitted?.(resp);
      toast("Assessment submitted.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  if (!templateId || !rubric) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        Select a template to begin the assessment.
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (summary) {
    const lvlIdx = (rubric.levels || []).findIndex((l) => l.label === summary.level);
    const col = lvlIdx >= 0 ? LEVEL_COLORS[lvlIdx % LEVEL_COLORS.length] : LEVEL_COLORS[0];
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl border ${col.light} border-current px-6 py-8 text-center`}>
          <div className={`text-4xl font-bold ${col.text}`}>{summary.score ?? "—"}</div>
          {summary.level && (
            <div className={`mt-1 text-sm font-semibold ${col.text}`}>{summary.level}</div>
          )}
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Assessment submitted</div>
          {summary.submissionId && (
            <div className="mt-1 font-mono text-[10px] text-slate-400">{summary.submissionId}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setAnswers({}); setSummary(null); }}
          className="w-full rounded-xl border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Start new response
        </button>
      </div>
    );
  }

  // ── Preview color ────────────────────────────────────────────────────────
  const previewExt = preview as (ComputedPreview & { _levelIdx: number; _color: (typeof LEVEL_COLORS)[number] | null }) | null;
  const previewColor = previewExt?._color;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</div>
          {scope === "enrollment" && (
            <div className="text-xs text-slate-500 mt-0.5">
              {enrollmentLabel || enrollmentId || "No enrollment selected"}
            </div>
          )}
        </div>
        {preview && (
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${previewColor?.text ?? "text-slate-700"}`}>
              {preview.score}
            </div>
            {preview.level && (
              <div className={`text-[11px] font-medium ${previewColor?.text ?? "text-slate-500"}`}>
                {preview.level}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>{answeredCount} of {questions.length} answered</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Customer ID override (customer-scoped only) */}
      {scope === "customer" && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Customer ID</label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={customerOverride}
            onChange={(e) => setCustomerOverride(e.currentTarget.value)}
            disabled={readOnly}
            placeholder="Enter customer ID…"
          />
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, i) => {
          const selected = answers[q.id];
          return (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-start gap-3 mb-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white dark:bg-indigo-500">
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.label}</p>
              </div>

              <div className="space-y-2 ml-9">
                {q.options.map((opt, oi) => {
                  const isSelected = String(opt.value) === String(selected || "");
                  return (
                    <button
                      key={`${q.id}_${oi}`}
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: isSelected ? "" : String(opt.value),
                        }))
                      }
                      className={[
                        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        isSelected
                          ? "border-indigo-400 bg-indigo-50 shadow-sm dark:border-indigo-600 dark:bg-indigo-950/60"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-700/50",
                        readOnly ? "cursor-default opacity-60" : "cursor-pointer",
                      ].join(" ")}
                    >
                      {/* Radio ring */}
                      <span
                        className={[
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isSelected ? "border-indigo-600 dark:border-indigo-400" : "border-slate-300 dark:border-slate-600",
                        ].join(" ")}
                      >
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                        )}
                      </span>
                      <span className={`flex-1 text-sm ${isSelected ? "font-medium text-indigo-800 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"}`}>
                        {opt.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors ${isSelected ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}>
                        {opt.points} pt{opt.points !== 1 ? "s" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => setAnswers({})}
          disabled={readOnly || !answeredCount}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submit.isPending || answeredCount === 0}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {submit.isPending ? "Submitting…" : `Submit Assessment${answeredCount < questions.length ? ` (${answeredCount}/${questions.length})` : ""}`}
        </button>
      </div>
    </div>
  );
}
