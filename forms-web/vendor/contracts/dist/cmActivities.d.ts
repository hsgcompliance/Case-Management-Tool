import { z } from "./core.js";
export declare const CmActivityType: z.ZodEnum<{
    "in-person": "in-person";
    phone: "phone";
    "data-entry": "data-entry";
    other: "other";
}>;
export type TCmActivityType = z.infer<typeof CmActivityType>;
export declare const CmActivity: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodString;
    caseManagerId: z.ZodString;
    caseManagerName: z.ZodOptional<z.ZodString>;
    customerId: z.ZodString;
    customerName: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        "in-person": "in-person";
        phone: "phone";
        "data-entry": "data-entry";
        other: "other";
    }>;
    date: z.ZodString;
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    calendarEventId: z.ZodOptional<z.ZodString>;
    calendarSynced: z.ZodOptional<z.ZodBoolean>;
    workbookSynced: z.ZodOptional<z.ZodBoolean>;
    workbookSyncedAt: z.ZodOptional<z.ZodString>;
    workbookRowKey: z.ZodOptional<z.ZodString>;
    archived: z.ZodOptional<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TCmActivity = z.infer<typeof CmActivity>;
export declare const CmActivityCreateBody: z.ZodObject<{
    customerId: z.ZodString;
    customerName: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        "in-person": "in-person";
        phone: "phone";
        "data-entry": "data-entry";
        other: "other";
    }>;
    date: z.ZodString;
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    postToCalendar: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type TCmActivityCreateBody = z.infer<typeof CmActivityCreateBody>;
export declare const CmActivityUpdateBody: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<{
        "in-person": "in-person";
        phone: "phone";
        "data-entry": "data-entry";
        other: "other";
    }>>;
    date: z.ZodOptional<z.ZodString>;
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TCmActivityUpdateBody = z.infer<typeof CmActivityUpdateBody>;
export declare const CmActivitiesListQuery: z.ZodObject<{
    month: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type TCmActivitiesListQuery = z.infer<typeof CmActivitiesListQuery>;
export declare const CmActivitiesListResp: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orgId: z.ZodString;
        caseManagerId: z.ZodString;
        caseManagerName: z.ZodOptional<z.ZodString>;
        customerId: z.ZodString;
        customerName: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            "in-person": "in-person";
            phone: "phone";
            "data-entry": "data-entry";
            other: "other";
        }>;
        date: z.ZodString;
        startTime: z.ZodOptional<z.ZodString>;
        endTime: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
        calendarEventId: z.ZodOptional<z.ZodString>;
        calendarSynced: z.ZodOptional<z.ZodBoolean>;
        workbookSynced: z.ZodOptional<z.ZodBoolean>;
        workbookSyncedAt: z.ZodOptional<z.ZodString>;
        workbookRowKey: z.ZodOptional<z.ZodString>;
        archived: z.ZodOptional<z.ZodBoolean>;
        createdAt: z.ZodString;
        updatedAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TCmActivitiesListResp = z.infer<typeof CmActivitiesListResp>;
