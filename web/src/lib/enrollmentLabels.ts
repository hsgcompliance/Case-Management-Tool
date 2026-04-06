"use client";

import { fmtDateOrDash } from "@lib/formatters";

type EnrollmentLabelInput = {
  id?: unknown;
  name?: unknown;
  grantName?: unknown;
  grantId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

export function formatEnrollmentLabel(
  enrollment: EnrollmentLabelInput | null | undefined,
  opts?: { fallback?: string },
): string {
  const enrollmentName = String(enrollment?.name || "").trim();
  const grantName = String(enrollment?.grantName || "").trim();
  const grantId = String(enrollment?.grantId || "").trim();
  // Prefer grantName to avoid double-date: enrollment.name is pre-composed as "grantName - startDate"
  const grant = grantName || enrollmentName || grantId || "";
  const startRaw = enrollment?.startDate;
  const endRaw = enrollment?.endDate;
  const start = startRaw ? fmtDateOrDash(startRaw) : "";
  const end = endRaw ? fmtDateOrDash(endRaw) : "";

  if (grant && start && end) return `${grant}: ${start} – ${end}`;
  if (grant && start) return `${grant} - ${start}`;
  if (grant) return grant;
  if (start && end) return `Enrollment: ${start} – ${end}`;
  if (start) return `Enrollment - ${start}`;

  const id = String(enrollment?.id || "").trim();
  return opts?.fallback || id || "Enrollment";
}
