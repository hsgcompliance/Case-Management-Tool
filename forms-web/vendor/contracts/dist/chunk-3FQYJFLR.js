import {
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/grantBudgetManager.ts
var grantBudgetManager_exports = {};
__export(grantBudgetManager_exports, {
  GrantBudgetManagerLineItem: () => GrantBudgetManagerLineItem,
  GrantBudgetManagerLoadBody: () => GrantBudgetManagerLoadBody,
  GrantBudgetManagerOriginal: () => GrantBudgetManagerOriginal,
  GrantBudgetManagerReconcileBody: () => GrantBudgetManagerReconcileBody,
  GrantBudgetManagerRollup: () => GrantBudgetManagerRollup,
  GrantBudgetManagerRow: () => GrantBudgetManagerRow,
  GrantBudgetManagerSaveBody: () => GrantBudgetManagerSaveBody,
  GrantBudgetManagerSaveMode: () => GrantBudgetManagerSaveMode,
  GrantBudgetManagerSourceType: () => GrantBudgetManagerSourceType
});
var GrantBudgetManagerSourceType = z.enum(["ledger", "paymentQueue", "newProjection"]);
var GrantBudgetManagerSaveMode = z.enum(["preview", "applyOpen", "applyAll"]);
var GrantBudgetManagerOriginal = z.object({
  grantId: z.string().nullable().optional(),
  lineItemId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  caseManagerId: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  serviceDate: z.string().nullable().optional(),
  paymentDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
}).passthrough();
var GrantBudgetManagerRow = z.object({
  rowId: z.string().min(1),
  sourceType: GrantBudgetManagerSourceType,
  sourceId: z.string().optional().default(""),
  ledgerItemId: z.string().nullable().optional(),
  paymentQueueItemId: z.string().nullable().optional(),
  enrollmentId: z.string().nullable().optional(),
  paymentId: z.string().nullable().optional(),
  rentCertDueOn: z.string().nullable().optional(),
  grantId: z.string().min(1),
  lineItemId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  caseManagerId: z.string().nullable().optional(),
  caseManagerName: z.string().nullable().optional(),
  amount: z.coerce.number(),
  date: z.string().nullable().optional(),
  serviceDate: z.string().nullable().optional(),
  paymentDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  reversalOf: z.string().nullable().optional(),
  reversedByLedgerItemIds: z.array(z.string()).optional(),
  isWritable: z.boolean().optional().default(false),
  lockedReason: z.string().nullable().optional(),
  rowState: z.enum(["clean", "changed", "new", "deleted"]).optional().default("clean"),
  original: GrantBudgetManagerOriginal.optional()
}).passthrough();
var GrantBudgetManagerLineItem = z.object({
  grantId: z.string(),
  id: z.string(),
  label: z.string(),
  typeLabel: z.string().optional().default(""),
  budget: z.number().optional().default(0),
  locked: z.boolean().optional().default(false)
});
var GrantBudgetManagerRollup = z.object({
  grantId: z.string(),
  lineItemId: z.string().nullable().optional(),
  budget: z.number().default(0),
  spent: z.number().default(0),
  projected: z.number().default(0),
  total: z.number().default(0),
  remaining: z.number().default(0)
});
var GrantBudgetManagerLoadBody = z.object({
  grantIds: z.array(z.string().min(1)).min(1).max(50)
});
var GrantBudgetManagerSaveBody = z.object({
  mode: GrantBudgetManagerSaveMode,
  grantIds: z.array(z.string().min(1)).min(1).max(50),
  rows: z.array(GrantBudgetManagerRow).max(5e3),
  reason: z.string().trim().optional(),
  loadedAt: z.string().trim().optional()
});
var GrantBudgetManagerReconcileBody = z.object({
  grantIds: z.array(z.string().min(1)).min(1).max(50)
});

export {
  GrantBudgetManagerSourceType,
  GrantBudgetManagerSaveMode,
  GrantBudgetManagerOriginal,
  GrantBudgetManagerRow,
  GrantBudgetManagerLineItem,
  GrantBudgetManagerRollup,
  GrantBudgetManagerLoadBody,
  GrantBudgetManagerSaveBody,
  GrantBudgetManagerReconcileBody,
  grantBudgetManager_exports
};
