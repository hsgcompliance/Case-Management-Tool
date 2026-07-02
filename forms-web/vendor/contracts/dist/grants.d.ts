import { z } from "./core.js";
import { Ok } from "./http.js";
export { toArray } from "./core.js";
/** ---------- Enums ---------- */
export declare const GrantStatus: z.ZodEnum<{
    draft: "draft";
    active: "active";
    closed: "closed";
    deleted: "deleted";
}>;
export type TGrantStatus = z.infer<typeof GrantStatus>;
export declare const GrantKind: z.ZodEnum<{
    program: "program";
    grant: "grant";
}>;
export type TGrantKind = z.infer<typeof GrantKind>;
export declare const GrantFinancialModel: z.ZodEnum<{
    budgeted: "budgeted";
    billable: "billable";
    serviceOnly: "serviceOnly";
}>;
export type TGrantFinancialModel = z.infer<typeof GrantFinancialModel>;
export declare const GrantLedgerMode: z.ZodEnum<{
    spendDown: "spendDown";
    billing: "billing";
    none: "none";
}>;
export type TGrantLedgerMode = z.infer<typeof GrantLedgerMode>;
export declare const GrantCompliancePreset: z.ZodEnum<{
    custom: "custom";
    none: "none";
    hmisCaseworthy: "hmisCaseworthy";
}>;
export type TGrantCompliancePreset = z.infer<typeof GrantCompliancePreset>;
export declare const GrantComplianceControl: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    field: z.ZodOptional<z.ZodString>;
    type: z.ZodDefault<z.ZodEnum<{
        boolean: "boolean";
    }>>;
}, z.core.$loose>;
export type TGrantComplianceControl = z.infer<typeof GrantComplianceControl>;
export declare const GrantComplianceConfig: z.ZodObject<{
    preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        custom: "custom";
        none: "none";
        hmisCaseworthy: "hmisCaseworthy";
    }>>>;
    active: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        field: z.ZodOptional<z.ZodString>;
        type: z.ZodDefault<z.ZodEnum<{
            boolean: "boolean";
        }>>;
    }, z.core.$loose>>>;
    inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        field: z.ZodOptional<z.ZodString>;
        type: z.ZodDefault<z.ZodEnum<{
            boolean: "boolean";
        }>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type TGrantComplianceConfig = z.infer<typeof GrantComplianceConfig>;
export declare const GrantDriveTemplateType: z.ZodEnum<{
    other: "other";
    doc: "doc";
    sheet: "sheet";
    pdf: "pdf";
}>;
export type TGrantDriveTemplateType = z.infer<typeof GrantDriveTemplateType>;
export declare function extractGoogleDriveFileId(input: unknown): string;
export declare const GrantDriveTemplate: z.ZodPreprocess<z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    fileId: z.ZodString;
    fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        other: "other";
        doc: "doc";
        sheet: "sheet";
        pdf: "pdf";
    }>>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$loose>>;
export type TGrantDriveTemplate = z.infer<typeof GrantDriveTemplate>;
export declare function normalizeGrantDriveTemplates(input: unknown): TGrantDriveTemplate[];
export declare const GrantFinancialConfig: z.ZodObject<{
    model: z.ZodEnum<{
        budgeted: "budgeted";
        billable: "billable";
        serviceOnly: "serviceOnly";
    }>;
    budgetEnabled: z.ZodBoolean;
    billingEnabled: z.ZodBoolean;
    allocationEnabled: z.ZodBoolean;
    ledgerEnabled: z.ZodBoolean;
    ledgerMode: z.ZodEnum<{
        spendDown: "spendDown";
        billing: "billing";
        none: "none";
    }>;
}, z.core.$loose>;
export type TGrantFinancialConfig = z.infer<typeof GrantFinancialConfig>;
export declare const GrantFinancialConfigPatch: z.ZodObject<{
    model: z.ZodOptional<z.ZodEnum<{
        budgeted: "budgeted";
        billable: "billable";
        serviceOnly: "serviceOnly";
    }>>;
    budgetEnabled: z.ZodOptional<z.ZodBoolean>;
    billingEnabled: z.ZodOptional<z.ZodBoolean>;
    allocationEnabled: z.ZodOptional<z.ZodBoolean>;
    ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
    ledgerMode: z.ZodOptional<z.ZodEnum<{
        spendDown: "spendDown";
        billing: "billing";
        none: "none";
    }>>;
}, z.core.$loose>;
export type TGrantFinancialConfigPatch = z.infer<typeof GrantFinancialConfigPatch>;
export type TGrantFinancialCapabilities = {
    config: TGrantFinancialConfig;
    budgetEnabled: boolean;
    billingEnabled: boolean;
    allocationEnabled: boolean;
    ledgerEnabled: boolean;
    ledgerMode: TGrantLedgerMode;
    drawsDownBudget: boolean;
    usesBillingLedger: boolean;
    hasFinancialActivity: boolean;
};
export type TGrantLineItemAmountSemantics = {
    drawsDownBudget: boolean;
    amountIsBudgetAllocation: boolean;
    amountIsBillingReference: boolean;
    amountCreatesOverCap: boolean;
};
/**
 * Read-time financial config normalization. This intentionally does not rely on
 * schema defaults so parsing legacy Firestore records does not imply a write-back
 * migration. Persist normalized values later only through an explicit migration.
 */
export declare function normalizeGrantFinancialConfig(grant: Record<string, unknown> | null | undefined): TGrantFinancialConfig;
export declare function normalizeGrantComplianceConfig(grant: Record<string, unknown> | null | undefined): TGrantComplianceConfig;
export declare function getGrantFinancialCapabilities(grant: Record<string, unknown> | null | undefined): TGrantFinancialCapabilities;
export declare function shouldRetainGrantBudget(grant: Record<string, unknown> | null | undefined): boolean;
export declare function getGrantLineItemAmountSemantics(grant: Record<string, unknown> | null | undefined): TGrantLineItemAmountSemantics;
export declare function computeGrantLineItemOverCap(grant: Record<string, unknown> | null | undefined, lineItem: Record<string, unknown> | null | undefined): number | null;
export declare function parseGrantMaxAssistanceMonths(value: unknown): number | null;
export declare const GrantLineItemType: z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
}, z.core.$loose>>>;
export type TGrantLineItemType = z.infer<typeof GrantLineItemType>;
/** Per-customer spending cap on a single budget line item. Optional. */
export declare const GrantLineItemCap: z.ZodObject<{
    perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    capEnabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$loose>;
export type TGrantLineItemCap = z.infer<typeof GrantLineItemCap>;
export declare const GrantBudgetSplitMode: z.ZodEnum<{
    custom: "custom";
    fixed: "fixed";
    none: "none";
    monthly: "monthly";
    quarterly: "quarterly";
}>;
export type TGrantBudgetSplitMode = z.infer<typeof GrantBudgetSplitMode>;
export declare const GrantBudgetRollForwardBehavior: z.ZodEnum<{
    manual: "manual";
    none: "none";
    rollToNext: "rollToNext";
    rollToEnd: "rollToEnd";
    rebalanceFuture: "rebalanceFuture";
}>;
export type TGrantBudgetRollForwardBehavior = z.infer<typeof GrantBudgetRollForwardBehavior>;
export declare const GrantBudgetDisplayLevel: z.ZodEnum<{
    split: "split";
    grant: "grant";
    lineItem: "lineItem";
}>;
export type TGrantBudgetDisplayLevel = z.infer<typeof GrantBudgetDisplayLevel>;
export declare const GrantBudgetDateRange: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TGrantBudgetDateRange = z.infer<typeof GrantBudgetDateRange>;
export declare const GrantBudgetSplitGoal: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TGrantBudgetSplitGoal = z.infer<typeof GrantBudgetSplitGoal>;
export declare const GrantBudgetItemDisplayConfig: z.ZodObject<{
    cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
        split: "split";
        total: "total";
    }>>;
    displayOnDigest: z.ZodOptional<z.ZodBoolean>;
    digestDisplayMode: z.ZodOptional<z.ZodEnum<{
        total: "total";
        currentCycle: "currentCycle";
        both: "both";
    }>>;
    showGrantTotal: z.ZodOptional<z.ZodBoolean>;
    showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
    showSplitGoals: z.ZodOptional<z.ZodBoolean>;
    appearInDigest: z.ZodOptional<z.ZodBoolean>;
    displayAs: z.ZodOptional<z.ZodEnum<{
        main: "main";
        nested: "nested";
    }>>;
    mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
        split: "split";
        grant: "grant";
        lineItem: "lineItem";
    }>>;
    groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
    expandedByDefault: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TGrantBudgetItemDisplayConfig = z.infer<typeof GrantBudgetItemDisplayConfig>;
