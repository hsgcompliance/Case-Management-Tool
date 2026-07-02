// functions/src/features/gdrive/schemas.ts
import type { gdrive as GDriveNS } from "@hdb/contracts";
import { z, gdrive as C } from "@hdb/contracts";

export const GDriveListQuery = C.GDriveListQuery;
export const GDriveCreateFolderBody = C.GDriveCreateFolderBody;
export const GDriveUploadBody = C.GDriveUploadBody;
export const GDriveCopyGrantTemplatesBody = C.GDriveCopyGrantTemplatesBody;

export type TGDriveListQuery = GDriveNS.TGDriveListQuery;
export type TGDriveCreateFolderBody = GDriveNS.TGDriveCreateFolderBody;
export type TGDriveUploadBody = GDriveNS.TGDriveUploadBody;
export type TGDriveCopyGrantTemplatesBody = GDriveNS.TGDriveCopyGrantTemplatesBody;

// Defined locally (not yet in compiled vendor) — keep in sync with contracts/src/gdrive.ts.
// `role` must be preserved: service.buildCustomerFolder keys the TSS workbook
// auto-link off `role === "tssWorkbook"`, so dropping it silently breaks workbook
// linking (incl. the Medicaid payer/non-payer variants).
export const GDriveBuildCustomerFolderBody = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().min(3),
  templates: z
    .array(
      z.object({
        fileId: z.string().min(3),
        name: z.string().min(1).max(255),
        role: z.string().max(40).optional(),
      }),
    )
    .optional()
    .default([]),
  subfolders: z.array(z.string().min(1).max(255)).optional().default([]),
  // When present, the built folder is linked to this customer (folder ref +
  // auto-linked TSS workbook) and upserted into the cached index, atomically.
  customerId: z.string().min(1).optional(),
  // Payer/non-payer variant of the TSS workbook template being copied. Written
  // onto the auto-linked workbook metadata so AI case-note eligibility is
  // correct without a follow-up client call.
  workbookVariant: z.enum(["payer", "nonpayer"]).optional(),
});
