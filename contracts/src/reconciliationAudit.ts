// contracts/src/reconciliationAudit.ts
//
// Standalone, read-only reconciliation audit scan — Phase 3 of
// docs/active-projects.local/report-reconciliation-workbench/TOOL_ARCHITECTURE_AND_ROADMAP.md.
// Finds duplicate-enrollment schedules and orphaned ledger/paymentQueue rows
// left behind by deleted/closed enrollments, org-wide, without requiring any
// uploaded report. See schedule-drift-reconciliation-tool.md §6.
import { z } from "./core";
import type { Ok } from "./http";

export const ReconciliationAuditEnrollmentSummary = z.object({
  id: z.string(),
  status: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  paidCount: z.number().int().nonnegative(),
  paidTotal: z.number(),
  pendingQueueCount: z.number().int().nonnegative(),
});
export type TReconciliationAuditEnrollmentSummary = z.infer<typeof ReconciliationAuditEnrollmentSummary>;

export const ReconciliationAuditDuplicateFinding = z.object({
  type: z.literal("duplicate_enrollment_schedule"),
  severity: z.literal("error"),
  customerId: z.string(),
  customerName: z.string().nullable().optional(),
  grantId: z.string(),
  grantName: z.string().nullable().optional(),
  enrollments: z.array(ReconciliationAuditEnrollmentSummary).min(2),
});
export type TReconciliationAuditDuplicateFinding = z.infer<typeof ReconciliationAuditDuplicateFinding>;

export const ReconciliationAuditOrphanFinding = z.object({
  type: z.literal("orphaned_ledger_or_queue"),
  severity: z.literal("error"),
  source: z.enum(["ledger", "paymentQueue"]),
  enrollmentId: z.string(),
  enrollmentStatus: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  grantId: z.string().nullable().optional(),
  grantName: z.string().nullable().optional(),
  paymentId: z.string().nullable().optional(),
  netAmount: z.number().nullable().optional(),
  queueStatus: z.string().nullable().optional(),
  rowIds: z.array(z.string()),
});
export type TReconciliationAuditOrphanFinding = z.infer<typeof ReconciliationAuditOrphanFinding>;

export const ReconciliationAuditScanBody = z.object({
  grantIds: z.array(z.string().min(1)).max(50).optional(),
});
export type TReconciliationAuditScanBody = z.infer<typeof ReconciliationAuditScanBody>;

export type TReconciliationAuditScanResp = Ok<{
  scannedAt: string;
  enrollmentsScanned: number;
  duplicateFindings: TReconciliationAuditDuplicateFinding[];
  orphanFindings: TReconciliationAuditOrphanFinding[];
}>;
