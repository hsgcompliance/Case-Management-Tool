import { getAuthed, postAuthed } from "./authedApi";
import type { CustomerDetail } from "./customerDetailApi";
import type { FormsCustomer } from "./customersApi";

export type DriveFolderIndexEntry = {
  id: string;
  name: string;
  url: string;
  first: string | null;
  last: string | null;
  cwid: string | null;
  status: "active" | "exited";
  tssWorkbookId?: string | null;
  tssWorkbookUrl?: string | null;
  tssWorkbookName?: string | null;
};

type DriveTemplate = {
  key: string;
  fileId: string;
  alias: string;
  defaultChecked?: boolean;
  role?: string;
  variants?: { payer: string; nonpayer: string };
};

export type FormsDriveConfig = {
  customerFolderIndex: {
    activeParentId?: string;
    activeParentUrl?: string;
    sheetId?: string;
    sheetUrl?: string;
  };
  templates?: DriveTemplate[];
  buildSettings?: {
    defaultTemplateKeys?: string[];
    defaultSubfolders?: string[];
  };
};

let sharedInputs: Promise<{ config: FormsDriveConfig; folders: DriveFolderIndexEntry[] }> | null = null;

export function loadDriveReadinessInputs(force = false) {
  if (!sharedInputs || force) {
    sharedInputs = Promise.all([
      getAuthed<{ ok: true; config: FormsDriveConfig }>("gdriveConfigGet"),
      getAuthed<{ ok: true; folders: DriveFolderIndexEntry[] }>("gdriveCustomerFolderIndex"),
    ]).then(([configResp, indexResp]) => ({
      config: configResp.config,
      folders: indexResp.folders ?? [],
    }));
  }
  return sharedInputs;
}

const normalized = (value: unknown) =>
  String(value ?? "").trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");

function nameParts(customer: FormsCustomer, detail: CustomerDetail | null) {
  if (detail?.firstName && detail.lastName) {
    return { first: detail.firstName, last: detail.lastName };
  }
  const parts = customer.name.trim().split(/\s+/);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

export function matchingFolders(
  customer: FormsCustomer,
  detail: CustomerDetail | null,
  folders: DriveFolderIndexEntry[],
): DriveFolderIndexEntry[] {
  const { first, last } = nameParts(customer, detail);
  const cwid = normalized(detail?.cwId || customer.cwId);
  return folders.filter((folder) => {
    if (folder.status !== "active") return false;
    if (cwid && normalized(folder.cwid) === cwid) return true;
    return normalized(folder.first) === normalized(first) && normalized(folder.last) === normalized(last);
  });
}

export function duplicateCustomers(
  customer: FormsCustomer,
  detail: CustomerDetail | null,
  customers: FormsCustomer[],
): FormsCustomer[] {
  const cwid = normalized(detail?.cwId || customer.cwId);
  const name = normalized(detail?.name || customer.name);
  const dob = normalized(detail?.dob || customer.dob);
  return customers.filter((candidate) => {
    if (candidate.id === customer.id) return false;
    if (cwid && normalized(candidate.cwId) === cwid) return true;
    return name && dob && normalized(candidate.name) === name && normalized(candidate.dob) === dob;
  });
}

export async function linkIndexedFolder(
  customerId: string,
  folder: DriveFolderIndexEntry,
  variant: "payer" | "nonpayer",
) {
  await postAuthed("customerFolderLink", {
    customerId,
    folderId: folder.id,
    folderUrl: folder.url,
    folderName: folder.name,
  });
  if (folder.tssWorkbookId) {
    await postAuthed("attachCustomerWorkbookCandidate", {
      customerId,
      spreadsheetId: folder.tssWorkbookId,
      spreadsheetName: folder.tssWorkbookName || undefined,
      variant,
    });
  }
}

export async function attachIndexedWorkbook(
  customerId: string,
  folder: DriveFolderIndexEntry,
  variant: "payer" | "nonpayer",
) {
  if (!folder.tssWorkbookId) throw new Error("indexed_workbook_missing");
  await postAuthed("attachCustomerWorkbookCandidate", {
    customerId,
    spreadsheetId: folder.tssWorkbookId,
    spreadsheetName: folder.tssWorkbookName || undefined,
    variant,
  });
}

export async function buildCustomerFolder(
  customer: FormsCustomer,
  detail: CustomerDetail | null,
  config: FormsDriveConfig,
  variant: "payer" | "nonpayer",
) {
  const parentId = String(config.customerFolderIndex.activeParentId || "").trim();
  if (!parentId) throw new Error("No active customer-folder location is configured.");
  const { first, last } = nameParts(customer, detail);
  const defaultKeys = config.buildSettings?.defaultTemplateKeys;
  const templates = (config.templates ?? []).flatMap((template) => {
    const selected = defaultKeys?.length ? defaultKeys.includes(template.key) : !!template.defaultChecked;
    if (!selected) return [];
    const fileId = String(template.variants?.[variant] || template.fileId || "").trim();
    if (!fileId) return [];
    const suffix = template.variants && variant === "nonpayer" ? " (non-Payer)" : "";
    return [{
      fileId,
      name: `${last}, ${first} ${template.alias}${suffix}`.replace(/\s{2,}/g, " ").trim(),
      ...(template.role || template.key === "tss_workbook"
        ? { role: template.role || "tssWorkbook" }
        : {}),
    }];
  });
  return postAuthed("gdriveBuildCustomerFolder", {
    customerId: customer.id,
    name: `${last}, ${first}${customer.cwId ? `_${customer.cwId}` : ""}`,
    parentId,
    templates,
    subfolders: config.buildSettings?.defaultSubfolders ?? [],
    workbookVariant: variant,
  });
}

export function createTssWorkbook(customerId: string, variant: "payer" | "nonpayer") {
  return postAuthed("copyCustomerWorkbookFromTemplate", { customerId, variant });
}
