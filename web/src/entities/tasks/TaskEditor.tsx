//web/src/entities/TaskEditor.tsx
"use client";

import React from "react";
import type { ISODate } from "@types";
import { parseISO10, toISODate, addYears, addDays } from "@lib/date";

const num = (v: string | number) => (typeof v === "string" ? parseInt(v, 10) : v);
const safeDate = (s?: ISODate | string | null) => parseISO10(s);

type TaskBase = {
  id: string;
  kind: "recurring" | "one-off";
  name?: string;
  comments?: string;
};

type TaskRecurringTemplate = TaskBase & {
  kind: "recurring";
  frequency?: string | null; // "weekly" | "monthly" | "annually" | "every X weeks" | "every X months"
  every?: number | null; // used when frequency starts with "every"
  startDate?: ISODate | null; // optional manual anchor
  endDate?: ISODate | null; // optional horizon
};

type TaskOneOffTemplate = TaskBase & {
  kind: "one-off";
  dueDate?: ISODate | null;
};

export type TaskTemplate = TaskRecurringTemplate | TaskOneOffTemplate;

// Model is kept backward-compatible with the old "assessments" field name.
// If model.tasks exists, we write tasks; otherwise we write assessments.
type TaskTemplatesModel = { tasks?: TaskTemplate[]; assessments?: TaskTemplate[] };

export type TaskEditorEnrollment = {
  id: string;
  label: string;
  grantId?: string | null;
  startDate?: ISODate | null; // YYYY-MM-DD
};

type Props = {
  editing: boolean;
  model: TaskTemplatesModel;
  setModel: React.Dispatch<React.SetStateAction<TaskTemplatesModel>>;

  enrollments?: TaskEditorEnrollment[];
  selectedEnrollmentIds?: string[];
  onChangeSelectedEnrollmentIds?: (ids: string[]) => void;

  boundGrantId?: string | null;
  showDateInputs?: boolean;
  fieldMode?: "auto" | "tasks" | "assessments";
};

