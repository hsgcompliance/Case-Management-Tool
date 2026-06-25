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

// src/tours.ts
var tours_exports = {};
__export(tours_exports, {
  TourFlow: () => TourFlow,
  TourStep: () => TourStep,
  ToursDeleteBody: () => ToursDeleteBody,
  ToursGetQuery: () => ToursGetQuery,
  ToursListQuery: () => ToursListQuery,
  ToursPatchBody: () => ToursPatchBody,
  ToursPatchItem: () => ToursPatchItem,
  ToursUpsertBody: () => ToursUpsertBody
});
module.exports = __toCommonJS(tours_exports);

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

// src/tours.ts
var TourStep = import_zod2.z.object({
  id: Id,
  route: import_zod2.z.string().trim().min(1),
  selector: import_zod2.z.string().optional(),
  title: import_zod2.z.string().optional(),
  body: import_zod2.z.string().optional(),
  placement: import_zod2.z.enum(["auto", "top", "bottom", "left", "right"]).default("auto"),
  padding: import_zod2.z.number().int().nonnegative().default(8),
  offsetX: import_zod2.z.number().default(0),
  offsetY: import_zod2.z.number().default(0),
  requireClick: import_zod2.z.boolean().default(false),
  nextOn: import_zod2.z.enum(["auto", "button", "click"]).default("button").optional(),
  advanceWhen: import_zod2.z.string().optional()
});
var TourFlow = import_zod2.z.object({
  id: Id,
  name: import_zod2.z.string().trim().min(1),
  steps: import_zod2.z.array(TourStep),
  updatedAt: TsLike.optional(),
  // <-- core timestamp-like
  version: import_zod2.z.literal(2).default(2),
  active: import_zod2.z.boolean().default(true),
  deleted: import_zod2.z.boolean().default(false),
  meta: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).default({})
  // <-- no optional+default combo
});
var ToursUpsertBody = import_zod2.z.union([TourFlow, import_zod2.z.array(TourFlow)]);
var ToursPatchItem = import_zod2.z.object({
  id: Id,
  data: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).refine((v) => v && Object.keys(v).length > 0, "data must have fields")
});
var ToursPatchBody = import_zod2.z.union([ToursPatchItem, import_zod2.z.array(ToursPatchItem)]);
var ToursDeleteBody = import_zod2.z.union([
  Id,
  Ids,
  import_zod2.z.object({ id: Id }),
  import_zod2.z.object({ ids: Ids })
]);
var ToursGetQuery = import_zod2.z.object({ id: Id });
var ToursListQuery = import_zod2.z.object({
  active: BoolFromLike.optional(),
  // <-- better query semantics, from core
  deleted: BoolFromLike.optional(),
  limit: import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).optional(),
  startAfter: import_zod2.z.string().optional(),
  version: import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).optional()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TourFlow,
  TourStep,
  ToursDeleteBody,
  ToursGetQuery,
  ToursListQuery,
  ToursPatchBody,
  ToursPatchItem,
  ToursUpsertBody
});
