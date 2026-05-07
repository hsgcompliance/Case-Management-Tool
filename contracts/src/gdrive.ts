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

export type TGDriveTemplate = {
  key: string;
  fileId: string;
  fileUrl?: string;
  type: TGDriveTemplateType;
  alias: string;
  description?: string;
  defaultChecked?: boolean;
};

export type TGDriveBuildSettings = {
  defaultSubfolders?: string[];
  defaultTemplateKeys?: string[];
};

const GDriveTemplateSchema = z.object({
  key: z.string().min(1).max(100),
  fileId: z.string().min(1).max(300),
  fileUrl: z.string().max(500).optional(),
  type: z.enum(GDRIVE_TEMPLATE_TYPES),
  alias: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  defaultChecked: z.boolean().optional(),
});

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
    .array(z.object({ fileId: z.string().min(3), name: z.string().min(1).max(255) }))
    .optional()
    .default([]),
  subfolders: z.array(z.string().min(1).max(255)).optional().default([]),
});
export type TGDriveBuildCustomerFolderBody = z.infer<typeof GDriveBuildCustomerFolderBody>;

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
