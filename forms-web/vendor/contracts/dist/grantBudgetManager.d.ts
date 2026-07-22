import { z } from "./core.js";
import type { Ok } from "./http.js";
export declare const GrantBudgetManagerSourceType: z.ZodEnum<{
    ledger: "ledger";
    paymentQueue: "paymentQueue";
    newProjection: "newProjection";
}>;
export type TGrantBudgetManagerSourceType = z.infer<typeof GrantBudgetManagerSourceType>;
export declare const GrantBudgetManagerSaveMode: z.ZodEnum<{
    preview: "preview";
    applyOpen: "applyOpen";
    applyAll: "applyAll";
}>;
export type TGrantBudgetManagerSaveMode = z.infer<typeof GrantBudgetManagerSaveMode>;
export declare const GrantBudgetManagerOriginal: z.ZodObject<{
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serviceDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    memo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TGrantBudgetManagerOriginal = z.infer<typeof GrantBudgetManagerOriginal>;
export declare const GrantBudgetManagerRow: z.ZodObject<{
    rowId: z.ZodString;
    sourceType: z.ZodEnum<{
        ledger: "ledger";
        paymentQueue: "paymentQueue";
        newProjection: "newProjection";
    }>;
    sourceId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    ledgerItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentQueueItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rentCertDueOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodString;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodCoercedNumber<unknown>;
    date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serviceDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    memo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reversedByLedgerItemIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    isWritable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    lockedReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rowState: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        deleted: "deleted";
        clean: "clean";
        changed: "changed";
        new: "new";
    }>>>;
    original: z.ZodOptional<z.ZodObject<{
        grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        serviceDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paymentDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        memo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export type TGrantBudgetManagerRow = z.infer<typeof GrantBudgetManagerRow>;
export declare const GrantBudgetManagerLineItem: z.ZodObject<{
    grantId: z.ZodString;
    id: z.ZodString;
    label: z.ZodString;
    typeLabel: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    budget: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    locked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type TGrantBudgetManagerLineItem = z.infer<typeof GrantBudgetManagerLineItem>;
export declare const GrantBudgetManagerRollup: z.ZodObject<{
    grantId: z.ZodString;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    budget: z.ZodDefault<z.ZodNumber>;
    spent: z.ZodDefault<z.ZodNumber>;
    projected: z.ZodDefault<z.ZodNumber>;
    total: z.ZodDefault<z.ZodNumber>;
    remaining: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type TGrantBudgetManagerRollup = z.infer<typeof GrantBudgetManagerRollup>;
export declare const GrantBudgetManagerLoadBody: z.ZodObject<{
    grantIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type TGrantBudgetManagerLoadBody = z.infer<typeof GrantBudgetManagerLoadBody>;
export type TGrantBudgetManagerLoadResp = Ok<{
    grants: Array<Record<string, unknown>>;
    lineItems: TGrantBudgetManagerLineItem[];
    rows: TGrantBudgetManagerRow[];
    rollups: TGrantBudgetManagerRollup[];
    loadedAt: string;
}>;
export declare const GrantBudgetManagerSaveBody: z.ZodObject<{
    mode: z.ZodEnum<{
        preview: "preview";
        applyOpen: "applyOpen";
        applyAll: "applyAll";
    }>;
    grantIds: z.ZodArray<z.ZodString>;
    rows: z.ZodArray<z.ZodObject<{
        rowId: z.ZodString;
        sourceType: z.ZodEnum<{
            ledger: "ledger";
            paymentQueue: "paymentQueue";
            newProjection: "newProjection";
        }>;
        sourceId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        ledgerItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paymentQueueItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paymentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        rentCertDueOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantId: z.ZodString;
        lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amount: z.ZodCoercedNumber<unknown>;
        date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        serviceDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paymentDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        memo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reversedByLedgerItemIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        isWritable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        lockedReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        rowState: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            deleted: "deleted";
            clean: "clean";
            changed: "changed";
            new: "new";
        }>>>;
        original: z.ZodOptional<z.ZodObject<{
            grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            serviceDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            paymentDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            memo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>;
    }, z.core.$loose>>;
    reason: z.ZodOptional<z.ZodString>;
    loadedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TGrantBudgetManagerSaveBody = z.infer<typeof GrantBudgetManagerSaveBody>;
export type TGrantBudgetManagerSaveResp = Ok<{
    dryRun: boolean;
    updated: number;
    created: number;
    removed: number;
    skipped: Array<{
        rowId: string;
        sourceId?: string | null;
        reason: string;
    }>;
    failed: Array<{
        rowId: string;
        sourceId?: string | null;
        error: string;
    }>;
    grantsRecomputed: string[];
    rollups: TGrantBudgetManagerRollup[];
}>;
export declare const GrantBudgetManagerReconcileBody: z.ZodObject<{
    grantIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type TGrantBudgetManagerReconcileBody = z.infer<typeof GrantBudgetManagerReconcileBody>;
export type TGrantBudgetManagerReconcileResp = Ok<{
    affectedGrantIds: string[];
    before: TGrantBudgetManagerRollup[];
    after: TGrantBudgetManagerRollup[];
    skipped: Array<{
        grantId: string;
        reason: string;
    }>;
    failed: Array<{
        grantId: string;
        error: string;
    }>;
    /** paymentQueue docs found desynced (posted-in-ledger but still queueStatus:pending) and auto-repaired during this reconcile run. */
    queueDocsRepaired: Array<{
        grantId: string;
        queueId: string;
        ledgerEntryId: string;
    }>;
}>;
