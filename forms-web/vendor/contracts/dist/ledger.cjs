"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
module.exports = __toCommonJS(ledger_exports);

// src/core.ts
var import_zod = require("zod");
var import_zod2 = require("zod");
var Id = import_zod.z.string().trim().min(1);
var Ids = import_zod.z.array(Id).min(1);
var IdLike = import_zod.z.preprocess((v) => {
  if (typeof v === "string" || typeof v === "number") return String(v);
  return v;
}, Id);
var GrantIdsLike = import_zod.z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return v;
}, import_zod.z.array(Id).min(1));
var TimestampLike = import_zod.z.union([
  import_zod.z.string(),
  // ISO
  import_zod.z.number(),
  // millis
  import_zod.z.object({ seconds: import_zod.z.number(), nanoseconds: import_zod.z.number() })
  // Firestore JSON-ish
]);
var TsLike = TimestampLike;
var ISO10 = import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var BoolLike = import_zod.z.union([
  import_zod.z.boolean(),
  import_zod.z.literal("true"),
  import_zod.z.literal("false"),
  import_zod.z.literal(1),
  import_zod.z.literal(0),
  import_zod.z.literal("1"),
  import_zod.z.literal("0")
]);
var BoolFromLike = import_zod.z.preprocess((v) => {
  if (Array.isArray(v)) v = v[0];
  if (v === "" || v === null || v === void 0) return v;
  if (v === true || v === false) return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return v;
}, import_zod.z.boolean());
var JsonObj = import_zod.z.object({}).catchall(import_zod.z.unknown());
var JsonObjLike = import_zod.z.preprocess((v) => {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? parsed : v;
    } catch {
      return v;
    }
  }
  return v;
}, JsonObj);

