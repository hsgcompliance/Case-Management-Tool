import {
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

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
var OptionalParentId = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : void 0;
}, z.string().min(3).optional());
var GDriveCustomerFolderIndexQuery = z.object({
  activeParentId: OptionalParentId,
  exitedParentId: OptionalParentId
});
var OptionalDriveRef = z.preprocess((value) => {
  if (value == null) return value;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}, z.union([z.string(), z.null()]).optional());
var GDRIVE_TEMPLATE_TYPES = ["doc", "sheet", "pdf", "folder", "other"];
var GDriveTemplateVariantsSchema = z.object({
  payer: z.string().max(300).default(""),
  nonpayer: z.string().max(300).default("")
});
var GDriveTemplateSchema = z.object({
  key: z.string().min(1).max(100),
  // Relaxed from min(1): a variant-only template (e.g. TSS payer/non-payer)
  // carries its source ids in `variants` and may leave `fileId` empty.
  fileId: z.string().max(300).default(""),
  fileUrl: z.string().max(500).optional(),
  type: z.enum(GDRIVE_TEMPLATE_TYPES),
  alias: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  defaultChecked: z.boolean().optional(),
  variants: GDriveTemplateVariantsSchema.optional(),
  role: z.string().max(40).optional()
}).refine(
  (t) => t.fileId.trim().length >= 3 || !!(t.variants && (t.variants.payer.trim() || t.variants.nonpayer.trim())),
  { message: "Template requires a fileId or payer/non-payer variant file ids." }
);
var GDriveBuildSettingsSchema = z.object({
  defaultSubfolders: z.array(z.string().min(1).max(200)).optional(),
  defaultTemplateKeys: z.array(z.string().min(1)).optional()
});
var GDriveConfigPatchBody = z.object({
  activeParent: OptionalDriveRef,
  exitedParent: OptionalDriveRef,
  customerIndexSheet: OptionalDriveRef,
  orgId: z.string().trim().min(1).optional(),
  templates: z.array(GDriveTemplateSchema).optional(),
  buildSettings: GDriveBuildSettingsSchema.optional()
});
var GDriveListQuery = z.object({
  folderId: z.string().trim().optional()
  // falls back to sandbox (if set)
});
var GDriveCreateFolderBody = z.object({
  parentId: z.string().min(3),
  name: z.string().min(1).max(255)
});
var GDriveUploadBody = z.object({
  parentId: z.string().min(3),
  name: z.string().min(1).max(255),
  contentBase64: z.string().min(10),
  mimeType: z.string().min(3).optional().default("application/pdf")
});
var GDriveBuildCustomerFolderBody = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().min(3),
  templates: z.array(z.object({
    fileId: z.string().min(3),
    name: z.string().min(1).max(255),
    // "tssWorkbook" flags the TSS workbook template so the build can return
    // the created file for auto-linking as the customer's workbook.
    role: z.string().max(40).optional()
  })).optional().default([]),
  subfolders: z.array(z.string().min(1).max(255)).optional().default([]),
  customerId: z.string().trim().min(1).optional(),
  // Payer/non-payer variant of the TSS workbook template being copied. Written
  // onto the auto-linked workbook metadata (AI case-note eligibility gate).
  workbookVariant: z.enum(["payer", "nonpayer"]).optional()
});
var GDriveCopyGrantTemplatesBody = z.object({
  customerId: z.string().trim().min(1),
  grantId: z.string().trim().min(1),
  enrollmentId: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  templateKeys: z.array(z.string().trim().min(1)).optional(),
  createCustomerFolderIfMissing: z.boolean().optional().default(false),
  parentId: z.string().trim().min(3).optional()
});
var GDriveCustomerFolderSyncBody = z.object({
  mode: z.enum(["setFolderState", "reconcile", "folderCwIdFromCustomer", "customerCwIdFromFolder"]),
  customerId: z.string().trim().optional(),
  folderId: z.string().trim().optional(),
  active: z.boolean().optional(),
  direction: z.enum(["customer_to_folder", "folder_to_customer"]).optional(),
  apply: z.boolean().optional().default(false),
  onlyLinked: z.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(500).optional().default(250)
});

export {
  GDriveCustomerFolderIndexQuery,
  GDRIVE_TEMPLATE_TYPES,
  GDriveConfigPatchBody,
  GDriveListQuery,
  GDriveCreateFolderBody,
  GDriveUploadBody,
  GDriveBuildCustomerFolderBody,
  GDriveCopyGrantTemplatesBody,
  GDriveCustomerFolderSyncBody,
  gdrive_exports
};
