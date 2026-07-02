// contracts/src/households.ts
import { z, Id, IdLike, TsLike } from "./core";
import { Ok } from "./http";

/**
 * Household / family linking model (Customer-Collection-Update, Phase 1).
 *
 * Hybrid storage (decision (c) in PLAN.md, mirrors submission-linking):
 *  - Canonical `households/{id}` doc holds the member list + head pointer.
 *  - Each member's `customers/{id}` doc carries a lightweight denormalized
 *    pointer `meta.householdId` (+ `meta.householdRelationship`) so cards/queries
 *    can resolve membership without loading the household doc. The pointer fields
 *    live on CustomerMeta (see customers.ts).
 *
 * Reverse lookup (household → members) comes from this collection; forward lookup
 * (member → household) comes from the customer-doc pointer.
 *
 * Cardinality: one primary household per customer (`meta.householdId` is scalar).
 * Secondary/again-linked households (e.g. shared custody) are intentionally out of
 * scope for Phase 1.
 */

/* ============================================================================
   Relationship vocabulary
============================================================================ */

// Minimal + extensible. Anything outside the enum rides on `relationshipLabel`.
export const HouseholdRelationship = z.enum([
  "head",
  "spouse", // spouse / partner
  "child",
  "dependent",
  "other",
]);
export type THouseholdRelationship = z.infer<typeof HouseholdRelationship>;

export const HouseholdStatus = z.enum(["active", "archived"]);
export type THouseholdStatus = z.infer<typeof HouseholdStatus>;

/* ============================================================================
   Member shape
============================================================================ */

/**
 * One household member. References a `customers/{id}` doc and denormalizes the
 * member's display name + relationship for fast list rendering (data-cascade keeps
 * `name` in sync on customer rename).
 */
export const HouseholdMember = z
  .object({
    customerId: Id,
    // Denormalized display name; cascade-maintained, may be stale until reconciled.
    name: z.string().trim().nullish(),
    relationship: HouseholdRelationship.default("other"),
    // Free-text override for anything outside the enum (e.g. "grandparent").
    relationshipLabel: z.string().trim().nullish(),
    // Exactly one member should be the head; server normalizes/derives headCustomerId.
    isHead: z.boolean().optional(),
  })
  .passthrough();
export type THouseholdMember = z.infer<typeof HouseholdMember>;

/* ============================================================================
   Core schemas
============================================================================ */

/**
 * INPUT shape (write endpoints).
 * - id optional (server may generate)
 * - orgId accepted but server-authoritative (overwritten / rejected on mismatch)
 * - memberIds derived server-side from `members`; not required on input
 */
export const HouseholdInputSchema = z
  .object({
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
    updatedAt: TsLike.nullish().optional(),
  })
  .passthrough();
export type HouseholdInput = z.infer<typeof HouseholdInputSchema> &
  Record<string, unknown>;

/**
 * ENTITY shape (reads). Requires id + the server-maintained flat `memberIds`
 * array (array-contains queryable: "which household is this customer in").
 */
export const HouseholdEntity = HouseholdInputSchema.extend({
  id: Id,
  orgId: Id,
  memberIds: z.array(Id).default([]),
  members: z.array(HouseholdMember).default([]),
}).passthrough();
export type THouseholdEntity = z.infer<typeof HouseholdEntity> &
  Record<string, unknown>;

/* ============================================================================
   Requests / Responses
============================================================================ */

// ---------------- Upsert (POST /householdsUpsert) ----------------
export const HouseholdsUpsertBody = HouseholdInputSchema;
export type THouseholdsUpsertBody = z.infer<typeof HouseholdsUpsertBody>;
export type THouseholdsUpsertResp = Ok<{ id: string; household: THouseholdEntity }>;

