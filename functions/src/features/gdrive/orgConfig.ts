import {
  db,
  isoNow,
  requireOrg,
  orgIdFromClaims,
  isDev,
  isSuperDev,
} from "../../core";
import { tss } from "@hdb/contracts";
import type { tss as TssNS } from "@hdb/contracts";

type DriveConfigClaims = Record<string, unknown>;

export type GDriveCustomerFolderIndexConfig = {
  activeParentId?: string;
  activeParentUrl?: string;
  exitedParentId?: string;
  exitedParentUrl?: string;
  sheetId?: string;
  sheetUrl?: string;
};

export type GDriveTemplateType = "doc" | "sheet" | "pdf" | "folder" | "other";

export type GDriveTemplateVariants = {
  payer: string;
  nonpayer: string;
};

export type GDriveTemplate = {
  key: string;
  fileId: string;
  fileUrl?: string;
  type: GDriveTemplateType;
  alias: string;
  description?: string;
  defaultChecked?: boolean;
  variants?: GDriveTemplateVariants;
};

export type GDriveBuildSettings = {
  defaultSubfolders?: string[];
  defaultTemplateKeys?: string[];
};

export type TssWorksheetOverride = TssNS.TssOrgConfigOverride;

export type GDriveOrgConfig = {
  customerFolderIndex: GDriveCustomerFolderIndexConfig;
  templates?: GDriveTemplate[];
  buildSettings?: GDriveBuildSettings;
  /** Per-org TSS workbook display config override (merged with the contracts baseline). */
  worksheetConfig?: TssWorksheetOverride;
};

export type GDriveConfigPatchInput = {
  activeParent?: string | null;
  exitedParent?: string | null;
  customerIndexSheet?: string | null;
  templates?: GDriveTemplate[] | null;
  buildSettings?: GDriveBuildSettings | null;
  /** null clears the override (revert to baseline); object replaces it. */
  worksheetConfig?: TssWorksheetOverride | null;
};

type NormalizedDriveTarget = {
  id: string;
  url: string;
};

const DIRECT_ID_RE = /^[-\w]{20,}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRefString(value: unknown): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

function normalizeFolderRef(input: string): NormalizedDriveTarget | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  const byFolderPath = trimmed.match(/\/folders\/([-\w]{20,})/i)?.[1];
  const byQuery = trimmed.match(/[?&]id=([-\w]{20,})/i)?.[1];
  const byRaw = DIRECT_ID_RE.test(trimmed) ? trimmed : null;
  const id = byFolderPath || byQuery || byRaw;
  if (!id) return null;
  return {
    id,
    url: `https://drive.google.com/drive/folders/${id}`,
  };
}

function normalizeSheetRef(input: string): NormalizedDriveTarget | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  const bySheetPath = trimmed.match(/\/spreadsheets\/d\/([-\w]{20,})/i)?.[1];
  const byQuery = trimmed.match(/[?&]id=([-\w]{20,})/i)?.[1];
  const byRaw = DIRECT_ID_RE.test(trimmed) ? trimmed : null;
  const id = bySheetPath || byQuery || byRaw;
  if (!id) return null;
  return {
    id,
    url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
  };
}

function assertValidRef(
  value: string | null | undefined,
  kind: "folder" | "sheet",
  field: string
): NormalizedDriveTarget | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = kind === "folder" ? normalizeFolderRef(trimmed) : normalizeSheetRef(trimmed);
  if (!normalized) {
    const err: any = new Error(`invalid_${field}`);
    err.code = 400;
    throw err;
  }
  return normalized;
}

function normalizeStoredCustomerFolderIndexConfig(raw: unknown): GDriveCustomerFolderIndexConfig {
  const data = asRecord(raw);
  const active = assertValidRef(
    readRefString(data.activeParentId) || readRefString(data.activeParentUrl),
    "folder",
    "active_parent"
  );
  const exited = assertValidRef(
    readRefString(data.exitedParentId) || readRefString(data.exitedParentUrl),
    "folder",
    "exited_parent"
  );
  const sheet = assertValidRef(
    readRefString(data.sheetId) || readRefString(data.sheetUrl),
    "sheet",
    "customer_index_sheet"
  );
  return {
    ...(active ? { activeParentId: active.id, activeParentUrl: active.url } : {}),
    ...(exited ? { exitedParentId: exited.id, exitedParentUrl: exited.url } : {}),
    ...(sheet ? { sheetId: sheet.id, sheetUrl: sheet.url } : {}),
  };
}

