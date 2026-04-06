// contracts/src/metrics.ts
// Typed shapes for the metric platform — system, case-manager, and grant summary docs
// plus their month subdocs, chip definitions, and workspace preferences.

import { z } from "zod";

// ─── Shared primitives ──────────────────────────────────────────────────────

export const NameRef = z.object({
  id: z.string(),
  name: z.string().nullable(),
});
export type TNameRef = z.infer<typeof NameRef>;

export const CustomerRefLite = z.object({
  id: z.string(),
  name: z.string().nullable(),
  caseManagerId: z.string().nullable(),
  caseManagerName: z.string().nullable(),
  population: z.enum(["Youth", "Family", "Individual", "unknown"]),
  active: z.boolean(),
});
export type TCustomerRefLite = z.infer<typeof CustomerRefLite>;

export const PopulationSummary = z.object({
  customerTotal: z.number(),
  activeCustomerTotal: z.number(),
  inactiveCustomerTotal: z.number(),
  caseManagerTotal: z.number(),
  caseManagers: z.array(NameRef),
});
export type TPopulationSummary = z.infer<typeof PopulationSummary>;

// ─── System summary ─────────────────────────────────────────────────────────
// doc: metrics/systemSummary

export const SystemSummaryMetrics = z.object({
  updatedAt: z.any(), // Firestore Timestamp or ISO string
  reconciledAt: z.any().nullish(),

  caseManagers: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number(),
  }),

  customers: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number(),
  }),

  populations: z.object({
    youth: PopulationSummary,
    family: PopulationSummary,
    individual: PopulationSummary,
  }),

  enrollments: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number(),
  }),

  grants: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number(),
  }),
});
export type TSystemSummaryMetrics = z.infer<typeof SystemSummaryMetrics>;

// ─── System month metrics ────────────────────────────────────────────────────
// subcollection: metrics/systemSummary/months/{YYYY-MM}

export const SystemMonthMetrics = z.object({
  month: z.string(), // YYYY-MM
  updatedAt: z.any(),
  reconciledAt: z.any().nullish(),

  tasks: z.object({
    total: z.number(),
    open: z.number(),
    done: z.number(),
  }),

  payments: z.object({
    total: z.number(),
    unpaid: z.number(),
    amount: z.number(),
  }),

  spending: z.object({
    spent: z.number(),
    projected: z.number(),
    grantsWithActiveSpendItems: z.array(NameRef),
  }),

  jotform: z.object({
    submissionsTotal: z.number(),
    locallyTrackedOnly: z.boolean(),
  }),
});
export type TSystemMonthMetrics = z.infer<typeof SystemMonthMetrics>;

// ─── Case manager summary ────────────────────────────────────────────────────
// doc: caseManagerMetrics/{uid}

export const CaseManagerSummaryMetrics = z.object({
  uid: z.string(),
  caseManager: NameRef,
  updatedAt: z.any(),
  reconciledAt: z.any().nullish(),

  customers: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number(),
    byPopulation: z.object({
      youth: z.number(),
      family: z.number(),
      individual: z.number(),
      unknown: z.number(),
    }),
    refs: z.array(CustomerRefLite).optional(),
  }),

  enrollments: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number(),
    byPopulation: z.object({
      youth: z.number(),
      family: z.number(),
      individual: z.number(),
      unknown: z.number(),
    }),
  }),

  acuity: z.object({
    scoreSum: z.number(),
    scoreCount: z.number(),
    scoreAvg: z.number().nullable(),
  }),

  tasks: z.object({
    openThisMonth: z.number(),
    openNextMonth: z.number(),
    byType: z.object({
      assessment: z.object({ thisMonth: z.number(), nextMonth: z.number() }),
      compliance: z.object({ thisMonth: z.number(), nextMonth: z.number() }),
      other: z.object({ thisMonth: z.number(), nextMonth: z.number() }),
    }),
  }),

  payments: z.object({
    unpaidThisMonth: z.number(),
    unpaidNextMonth: z.number(),
    unpaidTotal: z.number(),
    amountThisMonth: z.number(),
    amountNextMonth: z.number(),
    amountTotal: z.number(),
  }),
});
export type TCaseManagerSummaryMetrics = z.infer<typeof CaseManagerSummaryMetrics>;

// ─── Case manager month metrics ──────────────────────────────────────────────
// subcollection: caseManagerMetrics/{uid}/months/{YYYY-MM}

export const CaseManagerMonthMetrics = z.object({
  month: z.string(),
  uid: z.string(),
  name: z.string().nullable().optional(),
  updatedAt: z.any(),
  reconciledAt: z.any().nullish(),

  tasks: z.object({
    total: z.number(),
    open: z.number(),
    done: z.number(),
  }),

  payments: z.object({
    unpaidCount: z.number(),
    unpaidAmount: z.number(),
  }),

  spending: z
    .object({
      projected: z.number(),
      spent: z.number(),
    })
    .optional(),
});
export type TCaseManagerMonthMetrics = z.infer<typeof CaseManagerMonthMetrics>;

