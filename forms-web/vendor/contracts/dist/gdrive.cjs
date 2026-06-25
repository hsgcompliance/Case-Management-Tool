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

// src/gdrive.ts
var gdrive_exports = {};
__export(gdrive_exports, {
  GDRIVE_TEMPLATE_TYPES: () => GDRIVE_TEMPLATE_TYPES,
  GDriveBuildCustomerFolderBody: () => GDriveBuildCustomerFolderBody,
  GDriveConfigPatchBody: () => GDriveConfigPatchBody,
  GDriveCopyGrantTemplatesBody: () => GDriveCopyGrantTemplatesBody,
  GDriveCreateFolderBody: () => GDriveCreateFolderBody,
  GDriveCustomerFolderIndexQuery: () => GDriveCustomerFolderIndexQuery,
  GDriveCustomerFolderSyncBody: () => GDriveCustomerFolderSyncBody,
  GDriveListQuery: () => GDriveListQuery,
  GDriveUploadBody: () => GDriveUploadBody
});
module.exports = __toCommonJS(gdrive_exports);

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

// src/gdrive.ts
var OptionalParentId = import_zod2.z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : void 0;
}, import_zod2.z.string().min(3).optional());
var GDriveCustomerFolderIndexQuery = import_zod2.z.object({
  activeParentId: OptionalParentId,
  exitedParentId: OptionalParentId
});
var OptionalDriveRef = import_zod2.z.preprocess((value) => {
  if (value == null) return value;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}, import_zod2.z.union([import_zod2.z.string(), import_zod2.z.null()]).optional());
var GDRIVE_TEMPLATE_TYPES = ["doc", "sheet", "pdf", "folder", "other"];
var GDriveTemplateVariantsSchema = import_zod2.z.object({
  payer: import_zod2.z.string().max(300).default(""),
  nonpayer: import_zod2.z.string().max(300).default("")
});
var GDriveTemplateSchema = import_zod2.z.object({
  key: import_zod2.z.string().min(1).max(100),
  // Relaxed from min(1): a variant-only template (e.g. TSS payer/non-payer)
  // carries its source ids in `variants` and may leave `fileId` empty.
  fileId: import_zod2.z.string().max(300).default(""),
  fileUrl: import_zod2.z.string().max(500).optional(),
  type: import_zod2.z.enum(GDRIVE_TEMPLATE_TYPES),
  alias: import_zod2.z.string().min(1).max(200),
  description: import_zod2.z.string().max(500).optional(),
  defaultChecked: import_zod2.z.boolean().optional(),
  variants: GDriveTemplateVariantsSchema.optional(),
  role: import_zod2.z.string().max(40).optional()
}).refine(
  (t) => t.fileId.trim().length >= 3 || !!(t.variants && (t.variants.payer.trim() || t.variants.nonpayer.trim())),
  { message: "Template requires a fileId or payer/non-payer variant file ids." }
);
var GDriveBuildSettingsSchema = import_zod2.z.object({
  defaultSubfolders: import_zod2.z.array(import_zod2.z.string().min(1).max(200)).optional(),
  defaultTemplateKeys: import_zod2.z.array(import_zod2.z.string().min(1)).optional()
});
var GDriveConfigPatchBody = import_zod2.z.object({
  activeParent: OptionalDriveRef,
  exitedParent: OptionalDriveRef,
  customerIndexSheet: OptionalDriveRef,
  orgId: import_zod2.z.string().trim().min(1).optional(),
  templates: import_zod2.z.array(GDriveTemplateSchema).optional(),
  buildSettings: GDriveBuildSettingsSchema.optional()
});
var GDriveListQuery = import_zod2.z.object({
  folderId: import_zod2.z.string().trim().optional()
  // falls back to sandbox (if set)
});
var GDriveCreateFolderBody = import_zod2.z.object({
  parentId: import_zod2.z.string().min(3),
  name: import_zod2.z.string().min(1).max(255)
});
var GDriveUploadBody = import_zod2.z.object({
  parentId: import_zod2.z.string().min(3),
  name: import_zod2.z.string().min(1).max(255),
  contentBase64: import_zod2.z.string().min(10),
  mimeType: import_zod2.z.string().min(3).optional().default("application/pdf")
});
var GDriveBuildCustomerFolderBody = import_zod2.z.object({
  name: import_zod2.z.string().min(1).max(255),
  parentId: import_zod2.z.string().min(3),
  templates: import_zod2.z.array(import_zod2.z.object({
    fileId: import_zod2.z.string().min(3),
    name: import_zod2.z.string().min(1).max(255),
    // "tssWorkbook" flags the TSS workbook template so the build can return
    // the created file for auto-linking as the customer's workbook.
    role: import_zod2.z.string().max(40).optional()
  })).optional().default([]),
  subfolders: import_zod2.z.array(import_zod2.z.string().min(1).max(255)).optional().default([]),
  customerId: import_zod2.z.string().trim().min(1).optional()
});
var GDriveCopyGrantTemplatesBody = import_zod2.z.object({
  customerId: import_zod2.z.string().trim().min(1),
  grantId: import_zod2.z.string().trim().min(1),
  enrollmentId: import_zod2.z.string().trim().optional(),
  startDate: import_zod2.z.string().trim().optional(),
  templateKeys: import_zod2.z.array(import_zod2.z.string().trim().min(1)).optional(),
  createCustomerFolderIfMissing: import_zod2.z.boolean().optional().default(false),
  parentId: import_zod2.z.string().trim().min(3).optional()
});
var GDriveCustomerFolderSyncBody = import_zod2.z.object({
  mode: import_zod2.z.enum(["setFolderState", "reconcile", "folderCwIdFromCustomer", "customerCwIdFromFolder"]),
  customerId: import_zod2.z.string().trim().optional(),
  folderId: import_zod2.z.string().trim().optional(),
  active: import_zod2.z.boolean().optional(),
  direction: import_zod2.z.enum(["customer_to_folder", "folder_to_customer"]).optional(),
  apply: import_zod2.z.boolean().optional().default(false),
  onlyLinked: import_zod2.z.boolean().optional().default(false),
  limit: import_zod2.z.coerce.number().int().min(1).max(500).optional().default(250)
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GDRIVE_TEMPLATE_TYPES,
  GDriveBuildCustomerFolderBody,
  GDriveConfigPatchBody,
  GDriveCopyGrantTemplatesBody,
  GDriveCreateFolderBody,
  GDriveCustomerFolderIndexQuery,
  GDriveCustomerFolderSyncBody,
  GDriveListQuery,
  GDriveUploadBody
});
