import { z } from "./core.js";
import type { Ok } from "./http.js";
export declare const ReconciliationAuditEnrollmentSummary: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paidCount: z.ZodNumber;
    paidTotal: z.ZodNumber;
    pendingQueueCount: z.ZodNumber;
}, z.core.$strip>;
export type TReconciliationAuditEnrollmentSummary = z.infer<typeof ReconciliationAuditEnrollmentSummary>;
export declare const ReconciliationAuditDuplicateFinding: z.ZodObject<{
    type: z.ZodLiteral<"duplicate_enrollment_schedule">;
    severity: z.ZodLiteral<"error">;
    customerId: z.ZodString;
    customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodString;
    grantName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paidCount: z.ZodNumber;
        paidTotal: z.ZodNumber;
        pendingQueueCount: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TReconciliationAuditDuplicateFinding = z.infer<typeof ReconciliationAuditDuplicateFinding>;
export declare const ReconciliationAuditOrphanFinding: z.ZodObject<{
    type: z.ZodLiteral<"orphaned_ledger_or_queue">;
    severity: z.ZodLiteral<"error">;
    source: z.ZodEnum<{
        ledger: "ledger";
        paymentQueue: "paymentQueue";
    }>;
    enrollmentId: z.ZodString;
    enrollmentStatus: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    netAmount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    queueStatus: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rowIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type TReconciliationAuditOrphanFinding = z.infer<typeof ReconciliationAuditOrphanFinding>;
export declare const ReconciliationAuditScanBody: z.ZodObject<{
    grantIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type TReconciliationAuditScanBody = z.infer<typeof ReconciliationAuditScanBody>;
export type TReconciliationAuditScanResp = Ok<{
    scannedAt: string;
    enrollmentsScanned: number;
    duplicateFindings: TReconciliationAuditDuplicateFinding[];
    orphanFindings: TReconciliationAuditOrphanFinding[];
}>;
