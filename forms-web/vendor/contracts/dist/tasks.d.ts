import { z } from "./core.js";
/** Which desk owns the task right now. */
export declare const AssignedGroup: z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>;
/**
 * A single reminder/note item.
 *
 * @deprecated Lifecycle fields (`completed`, `completedAt`, `status`, verification, reopen
 * metadata) are kept for old records and screens. New product behavior should treat these as
 * lightweight reminders/notes for customer pages and digest emails, not completion workflow.
 */
export declare const TaskScheduleItem: z.ZodObject<{
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
}, z.core.$loose>;
/** Aggregate stats for quick list UI. */
export declare const TaskStats: z.ZodObject<{
    total: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    completed: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    overdue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    nextDue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type TTaskScheduleItem = z.infer<typeof TaskScheduleItem>;
export type TTaskStats = z.infer<typeof TaskStats>;
export type TAssignedGroup = z.infer<typeof AssignedGroup>;
/** @deprecated Task completion lifecycle is deprecated; keep for back-compat only. */
export declare const TasksBulkStatusBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    changes: z.ZodArray<z.ZodObject<{
        taskId: z.ZodString;
        action: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            complete: "complete";
            reopen: "reopen";
            verify: "verify";
        }>>>;
        reason: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TTasksBulkStatusBody = z.infer<typeof TasksBulkStatusBody>;
export declare const TasksAssignBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    taskId: z.ZodString;
    assign: z.ZodObject<{
        group: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>>>>;
        uid: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TTasksAssignBody = z.infer<typeof TasksAssignBody>;
/** @deprecated Task completion lifecycle is deprecated; keep for back-compat only. */
export declare const TasksUpdateStatusBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    taskId: z.ZodString;
    action: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        complete: "complete";
        reopen: "reopen";
        verify: "verify";
    }>>>;
    reason: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TTasksUpdateStatusBody = z.infer<typeof TasksUpdateStatusBody>;
export declare const TasksRescheduleBody: z.ZodUnion<readonly [z.ZodObject<{
    enrollmentId: z.ZodString;
    taskId: z.ZodString;
    newDueDate: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    enrollmentId: z.ZodString;
    taskIds: z.ZodArray<z.ZodString>;
    shiftDays: z.ZodNumber;
}, z.core.$strip>]>;
export type TTasksRescheduleBody = z.infer<typeof TasksRescheduleBody>;
export declare const TasksUpsertManualBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    task: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        title: z.ZodDefault<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        bucket: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            other: "other";
            compliance: "compliance";
            task: "task";
            assessment: "assessment";
        }>>>;
        notify: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TTasksUpsertManualBody = z.infer<typeof TasksUpsertManualBody>;
export declare const TasksListQuery: z.ZodObject<{
    enrollmentId: z.ZodOptional<z.ZodString>;
    enrollmentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    dueMonth: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        verified: "verified";
        open: "open";
        done: "done";
    }>>;
    bucket: z.ZodOptional<z.ZodEnum<{
        other: "other";
        compliance: "compliance";
        task: "task";
        assessment: "assessment";
    }>>;
    assigneeUid: z.ZodOptional<z.ZodString>;
    assigneeGroup: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>>;
    notify: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type TTasksListQuery = z.infer<typeof TasksListQuery>;
export declare const TasksListItem: z.ZodObject<{
    id: z.ZodString;
    taskId: z.ZodString;
    enrollmentId: z.ZodString;
    customerId: z.ZodNullable<z.ZodString>;
    grantId: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    note: z.ZodString;
    bucket: z.ZodNullable<z.ZodEnum<{
        other: "other";
        compliance: "compliance";
        task: "task";
        assessment: "assessment";
    }>>;
    defId: z.ZodNullable<z.ZodString>;
    managed: z.ZodBoolean;
    multiParentId: z.ZodNullable<z.ZodString>;
    multiStepIndex: z.ZodNullable<z.ZodNumber>;
    multiStepCount: z.ZodNullable<z.ZodNumber>;
    multiMode: z.ZodNullable<z.ZodEnum<{
        parallel: "parallel";
        sequential: "sequential";
    }>>;
    dueDate: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    dueMonth: z.ZodNullable<z.ZodString>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        verified: "verified";
        open: "open";
        done: "done";
    }>>>;
    notify: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    assignedToUid: z.ZodNullable<z.ZodString>;
    assignedToGroup: z.ZodNullable<z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>>;
    assignedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type TTasksListItem = z.infer<typeof TasksListItem>;
