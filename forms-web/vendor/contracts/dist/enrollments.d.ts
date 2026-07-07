import { z } from "./core.js";
import { Ok } from "./http.js";
/** Enrollment-level compliance flags. */
export declare const EnrollmentCompliance: z.ZodObject<{
    caseworthyEntryComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    caseworthyExitComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    hmisEntryComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    hmisExitComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const EnrollmentServiceStatus: z.ZodEnum<{
    active: "active";
    paused: "paused";
    expired: "expired";
}>;
export type TEnrollmentServiceStatus = z.infer<typeof EnrollmentServiceStatus>;
export declare const EnrollmentMedicaidStatus: z.ZodEnum<{
    active: "active";
    closed: "closed";
}>;
export type TEnrollmentMedicaidStatus = z.infer<typeof EnrollmentMedicaidStatus>;
export declare const EnrollmentMedicaid: z.ZodObject<{
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        closed: "closed";
    }>>;
    closedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reopenedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TEnrollmentMedicaid = z.infer<typeof EnrollmentMedicaid>;
export declare const EnrollmentActions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export type TEnrollmentActions = z.infer<typeof EnrollmentActions>;
export declare const EnrollmentActionHistoryEventType: z.ZodEnum<{
    actionChanged: "actionChanged";
    serviceStatusChanged: "serviceStatusChanged";
    medicaidStatusChanged: "medicaidStatusChanged";
    renewalReminderCreated: "renewalReminderCreated";
    enrollmentExpired: "enrollmentExpired";
    automationFailed: "automationFailed";
}>;
export type TEnrollmentActionHistoryEventType = z.infer<typeof EnrollmentActionHistoryEventType>;
export declare const EnrollmentActionHistoryRecord: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    eventType: z.ZodEnum<{
        actionChanged: "actionChanged";
        serviceStatusChanged: "serviceStatusChanged";
        medicaidStatusChanged: "medicaidStatusChanged";
        renewalReminderCreated: "renewalReminderCreated";
        enrollmentExpired: "enrollmentExpired";
        automationFailed: "automationFailed";
    }>;
    actionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    actorType: z.ZodDefault<z.ZodEnum<{
        system: "system";
        user: "user";
        automation: "automation";
    }>>;
    actorId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    before: z.ZodOptional<z.ZodUnknown>;
    after: z.ZodOptional<z.ZodUnknown>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
}, z.core.$loose>;
export type TEnrollmentActionHistoryRecord = z.infer<typeof EnrollmentActionHistoryRecord>;
export declare const EnrollmentActionsApplyBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    actionId: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodUnknown>;
    serviceStatus: z.ZodOptional<z.ZodEnum<{
        active: "active";
        paused: "paused";
        expired: "expired";
    }>>;
    medicaid: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>>;
        closedDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        reopenedDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$loose>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TEnrollmentActionsApplyBody = z.infer<typeof EnrollmentActionsApplyBody>;
