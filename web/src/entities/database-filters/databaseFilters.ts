"use client";

/**
 * Database filter config for reconciliation. Describes, per source collection,
 * whether it participates and how its rows are narrowed before they feed the
 * review engine. Defaults are permissive (everything except soft-deleted rows),
 * so a fresh config behaves like "use the whole cache".
 *
 * Pure model + predicates only — the panel UI lives in `DatabaseFilterPanel.tsx`.
 */

export type TriState = "any" | "yes" | "no";

export type CustomerFilters = {
  enabled: boolean;
  search: string;
  status: "any" | "active" | "inactive";
  includeDeleted: boolean;
  caseload: "any" | "active" | "inactive";
  caseManager: "any" | "assigned" | "unassigned";
  hmisId: TriState;
  caseworthyId: TriState;
  dob: TriState;
  acuityMin: number | null;
  acuityMax: number | null;
};

export type EnrollmentFilters = {
  enabled: boolean;
  search: string;
  status: "any" | "active" | "closed";
  includeDeleted: boolean;
  exitDate: TriState;
  caseManager: "any" | "assigned" | "unassigned";
  grantId: string;
  entryFrom: string;
  entryTo: string;
  hasScheduledPayments: TriState;
};

export type GrantFilters = {
  enabled: boolean;
  search: string;
  status: "any" | "active" | "inactive";
  includeDeleted: boolean;
  grantType: string;
  hasBudget: TriState;
  hasBalance: TriState;
  fiscalYear: string;
};

export type PaymentQueueFilters = {
  enabled: boolean;
  search: string;
  queueStatus: "any" | "pending" | "posted" | "void";
  source: "any" | "credit-card" | "invoice" | "projection" | "unknown";
  matched: "any" | "matched" | "unmatched";
  okUnassigned: TriState;
  isFlex: TriState;
  hasCustomer: TriState;
  monthFrom: string;
  monthTo: string;
  amountMin: number | null;
  amountMax: number | null;
};

export type LedgerFilters = {
  enabled: boolean;
  search: string;
  paidStatus: "any" | "paid" | "unpaid";
  source: "any" | "enrollment" | "manual" | "card" | "migration" | "adjustment" | "system";
  direction: "any" | "charge" | "return";
  grantId: string;
  hasCustomer: TriState;
  isReversal: TriState;
  monthFrom: string;
  monthTo: string;
  amountMin: number | null;
  amountMax: number | null;
};

export type DatabaseFilterConfig = {
  customers: CustomerFilters;
  enrollments: EnrollmentFilters;
  grants: GrantFilters;
  paymentQueue: PaymentQueueFilters;
  ledger: LedgerFilters;
};

export type DatabaseCollectionKey = keyof DatabaseFilterConfig;

export const DEFAULT_DATABASE_FILTER_CONFIG: DatabaseFilterConfig = {
  customers: {
    enabled: true,
    search: "",
    status: "any",
    includeDeleted: false,
    caseload: "any",
    caseManager: "any",
    hmisId: "any",
    caseworthyId: "any",
    dob: "any",
    acuityMin: null,
    acuityMax: null,
  },
  enrollments: {
    enabled: true,
    search: "",
    status: "any",
    includeDeleted: false,
    exitDate: "any",
    caseManager: "any",
    grantId: "",
    entryFrom: "",
    entryTo: "",
    hasScheduledPayments: "any",
  },
  grants: {
    enabled: true,
    search: "",
    status: "any",
    includeDeleted: false,
    grantType: "",
    hasBudget: "any",
    hasBalance: "any",
    fiscalYear: "",
  },
  paymentQueue: {
    enabled: true,
    search: "",
    queueStatus: "any",
    source: "any",
    matched: "any",
    okUnassigned: "any",
    isFlex: "any",
    hasCustomer: "any",
    monthFrom: "",
    monthTo: "",
    amountMin: null,
    amountMax: null,
  },
  ledger: {
    enabled: true,
    search: "",
    paidStatus: "any",
    source: "any",
    direction: "any",
    grantId: "",
    hasCustomer: "any",
    isReversal: "any",
    monthFrom: "",
    monthTo: "",
    amountMin: null,
    amountMax: null,
  },
};

// ── tolerant accessors ────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "").trim();
const lower = (v: unknown) => str(v).toLowerCase();
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const has = (v: unknown) => str(v).length > 0;
const includesSearch = (query: string, values: unknown[]) => {
  const q = lower(query);
  if (!q) return true;
  return values.some((value) => lower(value).includes(q));
};

function isActiveLike(row: Row) {
  if (row.deleted === true) return false;
  if (typeof row.active === "boolean") return row.active;
  const s = lower(row.status);
  if (["deleted", "inactive", "closed", "exited", "archived", "void"].includes(s)) return false;
  return true;
}

