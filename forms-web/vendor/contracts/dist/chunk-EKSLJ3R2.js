import {
  BoolFromLike,
  ISO10,
  Id,
  IdLike,
  TsLike,
  toArray,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/customers.ts
var customers_exports = {};
__export(customers_exports, {
  AssistanceLength: () => AssistanceLength,
  CustomerAcuity: () => CustomerAcuity,
  CustomerEntity: () => CustomerEntity,
  CustomerInputSchema: () => CustomerInputSchema,
  CustomerMeta: () => CustomerMeta,
  CustomerNotesSchema: () => CustomerNotesSchema,
  CustomerOtherContact: () => CustomerOtherContact,
  CustomerPatchBody: () => CustomerPatchBody,
  CustomerStatus: () => CustomerStatus,
  CustomerUpsertBody: () => CustomerUpsertBody,
  CustomersAdminDeleteBody: () => CustomersAdminDeleteBody,
  CustomersBackfillAssistanceLengthBody: () => CustomersBackfillAssistanceLengthBody,
  CustomersBackfillCaseManagerNamesBody: () => CustomersBackfillCaseManagerNamesBody,
  CustomersBackfillNamesBody: () => CustomersBackfillNamesBody,
  CustomersDeleteBody: () => CustomersDeleteBody,
  CustomersGetQuery: () => CustomersGetQuery,
  CustomersListQuery: () => CustomersListQuery,
  CustomersPatchBody: () => CustomersPatchBody,
  CustomersPatchRow: () => CustomersPatchRow,
  CustomersUpsertBody: () => CustomersUpsertBody,
  Population: () => Population,
  toArray: () => toArray
});
var Population = z.enum(["Youth", "Individual", "Family"]).nullable();
var CustomerStatus = z.enum(["active", "inactive", "deleted"]).nullable();
var CustomerNotesSchema = z.record(
  z.string().trim().min(1),
  z.string().trim().min(1)
);
var CustomerAcuity = z.object({
  templateId: Id.nullish(),
  templateVersion: z.number().int().nullish(),
  submissionId: Id.nullish(),
  score: z.number().nullish(),
  level: z.string().trim().nullish(),
  computedAt: TsLike.nullish(),
  // tolerated during migration / transitional UI
  answers: z.array(z.unknown()).optional()
}).passthrough().nullish();
var CustomerMeta = z.object({
  // Legacy Drive folder link list. Compatibility read order is:
  // customerDrive.folderId -> meta.driveFolderId -> meta.driveFolders[0].id.
  // New structured Drive state should live under customerDrive, not meta.
  driveFolders: z.array(
    z.object({
      id: z.string(),
      // NOTE: gdrive ids aren't your Id shape; keep string
      alias: z.string().trim().nullish().optional(),
      name: z.string().trim().nullish().optional(),
      driveId: z.string().trim().nullish().optional(),
      kind: z.literal("gdrive").default("gdrive")
    })
  ).optional(),
  // Legacy primary folder pointer kept for backward compatibility. Prefer
  // customerDrive.folderId for new resolvers and mirror writes during migration.
  driveFolderId: z.string().nullish(),
  // Legacy location/shape. New notes belong at CustomerInputSchema.notes.
  notes: z.union([z.string(), CustomerNotesSchema]).nullish(),
  // Household / family linking (Customer-Collection-Update). Denormalized
  // pointer to the canonical households/{id} doc this customer belongs to; the
  // member list itself lives on the household doc. Scalar = one primary
  // household per customer. See contracts/src/households.ts.
  householdId: z.string().trim().nullish(),
  householdRelationship: z.string().trim().nullish()
}).passthrough().nullish();
var AssistanceLength = z.object({
  firstDateOfAssistance: ISO10.nullish(),
  lastExpectedDateOfAssistance: ISO10.nullish()
}).passthrough().nullable().optional();
var CustomerOtherContact = z.object({
  uid: Id,
  name: z.string().trim().nullish(),
  role: z.string().trim().nullish().optional()
}).passthrough();
var CustomerInputSchema = z.object({
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
  // Simple single-select acuity tier (1–3). Kept top-level (not nested under
  // acuity) so Firestore single-field indexes make it directly queryable.
  tier: z.number().int().min(1).max(3).nullish(),
  // Canonical append-only staff notes, keyed by their ISO timestamp.
  notes: CustomerNotesSchema.nullish(),
  // Drive folders + misc metadata. Drive fields here are compatibility
  // fallbacks; new structured Drive state belongs under customerDrive.
  meta: CustomerMeta,
  // Customer workbook integration — persisted separately from meta to keep it top-level queryable
  customerDrive: z.object({
    // Current primary customer folder pointer for Drive/workbook flows.
    folderId: z.string().nullish(),
    folderUrl: z.string().nullish(),
    linkedWorkbooks: z.object({
      tss: z.object({
        spreadsheetId: z.string().nullish(),
        spreadsheetUrl: z.string().nullish(),
        spreadsheetName: z.string().nullish(),
        standardKey: z.string().nullish(),
        linkedEnrollmentId: z.string().nullish(),
        status: z.enum(["linked", "needsReview", "notFound", "error"]).nullish(),
        linkedBy: z.string().nullish(),
        linkedAt: z.string().nullish(),
        updatedAt: z.string().nullish(),
        detectedSheets: z.array(z.string()).nullish(),
        defaultEmbedSheetName: z.string().nullish(),
        defaultSheetGid: z.union([z.string(), z.number()]).nullish(),
        progressNotesGid: z.union([z.string(), z.number()]).nullish(),
        variant: z.enum(["payer", "nonpayer"]).nullish(),
        lastValidatedAt: z.string().nullish()
      }).passthrough().nullish()
    }).passthrough().nullish()
  }).passthrough().nullish(),
  // server-managed timestamps (accepted but ignored on write)
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional(),
  // alternative display name for search
  alias: z.string().trim().nullish(),
  // tolerated legacy / common fields
  hmisId: z.string().trim().nullish(),
  cwId: z.string().trim().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  // keep lenient unless you want z.email()
  address: z.string().nullish()
}).passthrough();
var CustomerEntity = CustomerInputSchema.extend({
  id: Id
}).passthrough();
var CustomerUpsertSchema = CustomerInputSchema.extend({
  enrolled: z.boolean().optional().default(true)
}).passthrough();
var CustomersUpsertBody = z.union([
  CustomerUpsertSchema,
  z.array(CustomerUpsertSchema).min(1)
]);
var CustomerUpsertBody = CustomersUpsertBody;
var CustomersPatchRow = z.object({
  id: Id,
  patch: CustomerInputSchema.partial().passthrough().optional(),
  unset: z.array(z.string().min(1)).optional(),
  coerceNulls: BoolFromLike.optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var CustomersPatchBody = z.union([
  CustomersPatchRow,
  z.array(CustomersPatchRow).min(1)
]);
var CustomerPatchBody = CustomersPatchBody;
var CustomersDeleteIdShape = z.object({
  id: IdLike.optional(),
  ids: z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    return v;
  }, z.array(IdLike).min(1).optional()),
  cascade: BoolFromLike.optional()
  // aligns with handler’s cascade behavior
}).passthrough();
var hasIdOrIds = (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0;
var CustomersDeleteIdObj = CustomersDeleteIdShape.refine(
  (v) => hasIdOrIds(v),
  { message: "missing_id_or_ids" }
);
var CustomersDeleteBody = z.union([
  IdLike,
  z.array(IdLike).min(1),
  CustomersDeleteIdObj
]);
var CustomersAdminDeleteIdObj = CustomersDeleteIdShape.omit({ cascade: true }).refine(
  (v) => hasIdOrIds(v),
  { message: "missing_id_or_ids" }
);
var CustomersAdminDeleteBody = z.union([
  IdLike,
  z.array(IdLike).min(1),
  CustomersAdminDeleteIdObj
]);
var CustomersGetQuery = z.object({ id: IdLike }).passthrough();
var ActiveFilter = z.preprocess(
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
  z.union([z.literal(true), z.literal(false), z.literal("all")])
);
var CustomersListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  active: ActiveFilter.optional(),
  deleted: z.enum(["exclude", "only", "include"]).optional(),
  caseManagerId: IdLike.optional(),
  contactCaseManagerId: IdLike.optional()
}).passthrough();
var CustomersBackfillNamesBody = z.object({
  limit: z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).passthrough();
var CustomersBackfillCaseManagerNamesBody = z.object({
  limit: z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).passthrough();
var CustomersBackfillAssistanceLengthBody = z.object({
  limit: z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).passthrough();

export {
  Population,
  CustomerStatus,
  CustomerNotesSchema,
  CustomerAcuity,
  CustomerMeta,
  AssistanceLength,
  CustomerOtherContact,
  CustomerInputSchema,
  CustomerEntity,
  CustomersUpsertBody,
  CustomerUpsertBody,
  CustomersPatchRow,
  CustomersPatchBody,
  CustomerPatchBody,
  CustomersDeleteBody,
  CustomersAdminDeleteBody,
  CustomersGetQuery,
  CustomersListQuery,
  CustomersBackfillNamesBody,
  CustomersBackfillCaseManagerNamesBody,
  CustomersBackfillAssistanceLengthBody,
  customers_exports
};
