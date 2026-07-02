// web/src/hooks/useOrgConfig.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Orgs } from "@client/orgs";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BudgetGroupItem = {
  /** Stable ID for React key and removal. E.g. `${grantId}::${lineItemId||"grant"}::${ts}` */
  id: string;
  grantId: string;
  /** If set, shows only this specific line item. Absent = whole-grant card. */
  lineItemId?: string;
  /** If set with lineItemId, targets one split goal/cycle under that line item. */
  splitGoalId?: string;
  labelOverride?: string;
  /** Color key from COLOR_KEYS in BudgetConfigModal */
  color?: string;
  cardType?: "standard" | "budget" | "client-allocation" | "allocation" | "billable";
  displayLevel?: "grant" | "lineItem" | "split";
  appearInDigest?: boolean;
  groupUnderParentGrant?: boolean;
  nested?: boolean;
  /** Force this card to show split-cycle breakdowns regardless of the line item's own display.cycleDisplayMode setting. */
  showSplitCycles?: boolean;
};

export type BudgetGroupCfg = {
  key: string;
  label: string;
  /** Accent color key (e.g. "sky", "emerald") */
  color?: string;
  /** Grid columns for cards in this group on the Budget page. Default 3. */
  cols?: number;
  /** Standard grid, or a narrow card spanning the entire group width. */
  layout?: "grid" | "fullWidthNarrow";
  /** Ordered list of items (grants or line items) in this group. */
  items: BudgetGroupItem[];
  hidden?: boolean;
};

export type BudgetItemCfg = {
  /** Hide this grant entirely from the Budget page. */
  visible?: boolean;
  showGrantTotal?: boolean;
  showLineItemTotals?: boolean;
  showSplitGoals?: boolean;
  appearInDigest?: boolean;
  mainDisplayLevel?: "grant" | "lineItem" | "split";
  groupChildrenUnderParentGrant?: boolean;
  expandedByDefault?: boolean;
};

export type ProgramGroupCfg = {
  key: string;
  label: string;
  grantIds: string[];
  populations?: Array<"youth" | "family" | "individual">;
};

/**
 * A system-level spending view preset saved by an admin.
 * Appears in the invoice tool's Views strip for all users, visually distinct
 * from personal saved views.
 */
export type SpendingPreset = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  /** Serialized SpendingFilterState — the tool parses with its own sanitizer. */
  filterState: Record<string, unknown>;
  createdAt?: string;
  createdBy?: string;
};

export type OrgDisplayConfig = {
  budgetDisplay: {
    groups: BudgetGroupCfg[];
    /** Top-level visibility overrides, keyed by grant doc ID. */
    items: Record<string, BudgetItemCfg>;
    digest?: {
      showOverallSummary?: boolean;
      showGrantTotals?: boolean;
      mainDisplayLevel?: "grant" | "lineItem" | "split";
      expandNestedRowsByDefault?: boolean;
      groupChildrenUnderParentGrant?: boolean;
    };
  };
  programDisplay: {
    groups: ProgramGroupCfg[];
    items: Record<string, { visible?: boolean; labelOverride?: string }>;
  };
  /** Per-digest-type enabled flag. Missing key = enabled. */
  digestsEnabled: Record<string, boolean>;
  /** System-level invoice tool presets set by admins, shown to all users. */
  spendingPresets?: SpendingPreset[];
  /** Secret-games admin configuration. */
  secretGames?: unknown;
  aiFeatures?: {
    caseNoteAssistantBeta?: {
      enabled: boolean;
      allowedWorkbookVariants: string[];
      defaultClientLabel: string;
      defaultStaffLabel: string;
      monthlyTokenLimit: number;
      monthlyRequestLimit: number;
      dailyUserRequestLimit: number;
      dailyUserTokenLimit: number;
      userQuotaOverrides: Record<string, { dailyRequestLimit?: number; dailyTokenLimit?: number }>;
      defaultModel: string;
      fallbackModel: string | null;
      maxInputChars: number;
      maxOutputTokens: number;
      temperature: number;
    };
  };
  /** Per-page rich-text help content (HTML strings), editable by admins. */
  helpContent?: {
    customers?: string;
    customersModal?: string;
    budget?: string;
    programs?: string;
    budgetPipeline?: string;
    invoiceTool?: string;
  };
};

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: OrgDisplayConfig = {
  budgetDisplay: {
    groups: [],
    items: {},
    digest: {
      showOverallSummary: true,
      showGrantTotals: true,
      mainDisplayLevel: "grant",
      expandNestedRowsByDefault: false,
      groupChildrenUnderParentGrant: true,
    },
  },
  digestsEnabled: {},
  programDisplay: {
    groups: [
      { key: "youth", label: "Youth", grantIds: [], populations: ["youth"] },
      { key: "family", label: "Family", grantIds: [], populations: ["family"] },
      { key: "individual", label: "Individual", grantIds: [], populations: ["individual"] },
      { key: "rental-assistance", label: "Rental Assistance", grantIds: [] },
    ],
    items: {},
  },
  secretGames: undefined,
  aiFeatures: { caseNoteAssistantBeta: { enabled: false, allowedWorkbookVariants: ["payer"], defaultClientLabel: "client", defaultStaffLabel: "case manager", monthlyTokenLimit: 25_000_000, monthlyRequestLimit: 10_000, dailyUserRequestLimit: 25, dailyUserTokenLimit: 100_000, userQuotaOverrides: {}, defaultModel: "gemini-2.5-flash-lite", fallbackModel: null, maxInputChars: 12_000, maxOutputTokens: 800, temperature: 0.2 } },
};

