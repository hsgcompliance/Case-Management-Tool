//contracts/src/gdrive.ts
import { z, TsLike, ISO10 } from "./core";

const OptionalParentId = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().min(3).optional());

export const GDriveCustomerFolderIndexQuery = z.object({
  activeParentId: OptionalParentId,
  exitedParentId: OptionalParentId,
});
export type TGDriveCustomerFolderIndexQuery = z.infer<typeof GDriveCustomerFolderIndexQuery>;

const OptionalDriveRef = z.preprocess((value) => {
  if (value == null) return value;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}, z.union([z.string(), z.null()]).optional());

export const GDRIVE_TEMPLATE_TYPES = ["doc", "sheet", "pdf", "folder", "other"] as const;
export type TGDriveTemplateType = typeof GDRIVE_TEMPLATE_TYPES[number];

// Payer/non-payer file pair for templates whose source file depends on the
// customer's Medicaid status (e.g. the TSS workbook). When present, the build
// flow resolves `fileId` from these based on the Medicaid toggle and `fileId`
// on the template itself may be empty.
export type TGDriveTemplateVariants = {
  payer: string;
  nonpayer: string;
};

export type TGDriveTemplate = {
  key: string;
  /** May be empty when `variants` supplies the source file ids. */
  fileId: string;
  fileUrl?: string;
  type: TGDriveTemplateType;
  alias: string;
  description?: string;
  defaultChecked?: boolean;
  variants?: TGDriveTemplateVariants;
  /**
   * Build role for the copied file. "tssWorkbook" flags the template whose copy
   * is auto-linked as the customer's TSS workbook on build. Explicit and stored,
   * so it no longer relies on the template key matching "tss_workbook".
   */
  role?: string;
};

export type TGDriveBuildSettings = {
  defaultSubfolders?: string[];
  defaultTemplateKeys?: string[];
};

const GDriveTemplateVariantsSchema = z.object({
  payer: z.string().max(300).default(""),
  nonpayer: z.string().max(300).default(""),
});

const GDriveTemplateSchema = z
  .object({
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
    role: z.string().max(40).optional(),
  })
  .refine(
    (t) =>
      t.fileId.trim().length >= 3 ||
      !!(t.variants && (t.variants.payer.trim() || t.variants.nonpayer.trim())),
    { message: "Template requires a fileId or payer/non-payer variant file ids." }
  );

const GDriveBuildSettingsSchema = z.object({
  defaultSubfolders: z.array(z.string().min(1).max(200)).optional(),
  defaultTemplateKeys: z.array(z.string().min(1)).optional(),
});

export const GDriveConfigPatchBody = z.object({
  activeParent: OptionalDriveRef,
  exitedParent: OptionalDriveRef,
  customerIndexSheet: OptionalDriveRef,
  orgId: z.string().trim().min(1).optional(),
  templates: z.array(GDriveTemplateSchema).optional(),
  buildSettings: GDriveBuildSettingsSchema.optional(),
});
export type TGDriveConfigPatchBody = z.infer<typeof GDriveConfigPatchBody>;

export type TGDriveCustomerFolderIndexConfig = {
  activeParentId?: string;
  activeParentUrl?: string;
  exitedParentId?: string;
  exitedParentUrl?: string;
  sheetId?: string;
  sheetUrl?: string;
};

export type TGDriveOrgConfig = {
  customerFolderIndex: TGDriveCustomerFolderIndexConfig;
  templates?: TGDriveTemplate[];
  buildSettings?: TGDriveBuildSettings;
};

export type TCustomerFolder = {
  id: string;
  name: string;
  url: string;
  createdTime: string | null;
  status: "active" | "exited";
  last: string | null;
  first: string | null;
  cwid: string | null;
};

export const GDriveListQuery = z.object({
  folderId: z.string().trim().optional(), // falls back to sandbox (if set)
});

export const GDriveCreateFolderBody = z.object({
  parentId: z.string().min(3),
  name: z.string().min(1).max(255),
});

export const GDriveUploadBody = z.object({
  parentId: z.string().min(3),
  name: z.string().min(1).max(255),
  contentBase64: z.string().min(10),
  mimeType: z.string().min(3).optional().default("application/pdf"),
});

export type TGDriveListQuery = z.infer<typeof GDriveListQuery>;
export type TGDriveCreateFolderBody = z.infer<typeof GDriveCreateFolderBody>;
export type TGDriveUploadBody = z.infer<typeof GDriveUploadBody>;

export const GDriveBuildCustomerFolderBody = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().min(3),
  templates: z
    .array(z.object({
      fileId: z.string().min(3),
      name: z.string().min(1).max(255),
      // "tssWorkbook" flags the TSS workbook template so the build can return
      // the created file for auto-linking as the customer's workbook.
      role: z.string().max(40).optional(),
    }))
    .optional()
    .default([]),
  subfolders: z.array(z.string().min(1).max(255)).optional().default([]),
});
export type TGDriveBuildCustomerFolderBody = z.infer<typeof GDriveBuildCustomerFolderBody>;

export const GDriveCopyGrantTemplatesBody = z.object({
  customerId: z.string().trim().min(1),
  grantId: z.string().trim().min(1),
  enrollmentId: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  templateKeys: z.array(z.string().trim().min(1)).optional(),
  createCustomerFolderIfMissing: z.boolean().optional().default(false),
  parentId: z.string().trim().min(3).optional(),
});
export type TGDriveCopyGrantTemplatesBody = z.infer<typeof GDriveCopyGrantTemplatesBody>;

export type TGDriveCustomerFolderBuildWarning = {
  phase: "template" | "subfolder";
  name: string;
  fileId?: string;
  error: string;
};

export type TGDriveGrantTemplateCopyResult = {
  folder: {
    id: string;
    name: string;
    url: string;
  };
  copied: Array<{
    key: string;
    name: string;
    fileId: string;
    url?: string;
  }>;
  warnings?: TGDriveCustomerFolderBuildWarning[];
};

export const GDriveCustomerFolderSyncBody = z.object({
  mode: z.enum(["setFolderState", "reconcile", "folderCwIdFromCustomer", "customerCwIdFromFolder"]),
  customerId: z.string().trim().optional(),
  folderId: z.string().trim().optional(),
  active: z.boolean().optional(),
  direction: z.enum(["customer_to_folder", "folder_to_customer"]).optional(),
  apply: z.boolean().optional().default(false),
  onlyLinked: z.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(500).optional().default(250),
});
export type TGDriveCustomerFolderSyncBody = z.infer<typeof GDriveCustomerFolderSyncBody>;

export type TGDriveSyncReconcileItem = {
  customerId: string;
  customerName: string;
  customerActive: boolean;
  folderId: string;
  folderName: string;
  folderStatus: "active" | "exited";
  matchScore: number;
  linked: boolean;
  reasons: string[];
  targetCustomerActive: boolean;
  targetFolderStatus: "ACTIVE" | "EXITED";
};
