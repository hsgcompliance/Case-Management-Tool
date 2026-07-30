"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { fmtDateOrDash } from "@lib/formatters";
import type { PriorEnrollment } from "./priorEnrollmentDecision";

export {
  isInactivePriorEnrollment,
  isReopenablePriorEnrollment,
  requiresPriorEnrollmentDecision,
  toOpenClosedStatus,
} from "./priorEnrollmentDecision";
export type { PriorEnrollment } from "./priorEnrollmentDecision";

export function PriorEnrollmentDecisionDialog({
  open,
  priorEnrollments,
  reopening = false,
  creating = false,
  onClose,
  onReopen,
  onCreateNew,
}: {
  open: boolean;
  priorEnrollments: PriorEnrollment[];
  reopening?: boolean;
  creating?: boolean;
  onClose: () => void;
  onReopen: (enrollment: PriorEnrollment) => void;
  onCreateNew: () => void;
}) {
  const busy = reopening || creating;

  return (
    <Modal
      isOpen={open}
      title="Prior Enrollment Found"
      onClose={onClose}
      widthClass="max-w-md"
      draggable={false}
      disableOverlayClose={busy}
      disableEscClose={busy}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCreateNew} disabled={busy}>
            {creating ? "Creating…" : "Create New Enrollment"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-slate-600 dark:text-slate-300">
          Choose whether to reopen a prior enrollment or create a separate assistance episode. No new
          enrollment will be created until you select an option.
        </p>
        <div className="space-y-2">
          {priorEnrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30"
            >
              <div className="min-w-0 text-xs text-sky-950 dark:text-sky-100">
                <div className="truncate font-semibold">
                  {formatEnrollmentLabel(enrollment as unknown as Record<string, unknown>)}
                </div>
                <div className="mt-0.5 text-sky-700 dark:text-sky-300">
                  {fmtDateOrDash(enrollment.startDate)}–{enrollment.endDate ? fmtDateOrDash(enrollment.endDate) : "open"}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm shrink-0"
                disabled={busy}
                onClick={() => onReopen(enrollment)}
              >
                {reopening ? "Reopening…" : "Reopen"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Shared "this customer already has closed enrollment(s) for this grant" nudge.
 * Steers operators toward reopening an existing enrollment instead of creating a duplicate.
 * "banner" is the full call-to-action form (enroll flows); "badge" is a compact
 * read-only indicator for table/row contexts (e.g. bulk enroll) with no reopen action.
 */
export function PriorEnrollmentNudge({
  variant = "banner",
  priorEnrollments,
  onReopen,
  reopening = false,
}: {
  variant?: "banner" | "badge";
  priorEnrollments: PriorEnrollment[];
  onReopen?: (enrollment: PriorEnrollment) => void;
  reopening?: boolean;
}) {
  if (!priorEnrollments.length) return null;

  if (variant === "badge") {
    return (
      <span
        className="inline-block rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200"
        title="Customer has a prior closed enrollment for this grant — consider reopening instead of enrolling again."
      >
        {priorEnrollments.length} prior closed enrollment{priorEnrollments.length === 1 ? "" : "s"}
      </span>
    );
  }

  return (
    <div className="mt-2 space-y-1 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
      <div className="font-semibold">
        This customer has {priorEnrollments.length} prior enrollment{priorEnrollments.length === 1 ? "" : "s"} in this grant:
      </div>
      {priorEnrollments.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {formatEnrollmentLabel(e as unknown as Record<string, unknown>)} — {String(e.status || "closed").trim()} · {fmtDateOrDash(e.startDate)}–{e.endDate ? fmtDateOrDash(e.endDate) : "open"}
          </span>
          {onReopen ? (
            <button
              type="button"
              className="btn-ghost btn-xs"
              disabled={reopening}
              onClick={() => onReopen(e)}
            >
              Reopen this one instead
            </button>
          ) : null}
        </div>
      ))}
      <div className="text-[11px] text-sky-700 dark:text-sky-300">
        Creating a new enrollment is fine for a separate assistance episode (e.g. a second crisis this
        grant year) — just make sure the payment schedules don&apos;t cover the same months.
      </div>
    </div>
  );
}
