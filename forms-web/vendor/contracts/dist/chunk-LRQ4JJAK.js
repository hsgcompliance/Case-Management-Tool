import {
  __export
} from "./chunk-MLKGABMK.js";

// src/metrics.ts
var metrics_exports = {};
__export(metrics_exports, {
  CaseManagerMonthMetrics: () => CaseManagerMonthMetrics,
  CaseManagerSummaryMetrics: () => CaseManagerSummaryMetrics,
  CustomerRefLite: () => CustomerRefLite,
  GrantMonthMetrics: () => GrantMonthMetrics,
  GrantSummaryMetrics: () => GrantSummaryMetrics,
  MetricChipDefinition: () => MetricChipDefinition,
  MetricChipId: () => MetricChipId,
  MetricWorkspaceChipInstance: () => MetricWorkspaceChipInstance,
  MetricWorkspaceLayout: () => MetricWorkspaceLayout,
  MetricWorkspacePrefs: () => MetricWorkspacePrefs,
  NameRef: () => NameRef,
  PopulationSummary: () => PopulationSummary,
  SystemMonthMetrics: () => SystemMonthMetrics,
  SystemSummaryMetrics: () => SystemSummaryMetrics
});
import { z } from "zod";
var NameRef = z.object({
  id: z.string(),
  name: z.string().nullable()
});
var CustomerRefLite = z.object({
  id: z.string(),
  name: z.string().nullable(),
  caseManagerId: z.string().nullable(),
  caseManagerName: z.string().nullable(),
  population: z.enum(["Youth", "Family", "Individual", "unknown"]),
  active: z.boolean()
});
var PopulationSummary = z.object({
  customerTotal: z.number(),
  activeCustomerTotal: z.number(),
  inactiveCustomerTotal: z.number(),
  caseManagerTotal: z.number(),
  caseManagers: z.array(NameRef)
});
var SystemSummaryMetrics = z.object({
  updatedAt: z.any(),
  // Firestore Timestamp or ISO string
  reconciledAt: z.any().nullish(),
  caseManagers: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number()
  }),
  customers: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number()
  }),
  populations: z.object({
    youth: PopulationSummary,
    family: PopulationSummary,
    individual: PopulationSummary
  }),
  enrollments: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number()
  }),
  grants: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number()
  })
});
var SystemMonthMetrics = z.object({
  month: z.string(),
  // YYYY-MM
  updatedAt: z.any(),
  reconciledAt: z.any().nullish(),
  tasks: z.object({
    total: z.number(),
    open: z.number(),
    done: z.number()
  }),
  payments: z.object({
    total: z.number(),
    unpaid: z.number(),
    amount: z.number()
  }),
  spending: z.object({
    spent: z.number(),
    projected: z.number(),
    grantsWithActiveSpendItems: z.array(NameRef)
  }),
  jotform: z.object({
    submissionsTotal: z.number(),
    locallyTrackedOnly: z.boolean()
  })
});
var CaseManagerSummaryMetrics = z.object({
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
      unknown: z.number()
    }),
    refs: z.array(CustomerRefLite).optional()
  }),
  enrollments: z.object({
    total: z.number(),
    active: z.number(),
    inactive: z.number(),
    byPopulation: z.object({
      youth: z.number(),
      family: z.number(),
      individual: z.number(),
      unknown: z.number()
    })
  }),
  acuity: z.object({
    scoreSum: z.number(),
    scoreCount: z.number(),
    scoreAvg: z.number().nullable()
  }),
  tasks: z.object({
    openThisMonth: z.number(),
    openNextMonth: z.number(),
    byType: z.object({
      assessment: z.object({ thisMonth: z.number(), nextMonth: z.number() }),
      compliance: z.object({ thisMonth: z.number(), nextMonth: z.number() }),
      other: z.object({ thisMonth: z.number(), nextMonth: z.number() })
    })
  }),
  payments: z.object({
    unpaidThisMonth: z.number(),
    unpaidNextMonth: z.number(),
    unpaidTotal: z.number(),
    amountThisMonth: z.number(),
    amountNextMonth: z.number(),
    amountTotal: z.number()
  })
});
var CaseManagerMonthMetrics = z.object({
  month: z.string(),
  uid: z.string(),
  name: z.string().nullable().optional(),
  updatedAt: z.any(),
  reconciledAt: z.any().nullish(),
  tasks: z.object({
    total: z.number(),
    open: z.number(),
    done: z.number()
  }),
  payments: z.object({
    unpaidCount: z.number(),
    unpaidAmount: z.number()
  }),
  spending: z.object({
    projected: z.number(),
    spent: z.number()
  }).optional()
});
var GrantSummaryMetrics = z.object({
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
      unknown: z.number()
    })
  }),
  customers: z.object({
    uniqueTotal: z.number(),
    activeUniqueTotal: z.number(),
    inactiveUniqueTotal: z.number(),
    refs: z.array(CustomerRefLite).optional()
  }),
  caseManagers: z.object({
    total: z.number(),
    refs: z.array(NameRef)
  }),
  spending: z.object({
    projected: z.number(),
    spent: z.number(),
    projectedInWindow: z.number(),
    spentInWindow: z.number(),
    lineItemsActive: z.number()
  })
});
var GrantMonthMetrics = z.object({
  month: z.string(),
  grantId: z.string(),
  name: z.string().nullable().optional(),
  updatedAt: z.any(),
  reconciledAt: z.any().nullish(),
  enrollments: z.object({
    active: z.number(),
    inactive: z.number(),
    total: z.number()
  }),
  payments: z.object({
    unpaidCount: z.number(),
    unpaidAmount: z.number()
  }),
  spending: z.object({
    projected: z.number(),
    spent: z.number(),
    activeLineItems: z.array(z.object({ id: z.string(), label: z.string().nullable() }))
  })
});
var MetricChipId = z.enum([
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
  "grant.spending.projected"
]);
var MetricChipDefinition = z.object({
  id: MetricChipId,
  label: z.string(),
  scope: z.enum(["system", "caseManager", "grant"]),
  period: z.enum(["current", "month", "allTime"]),
  valueType: z.enum(["count", "currency"]),
  supportsDrilldown: z.boolean(),
  drilldownKind: z.enum(["caseManagers", "customers", "grants", "lineItems"]).nullish()
});
var MetricWorkspaceChipInstance = z.object({
  instanceId: z.string(),
  chipId: MetricChipId,
  size: z.enum(["sm", "md", "lg"]).default("md"),
  scopeOverride: z.object({
    caseManagerUid: z.string().nullish(),
    grantId: z.string().nullish()
  }).nullish(),
  monthMode: z.enum(["current", "selected"]).default("current"),
  selectedMonth: z.string().nullish(),
  visible: z.boolean().default(true)
});
var MetricWorkspaceLayout = z.object({
  id: z.string(),
  name: z.string(),
  chips: z.array(MetricWorkspaceChipInstance),
  updatedAt: z.any().nullish()
});
var MetricWorkspacePrefs = z.object({
  layouts: z.array(MetricWorkspaceLayout).default([]),
  defaultLayoutId: z.string().nullish()
});

export {
  NameRef,
  CustomerRefLite,
  PopulationSummary,
  SystemSummaryMetrics,
  SystemMonthMetrics,
  CaseManagerSummaryMetrics,
  CaseManagerMonthMetrics,
  GrantSummaryMetrics,
  GrantMonthMetrics,
  MetricChipId,
  MetricChipDefinition,
  MetricWorkspaceChipInstance,
  MetricWorkspaceLayout,
  MetricWorkspacePrefs,
  metrics_exports
};
