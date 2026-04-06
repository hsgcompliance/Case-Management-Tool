//web/src/entities/dialogs/TasksGrantRegenDialog.tsx
"use client";

/**
 * Tasks Grant Regen Dialog — emitted payload (FULL request body)
 *
 * This dialog is grant-scoped and DOES include enrollment selection.
 * It returns a complete payload to the caller via `onConfirm(payload)`.
 *
 * Payload shape emitted by this dialog:
 * {
 *   enrollmentIds: string[];
 *   mode: "replaceManaged" | "mergeManaged";
 *   keepManual: boolean;
 *   preserveCompletedManaged: boolean;
 *   pinCompletedManaged: boolean;
 *   startDate?: ISODate | null; // only set when override enabled; otherwise omitted
 *   endDate?: ISODate | null;   // only set when override enabled; otherwise omitted
 * }
 */

import React from "react";
import { Modal } from "@entities/ui/Modal";
import type { ISODate } from "@types";

export type TasksGrantRegenAffected = {
  enrollmentId: string;
  clientName: string;
  startDate?: ISODate | null;
};

export type TasksGrantRegenPayload = {
  enrollmentIds: string[];
  mode: "replaceManaged" | "mergeManaged";
  keepManual: boolean;
  preserveCompletedManaged: boolean;
  pinCompletedManaged: boolean;
  startDate?: ISODate | null;
  endDate?: ISODate | null;
};

type Defaults = Partial<Omit<TasksGrantRegenPayload, "enrollmentIds">>;

type Props = {
  open: boolean;
  grantName: string;
  affected: TasksGrantRegenAffected[];
  onCancel: () => void;
  onConfirm: (payload: TasksGrantRegenPayload) => void;
  defaults?: Defaults;
};

