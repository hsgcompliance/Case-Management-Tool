import { z } from "./core.js";
import { Ok } from "./http.js";
export { toArray } from "./core.js";
export declare const CreditCardStatus: z.ZodEnum<{
    draft: "draft";
    active: "active";
    closed: "closed";
    deleted: "deleted";
}>;
export type TCreditCardStatus = z.infer<typeof CreditCardStatus>;
export declare const CreditCardKind: z.ZodLiteral<"credit_card">;
export type TCreditCardKind = z.infer<typeof CreditCardKind>;
export declare const CreditCardCycleType: z.ZodEnum<{
    calendar_month: "calendar_month";
    statement_cycle: "statement_cycle";
}>;
export type TCreditCardCycleType = z.infer<typeof CreditCardCycleType>;
export declare const CreditCardLimitOverride: z.ZodObject<{
    month: z.ZodString;
    limitCents: z.ZodCoercedNumber<unknown>;
}, z.core.$loose>;
export type TCreditCardLimitOverride = z.infer<typeof CreditCardLimitOverride>;
export declare const CreditCardMatching: z.ZodObject<{
    aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
    cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
    formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, z.core.$strip>>>;
}, z.core.$loose>;
export type TCreditCardMatching = z.infer<typeof CreditCardMatching>;
export declare const CreditCardInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodLiteral<"credit_card">>;
    name: z.ZodString;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    issuer: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    network: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last4: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cycleType: z.ZodOptional<z.ZodEnum<{
        calendar_month: "calendar_month";
        statement_cycle: "statement_cycle";
    }>>;
    statementCloseDay: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    monthlyLimitCents: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limitOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        limitCents: z.ZodCoercedNumber<unknown>;
    }, z.core.$loose>>>;
    matching: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
        formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export type TCreditCard = z.infer<typeof CreditCardInputSchema> & Record<string, unknown>;
export declare const CreditCard: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodLiteral<"credit_card">>;
    name: z.ZodString;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    issuer: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    network: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last4: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cycleType: z.ZodOptional<z.ZodEnum<{
        calendar_month: "calendar_month";
        statement_cycle: "statement_cycle";
    }>>;
    statementCloseDay: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    monthlyLimitCents: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limitOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        limitCents: z.ZodCoercedNumber<unknown>;
    }, z.core.$loose>>>;
    matching: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
        formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export declare const CreditCardEntity: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    issuer: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    network: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last4: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cycleType: z.ZodOptional<z.ZodEnum<{
        calendar_month: "calendar_month";
        statement_cycle: "statement_cycle";
    }>>;
    statementCloseDay: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    monthlyLimitCents: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limitOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        limitCents: z.ZodCoercedNumber<unknown>;
    }, z.core.$loose>>>;
    matching: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
        formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    id: z.ZodString;
    kind: z.ZodLiteral<"credit_card">;
}, z.core.$loose>;
export type TCreditCardEntity = z.infer<typeof CreditCardEntity> & Record<string, unknown>;
export declare const CreditCardsUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodLiteral<"credit_card">>;
    name: z.ZodString;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    issuer: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    network: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last4: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cycleType: z.ZodOptional<z.ZodEnum<{
        calendar_month: "calendar_month";
        statement_cycle: "statement_cycle";
    }>>;
    statementCloseDay: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    monthlyLimitCents: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limitOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        limitCents: z.ZodCoercedNumber<unknown>;
    }, z.core.$loose>>>;
    matching: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
        formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodLiteral<"credit_card">>;
    name: z.ZodString;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    issuer: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    network: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last4: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cycleType: z.ZodOptional<z.ZodEnum<{
        calendar_month: "calendar_month";
        statement_cycle: "statement_cycle";
    }>>;
    statementCloseDay: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    monthlyLimitCents: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limitOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        limitCents: z.ZodCoercedNumber<unknown>;
    }, z.core.$loose>>>;
    matching: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
        formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>>]>;
export declare const CreditCardUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodLiteral<"credit_card">>;
    name: z.ZodString;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    issuer: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    network: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last4: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cycleType: z.ZodOptional<z.ZodEnum<{
        calendar_month: "calendar_month";
        statement_cycle: "statement_cycle";
    }>>;
    statementCloseDay: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    monthlyLimitCents: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limitOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        limitCents: z.ZodCoercedNumber<unknown>;
    }, z.core.$loose>>>;
    matching: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
        formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodLiteral<"credit_card">>;
    name: z.ZodString;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        closed: "closed";
        deleted: "deleted";
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    issuer: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    network: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last4: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cycleType: z.ZodOptional<z.ZodEnum<{
        calendar_month: "calendar_month";
        statement_cycle: "statement_cycle";
    }>>;
    statementCloseDay: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    monthlyLimitCents: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limitOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        limitCents: z.ZodCoercedNumber<unknown>;
    }, z.core.$loose>>>;
    matching: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
        formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, z.core.$strip>>>;
    }, z.core.$loose>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>>]>;
export type TCreditCardsUpsertBody = z.infer<typeof CreditCardsUpsertBody>;
export type TCreditCardsUpsertResp = Ok<{
    ids: string[];
}>;
export declare const CreditCardsPatchRow: z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodLiteral<"credit_card">>>;
        name: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        issuer: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        network: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        last4: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cycleType: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            calendar_month: "calendar_month";
            statement_cycle: "statement_cycle";
        }>>>;
        statementCloseDay: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
        monthlyLimitCents: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        limitOverrides: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
            month: z.ZodString;
            limitCents: z.ZodCoercedNumber<unknown>;
        }, z.core.$loose>>>>;
        matching: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
            cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
            formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>;
