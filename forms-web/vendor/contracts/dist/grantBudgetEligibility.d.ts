export type GrantBudgetTransactionState = "spent" | "projected";
export type GrantBudgetEligibilityReason = "eligible" | "not-assigned-to-grant" | "missing-transaction-date" | "before-grant-start" | "after-grant-end" | "missing-line-item-assignment" | "unknown-line-item" | "outside-spending-cycle" | "voided" | "posted-queue-shadow";
export type GrantBudgetSpendingCycle = {
    id?: unknown;
    startDate?: unknown;
    endDate?: unknown;
};
export type GrantBudgetLineItemConfig = {
    id?: unknown;
    splitGoals?: GrantBudgetSpendingCycle[] | null;
};
export type GrantBudgetEligibilityGrant = {
    id?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    budget?: {
        lineItems?: GrantBudgetLineItemConfig[] | null;
    } | null;
};
export type GrantBudgetEligibilityTransaction = {
    grantId?: unknown;
    lineItemId?: unknown;
    transactionDate?: unknown;
    dueDate?: unknown;
    date?: unknown;
    paymentDate?: unknown;
    serviceDate?: unknown;
    postedAt?: unknown;
    createdAt?: unknown;
    updatedAtISO?: unknown;
    updatedAt?: unknown;
    ts?: unknown;
    queueStatus?: unknown;
};
export type GrantBudgetEligibilityOverride = {
    approved: true;
    approvedBy: string;
    approvedAt: string;
    reason: string;
};
export type GrantBudgetEligibilityResult = {
    assignedToGrant: boolean;
    assignedToLineItem: boolean;
    eligibleForGrantTotals: boolean;
    eligibleForSpendingCycleTotals: boolean;
    transactionDate: string;
    transactionDateSource: string | null;
    grantStartDate: string;
    grantEndDate: string;
    lineItemId: string;
    spendingCycleId: string | null;
    status: "eligible" | "ineligible";
    reason: GrantBudgetEligibilityReason;
    reasonLabel: string;
    suggestedCorrectiveWorkflow: "none" | "assign-grant" | "assign-line-item" | "review-date" | "reassign-transaction";
    overrideApplied: boolean;
};
/** Preserve an explicit YYYY-MM-DD calendar value before falling back to UTC. */
export declare function grantBudgetIsoDate(value: unknown): string;
/**
 * Transaction date precedence is shared by queue, ledger, pipeline, and grant UI:
 * explicit transaction/service dates first, posting dates second, creation dates last.
 */
export declare function resolveGrantBudgetTransactionDate(row: GrantBudgetEligibilityTransaction): {
    date: string;
    source: string | null;
};
export declare function evaluateGrantBudgetEligibility(args: {
    transaction: GrantBudgetEligibilityTransaction;
    grant: GrantBudgetEligibilityGrant;
    sourceType?: "ledger" | "paymentQueue" | "legacySpend";
    requireLineItem?: boolean;
    override?: GrantBudgetEligibilityOverride | null;
}): GrantBudgetEligibilityResult;
