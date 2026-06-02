import { getGrantFinancialCapabilities, shouldRetainGrantBudget } from "@hdb/contracts";
import type { TGrant as Grant } from "@types";

export function getGrantFinancialVisibility(grant: Partial<Grant> | null | undefined) {
  const capabilities = getGrantFinancialCapabilities((grant || {}) as Record<string, unknown>);
  return {
    capabilities,
    showBudgetWorkspace: capabilities.hasFinancialActivity,
    showBudgetEditor: capabilities.budgetEnabled,
    showBillingActivity: capabilities.billingEnabled || capabilities.usesBillingLedger,
    showLedgerActivity: capabilities.ledgerEnabled,
    showAllocation: capabilities.allocationEnabled,
  };
}

export function shouldShowInBudgetWorkspace(grant: Partial<Grant> | null | undefined) {
  return getGrantFinancialVisibility(grant).showBudgetWorkspace;
}

export function shouldRetainBudgetForGrantForm(grant: Partial<Grant> | null | undefined) {
  return shouldRetainGrantBudget((grant || {}) as Record<string, unknown>);
}