export declare const TasksAdminRegenerateForGrantBody: z.ZodObject<{
    grantId: z.ZodString;
    activeOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    keepManual: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        replaceManaged: "replaceManaged";
        mergeManaged: "mergeManaged";
    }>>>;
    preserveCompletedManaged: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    pinCompletedManaged: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type TTasksAdminRegenerateForGrantBody = z.infer<typeof TasksAdminRegenerateForGrantBody>;
export declare const TasksAdminRegenerateForGrantResultItem: z.ZodObject<{
    enrollmentId: z.ZodString;
    ok: z.ZodBoolean;
    total: z.ZodOptional<z.ZodNumber>;
    closed: z.ZodOptional<z.ZodBoolean>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type TTasksAdminRegenerateForGrantResultItem = z.infer<typeof TasksAdminRegenerateForGrantResultItem>;
export declare const TasksOtherCreateBody: z.ZodObject<{
    title: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    dueMonth: z.ZodOptional<z.ZodString>;
    notify: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    assign: z.ZodOptional<z.ZodObject<{
        group: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>>>;
        uids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TTasksOtherCreateBody = z.infer<typeof TasksOtherCreateBody>;
export declare const TasksOtherUpdateBody: z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">, z.ZodNull]>>;
        notify: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TTasksOtherUpdateBody = z.infer<typeof TasksOtherUpdateBody>;
export declare const TasksOtherAssignBody: z.ZodObject<{
    id: z.ZodString;
    assign: z.ZodObject<{
        group: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodLiteral<"admin">, z.ZodLiteral<"casemanager">, z.ZodLiteral<"compliance">]>>>;
        uids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TTasksOtherAssignBody = z.infer<typeof TasksOtherAssignBody>;
export declare const TasksOtherStatusBody: z.ZodObject<{
    id: z.ZodString;
    action: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        complete: "complete";
        reopen: "reopen";
    }>>>;
}, z.core.$strip>;
export type TTasksOtherStatusBody = z.infer<typeof TasksOtherStatusBody>;
export declare const TasksOtherListMyQuery: z.ZodObject<{
    month: z.ZodOptional<z.ZodString>;
    includeGroup: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"true">, z.ZodLiteral<"false">]>>;
}, z.core.$strip>;
export type TTasksOtherListMyQuery = z.infer<typeof TasksOtherListMyQuery>;
export declare const TasksUpdateFieldsBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    taskId: z.ZodString;
    patch: z.ZodObject<{
        notify: z.ZodOptional<z.ZodBoolean>;
        notes: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
        bucket: z.ZodOptional<z.ZodEnum<{
            other: "other";
            compliance: "compliance";
            task: "task";
            assessment: "assessment";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TTasksUpdateFieldsBody = z.infer<typeof TasksUpdateFieldsBody>;
export declare const TasksDeleteBody: z.ZodObject<{
    enrollmentId: z.ZodString;
    taskId: z.ZodOptional<z.ZodString>;
    all: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString, z.ZodNumber]>>;
}, z.core.$strip>;
export type TTasksDeleteBody = z.infer<typeof TasksDeleteBody>;
export declare const TasksGenerateScheduleWriteBody: z.ZodObject<{
    enrollmentId: z.ZodOptional<z.ZodString>;
    enrollmentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodString>;
    keepManual: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        replaceManaged: "replaceManaged";
        mergeManaged: "mergeManaged";
    }>>>;
    preserveCompletedManaged: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    pinCompletedManaged: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    taskDef: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnknown, z.ZodArray<z.ZodUnknown>]>>;
    taskDefs: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    replaceTaskDefPrefixes: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
}, z.core.$strip>;
export type TTasksGenerateScheduleWriteBody = z.infer<typeof TasksGenerateScheduleWriteBody>;
export declare const TasksGenerateScheduleWriteResult: z.ZodObject<{
    enrollmentId: z.ZodString;
    ok: z.ZodBoolean;
    total: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    closed: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type TTasksGenerateScheduleWriteResult = z.infer<typeof TasksGenerateScheduleWriteResult>;