// ---------------- Patch (PATCH /householdsPatch) ----------------
export const HouseholdsPatchRow = z
  .object({
    id: Id,
    patch: HouseholdInputSchema.partial().passthrough().optional(),
    unset: z.array(z.string().min(1)).optional(),
  })
  .passthrough()
  .refine(
    (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
    { message: "empty_patch" },
  );
export const HouseholdsPatchBody = z.union([
  HouseholdsPatchRow,
  z.array(HouseholdsPatchRow).min(1),
]);
export type THouseholdsPatchRow = z.infer<typeof HouseholdsPatchRow>;
export type THouseholdsPatchBody = z.infer<typeof HouseholdsPatchBody>;
export type THouseholdsPatchResp = Ok<{ ids: string[] }>;

// ---------------- Add member (POST /householdsAddMember) ----------------
// Adds a customer to a household (creating the household if householdId omitted).
// Writes the canonical doc + the customer's meta.householdId pointer.
export const HouseholdsAddMemberBody = z
  .object({
    householdId: Id.optional(),
    member: HouseholdMember,
    // When creating a new household inline, optional label.
    name: z.string().trim().nullish(),
  })
  .passthrough();
export type THouseholdsAddMemberBody = z.infer<typeof HouseholdsAddMemberBody>;
export type THouseholdsAddMemberResp = Ok<{ id: string; household: THouseholdEntity }>;

// ---------------- Remove member (POST /householdsRemoveMember) ----------------
export const HouseholdsRemoveMemberBody = z
  .object({
    householdId: Id,
    customerId: Id,
  })
  .passthrough();
export type THouseholdsRemoveMemberBody = z.infer<typeof HouseholdsRemoveMemberBody>;
export type THouseholdsRemoveMemberResp = Ok<{ id: string; household: THouseholdEntity | null }>;

// ---------------- Set head (POST /householdsSetHead) ----------------
export const HouseholdsSetHeadBody = z
  .object({
    householdId: Id,
    customerId: Id,
  })
  .passthrough();
export type THouseholdsSetHeadBody = z.infer<typeof HouseholdsSetHeadBody>;
export type THouseholdsSetHeadResp = Ok<{ id: string; household: THouseholdEntity }>;

// ---------------- Delete (POST /householdsDelete) ----------------
// Unlinks all members (clears their meta.householdId) and removes the doc.
export const HouseholdsDeleteBody = z
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
  })
  .passthrough()
  .refine(
    (v) => typeof v.id === "string" || (Array.isArray(v.ids) && v.ids.length > 0),
    { message: "missing_id_or_ids" },
  );
export type THouseholdsDeleteBody = z.infer<typeof HouseholdsDeleteBody>;
export type THouseholdsDeleteResp = Ok<{ ids: string[]; deleted: true }>;

// ---------------- Get (GET /householdsGet) ----------------
// Lookup by household id OR by a member's customerId (resolves via pointer).
export const HouseholdsGetQuery = z
  .object({
    id: IdLike.optional(),
    customerId: IdLike.optional(),
  })
  .passthrough()
  .refine((v) => !!v.id || !!v.customerId, { message: "missing_id_or_customerId" });
export type THouseholdsGetQuery = z.infer<typeof HouseholdsGetQuery>;
export type THouseholdsGetResp = Ok<{ household: THouseholdEntity | null }>;

// ---------------- List (GET /householdsList) ----------------
export const HouseholdsListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursorUpdatedAt: TsLike.optional(),
    cursorId: IdLike.optional(),
    // Filter to households containing this member (array-contains memberIds).
    memberCustomerId: IdLike.optional(),
    status: HouseholdStatus.optional(),
  })
  .passthrough();
export type THouseholdsListQuery = z.infer<typeof HouseholdsListQuery>;
export type THouseholdsListResp = Ok<{
  items: THouseholdEntity[];
  next: { cursorUpdatedAt: unknown; cursorId: string } | null;
}>;

/* ============================================================================
   Helpers (pure, shared by server + UI)
============================================================================ */

export function householdRelationshipLabel(member: {
  relationship?: THouseholdRelationship | string | null;
  relationshipLabel?: string | null;
}): string {
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

/** Derive the head member's customerId from a member list (explicit isHead wins). */
export function deriveHeadCustomerId(
  members: Array<{ customerId: string; isHead?: boolean; relationship?: string | null }>,
): string | null {
  const flagged = members.find((m) => m.isHead === true);
  if (flagged) return flagged.customerId;
  const byRole = members.find((m) => String(m.relationship || "") === "head");
  if (byRole) return byRole.customerId;
  return members[0]?.customerId ?? null;
}
