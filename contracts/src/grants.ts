// contracts/src/grants.ts
import { z, Id, IdLike, TsLike, BoolLike, BoolFromLike, toArray } from "./core";
import { Ok } from "./http";

export { toArray } from "./core";

/** ---------- Enums ---------- */
export const GrantStatus = z.enum(["active", "draft", "closed", "deleted"]);
export type TGrantStatus = z.infer<typeof GrantStatus>;

export const GrantKind = z.enum(["grant", "program"]);
export type TGrantKind = z.infer<typeof GrantKind>;

/** ---------- helpers ---------- */
// Zod v4: .finite() is deprecated
const Num = z.coerce.number().refine(Number.isFinite, "not_finite").default(0);

/** ---------- Budget ---------- */
/** Per-customer spending cap on a single budget line item. Optional. */
export const GrantLineItemCap = z
  .object({
    /** Hard cap (USD) per enrolled customer for this line item. null = no cap. */
    perCustomerCap: z.number().min(0).nullish(),
    /** Whether the cap is actively enforced (shows warnings / blocks posting when exceeded). */
    capEnabled: z.boolean().default(false),
  })
  .passthrough();

export type TGrantLineItemCap = z.infer<typeof GrantLineItemCap>;

export const GrantBudgetLineItem = z
  .object({
    id: Id.optional(), // server fills if missing
    label: z.string().trim().nullish(),

    amount: Num,

    projected: Num,
    spent: Num,

    projectedInWindow: Num.optional(),
    spentInWindow: Num.optional(),

    locked: z.boolean().nullish(),

    // ── Per-customer cap (optional) ──────────────────────────────────────────
    /** USD cap per enrolled customer on this line item. Only enforced if capEnabled. */
    perCustomerCap: z.number().min(0).nullish(),
    capEnabled: z.boolean().default(false),
  })
  .passthrough();

export type TGrantBudgetLineItem = z.infer<typeof GrantBudgetLineItem>;

export const GrantBudgetTotals = z
  .object({
    total: Num,
    projected: Num,
    spent: Num,

    balance: Num.optional(),
    projectedBalance: Num.optional(),
    /** spent + projected — total dollars allocated (committed + future obligations) */
    projectedSpend: Num.optional(),

    // compat alias (service writes this)
    remaining: Num.optional(),

    projectedInWindow: Num.optional(),
    spentInWindow: Num.optional(),
    windowBalance: Num.optional(),
    windowProjectedBalance: Num.optional(),
  })
  .passthrough();

export type TGrantBudgetTotals = z.infer<typeof GrantBudgetTotals>;

export const GrantBudget = z
  .object({
    total: Num,
    totals: GrantBudgetTotals.nullish(),
    lineItems: z.array(GrantBudgetLineItem).default([]),

    /**
     * When true, this grant/program tracks per-customer allocations and shows
     * the Allocation tab on budget cards and grant detail.
     */
    allocationEnabled: z.boolean().optional(),
    /**
     * Optional grant-level cap per customer (USD across all line items).
     * null = no grant-level cap (line items may still have their own caps).
     */
    perCustomerCap: z.number().min(0).nullish(),

    createdAt: TsLike.nullish(),
    updatedAt: TsLike.nullish(),
  })
  .passthrough();

export type TGrantBudget = z.infer<typeof GrantBudget>;

// ─── Conditional Task Rules ────────────────────────────────────────────────────
//
// Evaluated when a customer is enrolled in this grant.
// Age rules: compute enrollee's age as of enrollment.startDate.
// Concurrent-enrollment rules: check if the customer has another active
//   enrollment whose grantName matches programName on the start date.

export const ConditionalTaskRuleType = z.enum(["age", "concurrent_enrollment"]);
export type TConditionalTaskRuleType = z.infer<typeof ConditionalTaskRuleType>;

export const AgeOperator = z.enum([">=", "<=", ">", "<"]);
export type TAgeOperator = z.infer<typeof AgeOperator>;

export const ConditionalTaskRule = z
  .object({
    id: z.string().min(1),
    /** Human-readable description of this rule (e.g. "Under 18 — youth compliance") */
    name: z.string().trim().min(1),
    type: ConditionalTaskRuleType,

    // ── Age condition ────────────────────────────────────────────────────────
    /** Comparison operator applied to the enrollee's age in years */
    ageOperator: AgeOperator.optional(),
    /** Age threshold in years */
    ageThreshold: z.number().int().min(0).optional(),

    // ── Concurrent-enrollment condition ──────────────────────────────────────
    /**
     * Grant name (or substring) to match in the enrollee's other active
     * enrollments on the start date.  Case-insensitive substring match.
     */
    programName: z.string().trim().optional(),

    // ── Task definition ──────────────────────────────────────────────────────
    taskName: z.string().trim().min(1),
    taskDescription: z.string().trim().nullish(),
    taskBucket: z.string().trim().default("task"),
    /** Days from enrollment.startDate until the task is due. null → due on start date. */
    dueOffsetDays: z.number().int().nullish(),
    assignToGroup: z.enum(["admin", "compliance", "casemanager"]).default("casemanager"),
    taskNotes: z.string().trim().nullish(),
  })
  .passthrough();

export type TConditionalTaskRule = z.infer<typeof ConditionalTaskRule>;

