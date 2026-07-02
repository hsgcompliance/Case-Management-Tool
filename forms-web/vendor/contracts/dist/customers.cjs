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

// src/customers.ts
var customers_exports = {};
__export(customers_exports, {
  AssistanceLength: () => AssistanceLength,
  CustomerAcuity: () => CustomerAcuity,
  CustomerEntity: () => CustomerEntity,
  CustomerInputSchema: () => CustomerInputSchema,
  CustomerMeta: () => CustomerMeta,
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
module.exports = __toCommonJS(customers_exports);

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
function toArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

// src/customers.ts
var Population = import_zod2.z.enum(["Youth", "Individual", "Family"]).nullable();
var CustomerStatus = import_zod2.z.enum(["active", "inactive", "deleted"]).nullable();
var CustomerAcuity = import_zod2.z.object({
  templateId: Id.nullish(),
  templateVersion: import_zod2.z.number().int().nullish(),
  submissionId: Id.nullish(),
  score: import_zod2.z.number().nullish(),
  level: import_zod2.z.string().trim().nullish(),
  computedAt: TsLike.nullish(),
  // tolerated during migration / transitional UI
  answers: import_zod2.z.array(import_zod2.z.unknown()).optional()
}).passthrough().nullish();
var CustomerMeta = import_zod2.z.object({
  // Legacy Drive folder link list. Compatibility read order is:
  // customerDrive.folderId -> meta.driveFolderId -> meta.driveFolders[0].id.
  // New structured Drive state should live under customerDrive, not meta.
  driveFolders: import_zod2.z.array(
    import_zod2.z.object({
      id: import_zod2.z.string(),
      // NOTE: gdrive ids aren't your Id shape; keep string
      alias: import_zod2.z.string().trim().nullish().optional(),
      name: import_zod2.z.string().trim().nullish().optional(),
      driveId: import_zod2.z.string().trim().nullish().optional(),
      kind: import_zod2.z.literal("gdrive").default("gdrive")
    })
  ).optional(),
  // Legacy primary folder pointer kept for backward compatibility. Prefer
  // customerDrive.folderId for new resolvers and mirror writes during migration.
  driveFolderId: import_zod2.z.string().nullish(),
  notes: import_zod2.z.string().nullish(),
  // Household / family linking (Customer-Collection-Update). Denormalized
  // pointer to the canonical households/{id} doc this customer belongs to; the
  // member list itself lives on the household doc. Scalar = one primary
  // household per customer. See contracts/src/households.ts.
  householdId: import_zod2.z.string().trim().nullish(),
  householdRelationship: import_zod2.z.string().trim().nullish()
}).passthrough().nullish();
var AssistanceLength = import_zod2.z.object({
  firstDateOfAssistance: ISO10.nullish(),
  lastExpectedDateOfAssistance: ISO10.nullish()
}).passthrough().nullable().optional();
var CustomerOtherContact = import_zod2.z.object({
  uid: Id,
  name: import_zod2.z.string().trim().nullish(),
  role: import_zod2.z.string().trim().nullish().optional()
}).passthrough();
var CustomerInputSchema = import_zod2.z.object({
  id: Id.optional(),
  // org/team (server authoritative)
  orgId: Id.nullish(),
  teamIds: import_zod2.z.array(Id).max(10).optional(),
  // Identity fields
  firstName: import_zod2.z.string().trim().min(1).nullish(),
  lastName: import_zod2.z.string().trim().min(1).nullish(),
  name: import_zod2.z.string().trim().min(1).nullish(),
  // lenient; backend does not enforce ISO10
  dob: import_zod2.z.string().nullish(),
  // case manager binding
  caseManagerId: Id.nullish(),
  caseManagerName: import_zod2.z.string().trim().nullish(),
  secondaryCaseManagerId: Id.nullish(),
  secondaryCaseManagerName: import_zod2.z.string().trim().nullish(),
  otherContacts: import_zod2.z.array(CustomerOtherContact).max(3).optional(),
  contactCaseManagerIds: import_zod2.z.array(Id).max(5).optional(),
  // state (backend coerces/derives coherence)
  status: CustomerStatus.optional(),
  active: import_zod2.z.boolean().optional(),
  enrolled: import_zod2.z.boolean().optional(),
  deleted: import_zod2.z.boolean().optional(),
  // Canonical population + acuity
  population: Population.nullish(),
  assistanceLength: AssistanceLength,
  acuityScore: import_zod2.z.number().nullish(),
  acuity: CustomerAcuity,
  // Simple single-select acuity tier (1–3). Kept top-level (not nested under
  // acuity) so Firestore single-field indexes make it directly queryable.
  tier: import_zod2.z.number().int().min(1).max(3).nullish(),
  // Drive folders + misc metadata. Drive fields here are compatibility
  // fallbacks; new structured Drive state belongs under customerDrive.
  meta: CustomerMeta,
  // Customer workbook integration — persisted separately from meta to keep it top-level queryable
  customerDrive: import_zod2.z.object({
    // Current primary customer folder pointer for Drive/workbook flows.
    folderId: import_zod2.z.string().nullish(),
    folderUrl: import_zod2.z.string().nullish(),
    linkedWorkbooks: import_zod2.z.object({
      tss: import_zod2.z.object({
        spreadsheetId: import_zod2.z.string().nullish(),
        spreadsheetUrl: import_zod2.z.string().nullish(),
        spreadsheetName: import_zod2.z.string().nullish(),
        standardKey: import_zod2.z.string().nullish(),
        linkedEnrollmentId: import_zod2.z.string().nullish(),
        status: import_zod2.z.enum(["linked", "needsReview", "notFound", "error"]).nullish(),
        linkedBy: import_zod2.z.string().nullish(),
        linkedAt: import_zod2.z.string().nullish(),
        updatedAt: import_zod2.z.string().nullish(),
        detectedSheets: import_zod2.z.array(import_zod2.z.string()).nullish(),
        defaultEmbedSheetName: import_zod2.z.string().nullish(),
        defaultSheetGid: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).nullish(),
        progressNotesGid: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()]).nullish(),
        variant: import_zod2.z.enum(["payer", "nonpayer"]).nullish(),
        lastValidatedAt: import_zod2.z.string().nullish()
      }).passthrough().nullish()
    }).passthrough().nullish()
  }).passthrough().nullish(),
  // server-managed timestamps (accepted but ignored on write)
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional(),
  // alternative display name for search
  alias: import_zod2.z.string().trim().nullish(),
  // tolerated legacy / common fields
  hmisId: import_zod2.z.string().trim().nullish(),
  cwId: import_zod2.z.string().trim().nullish(),
  phone: import_zod2.z.string().nullish(),
  email: import_zod2.z.string().nullish(),
  // keep lenient unless you want z.email()
  address: import_zod2.z.string().nullish()
}).passthrough();
var CustomerEntity = CustomerInputSchema.extend({
  id: Id
}).passthrough();
var CustomerUpsertSchema = CustomerInputSchema.extend({
  enrolled: import_zod2.z.boolean().optional().default(true)
}).passthrough();
var CustomersUpsertBody = import_zod2.z.union([
  CustomerUpsertSchema,
  import_zod2.z.array(CustomerUpsertSchema).min(1)
]);
var CustomerUpsertBody = CustomersUpsertBody;
var CustomersPatchRow = import_zod2.z.object({
  id: Id,
  patch: CustomerInputSchema.partial().passthrough().optional(),
  unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional(),
  coerceNulls: BoolFromLike.optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var CustomersPatchBody = import_zod2.z.union([
  CustomersPatchRow,
  import_zod2.z.array(CustomersPatchRow).min(1)
]);
var CustomerPatchBody = CustomersPatchBody;
var CustomersDeleteIdShape = import_zod2.z.object({
  id: IdLike.optional(),
  ids: import_zod2.z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    return v;
  }, import_zod2.z.array(IdLike).min(1).optional()),
  cascade: BoolFromLike.optional()
  // aligns with handler’s cascade behavior
}).passthrough();
var hasIdOrIds = (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0;
var CustomersDeleteIdObj = CustomersDeleteIdShape.refine(
  (v) => hasIdOrIds(v),
  { message: "missing_id_or_ids" }
);
var CustomersDeleteBody = import_zod2.z.union([
  IdLike,
  import_zod2.z.array(IdLike).min(1),
  CustomersDeleteIdObj
]);
var CustomersAdminDeleteIdObj = CustomersDeleteIdShape.omit({ cascade: true }).refine(
  (v) => hasIdOrIds(v),
  { message: "missing_id_or_ids" }
);
var CustomersAdminDeleteBody = import_zod2.z.union([
  IdLike,
  import_zod2.z.array(IdLike).min(1),
  CustomersAdminDeleteIdObj
]);
var CustomersGetQuery = import_zod2.z.object({ id: IdLike }).passthrough();
var ActiveFilter = import_zod2.z.preprocess(
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
  import_zod2.z.union([import_zod2.z.literal(true), import_zod2.z.literal(false), import_zod2.z.literal("all")])
);
var CustomersListQuery = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  active: ActiveFilter.optional(),
  deleted: import_zod2.z.enum(["exclude", "only", "include"]).optional(),
  caseManagerId: IdLike.optional(),
  contactCaseManagerId: IdLike.optional()
}).passthrough();
var CustomersBackfillNamesBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();
var CustomersBackfillCaseManagerNamesBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();
var CustomersBackfillAssistanceLengthBody = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(5e3).optional(),
  allOrgs: import_zod2.z.boolean().optional(),
  dryRun: import_zod2.z.boolean().optional()
}).passthrough();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AssistanceLength,
  CustomerAcuity,
  CustomerEntity,
  CustomerInputSchema,
  CustomerMeta,
  CustomerOtherContact,
  CustomerPatchBody,
  CustomerStatus,
  CustomerUpsertBody,
  CustomersAdminDeleteBody,
  CustomersBackfillAssistanceLengthBody,
  CustomersBackfillCaseManagerNamesBody,
  CustomersBackfillNamesBody,
  CustomersDeleteBody,
  CustomersGetQuery,
  CustomersListQuery,
  CustomersPatchBody,
  CustomersPatchRow,
  CustomersUpsertBody,
  Population,
  toArray
});
