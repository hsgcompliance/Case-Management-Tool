// src/hooks/useResolvedDriveConfig.ts
//
// Single source of truth for the customer-folder build/index surface. Resolves
// the effective folder roots, index sheet, and file templates by preferring the
// per-org Drive config (authored in the admin Org Config → Google Drive panel)
// and falling back to the NEXT_PUBLIC_* env values during migration.
//
// Templates from org config and the legacy env list have different shapes; this
// hook normalizes both into one `ResolvedDriveTemplate` the build dialogs use,
// preserving the TSS payer/non-payer variant pair so the Medicaid toggle keeps
// picking the right source file.
"use client";

import React from "react";
import { useGDriveConfig } from "./useGDrive";
import {
  ACTIVE_PARENT_ID,
  EXITED_PARENT_ID,
  FOLDER_INDEX_SHEET_ID,
  DRIVE_FILE_TEMPLATES,
} from "@lib/driveConfig";
import type { TGDriveOrgConfig, TGDriveTemplate } from "@types";

/** "tssWorkbook" flags the template whose created file auto-links as the workbook. */
const TSS_WORKBOOK_KEY = "tss_workbook";

export type ResolvedDriveTemplate = {
  key: string;
  label: string;
  /** Doc-name template with `{first}` / `{last}` tokens. */
  docNameTpl: string;
  /** Direct source file id; "" when `variants` supplies it. */
  fileId: string;
  variants?: { payer: string; nonpayer: string };
  defaultChecked: boolean;
  /** Set to "tssWorkbook" for the TSS workbook template. */
  role?: string;
};

export type ResolvedDriveConfig = {
  activeParentId: string;
  exitedParentId: string;
  sheetId: string;
  templates: ResolvedDriveTemplate[];
  defaultSubfolders: string[];
  /** Where templates/roots came from — useful for surfacing "configure in Org Config" hints. */
  source: "org-config" | "env";
  isLoading: boolean;
  isError: boolean;
};

function roleForKey(key: string): string | undefined {
  return key === TSS_WORKBOOK_KEY ? "tssWorkbook" : undefined;
}

function mapEnvTemplate(t: (typeof DRIVE_FILE_TEMPLATES)[number]): ResolvedDriveTemplate {
  const base = {
    key: t.key,
    label: t.label,
    docNameTpl: t.docNameTpl,
    defaultChecked: !!t.defaultChecked,
    role: roleForKey(t.key),
  };
  if ("variants" in t) {
    return { ...base, fileId: "", variants: { payer: t.variants.payer, nonpayer: t.variants.nonpayer } };
  }
  return { ...base, fileId: t.id };
}

function mapConfigTemplate(t: TGDriveTemplate, defaultKeys: string[] | undefined): ResolvedDriveTemplate {
  const payer = t.variants?.payer?.trim() || "";
  const nonpayer = t.variants?.nonpayer?.trim() || "";
  const hasVariants = !!(payer || nonpayer);
  // buildSettings.defaultTemplateKeys is authoritative when configured; otherwise
  // fall back to the template's own defaultChecked flag.
  const defaultChecked =
    defaultKeys && defaultKeys.length ? defaultKeys.includes(t.key) : !!t.defaultChecked;
  return {
    key: t.key,
    label: t.alias,
    docNameTpl: `{last}, {first} ${t.alias}`.replace(/\s{2,}/g, " ").trim(),
    fileId: t.fileId || "",
    ...(hasVariants ? { variants: { payer, nonpayer } } : {}),
    defaultChecked,
    role: roleForKey(t.key),
  };
}

function resolve(config: TGDriveOrgConfig | undefined): Omit<ResolvedDriveConfig, "isLoading" | "isError"> {
  const fi = config?.customerFolderIndex;
  const activeParentId = (fi?.activeParentId || "").trim() || ACTIVE_PARENT_ID;
  const exitedParentId = (fi?.exitedParentId || "").trim() || EXITED_PARENT_ID;
  const sheetId = (fi?.sheetId || "").trim() || FOLDER_INDEX_SHEET_ID;

  const configTemplates = config?.templates ?? [];
  const defaultKeys = config?.buildSettings?.defaultTemplateKeys;
  const usingConfigTemplates = configTemplates.length > 0;

  const templates = usingConfigTemplates
    ? configTemplates.map((t) => mapConfigTemplate(t, defaultKeys))
    : DRIVE_FILE_TEMPLATES.map(mapEnvTemplate);

  return {
    activeParentId,
    exitedParentId,
    sheetId,
    templates,
    defaultSubfolders: config?.buildSettings?.defaultSubfolders ?? [],
    source: usingConfigTemplates || config?.customerFolderIndex?.activeParentId ? "org-config" : "env",
  };
}

export function useResolvedDriveConfig(opts?: { enabled?: boolean }): ResolvedDriveConfig {
  const configQ = useGDriveConfig({ enabled: opts?.enabled ?? true });
  const config = configQ.data?.config;
  const resolved = React.useMemo(() => resolve(config), [config]);
  return { ...resolved, isLoading: configQ.isLoading, isError: configQ.isError };
}