function triPass(state: TriState, present: boolean) {
  if (state === "any") return true;
  return state === "yes" ? present : !present;
}

// ── per-collection predicates ─────────────────────────────────────────────────
function customerPasses(c: Row, f: CustomerFilters): boolean {
  if (!f.includeDeleted && c.deleted === true) return false;
  if (!includesSearch(f.search, [
    c.id,
    c.firstName,
    c.lastName,
    c.fullName,
    c.name,
    c.alias,
    c.hmisId,
    c.HMISId,
    c.caseworthyId,
    c.cwId,
    c.caseManagerName,
  ])) return false;
  if (f.status === "active" && !isActiveLike(c)) return false;
  if (f.status === "inactive" && isActiveLike(c)) return false;
  const caseloadActive = c.caseloadActive === true || Number(c.caseloadActive) > 0;
  if (f.caseload === "active" && !caseloadActive) return false;
  if (f.caseload === "inactive" && caseloadActive) return false;
  const cm = has(c.caseManagerId ?? c.assignedToUid ?? c.caseManagerUid);
  if (f.caseManager === "assigned" && !cm) return false;
  if (f.caseManager === "unassigned" && cm) return false;
  if (!triPass(f.hmisId, has(c.hmisId ?? c.HMISId ?? c.hmisClientId ?? c.clientId))) return false;
  if (!triPass(f.caseworthyId, has(c.caseworthyId ?? c.caseWorthyId ?? c.cwId))) return false;
  if (!triPass(f.dob, has(c.dob ?? c.dateOfBirth ?? c.birthDate))) return false;
  const acuity = num(c.acuityScore ?? c.acuity);
  if (f.acuityMin != null && (acuity == null || acuity < f.acuityMin)) return false;
  if (f.acuityMax != null && (acuity == null || acuity > f.acuityMax)) return false;
  return true;
}

function enrollmentPasses(e: Row, f: EnrollmentFilters): boolean {
  if (!f.includeDeleted && e.deleted === true) return false;
  if (!includesSearch(f.search, [
    e.id,
    e.customerId,
    e.customerName,
    e.name,
    e.grantId,
    e.grantName,
    e.programId,
    e.programName,
    e.projectName,
    e.caseManagerName,
  ])) return false;
  const hasExit = has(e.exitDate ?? e.endDate ?? e.closedAt);
  const closed = hasExit || !isActiveLike(e);
  if (f.status === "active" && closed) return false;
  if (f.status === "closed" && !closed) return false;
  if (!triPass(f.exitDate, hasExit)) return false;
  const cm = has(e.caseManagerId ?? e.assignedToUid ?? e.caseManagerUid);
  if (f.caseManager === "assigned" && !cm) return false;
  if (f.caseManager === "unassigned" && cm) return false;
  if (f.grantId && str(e.grantId ?? e.grantID) !== f.grantId) return false;
  const entry = str(e.entryDate ?? e.startDate ?? e.enrolledAt).slice(0, 10);
  if (f.entryFrom && (!entry || entry < f.entryFrom)) return false;
  if (f.entryTo && (!entry || entry > f.entryTo)) return false;
  const payments = Array.isArray(e.payments) ? e.payments : [];
  if (!triPass(f.hasScheduledPayments, payments.length > 0)) return false;
  return true;
}

function grantPasses(g: Row, f: GrantFilters): boolean {
  if (!f.includeDeleted && g.deleted === true) return false;
  if (!includesSearch(f.search, [
    g.id,
    g.name,
    g.grantName,
    g.label,
    g.title,
    g.type,
    g.kind,
    g.grantType,
    g.category,
    g.fiscalYear,
  ])) return false;
  if (f.status === "active" && !isActiveLike(g)) return false;
  if (f.status === "inactive" && isActiveLike(g)) return false;
  if (f.grantType) {
    const type = lower(g.type ?? g.kind ?? g.grantType ?? g.category) || lower(g.name);
    if (!type.includes(lower(f.grantType))) return false;
  }
  const budget = g.budget && typeof g.budget === "object" ? (g.budget as Row) : {};
  const totals = budget.totals && typeof budget.totals === "object" ? (budget.totals as Row) : {};
  const total = num(budget.total ?? totals.total);
  if (!triPass(f.hasBudget, total != null && total > 0)) return false;
  const balance = num(totals.balance ?? totals.projectedBalance);
  if (!triPass(f.hasBalance, balance != null && balance > 0)) return false;
  if (f.fiscalYear && str(g.fiscalYear ?? g.fy ?? g.year) !== f.fiscalYear) return false;
  return true;
}

