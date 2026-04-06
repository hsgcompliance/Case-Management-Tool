// functions/src/features/jotform/schemas.ts

// Core (one place for z + helpers)
export { z, toArray } from "@hdb/contracts";

// Runtime schemas (back-compat names preserved)
export {
  JotformSubmission,
  JotformSubmissionStatus,
  JotformSubmissionSource,
  JotformBudget,
  JotformBudgetLineItem,
  JotformBudgetTotals,
  JotformSubmissionCalc,

  JotformSubmissionsUpsertBody,
  JotformSubmissionUpsertBody, // back-compat
  JotformSubmissionsPatchBody,
  JotformSubmissionPatchBody, // back-compat

  JotformSubmissionsDeleteBody,
  JotformSubmissionsAdminDeleteBody,

  JotformSubmissionsListQuery,
  JotformSubmissionsGetQuery,
  JotformFormsListQuery,
  JotformLinkSubmissionBody,
  JotformSyncSelectionBody,
  JotformFormSummary,
  JotformDigestMap,
  JotformDigestField,
  JotformDigestSection,
  JotformDigestHeader,
  JotformDigestUpsertBody,
  JotformDigestGetQuery,
  JotformDigestListQuery,
  JotformSyncBody,
} from "@hdb/contracts/jotform";

// Types
export type {
  TJotformSubmission,
  TJotformSubmissionEntity,
  TJotformSubmissionStatus,
  TJotformSubmissionSource,
  TJotformBudget,
  TJotformBudgetLineItem,
  TJotformBudgetTotals,
  TJotformSubmissionCalc,

  TJotformSubmissionsUpsertBody,
  TJotformSubmissionsPatchBody,
  TJotformSubmissionsDeleteBody,
  TJotformSubmissionsAdminDeleteBody,
  TJotformSubmissionsListQuery,
  TJotformSubmissionsGetQuery,
  TJotformFormsListQuery,
  TJotformFormSummary,
  TJotformLinkSubmissionBody,
  TJotformLinkSubmissionResp,
  TJotformSyncSelectionBody,
  TJotformSyncSelectionResp,
  TJotformDigestMap,
  TJotformDigestField,
  TJotformDigestSection,
  TJotformDigestHeader,
  TJotformDigestUpsertBody,
  TJotformDigestUpsertResp,
  TJotformDigestGetQuery,
  TJotformDigestGetResp,
  TJotformDigestListQuery,
  TJotformDigestListResp,
  TJotformSyncBody,
} from "@hdb/contracts/jotform";

