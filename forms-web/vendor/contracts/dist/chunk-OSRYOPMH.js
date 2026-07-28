import {
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/reconciliationAudit.ts
var reconciliationAudit_exports = {};
__export(reconciliationAudit_exports, {
  ReconciliationAuditDuplicateFinding: () => ReconciliationAuditDuplicateFinding,
  ReconciliationAuditEnrollmentSummary: () => ReconciliationAuditEnrollmentSummary,
  ReconciliationAuditOrphanFinding: () => ReconciliationAuditOrphanFinding,
  ReconciliationAuditScanBody: () => ReconciliationAuditScanBody
});
var ReconciliationAuditEnrollmentSummary = z.object({
  id: z.string(),
  status: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  paidCount: z.number().int().nonnegative(),
  paidTotal: z.number(),
  pendingQueueCount: z.number().int().nonnegative()
});
var ReconciliationAuditDuplicateFinding = z.object({
  type: z.literal("duplicate_enrollment_schedule"),
  severity: z.literal("error"),
  customerId: z.string(),
  customerName: z.string().nullable().optional(),
  grantId: z.string(),
  grantName: z.string().nullable().optional(),
  enrollments: z.array(ReconciliationAuditEnrollmentSummary).min(2)
});
var ReconciliationAuditOrphanFinding = z.object({
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
  rowIds: z.array(z.string())
});
var ReconciliationAuditScanBody = z.object({
  grantIds: z.array(z.string().min(1)).max(50).optional()
});

export {
  ReconciliationAuditEnrollmentSummary,
  ReconciliationAuditDuplicateFinding,
  ReconciliationAuditOrphanFinding,
  ReconciliationAuditScanBody,
  reconciliationAudit_exports
};
