import { z } from "./core.js";
import { Ok } from "./http.js";
export { toArray } from "./core.js";
/** ---------- Enums ---------- */
export declare const JotformSubmissionStatus: z.ZodEnum<{
    active: "active";
    archived: "archived";
    deleted: "deleted";
}>;
export type TJotformSubmissionStatus = z.infer<typeof JotformSubmissionStatus>;
export declare const JotformSubmissionSource: z.ZodEnum<{
    manual: "manual";
    api: "api";
    webhook: "webhook";
    sync: "sync";
}>;
export type TJotformSubmissionSource = z.infer<typeof JotformSubmissionSource>;
/** ---------- Budget ---------- */
export declare const JotformBudgetLineItem: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.core.$loose>;
export type TJotformBudgetLineItem = z.infer<typeof JotformBudgetLineItem>;
export declare const JotformBudgetTotals: z.ZodObject<{
    total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
}, z.core.$loose>;
export type TJotformBudgetTotals = z.infer<typeof JotformBudgetTotals>;
export declare const JotformBudget: z.ZodObject<{
    total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    }, z.core.$loose>>>;
    lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export type TJotformBudget = z.infer<typeof JotformBudget>;
/** ---------- Calculation ---------- */
export declare const JotformSubmissionCalc: z.ZodObject<{
    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
    budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type TJotformSubmissionCalc = z.infer<typeof JotformSubmissionCalc>;
/** ---------- Submission (INPUT) ---------- */
export declare const JotformSubmissionInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
        deleted: "deleted";
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        api: "api";
        webhook: "webhook";
        sync: "sync";
    }>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldMap: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    ip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    statusRaw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    editUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    pdfUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    answers: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$loose>>>;
        lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    calc: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
        budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export type TJotformSubmission = z.infer<typeof JotformSubmissionInputSchema> & Record<string, any>;
/** Back-compat runtime name */
export declare const JotformSubmission: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
        deleted: "deleted";
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        api: "api";
        webhook: "webhook";
        sync: "sync";
    }>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldMap: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    ip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    statusRaw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    editUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    pdfUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    answers: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$loose>>>;
        lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    calc: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
        budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
/** ---------- Submission (ENTITY / READ) ---------- */
export declare const JotformSubmissionEntity: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
        deleted: "deleted";
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        api: "api";
        webhook: "webhook";
        sync: "sync";
    }>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldMap: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    ip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    statusRaw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    editUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    pdfUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    answers: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$loose>>>;
        lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    calc: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
        budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    id: z.ZodString;
}, z.core.$loose>;
export type TJotformSubmissionEntity = z.infer<typeof JotformSubmissionEntity> & Record<string, any>;
export declare const JotformSubmissionsUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
        deleted: "deleted";
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        api: "api";
        webhook: "webhook";
        sync: "sync";
    }>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldMap: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    ip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    statusRaw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    editUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    pdfUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    answers: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$loose>>>;
        lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    calc: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
        budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
        deleted: "deleted";
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        api: "api";
        webhook: "webhook";
        sync: "sync";
    }>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldMap: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    ip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    statusRaw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    editUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    pdfUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    answers: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$loose>>>;
        lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    calc: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
        budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>>]>;
export declare const JotformSubmissionUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
        deleted: "deleted";
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        api: "api";
        webhook: "webhook";
        sync: "sync";
    }>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldMap: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    ip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    statusRaw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    editUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    pdfUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    answers: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$loose>>>;
        lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    calc: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
        budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
        deleted: "deleted";
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        api: "api";
        webhook: "webhook";
        sync: "sync";
    }>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldMap: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    ip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    statusRaw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    editUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    pdfUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    answers: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$loose>>>;
        lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    calc: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
        budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>>]>;
export type TJotformSubmissionsUpsertBody = z.infer<typeof JotformSubmissionsUpsertBody>;
export type TJotformSubmissionsUpsertResp = Ok<{
    ids: string[];
}>;
export declare const JotformSubmissionsPatchRow: z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formId: z.ZodOptional<z.ZodString>;
        formTitle: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            active: "active";
            archived: "archived";
            deleted: "deleted";
        }>>>;
        source: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            api: "api";
            webhook: "webhook";
            sync: "sync";
        }>>>;
        grantId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        programId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        customerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        enrollmentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formAlias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        fieldMap: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        ip: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        statusRaw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        editUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        pdfUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        answers: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        raw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnknown>>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        calc: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
            budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>;
