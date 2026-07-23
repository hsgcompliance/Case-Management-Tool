import { z } from "./core.js";
import { Ok } from "./http.js";
export { toArray } from "./core.js";
/**
 * Core idea:
 *  - Validate known/core fields.
 *  - Allow dynamic additions via passthrough().
 *  - Do NOT strip unknown keys.
 */
export declare const Population: z.ZodNullable<z.ZodEnum<{
    Youth: "Youth";
    Individual: "Individual";
    Family: "Family";
}>>;
export type TPopulation = z.infer<typeof Population>;
export declare const CustomerStatus: z.ZodNullable<z.ZodEnum<{
    active: "active";
    inactive: "inactive";
    deleted: "deleted";
}>>;
export type TCustomerStatus = z.infer<typeof CustomerStatus>;
/** Timestamp-keyed customer note history: notes["2026-07-23T...Z"] = "..." */
export declare const CustomerNotesSchema: z.ZodRecord<z.ZodString, z.ZodString>;
export type TCustomerNotes = z.infer<typeof CustomerNotesSchema>;
export declare const CustomerAcuity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
    templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
}, z.core.$loose>>>;
export declare const CustomerMeta: z.ZodOptional<z.ZodNullable<z.ZodObject<{
    driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
    }, z.core.$strip>>>;
    driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
    householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>>>;
export declare const AssistanceLength: z.ZodOptional<z.ZodNullable<z.ZodObject<{
    firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>>>;
export type TAssistanceLength = z.infer<typeof AssistanceLength>;
export declare const CustomerOtherContact: z.ZodObject<{
    uid: z.ZodString;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, z.core.$loose>;
export type TCustomerOtherContact = z.infer<typeof CustomerOtherContact>;
/**
 * INPUT shape (for write endpoints).
 * - id optional (server may generate)
 * - orgId/teamIds accepted but server-owned/overwritten (or forbidden in PATCH)
 * - dynamic keys allowed via passthrough()
 */
export declare const CustomerInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    firstName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dob: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    otherContacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        uid: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>;
    contactCaseManagerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        deleted: "deleted";
    }>>>;
    active: z.ZodOptional<z.ZodBoolean>;
    enrolled: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    population: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>>;
    assistanceLength: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    acuityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    acuity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    }, z.core.$loose>>>;
    tier: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
        }, z.core.$strip>>>;
        driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
        householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    customerDrive: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    error: "error";
                    linked: "linked";
                    needsReview: "needsReview";
                    notFound: "notFound";
                }>>>;
                linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    payer: "payer";
                    nonpayer: "nonpayer";
                }>>>;
                lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    alias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type CustomerInput = z.infer<typeof CustomerInputSchema> & Record<string, unknown>;
/**
 * ENTITY shape (for reads).
 * - requires id
 * - keeps passthrough() so dynamic fields persist
 */
export declare const CustomerEntity: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    firstName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dob: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    otherContacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        uid: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>;
    contactCaseManagerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        deleted: "deleted";
    }>>>;
    active: z.ZodOptional<z.ZodBoolean>;
    enrolled: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    population: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>>;
    assistanceLength: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    acuityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    acuity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    }, z.core.$loose>>>;
    tier: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
        }, z.core.$strip>>>;
        driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
        householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    customerDrive: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    error: "error";
                    linked: "linked";
                    needsReview: "needsReview";
                    notFound: "notFound";
                }>>>;
                linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    payer: "payer";
                    nonpayer: "nonpayer";
                }>>>;
                lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    alias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    id: z.ZodString;
}, z.core.$loose>;
export type TCustomerEntity = z.infer<typeof CustomerEntity> & Record<string, unknown>;
export declare const CustomersUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    firstName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dob: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    otherContacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        uid: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>;
    contactCaseManagerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        deleted: "deleted";
    }>>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    population: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>>;
    assistanceLength: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    acuityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    acuity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    }, z.core.$loose>>>;
    tier: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
        }, z.core.$strip>>>;
        driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
        householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    customerDrive: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    error: "error";
                    linked: "linked";
                    needsReview: "needsReview";
                    notFound: "notFound";
                }>>>;
                linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    payer: "payer";
                    nonpayer: "nonpayer";
                }>>>;
                lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    alias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrolled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    firstName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dob: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    otherContacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        uid: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>;
    contactCaseManagerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        deleted: "deleted";
    }>>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    population: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>>;
    assistanceLength: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    acuityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    acuity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    }, z.core.$loose>>>;
    tier: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
        }, z.core.$strip>>>;
        driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
        householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    customerDrive: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    error: "error";
                    linked: "linked";
                    needsReview: "needsReview";
                    notFound: "notFound";
                }>>>;
                linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    payer: "payer";
                    nonpayer: "nonpayer";
                }>>>;
                lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    alias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrolled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$loose>>]>;