const VALID_TEMPLATE_TYPES = new Set<string>(["doc", "sheet", "pdf", "folder", "other"]);

function normalizeTemplate(raw: unknown): GDriveTemplate | null {
  const data = asRecord(raw);
  const key = String(data.key ?? "").trim();
  const fileId = String(data.fileId ?? "").trim();
  const alias = String(data.alias ?? "").trim();
  const variantsRaw = asRecord(data.variants);
  const payer = String(variantsRaw.payer ?? "").trim();
  const nonpayer = String(variantsRaw.nonpayer ?? "").trim();
  const hasVariants = !!(payer || nonpayer);
  // A template is valid with either a direct fileId or a payer/non-payer pair.
  if (!key || !alias || (!fileId && !hasVariants)) return null;
  const type = VALID_TEMPLATE_TYPES.has(String(data.type ?? ""))
    ? (String(data.type) as GDriveTemplateType)
    : "other";
  return {
    key,
    fileId,
    ...(data.fileUrl ? { fileUrl: String(data.fileUrl) } : {}),
    type,
    alias,
    ...(data.description ? { description: String(data.description) } : {}),
    ...(data.defaultChecked != null ? { defaultChecked: !!data.defaultChecked } : {}),
    ...(hasVariants ? { variants: { payer, nonpayer } } : {}),
  };
}

function normalizeWorksheetOverride(raw: unknown): TssWorksheetOverride | undefined {
  if (raw == null) return undefined;
  // Validate against the contracts schema; drop silently if malformed so a bad
  // stored value never breaks config reads (extractor falls back to baseline).
  const parsed = tss.TssOrgConfigOverrideSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  // Empty override object is equivalent to no override.
  return Object.keys(parsed.data).length ? parsed.data : undefined;
}

function normalizeStoredGDriveConfig(raw: unknown): GDriveOrgConfig {
  const data = asRecord(raw);
  const templates: GDriveTemplate[] = Array.isArray(data.templates)
    ? (data.templates as unknown[]).map(normalizeTemplate).filter((t): t is GDriveTemplate => t !== null)
    : [];
  const buildRaw = asRecord(data.buildSettings);
  const buildSettings: GDriveBuildSettings = {
    ...(Array.isArray(buildRaw.defaultSubfolders)
      ? { defaultSubfolders: (buildRaw.defaultSubfolders as unknown[]).map(String).filter(Boolean) }
      : {}),
    ...(Array.isArray(buildRaw.defaultTemplateKeys)
      ? { defaultTemplateKeys: (buildRaw.defaultTemplateKeys as unknown[]).map(String).filter(Boolean) }
      : {}),
  };
  const worksheetConfig = normalizeWorksheetOverride(data.worksheetConfig);
  return {
    customerFolderIndex: normalizeStoredCustomerFolderIndexConfig(data.customerFolderIndex),
    ...(templates.length ? { templates } : {}),
    ...(Object.keys(buildSettings).length ? { buildSettings } : {}),
    ...(worksheetConfig ? { worksheetConfig } : {}),
  };
}

function requireOrgAccess(caller: DriveConfigClaims, orgId: string) {
  const callerOrg = orgIdFromClaims(caller as any);
  if (callerOrg !== orgId && !isDev(caller as any) && !isSuperDev(caller as any)) {
    const err: any = new Error("forbidden");
    err.code = 403;
    throw err;
  }
}

export function resolveDriveConfigOrgId(caller: DriveConfigClaims, explicitOrgId?: string | null) {
  const trimmedExplicit = String(explicitOrgId || "").trim();
  if (trimmedExplicit && (isDev(caller as any) || isSuperDev(caller as any))) {
    return trimmedExplicit;
  }
  return requireOrg(caller as any);
}

export async function getOrgGDriveConfig(orgId: string): Promise<GDriveOrgConfig> {
  const snap = await db.collection("orgs").doc(orgId).collection("Config").doc("SystemConfig").get();
  if (!snap.exists) return { customerFolderIndex: {} };
  const value = asRecord(snap.data()?.value);
  return normalizeStoredGDriveConfig(value.gdrive);
}

