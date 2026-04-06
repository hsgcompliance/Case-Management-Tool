// src/hooks/queryKeys.ts
import { stableSortObject as stable } from "@lib/stable";

export const qk = {
  // Disabled/no-op keys live here so all query keys stay centralized.
  customers: {
    root: ["customers"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["customers", "list", stable(filters || {})] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
    detailNoop: () => ["customers", "detail", "noop"] as const,
  },
  grants: {
    root: ["grants"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["grants", "list", stable(filters || {})] as const,
    detail: (id: string) => ["grants", "detail", id] as const,
    structure: () => ["grants", "structure"] as const,
    activity: (grantId: string, limit = 1000) =>
      ["grants", "activity", stable({ grantId, limit })] as const,
  },
  creditCards: {
    root: ["creditCards"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["creditCards", "list", stable(filters || {})] as const,
    detail: (id: string) => ["creditCards", "detail", id] as const,
    structure: () => ["creditCards", "structure"] as const,
    summary: (filters?: Record<string, unknown>) =>
      ["creditCards", "summary", stable(filters || {})] as const,
  },
  enrollments: {
    root: ["enrollments"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["enrollments", "list", stable(filters || {})] as const,
    byCustomer: (customerId: string, filters?: Record<string, unknown>) =>
      ["enrollments", "byCustomer", customerId, stable(filters || {})] as const,
    detail: (id: string) => ["enrollments", "detail", id] as const,
  },
  payments: {
    root: ["payments"] as const,
    byCustomer: (customerId: string, limit = 200) =>
      ["payments", "byCustomer", customerId, stable({ limit })] as const,
    byCustomerPrefix: (customerId: string) =>
      ["payments", "byCustomer", customerId] as const,
    byEnrollment: (enrollmentId: string) =>
      ["payments", "byEnrollment", enrollmentId] as const,
    list: (filters: Record<string, unknown>) =>
      ["payments", "list", stable(filters)] as const,
    projections: (filters: Record<string, unknown>) =>
      ["payments", "projections", stable(filters)] as const,
    all: (filters: Record<string, unknown>) =>
      ["payments", "all", stable(filters)] as const,
  },
  ledger: {
    root: ["ledger"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["ledger", "list", stable(filters || {})] as const,
    detail: (id: string) => ["ledger", "detail", id] as const,
    balance: (filters?: Record<string, unknown>) =>
      ["ledger", "balance", stable(filters || {})] as const,
  },
  paymentQueue: {
    root: ["paymentQueue"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["paymentQueue", "list", stable(filters || {})] as const,
    detail: (id: string) => ["paymentQueue", "detail", id] as const,
  },
  tasks: {
    root: ["tasks"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["tasks", "list", stable(filters || {})] as const,
    myOther: (filters?: Record<string, unknown>) =>
      ["tasks", "other", "my", stable(filters || {})] as const,
  },
  assessments: {
    root: ["assessments"] as const,
    templates: (filters?: Record<string, unknown>) =>
      ["assessments", "templates", stable(filters || {})] as const,
    template: (templateId: string) => ["assessments", "template", templateId] as const,
    versions: (templateId: string) => ["assessments", "versions", templateId] as const,
    submissions: (filters?: Record<string, unknown>) =>
      ["assessments", "submissions", stable(filters || {})] as const,
  },
  inbox: {
    root: ["inbox"] as const,
    my: (filters?: Record<string, unknown>) =>
      ["inbox", "my", stable(filters || {})] as const,
    workload: (filters?: Record<string, unknown>) =>
      ["inbox", "workload", stable(filters || {})] as const,
    digestPreview: (month: string, cmUid?: string) =>
      ["inbox", "digestPreview", stable({ month, cmUid: cmUid ?? null })] as const,
    digestPreviewNoop: () => ["inbox", "digestPreview", "noop"] as const,
    metrics: (month?: string) => ["inbox", "metrics", month ?? "current"] as const,
  },
  gdrive: {
    root: ["gdrive"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["gdrive", "list", stable(filters || {})] as const,
    customerFolderIndex: (query?: Record<string, unknown>) =>
      ["gdrive", "customerFolderIndex", stable(query || {})] as const,
  },
  users: {
    root: ["users"] as const,
    list: (f: Record<string, unknown> = {}) => ["users", "list", stable(f || {})] as const,
    detail: (uid: string) => ["users", "detail", uid] as const,
    me: () => ["users", "me"] as const,
  },
  acuity: {
    root: ["acuity"] as const,
    rubrics: () => ["acuity", "rubrics"] as const,
    rubric: (id: string) => ["acuity", "rubric", id] as const,
    rubricNoop: () => ["acuity", "rubric", "noop"] as const,
  },
  jotform: {
    root: ["jotform"] as const,
    forms: (filters?: Record<string, unknown>) =>
      ["jotform", "forms", stable(filters || {})] as const,
    digest: (formId: string) => ["jotform", "digest", formId] as const,
    digests: (filters?: Record<string, unknown>) =>
      ["jotform", "digests", stable(filters || {})] as const,
    list: (filters?: Record<string, unknown>) =>
      ["jotform", "list", stable(filters || {})] as const,
    detail: (id: string) => ["jotform", "detail", id] as const,
    structure: () => ["jotform", "structure"] as const,
    apiList: (formId: string, params?: Record<string, unknown>) =>
      ["jotform", "apiList", formId, stable(params || {})] as const,
    apiDetail: (id: string) => ["jotform", "apiDetail", id] as const,
  },
  tours: {
    root: ["tours"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["tours", "list", stable(filters || {})] as const,
    detail: (id: string) => ["tours", "detail", id] as const,
    structure: () => ["tours", "structure"] as const,
  },
  misc: {
    health: () => ["misc", "health"] as const,
  },
  metrics: {
    system: () => ["metrics", "system"] as const,
    systemMonth: (month: string) => ["metrics", "system", "month", month] as const,
    cm: (uid: string) => ["metrics", "cm", uid] as const,
    cmMonth: (uid: string, month: string) => ["metrics", "cm", uid, "month", month] as const,
    grant: (grantId: string) => ["metrics", "grant", grantId] as const,
    grantMonth: (grantId: string, month: string) => ["metrics", "grant", grantId, "month", month] as const,
  },
  dashboard: {
    root: ["dashboard"] as const,
    // Feature-owned orchestration key for dashboard warmup gate.
    sharedWarmup: (version = "v3") => ["dashboard", "shared-warmup", version] as const,
  },
};
