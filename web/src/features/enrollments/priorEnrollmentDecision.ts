import type { Enrollment } from "@client/enrollments";

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

export function isReopenablePriorEnrollment(row: PriorEnrollment): boolean {
  return isInactivePriorEnrollment(row) && String(row.status || "").trim().toLowerCase() !== "deleted";
}

export function requiresPriorEnrollmentDecision(priorEnrollments: PriorEnrollment[]): boolean {
  return priorEnrollments.some(isReopenablePriorEnrollment);
}