export declare const GrantBudgetBreakdownValidation: z.ZodObject<{
    status: z.ZodDefault<z.ZodEnum<{
        ok: "ok";
        warning: "warning";
    }>>;
    message: z.ZodOptional<z.ZodString>;
    splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
}, z.core.$loose>;
export type TGrantBudgetBreakdownValidation = z.infer<typeof GrantBudgetBreakdownValidation>;
export declare const GrantInvoiceOption: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    custom: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TGrantInvoiceOption = z.infer<typeof GrantInvoiceOption>;
export declare const GrantLineItemInvoicing: z.ZodObject<{
    functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        custom: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        custom: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
}, z.core.$loose>;
export type TGrantLineItemInvoicing = z.infer<typeof GrantLineItemInvoicing>;
export declare const GrantBudgetLineItem: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    locked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        label: z.ZodString;
    }, z.core.$loose>>>>>;
    perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    capEnabled: z.ZodDefault<z.ZodBoolean>;
    splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        custom: "custom";
        fixed: "fixed";
        none: "none";
        monthly: "monthly";
        quarterly: "quarterly";
    }>>>;
    rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        none: "none";
        rollToNext: "rollToNext";
        rollToEnd: "rollToEnd";
        rebalanceFuture: "rebalanceFuture";
    }>>>;
    splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>;
    display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
            split: "split";
            total: "total";
        }>>;
        displayOnDigest: z.ZodOptional<z.ZodBoolean>;
        digestDisplayMode: z.ZodOptional<z.ZodEnum<{
            total: "total";
            currentCycle: "currentCycle";
            both: "both";
        }>>;
        showGrantTotal: z.ZodOptional<z.ZodBoolean>;
        showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
        showSplitGoals: z.ZodOptional<z.ZodBoolean>;
        appearInDigest: z.ZodOptional<z.ZodBoolean>;
        displayAs: z.ZodOptional<z.ZodEnum<{
            main: "main";
            nested: "nested";
        }>>;
        mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
            split: "split";
            grant: "grant";
            lineItem: "lineItem";
        }>>;
        groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
        expandedByDefault: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>;
    breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        status: z.ZodDefault<z.ZodEnum<{
            ok: "ok";
            warning: "warning";
        }>>;
        message: z.ZodOptional<z.ZodString>;
        splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    }, z.core.$loose>>>;
    invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type TGrantBudgetLineItem = z.infer<typeof GrantBudgetLineItem>;
export declare const GrantBudgetTotals: z.ZodObject<{
    total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    remaining: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    projectedInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    spentInWindow: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    windowBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    windowProjectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
}, z.core.$loose>;
export type TGrantBudgetTotals = z.infer<typeof GrantBudgetTotals>;
export declare const GrantBudget: z.ZodObject<{
    total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
        type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodString;
        }, z.core.$loose>>>>>;
        perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        capEnabled: z.ZodDefault<z.ZodBoolean>;
        splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            custom: "custom";
            fixed: "fixed";
            none: "none";
            monthly: "monthly";
            quarterly: "quarterly";
        }>>>;
        rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            none: "none";
            rollToNext: "rollToNext";
            rollToEnd: "rollToEnd";
            rebalanceFuture: "rebalanceFuture";
        }>>>;
        splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                split: "split";
                total: "total";
            }>>;
            displayOnDigest: z.ZodOptional<z.ZodBoolean>;
            digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                total: "total";
                currentCycle: "currentCycle";
                both: "both";
            }>>;
            showGrantTotal: z.ZodOptional<z.ZodBoolean>;
            showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
            showSplitGoals: z.ZodOptional<z.ZodBoolean>;
            appearInDigest: z.ZodOptional<z.ZodBoolean>;
            displayAs: z.ZodOptional<z.ZodEnum<{
                main: "main";
                nested: "nested";
            }>>;
            mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                split: "split";
                grant: "grant";
                lineItem: "lineItem";
            }>>;
            groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
            expandedByDefault: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>;
        breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            status: z.ZodDefault<z.ZodEnum<{
                ok: "ok";
                warning: "warning";
            }>>;
            message: z.ZodOptional<z.ZodString>;
            splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$loose>>>;
        invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            split: "split";
            grant: "grant";
            lineItem: "lineItem";
        }>>>;
        expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>>;
    allocationEnabled: z.ZodOptional<z.ZodBoolean>;
    perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export type TGrantBudget = z.infer<typeof GrantBudget>;
export declare const ConditionalTaskRuleType: z.ZodEnum<{
    population: "population";
    age: "age";
    concurrent_enrollment: "concurrent_enrollment";
}>;
export type TConditionalTaskRuleType = z.infer<typeof ConditionalTaskRuleType>;
export declare const AgeOperator: z.ZodEnum<{
    ">=": ">=";
    "<=": "<=";
    ">": ">";
    "<": "<";
}>;
export type TAgeOperator = z.infer<typeof AgeOperator>;
export declare const ConditionalTaskRule: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<{
        population: "population";
        age: "age";
        concurrent_enrollment: "concurrent_enrollment";
    }>;
    ageOperator: z.ZodOptional<z.ZodEnum<{
        ">=": ">=";
        "<=": "<=";
        ">": ">";
        "<": "<";
    }>>;
    ageThreshold: z.ZodOptional<z.ZodNumber>;
    programName: z.ZodOptional<z.ZodString>;
    population: z.ZodOptional<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>;
    populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>;
    taskName: z.ZodString;
    taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    taskBucket: z.ZodDefault<z.ZodString>;
    dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    assignToGroup: z.ZodDefault<z.ZodEnum<{
        admin: "admin";
        casemanager: "casemanager";
        compliance: "compliance";
    }>>;
    taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodEnum<{
        "one-off": "one-off";
        recurring: "recurring";
    }>>;
    frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notify: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TConditionalTaskRule = z.infer<typeof ConditionalTaskRule>;
/**
 * Grant-level managed task definitions. Current UI and task generation store
 * these as an array on grants/{id}.tasks. Legacy records may still have a
 * record-shaped tasks object, so accept both shapes at contract boundaries.
 */
export declare const GrantTaskDefinitions: z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>;
export type TGrantTaskDefinitions = z.infer<typeof GrantTaskDefinitions>;
export declare const GRANT_PIN_COLORS: readonly ["red", "amber", "emerald", "sky", "violet", "rose", "orange"];
export type TGrantPinColor = typeof GRANT_PIN_COLORS[number];
/**
 * @legacy — from previous system. Surfaces a bold badge and floats the grant
 * to the top of lists. Preserved for backward compat; prefer named system pins
 * for new feature hooks.
 */
export declare const GrantPinImportant: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        red: "red";
        amber: "amber";
        emerald: "emerald";
        sky: "sky";
        violet: "violet";
        rose: "rose";
        orange: "orange";
    }>>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$loose>;
export type TGrantPinImportant = z.infer<typeof GrantPinImportant>;
/**
 * Budget Digest Pin (stored as `pins.digest`) — when enabled, this grant is
 * included in the org-wide monthly budget digest email. Grants without this
 * pin are excluded from the digest and from aggregate digest totals.
 */
export declare const GrantPinDigest: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TGrantPinDigest = z.infer<typeof GrantPinDigest>;
/**
 * Rental Assistance Digest Pin — when enabled, includes this grant in the
 * org-wide rental assistance digest email.
 */
export declare const GrantPinRentalAssistance: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TGrantPinRentalAssistance = z.infer<typeof GrantPinRentalAssistance>;
/**
 * Invoicing Tab Pin — surfaces this grant as a selectable filter in the
 * invoicing tool. Does not affect ledger or payment source-of-truth records.
 */
export declare const GrantPinInvoice: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TGrantPinInvoice = z.infer<typeof GrantPinInvoice>;
export declare const GrantPins: z.ZodObject<{
    digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            red: "red";
            amber: "amber";
            emerald: "emerald";
            sky: "sky";
            violet: "violet";
            rose: "rose";
            orange: "orange";
        }>>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type TGrantPins = z.infer<typeof GrantPins>;
export declare const GrantInvoicingFrequency: z.ZodEnum<{
    monthly: "monthly";
    quarterly: "quarterly";
    annually: "annually";
    "on-demand": "on-demand";
}>;
export type TGrantInvoicingFrequency = z.infer<typeof GrantInvoicingFrequency>;
/**
 * Optional invoicing metadata stored on the grant doc.
 * Covers grant codes, contract references, funder contacts, and billing details.
 */
export declare const GrantInvoicing: z.ZodObject<{
    grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        custom: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        custom: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        monthly: "monthly";
        quarterly: "quarterly";
        annually: "annually";
        "on-demand": "on-demand";
    }>>>;
    dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$loose>;
