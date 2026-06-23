import { useQuery } from "@tanstack/react-query";
import { callFunction } from "@/lib/functionsApi";
import { RQ_DEFAULTS } from "@hooks/base";
import type { User } from "firebase/auth";

export interface GDriveTemplate {
  key: string;
  fileId: string;
  type: string;
  alias: string;
  description?: string;
  defaultChecked?: boolean;
  variants?: { payer: string; nonpayer: string };
  /** "tssWorkbook" flags the template whose copy auto-links as the TSS workbook. */
  role?: string;
}

export interface OrgGDriveConfig {
  customerFolderIndex: {
    activeParentId?: string;
    exitedParentId?: string;
    sheetId?: string;
    sheetUrl?: string;
  };
  templates?: GDriveTemplate[];
  buildSettings?: { defaultSubfolders?: string[]; defaultTemplateKeys?: string[] };
}

interface ConfigResp {
  ok: boolean;
  orgId?: string;
  config?: OrgGDriveConfig;
}

/** Org Google Drive config (folder parents, build templates, subfolders). */
export function useOrgGDriveConfig(user: User | null) {
  return useQuery({
    queryKey: ["orgGDriveConfig", user?.uid ?? ""],
    queryFn: async () => {
      const resp = await callFunction<ConfigResp>("gdriveConfigGet", {}, { method: "GET" });
      return resp.config ?? { customerFolderIndex: {} };
    },
    enabled: !!user,
    ...RQ_DEFAULTS,
    staleTime: 30 * 60_000,
  });
}