function paymentQueuePasses(p: Row, f: PaymentQueueFilters): boolean {
  if (!includesSearch(f.search, [
    p.id,
    p.customerId,
    p.customerName,
    p.customerNameAtSpend,
    p.vendor,
    p.merchant,
    p.payee,
    p.landlord,
    p.grantId,
    p.grantName,
    p.description,
    p.note,
    p.notes,
  ])) return false;
  if (f.queueStatus !== "any" && lower(p.queueStatus) !== f.queueStatus) return false;
  if (f.source !== "any" && lower(p.source) !== f.source) return false;
  const matched = has(p.grantId);
  if (f.matched === "matched" && !matched) return false;
  if (f.matched === "unmatched" && matched) return false;
  if (!triPass(f.okUnassigned, p.okUnassigned === true)) return false;
  if (!triPass(f.isFlex, p.isFlex === true)) return false;
  if (!triPass(f.hasCustomer, has(p.customerId))) return false;
  const month = str(p.month) || str(p.dueDate ?? p.transactionDate).slice(0, 7);
  if (f.monthFrom && (!month || month < f.monthFrom)) return false;
  if (f.monthTo && (!month || month > f.monthTo)) return false;
  const amount = num(p.amountAbs ?? p.amount);
  const abs = amount == null ? null : Math.abs(amount);
  if (f.amountMin != null && (abs == null || abs < f.amountMin)) return false;
  if (f.amountMax != null && (abs == null || abs > f.amountMax)) return false;
  return true;
}

function ledgerPasses(l: Row, f: LedgerFilters): boolean {
  if (!includesSearch(f.search, [
    l.id,
    l.customerId,
    l.customerName,
    l.vendor,
    l.merchant,
    l.payee,
    l.landlord,
    l.grantId,
    l.grantName,
    l.description,
    l.note,
    l.notes,
    l.reference,
  ])) return false;
  if (f.source !== "any" && lower(l.source) !== f.source) return false;
  const paid = l.paid === true || has(l.paidAt) || has(l.origin && typeof l.origin === "object" ? (l.origin as Row).paymentQueueId : null);
  if (f.paidStatus === "paid" && !paid) return false;
  if (f.paidStatus === "unpaid" && paid) return false;
  const amount = num(l.amount ?? l.amountCents);
  const direction = str(l.direction) || (amount != null && amount < 0 ? "return" : "charge");
  if (f.direction !== "any" && direction !== f.direction) return false;
  if (f.grantId && str(l.grantId) !== f.grantId) return false;
  if (!triPass(f.hasCustomer, has(l.customerId))) return false;
  const labels = Array.isArray(l.labels) ? l.labels.map((x) => lower(x)) : [];
  const isReversal = has(l.reversalOf) || labels.includes("reversal");
  if (!triPass(f.isReversal, isReversal)) return false;
  const month = str(l.month) || str(l.dueDate ?? l.date).slice(0, 7);
  if (f.monthFrom && (!month || month < f.monthFrom)) return false;
  if (f.monthTo && (!month || month > f.monthTo)) return false;
  const abs = amount == null ? null : Math.abs(amount > 1000 && Number.isInteger(amount) ? amount / 100 : amount);
  if (f.amountMin != null && (abs == null || abs < f.amountMin)) return false;
  if (f.amountMax != null && (abs == null || abs > f.amountMax)) return false;
  return true;
}

export type DatabaseSourceData = {
  customers?: Row[];
  enrollments?: Row[];
  grants?: Row[];
  paymentQueueItems?: Row[];
  ledger?: Row[];
};

/** Apply the config to cached source arrays. Disabled collections return []. */
export function applyDatabaseFilters(config: DatabaseFilterConfig, data: DatabaseSourceData) {
  return {
    customers: config.customers.enabled ? (data.customers ?? []).filter((row) => customerPasses(row, config.customers)) : [],
    enrollments: config.enrollments.enabled ? (data.enrollments ?? []).filter((row) => enrollmentPasses(row, config.enrollments)) : [],
    grants: config.grants.enabled ? (data.grants ?? []).filter((row) => grantPasses(row, config.grants)) : [],
    paymentQueueItems: config.paymentQueue.enabled ? (data.paymentQueueItems ?? []).filter((row) => paymentQueuePasses(row, config.paymentQueue)) : [],
    ledger: config.ledger.enabled ? (data.ledger ?? []).filter((row) => ledgerPasses(row, config.ledger)) : [],
  };
}

/** Count of non-default (active) filters in a collection — for compact UI summaries. */
export function countActiveFilters(key: DatabaseCollectionKey, config: DatabaseFilterConfig): number {
  const current = config[key] as Record<string, unknown>;
  const base = DEFAULT_DATABASE_FILTER_CONFIG[key] as Record<string, unknown>;
  let count = 0;
  for (const field of Object.keys(current)) {
    if (field === "enabled") continue;
    if (current[field] !== base[field]) count += 1;
  }
  return count;
}
