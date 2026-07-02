import {
  Id,
  IdLike,
  TsLike,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

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
var HouseholdRelationship = z.enum([
  "head",
  "spouse",
  // spouse / partner
  "child",
  "dependent",
  "other"
]);
var HouseholdStatus = z.enum(["active", "archived"]);
var HouseholdMember = z.object({
  customerId: Id,
  // Denormalized display name; cascade-maintained, may be stale until reconciled.
  name: z.string().trim().nullish(),
  relationship: HouseholdRelationship.default("other"),
  // Free-text override for anything outside the enum (e.g. "grandparent").
  relationshipLabel: z.string().trim().nullish(),
  // Exactly one member should be the head; server normalizes/derives headCustomerId.
  isHead: z.boolean().optional()
}).passthrough();
var HouseholdInputSchema = z.object({
  id: Id.optional(),
  // org (server authoritative — reject cross-org writes)
  orgId: Id.nullish(),
  // Household label, e.g. "Smith Household". Server may derive from head name.
  name: z.string().trim().nullish(),
  // Convenience pointer; if omitted, server derives from members[].isHead.
  headCustomerId: Id.nullish(),
  members: z.array(HouseholdMember).max(40).optional(),
  status: HouseholdStatus.optional(),
  notes: z.string().nullish(),
  // server-managed (accepted but ignored on write)
  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike.nullish().optional()
}).passthrough();
var HouseholdEntity = HouseholdInputSchema.extend({
  id: Id,
  orgId: Id,
  memberIds: z.array(Id).default([]),
  members: z.array(HouseholdMember).default([])
}).passthrough();
var HouseholdsUpsertBody = HouseholdInputSchema;
var HouseholdsPatchRow = z.object({
  id: Id,
  patch: HouseholdInputSchema.partial().passthrough().optional(),
  unset: z.array(z.string().min(1)).optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var HouseholdsPatchBody = z.union([
  HouseholdsPatchRow,
  z.array(HouseholdsPatchRow).min(1)
]);
var HouseholdsAddMemberBody = z.object({
  householdId: Id.optional(),
  member: HouseholdMember,
  // When creating a new household inline, optional label.
  name: z.string().trim().nullish()
}).passthrough();
var HouseholdsRemoveMemberBody = z.object({
  householdId: Id,
  customerId: Id
}).passthrough();
var HouseholdsSetHeadBody = z.object({
  householdId: Id,
  customerId: Id
}).passthrough();
var HouseholdsDeleteBody = z.object({
  id: IdLike.optional(),
  ids: z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    return v;
  }, z.array(IdLike).min(1).optional())
}).passthrough().refine(
  (v) => typeof v.id === "string" || Array.isArray(v.ids) && v.ids.length > 0,
  { message: "missing_id_or_ids" }
);
var HouseholdsGetQuery = z.object({
  id: IdLike.optional(),
  customerId: IdLike.optional()
}).passthrough().refine((v) => !!v.id || !!v.customerId, { message: "missing_id_or_customerId" });
var HouseholdsListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
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

export {
  HouseholdRelationship,
  HouseholdStatus,
  HouseholdMember,
  HouseholdInputSchema,
  HouseholdEntity,
  HouseholdsUpsertBody,
  HouseholdsPatchRow,
  HouseholdsPatchBody,
  HouseholdsAddMemberBody,
  HouseholdsRemoveMemberBody,
  HouseholdsSetHeadBody,
  HouseholdsDeleteBody,
  HouseholdsGetQuery,
  HouseholdsListQuery,
  householdRelationshipLabel,
  deriveHeadCustomerId,
  households_exports
};
