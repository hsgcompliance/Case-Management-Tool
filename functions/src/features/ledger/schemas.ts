// functions/src/features/ledger/schemas.ts
import { z } from "@hdb/contracts";
export { z };

export {
  LedgerSource,
  LedgerOrigin,
  LedgerEntry,
  LedgerListBody,
  LedgerCreateBody,
  LedgerClassifyItem,
  LedgerClassifyBody,
  LedgerAutoAssignBody,
  LedgerGetByIdParams,
  LedgerBalanceQuery,
} from "@hdb/contracts/ledger";

export { TsLike } from "@hdb/contracts";

export type {
  TLedgerSource,
  TLedgerEntry,
  TLedgerListBody,
  TLedgerCreateBody,
  TLedgerClassifyItem,
  TLedgerClassifyBody,
  TLedgerClassifyResp,
  TLedgerAutoAssignBody,
  TLedgerAutoAssignResp,
  TLedgerGetByIdParams,
  TLedgerBalanceQuery,
} from "@hdb/contracts/ledger";

// ─── Bulk direct adjust (admin) ─────────────────────────────────────────────
//
// Edit existing ledger entries in place (no reversal + respend). Every field is
// optional: a present key is applied (null clears it), an absent key is left
// untouched. grantId/lineItemId must end up paired (both set or both cleared).
export const LedgerBulkAdjustItemBody = z.object({
  entryId: z.string().min(1),
  amountCents: z.coerce.number().int().optional(),
  amount: z.coerce.number().optional(),
  grantId: z.string().nullable().optional(),
  lineItemId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  enrollmentId: z.string().nullable().optional(),
  creditCardId: z.string().nullable().optional(),
  caseManagerId: z.string().nullable().optional(),
  note: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  vendor: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().optional(), // YYYY-MM-DD; also updates date + month
});
export type TLedgerBulkAdjustItem = z.infer<typeof LedgerBulkAdjustItemBody>;

export const LedgerBulkAdjustBody = z.object({
  items: z.array(LedgerBulkAdjustItemBody).min(1).max(1000),
  reason: z.string().trim().optional(),
  dryRun: z.boolean().optional().default(false),
});
export type TLedgerBulkAdjustBody = z.infer<typeof LedgerBulkAdjustBody>;
