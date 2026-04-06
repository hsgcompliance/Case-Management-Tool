//contracts/src/gdrive.ts
import { z, TsLike, ISO10 } from "./core";

export const GDriveCustomerFolderIndexQuery = z.object({
  activeParentId: z.string().min(3).optional(),
  exitedParentId: z.string().min(3).optional(),
});
export type TGDriveCustomerFolderIndexQuery = z.infer<typeof GDriveCustomerFolderIndexQuery>;

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
