"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
module.exports = __toCommonJS(metrics_exports);
var import_zod = require("zod");
var NameRef = import_zod.z.object({
  id: import_zod.z.string(),
  name: import_zod.z.string().nullable()
});
var CustomerRefLite = import_zod.z.object({
  id: import_zod.z.string(),
  name: import_zod.z.string().nullable(),
  caseManagerId: import_zod.z.string().nullable(),
  caseManagerName: import_zod.z.string().nullable(),
  population: import_zod.z.enum(["Youth", "Family", "Individual", "unknown"]),
  active: import_zod.z.boolean()
});
var PopulationSummary = import_zod.z.object({
  customerTotal: import_zod.z.number(),
  activeCustomerTotal: import_zod.z.number(),
  inactiveCustomerTotal: import_zod.z.number(),
  caseManagerTotal: import_zod.z.number(),
  caseManagers: import_zod.z.array(NameRef)
});
var SystemSummaryMetrics = import_zod.z.object({
  updatedAt: import_zod.z.any(),
  // Firestore Timestamp or ISO string
  reconciledAt: import_zod.z.any().nullish(),
  caseManagers: import_zod.z.object({
    total: import_zod.z.number(),
    active: import_zod.z.number(),
    inactive: import_zod.z.number()
  }),
  customers: import_zod.z.object({
    total: import_zod.z.number(),
    active: import_zod.z.number(),
    inactive: import_zod.z.number()
  }),
  populations: import_zod.z.object({
    youth: PopulationSummary,
    family: PopulationSummary,
    individual: PopulationSummary
  }),
  enrollments: import_zod.z.object({
    total: import_zod.z.number(),
    active: import_zod.z.number(),
    inactive: import_zod.z.number()
  }),
  grants: import_zod.z.object({
    total: import_zod.z.number(),
    active: import_zod.z.number(),
    inactive: import_zod.z.number()
  })
});
var SystemMonthMetrics = import_zod.z.object({
  month: import_zod.z.string(),
  // YYYY-MM
  updatedAt: import_zod.z.any(),
  reconciledAt: import_zod.z.any().nullish(),
  tasks: import_zod.z.object({
    total: import_zod.z.number(),
    open: import_zod.z.number(),
    done: import_zod.z.number()
  }),
  payments: import_zod.z.object({
    total: import_zod.z.number(),
    unpaid: import_zod.z.number(),
    amount: import_zod.z.number()
  }),
  spending: import_zod.z.object({
    spent: import_zod.z.number(),
    projected: import_zod.z.number(),
    grantsWithActiveSpendItems: import_zod.z.array(NameRef)
  }),
  jotform: import_zod.z.object({
    submissionsTotal: import_zod.z.number(),
    locallyTrackedOnly: import_zod.z.boolean()
  })
});
var CaseManagerSummaryMetrics = import_zod.z.object({
  uid: import_zod.z.string(),
  caseManager: NameRef,
  updatedAt: import_zod.z.any(),
  reconciledAt: import_zod.z.any().nullish(),
  customers: import_zod.z.object({
    total: import_zod.z.number(),
    active: import_zod.z.number(),
    inactive: import_zod.z.number(),
    byPopulation: import_zod.z.object({
      youth: import_zod.z.number(),
      family: import_zod.z.number(),
      individual: import_zod.z.number(),
      unknown: import_zod.z.number()
    }),
    refs: import_zod.z.array(CustomerRefLite).optional()
  }),
  enrollments: import_zod.z.object({
    total: import_zod.z.number(),
    active: import_zod.z.number(),
    inactive: import_zod.z.number(),
    byPopulation: import_zod.z.object({
      youth: import_zod.z.number(),
      family: import_zod.z.number(),
      individual: import_zod.z.number(),
      unknown: import_zod.z.number()
    })
  }),
  acuity: import_zod.z.object({
    scoreSum: import_zod.z.number(),
    scoreCount: import_zod.z.number(),
    scoreAvg: import_zod.z.number().nullable()
  }),
  tasks: import_zod.z.object({
    openThisMonth: import_zod.z.number(),
    openNextMonth: import_zod.z.number(),
    byType: import_zod.z.object({
      assessment: import_zod.z.object({ thisMonth: import_zod.z.number(), nextMonth: import_zod.z.number() }),
      compliance: import_zod.z.object({ thisMonth: import_zod.z.number(), nextMonth: import_zod.z.number() }),
      other: import_zod.z.object({ thisMonth: import_zod.z.number(), nextMonth: import_zod.z.number() })
    })
  }),
  payments: import_zod.z.object({
    unpaidThisMonth: import_zod.z.number(),
    unpaidNextMonth: import_zod.z.number(),
    unpaidTotal: import_zod.z.number(),
    amountThisMonth: import_zod.z.number(),
    amountNextMonth: import_zod.z.number(),
    amountTotal: import_zod.z.number()
  })
});
var CaseManagerMonthMetrics = import_zod.z.object({
  month: import_zod.z.string(),
  uid: import_zod.z.string(),
  name: import_zod.z.string().nullable().optional(),
  updatedAt: import_zod.z.any(),
  reconciledAt: import_zod.z.any().nullish(),
  tasks: import_zod.z.object({
    total: import_zod.z.number(),
    open: import_zod.z.number(),
    done: import_zod.z.number()
  }),
  payments: import_zod.z.object({
    unpaidCount: import_zod.z.number(),
    unpaidAmount: import_zod.z.number()
  }),
  spending: import_zod.z.object({
    projected: import_zod.z.number(),
    spent: import_zod.z.number()
  }).optional()
});
var GrantSummaryMetrics = import_zod.z.object({
  grantId: import_zod.z.string(),
  grant: NameRef,
  updatedAt: import_zod.z.any(),
  reconciledAt: import_zod.z.any().nullish(),
  enrollments: import_zod.z.object({
    total: import_zod.z.number(),
    active: import_zod.z.number(),
    inactive: import_zod.z.number(),
    byPopulation: import_zod.z.object({
      youth: import_zod.z.number(),
      family: import_zod.z.number(),
      individual: import_zod.z.number(),
      unknown: import_zod.z.number()
    })
  }),
  customers: import_zod.z.object({
    uniqueTotal: import_zod.z.number(),
    activeUniqueTotal: import_zod.z.number(),
    inactiveUniqueTotal: import_zod.z.number(),
    refs: import_zod.z.array(CustomerRefLite).optional()
  }),
  caseManagers: import_zod.z.object({
    total: import_zod.z.number(),
    refs: import_zod.z.array(NameRef)
  }),
  spending: import_zod.z.object({
    projected: import_zod.z.number(),
    spent: import_zod.z.number(),
    projectedInWindow: import_zod.z.number(),
    spentInWindow: import_zod.z.number(),
    lineItemsActive: import_zod.z.number()
  })
});
var GrantMonthMetrics = import_zod.z.object({
  month: import_zod.z.string(),
  grantId: import_zod.z.string(),
  name: import_zod.z.string().nullable().optional(),
  updatedAt: import_zod.z.any(),
  reconciledAt: import_zod.z.any().nullish(),
  enrollments: import_zod.z.object({
    active: import_zod.z.number(),
    inactive: import_zod.z.number(),
    total: import_zod.z.number()
  }),
  payments: import_zod.z.object({
    unpaidCount: import_zod.z.number(),
    unpaidAmount: import_zod.z.number()
  }),
  spending: import_zod.z.object({
    projected: import_zod.z.number(),
    spent: import_zod.z.number(),
    activeLineItems: import_zod.z.array(import_zod.z.object({ id: import_zod.z.string(), label: import_zod.z.string().nullable() }))
  })
});
var MetricChipId = import_zod.z.enum([
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
var MetricChipDefinition = import_zod.z.object({
  id: MetricChipId,
  label: import_zod.z.string(),
  scope: import_zod.z.enum(["system", "caseManager", "grant"]),
  period: import_zod.z.enum(["current", "month", "allTime"]),
  valueType: import_zod.z.enum(["count", "currency"]),
  supportsDrilldown: import_zod.z.boolean(),
  drilldownKind: import_zod.z.enum(["caseManagers", "customers", "grants", "lineItems"]).nullish()
});
var MetricWorkspaceChipInstance = import_zod.z.object({
  instanceId: import_zod.z.string(),
  chipId: MetricChipId,
  size: import_zod.z.enum(["sm", "md", "lg"]).default("md"),
  scopeOverride: import_zod.z.object({
    caseManagerUid: import_zod.z.string().nullish(),
    grantId: import_zod.z.string().nullish()
  }).nullish(),
  monthMode: import_zod.z.enum(["current", "selected"]).default("current"),
  selectedMonth: import_zod.z.string().nullish(),
  visible: import_zod.z.boolean().default(true)
});
var MetricWorkspaceLayout = import_zod.z.object({
  id: import_zod.z.string(),
  name: import_zod.z.string(),
  chips: import_zod.z.array(MetricWorkspaceChipInstance),
  updatedAt: import_zod.z.any().nullish()
});
var MetricWorkspacePrefs = import_zod.z.object({
  layouts: import_zod.z.array(MetricWorkspaceLayout).default([]),
  defaultLayoutId: import_zod.z.string().nullish()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CaseManagerMonthMetrics,
  CaseManagerSummaryMetrics,
  CustomerRefLite,
  GrantMonthMetrics,
  GrantSummaryMetrics,
  MetricChipDefinition,
  MetricChipId,
  MetricWorkspaceChipInstance,
  MetricWorkspaceLayout,
  MetricWorkspacePrefs,
  NameRef,
  PopulationSummary,
  SystemMonthMetrics,
  SystemSummaryMetrics
});
