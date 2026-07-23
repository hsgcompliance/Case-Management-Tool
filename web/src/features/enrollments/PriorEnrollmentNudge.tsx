"use client";

import React from "react";
import type { Enrollment } from "@client/enrollments";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { fmtDateOrDash } from "@lib/formatters";

/** Prior enrollment eligible for the reopen nudge — must be closed/deleted, not active. */
export type PriorEnrollment = Pick<Enrollment, "id" | "status" | "active" | "startDate" | "endDate">;

export function toOpenClosedStatus(row: PriorEnrollment): "open" | "closed" {
  const status = String(row.status || "").toLowerCase();
  if (status === "closed" || status === "deleted") return "closed";
  if (typeof row.active === "boolean") return row.active ? "open" : "closed";
  return "open";
}

export function isInactivePriorEnrollment(row: PriorEnrollment): boolean {
  return toOpenClosedStatus(row) === "closed";
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
