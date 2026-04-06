"use client";

import React from "react";
import { toApiError } from "@client/api";
import { TasksRegenDialog, type TasksRegenOptions } from "@entities/dialogs/tasks/TasksRegenDialog";
import { useTasksDelete, useTasksGenerateScheduleWrite, useTasksList, useTasksUpdateStatus, useTasksUpsertManual, type TasksListItem } from "@hooks/useTasks";
import { useEnrollment } from "@hooks/useEnrollments";
import { toast } from "@lib/toast";
import { safeISODate10 } from "@lib/date";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { RowClearShell, type RowClearStatus } from "@entities/ui/rowState";
import type { ReqOf } from "@hdb/contracts";
import Enrollments from "@client/enrollments";

type Props = {
  enrollmentId?: string | null;
  defaultDueDate?: string;
  readOnly?: boolean;
};

type Bucket = "task" | "assessment" | "compliance" | "other";
type TaskStatus = "open" | "done" | "verified";
type StepRow = {
  taskId: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  bucket: Bucket;
  multiStepIndex: number;
};

const asText = (v: unknown): string => (typeof v === "string" ? v : "");
const asStatus = (v: unknown): TaskStatus => (v === "done" || v === "verified" ? v : "open");
const asBucket = (v: unknown): Bucket =>
  v === "task" || v === "assessment" || v === "compliance" || v === "other" ? v : "task";
const asNum = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function normalizeRow(row: TasksListItem) {
  const r = row as Record<string, unknown>;
  return {
    id: asText(r.id) || asText(r.taskId),
    taskId: asText(r.taskId),
    title: asText(r.title) || "Task",
    dueDate: asText(r.dueDate),
    status: asStatus(r.status),
    bucket: asBucket(r.bucket),
    multiParentId: asText(r.multiParentId),
    multiStepIndex: asNum(r.multiStepIndex),
    multiStepCount: asNum(r.multiStepCount),
    multiMode: asText(r.multiMode),
  };
}