export type TCustomersUpsertBody = z.infer<typeof CustomersUpsertBody>;
export type TCustomersUpsertResp = Ok<{
    ids: string[];
}>;
export declare const CustomerUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    firstName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dob: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    otherContacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        uid: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>;
    contactCaseManagerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        deleted: "deleted";
    }>>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    population: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>>;
    assistanceLength: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    acuityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    acuity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    }, z.core.$loose>>>;
    tier: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
        }, z.core.$strip>>>;
        driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
        householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    customerDrive: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    error: "error";
                    linked: "linked";
                    needsReview: "needsReview";
                    notFound: "notFound";
                }>>>;
                linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    payer: "payer";
                    nonpayer: "nonpayer";
                }>>>;
                lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    alias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrolled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    firstName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dob: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secondaryCaseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    otherContacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        uid: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>>;
    contactCaseManagerIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        deleted: "deleted";
    }>>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    population: z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>>;
    assistanceLength: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    acuityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    acuity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    }, z.core.$loose>>>;
    tier: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
        }, z.core.$strip>>>;
        driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
        householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    customerDrive: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    error: "error";
                    linked: "linked";
                    needsReview: "needsReview";
                    notFound: "notFound";
                }>>>;
                linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                    payer: "payer";
                    nonpayer: "nonpayer";
                }>>>;
                lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>;
    }, z.core.$loose>>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    alias: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hmisId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cwId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrolled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$loose>>]>;
export declare const CustomersPatchRow: z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        teamIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        firstName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        lastName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        dob: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        otherContacts: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            uid: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>;
        contactCaseManagerIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            inactive: "inactive";
            deleted: "deleted";
        }>>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        enrolled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        population: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>>>;
        assistanceLength: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        acuityScore: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        acuity: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        }, z.core.$loose>>>>;
        tier: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
            }, z.core.$strip>>>;
            driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
            householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        customerDrive: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        error: "error";
                        linked: "linked";
                        needsReview: "needsReview";
                        notFound: "notFound";
                    }>>>;
                    linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                    defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        payer: "payer";
                        nonpayer: "nonpayer";
                    }>>>;
                    lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        phone: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        address: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
    coerceNulls: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
}, z.core.$loose>;
export declare const CustomersPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        teamIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        firstName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        lastName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        dob: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        otherContacts: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            uid: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>;
        contactCaseManagerIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            inactive: "inactive";
            deleted: "deleted";
        }>>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        enrolled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        population: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>>>;
        assistanceLength: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        acuityScore: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        acuity: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        }, z.core.$loose>>>>;
        tier: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
            }, z.core.$strip>>>;
            driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
            householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        customerDrive: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        error: "error";
                        linked: "linked";
                        needsReview: "needsReview";
                        notFound: "notFound";
                    }>>>;
                    linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                    defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        payer: "payer";
                        nonpayer: "nonpayer";
                    }>>>;
                    lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        phone: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        address: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
    coerceNulls: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        teamIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        firstName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        lastName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        dob: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        otherContacts: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            uid: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>;
        contactCaseManagerIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            inactive: "inactive";
            deleted: "deleted";
        }>>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        enrolled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        population: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>>>;
        assistanceLength: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        acuityScore: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        acuity: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        }, z.core.$loose>>>>;
        tier: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
            }, z.core.$strip>>>;
            driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
            householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        customerDrive: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        error: "error";
                        linked: "linked";
                        needsReview: "needsReview";
                        notFound: "notFound";
                    }>>>;
                    linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                    defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        payer: "payer";
                        nonpayer: "nonpayer";
                    }>>>;
                    lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        phone: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        address: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
    coerceNulls: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
}, z.core.$loose>>]>;
export type TCustomersPatchRow = z.infer<typeof CustomersPatchRow>;
export type TCustomersPatchBody = z.infer<typeof CustomersPatchBody>;
export type TCustomersPatchResp = Ok<{
    ids: string[];
}>;
export declare const CustomerPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        teamIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        firstName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        lastName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        dob: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        otherContacts: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            uid: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>;
        contactCaseManagerIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            inactive: "inactive";
            deleted: "deleted";
        }>>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        enrolled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        population: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>>>;
        assistanceLength: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        acuityScore: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        acuity: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        }, z.core.$loose>>>>;
        tier: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
            }, z.core.$strip>>>;
            driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
            householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        customerDrive: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        error: "error";
                        linked: "linked";
                        needsReview: "needsReview";
                        notFound: "notFound";
                    }>>>;
                    linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                    defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        payer: "payer";
                        nonpayer: "nonpayer";
                    }>>>;
                    lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        phone: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        address: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
    coerceNulls: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        teamIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        firstName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        lastName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        dob: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        caseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        secondaryCaseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        otherContacts: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            uid: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            role: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$loose>>>>;
        contactCaseManagerIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            active: "active";
            inactive: "inactive";
            deleted: "deleted";
        }>>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        enrolled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        population: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNullable<z.ZodEnum<{
            Youth: "Youth";
            Individual: "Individual";
            Family: "Family";
        }>>>>>;
        assistanceLength: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            firstDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lastExpectedDateOfAssistance: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        acuityScore: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        acuity: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            submissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            computedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
                seconds: z.ZodNumber;
                nanoseconds: z.ZodNumber;
            }, z.core.$strip>]>>>;
            answers: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        }, z.core.$loose>>>>;
        tier: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            driveFolders: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                driveId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                kind: z.ZodDefault<z.ZodLiteral<"gdrive">>;
            }, z.core.$strip>>>;
            driveFolderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>>>;
            householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            householdRelationship: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>>;
        customerDrive: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            folderUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            linkedWorkbooks: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                tss: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    spreadsheetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    spreadsheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    standardKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        error: "error";
                        linked: "linked";
                        needsReview: "needsReview";
                        notFound: "notFound";
                    }>>>;
                    linkedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    linkedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    detectedSheets: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
                    defaultEmbedSheetName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                    defaultSheetGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    progressNotesGid: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                    variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                        payer: "payer";
                        nonpayer: "nonpayer";
                    }>>>;
                    lastValidatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                }, z.core.$loose>>>;
            }, z.core.$loose>>>;
        }, z.core.$loose>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>>;
        alias: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        hmisId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cwId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        phone: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        address: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
    coerceNulls: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
}, z.core.$loose>>]>;
export declare const CustomersDeleteBody: z.ZodUnion<readonly [z.ZodPreprocess<z.ZodString>, z.ZodArray<z.ZodPreprocess<z.ZodString>>, z.ZodObject<{
    id: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    ids: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
    cascade: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
}, z.core.$loose>]>;
export type TCustomersDeleteBody = z.infer<typeof CustomersDeleteBody>;
export type TCustomersDeleteResp = Ok<{
    ids: string[];
    active: false;
    deleted: true;
}>;
export declare const CustomersAdminDeleteBody: z.ZodUnion<readonly [z.ZodPreprocess<z.ZodString>, z.ZodArray<z.ZodPreprocess<z.ZodString>>, z.ZodObject<{
    id: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    ids: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodPreprocess<z.ZodString>>>>;
}, z.core.$loose>]>;
export type TCustomersAdminDeleteBody = z.infer<typeof CustomersAdminDeleteBody>;
export type TCustomersAdminDeleteResp = Ok<{
    ids: string[];
    deleted: true;
}>;
export declare const CustomersGetQuery: z.ZodObject<{
    id: z.ZodPreprocess<z.ZodString>;
}, z.core.$loose>;
export type TCustomersGetQuery = z.infer<typeof CustomersGetQuery>;
export type TCustomersGetResp = Ok<{
    customer: TCustomerEntity;
}>;
export declare const CustomersListQuery: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    cursorUpdatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    cursorId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    active: z.ZodOptional<z.ZodPreprocess<z.ZodUnion<readonly [z.ZodLiteral<true>, z.ZodLiteral<false>, z.ZodLiteral<"all">]>>>;
    deleted: z.ZodOptional<z.ZodEnum<{
        include: "include";
        exclude: "exclude";
        only: "only";
    }>>;
    caseManagerId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    contactCaseManagerId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TCustomersListQuery = z.infer<typeof CustomersListQuery>;