export type TEnrollmentActionsApplyResp = Ok<{
    enrollmentId: string;
    historyId: string;
}>;
/** Legacy builder meta (v1) captured alongside schedules. */
export declare const ScheduleMetaV1: z.ZodObject<{
    version: z.ZodLiteral<1>;
    rentPlans: z.ZodArray<z.ZodObject<{
        firstDue: z.ZodString;
        months: z.ZodString;
        monthly: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    utilPlans: z.ZodArray<z.ZodObject<{
        firstDue: z.ZodString;
        months: z.ZodString;
        monthly: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    deposit: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        date: z.ZodString;
        amount: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    prorated: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        date: z.ZodString;
        amount: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    services: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        note: z.ZodString;
        date: z.ZodString;
        amount: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        toEnrollmentId: z.ZodString;
        toGrantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>;
    editedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Meta written on destination enrollment during migration. */
export declare const ScheduleMetaMigrated: z.ZodObject<{
    mode: z.ZodLiteral<"migrated">;
    cutover: z.ZodString;
    defaultEditMode: z.ZodOptional<z.ZodEnum<{
        keepManual: "keepManual";
        rebuildUnpaid: "rebuildUnpaid";
    }>>;
    fromEnrollmentId: z.ZodString;
    fromGrantId: z.ZodString;
    lineItemMapSnapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        toEnrollmentId: z.ZodString;
        toGrantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const ScheduleMeta: z.ZodUnion<readonly [z.ZodObject<{
    mode: z.ZodLiteral<"migrated">;
    cutover: z.ZodString;
    defaultEditMode: z.ZodOptional<z.ZodEnum<{
        keepManual: "keepManual";
        rebuildUnpaid: "rebuildUnpaid";
    }>>;
    fromEnrollmentId: z.ZodString;
    fromGrantId: z.ZodString;
    lineItemMapSnapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        toEnrollmentId: z.ZodString;
        toGrantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>, z.ZodObject<{
    version: z.ZodLiteral<1>;
    rentPlans: z.ZodArray<z.ZodObject<{
        firstDue: z.ZodString;
        months: z.ZodString;
        monthly: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    utilPlans: z.ZodArray<z.ZodObject<{
        firstDue: z.ZodString;
        months: z.ZodString;
        monthly: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    deposit: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        date: z.ZodString;
        amount: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    prorated: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        date: z.ZodString;
        amount: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    services: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        note: z.ZodString;
        date: z.ZodString;
        amount: z.ZodString;
        lineItemId: z.ZodString;
        vendor: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        toEnrollmentId: z.ZodString;
        toGrantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>;
    editedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>;
/** Saved task-builder definitions (enrollment-scoped task schedule source of truth). */
export declare const TaskScheduleMeta: z.ZodObject<{
    version: z.ZodLiteral<1>;
    defs: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
    savedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
}, z.core.$loose>;
export declare const EnrollmentContinuity: z.ZodObject<{
    continuumId: z.ZodString;
    kind: z.ZodDefault<z.ZodLiteral<"grantCycle">>;
    previousEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    nextEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rolloverSource: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        admin: "admin";
        migration: "migration";
        backfill: "backfill";
    }>>>;
    cutoffDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TEnrollmentContinuity = z.infer<typeof EnrollmentContinuity>;
export declare const EnrollmentClientAllocation: z.ZodObject<{
    amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TEnrollmentClientAllocation = z.infer<typeof EnrollmentClientAllocation>;
export declare const EnrollmentProgramAutomation: z.ZodObject<{
    targetGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sourceEnrollmentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    createdByRule: z.ZodDefault<z.ZodBoolean>;
}, z.core.$loose>;
export type TEnrollmentProgramAutomation = z.infer<typeof EnrollmentProgramAutomation>;
export declare const EnrollmentUnenrollmentReview: z.ZodObject<{
    required: z.ZodDefault<z.ZodBoolean>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sourceEnrollmentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    flaggedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    clearedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
}, z.core.$loose>;
export type TEnrollmentUnenrollmentReview = z.infer<typeof EnrollmentUnenrollmentReview>;
/** Primary enrollment record. */
export declare const Enrollment: z.ZodObject<{
    id: z.ZodString;
    grantId: z.ZodString;
    customerId: z.ZodString;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    migratedFrom: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enrollmentId: z.ZodString;
        grantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>;
    migratedTo: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enrollmentId: z.ZodString;
        grantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>;
    continuity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        continuumId: z.ZodString;
        kind: z.ZodDefault<z.ZodLiteral<"grantCycle">>;
        previousEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        nextEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        rolloverSource: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            admin: "admin";
            migration: "migration";
            backfill: "backfill";
        }>>>;
        cutoffDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    clientAllocation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    programAutomation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        targetGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sourceEnrollmentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        createdByRule: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$loose>>>;
    unenrollmentReview: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        required: z.ZodDefault<z.ZodBoolean>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sourceEnrollmentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        flaggedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        clearedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>>>;
    active: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>>;
    deleted: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    serviceStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        paused: "paused";
        expired: "expired";
    }>>>;
    medicaid: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        status: z.ZodDefault<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>;
        closedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    actions: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    stage: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        waitlisted: "waitlisted";
        offered: "offered";
        tenant: "tenant";
        exited: "exited";
    }>>>;
    priorityScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    priorityLevel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priorityAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    priorityTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priorityTemplateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    priorityAssessmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    latestAssessments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodObject<{
        at: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        assessmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        computed: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$loose>>>>>;
    compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        caseworthyEntryComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        caseworthyExitComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        hmisEntryComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        hmisExitComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, z.core.$strip>>>;
    customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    clientName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    population: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maxAssistanceMonthsAtEnrollment: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxAssistanceCutoffDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    payments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>;
        amount: z.ZodCoercedNumber<unknown>;
        dueDate: z.ZodPreprocess<z.ZodString>;
        lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        void: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notifyCM: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                done: z.ZodDefault<z.ZodBoolean>;
                doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dueDate: z.ZodString;
            targetPaymentDate: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<{
                manual: "manual";
                calculated: "calculated";
            }>>;
            taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                completed: "completed";
                due: "due";
                effective: "effective";
            }>>;
        }, z.core.$loose>>>;
        rentCertOptOut: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, z.core.$strip>>>>;
    spends: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        paymentId: z.ZodString;
        lineItemId: z.ZodNullable<z.ZodString>;
        amount: z.ZodCoercedNumber<unknown>;
        source: z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            enrollment: "enrollment";
            org: "org";
            card: "card";
        }>>;
        orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodEnum<{
            voided: "voided";
            paid: "paid";
            unpaid: "unpaid";
        }>, z.ZodString]>>>;
        voidedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        reversed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        reversedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        reversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amountCents: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
        month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        ts: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        by: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uid: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
        byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        byName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        migratedFromSpendId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        migratedReversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItemLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paymentLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        date: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paymentSnapshot: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            amount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
            type: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                monthly: "monthly";
                deposit: "deposit";
                prorated: "prorated";
                service: "service";
                arrears: "arrears";
            }>>>>;
            lineItemId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            dueDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>>;
            dueMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>>;
            vendor: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            comment: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>>;
    taskSchedule: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodDefault<z.ZodString>;
        dueDate: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        dueMonth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        completedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        verified: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        verifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        verifiedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedToUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedToGroup: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>>>;
        assignedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        multiParentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        multiStepIndex: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        multiStepCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        multiMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            parallel: "parallel";
            sequential: "sequential";
        }>>>;
        notify: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bucket: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            other: "other";
            compliance: "compliance";
            task: "task";
            assessment: "assessment";
        }>>>;
        defId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        managed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>;
    taskStats: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        completed: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        overdue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        nextDue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    scheduleMeta: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodObject<{
        mode: z.ZodLiteral<"migrated">;
        cutover: z.ZodString;
        defaultEditMode: z.ZodOptional<z.ZodEnum<{
            keepManual: "keepManual";
            rebuildUnpaid: "rebuildUnpaid";
        }>>;
        fromEnrollmentId: z.ZodString;
        fromGrantId: z.ZodString;
        lineItemMapSnapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            toEnrollmentId: z.ZodString;
            toGrantId: z.ZodString;
            cutover: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        version: z.ZodLiteral<1>;
        rentPlans: z.ZodArray<z.ZodObject<{
            firstDue: z.ZodString;
            months: z.ZodString;
            monthly: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        utilPlans: z.ZodArray<z.ZodObject<{
            firstDue: z.ZodString;
            months: z.ZodString;
            monthly: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        deposit: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        prorated: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        services: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            note: z.ZodString;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            toEnrollmentId: z.ZodString;
            toGrantId: z.ZodString;
            cutover: z.ZodString;
        }, z.core.$strip>>>;
        editedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>>;
    taskScheduleMeta: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<1>;
        defs: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
        savedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>>>;
    generateTaskSchedule: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>;
}, z.core.$strip>;
export type TEnrollment = z.infer<typeof Enrollment>;
export type TEnrollmentEntity = TEnrollment & {
    id: string;
};
export declare const EnrollmentGetByIdQuery: z.ZodObject<{
    id: z.ZodString;
}, z.core.$loose>;
export type TEnrollmentGetByIdQuery = z.infer<typeof EnrollmentGetByIdQuery>;
export type TEnrollmentGetByIdResp = Ok<{
    enrollment: TEnrollmentEntity;
}>;
export declare const EnrollmentsListQuery: z.ZodObject<{
    active: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>>;
    customerId: z.ZodOptional<z.ZodString>;
    grantId: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    startAfter: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type TEnrollmentsListQuery = z.infer<typeof EnrollmentsListQuery>;
export type TEnrollmentsListResp = Ok<{
    items: TEnrollmentEntity[];
    next: string | null;
}>;
export declare const EnrollmentsBackfillNamesBody: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    allOrgs: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
    dryRun: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
}, z.core.$loose>;
export type TEnrollmentsBackfillNamesBody = z.infer<typeof EnrollmentsBackfillNamesBody>;
export type TEnrollmentsBackfillNamesResp = Ok<{
    scanned: number;
    updated: number;
    ids: string[];
    dryRun: boolean;
    scopedToOrg: string | null;
    resolvedGrants: number;
    resolvedCustomers: number;
}>;
export declare const EnrollmentsUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    grantId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    teamIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    startDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    endDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    migratedFrom: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enrollmentId: z.ZodString;
        grantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>>;
    migratedTo: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enrollmentId: z.ZodString;
        grantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>>;
    continuity: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        continuumId: z.ZodString;
        kind: z.ZodDefault<z.ZodLiteral<"grantCycle">>;
        previousEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        nextEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        rolloverSource: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            admin: "admin";
            migration: "migration";
            backfill: "backfill";
        }>>>;
        cutoffDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>;
    clientAllocation: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>;
    programAutomation: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        targetGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sourceEnrollmentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        createdByRule: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    unenrollmentReview: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        required: z.ZodDefault<z.ZodBoolean>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sourceEnrollmentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        flaggedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        clearedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>>>>;
    active: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>>>;
    deleted: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;
    serviceStatus: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        paused: "paused";
        expired: "expired";
    }>>>>;
    medicaid: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        status: z.ZodDefault<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>;
        closedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>;
    actions: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
    stage: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        waitlisted: "waitlisted";
        offered: "offered";
        tenant: "tenant";
        exited: "exited";
    }>>>>;
    priorityScore: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    priorityLevel: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    priorityAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>>;
    priorityTemplateId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    priorityTemplateVersion: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    priorityAssessmentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    latestAssessments: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodObject<{
        at: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        assessmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        computed: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$loose>>>>>>;
    compliance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        caseworthyEntryComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        caseworthyExitComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        hmisEntryComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        hmisExitComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, z.core.$strip>>>>;
    customerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    clientName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    grantName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    population: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>>;
    caseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    caseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    maxAssistanceMonthsAtEnrollment: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    maxAssistanceCutoffDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    payments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>;
        amount: z.ZodCoercedNumber<unknown>;
        dueDate: z.ZodPreprocess<z.ZodString>;
        lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        void: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notifyCM: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                done: z.ZodDefault<z.ZodBoolean>;
                doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dueDate: z.ZodString;
            targetPaymentDate: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<{
                manual: "manual";
                calculated: "calculated";
            }>>;
            taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                completed: "completed";
                due: "due";
                effective: "effective";
            }>>;
        }, z.core.$loose>>>;
        rentCertOptOut: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, z.core.$strip>>>>>;
    spends: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        paymentId: z.ZodString;
        lineItemId: z.ZodNullable<z.ZodString>;
        amount: z.ZodCoercedNumber<unknown>;
        source: z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            enrollment: "enrollment";
            org: "org";
            card: "card";
        }>>;
        orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodEnum<{
            voided: "voided";
            paid: "paid";
            unpaid: "unpaid";
        }>, z.ZodString]>>>;
        voidedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        reversed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        reversedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        reversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amountCents: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
        month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        ts: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        by: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uid: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
        byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        byName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        migratedFromSpendId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        migratedReversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItemLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paymentLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        date: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paymentSnapshot: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            amount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
            type: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                monthly: "monthly";
                deposit: "deposit";
                prorated: "prorated";
                service: "service";
                arrears: "arrears";
            }>>>>;
            lineItemId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            dueDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>>;
            dueMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>>;
            vendor: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            comment: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>>>;
    taskSchedule: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodDefault<z.ZodString>;
        dueDate: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        dueMonth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        completedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        verified: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        verifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        verifiedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedToUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedToGroup: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>>>;
        assignedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        multiParentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        multiStepIndex: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        multiStepCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        multiMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            parallel: "parallel";
            sequential: "sequential";
        }>>>;
        notify: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bucket: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            other: "other";
            compliance: "compliance";
            task: "task";
            assessment: "assessment";
        }>>>;
        defId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        managed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>>;
    taskStats: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        completed: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        overdue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        nextDue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>>;
    scheduleMeta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodObject<{
        mode: z.ZodLiteral<"migrated">;
        cutover: z.ZodString;
        defaultEditMode: z.ZodOptional<z.ZodEnum<{
            keepManual: "keepManual";
            rebuildUnpaid: "rebuildUnpaid";
        }>>;
        fromEnrollmentId: z.ZodString;
        fromGrantId: z.ZodString;
        lineItemMapSnapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            toEnrollmentId: z.ZodString;
            toGrantId: z.ZodString;
            cutover: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        version: z.ZodLiteral<1>;
        rentPlans: z.ZodArray<z.ZodObject<{
            firstDue: z.ZodString;
            months: z.ZodString;
            monthly: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        utilPlans: z.ZodArray<z.ZodObject<{
            firstDue: z.ZodString;
            months: z.ZodString;
            monthly: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        deposit: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        prorated: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        services: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            note: z.ZodString;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            toEnrollmentId: z.ZodString;
            toGrantId: z.ZodString;
            cutover: z.ZodString;
        }, z.core.$strip>>>;
        editedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>>>;
    taskScheduleMeta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<1>;
        defs: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
        savedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>>>>;
    generateTaskSchedule: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
}, z.core.$strip>, z.ZodArray<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    grantId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    teamIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    startDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    endDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    migratedFrom: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enrollmentId: z.ZodString;
        grantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>>;
    migratedTo: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        enrollmentId: z.ZodString;
        grantId: z.ZodString;
        cutover: z.ZodString;
    }, z.core.$strip>>>>;
    continuity: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        continuumId: z.ZodString;
        kind: z.ZodDefault<z.ZodLiteral<"grantCycle">>;
        previousEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        nextEnrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        rolloverSource: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            admin: "admin";
            migration: "migration";
            backfill: "backfill";
        }>>>;
        cutoffDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>;
    clientAllocation: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>;
    programAutomation: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        targetGrantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sourceEnrollmentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        createdByRule: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$loose>>>>;
    unenrollmentReview: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        required: z.ZodDefault<z.ZodBoolean>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sourceEnrollmentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        flaggedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        clearedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>>>>;
    active: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>>>;
    deleted: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;
    serviceStatus: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        active: "active";
        paused: "paused";
        expired: "expired";
    }>>>>;
    medicaid: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        status: z.ZodDefault<z.ZodEnum<{
            active: "active";
            closed: "closed";
        }>>;
        closedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>;
    actions: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
    stage: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        waitlisted: "waitlisted";
        offered: "offered";
        tenant: "tenant";
        exited: "exited";
    }>>>>;
    priorityScore: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    priorityLevel: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    priorityAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>>;
    priorityTemplateId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    priorityTemplateVersion: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    priorityAssessmentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    latestAssessments: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodObject<{
        at: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        assessmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        computed: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$loose>>>>>>;
    compliance: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        caseworthyEntryComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        caseworthyExitComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        hmisEntryComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        hmisExitComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, z.core.$strip>>>>;
    customerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    clientName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    grantName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    population: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        Youth: "Youth";
        Individual: "Individual";
        Family: "Family";
    }>>>>;
    caseManagerId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    caseManagerName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    maxAssistanceMonthsAtEnrollment: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    maxAssistanceCutoffDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    payments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            monthly: "monthly";
            deposit: "deposit";
            prorated: "prorated";
            service: "service";
            arrears: "arrears";
        }>;
        amount: z.ZodCoercedNumber<unknown>;
        dueDate: z.ZodPreprocess<z.ZodString>;
        lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        paidAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paidFromGrant: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        void: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notifyCM: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        compliance: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            hmisComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            caseworthyComplete: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                done: z.ZodDefault<z.ZodBoolean>;
                doneAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                doneBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        rentCert: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dueDate: z.ZodString;
            targetPaymentDate: z.ZodString;
            source: z.ZodDefault<z.ZodEnum<{
                manual: "manual";
                calculated: "calculated";
            }>>;
            taskIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                completed: "completed";
                due: "due";
                effective: "effective";
            }>>;
        }, z.core.$loose>>>;
        rentCertOptOut: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    }, z.core.$strip>>>>>;
    spends: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        paymentId: z.ZodString;
        lineItemId: z.ZodNullable<z.ZodString>;
        amount: z.ZodCoercedNumber<unknown>;
        source: z.ZodOptional<z.ZodEnum<{
            manual: "manual";
            enrollment: "enrollment";
            org: "org";
            card: "card";
        }>>;
        orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paid: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodEnum<{
            voided: "voided";
            paid: "paid";
            unpaid: "unpaid";
        }>, z.ZodString]>>>;
        voidedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        reversed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        reversedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        reversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amountCents: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
        month: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        ts: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>;
        by: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            uid: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            email: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
        byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        byName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        migratedFromSpendId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        migratedReversalOf: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customerNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantNameAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineItemLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        paymentLabelAtSpend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        dueDate: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        date: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        paymentSnapshot: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            amount: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
            type: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                monthly: "monthly";
                deposit: "deposit";
                prorated: "prorated";
                service: "service";
                arrears: "arrears";
            }>>>>;
            lineItemId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            dueDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>>;
            dueMonth: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>>;
            vendor: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            comment: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>>>;
    taskSchedule: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodDefault<z.ZodString>;
        dueDate: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        dueMonth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        completedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        verified: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        verifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        verifiedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reopenReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedToUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedToGroup: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>>>;
        assignedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        multiParentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        multiStepIndex: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        multiStepCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        multiMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            parallel: "parallel";
            sequential: "sequential";
        }>>>;
        notify: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bucket: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            other: "other";
            compliance: "compliance";
            task: "task";
            assessment: "assessment";
        }>>>;
        defId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        managed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        createdAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updatedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>>>;
    taskStats: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        total: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        completed: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        overdue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        nextDue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>>;
    scheduleMeta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodObject<{
        mode: z.ZodLiteral<"migrated">;
        cutover: z.ZodString;
        defaultEditMode: z.ZodOptional<z.ZodEnum<{
            keepManual: "keepManual";
            rebuildUnpaid: "rebuildUnpaid";
        }>>;
        fromEnrollmentId: z.ZodString;
        fromGrantId: z.ZodString;
        lineItemMapSnapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            toEnrollmentId: z.ZodString;
            toGrantId: z.ZodString;
            cutover: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        version: z.ZodLiteral<1>;
        rentPlans: z.ZodArray<z.ZodObject<{
            firstDue: z.ZodString;
            months: z.ZodString;
            monthly: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        utilPlans: z.ZodArray<z.ZodObject<{
            firstDue: z.ZodString;
            months: z.ZodString;
            monthly: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        deposit: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        prorated: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        services: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            note: z.ZodString;
            date: z.ZodString;
            amount: z.ZodString;
            lineItemId: z.ZodString;
            vendor: z.ZodOptional<z.ZodString>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        migratedOut: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            toEnrollmentId: z.ZodString;
            toGrantId: z.ZodString;
            cutover: z.ZodString;
        }, z.core.$strip>>>;
        editedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>>>>;
    taskScheduleMeta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<1>;
        defs: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
        savedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>>>>;
    generateTaskSchedule: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
}, z.core.$strip>>]>;
export type TEnrollmentsUpsertBody = z.infer<typeof EnrollmentsUpsertBody>;
export type TEnrollmentsUpsertResp = Ok<{
    ids: string[];
}>;
export declare const EnrollmentsPatchRow: z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type TEnrollmentsPatchRow = z.infer<typeof EnrollmentsPatchRow>;
export declare const EnrollmentsPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>>]>;
export type TEnrollmentsPatchBody = z.infer<typeof EnrollmentsPatchBody>;
export type TEnrollmentsPatchResp = Ok<{
    ids: string[];
}>;
export declare const EnrollmentsDeleteBody: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
    voidPaid: z.ZodOptional<z.ZodBoolean>;
    hard: z.ZodOptional<z.ZodBoolean>;
    unlinkSpends: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>]>;