// ─── Backward-compat hydration ────────────────────────────────────────────────
// Old format had `grantIds: string[]` on groups. Convert to `items`.

function hydrateBudgetGroup(raw: Record<string, unknown>): BudgetGroupCfg {
  const key = String(raw.key ?? "");
  const label = String(raw.label ?? "");
  const color = raw.color != null ? String(raw.color) : undefined;
  const cols = raw.cols != null ? Number(raw.cols) : undefined;
  const hidden = !!raw.hidden;
  const layout = raw.layout === "fullWidthNarrow" ? "fullWidthNarrow" : "grid";

  // New format
  if (Array.isArray(raw.items)) {
    return { key, label, color, cols, layout, hidden, items: raw.items as BudgetGroupItem[] };
  }

  // Old format: grantIds[]
  if (Array.isArray(raw.grantIds)) {
    const items: BudgetGroupItem[] = (raw.grantIds as string[]).map((grantId) => ({
      id: `${grantId}::grant::legacy`,
      grantId,
    }));
    return { key, label, color, cols, layout, hidden, items };
  }

  return { key, label, color, cols, layout, hidden, items: [] };
}

// ─── Internal query result type ───────────────────────────────────────────────

type OrgConfigQueryResult = {
  configId: string | null;
  config: OrgDisplayConfig;
};

const CONFIG_QK = ["orgConfig", "displayConfig"] as const;

// ─── Fetch via org API ────────────────────────────────────────────────────────

async function fetchOrgConfig(): Promise<OrgConfigQueryResult> {
  const { org } = await Orgs.get();
  const docs = Object.values(org.config ?? {});

  // Find the display config doc — prefer one with "grant" or "budget" or "display" in label
  const displayDocs = docs.filter((d) => d.kind === "display" && d.active !== false);
  const displayDoc =
    displayDocs.find((d) => /grant|budget|display/i.test(d.label)) ??
    displayDocs[0] ??
    null;

  if (!displayDoc) {
    return { configId: null, config: DEFAULT_CONFIG };
  }

  const value = displayDoc.value as
    | Partial<OrgDisplayConfig & { budgetDisplay: { groups: Record<string, unknown>[] } }>
    | undefined;

  const rawGroups = (value?.budgetDisplay?.groups ?? []) as Record<string, unknown>[];

  const config: OrgDisplayConfig = {
    budgetDisplay: {
      groups: rawGroups.map(hydrateBudgetGroup),
      items:
        (value?.budgetDisplay?.items as Record<string, BudgetItemCfg> | undefined) ?? {},
      digest: {
        ...DEFAULT_CONFIG.budgetDisplay.digest,
        ...((value?.budgetDisplay?.digest as OrgDisplayConfig["budgetDisplay"]["digest"] | undefined) ?? {}),
      },
    },
    digestsEnabled: (value?.digestsEnabled as Record<string, boolean> | undefined) ?? {},
    programDisplay: {
      groups: value?.programDisplay?.groups ?? DEFAULT_CONFIG.programDisplay.groups,
      items: value?.programDisplay?.items ?? {},
    },
    spendingPresets: Array.isArray(value?.spendingPresets)
      ? (value.spendingPresets as SpendingPreset[])
      : undefined,
    secretGames: value?.secretGames,
    aiFeatures: value?.aiFeatures ?? DEFAULT_CONFIG.aiFeatures,
    helpContent: (value?.helpContent as OrgDisplayConfig["helpContent"] | undefined) ?? undefined,
  };

  return { configId: displayDoc.id, config };
}

export function useOrgConfig() {
  const q = useQuery({
    queryKey: CONFIG_QK,
    queryFn: fetchOrgConfig,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  // Expose data as OrgDisplayConfig (not the internal result shape) so callers are unchanged
  return {
    ...q,
    data: q.data?.config,
  };
}

// ─── Save hook ────────────────────────────────────────────────────────────────

export function useSaveOrgConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: OrgDisplayConfig) => {
      const cached = qc.getQueryData<OrgConfigQueryResult>(CONFIG_QK);
      const configId = cached?.configId ?? null;
      if (!configId) {
        throw new Error(
          "No display config doc found. Create one in Admin → Org Config (kind: display) first.",
        );
      }
      await Orgs.configPatch(configId, { value: config });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONFIG_QK });
    },
  });
}
