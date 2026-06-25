import {
  ISO10,
  TsLike,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/ledger.ts
var ledger_exports = {};
__export(ledger_exports, {
  LedgerAutoAssignBody: () => LedgerAutoAssignBody,
  LedgerBalanceQuery: () => LedgerBalanceQuery,
  LedgerClassifyBody: () => LedgerClassifyBody,
  LedgerClassifyItem: () => LedgerClassifyItem,
  LedgerCreateBody: () => LedgerCreateBody,
  LedgerEntry: () => LedgerEntry,
  LedgerGetByIdParams: () => LedgerGetByIdParams,
  LedgerListBody: () => LedgerListBody,
  LedgerOrigin: () => LedgerOrigin,
  LedgerSource: () => LedgerSource
});
var ISO10ish = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return s;
  return s.length >= 10 ? s.slice(0, 10) : s;
}, ISO10);
var ISO7 = z.string().regex(/^\d{4}-\d{2}$/);
var isPresent = (v) => v != null && String(v).trim() !== "";
var addCustomIssue = (ctx, message, path) => {
  ctx.addIssue({ code: "custom", message, path });
};
function deriveLedgerDates(v) {
  if (!v || typeof v !== "object") return v;
  const o = { ...v };
  const d = o.dueDate ?? o.date;
  if (d != null) {
    if (o.dueDate == null) o.dueDate = d;
    if (o.date == null) o.date = d;
  }
  const dd = o.dueDate ?? o.date;
  if (dd && o.month == null) {
    const m = String(dd).slice(0, 7);
    if (m) o.month = m;
  }
  return o;
}
var LedgerSource = z.enum([
  "enrollment",
  // emitted from paymentsSpend (current path)
  "manual",
  // manual entry (future /ledgerCreate)
  "card",
  // credit card/imported expenses
  "migration",
  // backfills or grant-year transitions
  "adjustment",
  // admin corrections
  "system"
  // schedulers, auto-repairs, etc.
]);
var LedgerOrigin = z.object({
  app: z.string().nullish(),
  // "hdb"
  baseId: z.string().nullish(),
  // e.g. paymentId
  sourcePath: z.string().nullish(),
  // firestore path
  paymentQueueId: z.string().nullish(),
  paymentQueueSource: z.string().nullish(),
  jotformSubmissionId: z.string().nullish(),
  idempotencyKey: z.string().nullish()
}).partial();
var LedgerEntry = z.preprocess(
  deriveLedgerDates,
  z.object({
    id: z.string().min(1).optional(),
    // allow system to generate
    source: LedgerSource,
    orgId: z.string().nullable().optional(),
    amountCents: z.coerce.number().int(),
    amount: z.coerce.number().optional(),
    // derived; do NOT rely on being stored
    grantId: z.string().nullable().optional(),
    lineItemId: z.string().nullable().optional(),
    creditCardId: z.string().nullable().optional(),
    enrollmentId: z.string().nullable().optional(),
    paymentId: z.string().nullable().optional(),
    customerId: z.string().nullable().optional(),
    caseManagerId: z.string().nullable().optional(),
    note: z.union([z.string(), z.array(z.string())]).nullish(),
    vendor: z.string().nullish(),
    comment: z.string().nullish(),
    labels: z.array(z.string()).default([]),
    ts: TsLike.nullish(),
    dueDate: ISO10ish.nullish(),
    // YYYY-MM-DD
    date: ISO10ish.nullish(),
    // alias; kept for back-compat / readability
    month: ISO7.nullish(),
    // YYYY-MM
    origin: LedgerOrigin.nullish(),
    grantNameAtSpend: z.string().nullish(),
    lineItemLabelAtSpend: z.string().nullish(),
    // Canonical name
    customerNameAtSpend: z.string().nullish(),
    paymentLabelAtSpend: z.string().nullish(),
    // Optional audit
    byUid: z.string().nullish(),
    byEmail: z.string().nullish(),
    byName: z.string().nullish(),
    // Payment status — always true for migrated historical records
    paid: z.boolean().nullish(),
    paidAt: TsLike.nullish(),
    // Optional audit linkage for reversals (recommended)
    reversalOf: z.string().nullish(),
    // Compliance snapshot (enrollment payments only)
    compliance: z.object({
      hmisComplete: z.boolean().nullish(),
      caseworthyComplete: z.boolean().nullish()
    }).nullish(),
    createdAt: TsLike.nullish(),
    updatedAt: TsLike.nullish()
  }).superRefine((v, ctx) => {
    if (v.amount != null) {
      const a = Number(v.amount);
      const c = Number(v.amountCents);
      if (Number.isFinite(a) && Number.isFinite(c)) {
        const expect = Math.round(a * 100);
        if (expect !== c) {
          addCustomIssue(ctx, "amount must match amountCents (rounded to cents)", [
            "amount"
          ]);
        }
      }
    }
    const hasGrant = isPresent(v.grantId);
    const hasLI = isPresent(v.lineItemId);
    if (hasGrant !== hasLI) {
      addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
        "lineItemId"
      ]);
    }
    if (v.source === "enrollment") {
      const req = [
        ["grantId", "grantId required for enrollment ledger rows"],
        ["lineItemId", "lineItemId required for enrollment ledger rows"],
        ["enrollmentId", "enrollmentId required for enrollment ledger rows"],
        ["paymentId", "paymentId required for enrollment ledger rows"]
      ];
      for (const [k, msg] of req) {
        const val = v[k];
        if (!isPresent(val)) addCustomIssue(ctx, msg, [k]);
      }
      const d2 = v.dueDate || v.date;
      if (!d2) {
        addCustomIssue(ctx, "dueDate required for enrollment ledger rows", ["dueDate"]);
      }
    }
    const d = v.dueDate || v.date;
    if (d && v.month) {
      const m = String(d).slice(0, 7);
      if (m && String(v.month) !== m) {
        addCustomIssue(ctx, "month must equal dueDate.slice(0,7)", ["month"]);
      }
    }
  }).strip()
);
var LedgerListBody = z.object({
  orgId: z.string().nullish(),
  grantId: z.string().nullish(),
  creditCardId: z.string().nullish(),
  enrollmentId: z.string().nullish(),
  customerId: z.string().nullish(),
  source: LedgerSource.nullish(),
  month: ISO7.nullish(),
  // GET query values arrive as strings, so coerce here
  limit: z.coerce.number().int().min(1).max(500).default(50),
  cursor: z.string().nullish(),
  // Back-compat: accept "amount" but map it to "amountCents"
  sortBy: z.preprocess(
    (v) => v === "amount" ? "amountCents" : v,
    z.enum(["createdAt", "dueDate", "amountCents"])
  ).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
}).strip();
var LedgerCreateBody = z.preprocess(
  deriveLedgerDates,
  z.object({
    id: z.string().min(1).optional(),
    // optional now
    source: z.enum(["manual", "card", "adjustment"]),
    amountCents: z.coerce.number().int(),
    amount: z.coerce.number().optional(),
    grantId: z.string().nullish(),
    lineItemId: z.string().nullish(),
    creditCardId: z.string().nullish(),
    enrollmentId: z.string().nullish(),
    paymentId: z.string().nullish(),
    customerId: z.string().nullish(),
    note: z.union([z.string(), z.array(z.string())]).nullish(),
    vendor: z.string().nullish(),
    comment: z.string().nullish(),
    labels: z.array(z.string()).default([]),
    dueDate: ISO10ish.nullish(),
    date: ISO10ish.nullish(),
    month: ISO7.nullish()
  }).superRefine((v, ctx) => {
    const hasGrant = isPresent(v.grantId);
    const hasLI = isPresent(v.lineItemId);
    if (hasGrant !== hasLI) {
      addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
        "lineItemId"
      ]);
    }
    const d = v.dueDate || v.date;
    if (d && v.month && String(v.month) !== String(d).slice(0, 7)) {
      addCustomIssue(ctx, "month must equal dueDate.slice(0,7)", ["month"]);
    }
  }).strip()
);
var LedgerClassifyItem = z.object({
  entryId: z.string().min(1),
  grantId: z.string().nullish(),
  lineItemId: z.string().nullish(),
  clear: z.boolean().optional()
}).superRefine((v, ctx) => {
  const clear = v.clear === true;
  const hasGrant = isPresent(v.grantId);
  const hasLi = isPresent(v.lineItemId);
  if (!clear && hasGrant !== hasLi) {
    addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
      "lineItemId"
    ]);
  }
});
var LedgerClassifyBody = z.object({
  items: z.array(LedgerClassifyItem).min(1),
  dryRun: z.boolean().optional().default(false),
  reason: z.string().trim().nullish()
});
var LedgerAutoAssignBody = z.object({
  entryIds: z.array(z.string().min(1)).optional(),
  month: ISO7.nullish(),
  grantId: z.string().nullish(),
  limit: z.coerce.number().int().min(1).max(1e3).optional().default(200),
  apply: z.boolean().optional().default(false),
  forceReclass: z.boolean().optional().default(false)
}).strip();
var LedgerGetByIdParams = z.object({
  entryId: z.string().min(1)
});
var LedgerBalanceQuery = z.object({
  orgId: z.string().nullish(),
  grantId: z.string().nullish(),
  month: ISO7.nullish(),
  groupBy: z.enum(["grant", "month", "source"]).default("grant")
}).strip();

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
  ledger_exports
};
