import { z } from "./core.js";
export declare const GDriveCustomerFolderIndexQuery: z.ZodObject<{
    activeParentId: z.ZodPreprocess<z.ZodOptional<z.ZodString>>;
    exitedParentId: z.ZodPreprocess<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type TGDriveCustomerFolderIndexQuery = z.infer<typeof GDriveCustomerFolderIndexQuery>;
export declare const GDRIVE_TEMPLATE_TYPES: readonly ["doc", "sheet", "pdf", "folder", "other"];
export type TGDriveTemplateType = typeof GDRIVE_TEMPLATE_TYPES[number];
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
export declare const GDriveConfigPatchBody: z.ZodObject<{
    activeParent: z.ZodPreprocess<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>>;
    exitedParent: z.ZodPreprocess<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>>;
    customerIndexSheet: z.ZodPreprocess<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>>;
    orgId: z.ZodOptional<z.ZodString>;
    templates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        fileId: z.ZodDefault<z.ZodString>;
        fileUrl: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            other: "other";
            doc: "doc";
            sheet: "sheet";
            pdf: "pdf";
            folder: "folder";
        }>;
        alias: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        defaultChecked: z.ZodOptional<z.ZodBoolean>;
        variants: z.ZodOptional<z.ZodObject<{
            payer: z.ZodDefault<z.ZodString>;
            nonpayer: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        role: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    buildSettings: z.ZodOptional<z.ZodObject<{
        defaultSubfolders: z.ZodOptional<z.ZodArray<z.ZodString>>;
        defaultTemplateKeys: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
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
    tssWorkbookId?: string | null;
    tssWorkbookUrl?: string | null;
    tssWorkbookName?: string | null;
};
export declare const GDriveListQuery: z.ZodObject<{
    folderId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const GDriveCreateFolderBody: z.ZodObject<{
    parentId: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
export declare const GDriveUploadBody: z.ZodObject<{
    parentId: z.ZodString;
    name: z.ZodString;
    contentBase64: z.ZodString;
    mimeType: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type TGDriveListQuery = z.infer<typeof GDriveListQuery>;
export type TGDriveCreateFolderBody = z.infer<typeof GDriveCreateFolderBody>;
export type TGDriveUploadBody = z.infer<typeof GDriveUploadBody>;
export declare const GDriveBuildCustomerFolderBody: z.ZodObject<{
    name: z.ZodString;
    parentId: z.ZodString;
    templates: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        fileId: z.ZodString;
        name: z.ZodString;
        role: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
    subfolders: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    customerId: z.ZodOptional<z.ZodString>;
    workbookVariant: z.ZodOptional<z.ZodEnum<{
        payer: "payer";
        nonpayer: "nonpayer";
    }>>;
}, z.core.$strip>;
export type TGDriveBuildCustomerFolderBody = z.infer<typeof GDriveBuildCustomerFolderBody>;
export declare const GDriveCopyGrantTemplatesBody: z.ZodObject<{
    customerId: z.ZodString;
    grantId: z.ZodString;
    enrollmentId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    templateKeys: z.ZodOptional<z.ZodArray<z.ZodString>>;
    createCustomerFolderIfMissing: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    parentId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
export declare const GDriveCustomerFolderSyncBody: z.ZodObject<{
    mode: z.ZodEnum<{
        setFolderState: "setFolderState";
        reconcile: "reconcile";
        folderCwIdFromCustomer: "folderCwIdFromCustomer";
        customerCwIdFromFolder: "customerCwIdFromFolder";
    }>;
    customerId: z.ZodOptional<z.ZodString>;
    folderId: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodBoolean>;
    direction: z.ZodOptional<z.ZodEnum<{
        customer_to_folder: "customer_to_folder";
        folder_to_customer: "folder_to_customer";
    }>>;
    apply: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    onlyLinked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
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
