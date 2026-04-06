//web/src/entities/dialogs/TasksRegenDialog.tsx
"use client";

/**
 * Tasks Regen Dialog — emitted payload (options only)
 *
 * This dialog DOES NOT know which enrollments are selected.
 * It only returns the options object to the caller via `onConfirm(opts)`.
 *
 * Caller typically builds the actual request body by combining:
 *   - enrollmentIds: string[]   (the selected enrollment IDs)
 *   - ...opts                  (everything this dialog returns)
 *
 * Options shape emitted by this dialog:
 * {
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

export type TasksRegenOptions = {
  mode: "replaceManaged" | "mergeManaged";
  keepManual: boolean;
  preserveCompletedManaged: boolean;
  pinCompletedManaged: boolean;
  startDate?: ISODate | null;
  endDate?: ISODate | null;
};

type Defaults = Partial<TasksRegenOptions>;

type Props = {
  open: boolean;
  selectedCount: number;
  onCancel: () => void;
  onConfirm: (opts: TasksRegenOptions) => void;
  defaults?: Defaults;
};

export function TasksRegenDialog({
  open,
  selectedCount,
  onCancel,
  onConfirm,
  defaults,
}: Props) {
  const [mode, setMode] = React.useState<TasksRegenOptions["mode"]>(
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

  // Keep state in sync when the dialog opens (prevents stale defaults across openings)
  React.useEffect(() => {
    if (!open) return;

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
  }, [open]);

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
        Press <b>Regenerate</b> to use safe defaults:
        <ul className="mt-1 list-disc pl-5">
          <li>
            <b>Replace managed</b> (only grant-managed tasks are refreshed)
          </li>
          <li>
            <b>Keep manual tasks</b> (anything you added by hand is preserved)
          </li>
          <li>
            <b>Carry status</b> (completed/verified/notes stay intact)
          </li>
          <li>
            <b>Pin completed</b> (past completions remain visible even if a def changed)
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <Modal
      tourId="tasks-regen-dialog"
      isOpen={open}
      title="Regenerate Tasks"
      onClose={onCancel}
      onBeforeClose={() => true}
      widthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2" data-tour="tasks-regen-dialog-actions">
          <button className="btn-secondary" onClick={onCancel} data-tour="tasks-regen-dialog-cancel">
            Cancel
          </button>
          <button
            className="btn-primary disabled:opacity-50"
            disabled={invalidRange}
            title={invalidRange ? "End date must be on/after the start date." : undefined}
            onClick={() =>
              onConfirm({
                mode,
                keepManual,
                preserveCompletedManaged,
                pinCompletedManaged,
                startDate: useOverrideStart ? (startDate || null) : undefined,
                endDate: useOverrideEnd ? (endDate || null) : undefined,
              })
            }
            data-tour="tasks-regen-dialog-confirm"
          >
            Regenerate
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm" data-tour="tasks-regen-dialog-content">
        <div className="text-slate-600" data-tour="tasks-regen-dialog-summary">
          This will regenerate managed tasks for <b>{selectedCount}</b>{" "}
          enrollment{selectedCount === 1 ? "" : "s"}.
        </div>

        {safeSummary}

        <details className="mt-1" data-tour="tasks-regen-dialog-advanced">
          <summary className="cursor-pointer select-none font-medium text-slate-700" data-tour="tasks-regen-dialog-advanced-toggle">
            Advanced settings
          </summary>

          <div className="mt-3 space-y-4" data-tour="tasks-regen-dialog-advanced-body">
            <div className="space-y-2" data-tour="tasks-regen-dialog-merge-strategy">
              <div className="font-medium">Merge strategy</div>

              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  checked={mode === "replaceManaged"}
                  onChange={() => setMode("replaceManaged")}
                  data-tour="tasks-regen-dialog-mode-replace"
                />
                <span>
                  <b>Replace managed</b> — drop previous <i>grant-managed</i> tasks and
                  write new ones; manual/foreign tasks stay if enabled.
                  <div className="text-xs text-slate-500">
                    Safest for aligning with current grant definitions.
                  </div>
                </span>
              </label>

              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  checked={mode === "mergeManaged"}
                  onChange={() => setMode("mergeManaged")}
                  data-tour="tasks-regen-dialog-mode-merge"
                />
                <span>
                  <b>Merge managed</b> — keep everything and overlay new managed tasks by{" "}
                  <code>id</code>.
                  <div className="text-xs text-slate-500">
                    Use when you want to retain prior managed items even if defs changed.
                  </div>
                </span>
              </label>
            </div>

            <div className="space-y-2" data-tour="tasks-regen-dialog-options">
              <div className="font-medium">Options</div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keepManual}
                  onChange={(e) => setKeepManual(e.currentTarget.checked)}
                  data-tour="tasks-regen-dialog-keep-manual"
                />
                <span>Keep manual/non-grant tasks</span>
              </label>
              <div className="ml-6 text-xs text-slate-500">
                Ensures any tasks you added manually are not removed.
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preserveCompletedManaged}
                  onChange={(e) => setPreserveCompletedManaged(e.currentTarget.checked)}
                  data-tour="tasks-regen-dialog-preserve-completed"
                />
                <span>Carry status forward for matching tasks</span>
              </label>
              <div className="ml-6 text-xs text-slate-500">
                Matches by <code>id</code> or <code>defId|dueDate</code> to preserve
                completed/verified/byUid/notes.
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pinCompletedManaged}
                  onChange={(e) => setPinCompletedManaged(e.currentTarget.checked)}
                  data-tour="tasks-regen-dialog-pin-completed"
                />
                <span>Pin previously completed managed tasks if they vanish</span>
              </label>
              <div className="ml-6 text-xs text-slate-500">
                Keeps historical completions even when a definition change would otherwise
                remove them.
              </div>
            </div>

            <div className="space-y-2" data-tour="tasks-regen-dialog-start-override">
              <div className="font-medium">Start date override (optional)</div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useOverrideStart}
                  onChange={(e) => setUseOverrideStart(e.currentTarget.checked)}
                  data-tour="tasks-regen-dialog-use-start-override"
                />
                <span>Use this start date for all selected enrollments</span>
              </label>
              <input
                type="date"
                className="w-full rounded border px-2 py-1 disabled:opacity-50"
                disabled={!useOverrideStart}
                value={startDate ?? ""}
                max={useOverrideEnd && endDate ? endDate : undefined}
                onChange={(e) => setStartDate((e.currentTarget.value || null) as ISODate | null)}
                data-tour="tasks-regen-dialog-start-date-input"
              />
              {!useOverrideStart && (
                <div className="text-xs text-slate-500">
                  If not set, the server uses each enrollment’s own <code>startDate</code>.
                </div>
              )}
            </div>

            <div className="space-y-2" data-tour="tasks-regen-dialog-end-override">
              <div className="font-medium">End date horizon (optional)</div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useOverrideEnd}
                  onChange={(e) => setUseOverrideEnd(e.currentTarget.checked)}
                  data-tour="tasks-regen-dialog-use-end-override"
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
                data-tour="tasks-regen-dialog-end-date-input"
              />
              {!useOverrideEnd && (
                <div className="text-xs text-slate-500">
                  If unset, the server will use its default horizon (currently 1 year).
                </div>
              )}
              {invalidRange && (
                <div className="text-xs text-red-600" data-tour="tasks-regen-dialog-range-error">
                  End date must be on/after the start date.
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </Modal>
  );
}

export default TasksRegenDialog;