export declare const JotformSubmissionsPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formId: z.ZodOptional<z.ZodString>;
        formTitle: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            active: "active";
            archived: "archived";
            deleted: "deleted";
        }>>>;
        source: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            api: "api";
            webhook: "webhook";
            sync: "sync";
        }>>>;
        grantId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        programId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        customerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        enrollmentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formAlias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        fieldMap: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        ip: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        statusRaw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        editUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        pdfUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        answers: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        raw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnknown>>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        calc: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
            budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formId: z.ZodOptional<z.ZodString>;
        formTitle: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            active: "active";
            archived: "archived";
            deleted: "deleted";
        }>>>;
        source: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            api: "api";
            webhook: "webhook";
            sync: "sync";
        }>>>;
        grantId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        programId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        customerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        enrollmentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formAlias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        fieldMap: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        ip: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        statusRaw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        editUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        pdfUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        answers: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        raw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnknown>>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        calc: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
            budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>>]>;
export declare const JotformSubmissionPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formId: z.ZodOptional<z.ZodString>;
        formTitle: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            active: "active";
            archived: "archived";
            deleted: "deleted";
        }>>>;
        source: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            api: "api";
            webhook: "webhook";
            sync: "sync";
        }>>>;
        grantId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        programId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        customerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        enrollmentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formAlias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        fieldMap: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        ip: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        statusRaw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        editUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        pdfUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        answers: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        raw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnknown>>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        calc: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
            budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formId: z.ZodOptional<z.ZodString>;
        formTitle: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            active: "active";
            archived: "archived";
            deleted: "deleted";
        }>>>;
        source: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            api: "api";
            webhook: "webhook";
            sync: "sync";
        }>>>;
        grantId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        programId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        customerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        enrollmentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        formAlias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        fieldMap: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        ip: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        statusRaw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        submissionUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        editUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        pdfUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodURL>>>;
        answers: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        raw: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnknown>>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            lineItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        calc: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amounts: z.ZodOptional<z.ZodArray<z.ZodDefault<z.ZodCoercedNumber<unknown>>>>;
            budgetKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>>]>;
export type TJotformSubmissionsPatchRow = z.infer<typeof JotformSubmissionsPatchRow>;
export type TJotformSubmissionsPatchBody = z.infer<typeof JotformSubmissionsPatchBody>;
export type TJotformSubmissionsPatchResp = Ok<{
    ids: string[];
}>;
export declare const JotformSubmissionsDeleteBody: z.ZodPreprocess<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodString>, z.ZodArray<z.ZodPreprocess<z.ZodString>>]>>;
export type TJotformSubmissionsDeleteBody = z.infer<typeof JotformSubmissionsDeleteBody>;
export type TJotformSubmissionsDeleteResp = Ok<{
    ids: string[];
    deleted: true;
}>;
export declare const JotformSubmissionsAdminDeleteBody: z.ZodPreprocess<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodString>, z.ZodArray<z.ZodPreprocess<z.ZodString>>]>>;
export type TJotformSubmissionsAdminDeleteBody = z.infer<typeof JotformSubmissionsAdminDeleteBody>;
export type TJotformSubmissionsAdminDeleteResp = Ok<{
    ids: string[];
    deleted: true;
}>;
export declare const JotformSubmissionsListQuery: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodUnion<readonly [z.ZodLiteral<true>, z.ZodLiteral<false>]>>, z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>, z.ZodString]>>;
    formId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    programId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodString>;
    hmisId: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    cursorUpdatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    cursorId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TJotformSubmissionsListQuery = z.infer<typeof JotformSubmissionsListQuery>;
