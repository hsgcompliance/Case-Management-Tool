import { z } from "./core.js";
export declare const TourStep: z.ZodObject<{
    id: z.ZodString;
    route: z.ZodString;
    selector: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    placement: z.ZodDefault<z.ZodEnum<{
        auto: "auto";
        top: "top";
        bottom: "bottom";
        left: "left";
        right: "right";
    }>>;
    padding: z.ZodDefault<z.ZodNumber>;
    offsetX: z.ZodDefault<z.ZodNumber>;
    offsetY: z.ZodDefault<z.ZodNumber>;
    requireClick: z.ZodDefault<z.ZodBoolean>;
    nextOn: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        auto: "auto";
        button: "button";
        click: "click";
    }>>>;
    advanceWhen: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TourStepT = z.infer<typeof TourStep>;
export declare const TourFlow: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        route: z.ZodString;
        selector: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        body: z.ZodOptional<z.ZodString>;
        placement: z.ZodDefault<z.ZodEnum<{
            auto: "auto";
            top: "top";
            bottom: "bottom";
            left: "left";
            right: "right";
        }>>;
        padding: z.ZodDefault<z.ZodNumber>;
        offsetX: z.ZodDefault<z.ZodNumber>;
        offsetY: z.ZodDefault<z.ZodNumber>;
        requireClick: z.ZodDefault<z.ZodBoolean>;
        nextOn: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            auto: "auto";
            button: "button";
            click: "click";
        }>>>;
        advanceWhen: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    version: z.ZodDefault<z.ZodLiteral<2>>;
    active: z.ZodDefault<z.ZodBoolean>;
    deleted: z.ZodDefault<z.ZodBoolean>;
    meta: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type TourFlowT = z.infer<typeof TourFlow>;
export declare const ToursUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        route: z.ZodString;
        selector: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        body: z.ZodOptional<z.ZodString>;
        placement: z.ZodDefault<z.ZodEnum<{
            auto: "auto";
            top: "top";
            bottom: "bottom";
            left: "left";
            right: "right";
        }>>;
        padding: z.ZodDefault<z.ZodNumber>;
        offsetX: z.ZodDefault<z.ZodNumber>;
        offsetY: z.ZodDefault<z.ZodNumber>;
        requireClick: z.ZodDefault<z.ZodBoolean>;
        nextOn: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            auto: "auto";
            button: "button";
            click: "click";
        }>>>;
        advanceWhen: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    version: z.ZodDefault<z.ZodLiteral<2>>;
    active: z.ZodDefault<z.ZodBoolean>;
    deleted: z.ZodDefault<z.ZodBoolean>;
    meta: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        route: z.ZodString;
        selector: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        body: z.ZodOptional<z.ZodString>;
        placement: z.ZodDefault<z.ZodEnum<{
            auto: "auto";
            top: "top";
            bottom: "bottom";
            left: "left";
            right: "right";
        }>>;
        padding: z.ZodDefault<z.ZodNumber>;
        offsetX: z.ZodDefault<z.ZodNumber>;
        offsetY: z.ZodDefault<z.ZodNumber>;
        requireClick: z.ZodDefault<z.ZodBoolean>;
        nextOn: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            auto: "auto";
            button: "button";
            click: "click";
        }>>>;
        advanceWhen: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    version: z.ZodDefault<z.ZodLiteral<2>>;
    active: z.ZodDefault<z.ZodBoolean>;
    deleted: z.ZodDefault<z.ZodBoolean>;
    meta: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>>]>;
export type ToursUpsertBodyT = z.infer<typeof ToursUpsertBody>;
export declare const ToursPatchItem: z.ZodObject<{
    id: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type ToursPatchItemT = z.infer<typeof ToursPatchItem>;
export declare const ToursPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>>]>;
export type ToursPatchBodyT = z.infer<typeof ToursPatchBody>;
export declare const ToursDeleteBody: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    ids: z.ZodArray<z.ZodString>;
}, z.core.$strip>]>;
export type ToursDeleteBodyT = z.infer<typeof ToursDeleteBody>;
export declare const ToursGetQuery: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type ToursGetQueryT = z.infer<typeof ToursGetQuery>;
export declare const ToursListQuery: z.ZodObject<{
    active: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
    deleted: z.ZodOptional<z.ZodPreprocess<z.ZodBoolean>>;
    limit: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    startAfter: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
}, z.core.$strip>;
export type ToursListQueryT = z.infer<typeof ToursListQuery>;
