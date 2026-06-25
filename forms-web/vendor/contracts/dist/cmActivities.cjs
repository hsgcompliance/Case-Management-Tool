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

// src/cmActivities.ts
var cmActivities_exports = {};
__export(cmActivities_exports, {
  CmActivitiesListQuery: () => CmActivitiesListQuery,
  CmActivitiesListResp: () => CmActivitiesListResp,
  CmActivity: () => CmActivity,
  CmActivityCreateBody: () => CmActivityCreateBody,
  CmActivityType: () => CmActivityType,
  CmActivityUpdateBody: () => CmActivityUpdateBody
});
module.exports = __toCommonJS(cmActivities_exports);

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

// src/cmActivities.ts
var CmActivityType = import_zod2.z.enum([
  "in-person",
  "phone",
  "data-entry",
  "other"
]);
var CmActivity = import_zod2.z.object({
  id: Id,
  orgId: Id,
  caseManagerId: Id,
  caseManagerName: import_zod2.z.string().trim().optional(),
  customerId: Id,
  customerName: import_zod2.z.string().trim().optional(),
  type: CmActivityType,
  date: ISO10,
  startTime: import_zod2.z.string().trim().optional(),
  // "HH:MM"
  endTime: import_zod2.z.string().trim().optional(),
  // "HH:MM"
  note: import_zod2.z.string().trim().optional(),
  calendarEventId: import_zod2.z.string().trim().optional(),
  calendarSynced: import_zod2.z.boolean().optional(),
  // Set true once the session has been pushed to the customer's TSS workbook as a
  // progress-note row (mirrors calendarSynced). workbookRowKey is the appended
  // row's key returned by appendCustomerWorkbookRow.
  workbookSynced: import_zod2.z.boolean().optional(),
  workbookSyncedAt: import_zod2.z.string().optional(),
  workbookRowKey: import_zod2.z.string().trim().optional(),
  archived: import_zod2.z.boolean().optional(),
  createdAt: import_zod2.z.string(),
  updatedAt: import_zod2.z.string().optional()
});
var CmActivityCreateBody = import_zod2.z.object({
  customerId: Id,
  customerName: import_zod2.z.string().trim().optional(),
  type: CmActivityType,
  date: ISO10,
  startTime: import_zod2.z.string().trim().optional(),
  endTime: import_zod2.z.string().trim().optional(),
  note: import_zod2.z.string().trim().optional(),
  postToCalendar: import_zod2.z.boolean().optional()
});
var CmActivityUpdateBody = import_zod2.z.object({
  type: CmActivityType.optional(),
  date: ISO10.optional(),
  startTime: import_zod2.z.string().trim().optional(),
  endTime: import_zod2.z.string().trim().optional(),
  note: import_zod2.z.string().trim().optional()
});
var CmActivitiesListQuery = import_zod2.z.object({
  month: import_zod2.z.string().optional(),
  // "YYYY-MM"
  customerId: import_zod2.z.string().optional(),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional()
});
var CmActivitiesListResp = import_zod2.z.object({
  items: import_zod2.z.array(CmActivity)
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CmActivitiesListQuery,
  CmActivitiesListResp,
  CmActivity,
  CmActivityCreateBody,
  CmActivityType,
  CmActivityUpdateBody
});
