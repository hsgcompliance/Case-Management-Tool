// functions/src/features/gdrive/schemas.ts
import type { gdrive as GDriveNS } from "@hdb/contracts";
import { z, gdrive as C } from "@hdb/contracts";

export const GDriveListQuery = C.GDriveListQuery;
export const GDriveCreateFolderBody = C.GDriveCreateFolderBody;
export const GDriveUploadBody = C.GDriveUploadBody;

export type TGDriveListQuery = GDriveNS.TGDriveListQuery;
export type TGDriveCreateFolderBody = GDriveNS.TGDriveCreateFolderBody;
export type TGDriveUploadBody = GDriveNS.TGDriveUploadBody;

// Defined locally (not yet in compiled vendor) — keep in sync with contracts/src/gdrive.ts
export const GDriveBuildCustomerFolderBody = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().min(3),
  templates: z
    .array(z.object({ fileId: z.string().min(3), name: z.string().min(1).max(255) }))
    .optional()
    .default([]),
  subfolders: z.array(z.string().min(1).max(255)).optional().default([]),
});
