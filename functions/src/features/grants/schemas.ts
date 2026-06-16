// functions/src/features/grants/schemas.ts

// Core (one place for z + helpers)
export { z, toArray } from "@hdb/contracts";

// Runtime schemas (back-compat names preserved)
export {
  Grant,
  GrantStatus,
  GrantKind,
  GrantFinancialModel,
  GrantLedgerMode,
  GrantFinancialConfig,
  GrantFinancialConfigPatch,
  GrantCompliancePreset,
  GrantComplianceControl,
  GrantComplianceConfig,
  GrantDriveTemplate,
  normalizeGrantDriveTemplates,
  GrantTaskDefinitions,
  normalizeGrantFinancialConfig,
  normalizeGrantComplianceConfig,
  getGrantFinancialCapabilities,
  shouldRetainGrantBudget,
  getGrantLineItemAmountSemantics,
  computeGrantLineItemOverCap,
  parseGrantMaxAssistanceMonths,
  GrantLineItemType,
  GrantBudget,
  GrantBudgetLineItem,
  GrantBudgetTotals,

  GrantsUpsertBody,
  GrantUpsertBody,   // back-compat
  GrantsPatchBody,
  GrantPatchBody,    // back-compat

  GrantsDeleteBody,
  GrantsAdminDeleteBody,

  GrantsListQuery,
  GrantsGetQuery,
  GrantsActivityQuery,
} from "@hdb/contracts/grants";

// Types
export type {
  TGrant,
  TGrantEntity,
  TGrantStatus,
  TGrantKind,
  TGrantFinancialModel,
  TGrantLedgerMode,
  TGrantFinancialConfig,
  TGrantFinancialConfigPatch,
  TGrantCompliancePreset,
  TGrantComplianceControl,
  TGrantComplianceConfig,
  TGrantDriveTemplate,
  TGrantTaskDefinitions,
  TGrantFinancialCapabilities,
  TGrantLineItemAmountSemantics,
  TGrantLineItemType,
  TGrantBudget,
  TGrantBudgetLineItem,
  TGrantBudgetTotals,

  TGrantsUpsertBody,
  TGrantsPatchBody,
  TGrantsDeleteBody,
  TGrantsAdminDeleteBody,
  TGrantsListQuery,
  TGrantsGetQuery,
  TGrantsActivityQuery,
} from "@hdb/contracts";
