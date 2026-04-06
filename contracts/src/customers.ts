// contracts/src/customers.ts
import { z, Id, IdLike, TsLike, BoolFromLike, ISO10, toArray } from "./core";
import { Ok } from "./http";

export { toArray } from "./core";

/**
 * Core idea:
 *  - Validate known/core fields.
 *  - Allow dynamic additions via passthrough().
 *  - Do NOT strip unknown keys.
 */

export const Population = z.enum(["Youth", "Individual", "Family"]).nullable();
export type TPopulation = z.infer<typeof Population>;

// Server-accepted status only (match service coerceStatus)
export const CustomerStatus = z
  .enum(["active", "inactive", "deleted"])
  .nullable();
export type TCustomerStatus = z.infer<typeof CustomerStatus>;

/* ============================================================================
   Core schemas
============================================================================ */

export const CustomerAcuity = z
  .object({
    templateId: Id.nullish(),
    templateVersion: z.number().int().nullish(),
    submissionId: Id.nullish(),

    score: z.number().nullish(),
    level: z.string().trim().nullish(),

    computedAt: TsLike.nullish(),

    // tolerated during migration / transitional UI
    answers: z.array(z.unknown()).optional(),
  })
  .passthrough()
  .nullish();

export const CustomerMeta = z
  .object({
    driveFolders: z
      .array(
        z.object({
          id: z.string(), // NOTE: gdrive ids aren't your Id shape; keep string
          alias: z.string().trim().nullish().optional(),
          name: z.string().optional(),
          driveId: z.string().trim().nullish().optional(),
          kind: z.literal("gdrive").default("gdrive"),
        }),
      )
      .optional(),
    driveFolderId: z.string().nullish(),
    notes: z.string().nullish(),
  })
  .passthrough()
  .nullish();

export const AssistanceLength = z
  .object({
    firstDateOfAssistance: ISO10.nullish(),
    lastExpectedDateOfAssistance: ISO10.nullish(),
  })
  .passthrough()
  .nullable()
  .optional();
export type TAssistanceLength = z.infer<typeof AssistanceLength>;

export const CustomerOtherContact = z
  .object({
    uid: Id,
    name: z.string().trim().nullish(),
    role: z.string().trim().nullish().optional(),
  })
  .passthrough();
export type TCustomerOtherContact = z.infer<typeof CustomerOtherContact>;

/**
 * INPUT shape (for write endpoints).
 * - id optional (server may generate)
 * - orgId/teamIds accepted but server-owned/overwritten (or forbidden in PATCH)
 * - dynamic keys allowed via passthrough()
 */
export const CustomerInputSchema = z
  .object({
    id: Id.optional(),

    // org/team (server authoritative)
    orgId: Id.nullish(),
    teamIds: z.array(Id).max(10).optional(),

    // Identity fields
    firstName: z.string().trim().min(1).nullish(),
    lastName: z.string().trim().min(1).nullish(),
    name: z.string().trim().min(1).nullish(),

    // lenient; backend does not enforce ISO10
    dob: z.string().nullish(),

    // case manager binding
    caseManagerId: Id.nullish(),
    caseManagerName: z.string().trim().nullish(),
    secondaryCaseManagerId: Id.nullish(),
    secondaryCaseManagerName: z.string().trim().nullish(),
    otherContacts: z.array(CustomerOtherContact).max(3).optional(),
    contactCaseManagerIds: z.array(Id).max(5).optional(),

    // state (backend coerces/derives coherence)
    status: CustomerStatus.optional(),
    active: z.boolean().optional(),
    enrolled: z.boolean().optional(),
    deleted: z.boolean().optional(),

    // Canonical population + acuity
    population: Population.nullish(),
    assistanceLength: AssistanceLength,
    acuityScore: z.number().nullish(),
    acuity: CustomerAcuity,

    // Drive folders + misc metadata
    meta: CustomerMeta,

    // server-managed timestamps (accepted but ignored on write)
    createdAt: TsLike.nullish().optional(),
    updatedAt: TsLike.nullish().optional(),

    // tolerated legacy / common fields
    hmisId: z.string().trim().nullish(),
    cwId: z.string().trim().nullish(),
    phone: z.string().nullish(),
    email: z.string().nullish(), // keep lenient unless you want z.email()
    address: z.string().nullish(),
  })
  .passthrough();

// Type includes dynamic keys.
export type CustomerInput = z.infer<typeof CustomerInputSchema> &
  Record<string, unknown>;

/**
 * ENTITY shape (for reads).
 * - requires id
 * - keeps passthrough() so dynamic fields persist
 */
export const CustomerEntity = CustomerInputSchema.extend({
  id: Id,
}).passthrough();
export type TCustomerEntity = z.infer<typeof CustomerEntity> &
  Record<string, unknown>;

/* ============================================================================
   Requests / Responses (match current functions/http.ts + service.ts)
============================================================================ */

// ---------------- Upsert (POST /customersUpsert) ----------------
// Default enrolled ONLY for upsert inputs (matches service default behavior).
const CustomerUpsertSchema = CustomerInputSchema.extend({
  enrolled: z.boolean().optional().default(true),
}).passthrough();

export const CustomersUpsertBody = z.union([
  CustomerUpsertSchema,
  z.array(CustomerUpsertSchema).min(1),
]);
export type TCustomersUpsertBody = z.infer<typeof CustomersUpsertBody>;
export type TCustomersUpsertResp = Ok<{ ids: string[] }>;

// Back-compat alias (optional but nice while migrating callers)
export const CustomerUpsertBody = CustomersUpsertBody;

