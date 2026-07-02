import { z } from "./core.js";
/**
 * A single free-form compliance checklist item.
 * Use `key` as a stable machine identifier (e.g. "hmis", "w9_received").
 * `label` is the human-readable display string shown in the UI.
 */
export declare const ComplianceCheckItem: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    done: z.ZodDefault<z.ZodBoolean>;
    doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type TComplianceCheckItem = z.infer<typeof ComplianceCheckItem>;
/**
 * Flexible compliance checklist attached to a payment.
 * `hmisComplete` / `caseworthyComplete` are the canonical built-in compliance flags read by
 * inbox triggers and the UI. They must stay as first-class boolean fields so that all existing
 * read paths (triggers.ts, inboxCards.tsx, CustomerPaymentsTable.tsx) continue to work.
 * `items` is an optional free-form list for additional custom checklist steps.
 * `status` is a free-form status string (e.g. "approved", "pending", "hold").
 * `note` is a free-form note.
 */
export declare const PaymentCompliance: z.ZodObject<{
    hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        done: z.ZodDefault<z.ZodBoolean>;
        doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
/**
 * Rent cert lifecycle status on a payment. The due date is always the month
 * prior to the effective (payment) date, so it is derived, never entered.
 * "not due" is represented by the absence of a rentCert object (null).
 */
export declare const RentCertStatus: z.ZodEnum<{
    completed: "completed";
    due: "due";
    effective: "effective";
}>;
export type TRentCertStatus = z.infer<typeof RentCertStatus>;
export declare const PaymentRentCert: z.ZodObject<{
    dueDate: z.ZodString;
    targetPaymentDate: z.ZodString;
    source: z.ZodDefault<z.ZodEnum<{
        manual: "manual";
        calculated: "calculated";
    }>>;
    taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<{
        completed: "completed";
        due: "due";
        effective: "effective";
    }>>;
}, z.core.$loose>;
export type TPaymentRentCert = z.infer<typeof PaymentRentCert>;
/**
 * Scheduled/actual payment row stored on an enrollment.
 * NOTE: id is optional because some inbound operations accept "schedule rows" without ids.
 */
export declare const Payment: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        monthly: "monthly";
        deposit: "deposit";
        prorated: "prorated";
        service: "service";
        arrears: "arrears";
    }>;
    amount: z.ZodCoercedNumber<unknown>;
    dueDate: z.ZodPreprocess<z.ZodString>;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    void: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notifyCM: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            done: z.ZodDefault<z.ZodBoolean>;
            doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        dueDate: z.ZodString;
        targetPaymentDate: z.ZodString;
        source: z.ZodDefault<z.ZodEnum<{
            manual: "manual";
            calculated: "calculated";
        }>>;
        taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        status: z.ZodDefault<z.ZodEnum<{
            completed: "completed";
            due: "due";
            effective: "effective";
        }>>;
    }, z.core.$loose>>>;
}, z.core.$strip>;
export type TPaymentCompliance = z.infer<typeof PaymentCompliance>;
export type TPayment = z.infer<typeof Payment>;
/**
 * Output/payment entity shape (responses + stored canonical schedule rows).
 * Use this for endpoint responses that should always include an id.
 */
export declare const PaymentEntity: z.ZodObject<{
    type: z.ZodEnum<{
        monthly: "monthly";
        deposit: "deposit";
        prorated: "prorated";
        service: "service";
        arrears: "arrears";
    }>;
    amount: z.ZodCoercedNumber<unknown>;
    dueDate: z.ZodPreprocess<z.ZodString>;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    void: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notifyCM: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            done: z.ZodDefault<z.ZodBoolean>;
            doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        dueDate: z.ZodString;
        targetPaymentDate: z.ZodString;
        source: z.ZodDefault<z.ZodEnum<{
            manual: "manual";
            calculated: "calculated";
        }>>;
        taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        status: z.ZodDefault<z.ZodEnum<{
            completed: "completed";
            due: "due";
            effective: "effective";
        }>>;
    }, z.core.$loose>>>;
    id: z.ZodString;
}, z.core.$strip>;
export type TPaymentEntity = z.infer<typeof PaymentEntity>;
/**
 * Spend entries stored under an enrollment (NOT the global ledger).
 * Back-compat: existing fields remain required where they were before.
 * Future-ready: optional metadata added for cross-linking / migration.
 */
