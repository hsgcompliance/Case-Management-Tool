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

// src/grantBudgetManager.ts
var grantBudgetManager_exports = {};
__export(grantBudgetManager_exports, {
  GrantBudgetManagerLineItem: () => GrantBudgetManagerLineItem,
  GrantBudgetManagerLoadBody: () => GrantBudgetManagerLoadBody,
  GrantBudgetManagerOriginal: () => GrantBudgetManagerOriginal,
  GrantBudgetManagerReconcileBody: () => GrantBudgetManagerReconcileBody,
  GrantBudgetManagerRollup: () => GrantBudgetManagerRollup,
  GrantBudgetManagerRow: () => GrantBudgetManagerRow,
  GrantBudgetManagerSaveBody: () => GrantBudgetManagerSaveBody,
  GrantBudgetManagerSaveMode: () => GrantBudgetManagerSaveMode,
  GrantBudgetManagerSourceType: () => GrantBudgetManagerSourceType
});
module.exports = __toCommonJS(grantBudgetManager_exports);

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

// src/grantBudgetManager.ts
var GrantBudgetManagerSourceType = import_zod2.z.enum(["ledger", "paymentQueue", "newProjection"]);
var GrantBudgetManagerSaveMode = import_zod2.z.enum(["preview", "applyOpen", "applyAll"]);
var GrantBudgetManagerOriginal = import_zod2.z.object({
  grantId: import_zod2.z.string().nullable().optional(),
  lineItemId: import_zod2.z.string().nullable().optional(),
  customerId: import_zod2.z.string().nullable().optional(),
  caseManagerId: import_zod2.z.string().nullable().optional(),
  amount: import_zod2.z.number().nullable().optional(),
  date: import_zod2.z.string().nullable().optional(),
  serviceDate: import_zod2.z.string().nullable().optional(),
  paymentDate: import_zod2.z.string().nullable().optional(),
  description: import_zod2.z.string().nullable().optional(),
  memo: import_zod2.z.string().nullable().optional(),
  category: import_zod2.z.string().nullable().optional(),
  vendor: import_zod2.z.string().nullable().optional(),
  status: import_zod2.z.string().nullable().optional(),
  updatedAt: import_zod2.z.string().nullable().optional()
}).passthrough();
var GrantBudgetManagerRow = import_zod2.z.object({
  rowId: import_zod2.z.string().min(1),
  sourceType: GrantBudgetManagerSourceType,
  sourceId: import_zod2.z.string().optional().default(""),
  ledgerItemId: import_zod2.z.string().nullable().optional(),
  paymentQueueItemId: import_zod2.z.string().nullable().optional(),
  grantId: import_zod2.z.string().min(1),
  lineItemId: import_zod2.z.string().nullable().optional(),
  customerId: import_zod2.z.string().nullable().optional(),
  customerName: import_zod2.z.string().nullable().optional(),
  caseManagerId: import_zod2.z.string().nullable().optional(),
  caseManagerName: import_zod2.z.string().nullable().optional(),
  amount: import_zod2.z.coerce.number(),
  date: import_zod2.z.string().nullable().optional(),
  serviceDate: import_zod2.z.string().nullable().optional(),
  paymentDate: import_zod2.z.string().nullable().optional(),
  description: import_zod2.z.string().nullable().optional(),
  memo: import_zod2.z.string().nullable().optional(),
  category: import_zod2.z.string().nullable().optional(),
  vendor: import_zod2.z.string().nullable().optional(),
  status: import_zod2.z.string().nullable().optional(),
  reversalOf: import_zod2.z.string().nullable().optional(),
  reversedByLedgerItemIds: import_zod2.z.array(import_zod2.z.string()).optional(),
  isWritable: import_zod2.z.boolean().optional().default(false),
  lockedReason: import_zod2.z.string().nullable().optional(),
  rowState: import_zod2.z.enum(["clean", "changed", "new", "deleted"]).optional().default("clean"),
  original: GrantBudgetManagerOriginal.optional()
}).passthrough();
var GrantBudgetManagerLineItem = import_zod2.z.object({
  grantId: import_zod2.z.string(),
  id: import_zod2.z.string(),
  label: import_zod2.z.string(),
  typeLabel: import_zod2.z.string().optional().default(""),
  budget: import_zod2.z.number().optional().default(0),
  locked: import_zod2.z.boolean().optional().default(false)
});
var GrantBudgetManagerRollup = import_zod2.z.object({
  grantId: import_zod2.z.string(),
  lineItemId: import_zod2.z.string().nullable().optional(),
  budget: import_zod2.z.number().default(0),
  spent: import_zod2.z.number().default(0),
  projected: import_zod2.z.number().default(0),
  total: import_zod2.z.number().default(0),
  remaining: import_zod2.z.number().default(0)
});
var GrantBudgetManagerLoadBody = import_zod2.z.object({
  grantIds: import_zod2.z.array(import_zod2.z.string().min(1)).min(1).max(50)
});
var GrantBudgetManagerSaveBody = import_zod2.z.object({
  mode: GrantBudgetManagerSaveMode,
  grantIds: import_zod2.z.array(import_zod2.z.string().min(1)).min(1).max(50),
  rows: import_zod2.z.array(GrantBudgetManagerRow).max(5e3),
  reason: import_zod2.z.string().trim().optional(),
  loadedAt: import_zod2.z.string().trim().optional()
});
var GrantBudgetManagerReconcileBody = import_zod2.z.object({
  grantIds: import_zod2.z.array(import_zod2.z.string().min(1)).min(1).max(50)
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GrantBudgetManagerLineItem,
  GrantBudgetManagerLoadBody,
  GrantBudgetManagerOriginal,
  GrantBudgetManagerReconcileBody,
  GrantBudgetManagerRollup,
  GrantBudgetManagerRow,
  GrantBudgetManagerSaveBody,
  GrantBudgetManagerSaveMode,
  GrantBudgetManagerSourceType
});
