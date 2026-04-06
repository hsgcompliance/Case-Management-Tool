"use client";

import React from "react";

export type TaskStepDraft = {
  group: "admin" | "casemanager" | "compliance";
  uid?: string | null;
};

export type TaskTemplateDraft = {
  id?: string;
  name: string;
  kind: "recurring" | "one-off";
  frequency?: string | null;
  every?: number | null;
  dueDate?: string | null;
  endDate?: string | null;
  notify?: boolean;
  bucket?: "task" | "assessment" | "compliance" | "other";
  multiparty?: {
    mode: "parallel" | "sequential";
    steps: TaskStepDraft[];
  } | null;
  todoItems?: string[] | null;
};

type Props = {
  editing: boolean;
  value: TaskTemplateDraft[];
  onChange: (next: TaskTemplateDraft[]) => void;
};

function uid() {
  return `taskdef_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

function setAt<T>(arr: T[], idx: number, val: T) {
  const next = arr.slice();
  next[idx] = val;
  return next;
}

function assignmentModeFor(step: TaskStepDraft): "bucket_cm" | "group_queue" | "specific_uid" {
  if (step.uid && String(step.uid).trim()) return "specific_uid";
  if (step.group === "casemanager") return "bucket_cm";
  return "group_queue";
}

function normalizeTodoItems(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

const DEFAULT_DEF: TaskTemplateDraft = {
  id: "",
  name: "",
  kind: "recurring",
  frequency: "monthly",
  every: null,
  dueDate: null,
  endDate: null,
  notify: true,
  bucket: "task",
  multiparty: null,
  todoItems: null,
};

export function TaskBuilder({ editing, value, onChange }: Props) {
  const list = Array.isArray(value) ? value : [];

  if (!editing) {
    if (list.length === 0) {
      return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">No task definitions.</div>;
    }
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((t, i) => (
          <div key={t.id || i} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm font-medium dark:text-slate-100">{t.name || `Task ${i + 1}`}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {t.kind === "one-off"
                ? `one-off${t.dueDate ? ` due ${t.dueDate}` : ""}`
                : `${t.frequency || "monthly"}${t.every ? ` (every ${t.every})` : ""}${t.endDate ? ` until ${t.endDate}` : ""}`}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              bucket: {t.bucket || "task"} | notify: {t.notify === false ? "off" : "on"}
            </div>
            {t.multiparty?.steps?.length ? (
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                multiparty: {t.multiparty.mode} ({t.multiparty.steps.length} steps)
              </div>
            ) : null}
            {normalizeTodoItems(t.todoItems).length ? (
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                todo: {normalizeTodoItems(t.todoItems).length} item(s)
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-700 dark:text-slate-300">Task definition builder</div>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          onClick={() => onChange([...list, { ...DEFAULT_DEF, id: uid() }])}
        >
          + Task Definition
        </button>
      </div>

      {list.length === 0 && <div className="text-sm text-slate-600 dark:text-slate-400">No task definitions yet.</div>}

      {list.map((task, idx) => {
        const freq = String(task.frequency || "monthly");
        const needsEvery = freq.startsWith("every");
        const todoText = normalizeTodoItems(task.todoItems).join("\n");
        return (
          <div key={task.id || idx} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <input
                className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="ID (optional)"
                value={task.id || ""}
                onChange={(e) => onChange(setAt(list, idx, { ...task, id: e.currentTarget.value }))}
              />
              <input
                className="md:col-span-2 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Name"
                value={task.name}
                onChange={(e) => onChange(setAt(list, idx, { ...task, name: e.currentTarget.value }))}
              />
              <select
                className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={task.kind}
                onChange={(e) =>
                  onChange(
                    setAt(list, idx, {
                      ...task,
                      kind: e.currentTarget.value as "recurring" | "one-off",
                      dueDate: e.currentTarget.value === "one-off" ? task.dueDate || null : null,
                    })
                  )
                }
              >
                <option value="recurring">recurring</option>
                <option value="one-off">one-off</option>
              </select>
              <select
                className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={task.bucket || "task"}
                onChange={(e) =>
                  onChange(
                    setAt(list, idx, {
                      ...task,
                      bucket: e.currentTarget.value as "task" | "assessment" | "compliance" | "other",
                    })
                  )
                }
              >
                <option value="task">task</option>
                <option value="assessment">assessment</option>
                <option value="compliance">compliance</option>
                <option value="other">other</option>
              </select>
              <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={task.notify !== false}
                  onChange={(e) => onChange(setAt(list, idx, { ...task, notify: e.currentTarget.checked }))}
                />
                notify
              </label>
            </div>

            {task.kind === "one-off" ? (
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  type="date"
                  value={task.dueDate || ""}
                  onChange={(e) => onChange(setAt(list, idx, { ...task, dueDate: e.currentTarget.value || null }))}
                />
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                <select
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={freq}
                  onChange={(e) =>
                    onChange(setAt(list, idx, { ...task, frequency: e.currentTarget.value, every: null }))
                  }
                >
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                  <option value="annually">annually</option>
                  <option value="every X weeks">every X weeks</option>
                  <option value="every X months">every X months</option>
                </select>
                <input
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  type="number"
                  min={1}
                  value={needsEvery ? task.every || "" : ""}
                  disabled={!needsEvery}
                  placeholder="Every"
                  onChange={(e) => onChange(setAt(list, idx, { ...task, every: Number(e.currentTarget.value || 0) || null }))}
                />
                <input
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  type="date"
                  value={task.endDate || ""}
                  onChange={(e) => onChange(setAt(list, idx, { ...task, endDate: e.currentTarget.value || null }))}
                />
              </div>
            )}

            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">Multi-party (optional)</div>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  onClick={() =>
                    onChange(
                      setAt(list, idx, {
                        ...task,
                        multiparty: task.multiparty
                          ? null
                          : { mode: "parallel", steps: [{ group: "casemanager", uid: null }] },
                      })
                    )
                  }
                >
                  {task.multiparty ? "Disable" : "Enable"}
                </button>
              </div>

              {task.multiparty ? (
                <div className="space-y-2">
                  <select
                    className="rounded border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={task.multiparty.mode}
                    onChange={(e) =>
                      onChange(
                        setAt(list, idx, {
                          ...task,
                          multiparty: { ...task.multiparty!, mode: e.currentTarget.value as "parallel" | "sequential" },
                        })
                      )
                    }
                  >
                    <option value="parallel">parallel</option>
                    <option value="sequential">sequential</option>
                  </select>

                  {task.multiparty.steps.map((step, si) => (
                    <div key={`${idx}_step_${si}`} className="grid grid-cols-1 gap-2 md:grid-cols-6">
                      <select
                        className="rounded border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={step.group}
                        onChange={(e) =>
                          onChange(
                            setAt(list, idx, {
                              ...task,
                              multiparty: {
                                ...task.multiparty!,
                                steps: setAt(task.multiparty!.steps, si, {
                                  ...step,
                                  group: e.currentTarget.value as "admin" | "casemanager" | "compliance",
                                }),
                              },
                            })
                          )
                        }
                      >
                        <option value="admin">admin</option>
                        <option value="casemanager">casemanager</option>
                        <option value="compliance">compliance</option>
                      </select>
                      <input
                        className="md:col-span-2 rounded border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        placeholder={
                          assignmentModeFor(step) === "bucket_cm"
                            ? "auto: enrollment case manager"
                            : assignmentModeFor(step) === "group_queue"
                              ? "group queue (no uid)"
                              : "specific uid"
                        }
                        value={step.uid || ""}
                        disabled={assignmentModeFor(step) !== "specific_uid"}
                        onChange={(e) =>
                          onChange(
                            setAt(list, idx, {
                              ...task,
                              multiparty: {
                                ...task.multiparty!,
                                steps: setAt(task.multiparty!.steps, si, {
                                  ...step,
                                  uid: e.currentTarget.value || null,
                                }),
                              },
                            })
                          )
                        }
                      />
                      <select
                        className="md:col-span-2 rounded border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={assignmentModeFor(step)}
                        onChange={(e) => {
                          const mode = e.currentTarget.value as "bucket_cm" | "group_queue" | "specific_uid";
                          const nextStep: TaskStepDraft =
                            mode === "specific_uid"
                              ? { ...step, uid: step.uid || "" }
                              : mode === "bucket_cm"
                                ? { ...step, group: "casemanager", uid: null }
                                : { ...step, uid: null };
                          onChange(
                            setAt(list, idx, {
                              ...task,
                              multiparty: {
                                ...task.multiparty!,
                                steps: setAt(task.multiparty!.steps, si, nextStep),
                              },
                            })
                          );
                        }}
                      >
                        <option value="bucket_cm">bucket CM (enrollment case manager)</option>
                        <option value="group_queue">group queue (no specific uid)</option>
                        <option value="specific_uid">specific user uid</option>
                      </select>
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:text-slate-300"
                        onClick={() =>
                          onChange(
                            setAt(list, idx, {
                              ...task,
                              multiparty: {
                                ...task.multiparty!,
                                steps: task.multiparty!.steps.filter((_, i) => i !== si),
                              },
                            })
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    onClick={() =>
                      onChange(
                        setAt(list, idx, {
                          ...task,
                          multiparty: {
                            ...task.multiparty!,
                            steps: [...task.multiparty!.steps, { group: "casemanager", uid: null }],
                          },
                        })
                      )
                    }
                  >
                    + Step
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">Todo checklist (optional)</div>
              <textarea
                className="min-h-[84px] w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder={"One item per line\nMeet\nEnter Into HMIS\nEnter Into CW"}
                value={todoText}
                onChange={(e) => {
                  const nextItems = e.currentTarget.value
                    .split(/\r?\n/)
                    .map((item) => item.trim())
                    .filter(Boolean);
                  onChange(
                    setAt(list, idx, {
                      ...task,
                      todoItems: nextItems.length ? nextItems : null,
                    }),
                  );
                }}
              />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Frontend-only checklist shown on the task detail card. Checking every item closes the task.
              </div>
            </div>

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-400"
                onClick={() => onChange(list.filter((_, i) => i !== idx))}
              >
                Remove Definition
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
