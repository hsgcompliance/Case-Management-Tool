"use client";

import React, { useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type AssessmentOptionDraft = {
  value: string;
  label: string;
  points: number;
};

export type AssessmentQuestionDraft = {
  id: string;
  label: string;
  options: AssessmentOptionDraft[];
};

export type AssessmentLevelDraft = {
  min: number;
  max?: number;
  label: string;
};

export type AssessmentTemplateDraft = {
  id?: string;
  title: string;
  description?: string;
  kind: string;
  scope: "customer" | "enrollment";
  locked?: boolean;
  editPolicy?: "adminOnly" | "ownerOrAdmin" | "team" | "org";
  version?: number;
  schema: {
    type: "rubric";
    rubric: {
      title: string;
      version: string;
      questions: AssessmentQuestionDraft[];
      levels: AssessmentLevelDraft[];
    };
  };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function setAt<T>(arr: T[], idx: number, val: T) {
  const next = arr.slice();
  next[idx] = val;
  return next;
}

const LEVEL_COLORS = [
  { dot: "bg-emerald-500", ring: "ring-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50" },
  { dot: "bg-sky-500",     ring: "ring-sky-200",     text: "text-sky-700",     bg: "bg-sky-50"     },
  { dot: "bg-amber-400",   ring: "ring-amber-200",   text: "text-amber-700",   bg: "bg-amber-50"   },
  { dot: "bg-orange-500",  ring: "ring-orange-200",  text: "text-orange-700",  bg: "bg-orange-50"  },
  { dot: "bg-rose-500",    ring: "ring-rose-200",    text: "text-rose-700",    bg: "bg-rose-50"    },
];

function levelColor(i: number) {
  return LEVEL_COLORS[i % LEVEL_COLORS.length];
}

// ── QuestionMenu (3-dot) ─────────────────────────────────────────────────────

function QuestionMenu({
  onDuplicate,
  onEditId,
  onDelete,
}: {
  onDuplicate: () => void;
  onEditId: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title="Question options"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <button
            type="button"
            onClick={() => { onDuplicate(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Duplicate question
          </button>
          <button
            type="button"
            onClick={() => { onEditId(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit question ID
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => { onDelete(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            Delete question
          </button>
        </div>
      )}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  editing: boolean;
  value: AssessmentTemplateDraft;
  onChange: (next: AssessmentTemplateDraft) => void;
};

// ── View mode ────────────────────────────────────────────────────────────────

function ViewMode({ value }: { value: AssessmentTemplateDraft }) {
  const rubric = value.schema.rubric;
  return (
    <div className="space-y-3">
      {/* Level legend */}
      {rubric.levels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rubric.levels.map((lvl, i) => {
            const c = levelColor(i);
            return (
              <span
                key={`${lvl.label}_${i}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${c.ring} ${c.bg} ${c.text}`}
              >
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {lvl.label}
                <span className="text-[10px] opacity-60">
                  {lvl.min}–{lvl.max ?? "∞"}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-3">
        {rubric.questions.map((q, i) => (
          <div key={q.id || i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{q.label || `Question ${i + 1}`}</p>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => (
                    <div
                      key={`${q.id}_${oi}`}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
                      <span className="flex-1 text-sm text-slate-700">{opt.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        {opt.points} pt{opt.points !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Edit mode ────────────────────────────────────────────────────────────────

function EditMode({ value, onChange }: { value: AssessmentTemplateDraft; onChange: (v: AssessmentTemplateDraft) => void }) {
  const rubric = value.schema.rubric;
  const [editingId, setEditingId] = useState<string | null>(null);

  const setRubric = (next: Partial<typeof rubric>) =>
    onChange({ ...value, schema: { ...value.schema, rubric: { ...rubric, ...next } } });

  const setQuestion = (idx: number, q: AssessmentQuestionDraft) =>
    setRubric({ questions: setAt(rubric.questions, idx, q) });

  const addQuestion = () =>
    setRubric({
      questions: [
        ...rubric.questions,
        {
          id: uid("q"),
          label: "",
          options: [
            { value: uid("opt"), label: "Option 1", points: 0 },
            { value: uid("opt"), label: "Option 2", points: 1 },
          ],
        },
      ],
    });

  const duplicateQuestion = (i: number) => {
    const q = rubric.questions[i];
    const copy: AssessmentQuestionDraft = {
      ...q,
      id: uid("q"),
      options: q.options.map((o) => ({ ...o, value: uid("opt") })),
    };
    const next = [...rubric.questions];
    next.splice(i + 1, 0, copy);
    setRubric({ questions: next });
  };

  const deleteQuestion = (i: number) =>
    setRubric({ questions: rubric.questions.filter((_, idx) => idx !== i) });

  const setLevel = (idx: number, lvl: AssessmentLevelDraft) =>
    setRubric({ levels: setAt(rubric.levels, idx, lvl) });

  const addLevel = () =>
    setRubric({ levels: [...rubric.levels, { min: 0, label: "New Level" }] });

  const deleteLevel = (i: number) =>
    setRubric({ levels: rubric.levels.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      {/* Questions */}
      <div className="space-y-3">
        {rubric.questions.map((q, i) => (
          <div key={q.id || i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Question header */}
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <input
                  className="w-full border-0 border-b border-slate-200 bg-transparent pb-1.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  placeholder="Question text…"
                  value={q.label}
                  onChange={(e) => setQuestion(i, { ...q, label: e.currentTarget.value })}
                />
                {/* ID row — shown when editing ID */}
                {editingId === q.id && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">ID:</span>
                    <input
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-mono text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      value={q.id}
                      onChange={(e) => setQuestion(i, { ...q, id: e.currentTarget.value })}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                    />
                  </div>
                )}
              </div>
              <QuestionMenu
                onDuplicate={() => duplicateQuestion(i)}
                onEditId={() => setEditingId(q.id)}
                onDelete={() => deleteQuestion(i)}
              />
            </div>

            {/* Options */}
            <div className="mt-4 space-y-2">
              {q.options.map((opt, oi) => (
                <div key={`${q.id}_${oi}`} className="flex items-center gap-2.5 group">
                  {/* Radio circle visual */}
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 group-hover:border-indigo-400 transition-colors" />
                  {/* Label */}
                  <input
                    className="flex-1 rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
                    placeholder="Option label…"
                    value={opt.label}
                    onChange={(e) =>
                      setQuestion(i, {
                        ...q,
                        options: setAt(q.options, oi, { ...opt, label: e.currentTarget.value }),
                      })
                    }
                  />
                  {/* Points */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm text-slate-700 focus:border-indigo-300 focus:bg-white focus:outline-none"
                      value={opt.points}
                      title="Points"
                      onChange={(e) =>
                        setQuestion(i, {
                          ...q,
                          options: setAt(q.options, oi, {
                            ...opt,
                            points: Number(e.currentTarget.value || 0),
                          }),
                        })
                      }
                    />
                    <span className="text-[11px] text-slate-400">pt</span>
                  </div>
                  {/* Remove option */}
                  <button
                    type="button"
                    title="Remove option"
                    className="h-6 w-6 flex items-center justify-center rounded text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 transition-all"
                    onClick={() =>
                      setQuestion(i, { ...q, options: q.options.filter((_, idx) => idx !== oi) })
                    }
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M9.5 3L6 6.5 2.5 3 2 3.5 5.5 7 2 10.5l.5.5L6 7.5 9.5 11l.5-.5L6.5 7 10 3.5z" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Add option */}
              <button
                type="button"
                onClick={() =>
                  setQuestion(i, {
                    ...q,
                    options: [
                      ...q.options,
                      { value: uid("opt"), label: "", points: 0 },
                    ],
                  })
                }
                className="ml-6 flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                  <path d="M5 0h1v5h5v1H6v5H5V6H0V5h5z" />
                </svg>
                Add option
              </button>
            </div>
          </div>
        ))}

        {/* Add question — dashed card */}
        <button
          type="button"
          onClick={addQuestion}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-transparent py-5 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7 0h2v7h7v2H9v7H7V9H0V7h7z" />
          </svg>
          Add question
        </button>
      </div>

      {/* Scoring levels */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Scoring Levels
          </span>
          <button
            type="button"
            onClick={addLevel}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            + Level
          </button>
        </div>

        <div className="space-y-2">
          {rubric.levels.map((lvl, li) => {
            const c = levelColor(li);
            return (
              <div key={`${lvl.label}_${li}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${c.bg} ring-1 ${c.ring}`}>
                <span className={`h-3 w-3 shrink-0 rounded-full ${c.dot}`} />
                <input
                  className={`flex-1 border-0 bg-transparent text-sm font-medium placeholder:text-slate-400 focus:outline-none ${c.text}`}
                  placeholder="Level name…"
                  value={lvl.label}
                  onChange={(e) => setLevel(li, { ...lvl, label: e.currentTarget.value })}
                />
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="number"
                    className="w-14 rounded border border-slate-200 bg-white/70 px-2 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={lvl.min}
                    placeholder="min"
                    onChange={(e) => setLevel(li, { ...lvl, min: Number(e.currentTarget.value || 0) })}
                  />
                  <span>–</span>
                  <input
                    type="number"
                    className="w-14 rounded border border-slate-200 bg-white/70 px-2 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={lvl.max ?? ""}
                    placeholder="max"
                    onChange={(e) =>
                      setLevel(li, {
                        ...lvl,
                        max: e.currentTarget.value ? Number(e.currentTarget.value) : undefined,
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  title="Remove level"
                  onClick={() => deleteLevel(li)}
                  className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M9.5 3L6 6.5 2.5 3 2 3.5 5.5 7 2 10.5l.5.5L6 7.5 9.5 11l.5-.5L6.5 7 10 3.5z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AssessmentBuilder({ editing, value, onChange }: Props) {
  if (!editing) return <ViewMode value={value} />;
  return <EditMode value={value} onChange={onChange} />;
}