export function TaskEditor({
  editing,
  model,
  setModel,
  enrollments,
  selectedEnrollmentIds,
  onChangeSelectedEnrollmentIds,
  boundGrantId = null,
  showDateInputs = true,
  fieldMode = "auto",
}: Props) {
  const field: "tasks" | "assessments" =
    fieldMode === "tasks"
      ? "tasks"
      : fieldMode === "assessments"
        ? "assessments"
        : Object.prototype.hasOwnProperty.call(model, "tasks")
          ? "tasks"
          : "assessments";

  const list: TaskTemplate[] = Array.isArray((model as any)[field]) ? ((model as any)[field] as TaskTemplate[]) : [];
  const commit = (next: TaskTemplate[]) => setModel((m) => ({ ...m, [field]: next }));

  // ----- enrollment selection -----
  const filteredEnrollments = React.useMemo(() => {
    if (!Array.isArray(enrollments) || enrollments.length === 0) return [];
    if (!boundGrantId) return enrollments;
    return enrollments.filter((e) => (e.grantId || null) === boundGrantId);
  }, [enrollments, boundGrantId]);

  const [internalSel, setInternalSel] = React.useState<string[]>([]);

  const filteredKey = React.useMemo(
    () => (filteredEnrollments || []).map((e) => e.id).join("|"),
    [filteredEnrollments]
  );
  const selectedKey = React.useMemo(() => (selectedEnrollmentIds || []).join("|"), [selectedEnrollmentIds]);

  React.useEffect(() => {
    if (!filteredEnrollments.length) return;

    if (selectedEnrollmentIds) {
      setInternalSel(selectedEnrollmentIds.filter((id) => filteredEnrollments.some((e) => e.id === id)));
    } else {
      setInternalSel((prev) => prev.filter((id) => filteredEnrollments.some((e) => e.id === id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredKey, selectedKey]);

  const currentSelection = selectedEnrollmentIds ?? internalSel;

  const setSelection = (next: string[]) => {
    onChangeSelectedEnrollmentIds?.(next);
    setInternalSel(next);
  };

  const toggleOne = (id: string) =>
    setSelection(currentSelection.includes(id) ? currentSelection.filter((x) => x !== id) : [...currentSelection, id]);

  const allVisibleIds = filteredEnrollments.map((e) => e.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => currentSelection.includes(id));
  const noneSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => !currentSelection.includes(id));
  const toggleAll = () => setSelection(allSelected ? [] : allVisibleIds);

  // Default end date = earliest selected startDate + 1y (fallback: today + 1y)
  const computeDefaultEndDate = React.useCallback((): ISODate => {
    const candidates = filteredEnrollments
      .filter((e) => currentSelection.includes(e.id))
      .map((e) => safeDate(e.startDate))
      .filter((d): d is Date => !!d);

    const base = candidates.length ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : new Date();
    return toISODate(addDays(addYears(base, 1), -1));
  }, [filteredEnrollments, currentSelection]);

  const defaultEndDate = React.useMemo(() => computeDefaultEndDate(), [computeDefaultEndDate]);

  // ----- add controls -----
  const addRecurring = () => {
    const base: TaskRecurringTemplate = {
      id: `tasktpl_${Date.now().toString(36)}`,
      kind: "recurring",
      name: "",
      frequency: "monthly",
      every: null,
      comments: "",
      ...(showDateInputs ? { endDate: computeDefaultEndDate() } : {}),
    };
    commit([...list, base]);
  };

  const addOneOff = () => {
    commit([
      ...list,
      {
        id: `tasktpl_${Date.now().toString(36)}`,
        kind: "one-off",
        name: "",
        dueDate: null,
        comments: "",
      } as TaskOneOffTemplate,
    ]);
  };

  const del = (i: number) => {
    const next = list.slice();
    next.splice(i, 1);
    commit(next);
  };

  const patch = (i: number, p: Partial<TaskTemplate>) => {
    const next = list.slice();
    const prev = (next[i] as TaskTemplate | undefined) ?? ({} as TaskTemplate);
    const incoming: any = { ...prev, ...p };

    if (Object.prototype.hasOwnProperty.call(p, "kind")) {
      if (p.kind === "one-off") {
        delete incoming.frequency;
        delete incoming.every;
        delete incoming.endDate;
        delete incoming.startDate;
        incoming.dueDate = (prev.kind === "one-off" ? (prev as any).dueDate : null) ?? null;
      } else if (p.kind === "recurring") {
        delete incoming.dueDate;
        incoming.frequency = (prev.kind === "recurring" ? (prev as any).frequency : undefined) ?? "monthly";
        incoming.every = (prev.kind === "recurring" ? (prev as any).every : undefined) ?? null;
        if (!("endDate" in prev) || !(prev as any).endDate) incoming.endDate = computeDefaultEndDate();
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(p, "frequency") &&
      (incoming.kind ?? "recurring") === "recurring" &&
      typeof incoming.frequency === "string" &&
      !incoming.frequency.startsWith("every")
    ) {
      incoming.every = null;
    }

    if (!showDateInputs) {
      if (incoming.kind === "recurring") {
        delete incoming.endDate;
        delete incoming.startDate;
      }
      if (incoming.kind === "one-off") {
        delete incoming.dueDate;
      }
    }

    next[i] = incoming;
    commit(next);
  };

  // ----- view mode -----
  const view = (
    <>
      {Array.isArray(enrollments) && enrollments.length > 0 && (
        <div className="mb-3 text-xs text-slate-600">
          {boundGrantId ? "Grant-scoped tasks. Showing enrollments for this grant only." : "Tasks are applied per enrollment."}
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-slate-600">No tasks.</p>
      ) : (
        <ul className="list-disc pl-6 text-sm">
          {list.map((t, i) => (
            <li key={t?.id || i}>
              <span className="font-medium">{t?.name || `Task #${i + 1}`}</span>

              {t.kind === "recurring" ? (
                <>
                  {t.frequency ? <span className="text-slate-600"> — {t.frequency}</span> : null}
                  {t.every ? <span className="text-slate-600"> (every {t.every})</span> : null}
                  {showDateInputs && (t as any).endDate ? <span className="text-slate-600"> — until {(t as any).endDate}</span> : null}
                </>
              ) : (t as any).dueDate ? (
                <span className="text-slate-600"> — due {(t as any).dueDate}</span>
              ) : (
                <span className="text-slate-600"> — one-off</span>
              )}

              {t?.comments ? <span className="text-slate-600"> — {t.comments}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  // ----- edit mode -----
  const [addOpen, setAddOpen] = React.useState(false);

  const edit = (
    <div className="space-y-4">
      {/* Enrollment selector */}
      {filteredEnrollments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Apply to enrollments</div>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              onClick={toggleAll}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          {boundGrantId && <div className="mb-2 text-xs text-slate-600">Filtered by grant.</div>}

          <div className="grid max-h-48 grid-cols-1 gap-2 overflow-auto md:grid-cols-2">
            {filteredEnrollments.map((e) => {
              const checked = currentSelection.includes(e.id);
              return (
                <label key={e.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={checked} onChange={() => toggleOne(e.id)} />
                  <span className="truncate">{e.label}</span>
                </label>
              );
            })}
          </div>

          <div className="mt-2 text-xs text-slate-600">
            {noneSelected ? "No enrollment selected — nothing will be written." : allSelected ? "All shown enrollments selected." : `${currentSelection.length} selected.`}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Define required tasks.</div>

        <div className="relative">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setAddOpen((o) => !o)}
          >
            + Add task
          </button>

          {addOpen && (
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-slate-200 bg-white shadow">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  addRecurring();
                  setAddOpen(false);
                }}
              >
                Recurring task
              </button>
              <hr className="border-t border-slate-100" />
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  addOneOff();
                  setAddOpen(false);
                }}
              >
                One-off task
              </button>
            </div>
          )}
        </div>
      </div>

      {list.length === 0 && <p className="text-sm text-slate-600">No tasks yet.</p>}

      {list.map((t, i) => {
        const isRecurring = t.kind === "recurring";
        const freq = isRecurring ? String((t as any).frequency ?? "monthly") : "monthly";
        const needsEvery = isRecurring && freq.startsWith("every");

        return (
          <div key={t?.id || i} className="relative rounded-xl border border-slate-200 bg-white p-4 pt-5 shadow-sm">
            <button
              type="button"
              aria-label="Delete task"
              className="absolute right-2 top-2 rounded px-2 text-red-600 hover:text-red-700"
              onClick={() => del(i)}
              title="Delete"
            >
              ×
            </button>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Name */}
              <div className="min-w-0 lg:col-span-5">
                <label className="text-xs text-slate-600">Name</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={t.name ?? ""}
                  onChange={(e) => patch(i, { name: e.currentTarget.value })}
                />
              </div>

              {/* Kind */}
              <div className="min-w-0 lg:col-span-3">
                <label className="text-xs text-slate-600">Type</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={t.kind}
                  onChange={(e) => patch(i, { kind: e.currentTarget.value as "recurring" | "one-off" })}
                >
                  <option value="recurring">recurring</option>
                  <option value="one-off">one-off</option>
                </select>
              </div>

              {isRecurring ? (
                <>
                  {/* Frequency */}
                  <div className="min-w-0 lg:col-span-3">
                    <label className="text-xs text-slate-600">Frequency</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                      value={freq}
                      onChange={(e) => patch(i, { frequency: e.currentTarget.value } as any)}
                    >
                      <option value="weekly">weekly</option>
                      <option value="monthly">monthly</option>
                      <option value="annually">annually</option>
                      <option value="every X weeks">every X weeks</option>
                      <option value="every X months">every X months</option>
                    </select>
                  </div>

                  {/* Every */}
                  <div className="min-w-0 lg:col-span-1">
                    <label className="text-xs text-slate-600">Every</label>
                    {needsEvery ? (
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                        type="number"
                        min={1}
                        value={(t as any).every ?? ""}
                        onChange={(e) => patch(i, { every: num(e.currentTarget.value) || null } as any)}
                      />
                    ) : (
                      <div className="mt-1 py-1.5 text-sm text-slate-400">—</div>
                    )}
                  </div>

                  {/* Optional start/end */}
                  {showDateInputs && (
                    <>
                      <div className="min-w-0 lg:col-span-6">
                        <label className="text-xs text-slate-600">Start date (optional)</label>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                          type="date"
                          value={(t as any).startDate ?? ""}
                          onChange={(e) => patch(i, { startDate: (e.currentTarget.value || null) as ISODate | null } as any)}
                        />
                      </div>

                      <div className="min-w-0 lg:col-span-6">
                        <label className="text-xs text-slate-600">End date (optional)</label>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                          type="date"
                          value={(t as any).endDate ?? ""}
                          placeholder={defaultEndDate}
                          onChange={(e) => patch(i, { endDate: e.currentTarget.value || null } as any)}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {showDateInputs ? (
                    <div className="min-w-0 lg:col-span-6">
                      <label className="text-xs text-slate-600">Due date</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                        type="date"
                        value={(t as any).dueDate ?? ""}
                        onChange={(e) => patch(i, { dueDate: (e.currentTarget.value || null) as ISODate | null } as any)}
                      />
                    </div>
                  ) : (
                    <div className="min-w-0 lg:col-span-6">
                      <label className="text-xs text-slate-600">When</label>
                      <div className="mt-1 py-1.5 text-sm text-slate-400">relative to start date</div>
                    </div>
                  )}
                </>
              )}

              {/* Notes */}
              <div className="min-w-0 lg:col-span-12">
                <label className="text-xs text-slate-600">Notes</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={t.comments ?? ""}
                  onChange={(e) => patch(i, { comments: e.currentTarget.value })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return editing ? edit : view;
}
