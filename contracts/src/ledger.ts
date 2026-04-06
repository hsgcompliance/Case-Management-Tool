// contracts/src/ledger.ts
import { z, TsLike, ISO10 } from "./core";

/* ============================================================================
   Helpers
============================================================================ */

/**
 * Accept either "YYYY-MM-DD" or full ISO string and normalize to ISO10.
 * Anything else => validation error.
 */
const ISO10ish = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return s;
  return s.length >= 10 ? s.slice(0, 10) : s;
}, ISO10);

const ISO7 = z.string().regex(/^\d{4}-\d{2}$/); // YYYY-MM

const isPresent = (v: unknown) => v != null && String(v).trim() !== "";

const addCustomIssue = (
  ctx: z.RefinementCtx,
  message: string,
  path?: Array<string | number>
) => {
  // Avoid deprecated ZodIssueCode; string literal is supported.
  ctx.addIssue({ code: "custom", message, path });
};

/**
 * Normalize date fields for both Entry + Create bodies:
 * - If only `date` provided, copy to `dueDate`
 * - If only `dueDate` provided, copy to `date`
 * - If month missing and (dueDate|date) present, derive month = slice(0,7)
 */
function deriveLedgerDates(v: unknown) {
  if (!v || typeof v !== "object") return v;
  const o: any = { ...(v as any) };

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

/* ============================================================================
   Core types
============================================================================ */

/** Where this ledger entry came from. */
export const LedgerSource = z.enum([
  "enrollment", // emitted from paymentsSpend (current path)
  "manual", // manual entry (future /ledgerCreate)
  "card", // credit card/imported expenses
  "migration", // backfills or grant-year transitions
  "adjustment", // admin corrections
  "system", // schedulers, auto-repairs, etc.
]);
export type TLedgerSource = z.infer<typeof LedgerSource>;

export const LedgerOrigin = z
  .object({
    app: z.string().nullish(), // "hdb"
    baseId: z.string().nullish(), // e.g. paymentId
    sourcePath: z.string().nullish(), // firestore path
    paymentQueueId: z.string().nullish(),
    paymentQueueSource: z.string().nullish(),
    jotformSubmissionId: z.string().nullish(),
    idempotencyKey: z.string().nullish(),
  })
  .partial();

/**
 * Canonical ledger row (storage shape).
 * - amountCents is truth
 * - amount is derived (Option A)
 * - id is optional in payload; Firestore doc id is canonical
 */
export const LedgerEntry = z
  .preprocess(
    deriveLedgerDates,
    z
      .object({
        id: z.string().min(1).optional(), // allow system to generate

        source: LedgerSource,
        orgId: z.string().nullable().optional(),

        amountCents: z.coerce.number().int(),
        amount: z.coerce.number().optional(), // derived; do NOT rely on being stored

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

        dueDate: ISO10ish.nullish(), // YYYY-MM-DD
        date: ISO10ish.nullish(), // alias; kept for back-compat / readability
        month: ISO7.nullish(), // YYYY-MM

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
          caseworthyComplete: z.boolean().nullish(),
        }).nullish(),

        createdAt: TsLike.nullish(),
        updatedAt: TsLike.nullish(),
      })
      .superRefine((v, ctx) => {
        // ---- amount invariants ----
        if (v.amount != null) {
          const a = Number(v.amount);
          const c = Number(v.amountCents);
          if (Number.isFinite(a) && Number.isFinite(c)) {
            const expect = Math.round(a * 100);
            if (expect !== c) {
              addCustomIssue(ctx, "amount must match amountCents (rounded to cents)", [
                "amount",
              ]);
            }
          }
        }

        // ---- budget-impact pairing ----
        const hasGrant = isPresent(v.grantId);
        const hasLI = isPresent(v.lineItemId);
        if (hasGrant !== hasLI) {
          addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
            "lineItemId",
          ]);
        }

        // ---- enrollment source invariants ----
        if (v.source === "enrollment") {
          const req: Array<[keyof typeof v, string]> = [
            ["grantId", "grantId required for enrollment ledger rows"],
            ["lineItemId", "lineItemId required for enrollment ledger rows"],
            ["enrollmentId", "enrollmentId required for enrollment ledger rows"],
            ["paymentId", "paymentId required for enrollment ledger rows"],
          ];

          for (const [k, msg] of req) {
            const val = (v as any)[k];
            if (!isPresent(val)) addCustomIssue(ctx, msg, [k as any]);
          }

          const d = v.dueDate || v.date;
          if (!d) {
            addCustomIssue(ctx, "dueDate required for enrollment ledger rows", ["dueDate"]);
          }
        }

        // ---- month consistency (when both present) ----
        const d = (v.dueDate || v.date) as any;
        if (d && v.month) {
          const m = String(d).slice(0, 7);
          if (m && String(v.month) !== m) {
            addCustomIssue(ctx, "month must equal dueDate.slice(0,7)", ["month"]);
          }
        }
      })
      .strip()
  );