// src/ledger.ts
var ISO10ish = import_zod2.z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return s;
  return s.length >= 10 ? s.slice(0, 10) : s;
}, ISO10);
var ISO7 = import_zod2.z.string().regex(/^\d{4}-\d{2}$/);
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
var LedgerSource = import_zod2.z.enum([
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
var LedgerOrigin = import_zod2.z.object({
  app: import_zod2.z.string().nullish(),
  // "hdb"
  baseId: import_zod2.z.string().nullish(),
  // e.g. paymentId
  sourcePath: import_zod2.z.string().nullish(),
  // firestore path
  paymentQueueId: import_zod2.z.string().nullish(),
  paymentQueueSource: import_zod2.z.string().nullish(),
  jotformSubmissionId: import_zod2.z.string().nullish(),
  idempotencyKey: import_zod2.z.string().nullish()
}).partial();
var LedgerEntry = import_zod2.z.preprocess(
  deriveLedgerDates,
  import_zod2.z.object({
    id: import_zod2.z.string().min(1).optional(),
    // allow system to generate
    source: LedgerSource,
    orgId: import_zod2.z.string().nullable().optional(),
    amountCents: import_zod2.z.coerce.number().int(),
    amount: import_zod2.z.coerce.number().optional(),
    // derived; do NOT rely on being stored
    grantId: import_zod2.z.string().nullable().optional(),
    lineItemId: import_zod2.z.string().nullable().optional(),
    creditCardId: import_zod2.z.string().nullable().optional(),
    enrollmentId: import_zod2.z.string().nullable().optional(),
    paymentId: import_zod2.z.string().nullable().optional(),
    customerId: import_zod2.z.string().nullable().optional(),
    caseManagerId: import_zod2.z.string().nullable().optional(),
    note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
    vendor: import_zod2.z.string().nullish(),
    comment: import_zod2.z.string().nullish(),
    labels: import_zod2.z.array(import_zod2.z.string()).default([]),
    ts: TsLike.nullish(),
    dueDate: ISO10ish.nullish(),
    // YYYY-MM-DD
    date: ISO10ish.nullish(),
    // alias; kept for back-compat / readability
    month: ISO7.nullish(),
    // YYYY-MM
    origin: LedgerOrigin.nullish(),
    grantNameAtSpend: import_zod2.z.string().nullish(),
    lineItemLabelAtSpend: import_zod2.z.string().nullish(),
    // Canonical name
    customerNameAtSpend: import_zod2.z.string().nullish(),
    paymentLabelAtSpend: import_zod2.z.string().nullish(),
    // Optional audit
    byUid: import_zod2.z.string().nullish(),
    byEmail: import_zod2.z.string().nullish(),
    byName: import_zod2.z.string().nullish(),
    // Payment status — always true for migrated historical records
    paid: import_zod2.z.boolean().nullish(),
    paidAt: TsLike.nullish(),
    // Optional audit linkage for reversals (recommended)
    reversalOf: import_zod2.z.string().nullish(),
    // Compliance snapshot (enrollment payments only)
    compliance: import_zod2.z.object({
      hmisComplete: import_zod2.z.boolean().nullish(),
      caseworthyComplete: import_zod2.z.boolean().nullish()
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
var LedgerListBody = import_zod2.z.object({
  orgId: import_zod2.z.string().nullish(),
  grantId: import_zod2.z.string().nullish(),
  creditCardId: import_zod2.z.string().nullish(),
  enrollmentId: import_zod2.z.string().nullish(),
  customerId: import_zod2.z.string().nullish(),
  source: LedgerSource.nullish(),
  month: ISO7.nullish(),
  // GET query values arrive as strings, so coerce here
  limit: import_zod2.z.coerce.number().int().min(1).max(500).default(50),
  cursor: import_zod2.z.string().nullish(),
  // Back-compat: accept "amount" but map it to "amountCents"
  sortBy: import_zod2.z.preprocess(
    (v) => v === "amount" ? "amountCents" : v,
    import_zod2.z.enum(["createdAt", "dueDate", "amountCents"])
  ).default("createdAt"),
  sortOrder: import_zod2.z.enum(["asc", "desc"]).default("desc")
}).strip();
var LedgerCreateBody = import_zod2.z.preprocess(
  deriveLedgerDates,
  import_zod2.z.object({
    id: import_zod2.z.string().min(1).optional(),
    // optional now
    source: import_zod2.z.enum(["manual", "card", "adjustment"]),
    amountCents: import_zod2.z.coerce.number().int(),
    amount: import_zod2.z.coerce.number().optional(),
    grantId: import_zod2.z.string().nullish(),
    lineItemId: import_zod2.z.string().nullish(),
    creditCardId: import_zod2.z.string().nullish(),
    enrollmentId: import_zod2.z.string().nullish(),
    paymentId: import_zod2.z.string().nullish(),
    customerId: import_zod2.z.string().nullish(),
    note: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.array(import_zod2.z.string())]).nullish(),
    vendor: import_zod2.z.string().nullish(),
    comment: import_zod2.z.string().nullish(),
    labels: import_zod2.z.array(import_zod2.z.string()).default([]),
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
var LedgerClassifyItem = import_zod2.z.object({
  entryId: import_zod2.z.string().min(1),
  grantId: import_zod2.z.string().nullish(),
  lineItemId: import_zod2.z.string().nullish(),
  clear: import_zod2.z.boolean().optional()
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
var LedgerClassifyBody = import_zod2.z.object({
  items: import_zod2.z.array(LedgerClassifyItem).min(1),
  dryRun: import_zod2.z.boolean().optional().default(false),
  reason: import_zod2.z.string().trim().nullish()
});
var LedgerAutoAssignBody = import_zod2.z.object({
  entryIds: import_zod2.z.array(import_zod2.z.string().min(1)).optional(),
  month: ISO7.nullish(),
  grantId: import_zod2.z.string().nullish(),
  limit: import_zod2.z.coerce.number().int().min(1).max(1e3).optional().default(200),
  apply: import_zod2.z.boolean().optional().default(false),
  forceReclass: import_zod2.z.boolean().optional().default(false)
}).strip();
var LedgerGetByIdParams = import_zod2.z.object({
  entryId: import_zod2.z.string().min(1)
});
var LedgerBalanceQuery = import_zod2.z.object({
  orgId: import_zod2.z.string().nullish(),
  grantId: import_zod2.z.string().nullish(),
  month: ISO7.nullish(),
  groupBy: import_zod2.z.enum(["grant", "month", "source"]).default("grant")
}).strip();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LedgerAutoAssignBody,
  LedgerBalanceQuery,
  LedgerClassifyBody,
  LedgerClassifyItem,
  LedgerCreateBody,
  LedgerEntry,
  LedgerGetByIdParams,
  LedgerListBody,
  LedgerOrigin,
  LedgerSource
});
