import { z } from "./core.js";
/** Where this ledger entry came from. */
export declare const LedgerSource: z.ZodEnum<{
    manual: "manual";
    enrollment: "enrollment";
    system: "system";
    card: "card";
    migration: "migration";
    adjustment: "adjustment";
}>;
export type TLedgerSource = z.infer<typeof LedgerSource>;
export declare const LedgerOrigin: z.ZodObject<{
    app: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    baseId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    sourcePath: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    paymentQueueId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    paymentQueueSource: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    jotformSubmissionId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    idempotencyKey: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$strip>;
/**
 * Canonical ledger row (storage shape).
 * - amountCents is truth
 * - amount is derived (Option A)
 * - id is optional in payload; Firestore doc id is canonical
 */
export declare const LedgerEntry: z.ZodPreprocess<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<{
        manual: "manual";
        enrollment: "enrollment";
        system: "system";
        card: "card";
        migration: "migration";
        adjustment: "adjustment";
    }>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amountCents: z.ZodCoercedNumber<unknown>;
    amount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    creditCardId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    labels: z.ZodDefault<z.ZodArray<z.ZodString>>;
    ts: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    date: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    origin: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        app: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        baseId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        sourcePath: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        paymentQueueId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        paymentQueueSource: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        jotformSubmissionId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        idempotencyKey: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$strip>>>;
    grantNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItemLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    byEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    byName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    paidAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    reversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, z.core.$strip>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$strip>>;
export type TLedgerEntry = z.infer<typeof LedgerEntry>;
export declare const LedgerListBody: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    creditCardId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        manual: "manual";
        enrollment: "enrollment";
        system: "system";
        card: "card";
        migration: "migration";
        adjustment: "adjustment";
    }>>>;
    month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    cursor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortBy: z.ZodDefault<z.ZodPreprocess<z.ZodEnum<{
        createdAt: "createdAt";
        dueDate: "dueDate";
        amountCents: "amountCents";
    }>>>;
    sortOrder: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
}, z.core.$strip>;
export type TLedgerListBody = z.infer<typeof LedgerListBody>;
export declare const LedgerCreateBody: z.ZodPreprocess<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<{
        manual: "manual";
        card: "card";
        adjustment: "adjustment";
    }>;
    amountCents: z.ZodCoercedNumber<unknown>;
    amount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    creditCardId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    labels: z.ZodDefault<z.ZodArray<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    date: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>>;
export type TLedgerCreateBody = z.infer<typeof LedgerCreateBody>;
export declare const LedgerClassifyItem: z.ZodObject<{
    entryId: z.ZodString;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    clear: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type TLedgerClassifyItem = z.infer<typeof LedgerClassifyItem>;
export declare const LedgerClassifyBody: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        entryId: z.ZodString;
        grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        clear: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type TLedgerClassifyBody = z.infer<typeof LedgerClassifyBody>;
export declare const LedgerAutoAssignBody: z.ZodObject<{
    entryIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    apply: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    forceReclass: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type TLedgerAutoAssignBody = z.infer<typeof LedgerAutoAssignBody>;
export type TLedgerClassifyResp = {
    ok: true;
    updated: number;
    dryRun: boolean;
    results: Array<{
        entryId: string;
        ok: boolean;
        error?: string;
        before?: {
            grantId: string | null;
            lineItemId: string | null;
        };
        after?: {
            grantId: string | null;
            lineItemId: string | null;
        };
    }>;
};
export type TLedgerAutoAssignResp = {
    ok: true;
    apply: boolean;
    updated: number;
    matches: Array<{
        entryId: string;
        matched: boolean;
        score: number;
        grantId: string | null;
        lineItemId: string | null;
        reasons: string[];
    }>;
};
export declare const LedgerGetByIdParams: z.ZodObject<{
    entryId: z.ZodString;
}, z.core.$strip>;
export type TLedgerGetByIdParams = z.infer<typeof LedgerGetByIdParams>;
export declare const LedgerBalanceQuery: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    groupBy: z.ZodDefault<z.ZodEnum<{
        month: "month";
        grant: "grant";
        source: "source";
    }>>;
}, z.core.$strip>;
export type TLedgerBalanceQuery = z.infer<typeof LedgerBalanceQuery>;