export type TGrantInvoicing = z.infer<typeof GrantInvoicing>;
export declare const GrantEnrollmentDefaults: z.ZodObject<{
    authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        paused: "paused";
    }>>>;
    medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        closed: "closed";
    }>>>;
}, z.core.$loose>;
export type TGrantEnrollmentDefaults = z.infer<typeof GrantEnrollmentDefaults>;
export declare const GrantCycleLink: z.ZodObject<{
    previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TGrantCycleLink = z.infer<typeof GrantCycleLink>;
export declare const GrantEnrollmentLinkRule: z.ZodObject<{
    targetGrantId: z.ZodString;
    onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
    onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
}, z.core.$loose>;
export type TGrantEnrollmentLinkRule = z.infer<typeof GrantEnrollmentLinkRule>;
export declare const GrantEnrollmentRequirement: z.ZodObject<{
    operator: z.ZodDefault<z.ZodEnum<{
        any: "any";
        all: "all";
    }>>;
    targetGrantIds: z.ZodArray<z.ZodString>;
    behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
}, z.core.$loose>;
export type TGrantEnrollmentRequirement = z.infer<typeof GrantEnrollmentRequirement>;
export declare const GrantLinking: z.ZodObject<{
    cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        operator: z.ZodDefault<z.ZodEnum<{
            any: "any";
            all: "all";
        }>>;
        targetGrantIds: z.ZodArray<z.ZodString>;
        behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
    }, z.core.$loose>>>;
    enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        targetGrantId: z.ZodString;
        onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
        onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type TGrantLinking = z.infer<typeof GrantLinking>;
/** ---------- Grant (INPUT) ---------- */
export declare const GrantInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodEnum<{
        program: "program";
        grant: "grant";
    }>>;
    financialConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        model: z.ZodOptional<z.ZodEnum<{
            budgeted: "budgeted";
            billable: "billable";
            serviceOnly: "serviceOnly";
        }>>;
        budgetEnabled: z.ZodOptional<z.ZodBoolean>;
        billingEnabled: z.ZodOptional<z.ZodBoolean>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerMode: z.ZodOptional<z.ZodEnum<{
            spendDown: "spendDown";
            billing: "billing";
            none: "none";
        }>>;
    }, z.core.$loose>>>;
    duration: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lengthOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxAssistanceMonths: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
    startDate: z.ZodOptional<z.ZodUnknown>;
    endDate: z.ZodOptional<z.ZodUnknown>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
            type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
            }, z.core.$loose>>>>>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            capEnabled: z.ZodDefault<z.ZodBoolean>;
            splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                fixed: "fixed";
                none: "none";
                monthly: "monthly";
                quarterly: "quarterly";
            }>>>;
            rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                manual: "manual";
                none: "none";
                rollToNext: "rollToNext";
                rollToEnd: "rollToEnd";
                rebalanceFuture: "rebalanceFuture";
            }>>>;
            splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>>;
            display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    total: "total";
                }>>;
                displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                    total: "total";
                    currentCycle: "currentCycle";
                    both: "both";
                }>>;
                showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                appearInDigest: z.ZodOptional<z.ZodBoolean>;
                displayAs: z.ZodOptional<z.ZodEnum<{
                    main: "main";
                    nested: "nested";
                }>>;
                mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>;
                groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                expandedByDefault: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                status: z.ZodDefault<z.ZodEnum<{
                    ok: "ok";
                    warning: "warning";
                }>>;
                message: z.ZodOptional<z.ZodString>;
                splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
                descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                split: "split";
                grant: "grant";
                lineItem: "lineItem";
            }>>>;
            expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    taskTypes: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    tasks: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>;
    complianceConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            custom: "custom";
            none: "none";
            hmisCaseworthy: "hmisCaseworthy";
        }>>>;
        active: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
        inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    driveTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        fileId: z.ZodString;
        fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            other: "other";
            doc: "doc";
            sheet: "sheet";
            pdf: "pdf";
        }>>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>>>>;
    conditionalTaskRules: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            population: "population";
            age: "age";
            concurrent_enrollment: "concurrent_enrollment";
        }>;
        ageOperator: z.ZodOptional<z.ZodEnum<{
            ">=": ">=";
            "<=": "<=";
            ">": ">";
            "<": "<";
        }>>;
        ageThreshold: z.ZodOptional<z.ZodNumber>;
        programName: z.ZodOptional<z.ZodString>;
        population: z.ZodOptional<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>;
        populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>;
        taskName: z.ZodString;
        taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taskBucket: z.ZodDefault<z.ZodString>;
        dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        assignToGroup: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            casemanager: "casemanager";
            compliance: "compliance";
        }>>;
        taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        kind: z.ZodOptional<z.ZodEnum<{
            "one-off": "one-off";
            recurring: "recurring";
        }>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notify: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    pins: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                red: "red";
                amber: "amber";
                emerald: "emerald";
                sky: "sky";
                violet: "violet";
                rose: "rose";
                orange: "orange";
            }>>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            quarterly: "quarterly";
            annually: "annually";
            "on-demand": "on-demand";
        }>>>;
        dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$loose>>>;
    enrollmentDefaults: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            paused: "paused";
        }>>>;
        medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>>;
    }, z.core.$loose>>>;
    linking: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            operator: z.ZodDefault<z.ZodEnum<{
                any: "any";
                all: "all";
            }>>;
            targetGrantIds: z.ZodArray<z.ZodString>;
            behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
        }, z.core.$loose>>>;
        enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            targetGrantId: z.ZodString;
            onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
            onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoiceDocuments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    levelOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    programIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    fundingGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedProgramIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export type TGrant = z.infer<typeof GrantInputSchema> & Record<string, unknown>;
/** Back-compat runtime name (functions currently import Grant) */
export declare const Grant: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodEnum<{
        program: "program";
        grant: "grant";
    }>>;
    financialConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        model: z.ZodOptional<z.ZodEnum<{
            budgeted: "budgeted";
            billable: "billable";
            serviceOnly: "serviceOnly";
        }>>;
        budgetEnabled: z.ZodOptional<z.ZodBoolean>;
        billingEnabled: z.ZodOptional<z.ZodBoolean>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerMode: z.ZodOptional<z.ZodEnum<{
            spendDown: "spendDown";
            billing: "billing";
            none: "none";
        }>>;
    }, z.core.$loose>>>;
    duration: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lengthOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxAssistanceMonths: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
    startDate: z.ZodOptional<z.ZodUnknown>;
    endDate: z.ZodOptional<z.ZodUnknown>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
            type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
            }, z.core.$loose>>>>>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            capEnabled: z.ZodDefault<z.ZodBoolean>;
            splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                fixed: "fixed";
                none: "none";
                monthly: "monthly";
                quarterly: "quarterly";
            }>>>;
            rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                manual: "manual";
                none: "none";
                rollToNext: "rollToNext";
                rollToEnd: "rollToEnd";
                rebalanceFuture: "rebalanceFuture";
            }>>>;
            splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>>;
            display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    total: "total";
                }>>;
                displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                    total: "total";
                    currentCycle: "currentCycle";
                    both: "both";
                }>>;
                showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                appearInDigest: z.ZodOptional<z.ZodBoolean>;
                displayAs: z.ZodOptional<z.ZodEnum<{
                    main: "main";
                    nested: "nested";
                }>>;
                mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>;
                groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                expandedByDefault: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                status: z.ZodDefault<z.ZodEnum<{
                    ok: "ok";
                    warning: "warning";
                }>>;
                message: z.ZodOptional<z.ZodString>;
                splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
                descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                split: "split";
                grant: "grant";
                lineItem: "lineItem";
            }>>>;
            expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    taskTypes: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    tasks: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>;
    complianceConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            custom: "custom";
            none: "none";
            hmisCaseworthy: "hmisCaseworthy";
        }>>>;
        active: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
        inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    driveTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        fileId: z.ZodString;
        fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            other: "other";
            doc: "doc";
            sheet: "sheet";
            pdf: "pdf";
        }>>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>>>>;
    conditionalTaskRules: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            population: "population";
            age: "age";
            concurrent_enrollment: "concurrent_enrollment";
        }>;
        ageOperator: z.ZodOptional<z.ZodEnum<{
            ">=": ">=";
            "<=": "<=";
            ">": ">";
            "<": "<";
        }>>;
        ageThreshold: z.ZodOptional<z.ZodNumber>;
        programName: z.ZodOptional<z.ZodString>;
        population: z.ZodOptional<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>;
        populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>;
        taskName: z.ZodString;
        taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taskBucket: z.ZodDefault<z.ZodString>;
        dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        assignToGroup: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            casemanager: "casemanager";
            compliance: "compliance";
        }>>;
        taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        kind: z.ZodOptional<z.ZodEnum<{
            "one-off": "one-off";
            recurring: "recurring";
        }>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notify: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    pins: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                red: "red";
                amber: "amber";
                emerald: "emerald";
                sky: "sky";
                violet: "violet";
                rose: "rose";
                orange: "orange";
            }>>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            quarterly: "quarterly";
            annually: "annually";
            "on-demand": "on-demand";
        }>>>;
        dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$loose>>>;
    enrollmentDefaults: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            paused: "paused";
        }>>>;
        medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>>;
    }, z.core.$loose>>>;
    linking: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            operator: z.ZodDefault<z.ZodEnum<{
                any: "any";
                all: "all";
            }>>;
            targetGrantIds: z.ZodArray<z.ZodString>;
            behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
        }, z.core.$loose>>>;
        enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            targetGrantId: z.ZodString;
            onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
            onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoiceDocuments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    levelOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    programIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    fundingGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedProgramIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
