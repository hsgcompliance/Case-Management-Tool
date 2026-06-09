import type { TGrantDriveTemplate } from "@hdb/contracts";

const DIRECT_ID_RE = /^[-\w]{20,}$/;

export function parseDriveFileId(input: unknown): string {
  const text = String(input || "").trim();
  if (!text) return "";
  const byDoc = text.match(/\/document\/d\/([-\w]{20,})/i)?.[1];
  const bySheet = text.match(/\/spreadsheets\/d\/([-\w]{20,})/i)?.[1];
  const byFile = text.match(/\/file\/d\/([-\w]{20,})/i)?.[1];
  const byOpen = text.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byDoc || bySheet || byFile || byOpen) return byDoc || bySheet || byFile || byOpen || "";
  return DIRECT_ID_RE.test(text) ? text : "";
}

export function inferDriveTemplateType(input: unknown): TGrantDriveTemplate["type"] {
  const text = String(input || "").toLowerCase();
  if (text.includes("/document/")) return "doc";
  if (text.includes("/spreadsheets/")) return "sheet";
  if (text.includes(".pdf") || text.includes("application/pdf")) return "pdf";
  return "other";
}

export function grantDriveTemplates(grant: Record<string, unknown> | null | undefined): TGrantDriveTemplate[] {
  const rows = Array.isArray(grant?.driveTemplates) ? grant.driveTemplates : [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => {
      const fileUrl = String(row.fileUrl || "").trim();
      const fileId = String(row.fileId || parseDriveFileId(fileUrl)).trim();
      const label = String(row.label || row.name || `Template ${index + 1}`).trim();
      const key = String(row.key || fileId || `template_${index + 1}`).trim();
      return fileId && label
        ? {
            key,
            label,
            fileId,
            fileUrl: fileUrl || null,
            type: inferDriveTemplateType(fileUrl || row.type),
            description: row.description == null ? null : String(row.description),
            defaultChecked: row.defaultChecked !== false,
          }
        : null;
    })
    .filter((row): row is TGrantDriveTemplate => !!row);
}

export function defaultGrantDriveTemplateKeys(grant: Record<string, unknown> | null | undefined): string[] {
  return grantDriveTemplates(grant).filter((template) => template.defaultChecked !== false).map((template) => template.key);
}