export async function patchOrgGDriveConfig(args: {
  caller: DriveConfigClaims;
  orgId?: string | null;
  patch: GDriveConfigPatchInput;
}) {
  const { caller, patch } = args;
  const orgId = resolveDriveConfigOrgId(caller, args.orgId);
  requireOrgAccess(caller, orgId);

  const ref = db.collection("orgs").doc(orgId).collection("Config").doc("SystemConfig");
  const snap = await ref.get();
  if (!snap.exists) {
    const err: any = new Error("config_not_found");
    err.code = 404;
    throw err;
  }

  const currentValue = asRecord(snap.data()?.value);
  const currentDrive = normalizeStoredGDriveConfig(currentValue.gdrive);
  const next: GDriveCustomerFolderIndexConfig = {
    ...currentDrive.customerFolderIndex,
  };

  if (Object.prototype.hasOwnProperty.call(patch, "activeParent")) {
    const normalized = assertValidRef(patch.activeParent, "folder", "active_parent");
    delete next.activeParentId;
    delete next.activeParentUrl;
    if (normalized) {
      next.activeParentId = normalized.id;
      next.activeParentUrl = normalized.url;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "exitedParent")) {
    const normalized = assertValidRef(patch.exitedParent, "folder", "exited_parent");
    delete next.exitedParentId;
    delete next.exitedParentUrl;
    if (normalized) {
      next.exitedParentId = normalized.id;
      next.exitedParentUrl = normalized.url;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "customerIndexSheet")) {
    const normalized = assertValidRef(patch.customerIndexSheet, "sheet", "customer_index_sheet");
    delete next.sheetId;
    delete next.sheetUrl;
    if (normalized) {
      next.sheetId = normalized.id;
      next.sheetUrl = normalized.url;
    }
  }

  // Templates — full replace when provided
  let nextTemplates: GDriveTemplate[] | undefined = currentDrive.templates;
  if (Object.prototype.hasOwnProperty.call(patch, "templates")) {
    nextTemplates = patch.templates == null
      ? undefined
      : (patch.templates as unknown[]).map(normalizeTemplate).filter((t): t is GDriveTemplate => t !== null);
  }

  // Build settings — full replace when provided
  let nextBuildSettings: GDriveBuildSettings | undefined = currentDrive.buildSettings;
  if (Object.prototype.hasOwnProperty.call(patch, "buildSettings")) {
    if (patch.buildSettings == null) {
      nextBuildSettings = undefined;
    } else {
      nextBuildSettings = {
        ...(patch.buildSettings.defaultSubfolders != null
          ? { defaultSubfolders: patch.buildSettings.defaultSubfolders }
          : {}),
        ...(patch.buildSettings.defaultTemplateKeys != null
          ? { defaultTemplateKeys: patch.buildSettings.defaultTemplateKeys }
          : {}),
      };
    }
  }

  // Worksheet override — full replace when provided; null clears (revert to baseline)
  let nextWorksheetConfig: TssWorksheetOverride | undefined = currentDrive.worksheetConfig;
  if (Object.prototype.hasOwnProperty.call(patch, "worksheetConfig")) {
    if (patch.worksheetConfig == null) {
      nextWorksheetConfig = undefined;
    } else {
      const parsed = tss.TssOrgConfigOverrideSchema.safeParse(patch.worksheetConfig);
      if (!parsed.success) {
        const err: any = new Error("invalid_worksheet_config");
        err.code = 400;
        throw err;
      }
      nextWorksheetConfig = Object.keys(parsed.data).length ? parsed.data : undefined;
    }
  }

  const nextDrive: GDriveOrgConfig = {
    customerFolderIndex: next,
    ...(nextTemplates?.length ? { templates: nextTemplates } : {}),
    ...(nextBuildSettings && Object.keys(nextBuildSettings).length ? { buildSettings: nextBuildSettings } : {}),
    ...(nextWorksheetConfig ? { worksheetConfig: nextWorksheetConfig } : {}),
  };

  await ref.set(
    {
      value: {
        ...currentValue,
        gdrive: nextDrive,
      },
      updatedAt: isoNow(),
      updatedBy: String((caller as any)?.uid || "").trim() || null,
    },
    { merge: true }
  );

  return {
    orgId,
    config: nextDrive,
  };
}

/**
 * Resolves the effective TSS worksheet config for an org — the contracts
 * baseline deep-merged with the org's stored override. This is the single
 * entry point the Sheets extractor should use to obtain entity/field config.
 */
export async function getResolvedTssWorksheetConfig(orgId: string): Promise<TssNS.TssWorksheetConfig> {
  const config = await getOrgGDriveConfig(orgId);
  return tss.resolveTssWorksheetConfig(config.worksheetConfig ?? null);
}