/** ---------- Grant (ENTITY / READ) ---------- */
export declare const GrantEntity: z.ZodObject<{
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodEnum<{
        program: "program";
        grant: "grant";
    }>>;
    financialConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        model: z.ZodOptional<z.ZodEnum<{
            budgeted: "budgeted";
            billable: "billable";
            serviceOnly: "serviceOnly";
        }>>;
        budgetEnabled: z.ZodOptional<z.ZodBoolean>;
        billingEnabled: z.ZodOptional<z.ZodBoolean>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerMode: z.ZodOptional<z.ZodEnum<{
            spendDown: "spendDown";
            billing: "billing";
            none: "none";
        }>>;
    }, z.core.$loose>>>;
    duration: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lengthOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxAssistanceMonths: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
    startDate: z.ZodOptional<z.ZodUnknown>;
    endDate: z.ZodOptional<z.ZodUnknown>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
            type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
            }, z.core.$loose>>>>>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            capEnabled: z.ZodDefault<z.ZodBoolean>;
            splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                fixed: "fixed";
                none: "none";
                monthly: "monthly";
                quarterly: "quarterly";
            }>>>;
            rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                manual: "manual";
                none: "none";
                rollToNext: "rollToNext";
                rollToEnd: "rollToEnd";
                rebalanceFuture: "rebalanceFuture";
            }>>>;
            splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>>;
            display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    total: "total";
                }>>;
                displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                    total: "total";
                    currentCycle: "currentCycle";
                    both: "both";
                }>>;
                showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                appearInDigest: z.ZodOptional<z.ZodBoolean>;
                displayAs: z.ZodOptional<z.ZodEnum<{
                    main: "main";
                    nested: "nested";
                }>>;
                mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>;
                groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                expandedByDefault: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                status: z.ZodDefault<z.ZodEnum<{
                    ok: "ok";
                    warning: "warning";
                }>>;
                message: z.ZodOptional<z.ZodString>;
                splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
                descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                split: "split";
                grant: "grant";
                lineItem: "lineItem";
            }>>>;
            expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    taskTypes: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    tasks: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>;
    complianceConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            custom: "custom";
            none: "none";
            hmisCaseworthy: "hmisCaseworthy";
        }>>>;
        active: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
        inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    driveTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        fileId: z.ZodString;
        fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            other: "other";
            doc: "doc";
            sheet: "sheet";
            pdf: "pdf";
        }>>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>>>>;
    conditionalTaskRules: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            population: "population";
            age: "age";
            concurrent_enrollment: "concurrent_enrollment";
        }>;
        ageOperator: z.ZodOptional<z.ZodEnum<{
            ">=": ">=";
            "<=": "<=";
            ">": ">";
            "<": "<";
        }>>;
        ageThreshold: z.ZodOptional<z.ZodNumber>;
        programName: z.ZodOptional<z.ZodString>;
        population: z.ZodOptional<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>;
        populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>;
        taskName: z.ZodString;
        taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taskBucket: z.ZodDefault<z.ZodString>;
        dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        assignToGroup: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            casemanager: "casemanager";
            compliance: "compliance";
        }>>;
        taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        kind: z.ZodOptional<z.ZodEnum<{
            "one-off": "one-off";
            recurring: "recurring";
        }>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notify: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    pins: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                red: "red";
                amber: "amber";
                emerald: "emerald";
                sky: "sky";
                violet: "violet";
                rose: "rose";
                orange: "orange";
            }>>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            quarterly: "quarterly";
            annually: "annually";
            "on-demand": "on-demand";
        }>>>;
        dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$loose>>>;
    enrollmentDefaults: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            paused: "paused";
        }>>>;
        medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>>;
    }, z.core.$loose>>>;
    linking: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            operator: z.ZodDefault<z.ZodEnum<{
                any: "any";
                all: "all";
            }>>;
            targetGrantIds: z.ZodArray<z.ZodString>;
            behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
        }, z.core.$loose>>>;
        enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            targetGrantId: z.ZodString;
            onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
            onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoiceDocuments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    levelOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    programIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    fundingGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedProgramIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
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
export type TGrantEntity = z.infer<typeof GrantEntity> & Record<string, unknown>;
export declare const GrantsUpsertBody: z.ZodUnion<readonly [z.ZodPreprocess<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodEnum<{
        program: "program";
        grant: "grant";
    }>>;
    financialConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        model: z.ZodOptional<z.ZodEnum<{
            budgeted: "budgeted";
            billable: "billable";
            serviceOnly: "serviceOnly";
        }>>;
        budgetEnabled: z.ZodOptional<z.ZodBoolean>;
        billingEnabled: z.ZodOptional<z.ZodBoolean>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerMode: z.ZodOptional<z.ZodEnum<{
            spendDown: "spendDown";
            billing: "billing";
            none: "none";
        }>>;
    }, z.core.$loose>>>;
    duration: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lengthOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxAssistanceMonths: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
    startDate: z.ZodOptional<z.ZodUnknown>;
    endDate: z.ZodOptional<z.ZodUnknown>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
            type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
            }, z.core.$loose>>>>>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            capEnabled: z.ZodDefault<z.ZodBoolean>;
            splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                fixed: "fixed";
                none: "none";
                monthly: "monthly";
                quarterly: "quarterly";
            }>>>;
            rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                manual: "manual";
                none: "none";
                rollToNext: "rollToNext";
                rollToEnd: "rollToEnd";
                rebalanceFuture: "rebalanceFuture";
            }>>>;
            splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>>;
            display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    total: "total";
                }>>;
                displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                    total: "total";
                    currentCycle: "currentCycle";
                    both: "both";
                }>>;
                showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                appearInDigest: z.ZodOptional<z.ZodBoolean>;
                displayAs: z.ZodOptional<z.ZodEnum<{
                    main: "main";
                    nested: "nested";
                }>>;
                mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>;
                groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                expandedByDefault: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                status: z.ZodDefault<z.ZodEnum<{
                    ok: "ok";
                    warning: "warning";
                }>>;
                message: z.ZodOptional<z.ZodString>;
                splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
                descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                split: "split";
                grant: "grant";
                lineItem: "lineItem";
            }>>>;
            expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    taskTypes: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    tasks: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>;
    complianceConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            custom: "custom";
            none: "none";
            hmisCaseworthy: "hmisCaseworthy";
        }>>>;
        active: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
        inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    driveTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        fileId: z.ZodString;
        fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            other: "other";
            doc: "doc";
            sheet: "sheet";
            pdf: "pdf";
        }>>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>>>>;
    conditionalTaskRules: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            population: "population";
            age: "age";
            concurrent_enrollment: "concurrent_enrollment";
        }>;
        ageOperator: z.ZodOptional<z.ZodEnum<{
            ">=": ">=";
            "<=": "<=";
            ">": ">";
            "<": "<";
        }>>;
        ageThreshold: z.ZodOptional<z.ZodNumber>;
        programName: z.ZodOptional<z.ZodString>;
        population: z.ZodOptional<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>;
        populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>;
        taskName: z.ZodString;
        taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taskBucket: z.ZodDefault<z.ZodString>;
        dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        assignToGroup: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            casemanager: "casemanager";
            compliance: "compliance";
        }>>;
        taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        kind: z.ZodOptional<z.ZodEnum<{
            "one-off": "one-off";
            recurring: "recurring";
        }>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notify: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    pins: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                red: "red";
                amber: "amber";
                emerald: "emerald";
                sky: "sky";
                violet: "violet";
                rose: "rose";
                orange: "orange";
            }>>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            quarterly: "quarterly";
            annually: "annually";
            "on-demand": "on-demand";
        }>>>;
        dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$loose>>>;
    enrollmentDefaults: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            paused: "paused";
        }>>>;
        medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>>;
    }, z.core.$loose>>>;
    linking: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            operator: z.ZodDefault<z.ZodEnum<{
                any: "any";
                all: "all";
            }>>;
            targetGrantIds: z.ZodArray<z.ZodString>;
            behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
        }, z.core.$loose>>>;
        enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            targetGrantId: z.ZodString;
            onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
            onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoiceDocuments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    levelOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    programIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    fundingGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedProgramIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>>, z.ZodArray<z.ZodPreprocess<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodEnum<{
        program: "program";
        grant: "grant";
    }>>;
    financialConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        model: z.ZodOptional<z.ZodEnum<{
            budgeted: "budgeted";
            billable: "billable";
            serviceOnly: "serviceOnly";
        }>>;
        budgetEnabled: z.ZodOptional<z.ZodBoolean>;
        billingEnabled: z.ZodOptional<z.ZodBoolean>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerMode: z.ZodOptional<z.ZodEnum<{
            spendDown: "spendDown";
            billing: "billing";
            none: "none";
        }>>;
    }, z.core.$loose>>>;
    duration: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lengthOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxAssistanceMonths: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
    startDate: z.ZodOptional<z.ZodUnknown>;
    endDate: z.ZodOptional<z.ZodUnknown>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
            type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
            }, z.core.$loose>>>>>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            capEnabled: z.ZodDefault<z.ZodBoolean>;
            splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                fixed: "fixed";
                none: "none";
                monthly: "monthly";
                quarterly: "quarterly";
            }>>>;
            rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                manual: "manual";
                none: "none";
                rollToNext: "rollToNext";
                rollToEnd: "rollToEnd";
                rebalanceFuture: "rebalanceFuture";
            }>>>;
            splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>>;
            display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    total: "total";
                }>>;
                displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                    total: "total";
                    currentCycle: "currentCycle";
                    both: "both";
                }>>;
                showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                appearInDigest: z.ZodOptional<z.ZodBoolean>;
                displayAs: z.ZodOptional<z.ZodEnum<{
                    main: "main";
                    nested: "nested";
                }>>;
                mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>;
                groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                expandedByDefault: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                status: z.ZodDefault<z.ZodEnum<{
                    ok: "ok";
                    warning: "warning";
                }>>;
                message: z.ZodOptional<z.ZodString>;
                splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
                descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                split: "split";
                grant: "grant";
                lineItem: "lineItem";
            }>>>;
            expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    taskTypes: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    tasks: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>;
    complianceConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            custom: "custom";
            none: "none";
            hmisCaseworthy: "hmisCaseworthy";
        }>>>;
        active: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
        inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    driveTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        fileId: z.ZodString;
        fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            other: "other";
            doc: "doc";
            sheet: "sheet";
            pdf: "pdf";
        }>>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>>>>;
    conditionalTaskRules: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            population: "population";
            age: "age";
            concurrent_enrollment: "concurrent_enrollment";
        }>;
        ageOperator: z.ZodOptional<z.ZodEnum<{
            ">=": ">=";
            "<=": "<=";
            ">": ">";
            "<": "<";
        }>>;
        ageThreshold: z.ZodOptional<z.ZodNumber>;
        programName: z.ZodOptional<z.ZodString>;
        population: z.ZodOptional<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>;
        populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>;
        taskName: z.ZodString;
        taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taskBucket: z.ZodDefault<z.ZodString>;
        dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        assignToGroup: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            casemanager: "casemanager";
            compliance: "compliance";
        }>>;
        taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        kind: z.ZodOptional<z.ZodEnum<{
            "one-off": "one-off";
            recurring: "recurring";
        }>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notify: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    pins: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                red: "red";
                amber: "amber";
                emerald: "emerald";
                sky: "sky";
                violet: "violet";
                rose: "rose";
                orange: "orange";
            }>>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            quarterly: "quarterly";
            annually: "annually";
            "on-demand": "on-demand";
        }>>>;
        dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$loose>>>;
    enrollmentDefaults: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            paused: "paused";
        }>>>;
        medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>>;
    }, z.core.$loose>>>;
    linking: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            operator: z.ZodDefault<z.ZodEnum<{
                any: "any";
                all: "all";
            }>>;
            targetGrantIds: z.ZodArray<z.ZodString>;
            behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
        }, z.core.$loose>>>;
        enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            targetGrantId: z.ZodString;
            onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
            onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoiceDocuments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    levelOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    programIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    fundingGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedProgramIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>>>]>;
