// Frontend counterpart to the backend getResolvedTssWorksheetConfig().
// Reads the org's Drive config, extracts the worksheet override, and produces
// the effective TSS config via the SAME resolver the backend uses — so the
// renderer and the extractor never diverge.

import React from "react";
import { tss } from "@hdb/contracts";
import type { tss as TssNS } from "@hdb/contracts";
import { useGDriveConfig } from "./useGDrive";

export type UseResolvedTssConfig = {
  /** Effective config: contracts baseline deep-merged with the org override. */
  config: TssNS.TssWorksheetConfig;
  /** True while the org config query is still loading (config is the baseline meanwhile). */
  isLoading: boolean;
  /** The raw org override (validated), or null when the org uses the baseline. */
  override: TssNS.TssOrgConfigOverride | null;
};

/**
 * Returns the resolved TSS worksheet config for the current org.
 *
 * While the org config loads, returns the contracts baseline so the renderer
 * always has a usable config. A malformed stored override is ignored (the
 * schema safeParse drops it) rather than throwing.
 */
export function useResolvedTssConfig(opts?: { enabled?: boolean }): UseResolvedTssConfig {
  const configQ = useGDriveConfig({ enabled: opts?.enabled ?? true });

  return React.useMemo(() => {
    const rawOverride = (configQ.data as { config?: { worksheetConfig?: unknown } } | undefined)
      ?.config?.worksheetConfig;

    let override: TssNS.TssOrgConfigOverride | null = null;
    if (rawOverride != null) {
      const parsed = tss.TssOrgConfigOverrideSchema.safeParse(rawOverride);
      if (parsed.success && Object.keys(parsed.data).length) {
        override = parsed.data;
      }
    }

    return {
      config: tss.resolveTssWorksheetConfig(override),
      isLoading: configQ.isLoading,
      override,
    };
  }, [configQ.data, configQ.isLoading]);
}