export declare const SpendSource: z.ZodEnum<{
    manual: "manual";
    enrollment: "enrollment";
    org: "org";
    card: "card";
}>;
/** Atomic enrollment spend emitted when a payment is marked paid (or reversed). */
export declare const Spend: z.ZodObject<{
    id: z.ZodString;
    paymentId: z.ZodString;
    lineItemId: z.ZodNullable<z.ZodString>;
    amount: z.ZodCoercedNumber<unknown>;
    source: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        enrollment: "enrollment";
        org: "org";
        card: "card";
    }>>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodEnum<{
        voided: "voided";
        paid: "paid";
        unpaid: "unpaid";
    }>, z.ZodString]>>>;
    voidedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    reversed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    reversedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    reversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amountCents: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    ts: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    by: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        uid: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$strip>>>;
    byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    byName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    migratedFromSpendId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    migratedReversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItemLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    date: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    paymentSnapshot: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
        type: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>>>>;
        lineItemId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        dueDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>>;
        dueMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>>;
        vendor: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        comment: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type TSpend = z.infer<typeof Spend>;
export type TSpendSource = z.infer<typeof SpendSource>;
export declare const PaymentsGenerateProjectionsBody: z.ZodObject<{
    startDate: z.ZodPreprocess<z.ZodString>;
    months: z.ZodCoercedNumber<unknown>;
    monthlyAmount: z.ZodCoercedNumber<unknown>;
    deposit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type TPaymentsGenerateProjectionsBody = z.infer<typeof PaymentsGenerateProjectionsBody>;
export declare const PaymentsRecalculateFutureSingleReq: z.ZodObject<{
    enrollmentId: z.ZodString;
    newMonthlyAmount: z.ZodCoercedNumber<unknown>;
    projectionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    lineItemId: z.ZodOptional<z.ZodString>;
    effectiveFrom: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const PaymentsRecalculateFutureGrantReq: z.ZodObject<{
    grantId: z.ZodString;
    newMonthlyAmount: z.ZodCoercedNumber<unknown>;
    lineItemId: z.ZodOptional<z.ZodString>;
    effectiveFrom: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const PaymentsRecalculateFutureReq: z.ZodUnion<readonly [z.ZodObject<{
    enrollmentId: z.ZodString;
    newMonthlyAmount: z.ZodCoercedNumber<unknown>;
    projectionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    lineItemId: z.ZodOptional<z.ZodString>;
    effectiveFrom: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    grantId: z.ZodString;
    newMonthlyAmount: z.ZodCoercedNumber<unknown>;
    lineItemId: z.ZodOptional<z.ZodString>;
    effectiveFrom: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>]>;
export type TPaymentsRecalculateFutureSingleReq = z.infer<typeof PaymentsRecalculateFutureSingleReq>;
export type TPaymentsRecalculateFutureGrantReq = z.infer<typeof PaymentsRecalculateFutureGrantReq>;
export type TPaymentsRecalculateFutureReq = z.infer<typeof PaymentsRecalculateFutureReq>;
export declare const PaymentsRecalcGrantProjectedBody: z.ZodObject<{
    grantId: z.ZodString;
    effectiveFrom: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    activeOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    source: z.ZodDefault<z.ZodOptional<z.ZodLiteral<1>>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type TPaymentsRecalcGrantProjectedBody = z.infer<typeof PaymentsRecalcGrantProjectedBody>;
export declare const PaymentsAdjustSpendBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    spendId: z.ZodOptional<z.ZodString>;
    paymentId: z.ZodOptional<z.ZodString>;
    patch: z.ZodDefault<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodOptional<z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>>;
        lineItemId: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
        note: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        vendor: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
        comment: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
    }, z.core.$strip>>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TPaymentsAdjustSpendBody = z.infer<typeof PaymentsAdjustSpendBody>;
export declare const PaymentProjectionInput: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        monthly: "monthly";
        deposit: "deposit";
        prorated: "prorated";
        service: "service";
        arrears: "arrears";
    }>;
    amount: z.ZodCoercedNumber<unknown>;
    lineItemId: z.ZodString;
    dueDate: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    date: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            done: z.ZodDefault<z.ZodBoolean>;
            doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        dueDate: z.ZodString;
        targetPaymentDate: z.ZodString;
        source: z.ZodDefault<z.ZodEnum<{
            manual: "manual";
            calculated: "calculated";
        }>>;
        taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        status: z.ZodDefault<z.ZodEnum<{
            completed: "completed";
            due: "due";
            effective: "effective";
        }>>;
    }, z.core.$loose>>>;
}, z.core.$strip>;
export type TPaymentProjectionInput = z.infer<typeof PaymentProjectionInput>;
export declare const PaymentsAdjustProjectionsBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    payments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>;
        amount: z.ZodCoercedNumber<unknown>;
        lineItemId: z.ZodString;
        dueDate: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
        date: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                done: z.ZodDefault<z.ZodBoolean>;
                doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dueDate: z.ZodString;
            targetPaymentDate: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<{
                manual: "manual";
                calculated: "calculated";
            }>>;
            taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                completed: "completed";
                due: "due";
                effective: "effective";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$strip>>>;
    replaceUnpaid: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type TPaymentsAdjustProjectionsBody = z.infer<typeof PaymentsAdjustProjectionsBody>;
/**
 * Copy a source enrollment's payment schedule template to many target enrollments.
 * Matches handler behavior (defaults included).
 */
export declare const PaymentsBulkCopyScheduleBody: z.ZodObject<{
    sourceEnrollmentId: z.ZodString;
    targetEnrollmentIds: z.ZodArray<z.ZodString>;
    mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        replace: "replace";
        merge: "merge";
    }>>>;
    includeTypes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    anchorByStartDate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type TPaymentsBulkCopyScheduleBody = z.infer<typeof PaymentsBulkCopyScheduleBody>;
/**
 * Book a spend (or reversal) against a payment.
 * Matches handler behavior (defaults included).
 */
export declare const PaymentsSpendBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    paymentId: z.ZodString;
    note: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    reverse: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    forceSync: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    vendor: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TPaymentsSpendBody = z.infer<typeof PaymentsSpendBody>;
export declare const PaymentCompliancePatch: z.ZodObject<{
    hmisComplete: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;
    caseworthyComplete: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;
    items: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        done: z.ZodDefault<z.ZodBoolean>;
        doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
export type TPaymentCompliancePatch = z.infer<typeof PaymentCompliancePatch>;
/**
 * Patch payment.compliance fields on a single payment within an enrollment.
 * Matches /paymentsUpdateCompliance handler.
 */
export declare const PaymentsUpdateComplianceBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    paymentId: z.ZodString;
    patch: z.ZodObject<{
        hmisComplete: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;
        caseworthyComplete: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;
        items: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            done: z.ZodDefault<z.ZodBoolean>;
            doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
/**
 * Toggle the rent cert state on a payment. "notDue" clears it; the other
 * states set it with a server-derived due date (month prior to the payment
 * date). `dueDate` is retained for backward compatibility: when `status` is
 * omitted, a present dueDate sets "due" and a null dueDate clears.
 */
export declare const RentCertToggle: z.ZodEnum<{
    completed: "completed";
    due: "due";
    effective: "effective";
    notDue: "notDue";
}>;
export type TRentCertToggle = z.infer<typeof RentCertToggle>;
export declare const PaymentsRentCertSetBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    paymentId: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        completed: "completed";
        due: "due";
        effective: "effective";
        notDue: "notDue";
    }>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
}, z.core.$strip>;
export type TPaymentsRentCertSetBody = z.infer<typeof PaymentsRentCertSetBody>;
export type TPaymentsUpdateComplianceBody = z.infer<typeof PaymentsUpdateComplianceBody>;
export declare const PaymentsDeleteRowsBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    paymentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    deleteAll: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    preservePaid: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    updateBudgets: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    removeSpends: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    reverseLedger: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type TPaymentsDeleteRowsBody = z.infer<typeof PaymentsDeleteRowsBody>;
/**
 * Thin alias to /paymentsRecalcGrantProjected.
 * Keep separate name to prevent route drift while reusing the same shape.
 */
export declare const PaymentsUpdateGrantBudgetBody: z.ZodObject<{
    grantId: z.ZodString;
    effectiveFrom: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    activeOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    source: z.ZodDefault<z.ZodOptional<z.ZodLiteral<1>>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type TPaymentsUpdateGrantBudgetBody = TPaymentsRecalcGrantProjectedBody;
/**
 * Deterministic upsert of enrollment projections.
 * Accepts schedule rows (allows legacy `date` OR `dueDate` via PaymentProjectionInput).
 */
export declare const PaymentsUpsertProjectionsBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    payments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>;
        amount: z.ZodCoercedNumber<unknown>;
        lineItemId: z.ZodString;
        dueDate: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
        date: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                done: z.ZodDefault<z.ZodBoolean>;
                doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dueDate: z.ZodString;
            targetPaymentDate: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<{
                manual: "manual";
                calculated: "calculated";
            }>>;
            taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                completed: "completed";
                due: "due";
                effective: "effective";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type TPaymentsUpsertProjectionsBody = z.infer<typeof PaymentsUpsertProjectionsBody>;
export declare const PaymentsRecalculateFutureResp: z.ZodUnion<readonly [z.ZodObject<{
    mode: z.ZodLiteral<"single">;
    fromISO: z.ZodPreprocess<z.ZodString>;
    dryRun: z.ZodBoolean;
    id: z.ZodString;
    payments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>;
        amount: z.ZodCoercedNumber<unknown>;
        dueDate: z.ZodPreprocess<z.ZodString>;
        lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        void: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notifyCM: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                done: z.ZodDefault<z.ZodBoolean>;
                doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dueDate: z.ZodString;
            targetPaymentDate: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<{
                manual: "manual";
                calculated: "calculated";
            }>>;
            taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                completed: "completed";
                due: "due";
                effective: "effective";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$strip>>>;
    deltaByLI: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    noChange: z.ZodOptional<z.ZodLiteral<true>>;
    preview: z.ZodOptional<z.ZodObject<{
        deltaByLI: z.ZodRecord<z.ZodString, z.ZodNumber>;
        willUpdate: z.ZodBoolean;
    }, z.core.$strip>>;
    sample: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>;
        amount: z.ZodCoercedNumber<unknown>;
        dueDate: z.ZodPreprocess<z.ZodString>;
        lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        void: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notifyCM: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                done: z.ZodDefault<z.ZodBoolean>;
                doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dueDate: z.ZodString;
            targetPaymentDate: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<{
                manual: "manual";
                calculated: "calculated";
            }>>;
            taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                completed: "completed";
                due: "due";
                effective: "effective";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$strip>>>;
}, z.core.$strip>, z.ZodObject<{
    mode: z.ZodLiteral<"grant">;
    fromISO: z.ZodPreprocess<z.ZodString>;
    dryRun: z.ZodBoolean;
    grantId: z.ZodString;
    stats: z.ZodObject<{
        touched: z.ZodNumber;
        noChange: z.ZodNumber;
        errors: z.ZodNumber;
    }, z.core.$strip>;
    summaries: z.ZodArray<z.ZodObject<{
        enrollmentId: z.ZodString;
        deltaByLI: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>]>;
export type TPaymentsRecalculateFutureResp = z.infer<typeof PaymentsRecalculateFutureResp>;
export declare const PaymentsRecalcGrantProjectedResp: z.ZodObject<{
    totals: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    warnings: z.ZodArray<z.ZodString>;
    dryRun: z.ZodBoolean;
    effectiveFromISO: z.ZodPreprocess<z.ZodString>;
    activeOnly: z.ZodBoolean;
    source: z.ZodLiteral<1>;
}, z.core.$strip>;
export type TPaymentsRecalcGrantProjectedResp = z.infer<typeof PaymentsRecalcGrantProjectedResp>;
export declare const PaymentsDeleteRowsResp: z.ZodObject<{
    ok: z.ZodBoolean;
    enrollmentId: z.ZodString;
    deletedPaymentIds: z.ZodArray<z.ZodString>;
    skippedPaidIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    reversedSpendIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    removedSpendSubdocIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    counts: z.ZodObject<{
        deletedPayments: z.ZodNumber;
        skippedPaid: z.ZodNumber;
        reversedSpends: z.ZodNumber;
        removedSpendSubdocs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TPaymentsDeleteRowsResp = z.infer<typeof PaymentsDeleteRowsResp>;