export type TLedgerEntry = z.infer<typeof LedgerEntry>;

/* ============================================================================
   HTTP Request Schemas
============================================================================ */

export const LedgerListBody = z
  .object({
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
    sortBy: z
      .preprocess(
        (v) => (v === "amount" ? "amountCents" : v),
        z.enum(["createdAt", "dueDate", "amountCents"])
      )
      .default("createdAt"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strip();
export type TLedgerListBody = z.infer<typeof LedgerListBody>;

export const LedgerCreateBody = z
  .preprocess(
    deriveLedgerDates,
    z
      .object({
        id: z.string().min(1).optional(), // optional now

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
        month: ISO7.nullish(),
      })
      .superRefine((v, ctx) => {
        // Keep create bodies budget-safe too.
        const hasGrant = isPresent(v.grantId);
        const hasLI = isPresent(v.lineItemId);
        if (hasGrant !== hasLI) {
          addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
            "lineItemId",
          ]);
        }

        const d = v.dueDate || v.date;
        if (d && v.month && String(v.month) !== String(d).slice(0, 7)) {
          addCustomIssue(ctx, "month must equal dueDate.slice(0,7)", ["month"]);
        }
      })
      .strip()
  );

export type TLedgerCreateBody = z.infer<typeof LedgerCreateBody>;

export const LedgerClassifyItem = z
  .object({
    entryId: z.string().min(1),
    grantId: z.string().nullish(),
    lineItemId: z.string().nullish(),
    clear: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const clear = v.clear === true;
    const hasGrant = isPresent(v.grantId);
    const hasLi = isPresent(v.lineItemId);
    if (!clear && hasGrant !== hasLi) {
      addCustomIssue(ctx, "grantId and lineItemId must be provided together", [
        "lineItemId",
      ]);
    }
  });

export type TLedgerClassifyItem = z.infer<typeof LedgerClassifyItem>;

export const LedgerClassifyBody = z.object({
  items: z.array(LedgerClassifyItem).min(1),
  dryRun: z.boolean().optional().default(false),
  reason: z.string().trim().nullish(),
});
export type TLedgerClassifyBody = z.infer<typeof LedgerClassifyBody>;

export const LedgerAutoAssignBody = z
  .object({
    entryIds: z.array(z.string().min(1)).optional(),
    month: ISO7.nullish(),
    grantId: z.string().nullish(),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(200),
    apply: z.boolean().optional().default(false),
    forceReclass: z.boolean().optional().default(false),
  })
  .strip();
export type TLedgerAutoAssignBody = z.infer<typeof LedgerAutoAssignBody>;

export type TLedgerClassifyResp = {
  ok: true;
  updated: number;
  dryRun: boolean;
  results: Array<{
    entryId: string;
    ok: boolean;
    error?: string;
    before?: { grantId: string | null; lineItemId: string | null };
    after?: { grantId: string | null; lineItemId: string | null };
  }>;
};

export type TLedgerAutoAssignResp = {
  ok: true;
  apply: boolean;
  updated: number;
  matches: Array<{
    entryId: string;
    matched: boolean;
    score: number;
    grantId: string | null;
    lineItemId: string | null;
    reasons: string[];
  }>;
};

export const LedgerGetByIdParams = z.object({
  entryId: z.string().min(1),
});
export type TLedgerGetByIdParams = z.infer<typeof LedgerGetByIdParams>;

export const LedgerBalanceQuery = z
  .object({
    orgId: z.string().nullish(),
    grantId: z.string().nullish(),
    month: ISO7.nullish(),
    groupBy: z.enum(["grant", "month", "source"]).default("grant"),
  })
  .strip();
export type TLedgerBalanceQuery = z.infer<typeof LedgerBalanceQuery>;