export declare const CreditCardsPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodLiteral<"credit_card">>>;
        name: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        issuer: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        network: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        last4: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cycleType: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            calendar_month: "calendar_month";
            statement_cycle: "statement_cycle";
        }>>>;
        statementCloseDay: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
        monthlyLimitCents: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        limitOverrides: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
            month: z.ZodString;
            limitCents: z.ZodCoercedNumber<unknown>;
        }, z.core.$loose>>>>;
        matching: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
            cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
            formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodLiteral<"credit_card">>>;
        name: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        issuer: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        network: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        last4: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cycleType: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            calendar_month: "calendar_month";
            statement_cycle: "statement_cycle";
        }>>>;
        statementCloseDay: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
        monthlyLimitCents: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        limitOverrides: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
            month: z.ZodString;
            limitCents: z.ZodCoercedNumber<unknown>;
        }, z.core.$loose>>>>;
        matching: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
            cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
            formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>>]>;
export declare const CreditCardPatchBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodLiteral<"credit_card">>>;
        name: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        issuer: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        network: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        last4: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cycleType: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            calendar_month: "calendar_month";
            statement_cycle: "statement_cycle";
        }>>>;
        statementCloseDay: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
        monthlyLimitCents: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        limitOverrides: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
            month: z.ZodString;
            limitCents: z.ZodCoercedNumber<unknown>;
        }, z.core.$loose>>>>;
        matching: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
            cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
            formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        orgId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        kind: z.ZodOptional<z.ZodOptional<z.ZodLiteral<"credit_card">>>;
        name: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            draft: "draft";
            active: "active";
            closed: "closed";
            deleted: "deleted";
        }>>>;
        active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        deleted: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        issuer: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        network: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        last4: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        cycleType: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
            calendar_month: "calendar_month";
            statement_cycle: "statement_cycle";
        }>>>;
        statementCloseDay: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
        monthlyLimitCents: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
        limitOverrides: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
            month: z.ZodString;
            limitCents: z.ZodCoercedNumber<unknown>;
        }, z.core.$loose>>>>;
        matching: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
            cardAnswerValues: z.ZodDefault<z.ZodArray<z.ZodString>>;
            formIds: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                creditCard: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
                invoice: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            }, z.core.$strip>>>;
        }, z.core.$loose>>>>;
        notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        meta: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
            seconds: z.ZodNumber;
            nanoseconds: z.ZodNumber;
        }, z.core.$strip>]>>>>;
    }, z.core.$loose>;
    unset: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$loose>>]>;
export type TCreditCardsPatchRow = z.infer<typeof CreditCardsPatchRow>;
export type TCreditCardsPatchBody = z.infer<typeof CreditCardsPatchBody>;
export type TCreditCardsPatchResp = Ok<{
    ids: string[];
}>;
export declare const CreditCardsDeleteBody: z.ZodPreprocess<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodString>, z.ZodArray<z.ZodPreprocess<z.ZodString>>]>>;
export type TCreditCardsDeleteBody = z.infer<typeof CreditCardsDeleteBody>;
export type TCreditCardsDeleteResp = Ok<{
    ids: string[];
    deleted: true;
}>;
export declare const CreditCardsAdminDeleteBody: z.ZodPreprocess<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodString>, z.ZodArray<z.ZodPreprocess<z.ZodString>>]>>;
export type TCreditCardsAdminDeleteBody = z.infer<typeof CreditCardsAdminDeleteBody>;
export type TCreditCardsAdminDeleteResp = Ok<{
    ids: string[];
    deleted: true;
}>;
export declare const CreditCardsListQuery: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodUnion<readonly [z.ZodLiteral<true>, z.ZodLiteral<false>]>>, z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>, z.ZodString]>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    cursorUpdatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>;
    cursorId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TCreditCardsListQuery = z.infer<typeof CreditCardsListQuery>;
export type TCreditCardsListResp = Ok<{
    items: TCreditCardEntity[];
    next: {
        cursorUpdatedAt: unknown;
        cursorId: string;
    } | null;
    orgId: string;
}>;
export declare const CreditCardsGetQuery: z.ZodObject<{
    id: z.ZodPreprocess<z.ZodString>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TCreditCardsGetQuery = z.infer<typeof CreditCardsGetQuery>;
export type TCreditCardsGetResp = Ok<{
    card: TCreditCardEntity;
}>;
export type TCreditCardsStructureResp = Ok<{
    structure: Partial<TCreditCard>;
}>;
export declare const CreditCardsSummaryQuery: z.ZodObject<{
    id: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
    month: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodUnion<readonly [z.ZodPreprocess<z.ZodUnion<readonly [z.ZodLiteral<true>, z.ZodLiteral<false>]>>, z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodLiteral<1>, z.ZodLiteral<0>, z.ZodLiteral<"1">, z.ZodLiteral<"0">]>, z.ZodString]>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TCreditCardsSummaryQuery = z.infer<typeof CreditCardsSummaryQuery>;
export type TCreditCardsSummaryItem = {
    id: string;
    name: string;
    status: TCreditCardStatus;
    month: string;
    lastMonth: string;
    monthlyLimitCents: number;
    spentCents: number;
    remainingCents: number;
    usagePct: number;
    entryCount: number;
    lastMonthSpentCents: number;
    lastMonthEntryCount: number;
    cycleType: TCreditCardCycleType;
    statementCloseDay: number | null;
    last4: string | null;
};
export type TCreditCardsSummaryResp = Ok<{
    items: TCreditCardsSummaryItem[];
    month: string;
    unassignedSpentCents: number;
    unassignedEntryCount: number;
}>;
