"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
module.exports = __toCommonJS(creditCards_exports);

// src/core.ts
var import_zod = require("zod");
var import_zod2 = require("zod");
var Id = import_zod.z.string().trim().min(1);
var Ids = import_zod.z.array(Id).min(1);
var IdLike = import_zod.z.preprocess((v) => {
  if (typeof v === "string" || typeof v === "number") return String(v);
  return v;
}, Id);
var GrantIdsLike = import_zod.z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return v;
}, import_zod.z.array(Id).min(1));
var TimestampLike = import_zod.z.union([
  import_zod.z.string(),
  // ISO
  import_zod.z.number(),
  // millis
  import_zod.z.object({ seconds: import_zod.z.number(), nanoseconds: import_zod.z.number() })
  // Firestore JSON-ish
]);
var TsLike = TimestampLike;
var ISO10 = import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var BoolLike = import_zod.z.union([
  import_zod.z.boolean(),
  import_zod.z.literal("true"),
  import_zod.z.literal("false"),
  import_zod.z.literal(1),
  import_zod.z.literal(0),
  import_zod.z.literal("1"),
  import_zod.z.literal("0")
]);
var BoolFromLike = import_zod.z.preprocess((v) => {
  if (Array.isArray(v)) v = v[0];
  if (v === "" || v === null || v === void 0) return v;
  if (v === true || v === false) return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return v;
}, import_zod.z.boolean());
var JsonObj = import_zod.z.object({}).catchall(import_zod.z.unknown());
var JsonObjLike = import_zod.z.preprocess((v) => {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? parsed : v;
    } catch {
      return v;
    }
  }
  return v;
}, JsonObj);
function toArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

// src/creditCards.ts
var Num = import_zod2.z.coerce.number().refine(Number.isFinite, "not_finite").default(0);
var ISO7 = import_zod2.z.string().regex(/^\d{4}-\d{2}$/);
var CreditCardStatus = import_zod2.z.enum(["active", "draft", "closed", "deleted"]);
var CreditCardKind = import_zod2.z.literal("credit_card");
var CreditCardCycleType = import_zod2.z.enum(["calendar_month", "statement_cycle"]);
var CreditCardLimitOverride = import_zod2.z.object({
  month: ISO7,
  limitCents: import_zod2.z.coerce.number().int().min(0)
}).passthrough();
var CreditCardMatching = import_zod2.z.object({
  aliases: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
  cardAnswerValues: import_zod2.z.array(import_zod2.z.string().trim().min(1)).default([]),
  formIds: import_zod2.z.object({
    creditCard: import_zod2.z.string().trim().nullish(),
    invoice: import_zod2.z.string().trim().nullish()
  }).partial().nullish()
}).passthrough();
var CreditCardInputSchema = import_zod2.z.object({
  id: Id.optional(),
  orgId: Id.nullish(),
  kind: CreditCardKind.optional(),
  name: import_zod2.z.string().trim().min(1),
  code: import_zod2.z.string().trim().nullish(),
  status: CreditCardStatus.optional(),
  active: import_zod2.z.boolean().optional(),
  deleted: import_zod2.z.boolean().optional(),
  issuer: import_zod2.z.string().trim().nullish(),
  network: import_zod2.z.string().trim().nullish(),
  last4: import_zod2.z.string().trim().regex(/^\d{4}$/).nullish(),
  cycleType: CreditCardCycleType.optional(),
  statementCloseDay: import_zod2.z.coerce.number().int().min(1).max(31).nullish(),
  monthlyLimitCents: import_zod2.z.coerce.number().int().min(0).default(0),
  limitOverrides: import_zod2.z.array(CreditCardLimitOverride).default([]),
  matching: CreditCardMatching.nullish(),
  notes: import_zod2.z.string().nullish(),
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).nullish(),
  createdAt: TsLike.nullish(),
  updatedAt: TsLike.nullish()
}).passthrough();
var CreditCard = CreditCardInputSchema;
var CreditCardEntity = CreditCardInputSchema.extend({
  id: Id,
  kind: CreditCardKind
}).passthrough();
var CreditCardsUpsertBody = import_zod2.z.union([
  CreditCardInputSchema,
  import_zod2.z.array(CreditCardInputSchema).min(1)
]);
var CreditCardUpsertBody = CreditCardsUpsertBody;
var CreditCardsPatchRow = import_zod2.z.object({
  id: Id,
  patch: CreditCardInputSchema.partial().passthrough(),
  unset: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
}).passthrough().refine(
  (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
  { message: "empty_patch" }
);
var CreditCardsPatchBody = import_zod2.z.union([
  CreditCardsPatchRow,
  import_zod2.z.array(CreditCardsPatchRow).min(1)
]);
var CreditCardPatchBody = CreditCardsPatchBody;
var CreditCardsDeleteBody = import_zod2.z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  import_zod2.z.union([IdLike, import_zod2.z.array(IdLike).min(1)])
);
var CreditCardsAdminDeleteBody = CreditCardsDeleteBody;
var ActiveFilter = import_zod2.z.preprocess(
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
  import_zod2.z.union([import_zod2.z.literal(true), import_zod2.z.literal(false)])
);
var CreditCardsListQuery = import_zod2.z.object({
  status: import_zod2.z.string().trim().optional(),
  active: import_zod2.z.union([ActiveFilter, BoolLike, import_zod2.z.string()]).optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional(),
  cursorUpdatedAt: TsLike.optional(),
  cursorId: IdLike.optional(),
  orgId: IdLike.optional()
}).passthrough();
var CreditCardsGetQuery = import_zod2.z.object({
  id: IdLike,
  orgId: IdLike.optional()
}).passthrough();
var CreditCardsSummaryQuery = import_zod2.z.object({
  id: IdLike.optional(),
  month: ISO7.optional(),
  active: import_zod2.z.union([ActiveFilter, BoolLike, import_zod2.z.string()]).optional(),
  orgId: IdLike.optional()
}).passthrough();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CreditCard,
  CreditCardCycleType,
  CreditCardEntity,
  CreditCardInputSchema,
  CreditCardKind,
  CreditCardLimitOverride,
  CreditCardMatching,
  CreditCardPatchBody,
  CreditCardStatus,
  CreditCardUpsertBody,
  CreditCardsAdminDeleteBody,
  CreditCardsDeleteBody,
  CreditCardsGetQuery,
  CreditCardsListQuery,
  CreditCardsPatchBody,
  CreditCardsPatchRow,
  CreditCardsSummaryQuery,
  CreditCardsUpsertBody,
  toArray
});
