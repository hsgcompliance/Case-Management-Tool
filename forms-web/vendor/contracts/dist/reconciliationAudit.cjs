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

// src/reconciliationAudit.ts
var reconciliationAudit_exports = {};
__export(reconciliationAudit_exports, {
  ReconciliationAuditDuplicateFinding: () => ReconciliationAuditDuplicateFinding,
  ReconciliationAuditEnrollmentSummary: () => ReconciliationAuditEnrollmentSummary,
  ReconciliationAuditOrphanFinding: () => ReconciliationAuditOrphanFinding,
  ReconciliationAuditScanBody: () => ReconciliationAuditScanBody
});
module.exports = __toCommonJS(reconciliationAudit_exports);

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

// src/reconciliationAudit.ts
var ReconciliationAuditEnrollmentSummary = import_zod2.z.object({
  id: import_zod2.z.string(),
  status: import_zod2.z.string().nullable().optional(),
  startDate: import_zod2.z.string().nullable().optional(),
  endDate: import_zod2.z.string().nullable().optional(),
  paidCount: import_zod2.z.number().int().nonnegative(),
  paidTotal: import_zod2.z.number(),
  pendingQueueCount: import_zod2.z.number().int().nonnegative()
});
var ReconciliationAuditDuplicateFinding = import_zod2.z.object({
  type: import_zod2.z.literal("duplicate_enrollment_schedule"),
  severity: import_zod2.z.literal("error"),
  customerId: import_zod2.z.string(),
  customerName: import_zod2.z.string().nullable().optional(),
  grantId: import_zod2.z.string(),
  grantName: import_zod2.z.string().nullable().optional(),
  enrollments: import_zod2.z.array(ReconciliationAuditEnrollmentSummary).min(2)
});
var ReconciliationAuditOrphanFinding = import_zod2.z.object({
  type: import_zod2.z.literal("orphaned_ledger_or_queue"),
  severity: import_zod2.z.literal("error"),
  source: import_zod2.z.enum(["ledger", "paymentQueue"]),
  enrollmentId: import_zod2.z.string(),
  enrollmentStatus: import_zod2.z.string().nullable().optional(),
  customerId: import_zod2.z.string().nullable().optional(),
  customerName: import_zod2.z.string().nullable().optional(),
  grantId: import_zod2.z.string().nullable().optional(),
  grantName: import_zod2.z.string().nullable().optional(),
  paymentId: import_zod2.z.string().nullable().optional(),
  netAmount: import_zod2.z.number().nullable().optional(),
  queueStatus: import_zod2.z.string().nullable().optional(),
  rowIds: import_zod2.z.array(import_zod2.z.string())
});
var ReconciliationAuditScanBody = import_zod2.z.object({
  grantIds: import_zod2.z.array(import_zod2.z.string().min(1)).max(50).optional()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ReconciliationAuditDuplicateFinding,
  ReconciliationAuditEnrollmentSummary,
  ReconciliationAuditOrphanFinding,
  ReconciliationAuditScanBody
});
