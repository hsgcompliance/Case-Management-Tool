import { z, Id, IdLike, TsLike, BoolLike, toArray } from "./core";
import { Ok } from "./http";

export { toArray } from "./core";

const Num = z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
const ISO7 = z.string().regex(/^\d{4}-\d{2}$/);

export const CreditCardStatus = z.enum(["active", "draft", "closed", "deleted"]);
export type TCreditCardStatus = z.infer<typeof CreditCardStatus>;

export const CreditCardKind = z.literal("credit_card");
export type TCreditCardKind = z.infer<typeof CreditCardKind>;

export const CreditCardCycleType = z.enum(["calendar_month", "statement_cycle"]);
export type TCreditCardCycleType = z.infer<typeof CreditCardCycleType>;

export const CreditCardLimitOverride = z
  .object({
    month: ISO7,
    limitCents: z.coerce.number().int().min(0),
  })
  .passthrough();
export type TCreditCardLimitOverride = z.infer<typeof CreditCardLimitOverride>;

export const CreditCardMatching = z
  .object({
    aliases: z.array(z.string().trim().min(1)).default([]),
    cardAnswerValues: z.array(z.string().trim().min(1)).default([]),
    formIds: z
      .object({
        creditCard: z.string().trim().nullish(),
        invoice: z.string().trim().nullish(),
      })
      .partial()
      .nullish(),
  })
  .passthrough();
export type TCreditCardMatching = z.infer<typeof CreditCardMatching>;

export const CreditCardInputSchema = z
  .object({
    id: Id.optional(),
    orgId: Id.nullish(),
    kind: CreditCardKind.optional(),
    name: z.string().trim().min(1),
    code: z.string().trim().nullish(),
    status: CreditCardStatus.optional(),
    active: z.boolean().optional(),
    deleted: z.boolean().optional(),
    issuer: z.string().trim().nullish(),
    network: z.string().trim().nullish(),
    last4: z
      .string()
      .trim()
      .regex(/^\d{4}$/)
      .nullish(),
    cycleType: CreditCardCycleType.optional(),
    statementCloseDay: z.coerce.number().int().min(1).max(31).nullish(),
    monthlyLimitCents: z.coerce.number().int().min(0).default(0),
    limitOverrides: z.array(CreditCardLimitOverride).default([]),
    matching: CreditCardMatching.nullish(),
    notes: z.string().nullish(),
    meta: z.record(z.string(), z.unknown()).nullish(),
    createdAt: TsLike.nullish(),
    updatedAt: TsLike.nullish(),
  })
  .passthrough();

export type TCreditCard = z.infer<typeof CreditCardInputSchema> & Record<string, unknown>;

export const CreditCard = CreditCardInputSchema;

export const CreditCardEntity = CreditCardInputSchema.extend({
  id: Id,
  kind: CreditCardKind,
}).passthrough();
export type TCreditCardEntity = z.infer<typeof CreditCardEntity> & Record<string, unknown>;

export const CreditCardsUpsertBody = z.union([
  CreditCardInputSchema,
  z.array(CreditCardInputSchema).min(1),
]);
export const CreditCardUpsertBody = CreditCardsUpsertBody;
export type TCreditCardsUpsertBody = z.infer<typeof CreditCardsUpsertBody>;
export type TCreditCardsUpsertResp = Ok<{ ids: string[] }>;

export const CreditCardsPatchRow = z
  .object({
    id: Id,
    patch: CreditCardInputSchema.partial().passthrough(),
    unset: z.array(z.string().min(1)).optional(),
  })
  .passthrough()
  .refine(
    (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
    { message: "empty_patch" }
  );
export const CreditCardsPatchBody = z.union([
  CreditCardsPatchRow,
  z.array(CreditCardsPatchRow).min(1),
]);
export const CreditCardPatchBody = CreditCardsPatchBody;
export type TCreditCardsPatchRow = z.infer<typeof CreditCardsPatchRow>;
export type TCreditCardsPatchBody = z.infer<typeof CreditCardsPatchBody>;
export type TCreditCardsPatchResp = Ok<{ ids: string[] }>;

export const CreditCardsDeleteBody = z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v as { ids?: unknown; id?: unknown };
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  z.union([IdLike, z.array(IdLike).min(1)])
);
export type TCreditCardsDeleteBody = z.infer<typeof CreditCardsDeleteBody>;
export type TCreditCardsDeleteResp = Ok<{ ids: string[]; deleted: true }>;

export const CreditCardsAdminDeleteBody = CreditCardsDeleteBody;
export type TCreditCardsAdminDeleteBody = z.infer<typeof CreditCardsAdminDeleteBody>;
export type TCreditCardsAdminDeleteResp = Ok<{ ids: string[]; deleted: true }>;

const ActiveFilter = z.preprocess(
  (v) => {
    if (v === "" || v == null) return undefined;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
    if (Array.isArray(v)) return v[0];
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "y", "active"].includes(s)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
    }
    return v;
  },
  z.union([z.literal(true), z.literal(false)])
);

export const CreditCardsListQuery = z
  .object({
    status: z.string().trim().optional(),
    active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursorUpdatedAt: TsLike.optional(),
    cursorId: IdLike.optional(),
    orgId: IdLike.optional(),
  })
  .passthrough();
export type TCreditCardsListQuery = z.infer<typeof CreditCardsListQuery>;
export type TCreditCardsListResp = Ok<{
  items: TCreditCardEntity[];
  next: { cursorUpdatedAt: unknown; cursorId: string } | null;
  orgId: string;
}>;

export const CreditCardsGetQuery = z
  .object({
    id: IdLike,
    orgId: IdLike.optional(),
  })
  .passthrough();
export type TCreditCardsGetQuery = z.infer<typeof CreditCardsGetQuery>;
export type TCreditCardsGetResp = Ok<{ card: TCreditCardEntity }>;

export type TCreditCardsStructureResp = Ok<{ structure: Partial<TCreditCard> }>;

export const CreditCardsSummaryQuery = z
  .object({
    id: IdLike.optional(),
    month: ISO7.optional(),
    active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),
    orgId: IdLike.optional(),
  })
  .passthrough();
export type TCreditCardsSummaryQuery = z.infer<typeof CreditCardsSummaryQuery>;

export type TCreditCardsSummaryItem = {
  id: string;
  name: string;
  status: TCreditCardStatus;
  month: string;
  monthlyLimitCents: number;
  spentCents: number;
  remainingCents: number;
  usagePct: number;
  entryCount: number;
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