// ---------------- Patch (PATCH /customersPatch) ----------------
export const CustomersPatchRow = z
  .object({
    id: Id,
    patch: CustomerInputSchema.partial().passthrough().optional(),
    unset: z.array(z.string().min(1)).optional(),
    coerceNulls: BoolFromLike.optional(),
  })
  .passthrough()
  .refine(
    (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
    { message: "empty_patch" },
  );

export const CustomersPatchBody = z.union([
  CustomersPatchRow,
  z.array(CustomersPatchRow).min(1),
]);
export type TCustomersPatchRow = z.infer<typeof CustomersPatchRow>;
export type TCustomersPatchBody = z.infer<typeof CustomersPatchBody>;
export type TCustomersPatchResp = Ok<{ ids: string[] }>;

// Back-compat alias
export const CustomerPatchBody = CustomersPatchBody;

// ---------------- Delete (POST /customersDelete) ----------------
// IMPORTANT: do NOT preprocess away cascade; keep the object shape.
const CustomersDeleteIdShape = z
  .object({
    id: IdLike.optional(),
    ids: z.preprocess((v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string")
        return v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      return v;
    }, z.array(IdLike).min(1).optional()),
    cascade: BoolFromLike.optional(), // aligns with handler’s cascade behavior
  })
  .passthrough();

const hasIdOrIds = (v: { id?: unknown; ids?: unknown[] }) =>
  typeof v.id === "string" || (Array.isArray(v.ids) && v.ids.length > 0);

const CustomersDeleteIdObj = CustomersDeleteIdShape
  .refine(
    (v) => hasIdOrIds(v),
    { message: "missing_id_or_ids" },
  );

export const CustomersDeleteBody = z.union([
  IdLike,
  z.array(IdLike).min(1),
  CustomersDeleteIdObj,
]);

export type TCustomersDeleteBody = z.infer<typeof CustomersDeleteBody>;
export type TCustomersDeleteResp = Ok<{
  ids: string[];
  active: false;
  deleted: true;
}>;

// ---------------- Admin Delete (POST /customersAdminDelete) ----------------
const CustomersAdminDeleteIdObj = CustomersDeleteIdShape
  .omit({ cascade: true })
  .refine(
    (v) => hasIdOrIds(v),
    { message: "missing_id_or_ids" },
  );

export const CustomersAdminDeleteBody = z.union([
  IdLike,
  z.array(IdLike).min(1),
  CustomersAdminDeleteIdObj,
]);

export type TCustomersAdminDeleteBody = z.infer<
  typeof CustomersAdminDeleteBody
>;
export type TCustomersAdminDeleteResp = Ok<{ ids: string[]; deleted: true }>;

// ---------------- Get (GET /customersGet) ----------------
export const CustomersGetQuery = z.object({ id: IdLike }).passthrough();
export type TCustomersGetQuery = z.infer<typeof CustomersGetQuery>;
export type TCustomersGetResp = Ok<{ customer: TCustomerEntity }>;

// ---------------- List (GET /customersList) ----------------
const ActiveFilter = z.preprocess(
  (v) => {
    if (v === "" || v == null) return "all";
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
    if (Array.isArray(v)) return v[0];
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "" || s === "all" || s === "undefined" || s === "null")
        return "all";
      if (["true", "1", "yes", "y", "active"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
    }
    return "all";
  },
  z.union([z.literal(true), z.literal(false), z.literal("all")]),
);

export const CustomersListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursorUpdatedAt: TsLike.optional(),
    cursorId: IdLike.optional(),
    active: ActiveFilter.optional(),
    deleted: z.enum(["exclude", "only", "include"]).optional(),
    caseManagerId: IdLike.optional(),
    contactCaseManagerId: IdLike.optional(),
  })
  .passthrough();

export type TCustomersListQuery = z.infer<typeof CustomersListQuery>;

// NOTE: matches current handler response (not PaginatedResp)
export type TCustomersListResp = Ok<{
  items: TCustomerEntity[];
  next: { cursorUpdatedAt: unknown; cursorId: string } | null;
  filter: {
    active: true | false | "all";
    deleted: "exclude" | "only" | "include";
  };
  note?: string;
}>;

// ---------------- Backfill Names (POST /customersBackfillNames) ----------------
export const CustomersBackfillNamesBody = z
  .object({
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    allOrgs: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .passthrough();

export type TCustomersBackfillNamesBody = z.infer<typeof CustomersBackfillNamesBody>;
export type TCustomersBackfillNamesResp = Ok<{
  scanned: number;
  updated: number;
  ids: string[];
  dryRun: boolean;
  scopedToOrg: string | null;
}>;

// ---------------- Backfill Case Manager Names (POST /customersBackfillCaseManagerNames) ----------------
export const CustomersBackfillCaseManagerNamesBody = z
  .object({
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    allOrgs: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .passthrough();

export type TCustomersBackfillCaseManagerNamesBody = z.infer<typeof CustomersBackfillCaseManagerNamesBody>;
export type TCustomersBackfillCaseManagerNamesResp = Ok<{
  dryRun: boolean;
  scopedToOrg: string | null;
  limitPerCollection: number;
  customers: { scanned: number; updated: number; ids: string[] };
  enrollments: { scanned: number; updated: number; ids: string[] };
  missingUsers: string[];
  resolvedUsers: number;
}>;

// ---------------- Backfill Assistance Length (POST /customersBackfillAssistanceLength) ----------------
export const CustomersBackfillAssistanceLengthBody = z
  .object({
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    allOrgs: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .passthrough();

export type TCustomersBackfillAssistanceLengthBody = z.infer<
  typeof CustomersBackfillAssistanceLengthBody
>;
export type TCustomersBackfillAssistanceLengthResp = Ok<{
  scanned: number;
  updated: number;
  ids: string[];
  dryRun: boolean;
  scopedToOrg: string | null;
  enrollmentsScanned: number;
}>;
