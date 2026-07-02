import { z } from "./core.js";
import { Ok } from "./http.js";
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
export declare const HouseholdRelationship: z.ZodEnum<{
    other: "other";
    head: "head";
    spouse: "spouse";
    child: "child";
    dependent: "dependent";
}>;
export type THouseholdRelationship = z.infer<typeof HouseholdRelationship>;
export declare const HouseholdStatus: z.ZodEnum<{
    active: "active";
    archived: "archived";
}>;
export type THouseholdStatus = z.infer<typeof HouseholdStatus>;
/**
 * One household member. References a `customers/{id}` doc and denormalizes the
 * member's display name + relationship for fast list rendering (data-cascade keeps
 * `name` in sync on customer rename).
 */
export declare const HouseholdMember: z.ZodObject<{
    customerId: z.ZodString;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    relationship: z.ZodDefault<z.ZodEnum<{
        other: "other";
        head: "head";
        spouse: "spouse";
        child: "child";
        dependent: "dependent";
    }>>;
    relationshipLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isHead: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type THouseholdMember = z.infer<typeof HouseholdMember>;
/**
 * INPUT shape (write endpoints).
 * - id optional (server may generate)
 * - orgId accepted but server-authoritative (overwritten / rejected on mismatch)
 * - memberIds derived server-side from `members`; not required on input
 */
export declare const HouseholdInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    headCustomerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    members: z.ZodOptional<z.ZodArray<z.ZodObject<{
        customerId: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        relationship: z.ZodDefault<z.ZodEnum<{
            other: "other";
            head: "head";
            spouse: "spouse";
            child: "child";
            dependent: "dependent";
        }>>;
        relationshipLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        isHead: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
    }>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
}, z.core.$loose>;
export type HouseholdInput = z.infer<typeof HouseholdInputSchema> & Record<string, unknown>;
/**
 * ENTITY shape (reads). Requires id + the server-maintained flat `memberIds`
 * array (array-contains queryable: "which household is this customer in").
 */
export declare const HouseholdEntity: z.ZodObject<{
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    headCustomerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
    }>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    id: z.ZodString;
    orgId: z.ZodString;
    memberIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    members: z.ZodDefault<z.ZodArray<z.ZodObject<{
        customerId: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        relationship: z.ZodDefault<z.ZodEnum<{
            other: "other";
            head: "head";
            spouse: "spouse";
            child: "child";
            dependent: "dependent";
        }>>;
        relationshipLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        isHead: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
export type THouseholdEntity = z.infer<typeof HouseholdEntity> & Record<string, unknown>;
export declare const HouseholdsUpsertBody: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    headCustomerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    members: z.ZodOptional<z.ZodArray<z.ZodObject<{
        customerId: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        relationship: z.ZodDefault<z.ZodEnum<{
            other: "other";
            head: "head";
            spouse: "spouse";
            child: "child";
            dependent: "dependent";
        }>>;
        relationshipLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        isHead: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
    }>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
}, z.core.$loose>;
export type THouseholdsUpsertBody = z.infer<typeof HouseholdsUpsertBody>;
export type THouseholdsUpsertResp = Ok<{
    id: string;
    household: THouseholdEntity;
}>;
export declare const HouseholdsPatchRow: z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        headCustomerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        members: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            customerId: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            relationship: z.ZodDefault<z.ZodEnum<{
                other: "other";
                head: "head";
                spouse: "spouse";
                child: "child";
                dependent: "dependent";
            }>>;
            relationshipLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            isHead: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            active: "active";
            archived: "archived";
        }>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
    }, z.core.$loose>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>;
export declare const HouseholdsPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        headCustomerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        members: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            customerId: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            relationship: z.ZodDefault<z.ZodEnum<{
                other: "other";
                head: "head";
                spouse: "spouse";
                child: "child";
                dependent: "dependent";
            }>>;
            relationshipLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            isHead: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            active: "active";
            archived: "archived";
        }>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
    }, z.core.$loose>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        headCustomerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        members: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            customerId: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            relationship: z.ZodDefault<z.ZodEnum<{
                other: "other";
                head: "head";
                spouse: "spouse";
                child: "child";
                dependent: "dependent";
            }>>;
            relationshipLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            isHead: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$loose>>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            active: "active";
            archived: "archived";
        }>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
    }, z.core.$loose>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>>]>;
export type THouseholdsPatchRow = z.infer<typeof HouseholdsPatchRow>;
export type THouseholdsPatchBody = z.infer<typeof HouseholdsPatchBody>;
export type THouseholdsPatchResp = Ok<{
    ids: string[];
}>;
export declare const HouseholdsAddMemberBody: z.ZodObject<{
    householdId: z.ZodOptional<z.ZodString>;
    member: z.ZodObject<{
        customerId: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        relationship: z.ZodDefault<z.ZodEnum<{
            other: "other";
            head: "head";
            spouse: "spouse";
            child: "child";
            dependent: "dependent";
        }>>;
        relationshipLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        isHead: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$loose>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type THouseholdsAddMemberBody = z.infer<typeof HouseholdsAddMemberBody>;
export type THouseholdsAddMemberResp = Ok<{
    id: string;
    household: THouseholdEntity;
}>;
export declare const HouseholdsRemoveMemberBody: z.ZodObject<{
    householdId: z.ZodString;
    customerId: z.ZodString;
}, z.core.$loose>;
export type THouseholdsRemoveMemberBody = z.infer<typeof HouseholdsRemoveMemberBody>;
export type THouseholdsRemoveMemberResp = Ok<{
    id: string;
    household: THouseholdEntity | null;
}>;
export declare const HouseholdsSetHeadBody: z.ZodObject<{
    householdId: z.ZodString;
    customerId: z.ZodString;
}, z.core.$loose>;
export type THouseholdsSetHeadBody = z.infer<typeof HouseholdsSetHeadBody>;
export type THouseholdsSetHeadResp = Ok<{
    id: string;
    household: THouseholdEntity;
}>;
export declare const HouseholdsDeleteBody: z.ZodObject<{
    id: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    ids: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
}, z.core.$loose>;
export type THouseholdsDeleteBody = z.infer<typeof HouseholdsDeleteBody>;
export type THouseholdsDeleteResp = Ok<{
    ids: string[];
    deleted: true;
}>;
export declare const HouseholdsGetQuery: z.ZodObject<{
    id: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type THouseholdsGetQuery = z.infer<typeof HouseholdsGetQuery>;
export type THouseholdsGetResp = Ok<{
    household: THouseholdEntity | null;
}>;
export declare const HouseholdsListQuery: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    cursorUpdatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    cursorId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    memberCustomerId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        archived: "archived";
    }>>;
}, z.core.$loose>;
export type THouseholdsListQuery = z.infer<typeof HouseholdsListQuery>;
export type THouseholdsListResp = Ok<{
    items: THouseholdEntity[];
    next: {
        cursorUpdatedAt: unknown;
        cursorId: string;
    } | null;
}>;
export declare function householdRelationshipLabel(member: {
    relationship?: THouseholdRelationship | string | null;
    relationshipLabel?: string | null;
}): string;
/** Derive the head member's customerId from a member list (explicit isHead wins). */
export declare function deriveHeadCustomerId(members: Array<{
    customerId: string;
    isHead?: boolean;
    relationship?: string | null;
}>): string | null;
