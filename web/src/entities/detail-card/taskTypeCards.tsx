"use client";

import React from "react";
import { isInboxClosed } from "@hooks/useInboxDetail";
import { useEnrollment } from "@hooks/useEnrollments";
import { DetailCardShell, DetailRow, DetailSection } from "./core";
import { DetailAdvancedView, DetailQuickLinks, DetailUniversalHeader } from "./inboxDetailLayout";

type InboxDetailExtras = {
  onSaveNote?: (note: string) => Promise<void>;
  onAssignCM?: (uid: string | null) => void;
  onAutoClose?: () => void;
};

type InboxDetailProps = {
  item: Record<string, unknown>;
  actions?: React.ReactNode;
  extras?: InboxDetailExtras;
};

/** Inline note editor — appears in the description area as an edit-style field. */
function NoteEditor({ onSave }: { onSave?: (note: string) => Promise<void> }) {
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  if (!onSave) return null;

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      setText("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <textarea
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none transition"
        rows={2}
        placeholder="Add a note…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSave();
        }}
      />
      {text.trim() ? (
        <button
          className="btn btn-xs"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Note"}
        </button>
      ) : null}
    </div>
  );
}

type TaskSubtype =
  | "assessment"
  | "paymentPrep"
  | "complianceReview"
  | "multiparty"
  | "managedRecurring"
  | "manualGeneral";