export type TJotformSubmissionsListResp = Ok<{
    items: TJotformSubmissionEntity[];
    next: {
        cursorUpdatedAt: unknown;
        cursorId: string;
    } | null;
    orgId: string;
}>;
export declare const JotformSubmissionsGetQuery: z.ZodObject<{
    id: z.ZodPreprocess<z.ZodString>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TJotformSubmissionsGetQuery = z.infer<typeof JotformSubmissionsGetQuery>;
export type TJotformSubmissionsGetResp = Ok<{
    submission: TJotformSubmissionEntity;
}>;
export type TJotformSubmissionsStructureResp = Ok<{
    structure: Partial<TJotformSubmission>;
}>;
export declare const JotformFormsListQuery: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    includeNoSubmissions: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$loose>;
export declare const JotformFormSummary: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodDefault<z.ZodString>;
    alias: z.ZodString;
    count: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    lastSubmission: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    isSign: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TJotformFormsListQuery = z.infer<typeof JotformFormsListQuery>;
export type TJotformFormSummary = z.infer<typeof JotformFormSummary>;
export type TJotformFormsListResp = Ok<{
    items: TJotformFormSummary[];
}>;
export declare const JotformQuestionFieldType: z.ZodEnum<{
    number: "number";
    boolean: "boolean";
    date: "date";
    text: "text";
    select: "select";
}>;
export type TJotformQuestionFieldType = z.infer<typeof JotformQuestionFieldType>;
export declare const JotformQuestionLogicType: z.ZodEnum<{
    number: "number";
    unknown: "unknown";
    date: "date";
    file: "file";
    phone: "phone";
    email: "email";
    text: "text";
    dropdown: "dropdown";
    single_select: "single_select";
    multi_select: "multi_select";
}>;
export type TJotformQuestionLogicType = z.infer<typeof JotformQuestionLogicType>;
export declare const JotformQuestionField: z.ZodObject<{
    key: z.ZodString;
    rawFieldId: z.ZodString;
    label: z.ZodDefault<z.ZodString>;
    rawType: z.ZodDefault<z.ZodString>;
    type: z.ZodEnum<{
        number: "number";
        boolean: "boolean";
        date: "date";
        text: "text";
        select: "select";
    }>;
    logicType: z.ZodEnum<{
        number: "number";
        unknown: "unknown";
        date: "date";
        file: "file";
        phone: "phone";
        email: "email";
        text: "text";
        dropdown: "dropdown";
        single_select: "single_select";
        multi_select: "multi_select";
    }>;
    typeLabel: z.ZodString;
    options: z.ZodOptional<z.ZodArray<z.ZodString>>;
    order: z.ZodCoercedNumber<unknown>;
}, z.core.$loose>;
export declare const JotformFormQuestionsGetQuery: z.ZodObject<{
    formId: z.ZodPreprocess<z.ZodString>;
}, z.core.$loose>;
export type TJotformQuestionField = z.infer<typeof JotformQuestionField>;
export type TJotformFormQuestionsGetQuery = z.infer<typeof JotformFormQuestionsGetQuery>;
export type TJotformFormQuestionsGetResp = Ok<{
    formId: string;
    fields: TJotformQuestionField[];
}>;
export declare const JotformLinkSubmissionBody: z.ZodObject<{
    id: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    submissionId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldMap: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TJotformLinkSubmissionBody = z.infer<typeof JotformLinkSubmissionBody>;
export type TJotformLinkSubmissionResp = Ok<{
    id: string;
    linked: true;
    link: {
        grantId: string | null;
        customerId: string | null;
        enrollmentId: string | null;
        cwId: string | null;
        hmisId: string | null;
        formAlias: string | null;
    };
}>;
export declare const JotformSyncSelectionBody: z.ZodObject<{
    mode: z.ZodDefault<z.ZodEnum<{
        aliases: "aliases";
        formIds: "formIds";
        all: "all";
    }>>;
    formIds: z.ZodOptional<z.ZodArray<z.ZodPreprocess<z.ZodString>>>;
    aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
    includeNoSubmissions: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
    since: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    maxPages: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    includeRaw: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TJotformSyncSelectionBody = z.infer<typeof JotformSyncSelectionBody>;
export type TJotformSyncSelectionResp = Ok<{
    forms: Array<{
        formId: string;
        alias: string | null;
        count: number;
    }>;
    ids: string[];
    count: number;
}>;
export declare const JotformDigestFieldType: z.ZodEnum<{
    question: "question";
    header: "header";
    section: "section";
}>;
export type TJotformDigestFieldType = z.infer<typeof JotformDigestFieldType>;
export declare const JotformDigestHeader: z.ZodObject<{
    show: z.ZodDefault<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TJotformDigestHeader = z.infer<typeof JotformDigestHeader>;
export declare const JotformDigestSection: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    show: z.ZodDefault<z.ZodBoolean>;
    order: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$loose>;
export type TJotformDigestSection = z.infer<typeof JotformDigestSection>;
export declare const JotformDigestField: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    questionLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodDefault<z.ZodEnum<{
        question: "question";
        header: "header";
        section: "section";
    }>>;
    sectionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    show: z.ZodDefault<z.ZodBoolean>;
    hideIfEmpty: z.ZodDefault<z.ZodBoolean>;
    order: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$loose>;
export type TJotformDigestField = z.infer<typeof JotformDigestField>;
export declare const JotformDigestMap: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    header: z.ZodDefault<z.ZodObject<{
        show: z.ZodDefault<z.ZodBoolean>;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>;
    sections: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        show: z.ZodDefault<z.ZodBoolean>;
        order: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    }, z.core.$loose>>>;
    fields: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        questionLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodEnum<{
            question: "question";
            header: "header";
            section: "section";
        }>>;
        sectionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        show: z.ZodDefault<z.ZodBoolean>;
        hideIfEmpty: z.ZodDefault<z.ZodBoolean>;
        order: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    }, z.core.$loose>>>;
    options: z.ZodDefault<z.ZodObject<{
        hideEmptyFields: z.ZodDefault<z.ZodBoolean>;
        showQuestions: z.ZodDefault<z.ZodBoolean>;
        showAnswers: z.ZodDefault<z.ZodBoolean>;
        task: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            assignedToGroup: z.ZodDefault<z.ZodEnum<{
                admin: "admin";
                casemanager: "casemanager";
                compliance: "compliance";
            }>>;
            titlePrefix: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            titleFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            subtitleFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>>;
        spending: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            schemaKind: z.ZodDefault<z.ZodEnum<{
                other: "other";
                invoice: "invoice";
                "credit-card": "credit-card";
            }>>;
            grantFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            lineItemFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            customerFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            amountFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            merchantFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            keywordRules: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>;
    }, z.core.$loose>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export type TJotformDigestMap = z.infer<typeof JotformDigestMap>;
export declare const JotformDigestUpsertBody: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodString;
    formAlias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    header: z.ZodDefault<z.ZodObject<{
        show: z.ZodDefault<z.ZodBoolean>;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>;
    sections: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        show: z.ZodDefault<z.ZodBoolean>;
        order: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    }, z.core.$loose>>>;
    fields: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        questionLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodEnum<{
            question: "question";
            header: "header";
            section: "section";
        }>>;
        sectionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        show: z.ZodDefault<z.ZodBoolean>;
        hideIfEmpty: z.ZodDefault<z.ZodBoolean>;
        order: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    }, z.core.$loose>>>;
    options: z.ZodDefault<z.ZodObject<{
        hideEmptyFields: z.ZodDefault<z.ZodBoolean>;
        showQuestions: z.ZodDefault<z.ZodBoolean>;
        showAnswers: z.ZodDefault<z.ZodBoolean>;
        task: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            assignedToGroup: z.ZodDefault<z.ZodEnum<{
                admin: "admin";
                casemanager: "casemanager";
                compliance: "compliance";
            }>>;
            titlePrefix: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            titleFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            subtitleFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$loose>>;
        spending: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            schemaKind: z.ZodDefault<z.ZodEnum<{
                other: "other";
                invoice: "invoice";
                "credit-card": "credit-card";
            }>>;
            grantFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            lineItemFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            customerFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            amountFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            merchantFieldKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
            keywordRules: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>;
    }, z.core.$loose>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export type TJotformDigestUpsertBody = z.infer<typeof JotformDigestUpsertBody>;
export type TJotformDigestUpsertResp = Ok<{
    id: string;
}>;
export declare const JotformDigestGetQuery: z.ZodObject<{
    formId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    formAlias: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TJotformDigestGetQuery = z.infer<typeof JotformDigestGetQuery>;
export type TJotformDigestGetResp = Ok<{
    map: TJotformDigestMap | null;
}>;
export declare const JotformDigestListQuery: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TJotformDigestListQuery = z.infer<typeof JotformDigestListQuery>;
export type TJotformDigestListResp = Ok<{
    items: TJotformDigestMap[];
}>;
export declare const JotformSyncBody: z.ZodObject<{
    formId: z.ZodPreprocess<z.ZodString>;
    since: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    maxPages: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    startOffset: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    includeRaw: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TJotformSyncBody = z.infer<typeof JotformSyncBody>;
export type TJotformSyncResp = Ok<{
    ids: string[];
    count: number;
    nextOffset: number;
    hasMore: boolean;
}>;
export declare const JotformApiListQuery: z.ZodObject<{
    formId: z.ZodPreprocess<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    offset: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    status: z.ZodOptional<z.ZodString>;
    since: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
}, z.core.$loose>;
export type TJotformApiListQuery = z.infer<typeof JotformApiListQuery>;
export type TJotformApiListResp = Ok<{
    items: TJotformSubmission[];
    hasMore: boolean;
}>;
export declare const JotformApiGetQuery: z.ZodObject<{
    id: z.ZodPreprocess<z.ZodString>;
}, z.core.$loose>;
export type TJotformApiGetQuery = z.infer<typeof JotformApiGetQuery>;
export type TJotformApiGetResp = Ok<{
    submission: TJotformSubmission;
}>;