// ─── Grant summary ───────────────────────────────────────────────────────────
// doc: grantMetrics/{grantId}

export const GrantSummaryMetrics = z.object({
  grantId: z.string(),
  grant: NameRef,
  updatedAt: z.any(),
  reconciledAt: z.any().nullish(),

  enrollments: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number(),
    byPopulation: z.object({
      youth: z.number(),
      family: z.number(),
      individual: z.number(),
      unknown: z.number(),
    }),
  }),

  customers: z.object({
    uniqueTotal: z.number(),
    activeUniqueTotal: z.number(),
    inactiveUniqueTotal: z.number(),
    refs: z.array(CustomerRefLite).optional(),
  }),

  caseManagers: z.object({
    total: z.number(),
    refs: z.array(NameRef),
  }),

  spending: z.object({
    projected: z.number(),
    spent: z.number(),
    projectedInWindow: z.number(),
    spentInWindow: z.number(),
    lineItemsActive: z.number(),
  }),
});
export type TGrantSummaryMetrics = z.infer<typeof GrantSummaryMetrics>;

// ─── Grant month metrics ─────────────────────────────────────────────────────
// subcollection: grantMetrics/{grantId}/months/{YYYY-MM}

export const GrantMonthMetrics = z.object({
  month: z.string(),
  grantId: z.string(),
  name: z.string().nullable().optional(),
  updatedAt: z.any(),
  reconciledAt: z.any().nullish(),

  enrollments: z.object({
    active: z.number(),
    inactive: z.number(),
    total: z.number(),
  }),

  payments: z.object({
    unpaidCount: z.number(),
    unpaidAmount: z.number(),
  }),

  spending: z.object({
    projected: z.number(),
    spent: z.number(),
    activeLineItems: z.array(z.object({ id: z.string(), label: z.string().nullable() })),
  }),
});
export type TGrantMonthMetrics = z.infer<typeof GrantMonthMetrics>;

// ─── Chip definition ─────────────────────────────────────────────────────────

export const MetricChipId = z.enum([
  "system.caseManagers.total",
  "system.customers.total",
  "system.population.youth.caseManagers",
  "system.population.youth.customers",
  "system.population.family.caseManagers",
  "system.population.family.customers",
  "system.population.individual.caseManagers",
  "system.population.individual.customers",
  "system.month.tasks.total",
  "system.month.payments.total",
  "system.month.spending.spent",
  "system.month.spending.projected",
  "system.month.jotform.submissions",
  "cm.customers.total",
  "cm.tasks.total",
  "cm.acuity.sum",
  "grant.enrollments.total",
  "grant.customers.total",
  "grant.spending.spent",
  "grant.spending.projected",
]);
export type TMetricChipId = z.infer<typeof MetricChipId>;

export const MetricChipDefinition = z.object({
  id: MetricChipId,
  label: z.string(),
  scope: z.enum(["system", "caseManager", "grant"]),
  period: z.enum(["current", "month", "allTime"]),
  valueType: z.enum(["count", "currency"]),
  supportsDrilldown: z.boolean(),
  drilldownKind: z
    .enum(["caseManagers", "customers", "grants", "lineItems"])
    .nullish(),
});
export type TMetricChipDefinition = z.infer<typeof MetricChipDefinition>;

// ─── Workspace preferences ───────────────────────────────────────────────────
// stored in userExtras.metricWorkspacePrefs

export const MetricWorkspaceChipInstance = z.object({
  instanceId: z.string(),
  chipId: MetricChipId,
  size: z.enum(["sm", "md", "lg"]).default("md"),
  scopeOverride: z
    .object({
      caseManagerUid: z.string().nullish(),
      grantId: z.string().nullish(),
    })
    .nullish(),
  monthMode: z.enum(["current", "selected"]).default("current"),
  selectedMonth: z.string().nullish(),
  visible: z.boolean().default(true),
});
export type TMetricWorkspaceChipInstance = z.infer<typeof MetricWorkspaceChipInstance>;

export const MetricWorkspaceLayout = z.object({
  id: z.string(),
  name: z.string(),
  chips: z.array(MetricWorkspaceChipInstance),
  updatedAt: z.any().nullish(),
});
export type TMetricWorkspaceLayout = z.infer<typeof MetricWorkspaceLayout>;

export const MetricWorkspacePrefs = z.object({
  layouts: z.array(MetricWorkspaceLayout).default([]),
  defaultLayoutId: z.string().nullish(),
});
export type TMetricWorkspacePrefs = z.infer<typeof MetricWorkspacePrefs>;