export declare const GrantUpsertBody: z.ZodUnion<readonly [z.ZodPreprocess<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodEnum<{
        program: "program";
        grant: "grant";
    }>>;
    financialConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        model: z.ZodOptional<z.ZodEnum<{
            budgeted: "budgeted";
            billable: "billable";
            serviceOnly: "serviceOnly";
        }>>;
        budgetEnabled: z.ZodOptional<z.ZodBoolean>;
        billingEnabled: z.ZodOptional<z.ZodBoolean>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerMode: z.ZodOptional<z.ZodEnum<{
            spendDown: "spendDown";
            billing: "billing";
            none: "none";
        }>>;
    }, z.core.$loose>>>;
    duration: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lengthOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxAssistanceMonths: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
    startDate: z.ZodOptional<z.ZodUnknown>;
    endDate: z.ZodOptional<z.ZodUnknown>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
            type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
            }, z.core.$loose>>>>>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            capEnabled: z.ZodDefault<z.ZodBoolean>;
            splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                fixed: "fixed";
                none: "none";
                monthly: "monthly";
                quarterly: "quarterly";
            }>>>;
            rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                manual: "manual";
                none: "none";
                rollToNext: "rollToNext";
                rollToEnd: "rollToEnd";
                rebalanceFuture: "rebalanceFuture";
            }>>>;
            splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>>;
            display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    total: "total";
                }>>;
                displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                    total: "total";
                    currentCycle: "currentCycle";
                    both: "both";
                }>>;
                showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                appearInDigest: z.ZodOptional<z.ZodBoolean>;
                displayAs: z.ZodOptional<z.ZodEnum<{
                    main: "main";
                    nested: "nested";
                }>>;
                mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>;
                groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                expandedByDefault: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                status: z.ZodDefault<z.ZodEnum<{
                    ok: "ok";
                    warning: "warning";
                }>>;
                message: z.ZodOptional<z.ZodString>;
                splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
                descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                split: "split";
                grant: "grant";
                lineItem: "lineItem";
            }>>>;
            expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    taskTypes: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    tasks: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>;
    complianceConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            custom: "custom";
            none: "none";
            hmisCaseworthy: "hmisCaseworthy";
        }>>>;
        active: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
        inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    driveTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        fileId: z.ZodString;
        fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            other: "other";
            doc: "doc";
            sheet: "sheet";
            pdf: "pdf";
        }>>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>>>>;
    conditionalTaskRules: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            population: "population";
            age: "age";
            concurrent_enrollment: "concurrent_enrollment";
        }>;
        ageOperator: z.ZodOptional<z.ZodEnum<{
            ">=": ">=";
            "<=": "<=";
            ">": ">";
            "<": "<";
        }>>;
        ageThreshold: z.ZodOptional<z.ZodNumber>;
        programName: z.ZodOptional<z.ZodString>;
        population: z.ZodOptional<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>;
        populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>;
        taskName: z.ZodString;
        taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taskBucket: z.ZodDefault<z.ZodString>;
        dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        assignToGroup: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            casemanager: "casemanager";
            compliance: "compliance";
        }>>;
        taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        kind: z.ZodOptional<z.ZodEnum<{
            "one-off": "one-off";
            recurring: "recurring";
        }>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notify: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    pins: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                red: "red";
                amber: "amber";
                emerald: "emerald";
                sky: "sky";
                violet: "violet";
                rose: "rose";
                orange: "orange";
            }>>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            quarterly: "quarterly";
            annually: "annually";
            "on-demand": "on-demand";
        }>>>;
        dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$loose>>>;
    enrollmentDefaults: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            paused: "paused";
        }>>>;
        medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>>;
    }, z.core.$loose>>>;
    linking: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            operator: z.ZodDefault<z.ZodEnum<{
                any: "any";
                all: "all";
            }>>;
            targetGrantIds: z.ZodArray<z.ZodString>;
            behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
        }, z.core.$loose>>>;
        enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            targetGrantId: z.ZodString;
            onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
            onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoiceDocuments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    levelOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    programIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    fundingGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedProgramIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>>, z.ZodArray<z.ZodPreprocess<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodEnum<{
        program: "program";
        grant: "grant";
    }>>;
    financialConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        model: z.ZodOptional<z.ZodEnum<{
            budgeted: "budgeted";
            billable: "billable";
            serviceOnly: "serviceOnly";
        }>>;
        budgetEnabled: z.ZodOptional<z.ZodBoolean>;
        billingEnabled: z.ZodOptional<z.ZodBoolean>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
        ledgerMode: z.ZodOptional<z.ZodEnum<{
            spendDown: "spendDown";
            billing: "billing";
            none: "none";
        }>>;
    }, z.core.$loose>>>;
    duration: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lengthOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxAssistanceMonths: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
    startDate: z.ZodOptional<z.ZodUnknown>;
    endDate: z.ZodOptional<z.ZodUnknown>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
            type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
            }, z.core.$loose>>>>>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            capEnabled: z.ZodDefault<z.ZodBoolean>;
            splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                fixed: "fixed";
                none: "none";
                monthly: "monthly";
                quarterly: "quarterly";
            }>>>;
            rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                manual: "manual";
                none: "none";
                rollToNext: "rollToNext";
                rollToEnd: "rollToEnd";
                rebalanceFuture: "rebalanceFuture";
            }>>>;
            splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>>;
            display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    total: "total";
                }>>;
                displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                    total: "total";
                    currentCycle: "currentCycle";
                    both: "both";
                }>>;
                showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                appearInDigest: z.ZodOptional<z.ZodBoolean>;
                displayAs: z.ZodOptional<z.ZodEnum<{
                    main: "main";
                    nested: "nested";
                }>>;
                mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>;
                groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                expandedByDefault: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>;
            breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                status: z.ZodDefault<z.ZodEnum<{
                    ok: "ok";
                    warning: "warning";
                }>>;
                message: z.ZodOptional<z.ZodString>;
                splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
            }, z.core.$loose>>>;
            invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
                descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    custom: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
        digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                split: "split";
                grant: "grant";
                lineItem: "lineItem";
            }>>>;
            expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>;
        allocationEnabled: z.ZodOptional<z.ZodBoolean>;
        perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$loose>>>;
    taskTypes: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    tasks: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>;
    complianceConfig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            custom: "custom";
            none: "none";
            hmisCaseworthy: "hmisCaseworthy";
        }>>>;
        active: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
        inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            field: z.ZodOptional<z.ZodString>;
            type: z.ZodDefault<z.ZodEnum<{
                boolean: "boolean";
            }>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    driveTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        fileId: z.ZodString;
        fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            other: "other";
            doc: "doc";
            sheet: "sheet";
            pdf: "pdf";
        }>>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$loose>>>>>;
    conditionalTaskRules: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            population: "population";
            age: "age";
            concurrent_enrollment: "concurrent_enrollment";
        }>;
        ageOperator: z.ZodOptional<z.ZodEnum<{
            ">=": ">=";
            "<=": "<=";
            ">": ">";
            "<": "<";
        }>>;
        ageThreshold: z.ZodOptional<z.ZodNumber>;
        programName: z.ZodOptional<z.ZodString>;
        population: z.ZodOptional<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>;
        populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>;
        taskName: z.ZodString;
        taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        taskBucket: z.ZodDefault<z.ZodString>;
        dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        assignToGroup: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            casemanager: "casemanager";
            compliance: "compliance";
        }>>;
        taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        kind: z.ZodOptional<z.ZodEnum<{
            "one-off": "one-off";
            recurring: "recurring";
        }>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notify: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    pins: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                red: "red";
                amber: "amber";
                emerald: "emerald";
                sky: "sky";
                violet: "violet";
                rose: "rose";
                orange: "orange";
            }>>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            enabled: z.ZodOptional<z.ZodBoolean>;
            custom: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            monthly: "monthly";
            quarterly: "quarterly";
            annually: "annually";
            "on-demand": "on-demand";
        }>>>;
        dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$loose>>>;
    enrollmentDefaults: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            paused: "paused";
        }>>>;
        medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>>;
    }, z.core.$loose>>>;
    linking: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            operator: z.ZodDefault<z.ZodEnum<{
                any: "any";
                all: "all";
            }>>;
            targetGrantIds: z.ZodArray<z.ZodString>;
            behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
        }, z.core.$loose>>>;
        enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            targetGrantId: z.ZodString;
            onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
            onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    invoiceDocuments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    levelOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    programIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    fundingGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedProgramIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    relatedGrantIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>>>]>;
