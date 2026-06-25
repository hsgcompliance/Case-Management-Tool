import { z } from "zod";
export { z } from "zod";
export declare const Id: z.ZodString;
export declare const Ids: z.ZodArray<z.ZodString>;
export declare const IdLike: z.ZodPreprocess<z.ZodString>;
export declare const GrantIdsLike: z.ZodPreprocess<z.ZodArray<z.ZodString>>;
export declare const TimestampLike: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
    seconds: z.ZodNumber;
    nanoseconds: z.ZodNumber;
}, z.core.$strip>]>;
export declare const TsLike: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
    seconds: z.ZodNumber;
    nanoseconds: z.ZodNumber;
}, z.core.$strip>]>;
export declare const ISO10: z.ZodString;
export type TTsLike = z.infer<typeof TsLike>;
export type TISO10 = z.infer<typeof ISO10>;
export declare const BoolLike: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>;
export declare const Boolish: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>;
export type Boolish = z.infer<typeof Boolish>;
/**
 * Coerces boolean-ish input to a real boolean.
 * - Handles "true"/"false", "1"/"0", 1/0, booleans
 * - Treats "" / null / undefined as-is so `.optional()` can work cleanly
 * - If input is an array (Express query), uses the first value
 *
 * Use this when the handler wants an actual boolean (not the raw query semantics).
 */
export declare const BoolFromLike: z.ZodPreprocess<z.ZodBoolean>;
export declare const JsonObj: z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>;
export declare const JsonObjLike: z.ZodPreprocess<z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>>;
export interface BudgetLineItemLike {
    id?: string;
    amount?: number | string | null;
    spent?: number | string | null;
    projected?: number | string | null;
    [key: string]: any;
}
export interface BudgetTotals {
    total: number;
    spent: number;
    balance: number;
    projected: number;
    projectedBalance: number;
    /** spent + projected — total dollars allocated (committed + future obligations) */
    projectedSpend?: number;
}
export declare function toArray<T>(x: T | T[] | undefined | null): T[];