/** ---------- Grant (INPUT) ---------- */
export const GrantInputSchema = z
  .object({
    id: Id.optional(),
    name: z.string().trim().min(1),

    status: GrantStatus.optional(),
    active: z.boolean().optional(), // server-derived
    deleted: z.boolean().optional(), // server-derived

    // server authoritative (but accepted for dev/explicit org targeting)
    orgId: Id.nullish(),

    kind: GrantKind.optional(),

    duration: z.string().trim().nullish().default("1 Year"),

    // Date | Timestamp | ISO string; server normalizes
    startDate: z.unknown().optional(),
    endDate: z.unknown().optional(),

    // Only allowed when kind="grant" (service enforces)
    budget: GrantBudget.nullish(),

    taskTypes: z.array(z.string().trim()).nullish(),
    tasks: z.record(z.string(), z.unknown()).nullish(),

    /** Conditional task rules evaluated on each new enrollment. */
    conditionalTaskRules: z.array(ConditionalTaskRule).nullish(),

    meta: z.record(z.string(), z.unknown()).nullish(),

    createdAt: TsLike.nullish(),
    updatedAt: TsLike.nullish(),
  })
  .passthrough();

export type TGrant = z.infer<typeof GrantInputSchema> & Record<string, unknown>;

/** Back-compat runtime name (functions currently import Grant) */
export const Grant = GrantInputSchema;

/** ---------- Grant (ENTITY / READ) ---------- */
export const GrantEntity = GrantInputSchema.extend({
  id: Id,
}).passthrough();

export type TGrantEntity = z.infer<typeof GrantEntity> &
  Record<string, unknown>;

/* =============================================================================
   Requests / Responses (match current functions/http.ts + service.ts)
============================================================================= */

// ---------------- Upsert (POST /grantsUpsert) ----------------
export const GrantsUpsertBody = z.union([
  GrantInputSchema,
  z.array(GrantInputSchema).min(1),
]);
export const GrantUpsertBody = GrantsUpsertBody; // back-compat

export type TGrantsUpsertBody = z.infer<typeof GrantsUpsertBody>;
export type TGrantsUpsertResp = Ok<{ ids: string[] }>;

// ---------------- Patch (PATCH /grantsPatch) ----------------
export const GrantsPatchRow = z
  .object({
    id: Id,
    patch: GrantInputSchema.partial().passthrough(),
    unset: z.array(z.string().min(1)).optional(),
  })
  .passthrough()
  .refine(
    (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
    { message: "empty_patch" },
  );

export const GrantsPatchBody = z.union([
  GrantsPatchRow,
  z.array(GrantsPatchRow).min(1),
]);
export const GrantPatchBody = GrantsPatchBody; // back-compat

export type TGrantsPatchRow = z.infer<typeof GrantsPatchRow>;
export type TGrantsPatchBody = z.infer<typeof GrantsPatchBody>;
export type TGrantsPatchResp = Ok<{ ids: string[] }>;

// ---------------- Soft delete (POST /grantsDelete) ----------------
// matches handler parse: req.body?.ids ?? req.body?.id ?? req.body
export const GrantsDeleteBody = z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v as { ids?: unknown; id?: unknown };
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  z.union([IdLike, z.array(IdLike).min(1)]),
);

export type TGrantsDeleteBody = z.infer<typeof GrantsDeleteBody>;
export type TGrantsDeleteResp = Ok<{ ids: string[]; deleted: true }>;

// ---------------- Hard delete (POST /grantsAdminDelete) ----------------
export const GrantsAdminDeleteBody = GrantsDeleteBody;
export type TGrantsAdminDeleteBody = z.infer<typeof GrantsAdminDeleteBody>;
export type TGrantsAdminDeleteResp = Ok<{ ids: string[]; deleted: true }>;

// ---------------- List (GET/POST /grantsList) ----------------
const ActiveFilter = z.preprocess(
  (v) => {
    if (v === "" || v == null) return undefined;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
    if (Array.isArray(v)) return v[0];
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "y", "active"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
    }
    return v;
  },
  z.union([z.literal(true), z.literal(false)]),
);

export const GrantsListQuery = z
  .object({
    status: z.string().trim().optional(),
    active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),
    kind: z.union([GrantKind, z.string()]).optional(),

    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursorUpdatedAt: TsLike.optional(),
    cursorId: IdLike.optional(),

    // dev explicit org targeting (matches handler behavior)
    orgId: IdLike.optional(),
  })
  .passthrough();

export type TGrantsListQuery = z.infer<typeof GrantsListQuery>;
export type TGrantsListResp = Ok<{
  items: TGrantEntity[];
  next: { cursorUpdatedAt: unknown; cursorId: string } | null;
  orgId: string;
}>;

// ---------------- Get (GET/POST /grantsGet) ----------------
export const GrantsGetQuery = z
  .object({ id: IdLike, orgId: IdLike.optional() })
  .passthrough();
export type TGrantsGetQuery = z.infer<typeof GrantsGetQuery>;
export type TGrantsGetResp = Ok<{ grant: TGrantEntity }>;

// ---------------- Structure (GET /grantsStructure) ----------------
export type TGrantsStructureResp = Ok<{ structure: Partial<TGrant> }>;

// ---------------- Activity (GET/POST /grantsActivity) ----------------
export const GrantsActivityQuery = z
  .object({
    grantId: IdLike,
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    orgId: IdLike.optional(),
  })
  .passthrough();

export type TGrantsActivityQuery = z.infer<typeof GrantsActivityQuery>;
export type TGrantsActivityItem = {
  id: string;
  kind: "spend" | "reversal";
  grantId: string;
  enrollmentId: string;
  paymentId?: string | null;
  lineItemId?: string | null;
  amount: number;
  note?: string | null;
  ts: string;
  by?: unknown | null;
  reversalOf?: string | null;
};
export type TGrantsActivityResp = Ok<{ items: TGrantsActivityItem[] }>;
