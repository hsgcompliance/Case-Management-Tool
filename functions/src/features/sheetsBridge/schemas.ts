import {z} from "../../core/z";

export const SheetsBridgeInterfaceId = z.enum([
  "grants",
  "grantLineItems",
  "paymentQueue",
]);
export type TSheetsBridgeInterfaceId = "grants" | "grantLineItems" | "paymentQueue";

export const SheetsBridgePullQuery = z.object({
  orgId: z.string().trim().min(1),
  interfaceId: SheetsBridgeInterfaceId,
  grantId: z.string().trim().min(1).optional(),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.string().trim().optional(),
  queueStatus: z.enum(["pending", "posted", "void"]).optional(),
  source: z.enum(["credit-card", "invoice", "projection", "unknown"]).optional(),
  active: z.preprocess((value) => {
    if (value == null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    const raw = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y", "active"].includes(raw)) return true;
    if (["false", "0", "no", "n", "inactive"].includes(raw)) return false;
    return value;
  }, z.boolean().optional()),
  includeDeleted: z.preprocess((value) => {
    if (value == null || value === "") return false;
    if (typeof value === "boolean") return value;
    const raw = String(value).trim().toLowerCase();
    return ["true", "1", "yes", "y"].includes(raw);
  }, z.boolean().default(false)),
  limit: z.coerce.number().int().min(1).max(1000).default(250),
  cursor: z.string().trim().optional(),
});
export type TSheetsBridgePullQuery = {
  orgId: string;
  interfaceId: TSheetsBridgeInterfaceId;
  grantId?: string;
  month?: string;
  status?: string;
  queueStatus?: "pending" | "posted" | "void";
  source?: "credit-card" | "invoice" | "projection" | "unknown";
  active?: boolean;
  includeDeleted: boolean;
  limit: number;
  cursor?: string;
};

export const SheetsGrantPatch = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(["active", "draft", "closed", "deleted"]).optional(),
  kind: z.enum(["grant", "program"]).optional(),
  duration: z.string().trim().nullable().optional(),
  startDate: z.string().trim().nullable().optional(),
  endDate: z.string().trim().nullable().optional(),
  budgetTotal: z.number().min(0).nullable().optional(),
});
export type TSheetsGrantPatch = {
  name?: string;
  status?: "active" | "draft" | "closed" | "deleted";
  kind?: "grant" | "program";
  duration?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budgetTotal?: number | null;
};

export const SheetsGrantLineItemPatch = z.object({
  label: z.string().trim().nullable().optional(),
  amount: z.number().min(0).optional(),
  locked: z.boolean().nullable().optional(),
  capEnabled: z.boolean().optional(),
  perCustomerCap: z.number().min(0).nullable().optional(),
});
export type TSheetsGrantLineItemPatch = {
  label?: string | null;
  amount?: number;
  locked?: boolean | null;
  capEnabled?: boolean;
  perCustomerCap?: number | null;
};

export const SheetsPaymentQueuePatch = z.object({
  grantId: z.string().trim().nullable().optional(),
  lineItemId: z.string().trim().nullable().optional(),
  customerId: z.string().trim().nullable().optional(),
  enrollmentId: z.string().trim().nullable().optional(),
  creditCardId: z.string().trim().nullable().optional(),
  invoiceStatus: z.enum(["pending", "invoiced", "void"]).nullable().optional(),
  invoiceRef: z.string().trim().nullable().optional(),
  okUnassigned: z.boolean().optional(),
});
export type TSheetsPaymentQueuePatch = {
  grantId?: string | null;
  lineItemId?: string | null;
  customerId?: string | null;
  enrollmentId?: string | null;
  creditCardId?: string | null;
  invoiceStatus?: "pending" | "invoiced" | "void" | null;
  invoiceRef?: string | null;
  okUnassigned?: boolean;
};

export const SheetsBridgePushOperation = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("grant.patch"),
    grantId: z.string().trim().min(1),
    patch: SheetsGrantPatch,
  }),
  z.object({
    kind: z.literal("grant.lineItem.upsert"),
    grantId: z.string().trim().min(1),
    lineItemId: z.string().trim().min(1).optional(),
    patch: SheetsGrantLineItemPatch,
  }),
  z.object({
    kind: z.literal("grant.lineItem.delete"),
    grantId: z.string().trim().min(1),
    lineItemId: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("paymentQueue.patch"),
    id: z.string().trim().min(1),
    patch: SheetsPaymentQueuePatch,
    actorUid: z.string().trim().optional(),
  }),
  z.object({
    kind: z.literal("paymentQueue.post"),
    id: z.string().trim().min(1),
    actorUid: z.string().trim().optional(),
  }),
  z.object({
    kind: z.literal("paymentQueue.reopen"),
    id: z.string().trim().min(1),
    actorUid: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  }),
]);
export type TSheetsBridgePushOperation =
  | {
      kind: "grant.patch";
      grantId: string;
      patch: TSheetsGrantPatch;
    }
  | {
      kind: "grant.lineItem.upsert";
      grantId: string;
      lineItemId?: string;
      patch: TSheetsGrantLineItemPatch;
    }
  | {
      kind: "grant.lineItem.delete";
      grantId: string;
      lineItemId: string;
    }
  | {
      kind: "paymentQueue.patch";
      id: string;
      patch: TSheetsPaymentQueuePatch;
      actorUid?: string;
    }
  | {
      kind: "paymentQueue.post";
      id: string;
      actorUid?: string;
    }
  | {
      kind: "paymentQueue.reopen";
      id: string;
      actorUid?: string;
      reason?: string;
    };

export const SheetsBridgePushBody = z.object({
  orgId: z.string().trim().min(1),
  dryRun: z.boolean().default(false),
  operations: z.array(SheetsBridgePushOperation).min(1).max(250),
});
export type TSheetsBridgePushBody = {
  orgId: string;
  dryRun: boolean;
  operations: TSheetsBridgePushOperation[];
};
