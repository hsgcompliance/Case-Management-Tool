import { z } from "./core.js";
import type { Ok } from "./http.js";
export declare const InboxSourceEnum: z.ZodEnum<{
    other: "other";
    task: "task";
    payment: "payment";
    paymentCompliance: "paymentCompliance";
    userVerification: "userVerification";
    adminEnrollment: "adminEnrollment";
    jotform: "jotform";
    formsIntake: "formsIntake";
    otherTask: "otherTask";
}>;
export type InboxSource = z.infer<typeof InboxSourceEnum>;
export declare const InboxStatusEnum: z.ZodEnum<{
    open: "open";
    done: "done";
}>;
export type InboxStatus = z.infer<typeof InboxStatusEnum>;
export declare const InboxAssignedGroupEnum: z.ZodEnum<{
    admin: "admin";
    casemanager: "casemanager";
    compliance: "compliance";
}>;
export type InboxAssignedGroup = z.infer<typeof InboxAssignedGroupEnum>;
/** Semantic purpose of a userTasks row; `source` still identifies its producer. */
export declare const InboxWorkItemKindEnum: z.ZodEnum<{
    intake: "intake";
    compliance: "compliance";
    task: "task";
    assessment: "assessment";
    payment: "payment";
    referral: "referral";
    workflow: "workflow";
}>;
export type InboxWorkItemKind = z.infer<typeof InboxWorkItemKindEnum>;
export declare const InboxWorkflowRefSchema: z.ZodObject<{
    type: z.ZodEnum<{
        intake: "intake";
        referral: "referral";
        form: "form";
    }>;
    instanceId: z.ZodString;
    stage: z.ZodString;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type TInboxWorkflowRef = z.infer<typeof InboxWorkflowRefSchema>;
export declare const InboxDigestTypeSchema: z.ZodEnum<{
    budget: "budget";
    rentalAssistance: "rentalAssistance";
    enrollments: "enrollments";
    caseload: "caseload";
    grantPrograms: "grantPrograms";
    caseManagers: "caseManagers";
}>;
export type TInboxDigestType = z.infer<typeof InboxDigestTypeSchema>;
export declare const InboxDigestSubRecordSchema: z.ZodObject<{
    uid: z.ZodString;
    email: z.ZodEmail;
    displayName: z.ZodOptional<z.ZodString>;
    roles: z.ZodArray<z.ZodString>;
    topRole: z.ZodString;
    subs: z.ZodRecord<z.ZodEnum<{
        budget: "budget";
        rentalAssistance: "rentalAssistance";
        enrollments: "enrollments";
        caseload: "caseload";
        grantPrograms: "grantPrograms";
        caseManagers: "caseManagers";
    }> & z.core.$partial, z.ZodBoolean>;
    effective: z.ZodRecord<z.ZodEnum<{
        budget: "budget";
        rentalAssistance: "rentalAssistance";
        enrollments: "enrollments";
        caseload: "caseload";
        grantPrograms: "grantPrograms";
        caseManagers: "caseManagers";
    }>, z.ZodBoolean>;
    grantProgramIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type TInboxDigestSubRecord = z.infer<typeof InboxDigestSubRecordSchema>;
export declare const InboxItemSchema: z.ZodObject<{
    utid: z.ZodString;
    source: z.ZodEnum<{
        other: "other";
        task: "task";
        payment: "payment";
        paymentCompliance: "paymentCompliance";
        userVerification: "userVerification";
        adminEnrollment: "adminEnrollment";
        jotform: "jotform";
        formsIntake: "formsIntake";
        otherTask: "otherTask";
    }>;
    status: z.ZodEnum<{
        open: "open";
        done: "done";
    }>;
    enrollmentId: z.ZodNullable<z.ZodString>;
    clientId: z.ZodNullable<z.ZodString>;
    grantId: z.ZodNullable<z.ZodString>;
    sourcePath: z.ZodString;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueMonth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAtISO: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedAtISO: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    assignedToUid: z.ZodNullable<z.ZodString>;
    assignedToGroup: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        admin: "admin";
        casemanager: "casemanager";
        compliance: "compliance";
    }>>>;
    cmUid: z.ZodNullable<z.ZodString>;
    secondaryCmUid: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    notify: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    workItemKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        intake: "intake";
        compliance: "compliance";
        task: "task";
        assessment: "assessment";
        payment: "payment";
        referral: "referral";
        workflow: "workflow";
    }>>>;
    workflowRef: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        type: z.ZodEnum<{
            intake: "intake";
            referral: "referral";
            form: "form";
        }>;
        instanceId: z.ZodString;
        stage: z.ZodString;
        customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        formId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    title: z.ZodDefault<z.ZodString>;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    labels: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    actionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    actionLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completedAtISO: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type TInboxItem = z.infer<typeof InboxItemSchema>;
/** Back-compat alias (functions currently imports InboxItem). */
export type InboxItem = TInboxItem;
export declare const InboxItemEntitySchema: z.ZodObject<{
    utid: z.ZodString;
    source: z.ZodEnum<{
        other: "other";
        task: "task";
        payment: "payment";
        paymentCompliance: "paymentCompliance";
        userVerification: "userVerification";
        adminEnrollment: "adminEnrollment";
        jotform: "jotform";
        formsIntake: "formsIntake";
        otherTask: "otherTask";
    }>;
    status: z.ZodEnum<{
        open: "open";
        done: "done";
    }>;
    enrollmentId: z.ZodNullable<z.ZodString>;
    clientId: z.ZodNullable<z.ZodString>;
    grantId: z.ZodNullable<z.ZodString>;
    sourcePath: z.ZodString;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueMonth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAtISO: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedAtISO: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    assignedToUid: z.ZodNullable<z.ZodString>;
    assignedToGroup: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        admin: "admin";
        casemanager: "casemanager";
        compliance: "compliance";
    }>>>;
    cmUid: z.ZodNullable<z.ZodString>;
    secondaryCmUid: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    notify: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    workItemKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        intake: "intake";
        compliance: "compliance";
        task: "task";
        assessment: "assessment";
        payment: "payment";
        referral: "referral";
        workflow: "workflow";
    }>>>;
    workflowRef: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        type: z.ZodEnum<{
            intake: "intake";
            referral: "referral";
            form: "form";
        }>;
        instanceId: z.ZodString;
        stage: z.ZodString;
        customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        formId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    title: z.ZodDefault<z.ZodString>;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    labels: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    actionUrl: z.ZodOptional<z.ZodNullable<z.ZodURL>>;
    actionLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completedAtISO: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    id: z.ZodString;
}, z.core.$loose>;
export type TInboxItemEntity = z.infer<typeof InboxItemEntitySchema>;
export declare const InboxListMyQuerySchema: z.ZodObject<{
    month: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    includeOverdue: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>>>;
    includeGroup: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>>>;
}, z.core.$strip>;
export type TInboxListMyQuery = z.infer<typeof InboxListMyQuerySchema>;
export type TInboxListMyResp = Ok<{
    items: TInboxItemEntity[];
}>;
export declare const InboxTasksDueListQuerySchema: z.ZodObject<{
    month: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type TInboxTasksDueListQuery = z.infer<typeof InboxTasksDueListQuerySchema>;
export type TInboxTasksDueListResp = Ok<{
    items: TInboxItemEntity[];
    month: string;
}>;
export declare const InboxWorkloadListQuerySchema: z.ZodObject<{
    month: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    assigneeUid: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    includeUnassigned: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>>>;
    limit: z.ZodOptional<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export type TInboxWorkloadListQuery = z.infer<typeof InboxWorkloadListQuerySchema>;
export type TInboxWorkloadListResp = Ok<{
    items: TInboxItemEntity[];
}>;
export declare const InboxSendInviteBodySchema: z.ZodObject<{
    to: z.ZodEmail;
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    resetLink: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodURL, z.ZodLiteral<"#">]>>>;
    subject: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TInboxSendInviteBody = z.infer<typeof InboxSendInviteBodySchema>;
export declare const InboxSendMonthlySummaryBodySchema: z.ZodObject<{
    to: z.ZodEmail;
    clientId: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    tasksDue: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
        type: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        completed: z.ZodOptional<z.ZodBoolean>;
        completedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
    monthsRemaining: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    dashboardLink: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodURL, z.ZodLiteral<"#">]>>>;
    subject: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TInboxSendMonthlySummaryBody = z.infer<typeof InboxSendMonthlySummaryBodySchema>;
export declare const InboxSendDigestNowBodySchema: z.ZodObject<{
    digestType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        budget: "budget";
        rentalAssistance: "rentalAssistance";
        enrollments: "enrollments";
        caseload: "caseload";
        grantPrograms: "grantPrograms";
        caseManagers: "caseManagers";
    }>>>;
    months: z.ZodArray<z.ZodString>;
    cmUid: z.ZodOptional<z.ZodString>;
    combine: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    subject: z.ZodOptional<z.ZodString>;
    subjectTemplate: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TInboxSendDigestNowBody = z.infer<typeof InboxSendDigestNowBodySchema>;
export declare const InboxScheduleDigestBodySchema: z.ZodObject<{
    digestType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        budget: "budget";
        rentalAssistance: "rentalAssistance";
        enrollments: "enrollments";
        caseload: "caseload";
        grantPrograms: "grantPrograms";
        caseManagers: "caseManagers";
    }>>>;
    months: z.ZodArray<z.ZodString>;
    cmUid: z.ZodString;
    combine: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    subject: z.ZodOptional<z.ZodString>;
    subjectTemplate: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    sendAt: z.ZodString;
}, z.core.$strip>;
export type TInboxScheduleDigestBody = z.infer<typeof InboxScheduleDigestBodySchema>;
export declare const InboxDigestPreviewQuerySchema: z.ZodObject<{
    month: z.ZodOptional<z.ZodString>;
    cmUid: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TInboxDigestPreviewQuery = z.infer<typeof InboxDigestPreviewQuerySchema>;
export declare const InboxMetricsScopeSchema: z.ZodObject<{
    assignedCount: z.ZodNumber;
    openCount: z.ZodNumber;
    completedCount: z.ZodNumber;
    completionPct: z.ZodNumber;
    overdueCount: z.ZodNumber;
    sharedCount: z.ZodNumber;
    assignedToMeCount: z.ZodNumber;
}, z.core.$strip>;
export type TInboxMetricsScope = z.infer<typeof InboxMetricsScopeSchema>;
export declare const InboxMetricsMyQuerySchema: z.ZodObject<{
    month: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type TInboxMetricsMyQuery = z.infer<typeof InboxMetricsMyQuerySchema>;
export type TInboxMetricsMyResp = Ok<{
    month: string;
    direct: TInboxMetricsScope;
    group: TInboxMetricsScope;
    total: TInboxMetricsScope;
}>;
export type TInboxEmailResp = Ok<{
    id: string | null;
}>;
export type TInboxSendDigestNowResult = {
    uid: string;
    email: string;
    month: string;
    ok: boolean;
    skipped?: boolean;
    error?: string;
};
export type TInboxSendDigestNowResp = Ok<{
    sent: number;
    skipped: number;
    failed: number;
    results: TInboxSendDigestNowResult[];
}>;
export type TInboxScheduleDigestResp = Ok<{
    id: string;
    sendAt: string;
}>;
export type TInboxDigestPreviewResp = Ok<{
    items: TInboxItemEntity[];
}>;
export type TInboxDigestSubsGetResp = Ok<{
    records: TInboxDigestSubRecord[];
}>;
export type TInboxDigestSubUpdateReq = {
    uid: string;
    digestType: TInboxDigestType;
    subscribed: boolean;
    grantId?: string;
};
export type TInboxDigestSubUpdateResp = Ok<{
    uid: string;
    digestType: TInboxDigestType;
    subscribed: boolean;
    grantId?: string;
}>;
export type TInboxDigestHtmlPreviewReq = {
    digestType?: TInboxDigestType;
    month?: string;
    forUid?: string;
};
export type TInboxDigestHtmlPreviewResp = Ok<{
    html: string;
    subject: string;
    digestType: TInboxDigestType;
    month: string;
}>;