function tok(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

function statusLabel(item: Record<string, unknown>): string {
  if (String(item?.status || "").toLowerCase() === "verified" || item?.verified === true) return "Verified";
  return isInboxClosed(item?.status) ? "Closed" : "Open";
}

function waitingLabel(item: Record<string, unknown>): string | null {
  if (!item?.workflowBlocked) return null;
  const group = tok(item?.waitingOnGroup);
  const waitingName = String(item?.waitingOnName || "").trim();
  const waitingUid = String(item?.waitingOnUid || "").trim();
  const who = waitingName || waitingUid;
  if (group === "compliance") return "Waiting for compliance to verify/approve prior step";
  if (group === "casemanager") {
    return who
      ? `Waiting for ${who} (case manager) to complete/approve prior step`
      : "Waiting for case manager to complete/approve prior step";
  }
  if (group === "admin") return "Waiting for admin to complete prior step";
  return "Waiting for previous step in sequential workflow";
}

function getTaskSubtype(item: Record<string, unknown>): TaskSubtype {
  const bucket = tok(item?.bucket);
  const title = tok(item?.title);
  const labels = Array.isArray(item?.labels) ? item.labels.map((x: unknown) => tok(x)) : [];
  const hasMultiparty = Boolean(item?.multiParentId) || Number(item?.multiStepCount || 0) > 1;
  const managed = item?.managed === true || Boolean(item?.defId) || labels.includes("managed");

  if (bucket === "assessment" || labels.includes("assessment") || title.includes("assessment")) return "assessment";
  if (bucket === "compliance") return "complianceReview";
  if (title.includes("payment") || title.includes("rent certification")) return "paymentPrep";
  if (hasMultiparty) return "multiparty";
  if (managed) return "managedRecurring";
  return "manualGeneral";
}

function subtypeTitle(subtype: TaskSubtype): string {
  if (subtype === "assessment") return "Assessment Task";
  if (subtype === "paymentPrep") return "Payment-Related Task";
  if (subtype === "complianceReview") return "Compliance Task";
  if (subtype === "multiparty") return "Multiparty Task";
  if (subtype === "managedRecurring") return "Managed Recurring Task";
  return "Manual Task";
}

function parseTaskRef(item: Record<string, unknown>): { enrollmentId: string; taskId: string } | null {
  const enrollmentId = String(item.enrollmentId || "");
  const taskId = String(item.taskId || item.id || "");
  if (enrollmentId && taskId) return { enrollmentId, taskId };

  const utid = String(item.utid || item.id || "");
  if (utid.startsWith("task|")) {
    const parts = utid.split("|");
    if (parts.length >= 3) {
      return {
        enrollmentId: String(parts[1] || ""),
        taskId: String(parts[2] || ""),
      };
    }
  }

  const sourcePath = String(item.sourcePath || "");
  const match = sourcePath.match(/^customerEnrollments\/([^#\s]+)#taskSchedule:([^#\s]+)/);
  if (!match) return null;
  return {
    enrollmentId: String(match[1] || ""),
    taskId: String(match[2] || ""),
  };
}

function readTodoItems(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function todoStorageKey(item: Record<string, unknown>, taskRef: { enrollmentId: string; taskId: string } | null): string {
  if (taskRef?.enrollmentId && taskRef.taskId) {
    return `hdb_task_todo_${taskRef.enrollmentId}_${taskRef.taskId}`;
  }
  const fallback = String(item.utid || item.id || item.taskId || "task");
  return `hdb_task_todo_${fallback}`;
}

function readTodoItemsFromEnrollment(enrollment: unknown, defId: string): string[] {
  if (!enrollment || typeof enrollment !== "object" || !defId) return [];
  const meta = (enrollment as Record<string, unknown>).taskScheduleMeta;
  const defs = meta && typeof meta === "object" ? (meta as Record<string, unknown>).defs : null;
  if (!Array.isArray(defs)) return [];

  const match = defs.find((row) => {
    if (!row || typeof row !== "object") return false;
    return String((row as Record<string, unknown>).id || "").trim() === defId;
  });
  if (!match || typeof match !== "object") return [];

  const matchRow = match as Record<string, unknown>;
  return readTodoItems(matchRow.todoItems || matchRow.todo);
}

function TaskTodoChecklist({
  item,
  extras,
}: {
  item: Record<string, unknown>;
  extras?: InboxDetailExtras;
}) {
  const taskRef = React.useMemo(() => parseTaskRef(item), [item]);
  const enrollmentQ = useEnrollment(taskRef?.enrollmentId, {
    enabled: !!taskRef?.enrollmentId && !!String(item.defId || "").trim(),
  });
  const directTodoItems = React.useMemo(() => {
    const topLevel = readTodoItems(item.todoItems || item.todo);
    if (topLevel.length > 0) return topLevel;
    if (!item.meta || typeof item.meta !== "object") return [];
    const meta = item.meta as Record<string, unknown>;
    return readTodoItems(meta.todoItems || meta.todo);
  }, [item]);
  const todoItems = React.useMemo(() => {
    if (directTodoItems.length > 0) return directTodoItems;
    const defId = String(item.defId || "").trim();
    if (!defId) return [];
    return readTodoItemsFromEnrollment(enrollmentQ.data, defId);
  }, [directTodoItems, enrollmentQ.data, item.defId]);
  const closed = isInboxClosed(item.status) || tok(item.status) === "verified";
  const storageKey = React.useMemo(() => todoStorageKey(item, taskRef), [item, taskRef]);
  const [checkedIndexes, setCheckedIndexes] = React.useState<number[]>([]);
  const wasClosedRef = React.useRef(closed);

  React.useEffect(() => {
    if (!storageKey || todoItems.length === 0 || typeof window === "undefined") {
      setCheckedIndexes([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(parsed)
        ? parsed
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0 && value < todoItems.length)
        : [];
      setCheckedIndexes(next);
    } catch {
      setCheckedIndexes([]);
    }
  }, [storageKey, todoItems.length]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    if (closed) {
      const allIndexes = todoItems.map((_, index) => index);
      window.localStorage.setItem(storageKey, JSON.stringify(allIndexes));
      setCheckedIndexes(allIndexes);
    } else if (wasClosedRef.current && !closed) {
      window.localStorage.removeItem(storageKey);
      setCheckedIndexes([]);
    }
    wasClosedRef.current = closed;
  }, [closed, storageKey, todoItems]);

  if (todoItems.length === 0) return null;

  const checkedSet = new Set(closed ? todoItems.map((_, index) => index) : checkedIndexes);

  const toggleIndex = (index: number) => {
    if (closed || typeof window === "undefined") return;
    setCheckedIndexes((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(index)) nextSet.delete(index);
      else nextSet.add(index);
      const next = Array.from(nextSet).sort((a, b) => a - b);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      if (next.length === todoItems.length) {
        extras?.onAutoClose?.();
      }
      return next;
    });
  };

  return (
    <DetailSection title="Todo">
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs text-slate-600">
          Checking every item closes the task. Completing the task marks every item done in the UI.
        </div>
        {todoItems.map((todoItem, index) => {
          const checked = checkedSet.has(index);
          return (
            <label
              key={`${storageKey}_${index}`}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-slate-900"
                checked={checked}
                disabled={closed}
                onChange={() => toggleIndex(index)}
              />
              <span className={checked ? "line-through text-slate-500" : ""}>{todoItem}</span>
            </label>
          );
        })}
      </div>
    </DetailSection>
  );
}

/** Notes displayed as an editable-style text area (read-only display but looks like an input field). */
function NotesField({ value }: { value: string }) {
  const hasContent = !!value && value !== "-";
  return (
    <div
      className={`w-full rounded-md border px-3 py-2 text-sm min-h-[60px] whitespace-pre-wrap break-words ${
        hasContent
          ? "border-slate-300 bg-white text-slate-800"
          : "border-slate-200 bg-slate-50 text-slate-400 italic"
      }`}
    >
      {hasContent ? value : "No notes"}
    </div>
  );
}

export function TaskInboxSubtypeDetailCard({ item, actions, extras }: InboxDetailProps) {
  const subtype = getTaskSubtype(item);
  const waiting = waitingLabel(item);
  const notes = String(item?.note || item?.notes || item?.subtitle || "").trim() || "-";
  const reason =
    waiting ||
    (item?.managed === true || item?.defId
      ? "Generated from managed enrollment task definitions."
      : "Manual enrollment follow-up task.");

  return (
    <DetailCardShell title={subtypeTitle(subtype)} subtitle={String(item?.title || "") || null} actions={actions}>
      <DetailUniversalHeader item={item} />

      <DetailSection title="Task Info">
        <DetailRow label="Task Status" value={statusLabel(item)} />
        <DetailRow label="Task Type" value={subtypeTitle(subtype)} />
        <DetailRow label="Bucket" value={String(item?.bucket || "-")} />
      </DetailSection>

      <DetailSection title="Description">
        <DetailRow label="Reason" value={reason} />
        <DetailRow label="Task Description" value={String(item?.taskDescription || item?.description || "-")} />
        <div className="pt-1 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 px-2">Notes</div>
          <div className="px-2 space-y-2">
            <NotesField value={notes} />
            <NoteEditor onSave={extras?.onSaveNote} />
          </div>
        </div>
      </DetailSection>

      <TaskTodoChecklist item={item as Record<string, unknown>} extras={extras} />

      {(Boolean(item?.multiParentId) || Number(item?.multiStepCount || 0) > 1) && (
        <DetailSection title="Multiparty">
          <DetailRow label="Parent ID" value={String(item?.multiParentId || "-")} />
          <DetailRow label="Step" value={`${String(item?.multiStepIndex || "-")} / ${String(item?.multiStepCount || "-")}`} />
          <DetailRow label="Mode" value={String(item?.multiMode || "-")} />
          {waiting ? <DetailRow label="Workflow" value={waiting} /> : null}
        </DetailSection>
      )}

      {/* Task Meta — collapsed by default as advanced dropdown */}
      <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
          Task Meta
        </summary>
        <div className="mt-3 space-y-1.5">
          <DetailRow label="Managed" value={item?.managed === true ? "yes" : "no"} />
          <DetailRow label="Definition ID" value={String(item?.defId || "-")} />
          <DetailRow label="Notify" value={typeof item?.notify === "boolean" ? (item.notify ? "yes" : "no") : "-"} />
          <DetailRow label="Verified" value={item?.verified === true || tok(item?.status) === "verified" ? "yes" : "no"} />
        </div>
      </details>

      <DetailAdvancedView item={item} />
      <DetailQuickLinks item={item} />
    </DetailCardShell>
  );
}

export type { TaskSubtype, InboxDetailExtras };
export { NoteEditor };
