import {
  BoolLike,
  Id,
  IdLike,
  TsLike,
  toArray,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/creditCards.ts
var creditCards_exports = {};
__export(creditCards_exports, {
  CreditCard: () => CreditCard,
  CreditCardCycleType: () => CreditCardCycleType,
  CreditCardEntity: () => CreditCardEntity,
  CreditCardInputSchema: () => CreditCardInputSchema,
  CreditCardKind: () => CreditCardKind,
  CreditCardLimitOverride: () => CreditCardLimitOverride,
  CreditCardMatching: () => CreditCardMatching,
  CreditCardPatchBody: () => CreditCardPatchBody,
  CreditCardStatus: () => CreditCardStatus,
  CreditCardUpsertBody: () => CreditCardUpsertBody,
  CreditCardsAdminDeleteBody: () => CreditCardsAdminDeleteBody,
  CreditCardsDeleteBody: () => CreditCardsDeleteBody,
  CreditCardsGetQuery: () => CreditCardsGetQuery,
  CreditCardsListQuery: () => CreditCardsListQuery,
  CreditCardsPatchBody: () => CreditCardsPatchBody,
  CreditCardsPatchRow: () => CreditCardsPatchRow,
  CreditCardsSummaryQuery: () => CreditCardsSummaryQuery,
  CreditCardsUpsertBody: () => CreditCardsUpsertBody,
  toArray: () => toArray
});
var Num = z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var ISO7 = z.string().regex(/^\d{4}-\d{2}$/);
var CreditCardStatus = z.enum(["active", "draft", "closed", "deleted"]);
var CreditCardKind = z.literal("credit_card");
var CreditCardCycleType = z.enum(["calendar_month", "statement_cycle"]);
var CreditCardLimitOverride = z.object({
  month: ISO7,
  limitCents: z.coerce.number().int().min(0)
}).passthrough();
var CreditCardMatching = z.object({
  aliases: z.array(z.string().trim().min(1)).default([]),
  cardAnswerValues: z.array(z.string().trim().min(1)).default([]),
  formIds: z.object({
    creditCard: z.string().trim().nullish(),
    invoice: z.string().trim().nullish()
  }).partial().nullish()
}).passthrough();
var CreditCardInputSchema = z.object({
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
  last4: z.string().trim().regex(/^\d{4}$/).nullish(),
  cycleType: CreditCardCycleType.optional(),
  statementCloseDay: z.coerce.number().int().min(1).max(31).nullish(),
  monthlyLimitCents: z.coerce.number().int().min(0).default(0),
  limitOverrides: z.array(CreditCardLimitOverride).default([]),
  matching: CreditCardMatching.nullish(),
  notes: z.string().nullish(),
  meta: z.record(z.string(), z.unknown()).nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var CreditCard = CreditCardInputSchema;
var CreditCardEntity = CreditCardInputSchema.extend({
  id: Id,
  kind: CreditCardKind
}).passthrough();
var CreditCardsUpsertBody = z.union([
  CreditCardInputSchema,
  z.array(CreditCardInputSchema).min(1)
]);
var CreditCardUpsertBody = CreditCardsUpsertBody;
var CreditCardsPatchRow = z.object({
  id: Id,
  patch: CreditCardInputSchema.partial().passthrough(),
  unset: z.array(z.string().min(1)).optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var CreditCardsPatchBody = z.union([
  CreditCardsPatchRow,
  z.array(CreditCardsPatchRow).min(1)
]);
var CreditCardPatchBody = CreditCardsPatchBody;
var CreditCardsDeleteBody = z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  z.union([IdLike, z.array(IdLike).min(1)])
);
var CreditCardsAdminDeleteBody = CreditCardsDeleteBody;
var ActiveFilter = z.preprocess(
  (v) => {
    if (v === "" || v == null) return void 0;
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
var CreditCardsListQuery = z.object({
  status: z.string().trim().optional(),
  active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  orgId: IdLike.optional()
}).passthrough();
var CreditCardsGetQuery = z.object({
  id: IdLike,
  orgId: IdLike.optional()
}).passthrough();
var CreditCardsSummaryQuery = z.object({
  id: IdLike.optional(),
  month: ISO7.optional(),
  active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),
  orgId: IdLike.optional()
}).passthrough();

export {
  CreditCardStatus,
  CreditCardKind,
  CreditCardCycleType,
  CreditCardLimitOverride,
  CreditCardMatching,
  CreditCardInputSchema,
  CreditCard,
  CreditCardEntity,
  CreditCardsUpsertBody,
  CreditCardUpsertBody,
  CreditCardsPatchRow,
  CreditCardsPatchBody,
  CreditCardPatchBody,
  CreditCardsDeleteBody,
  CreditCardsAdminDeleteBody,
  CreditCardsListQuery,
  CreditCardsGetQuery,
  CreditCardsSummaryQuery,
  creditCards_exports
};
