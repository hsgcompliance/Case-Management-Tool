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
  const meta = record.meta && typeof record.meta === "object"
    ? (record.meta as Record<string, unknown>)
    : {};
  const folders = [
    ...(Array.isArray(meta.driveFolders) ? (meta.driveFolders as DriveFolderLike[]) : []),
    ...(Array.isArray(record.driveFolders) ? (record.driveFolders as DriveFolderLike[]) : []),
  ];
  // Card/list display still favors the legacy folder list because it can carry
  // alias/name labels. New resolver work should align to the Google integrations
  // order: customerDrive.folderId -> meta.driveFolderId -> meta.driveFolders[0].id.
  const folder = folders.find((item) => folderUrl(item?.url) || folderUrl(item?.id));
  const url =
    folderUrl(folder?.url) ||
    folderUrl(folder?.id) ||
    folderUrl(meta.driveFolderId) ||
    folderUrl(record.driveFolderId);

  if (!url) return null;
  const label =
    String(folder?.alias || folder?.name || "").trim() ||
    "Open Google Drive folder";
  return { url, label };
}