export type TCustomersListResp = Ok<{
    items: TCustomerEntity[];
    next: {
        cursorUpdatedAt: unknown;
        cursorId: string;
    } | null;
    filter: {
        active: true | false | "all";
        deleted: "exclude" | "only" | "include";
    };
    note?: string;
}>;
export declare const CustomersBackfillNamesBody: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    allOrgs: z.ZodOptional<z.ZodBoolean>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TCustomersBackfillNamesBody = z.infer<typeof CustomersBackfillNamesBody>;
export type TCustomersBackfillNamesResp = Ok<{
    scanned: number;
    updated: number;
    ids: string[];
    dryRun: boolean;
    scopedToOrg: string | null;
}>;
export declare const CustomersBackfillCaseManagerNamesBody: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    allOrgs: z.ZodOptional<z.ZodBoolean>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TCustomersBackfillCaseManagerNamesBody = z.infer<typeof CustomersBackfillCaseManagerNamesBody>;
export type TCustomersBackfillCaseManagerNamesResp = Ok<{
    dryRun: boolean;
    scopedToOrg: string | null;
    limitPerCollection: number;
    customers: {
        scanned: number;
        updated: number;
        ids: string[];
    };
    enrollments: {
        scanned: number;
        updated: number;
        ids: string[];
    };
    missingUsers: string[];
    resolvedUsers: number;
}>;
export declare const CustomersBackfillAssistanceLengthBody: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    allOrgs: z.ZodOptional<z.ZodBoolean>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TCustomersBackfillAssistanceLengthBody = z.infer<typeof CustomersBackfillAssistanceLengthBody>;
export type TCustomersBackfillAssistanceLengthResp = Ok<{
    scanned: number;
    updated: number;
    ids: string[];
    dryRun: boolean;
    scopedToOrg: string | null;
    enrollmentsScanned: number;
}>;