export function TasksGrantRegenDialog({
  open,
  grantName,
  affected,
  onCancel,
  onConfirm,
  defaults,
}: Props) {
  const allIds = React.useMemo(
    () => (affected || []).map((a) => a.enrollmentId),
    [affected],
  );

  const [selected, setSelected] = React.useState<string[]>(allIds);

  const [mode, setMode] = React.useState<"replaceManaged" | "mergeManaged">(
    defaults?.mode ?? "replaceManaged",
  );
  const [keepManual, setKeepManual] = React.useState<boolean>(
    defaults?.keepManual ?? true,
  );
  const [preserveCompletedManaged, setPreserveCompletedManaged] =
    React.useState<boolean>(defaults?.preserveCompletedManaged ?? true);
  const [pinCompletedManaged, setPinCompletedManaged] = React.useState<boolean>(
    defaults?.pinCompletedManaged ?? true,
  );

  const [useOverrideStart, setUseOverrideStart] = React.useState<boolean>(
    !!defaults?.startDate,
  );
  const [startDate, setStartDate] = React.useState<ISODate | null>(
    (defaults?.startDate ?? null) as ISODate | null,
  );

  const [useOverrideEnd, setUseOverrideEnd] = React.useState<boolean>(
    !!defaults?.endDate,
  );
  const [endDate, setEndDate] = React.useState<ISODate | null>(
    (defaults?.endDate ?? null) as ISODate | null,
  );

  // Reset state on open (prevents stale state between openings)
  React.useEffect(() => {
    if (!open) return;

    setSelected(allIds);

    setMode(defaults?.mode ?? "replaceManaged");
    setKeepManual(defaults?.keepManual ?? true);
    setPreserveCompletedManaged(defaults?.preserveCompletedManaged ?? true);
    setPinCompletedManaged(defaults?.pinCompletedManaged ?? true);

    const dStart = (defaults?.startDate ?? null) as ISODate | null;
    const dEnd = (defaults?.endDate ?? null) as ISODate | null;

    setUseOverrideStart(!!dStart);
    setStartDate(dStart);

    setUseOverrideEnd(!!dEnd);
    setEndDate(dEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allIds.join(",")]);

  const toggle = (id: string) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const allSelected = selected.length === (affected?.length ?? 0) && (affected?.length ?? 0) > 0;
  const toggleAll = () => setSelected(allSelected ? [] : allIds);

  const invalidRange =
    !!useOverrideStart &&
    !!useOverrideEnd &&
    !!startDate &&
    !!endDate &&
    String(endDate) < String(startDate); // ISO yyyy-mm-dd lexical compare is safe

  const safeSummary = (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <div className="mb-0.5 font-medium">Quick tip</div>
      <div>
        Press <b>Regenerate</b> for safe defaults:
        <ul className="mt-1 list-disc pl-5">
          <li>
            <b>Replace managed</b> grant tasks
          </li>
          <li>
            <b>Keep manual</b> tasks
          </li>
          <li>
            <b>Carry status</b> on matches
          </li>
          <li>
            <b>Pin completed</b> items that vanish
          </li>
        </ul>
      </div>
    </div>
  );

  const confirmDisabled = selected.length === 0 || invalidRange;

  return (
    <Modal
      tourId="tasks-grant-regen-dialog"
      isOpen={open}
      title={`Regenerate tasks — ${grantName}`}
      onClose={onCancel}
      onBeforeClose={() => true}
      widthClass="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2" data-tour="tasks-grant-regen-dialog-actions">
          <button className="btn-secondary" onClick={onCancel} data-tour="tasks-grant-regen-dialog-cancel">
            Cancel
          </button>
          <button
            className="btn-primary disabled:opacity-50"
            disabled={confirmDisabled}
            title={
              selected.length === 0
                ? "Select at least one enrollment."
                : invalidRange
                ? "End date must be on/after the start date."
                : undefined
            }
            onClick={() =>
              onConfirm({
                enrollmentIds: selected,
                mode,
                keepManual,
                preserveCompletedManaged,
                pinCompletedManaged,
                startDate: useOverrideStart ? (startDate || null) : undefined,
                endDate: useOverrideEnd ? (endDate || null) : undefined,
              })
            }
            data-tour="tasks-grant-regen-dialog-confirm"
          >
            Regenerate ({selected.length})
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm" data-tour="tasks-grant-regen-dialog-content">
        <div className="text-slate-600" data-tour="tasks-grant-regen-dialog-summary">
          Affects <b>{affected.length}</b> enrollment{affected.length === 1 ? "" : "s"}.
        </div>

        {safeSummary}

        <details className="mt-1" data-tour="tasks-grant-regen-dialog-advanced">
          <summary className="cursor-pointer select-none font-medium text-slate-700" data-tour="tasks-grant-regen-dialog-advanced-toggle">
            Advanced settings
          </summary>

          <div className="mt-3 space-y-4">
            <div className="space-y-2">
              <div className="font-medium">Merge strategy</div>

              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  checked={mode === "replaceManaged"}
                  onChange={() => setMode("replaceManaged")}
                />
                <span>
                  <b>Replace managed</b> — drop prior grant-managed tasks; manual/foreign
                  tasks can be kept.
                </span>
              </label>

              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  checked={mode === "mergeManaged"}
                  onChange={() => setMode("mergeManaged")}
                />
                <span>
                  <b>Merge managed</b> — overlay managed by <code>id</code>, keep
                  everything else.
                </span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Options</div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keepManual}
                  onChange={(e) => setKeepManual(e.currentTarget.checked)}
                />
                <span>Keep manual/non-grant tasks</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preserveCompletedManaged}
                  onChange={(e) => setPreserveCompletedManaged(e.currentTarget.checked)}
                />
                <span>Carry status forward for matching tasks</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pinCompletedManaged}
                  onChange={(e) => setPinCompletedManaged(e.currentTarget.checked)}
                />
                <span>Pin previously completed tasks if they vanish</span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Start date override (optional)</div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useOverrideStart}
                  onChange={(e) => setUseOverrideStart(e.currentTarget.checked)}
                />
                <span>Use this start date for all selected</span>
              </label>

              <input
                type="date"
                className="w-full rounded border px-2 py-1 disabled:opacity-50"
                disabled={!useOverrideStart}
                value={startDate ?? ""}
                max={useOverrideEnd && endDate ? endDate : undefined}
                onChange={(e) => setStartDate((e.currentTarget.value || null) as ISODate | null)}
              />

              {!useOverrideStart && (
                <div className="text-xs text-slate-500">
                  If unset, each enrollment’s own <code>startDate</code> is used.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="font-medium">End date horizon (optional)</div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useOverrideEnd}
                  onChange={(e) => setUseOverrideEnd(e.currentTarget.checked)}
                />
                <span>Stop generating tasks after this date</span>
              </label>

              <input
                type="date"
                className="w-full rounded border px-2 py-1 disabled:opacity-50"
                disabled={!useOverrideEnd}
                value={endDate ?? ""}
                min={useOverrideStart && startDate ? startDate : undefined}
                onChange={(e) => setEndDate((e.currentTarget.value || null) as ISODate | null)}
              />

              {!useOverrideEnd && (
                <div className="text-xs text-slate-500">
                  If unset, the server will use its default horizon (currently 1 year).
                </div>
              )}

              {invalidRange && (
                <div className="text-xs text-red-600">
                  End date must be on/after the start date.
                </div>
              )}
            </div>
          </div>
        </details>

        <div className="rounded border" data-tour="tasks-grant-regen-dialog-affected">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2" data-tour="tasks-grant-regen-dialog-affected-header">
            <div className="text-sm font-medium text-slate-700">Affected customers</div>
            <button className="rounded border px-2 py-1 text-xs" onClick={toggleAll} data-tour="tasks-grant-regen-dialog-toggle-all">
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          <div className="max-h-56 divide-y overflow-auto" data-tour="tasks-grant-regen-dialog-affected-list">
            {affected.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500" data-tour="tasks-grant-regen-dialog-affected-empty">No active enrollments.</div>
            ) : (
              affected.map((a) => (
                <label
                  key={a.enrollmentId}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                  data-tour={`tasks-grant-regen-dialog-affected-row-${a.enrollmentId}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(a.enrollmentId)}
                    onChange={() => toggle(a.enrollmentId)}
                    data-tour={`tasks-grant-regen-dialog-affected-row-${a.enrollmentId}-input`}
                  />
                  <span className="truncate">
                    {a.clientName || a.enrollmentId}
                    {a.startDate ? (
                      <span className="text-slate-500"> — start {a.startDate}</span>
                    ) : null}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default TasksGrantRegenDialog;
