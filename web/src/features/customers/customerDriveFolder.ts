type DriveFolderLike = {
  id?: unknown;
  url?: unknown;
  name?: unknown;
  alias?: unknown;
};

const DRIVE_FOLDER_ID_RE = /^[-\w]{20,}$/;

function parseDriveFolderId(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "";
  const byFolders = text.match(/\/folders\/([-\w]{20,})/i)?.[1];
  if (byFolders) return byFolders;
  const byQuery = text.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byQuery) return byQuery;
  return DRIVE_FOLDER_ID_RE.test(text) ? text : "";
}

function folderUrl(idOrUrl: unknown): string {
  const text = String(idOrUrl || "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  const id = parseDriveFolderId(text);
  return id ? `https://drive.google.com/drive/folders/${id}` : "";
}

export function getCustomerDriveFolderLink(customer: unknown): { url: string; label: string } | null {
  if (!customer || typeof customer !== "object") return null;
  const record = customer as Record<string, unknown>;
  const customerDrive = record.customerDrive && typeof record.customerDrive === "object"
    ? (record.customerDrive as Record<string, unknown>)
    : {};
  const meta = record.meta && typeof record.meta === "object"
    ? (record.meta as Record<string, unknown>)
    : {};
  const folders = [
    ...(Array.isArray(meta.driveFolders) ? (meta.driveFolders as DriveFolderLike[]) : []),
    ...(Array.isArray(record.driveFolders) ? (record.driveFolders as DriveFolderLike[]) : []),
  ];
  const folder = folders.find((item) => folderUrl(item?.url) || folderUrl(item?.id));
  const url =
    folderUrl(customerDrive.folderUrl) ||
    folderUrl(customerDrive.folderId) ||
    folderUrl(meta.driveFolderId) ||
    folderUrl(folder?.url) ||
    folderUrl(folder?.id) ||
    folderUrl(record.driveFolderId);

  if (!url) return null;
  const label =
    String(customerDrive.folderAlias || customerDrive.folderName || "").trim() ||
    String(folder?.alias || folder?.name || "").trim() ||
    "Open Google Drive folder";
  return { url, label };
}

export type CustomerWorkbookRef = {
  spreadsheetId: string;
  name: string;
  url: string;
  gid?: string | number | null;
};

/**
 * Resolve the customer's linked TSS workbook (if any) for card/list affordances.
 * Returns null when no workbook is linked — callers should only render a
 * "Workbook" action when this is non-null.
 */
export function getCustomerWorkbookRef(customer: unknown): CustomerWorkbookRef | null {
  if (!customer || typeof customer !== "object") return null;
  const record = customer as Record<string, unknown>;
  const cDrive = record.customerDrive && typeof record.customerDrive === "object"
    ? (record.customerDrive as Record<string, unknown>)
    : {};
  const linked = cDrive.linkedWorkbooks && typeof cDrive.linkedWorkbooks === "object"
    ? (cDrive.linkedWorkbooks as Record<string, unknown>)
    : {};
  const tss = linked.tss && typeof linked.tss === "object"
    ? (linked.tss as Record<string, unknown>)
    : null;
  if (!tss) return null;

  const spreadsheetId = String(tss.spreadsheetId || "").trim();
  if (!spreadsheetId) return null;

  return {
    spreadsheetId,
    name: String(tss.spreadsheetName || "").trim() || "Customer Workbook",
    url: String(tss.spreadsheetUrl || "").trim() || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    gid: (tss.progressNotesGid ?? tss.defaultSheetGid) as string | number | null | undefined,
  };
}