export type TGrantsUpsertBody = z.infer<typeof GrantsUpsertBody>;
export type TGrantsUpsertResp = Ok<{
    ids: string[];
}>;
export declare const GrantsPatchRow: z.ZodPreprocess<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            program: "program";
            grant: "grant";
        }>>>;
        financialConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            model: z.ZodOptional<z.ZodEnum<{
                budgeted: "budgeted";
                billable: "billable";
                serviceOnly: "serviceOnly";
            }>>;
            budgetEnabled: z.ZodOptional<z.ZodBoolean>;
            billingEnabled: z.ZodOptional<z.ZodBoolean>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerMode: z.ZodOptional<z.ZodEnum<{
                spendDown: "spendDown";
                billing: "billing";
                none: "none";
            }>>;
        }, z.core.$loose>>>>;
        duration: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>>;
        lengthOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        maxAssistanceMonths: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>>;
        startDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        endDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
                type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodString;
                }, z.core.$loose>>>>>;
                perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                capEnabled: z.ZodDefault<z.ZodBoolean>;
                splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    custom: "custom";
                    fixed: "fixed";
                    none: "none";
                    monthly: "monthly";
                    quarterly: "quarterly";
                }>>>;
                rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    manual: "manual";
                    none: "none";
                    rollToNext: "rollToNext";
                    rollToEnd: "rollToEnd";
                    rebalanceFuture: "rebalanceFuture";
                }>>>;
                splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                    spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>>;
                display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        total: "total";
                    }>>;
                    displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                    digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                        total: "total";
                        currentCycle: "currentCycle";
                        both: "both";
                    }>>;
                    showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                    showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                    showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                    appearInDigest: z.ZodOptional<z.ZodBoolean>;
                    displayAs: z.ZodOptional<z.ZodEnum<{
                        main: "main";
                        nested: "nested";
                    }>>;
                    mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        grant: "grant";
                        lineItem: "lineItem";
                    }>>;
                    groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                    expandedByDefault: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>;
                breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    status: z.ZodDefault<z.ZodEnum<{
                        ok: "ok";
                        warning: "warning";
                    }>>;
                    message: z.ZodOptional<z.ZodString>;
                    splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                }, z.core.$loose>>>;
                invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                    descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
            digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>>;
                expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        taskTypes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        tasks: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>>;
        complianceConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                custom: "custom";
                none: "none";
                hmisCaseworthy: "hmisCaseworthy";
            }>>>;
            active: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
            inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        driveTemplates: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            fileId: z.ZodString;
            fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                other: "other";
                doc: "doc";
                sheet: "sheet";
                pdf: "pdf";
            }>>>;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>>>>;
        conditionalTaskRules: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            type: z.ZodEnum<{
                population: "population";
                age: "age";
                concurrent_enrollment: "concurrent_enrollment";
            }>;
            ageOperator: z.ZodOptional<z.ZodEnum<{
                ">=": ">=";
                "<=": "<=";
                ">": ">";
                "<": "<";
            }>>;
            ageThreshold: z.ZodOptional<z.ZodNumber>;
            programName: z.ZodOptional<z.ZodString>;
            population: z.ZodOptional<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>;
            populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>>;
            taskName: z.ZodString;
            taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            taskBucket: z.ZodDefault<z.ZodString>;
            dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            assignToGroup: z.ZodDefault<z.ZodEnum<{
                admin: "admin";
                casemanager: "casemanager";
                compliance: "compliance";
            }>>;
            taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            kind: z.ZodOptional<z.ZodEnum<{
                "one-off": "one-off";
                recurring: "recurring";
            }>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notify: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>>;
        pins: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    red: "red";
                    amber: "amber";
                    emerald: "emerald";
                    sky: "sky";
                    violet: "violet";
                    rose: "rose";
                    orange: "orange";
                }>>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoicing: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                monthly: "monthly";
                quarterly: "quarterly";
                annually: "annually";
                "on-demand": "on-demand";
            }>>>;
            dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>>;
        enrollmentDefaults: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                paused: "paused";
            }>>>;
            medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                closed: "closed";
            }>>>;
        }, z.core.$loose>>>>;
        linking: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                operator: z.ZodDefault<z.ZodEnum<{
                    any: "any";
                    all: "all";
                }>>;
                targetGrantIds: z.ZodArray<z.ZodString>;
                behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
            }, z.core.$loose>>>;
            enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                targetGrantId: z.ZodString;
                onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
                onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoiceDocuments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        levelOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        programIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        fundingGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedProgramIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
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
}, z.core.$loose>>;
export declare const GrantsPatchBody: z.ZodUnion<readonly [z.ZodPreprocess<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            program: "program";
            grant: "grant";
        }>>>;
        financialConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            model: z.ZodOptional<z.ZodEnum<{
                budgeted: "budgeted";
                billable: "billable";
                serviceOnly: "serviceOnly";
            }>>;
            budgetEnabled: z.ZodOptional<z.ZodBoolean>;
            billingEnabled: z.ZodOptional<z.ZodBoolean>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerMode: z.ZodOptional<z.ZodEnum<{
                spendDown: "spendDown";
                billing: "billing";
                none: "none";
            }>>;
        }, z.core.$loose>>>>;
        duration: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>>;
        lengthOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        maxAssistanceMonths: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>>;
        startDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        endDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
                type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodString;
                }, z.core.$loose>>>>>;
                perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                capEnabled: z.ZodDefault<z.ZodBoolean>;
                splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    custom: "custom";
                    fixed: "fixed";
                    none: "none";
                    monthly: "monthly";
                    quarterly: "quarterly";
                }>>>;
                rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    manual: "manual";
                    none: "none";
                    rollToNext: "rollToNext";
                    rollToEnd: "rollToEnd";
                    rebalanceFuture: "rebalanceFuture";
                }>>>;
                splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                    spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>>;
                display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        total: "total";
                    }>>;
                    displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                    digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                        total: "total";
                        currentCycle: "currentCycle";
                        both: "both";
                    }>>;
                    showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                    showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                    showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                    appearInDigest: z.ZodOptional<z.ZodBoolean>;
                    displayAs: z.ZodOptional<z.ZodEnum<{
                        main: "main";
                        nested: "nested";
                    }>>;
                    mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        grant: "grant";
                        lineItem: "lineItem";
                    }>>;
                    groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                    expandedByDefault: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>;
                breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    status: z.ZodDefault<z.ZodEnum<{
                        ok: "ok";
                        warning: "warning";
                    }>>;
                    message: z.ZodOptional<z.ZodString>;
                    splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                }, z.core.$loose>>>;
                invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                    descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
            digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>>;
                expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        taskTypes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        tasks: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>>;
        complianceConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                custom: "custom";
                none: "none";
                hmisCaseworthy: "hmisCaseworthy";
            }>>>;
            active: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
            inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        driveTemplates: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            fileId: z.ZodString;
            fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                other: "other";
                doc: "doc";
                sheet: "sheet";
                pdf: "pdf";
            }>>>;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>>>>;
        conditionalTaskRules: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            type: z.ZodEnum<{
                population: "population";
                age: "age";
                concurrent_enrollment: "concurrent_enrollment";
            }>;
            ageOperator: z.ZodOptional<z.ZodEnum<{
                ">=": ">=";
                "<=": "<=";
                ">": ">";
                "<": "<";
            }>>;
            ageThreshold: z.ZodOptional<z.ZodNumber>;
            programName: z.ZodOptional<z.ZodString>;
            population: z.ZodOptional<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>;
            populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>>;
            taskName: z.ZodString;
            taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            taskBucket: z.ZodDefault<z.ZodString>;
            dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            assignToGroup: z.ZodDefault<z.ZodEnum<{
                admin: "admin";
                casemanager: "casemanager";
                compliance: "compliance";
            }>>;
            taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            kind: z.ZodOptional<z.ZodEnum<{
                "one-off": "one-off";
                recurring: "recurring";
            }>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notify: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>>;
        pins: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    red: "red";
                    amber: "amber";
                    emerald: "emerald";
                    sky: "sky";
                    violet: "violet";
                    rose: "rose";
                    orange: "orange";
                }>>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoicing: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                monthly: "monthly";
                quarterly: "quarterly";
                annually: "annually";
                "on-demand": "on-demand";
            }>>>;
            dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>>;
        enrollmentDefaults: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                paused: "paused";
            }>>>;
            medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                closed: "closed";
            }>>>;
        }, z.core.$loose>>>>;
        linking: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                operator: z.ZodDefault<z.ZodEnum<{
                    any: "any";
                    all: "all";
                }>>;
                targetGrantIds: z.ZodArray<z.ZodString>;
                behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
            }, z.core.$loose>>>;
            enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                targetGrantId: z.ZodString;
                onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
                onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoiceDocuments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        levelOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        programIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        fundingGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedProgramIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
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
}, z.core.$loose>>, z.ZodArray<z.ZodPreprocess<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            program: "program";
            grant: "grant";
        }>>>;
        financialConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            model: z.ZodOptional<z.ZodEnum<{
                budgeted: "budgeted";
                billable: "billable";
                serviceOnly: "serviceOnly";
            }>>;
            budgetEnabled: z.ZodOptional<z.ZodBoolean>;
            billingEnabled: z.ZodOptional<z.ZodBoolean>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerMode: z.ZodOptional<z.ZodEnum<{
                spendDown: "spendDown";
                billing: "billing";
                none: "none";
            }>>;
        }, z.core.$loose>>>>;
        duration: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>>;
        lengthOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        maxAssistanceMonths: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>>;
        startDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        endDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
                type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodString;
                }, z.core.$loose>>>>>;
                perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                capEnabled: z.ZodDefault<z.ZodBoolean>;
                splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    custom: "custom";
                    fixed: "fixed";
                    none: "none";
                    monthly: "monthly";
                    quarterly: "quarterly";
                }>>>;
                rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    manual: "manual";
                    none: "none";
                    rollToNext: "rollToNext";
                    rollToEnd: "rollToEnd";
                    rebalanceFuture: "rebalanceFuture";
                }>>>;
                splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                    spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>>;
                display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        total: "total";
                    }>>;
                    displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                    digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                        total: "total";
                        currentCycle: "currentCycle";
                        both: "both";
                    }>>;
                    showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                    showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                    showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                    appearInDigest: z.ZodOptional<z.ZodBoolean>;
                    displayAs: z.ZodOptional<z.ZodEnum<{
                        main: "main";
                        nested: "nested";
                    }>>;
                    mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        grant: "grant";
                        lineItem: "lineItem";
                    }>>;
                    groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                    expandedByDefault: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>;
                breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    status: z.ZodDefault<z.ZodEnum<{
                        ok: "ok";
                        warning: "warning";
                    }>>;
                    message: z.ZodOptional<z.ZodString>;
                    splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                }, z.core.$loose>>>;
                invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                    descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
            digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>>;
                expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        taskTypes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        tasks: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>>;
        complianceConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                custom: "custom";
                none: "none";
                hmisCaseworthy: "hmisCaseworthy";
            }>>>;
            active: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
            inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        driveTemplates: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            fileId: z.ZodString;
            fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                other: "other";
                doc: "doc";
                sheet: "sheet";
                pdf: "pdf";
            }>>>;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>>>>;
        conditionalTaskRules: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            type: z.ZodEnum<{
                population: "population";
                age: "age";
                concurrent_enrollment: "concurrent_enrollment";
            }>;
            ageOperator: z.ZodOptional<z.ZodEnum<{
                ">=": ">=";
                "<=": "<=";
                ">": ">";
                "<": "<";
            }>>;
            ageThreshold: z.ZodOptional<z.ZodNumber>;
            programName: z.ZodOptional<z.ZodString>;
            population: z.ZodOptional<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>;
            populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>>;
            taskName: z.ZodString;
            taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            taskBucket: z.ZodDefault<z.ZodString>;
            dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            assignToGroup: z.ZodDefault<z.ZodEnum<{
                admin: "admin";
                casemanager: "casemanager";
                compliance: "compliance";
            }>>;
            taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            kind: z.ZodOptional<z.ZodEnum<{
                "one-off": "one-off";
                recurring: "recurring";
            }>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notify: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>>;
        pins: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    red: "red";
                    amber: "amber";
                    emerald: "emerald";
                    sky: "sky";
                    violet: "violet";
                    rose: "rose";
                    orange: "orange";
                }>>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoicing: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                monthly: "monthly";
                quarterly: "quarterly";
                annually: "annually";
                "on-demand": "on-demand";
            }>>>;
            dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>>;
        enrollmentDefaults: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                paused: "paused";
            }>>>;
            medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                closed: "closed";
            }>>>;
        }, z.core.$loose>>>>;
        linking: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                operator: z.ZodDefault<z.ZodEnum<{
                    any: "any";
                    all: "all";
                }>>;
                targetGrantIds: z.ZodArray<z.ZodString>;
                behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
            }, z.core.$loose>>>;
            enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                targetGrantId: z.ZodString;
                onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
                onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoiceDocuments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        levelOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        programIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        fundingGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedProgramIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
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
}, z.core.$loose>>>]>;
export declare const GrantPatchBody: z.ZodUnion<readonly [z.ZodPreprocess<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            program: "program";
            grant: "grant";
        }>>>;
        financialConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            model: z.ZodOptional<z.ZodEnum<{
                budgeted: "budgeted";
                billable: "billable";
                serviceOnly: "serviceOnly";
            }>>;
            budgetEnabled: z.ZodOptional<z.ZodBoolean>;
            billingEnabled: z.ZodOptional<z.ZodBoolean>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerMode: z.ZodOptional<z.ZodEnum<{
                spendDown: "spendDown";
                billing: "billing";
                none: "none";
            }>>;
        }, z.core.$loose>>>>;
        duration: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>>;
        lengthOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        maxAssistanceMonths: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>>;
        startDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        endDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
                type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodString;
                }, z.core.$loose>>>>>;
                perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                capEnabled: z.ZodDefault<z.ZodBoolean>;
                splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    custom: "custom";
                    fixed: "fixed";
                    none: "none";
                    monthly: "monthly";
                    quarterly: "quarterly";
                }>>>;
                rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    manual: "manual";
                    none: "none";
                    rollToNext: "rollToNext";
                    rollToEnd: "rollToEnd";
                    rebalanceFuture: "rebalanceFuture";
                }>>>;
                splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                    spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>>;
                display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        total: "total";
                    }>>;
                    displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                    digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                        total: "total";
                        currentCycle: "currentCycle";
                        both: "both";
                    }>>;
                    showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                    showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                    showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                    appearInDigest: z.ZodOptional<z.ZodBoolean>;
                    displayAs: z.ZodOptional<z.ZodEnum<{
                        main: "main";
                        nested: "nested";
                    }>>;
                    mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        grant: "grant";
                        lineItem: "lineItem";
                    }>>;
                    groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                    expandedByDefault: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>;
                breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    status: z.ZodDefault<z.ZodEnum<{
                        ok: "ok";
                        warning: "warning";
                    }>>;
                    message: z.ZodOptional<z.ZodString>;
                    splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                }, z.core.$loose>>>;
                invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                    descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
            digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>>;
                expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        taskTypes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        tasks: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>>;
        complianceConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                custom: "custom";
                none: "none";
                hmisCaseworthy: "hmisCaseworthy";
            }>>>;
            active: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
            inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        driveTemplates: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            fileId: z.ZodString;
            fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                other: "other";
                doc: "doc";
                sheet: "sheet";
                pdf: "pdf";
            }>>>;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>>>>;
        conditionalTaskRules: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            type: z.ZodEnum<{
                population: "population";
                age: "age";
                concurrent_enrollment: "concurrent_enrollment";
            }>;
            ageOperator: z.ZodOptional<z.ZodEnum<{
                ">=": ">=";
                "<=": "<=";
                ">": ">";
                "<": "<";
            }>>;
            ageThreshold: z.ZodOptional<z.ZodNumber>;
            programName: z.ZodOptional<z.ZodString>;
            population: z.ZodOptional<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>;
            populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>>;
            taskName: z.ZodString;
            taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            taskBucket: z.ZodDefault<z.ZodString>;
            dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            assignToGroup: z.ZodDefault<z.ZodEnum<{
                admin: "admin";
                casemanager: "casemanager";
                compliance: "compliance";
            }>>;
            taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            kind: z.ZodOptional<z.ZodEnum<{
                "one-off": "one-off";
                recurring: "recurring";
            }>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notify: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>>;
        pins: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    red: "red";
                    amber: "amber";
                    emerald: "emerald";
                    sky: "sky";
                    violet: "violet";
                    rose: "rose";
                    orange: "orange";
                }>>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoicing: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                monthly: "monthly";
                quarterly: "quarterly";
                annually: "annually";
                "on-demand": "on-demand";
            }>>>;
            dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>>;
        enrollmentDefaults: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                paused: "paused";
            }>>>;
            medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                closed: "closed";
            }>>>;
        }, z.core.$loose>>>>;
        linking: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                operator: z.ZodDefault<z.ZodEnum<{
                    any: "any";
                    all: "all";
                }>>;
                targetGrantIds: z.ZodArray<z.ZodString>;
                behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
            }, z.core.$loose>>>;
            enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                targetGrantId: z.ZodString;
                onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
                onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoiceDocuments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        levelOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        programIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        fundingGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedProgramIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
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
}, z.core.$loose>>, z.ZodArray<z.ZodPreprocess<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            program: "program";
            grant: "grant";
        }>>>;
        financialConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            model: z.ZodOptional<z.ZodEnum<{
                budgeted: "budgeted";
                billable: "billable";
                serviceOnly: "serviceOnly";
            }>>;
            budgetEnabled: z.ZodOptional<z.ZodBoolean>;
            billingEnabled: z.ZodOptional<z.ZodBoolean>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerEnabled: z.ZodOptional<z.ZodBoolean>;
            ledgerMode: z.ZodOptional<z.ZodEnum<{
                spendDown: "spendDown";
                billing: "billing";
                none: "none";
            }>>;
        }, z.core.$loose>>>>;
        duration: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>>;
        lengthOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        maxAssistanceMonths: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>>;
        startDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        endDate: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
        budget: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
            totals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                total: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                projected: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                spent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                projectedSpend: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
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
                type: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodNullable<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodString;
                }, z.core.$loose>>>>>;
                perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                capEnabled: z.ZodDefault<z.ZodBoolean>;
                splitMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    custom: "custom";
                    fixed: "fixed";
                    none: "none";
                    monthly: "monthly";
                    quarterly: "quarterly";
                }>>>;
                rollForward: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    manual: "manual";
                    none: "none";
                    rollToNext: "rollToNext";
                    rollToEnd: "rollToEnd";
                    rebalanceFuture: "rebalanceFuture";
                }>>>;
                splitStartDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitEndDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                splitGoals: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodOptional<z.ZodString>;
                    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    amount: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
                    spent: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projected: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    balance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    projectedBalance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    includeAllBudgetItems: z.ZodOptional<z.ZodBoolean>;
                    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>>;
                display: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    cycleDisplayMode: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        total: "total";
                    }>>;
                    displayOnDigest: z.ZodOptional<z.ZodBoolean>;
                    digestDisplayMode: z.ZodOptional<z.ZodEnum<{
                        total: "total";
                        currentCycle: "currentCycle";
                        both: "both";
                    }>>;
                    showGrantTotal: z.ZodOptional<z.ZodBoolean>;
                    showLineItemTotal: z.ZodOptional<z.ZodBoolean>;
                    showSplitGoals: z.ZodOptional<z.ZodBoolean>;
                    appearInDigest: z.ZodOptional<z.ZodBoolean>;
                    displayAs: z.ZodOptional<z.ZodEnum<{
                        main: "main";
                        nested: "nested";
                    }>>;
                    mainDisplayLevel: z.ZodOptional<z.ZodEnum<{
                        split: "split";
                        grant: "grant";
                        lineItem: "lineItem";
                    }>>;
                    groupUnderParentGrant: z.ZodOptional<z.ZodBoolean>;
                    expandedByDefault: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$loose>>>;
                breakdownValidation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    status: z.ZodDefault<z.ZodEnum<{
                        ok: "ok";
                        warning: "warning";
                    }>>;
                    message: z.ZodOptional<z.ZodString>;
                    splitTotal: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                    variance: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
                }, z.core.$loose>>>;
                invoicing: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    hmisCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                    descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        label: z.ZodString;
                        code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                        enabled: z.ZodOptional<z.ZodBoolean>;
                        custom: z.ZodOptional<z.ZodBoolean>;
                    }, z.core.$loose>>>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
            digestDisplay: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                showOverallSummary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                showGrantTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                mainDisplayLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    split: "split";
                    grant: "grant";
                    lineItem: "lineItem";
                }>>>;
                expandNestedRowsByDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                groupChildrenUnderParentGrant: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$loose>>>;
            allocationEnabled: z.ZodOptional<z.ZodBoolean>;
            perCustomerCap: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$loose>>>>;
        taskTypes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        tasks: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>>>;
        complianceConfig: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            preset: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                custom: "custom";
                none: "none";
                hmisCaseworthy: "hmisCaseworthy";
            }>>>;
            active: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
            inactive: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                field: z.ZodOptional<z.ZodString>;
                type: z.ZodDefault<z.ZodEnum<{
                    boolean: "boolean";
                }>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        driveTemplates: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            fileId: z.ZodString;
            fileUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                other: "other";
                doc: "doc";
                sheet: "sheet";
                pdf: "pdf";
            }>>>;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            defaultChecked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$loose>>>>>>;
        conditionalTaskRules: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            type: z.ZodEnum<{
                population: "population";
                age: "age";
                concurrent_enrollment: "concurrent_enrollment";
            }>;
            ageOperator: z.ZodOptional<z.ZodEnum<{
                ">=": ">=";
                "<=": "<=";
                ">": ">";
                "<": "<";
            }>>;
            ageThreshold: z.ZodOptional<z.ZodNumber>;
            programName: z.ZodOptional<z.ZodString>;
            population: z.ZodOptional<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>;
            populations: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                Youth: "Youth";
                Individual: "Individual";
                Family: "Family";
            }>>>;
            taskName: z.ZodString;
            taskDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            taskBucket: z.ZodDefault<z.ZodString>;
            dueOffsetDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            assignToGroup: z.ZodDefault<z.ZodEnum<{
                admin: "admin";
                casemanager: "casemanager";
                compliance: "compliance";
            }>>;
            taskNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            kind: z.ZodOptional<z.ZodEnum<{
                "one-off": "one-off";
                recurring: "recurring";
            }>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            every: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notify: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>>;
        pins: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            digest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            rentalAssistance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            invoice: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            important: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                color: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    red: "red";
                    amber: "amber";
                    emerald: "emerald";
                    sky: "sky";
                    violet: "violet";
                    rose: "rose";
                    orange: "orange";
                }>>>;
                note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                pinnedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                    seconds: z.ZodNumber;
                    nanoseconds: z.ZodNumber;
                }, z.core.$strip>]>>>;
                pinnedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoicing: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            grantCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            functionalGroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            expenseCategories: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            descriptionTemplates: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                template: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                enabled: z.ZodOptional<z.ZodBoolean>;
                custom: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$loose>>>>;
            invoiceCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            programCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            contractNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            vendorNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderContact: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            funderEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            frequency: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                monthly: "monthly";
                quarterly: "quarterly";
                annually: "annually";
                "on-demand": "on-demand";
            }>>>;
            dueDayOfMonth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            paymentTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            billingAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            submissionPortal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reportingNotes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$loose>>>>;
        enrollmentDefaults: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            authorizationMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                paused: "paused";
            }>>>;
            medicaidStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                active: "active";
                closed: "closed";
            }>>>;
        }, z.core.$loose>>>>;
        linking: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            cycle: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                previousGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                nextGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
            enrollmentRequirement: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                operator: z.ZodDefault<z.ZodEnum<{
                    any: "any";
                    all: "all";
                }>>;
                targetGrantIds: z.ZodArray<z.ZodString>;
                behavior: z.ZodDefault<z.ZodLiteral<"warnOnly">>;
            }, z.core.$loose>>>;
            enrollmentRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                targetGrantId: z.ZodString;
                onEnroll: z.ZodDefault<z.ZodLiteral<"ensureActive">>;
                onAllSourcesClosed: z.ZodDefault<z.ZodLiteral<"flagShouldUnenroll">>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        invoiceDocuments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
        levelOfAssistance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        programIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        fundingGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedProgramIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        relatedGrantIds: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
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
}, z.core.$loose>>>]>;
export type TGrantsPatchRow = z.infer<typeof GrantsPatchRow>;
export type TGrantsPatchBody = z.infer<typeof GrantsPatchBody>;
export type TGrantsPatchResp = Ok<{
    ids: string[];
}>;
export declare const GrantsDeleteBody: z.ZodPreprocess<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodString>, z.ZodArray<z.ZodPreprocess<z.ZodString>>]>>;
export type TGrantsDeleteBody = z.infer<typeof GrantsDeleteBody>;
export type TGrantsDeleteResp = Ok<{
    ids: string[];
    deleted: true;
}>;
export declare const GrantsAdminDeleteBody: z.ZodPreprocess<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodString>, z.ZodArray<z.ZodPreprocess<z.ZodString>>]>>;
export type TGrantsAdminDeleteBody = z.infer<typeof GrantsAdminDeleteBody>;
export type TGrantsAdminDeleteResp = Ok<{
    ids: string[];
    deleted: true;
}>;
export declare const GrantsListQuery: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodUnion<readonly [z.ZodLiteral<true>, z.ZodLiteral<false>]>>, z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>, z.ZodString]>>;
    kind: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        program: "program";
        grant: "grant";
    }>, z.ZodString]>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    cursorUpdatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    cursorId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TGrantsListQuery = z.infer<typeof GrantsListQuery>;
