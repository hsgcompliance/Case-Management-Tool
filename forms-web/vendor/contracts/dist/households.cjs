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

// src/households.ts
var households_exports = {};
__export(households_exports, {
  HouseholdEntity: () => HouseholdEntity,
  HouseholdInputSchema: () => HouseholdInputSchema,
  HouseholdMember: () => HouseholdMember,
  HouseholdRelationship: () => HouseholdRelationship,
  HouseholdStatus: () => HouseholdStatus,
  HouseholdsAddMemberBody: () => HouseholdsAddMemberBody,
  HouseholdsDeleteBody: () => HouseholdsDeleteBody,
  HouseholdsGetQuery: () => HouseholdsGetQuery,
  HouseholdsListQuery: () => HouseholdsListQuery,
  HouseholdsPatchBody: () => HouseholdsPatchBody,
  HouseholdsPatchRow: () => HouseholdsPatchRow,
  HouseholdsRemoveMemberBody: () => HouseholdsRemoveMemberBody,
  HouseholdsSetHeadBody: () => HouseholdsSetHeadBody,
  HouseholdsUpsertBody: () => HouseholdsUpsertBody,
  deriveHeadCustomerId: () => deriveHeadCustomerId,
  householdRelationshipLabel: () => householdRelationshipLabel
});
module.exports = __toCommonJS(households_exports);

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

// src/households.ts
var HouseholdRelationship = import_zod2.z.enum([
  "head",
  "spouse",
  // spouse / partner
  "child",
  "dependent",
  "other"
]);
var HouseholdStatus = import_zod2.z.enum(["active", "archived"]);
var HouseholdMember = import_zod2.z.object({
  customerId: Id,
  // Denormalized display name; cascade-maintained, may be stale until reconciled.
  name: import_zod2.z.string().trim().nullish(),
  relationship: HouseholdRelationship.default("other"),
  // Free-text override for anything outside the enum (e.g. "grandparent").
  relationshipLabel: import_zod2.z.string().trim().nullish(),
  // Exactly one member should be the head; server normalizes/derives headCustomerId.
  isHead: import_zod2.z.boolean().optional()
}).passthrough();
var HouseholdInputSchema = import_zod2.z.object({
  id: Id.optional(),
  // org (server authoritative — reject cross-org writes)
  orgId: Id.nullish(),
  // Household label, e.g. "Smith Household". Server may derive from head name.
  name: import_zod2.z.string().trim().nullish(),
  // Convenience pointer; if omitted, server derives from members[].isHead.
  headCustomerId: Id.nullish(),
  members: import_zod2.z.array(HouseholdMember).max(40).optional(),
  status: HouseholdStatus.optional(),
  notes: import_zod2.z.string().nullish(),
  // server-managed (accepted but ignored on write)
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional()
}).passthrough();
var HouseholdEntity = HouseholdInputSchema.extend({
  id: Id,
  orgId: Id,
  memberIds: import_zod2.z.array(Id).default([]),
  members: import_zod2.z.array(HouseholdMember).default([])
}).passthrough();
var HouseholdsUpsertBody = HouseholdInputSchema;
var HouseholdsPatchRow = import_zod2.z.object({
  id: Id,
  patch: HouseholdInputSchema.partial().passthrough().optional(),
  unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var HouseholdsPatchBody = import_zod2.z.union([
  HouseholdsPatchRow,
  import_zod2.z.array(HouseholdsPatchRow).min(1)
]);
var HouseholdsAddMemberBody = import_zod2.z.object({
  householdId: Id.optional(),
  member: HouseholdMember,
  // When creating a new household inline, optional label.
  name: import_zod2.z.string().trim().nullish()
}).passthrough();
var HouseholdsRemoveMemberBody = import_zod2.z.object({
  householdId: Id,
  customerId: Id
}).passthrough();
var HouseholdsSetHeadBody = import_zod2.z.object({
  householdId: Id,
  customerId: Id
}).passthrough();
var HouseholdsDeleteBody = import_zod2.z.object({
  id: IdLike.optional(),
  ids: import_zod2.z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    return v;
  }, import_zod2.z.array(IdLike).min(1).optional())
}).passthrough().refine(
  (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0,
  { message: "missing_id_or_ids" }
);
var HouseholdsGetQuery = import_zod2.z.object({
  id: IdLike.optional(),
  customerId: IdLike.optional()
}).passthrough().refine((v) => !!v.id || !!v.customerId, { message: "missing_id_or_customerId" });
var HouseholdsListQuery = import_zod2.z.object({
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  // Filter to households containing this member (array-contains memberIds).
  memberCustomerId: IdLike.optional(),
  status: HouseholdStatus.optional()
}).passthrough();
function householdRelationshipLabel(member) {
  const free = String(member.relationshipLabel || "").trim();
  if (free) return free;
  const rel = String(member.relationship || "other").trim();
  switch (rel) {
    case "head":
      return "Head of Household";
    case "spouse":
      return "Spouse / Partner";
    case "child":
      return "Child";
    case "dependent":
      return "Dependent";
    default:
      return "Other";
  }
}
function deriveHeadCustomerId(members) {
  const flagged = members.find((m) => m.isHead === true);
  if (flagged) return flagged.customerId;
  const byRole = members.find((m) => String(m.relationship || "") === "head");
  if (byRole) return byRole.customerId;
  return members[0]?.customerId ?? null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HouseholdEntity,
  HouseholdInputSchema,
  HouseholdMember,
  HouseholdRelationship,
  HouseholdStatus,
  HouseholdsAddMemberBody,
  HouseholdsDeleteBody,
  HouseholdsGetQuery,
  HouseholdsListQuery,
  HouseholdsPatchBody,
  HouseholdsPatchRow,
  HouseholdsRemoveMemberBody,
  HouseholdsSetHeadBody,
  HouseholdsUpsertBody,
  deriveHeadCustomerId,
  householdRelationshipLabel
});