function plusOneYearISO(from = new Date()): string {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusOneYearFromISO(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return plusOneYearISO();
  const d = new Date(`${iso}T00:00:00`);
  return plusOneYearISO(d);
}

type SavedTaskScheduleMeta = {
  version?: number;
  defs?: unknown[];
  savedAt?: unknown;
  lastDraft?: Record<string, unknown>;
};

function readTaskScheduleMeta(src: unknown): SavedTaskScheduleMeta | null {
  if (!src || typeof src !== "object") return null;
  return src as SavedTaskScheduleMeta;
}

function normString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function makeTaskDefKey(def: Record<string, unknown>): string {
  const title = normString(def.name || def.title).trim().toLowerCase();
  return [
    title,
    normString(def.bucket).trim().toLowerCase(),
    normString(def.frequency).trim().toLowerCase(),
    String(def.every ?? ""),
    normString(def.startDate).trim(),
    normString(def.endDate).trim(),
  ].join("|");
}

function slugish(v: unknown): string {
  return String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "task";
}

export function TaskInput({ enrollmentId, defaultDueDate, readOnly = false }: Props) {
  const enrollmentQ = useEnrollment(enrollmentId, { enabled: !!enrollmentId });
  const listQ = useTasksList(enrollmentId ? { enrollmentId, limit: 1000 } : undefined, {
    enabled: !!enrollmentId,
    staleTime: 5_000,
  });
  const upsert = useTasksUpsertManual();
  const status = useTasksUpdateStatus();
  const remove = useTasksDelete();
  const generate = useTasksGenerateScheduleWrite();

  const [title, setTitle] = React.useState("");
  const [mode, setMode] = React.useState<"one-off" | "recurring">("one-off");
  const [dueDate, setDueDate] = React.useState(defaultDueDate || "");
  const [frequency, setFrequency] = React.useState("monthly");
  const [every, setEvery] = React.useState<number | "">("");
  const [recurringStartDate, setRecurringStartDate] = React.useState(todayISO());
  const [endDate, setEndDate] = React.useState(plusOneYearISO());
  const [bucket, setBucket] = React.useState<Bucket>("task");
  const [notes, setNotes] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [regenOpen, setRegenOpen] = React.useState(false);
  const [scheduleView, setScheduleView] = React.useState<"open" | "completed">("open");
  const [rowClearFx, setRowClearFx] = React.useState<Record<string, RowClearStatus>>({});

  const rows = React.useMemo(() => (listQ.data || []).map(normalizeRow), [listQ.data]);
  const savedTaskMeta = React.useMemo(
    () => readTaskScheduleMeta((enrollmentQ.data as Record<string, unknown> | null)?.taskScheduleMeta),
    [enrollmentQ.data],
  );
  const enrollmentStartISO = React.useMemo(() => {
    const raw = (enrollmentQ.data as Record<string, unknown> | null)?.startDate;
    return safeISODate10(raw) || "";
  }, [enrollmentQ.data]);

  React.useEffect(() => {
    const draft = (savedTaskMeta?.lastDraft || {}) as Record<string, unknown>;
    if (!enrollmentId) return;
    if (Array.isArray(savedTaskMeta?.defs) && savedTaskMeta.defs.length && mode === "one-off") {
      setMode("recurring");
    }
    const anchor = enrollmentStartISO || todayISO();
    const nextStart = safeISODate10(draft.startDate) || recurringStartDate || anchor;
    const nextEnd = safeISODate10(draft.endDate) || endDate || plusOneYearFromISO(anchor);
    if (!title && normString(draft.title)) setTitle(normString(draft.title));
    if (frequency === "monthly" && normString(draft.frequency)) setFrequency(normString(draft.frequency));
    if (every === "" && Number.isFinite(Number(draft.every)) && Number(draft.every) > 0) setEvery(Number(draft.every));
    if (bucket === "task" && (draft.bucket === "assessment" || draft.bucket === "compliance" || draft.bucket === "other")) {
      setBucket(draft.bucket as Bucket);
    }
    if (!notes && normString(draft.notes)) setNotes(normString(draft.notes));
    if (typeof draft.notify === "boolean") setNotify(Boolean(draft.notify));
    if (nextStart && nextStart !== recurringStartDate) setRecurringStartDate(nextStart);
    if (nextEnd && nextEnd !== endDate) setEndDate(nextEnd);
  // intentionally one-time per enrollment load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentId, savedTaskMeta, enrollmentStartISO]);

  React.useEffect(() => {
    if (!enrollmentId) return;
    const draft = (savedTaskMeta?.lastDraft || {}) as Record<string, unknown>;
    const hasDraftStart = !!safeISODate10(draft.startDate);
    const hasDraftEnd = !!safeISODate10(draft.endDate);
    const anchor = enrollmentStartISO || todayISO();
    if (!hasDraftStart && (!recurringStartDate || recurringStartDate === todayISO())) {
      setRecurringStartDate(anchor);
    }
    if (!hasDraftEnd && (!endDate || endDate === plusOneYearISO() || endDate === plusOneYearFromISO(recurringStartDate || ""))) {
      setEndDate(plusOneYearFromISO(anchor));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentId, enrollmentStartISO]);

  const twoStepGroups = React.useMemo(() => {
    const byParent = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.multiParentId || row.multiStepCount !== 2) continue;
      const list = byParent.get(row.multiParentId) || [];
      list.push(row);
      byParent.set(row.multiParentId, list);
    }
    const groups: Array<{ parentId: string; title: string; dueDate: string; mode: string; step1: StepRow; step2: StepRow }> = [];
    for (const [parentId, steps] of byParent.entries()) {
      const step1 = steps.find((s) => s.multiStepIndex === 1);
      const step2 = steps.find((s) => s.multiStepIndex === 2);
      if (!step1 || !step2) continue;
      groups.push({
        parentId,
        title: step1.title || step2.title || "Task",
        dueDate: step1.dueDate || step2.dueDate || "",
        mode: step1.multiMode || step2.multiMode || "parallel",
        step1: {
          taskId: step1.taskId,
          title: step1.title,
          dueDate: step1.dueDate,
          status: step1.status,
          bucket: step1.bucket,
          multiStepIndex: 1,
        },
        step2: {
          taskId: step2.taskId,
          title: step2.title,
          dueDate: step2.dueDate,
          status: step2.status,
          bucket: step2.bucket,
          multiStepIndex: 2,
        },
      });
    }
    return groups;
  }, [rows]);

  const groupedTaskIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const g of twoStepGroups) {
      ids.add(g.step1.taskId);
      ids.add(g.step2.taskId);
    }
    return ids;
  }, [twoStepGroups]);

  const regularRows = React.useMemo(
    () => rows.filter((r) => !groupedTaskIds.has(r.taskId)),
    [rows, groupedTaskIds],
  );
  const visibleTwoStepGroups = React.useMemo(
    () =>
      twoStepGroups.filter((group) => {
        const parentDone = group.step1.status !== "open" && group.step2.status !== "open";
        return scheduleView === "completed" ? parentDone : !parentDone;
      }),
    [twoStepGroups, scheduleView],
  );
  const visibleRegularRows = React.useMemo(
    () =>
      regularRows.filter((row) => {
        const done = row.status !== "open";
        return scheduleView === "completed" ? done : !done;
      }),
    [regularRows, scheduleView],
  );
  const openCount = React.useMemo(() => {
    const groupOpen = twoStepGroups.filter((g) => !(g.step1.status !== "open" && g.step2.status !== "open")).length;
    const rowOpen = regularRows.filter((r) => r.status === "open").length;
    return groupOpen + rowOpen;
  }, [twoStepGroups, regularRows]);
  const completedCount = React.useMemo(() => {
    const groupDone = twoStepGroups.filter((g) => g.step1.status !== "open" && g.step2.status !== "open").length;
    const rowDone = regularRows.filter((r) => r.status !== "open").length;
    return groupDone + rowDone;
  }, [twoStepGroups, regularRows]);

  const isBusy =
    upsert.isPending ||
    status.isPending ||
    remove.isPending ||
    generate.isPending ||
    listQ.isFetching;
  const disableMutations = readOnly || isBusy || !enrollmentId;

  React.useEffect(() => {
    if (!dueDate && defaultDueDate) setDueDate(defaultDueDate);
  }, [defaultDueDate, dueDate]);

  const pulseRowClear = React.useCallback((key: string, status: RowClearStatus, ms = 1100) => {
    if (!key || status === "none") return;
    setRowClearFx((prev) => ({ ...prev, [key]: status }));
    window.setTimeout(() => {
      setRowClearFx((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, ms);
  }, []);

  const create = async () => {
    if (!enrollmentId) {
      toast("Select an enrollment first.", { type: "error" });
      return;
    }
    if (readOnly) return;
    if (!title.trim()) {
      toast("Title is required.", { type: "error" });
      return;
    }
    try {
      if (mode === "one-off") {
        if (!dueDate) {
          toast("Due date is required for non-recurring tasks.", { type: "error" });
          return;
        }
        const body: ReqOf<"tasksUpsertManual"> = {
          enrollmentId,
          task: {
            title: title.trim(),
            dueDate: safeISODate10(dueDate) || dueDate,
            notes: notes.trim() || undefined,
            bucket,
            notify,
          },
        };
        await upsert.mutateAsync(body);
      } else {
        const needsEvery = frequency.startsWith("every");
        const startDate = safeISODate10(recurringStartDate) || recurringStartDate || todayISO();
        const stableDefId = `taskdef_${slugish(title)}_${slugish(bucket)}_${slugish(frequency)}_${String(needsEvery && every ? Number(every) : 1)}_${startDate}`;
        const nextDef = {
          id: stableDefId,
          name: title.trim(),
          kind: "recurring" as const,
          frequency,
          startDate,
          ...(needsEvery && every ? { every: Number(every) } : {}),
          ...(endDate ? { endDate: safeISODate10(endDate) || endDate } : {}),
          notify,
          bucket,
        };
        const existingDefs = Array.isArray(savedTaskMeta?.defs)
          ? (savedTaskMeta!.defs as Record<string, unknown>[])
              .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
          : [];
        const nextDefKey = makeTaskDefKey(nextDef as unknown as Record<string, unknown>);
        const nextDefs = [
          ...existingDefs.filter((d) => makeTaskDefKey(d) !== nextDefKey),
          nextDef,
        ];
        await Enrollments.upsert({
          id: enrollmentId,
          taskScheduleMeta: {
            version: 1,
            defs: nextDefs,
            savedAt: new Date().toISOString(),
            lastDraft: {
              title: title.trim(),
              frequency,
              every: needsEvery && every ? Number(every) : undefined,
              startDate,
              endDate: endDate || undefined,
              bucket,
              notes: notes.trim() || undefined,
              notify,
            },
          } as unknown,
        } as unknown as Parameters<typeof Enrollments.upsert>[0]);
        const body: ReqOf<"tasksGenerateScheduleWrite"> = {
          enrollmentId,
          mode: "replaceManaged",
          keepManual: true,
          preserveCompletedManaged: true,
          pinCompletedManaged: true,
          startDate,
          taskDefs: nextDefs as unknown as ReqOf<"tasksGenerateScheduleWrite">["taskDefs"],
        };
        await generate.mutateAsync(body);
      }
      setTitle("");
      setNotes("");
      setBucket("task");
      if (mode === "recurring") {
        const anchor = enrollmentStartISO || todayISO();
        setRecurringStartDate(anchor);
        setEndDate(plusOneYearFromISO(anchor));
      }
      toast(mode === "one-off" ? "Task added." : "Task schedule generated.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const changeStatus = async (taskId: string, action: "complete" | "reopen" | "verify") => {
    if (!enrollmentId || readOnly) return;
    try {
      const body: ReqOf<"tasksUpdateStatus"> = { enrollmentId, taskId, action };
      await status.mutateAsync(body);
      return true;
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
      return false;
    }
  };

  const deleteTask = async (taskId: string, label: string) => {
    if (!enrollmentId || readOnly) return;
    if (!window.confirm(`Delete task "${label}"?`)) return;
    try {
      const body: ReqOf<"tasksDelete"> = { enrollmentId, taskId };
      await remove.mutateAsync(body);
      toast("Task deleted.", { type: "success" });
      return true;
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
      return false;
    }
  };

  const deleteStepGroup = async (taskIds: string[], label: string) => {
    if (!enrollmentId || readOnly) return;
    if (!window.confirm(`Delete both steps for "${label}"?`)) return;
    try {
      for (const taskId of taskIds) {
        const body: ReqOf<"tasksDelete"> = { enrollmentId, taskId };
        await remove.mutateAsync(body);
      }
      toast("Two-step task deleted.", { type: "success" });
      return true;
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
      return false;
    }
  };

  const onRegenerate = async (opts: TasksRegenOptions) => {
    if (!enrollmentId || readOnly) return;
    try {
      const body: ReqOf<"tasksGenerateScheduleWrite"> = {
        enrollmentId,
        mode: opts.mode,
        keepManual: opts.keepManual,
        preserveCompletedManaged: opts.preserveCompletedManaged,
        pinCompletedManaged: opts.pinCompletedManaged,
        ...(opts.startDate ? { startDate: safeISODate10(opts.startDate) || String(opts.startDate) } : {}),
      };
      await generate.mutateAsync(body);
      setRegenOpen(false);
      toast("Tasks regenerated.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-sm font-medium text-slate-800">Task Input</div>
      {enrollmentId ? (
        <div className="text-xs text-slate-600">
          Enrollment:{" "}
          <span className="font-medium">
            {formatEnrollmentLabel((enrollmentQ.data as Record<string, unknown> | null) || null, { fallback: String(enrollmentId) })}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
        <input
          className="md:col-span-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          disabled={readOnly}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={mode}
          onChange={(e) => setMode(e.currentTarget.value as "one-off" | "recurring")}
          disabled={readOnly}
        >
          <option value="one-off">non-recurring</option>
          <option value="recurring">recurring</option>
        </select>
        {mode === "one-off" ? (
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.currentTarget.value)}
            disabled={readOnly}
          />
        ) : (
          <select
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={frequency}
            onChange={(e) => setFrequency(e.currentTarget.value)}
            disabled={readOnly}
          >
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="annually">annually</option>
            <option value="every X weeks">every X weeks</option>
            <option value="every X months">every X months</option>
          </select>
        )}
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={bucket}
          onChange={(e) => setBucket(e.currentTarget.value as Bucket)}
          disabled={readOnly}
        >
          <option value="task">task</option>
          <option value="assessment">assessment</option>
          <option value="compliance">compliance</option>
          <option value="other">other</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-2 py-1.5 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.currentTarget.checked)} disabled={readOnly} />
          notify
        </label>
      </div>

      {mode === "recurring" && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            type="date"
            value={recurringStartDate}
            onChange={(e) => setRecurringStartDate(e.currentTarget.value)}
            placeholder="Start date"
            disabled={readOnly}
          />
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            type="number"
            min={1}
            placeholder={frequency.startsWith("every") ? "Every" : "Every (n/a)"}
            value={frequency.startsWith("every") ? every : ""}
            disabled={!frequency.startsWith("every") || readOnly}
            onChange={(e) => setEvery(e.currentTarget.value ? Number(e.currentTarget.value) : "")}
          />
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.currentTarget.value)}
            placeholder="End date (optional)"
            disabled={readOnly}
          />
          <div className="flex items-center text-xs text-slate-600">Recurring schedule anchor (defaults to enrollment start date).</div>
        </div>
      )}

      {Array.isArray(savedTaskMeta?.defs) && savedTaskMeta!.defs.length > 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
          Saved recurring schedule defs: {savedTaskMeta!.defs.length}
        </div>
      ) : null}

      <textarea
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
        placeholder="Notes (optional)"
        disabled={readOnly}
      />

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          onClick={create}
          disabled={disableMutations}
        >
          {upsert.isPending || generate.isPending
            ? "Saving..."
            : mode === "one-off"
              ? "Add Non-Recurring Task"
              : "Add Recurring Task"}
        </button>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-600">Current schedule</div>
            <div className="inline-flex rounded border border-slate-300 p-0.5">
              <button
                type="button"
                className={`px-2 py-1 text-xs rounded ${scheduleView === "open" ? "bg-slate-900 text-white" : "text-slate-700"}`}
                onClick={() => setScheduleView("open")}
              >
                Open ({openCount})
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-xs rounded ${scheduleView === "completed" ? "bg-slate-900 text-white" : "text-slate-700"}`}
                onClick={() => setScheduleView("completed")}
              >
                Completed ({completedCount})
              </button>
            </div>
          </div>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
            disabled={disableMutations || !rows.length}
            onClick={() => setRegenOpen(true)}
          >
            Regenerate enrollment tasks
          </button>
        </div>
        {readOnly && <div className="mb-2 text-xs text-amber-700">Task edits are disabled for closed enrollment/grant.</div>}
        {!enrollmentId ? (
          <div className="text-sm text-slate-600">Select an enrollment to view tasks.</div>
        ) : listQ.isLoading ? (
          <div className="text-sm text-slate-600">Loading tasks...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-600">No tasks found.</div>
        ) : (
          <div className="space-y-2">
            {visibleTwoStepGroups.map((group) => {
              const step1Done = group.step1.status !== "open";
              const step2Done = group.step2.status !== "open";
              const parentDone = step1Done && step2Done;
              const step2Blocked = group.mode === "sequential" && !step1Done && group.step2.status === "open";
              const step1Verified = group.step1.status === "verified";
              const step2Verified = group.step2.status === "verified";
              return (
                <RowClearShell
                  key={group.parentId}
                  state={parentDone ? "completed" : "active"}
                  clearStatus={rowClearFx[`group:${group.parentId}`] || "none"}
                  extraButtons={
                    <>
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      disabled={disableMutations || step1Verified}
                      onClick={async () => {
                        const nextAction = group.step1.status === "open" ? "complete" : "reopen";
                        pulseRowClear(`group:${group.parentId}`, nextAction === "complete" ? "completed" : "markedActive");
                        await changeStatus(group.step1.taskId, nextAction);
                      }}
                    >
                      Step 1: {group.step1.status === "open" ? "Complete" : "Mark Incomplete"}
                    </button>
                    {group.step1.status === "done" ? (
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={disableMutations || step1Verified}
                        onClick={async () => {
                          pulseRowClear(`group:${group.parentId}`, "completed");
                          await changeStatus(group.step1.taskId, "verify");
                        }}
                      >
                        Step 1: {step1Verified ? "Verified" : "Verify"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      disabled={disableMutations || step2Verified || step2Blocked}
                      onClick={async () => {
                        const nextAction = group.step2.status === "open" ? "complete" : "reopen";
                        pulseRowClear(`group:${group.parentId}`, nextAction === "complete" ? "completed" : "markedActive");
                        await changeStatus(group.step2.taskId, nextAction);
                      }}
                    >
                      Step 2: {group.step2.status === "open" ? "Complete" : "Mark Incomplete"}
                    </button>
                    {group.step2.status === "done" ? (
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={disableMutations || step2Verified}
                        onClick={async () => {
                          pulseRowClear(`group:${group.parentId}`, "completed");
                          await changeStatus(group.step2.taskId, "verify");
                        }}
                      >
                        Step 2: {step2Verified ? "Verified" : "Verify"}
                      </button>
                    ) : null}
                    </>
                  }
                  menuItems={[
                    {
                      key: "delete",
                      label: "Delete task",
                      danger: true,
                      disabled: disableMutations,
                      onSelect: async () => {
                        pulseRowClear(`group:${group.parentId}`, "deleted", 1200);
                        await deleteStepGroup([group.step1.taskId, group.step2.taskId], group.title);
                      },
                    },
                  ]}
                >
                  <div className="mb-1 text-sm font-medium">{group.title}</div>
                  <div className="mb-2 text-xs text-slate-600">
                    due {group.dueDate || "-"} | two-step ({group.mode}) | task status: {parentDone ? "done" : "open"}
                  </div>
                  {step2Blocked ? (
                    <div className="mb-2 text-xs text-amber-700">
                      Step 2 is waiting for Step 1 to be completed/approved.
                    </div>
                  ) : null}
                </RowClearShell>
              );
            })}

            {visibleRegularRows.map((row) => (
              <RowClearShell
                key={row.id || row.taskId}
                state={row.status === "open" ? "active" : "completed"}
                clearStatus={rowClearFx[`task:${row.taskId}`] || "none"}
                extraButtons={
                  <>
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      disabled={disableMutations || row.status === "verified"}
                      onClick={async () => {
                        const nextAction = row.status === "open" ? "complete" : "reopen";
                        pulseRowClear(`task:${row.taskId}`, nextAction === "complete" ? "completed" : "markedActive");
                        await changeStatus(row.taskId, nextAction);
                      }}
                    >
                      {row.status === "open" ? "Mark Complete" : "Mark Incomplete"}
                    </button>
                    {row.status === "done" && (
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={disableMutations}
                        onClick={async () => {
                          pulseRowClear(`task:${row.taskId}`, "completed");
                          await changeStatus(row.taskId, "verify");
                        }}
                      >
                        Verify
                      </button>
                    )}
                  </>
                }
                menuItems={[
                  {
                    key: "delete",
                    label: "Delete",
                    danger: true,
                    disabled: disableMutations,
                    onSelect: async () => {
                      pulseRowClear(`task:${row.taskId}`, "deleted", 1200);
                      await deleteTask(row.taskId, row.title || row.taskId);
                    },
                  },
                ]}
              >
                <div>
                  <div className="text-sm font-medium">{row.title || row.taskId}</div>
                  <div className="text-xs text-slate-600">
                    due {row.dueDate || "-"} | status: {row.status || "open"} | bucket: {row.bucket || "task"}
                  </div>
                </div>
              </RowClearShell>
            ))}
            {visibleTwoStepGroups.length === 0 && visibleRegularRows.length === 0 ? (
              <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
                {scheduleView === "open" ? "No open tasks." : "No completed tasks."}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <TasksRegenDialog
        open={regenOpen}
        selectedCount={1}
        onCancel={() => setRegenOpen(false)}
        onConfirm={(opts) => {
          if (!window.confirm("Regenerate managed tasks for this enrollment? This may replace managed tasks while preserving manual tasks based on your options.")) {
            return;
          }
          void onRegenerate(opts);
        }}
      />
    </div>
  );
}