export type TGrantsListResp = Ok<{
    items: TGrantEntity[];
    next: {
        cursorUpdatedAt: unknown;
        cursorId: string;
    } | null;
    orgId: string;
}>;
export declare const GrantsGetQuery: z.ZodObject<{
    id: z.ZodPreprocess<z.ZodString>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TGrantsGetQuery = z.infer<typeof GrantsGetQuery>;
export type TGrantsGetResp = Ok<{
    grant: TGrantEntity;
}>;
export type TGrantsStructureResp = Ok<{
    structure: Partial<TGrant>;
}>;
export declare const GrantsActivityQuery: z.ZodObject<{
    grantId: z.ZodPreprocess<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    cursor: z.ZodOptional<z.ZodString>;
    includeProjected: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>, z.ZodString]>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TGrantsActivityQuery = z.infer<typeof GrantsActivityQuery>;
export type TGrantsActivityItem = {
    id: string;
    kind: "spend" | "reversal" | "projection";
    sourceType?: "ledger" | "paymentQueue" | "legacySpend";
    grantId: string;
    enrollmentId: string;
    paymentId?: string | null;
    lineItemId?: string | null;
    amount: number;
    note?: string | null;
    ts: string;
    by?: unknown | null;
    reversalOf?: string | null;
    queueStatus?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    customerNameAtSpend?: string | null;
    grantNameAtSpend?: string | null;
    lineItemLabelAtSpend?: string | null;
    paymentLabelAtSpend?: string | null;
    ledgerEntry?: Record<string, unknown> | null;
    paymentQueueItem?: Record<string, unknown> | null;
};
export type TGrantsActivityResp = Ok<{
    items: TGrantsActivityItem[];
    next?: {
        cursor: string;
    } | null;
    counts?: {
        total: number;
        ledger: number;
        projected: number;
        legacy: number;
    };
}>;
export declare const GrantsAdminPreviewQuery: z.ZodObject<{
    grantId: z.ZodPreprocess<z.ZodString>;
}, z.core.$strip>;
export type TGrantsAdminPreviewQuery = z.infer<typeof GrantsAdminPreviewQuery>;
type AmountCount = {
    count: number;
    amount: number;
};
export type TGrantsAdminPreviewResp = Ok<{
    ledger: {
        enrollmentSpends: AmountCount;
        ccInvoice: AmountCount;
    };
    paymentQueue: {
        projections: AmountCount;
        ccInvoice: AmountCount;
    };
    spendMirrors: AmountCount;
    enrollments: {
        active: number;
        inactive: number;
        deleted: number;
        total: number;
    };
    currentBudget: {
        total: number;
        spent: number;
        projected: number;
        balance: number;
        projectedBalance: number;
    };
}>;
export declare const GrantsAdminClearPaymentsBody: z.ZodObject<{
    grantId: z.ZodPreprocess<z.ZodString>;
    confirm: z.ZodLiteral<"DELETE">;
}, z.core.$strip>;
export type TGrantsAdminClearPaymentsBody = z.infer<typeof GrantsAdminClearPaymentsBody>;
export type TGrantsAdminClearPaymentsResp = Ok<{
    deleted: {
        ledger: number;
        paymentQueue: number;
        spendMirrors: number;
    };
    skipped: {
        ledger: number;
        paymentQueue: number;
    };
    totals: Record<string, number>;
    counts: {
        ledger: number;
        paymentQueue: number;
    };
}>;
export declare const GrantsAdminClearEnrollmentsBody: z.ZodObject<{
    grantId: z.ZodPreprocess<z.ZodString>;
    confirm: z.ZodLiteral<"DELETE">;
    statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        deleted: "deleted";
    }>>>;
}, z.core.$strip>;
export type TGrantsAdminClearEnrollmentsBody = z.infer<typeof GrantsAdminClearEnrollmentsBody>;
export type TGrantsAdminClearEnrollmentsResp = Ok<{
    cleared: {
        enrollments: number;
        paymentQueue: number;
        spendMirrors: number;
    };
    skipped: {
        enrollments: number;
    };
}>;
export declare const GrantsAdminReconcileBudgetBody: z.ZodObject<{
    grantId: z.ZodPreprocess<z.ZodString>;
}, z.core.$strip>;
export type TGrantsAdminReconcileBudgetBody = z.infer<typeof GrantsAdminReconcileBudgetBody>;
export type TGrantsAdminReconcileBudgetResp = Ok<{
    totals: Record<string, number>;
    counts: {
        ledger: number;
        paymentQueue: number;
    };
}>;
