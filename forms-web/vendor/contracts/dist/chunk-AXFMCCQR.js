// src/core.ts
import { z } from "zod";
import { z as z2 } from "zod";
var Id = z.string().trim().min(1);
var Ids = z.array(Id).min(1);
var IdLike = z.preprocess((v) => {
  if (typeof v === "string" || typeof v === "number") return String(v);
  return v;
}, Id);
var GrantIdsLike = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return v;
}, z.array(Id).min(1));
var TimestampLike = z.union([
  z.string(),
  // ISO
  z.number(),
  // millis
  z.object({ seconds: z.number(), nanoseconds: z.number() })
  // Firestore JSON-ish
]);
var TsLike = TimestampLike;
var ISO10 = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var BoolLike = z.union([
  z.boolean(),
  z.literal("true"),
  z.literal("false"),
  z.literal(1),
  z.literal(0),
  z.literal("1"),
  z.literal("0")
]);
var Boolish = BoolLike;
var BoolFromLike = z.preprocess((v) => {
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
}, z.boolean());
var JsonObj = z.object({}).catchall(z.unknown());
var JsonObjLike = z.preprocess((v) => {
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

export {
  Id,
  Ids,
  IdLike,
  GrantIdsLike,
  TimestampLike,
  TsLike,
  ISO10,
  BoolLike,
  Boolish,
  BoolFromLike,
  JsonObj,
  JsonObjLike,
  toArray,
  z2 as z
};