export declare const EnrollmentsAdminDeleteBody: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
    voidPaid: z.ZodOptional<z.ZodBoolean>;
    mode: z.ZodOptional<z.ZodEnum<{
        hard: "hard";
        safe: "safe";
    }>>;
    purgeSpends: z.ZodOptional<z.ZodBoolean>;
    purgeSubcollections: z.ZodOptional<z.ZodBoolean>;
    unlinkSpends: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>]>;
export declare const EnrollmentsDeleteResultItem: z.ZodObject<{
    id: z.ZodString;
    ok: z.ZodOptional<z.ZodLiteral<true>>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const EnrollmentsDeleteCoreOutput: z.ZodObject<{
    ok: z.ZodBoolean;
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ok: z.ZodOptional<z.ZodLiteral<true>>;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const EnrollmentsDeleteResp: z.ZodObject<{
    ok: z.ZodBoolean;
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ok: z.ZodOptional<z.ZodLiteral<true>>;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    deleted: z.ZodLiteral<true>;
}, z.core.$strip>;
export declare const EnrollmentsAdminDeleteResp: z.ZodObject<{
    ok: z.ZodBoolean;
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ok: z.ZodOptional<z.ZodLiteral<true>>;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    deleted: z.ZodLiteral<true>;
    mode: z.ZodEnum<{
        hard: "hard";
        safe: "safe";
    }>;
    purged: z.ZodOptional<z.ZodObject<{
        spends: z.ZodNumber;
        enrollments: z.ZodNumber;
    }, z.core.$strip>>;
    purgeErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type TEnrollmentsAdminDeleteBody = z.infer<typeof EnrollmentsAdminDeleteBody>;
export type TEnrollmentsAdminDeleteResp = z.infer<typeof EnrollmentsAdminDeleteResp>;
export type TEnrollmentsDeleteBody = z.infer<typeof EnrollmentsDeleteBody>;
export type TEnrollmentsDeleteResp = z.infer<typeof EnrollmentsDeleteResp>;
export type TEnrollmentsDeleteResultItem = z.infer<typeof EnrollmentsDeleteResultItem>;
export declare const EnrollmentsEnrollCustomerBody: z.ZodPreprocess<z.ZodObject<{
    grantId: z.ZodPreprocess<z.ZodString>;
    customerId: z.ZodPreprocess<z.ZodString>;
    extra: z.ZodDefault<z.ZodPreprocess<z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>>>;
}, z.core.$loose>>;
export type TEnrollmentsEnrollCustomerBody = z.infer<typeof EnrollmentsEnrollCustomerBody>;
export type TEnrollmentsEnrollCustomerResp = Ok<{
    id: string;
}>;
export declare const EnrollmentsBulkEnrollBody: z.ZodPreprocess<z.ZodObject<{
    grantId: z.ZodPreprocess<z.ZodString>;
    customerIds: z.ZodPreprocess<z.ZodArray<z.ZodPreprocess<z.ZodString>>>;
    skipIfExists: z.ZodDefault<z.ZodPreprocess<z.ZodBoolean>>;
    existsMode: z.ZodDefault<z.ZodEnum<{
        activeOnly: "activeOnly";
        nonDeleted: "nonDeleted";
    }>>;
    extra: z.ZodDefault<z.ZodPreprocess<z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>>>;
    perCustomerExtra: z.ZodPreprocess<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodPreprocess<z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>>>>>;
}, z.core.$loose>>;
export type TEnrollmentsBulkEnrollBody = z.infer<typeof EnrollmentsBulkEnrollBody>;
export type TEnrollmentsBulkEnrollResultItem = {
    customerId: string;
    enrollmentId: string;
    existed?: true;
} | {
    customerId: string;
    error: string;
};
export type TEnrollmentsBulkEnrollResp = Ok<{
    results: TEnrollmentsBulkEnrollResultItem[];
}>;
export declare const EnrollmentsCheckOverlapsQuery: z.ZodObject<{
    customerId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
    grantIds: z.ZodOptional<z.ZodPreprocess<z.ZodArray<z.ZodString>>>;
    window: z.ZodOptional<z.ZodObject<{
        start: z.ZodOptional<z.ZodString>;
        end: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    activeOnly: z.ZodOptional<z.ZodBoolean>;
}, z.core.$loose>;
export type TEnrollmentsCheckOverlapsQuery = z.infer<typeof EnrollmentsCheckOverlapsQuery>;
type EnrollmentOverlapSide = {
    id: string;
    grantId: string;
    startDate?: string | null;
    endDate?: string | null;
    [k: string]: unknown;
};
type EnrollmentOverlap = {
    a: EnrollmentOverlapSide;
    b: EnrollmentOverlapSide;
    [k: string]: unknown;
};
export type TEnrollmentsCheckOverlapsResp = Ok<{
    overlaps: EnrollmentOverlap[];
    count: number;
}>;
export declare const EnrollmentsCheckDualQuery: z.ZodObject<{
    enrollments: z.ZodArray<z.ZodObject<{
        customerId: z.ZodOptional<z.ZodString>;
        clientId: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export type TEnrollmentsCheckDualQuery = z.infer<typeof EnrollmentsCheckDualQuery>;
export type TEnrollmentsCheckDualResp = Ok<{
    conflicts: Array<{
        customerId: string;
        count: number;
        activeEnrollments: Array<Record<string, unknown>>;
    }>;
}>;
export declare const EnrollmentsMigrateBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    toGrantId: z.ZodString;
    cutoverDate: z.ZodString;
    lineItemMap: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    closeSource: z.ZodOptional<z.ZodBoolean>;
    moveSpends: z.ZodOptional<z.ZodBoolean>;
    moveTasks: z.ZodOptional<z.ZodBoolean>;
    preserveTaskIds: z.ZodOptional<z.ZodBoolean>;
    movePaidPayments: z.ZodOptional<z.ZodBoolean>;
    rebuildScheduleMeta: z.ZodOptional<z.ZodBoolean>;
    closeSourceTaskMode: z.ZodOptional<z.ZodEnum<{
        complete: "complete";
        delete: "delete";
    }>>;
    closeSourcePaymentMode: z.ZodOptional<z.ZodEnum<{
        spendUnpaid: "spendUnpaid";
        deleteUnpaid: "deleteUnpaid";
        keep: "keep";
    }>>;
}, z.core.$loose>;
export type TEnrollmentsMigrateBody = z.infer<typeof EnrollmentsMigrateBody>;
export type TEnrollmentsMigrateResp = Ok<{
    migrationId: string;
    fromId: string;
    toId: string;
    fromGrantId: string;
    toGrantId: string;
}>;
export declare const EnrollmentsContinuumSummaryQuery: z.ZodObject<{
    enrollmentId: z.ZodString;
}, z.core.$loose>;
export type TEnrollmentsContinuumSummaryQuery = z.infer<typeof EnrollmentsContinuumSummaryQuery>;
export type TEnrollmentsContinuumSummaryResp = Ok<{
    continuumId: string;
    currentEnrollmentId: string | null;
    assistanceMonthsReceived: number;
    assistanceMonthKeys: string[];
    allocation: {
        editable: number;
        calculated: number;
        effective: number;
    };
    enrollments: Array<{
        id: string;
        grantId: string;
        grantName: string | null;
        startDate: string | null;
        endDate: string | null;
        editableAllocation: number | null;
        calculatedAllocation: number;
        effectiveAllocation: number;
    }>;
    rentCertEvents: Array<{
        targetDate: string;
        dueDate: string;
        enrollmentId: string;
        paymentId: string;
        source: "calculated" | "manual";
        status: "due" | "completed" | "effective";
    }>;
    /** Last scheduled assistance (rent) payment date across the continuum, or null. */
    lastAssistanceDate: string | null;
}>;
export declare const EnrollmentsAllocationSetBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    amount: z.ZodNullable<z.ZodNumber>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TEnrollmentsAllocationSetBody = z.infer<typeof EnrollmentsAllocationSetBody>;
export type TEnrollmentsAllocationSetResp = Ok<{
    enrollmentId: string;
}>;
export declare const EnrollmentsCycleRolloverPreviewBody: z.ZodObject<{
    grantId: z.ZodString;
    cutoverDate: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type TEnrollmentsCycleRolloverPreviewBody = z.infer<typeof EnrollmentsCycleRolloverPreviewBody>;
export declare const EnrollmentCycleRolloverPreviewItem: z.ZodObject<{
    enrollmentId: z.ZodString;
    customerId: z.ZodString;
    customerName: z.ZodNullable<z.ZodString>;
    eligible: z.ZodBoolean;
    blockers: z.ZodArray<z.ZodString>;
    warnings: z.ZodArray<z.ZodString>;
    futureUnpaidPayments: z.ZodNumber;
    futureOpenReminders: z.ZodNumber;
    calculatedAllocation: z.ZodNumber;
}, z.core.$strip>;
export type TEnrollmentCycleRolloverPreviewItem = z.infer<typeof EnrollmentCycleRolloverPreviewItem>;
export type TEnrollmentsCycleRolloverPreviewResp = Ok<{
    fromGrantId: string;
    toGrantId: string;
    cutoverDate: string;
    sourceCloseDate: string;
    blockers: string[];
    warnings: string[];
    items: TEnrollmentCycleRolloverPreviewItem[];
}>;
export declare const EnrollmentsCycleRolloverRunBody: z.ZodObject<{
    grantId: z.ZodString;
    cutoverDate: z.ZodOptional<z.ZodString>;
    enrollmentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    confirm: z.ZodLiteral<"ROLLOVER">;
}, z.core.$loose>;
export type TEnrollmentsCycleRolloverRunBody = z.infer<typeof EnrollmentsCycleRolloverRunBody>;
export type TEnrollmentsCycleRolloverRunResp = Ok<{
    fromGrantId: string;
    toGrantId: string;
    cutoverDate: string;
    results: Array<{
        enrollmentId: string;
        ok: boolean;
        destinationEnrollmentId?: string;
        skipped?: string;
        error?: string;
    }>;
}>;
export declare const EnrollmentsLinkedProgramsReconcileBody: z.ZodObject<{
    grantIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
}, z.core.$loose>;
export type TEnrollmentsLinkedProgramsReconcileBody = z.infer<typeof EnrollmentsLinkedProgramsReconcileBody>;
export type TEnrollmentsLinkedProgramsReconcileResp = Ok<{
    dryRun: boolean;
    sourceEnrollments: number;
    missingTargets: number;
    duplicateTargets: number;
    reconciled: number;
    issues: Array<{
        customerId: string;
        targetGrantId: string;
        issue: string;
    }>;
}>;
export declare const EnrollmentsUndoMigrationBody: z.ZodObject<{
    migrationId: z.ZodString;
}, z.core.$loose>;
export type TEnrollmentsUndoMigrationBody = z.infer<typeof EnrollmentsUndoMigrationBody>;
export type TEnrollmentsUndoMigrationResp = Ok<{
    alreadyUndone: boolean;
    migrationId: string;
    fromEnrollmentId: string;
    toEnrollmentId: string | null;
    fromGrantId: string;
    toGrantId: string | null;
}>;
export declare const EnrollmentsAdminReverseLedgerEntryBody: z.ZodObject<{
    ledgerId: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<{
        budget: "budget";
        both: "both";
        ledger: "ledger";
    }>>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type TEnrollmentsAdminReverseLedgerEntryBody = z.infer<typeof EnrollmentsAdminReverseLedgerEntryBody>;
export type TEnrollmentsAdminReverseLedgerEntryResp = Ok<{
    mode: "ledger" | "budget" | "both";
}>;
export {};
