// Pure derivation model for the All Enrollments ("Customers") report.
// Everything here is deterministic on inputs so it can be unit-tested without React.

export type GrantBucket = "grant" | "program";

export type PopulationKey = "Youth" | "Individual" | "Family" | "Unknown";
export const POPULATION_KEYS: readonly PopulationKey[] = ["Youth", "Individual", "Family", "Unknown"];

export type EnrollmentReportRow = {
  enrollmentId: string;
  customerId: string;
  customerName: string;
  grantId: string;
  grantName: string;
  bucket: GrantBucket;
  caseManagerId: string;
  caseManagerName: string;
  population: PopulationKey;
  active: boolean;
  status: string;
  startDate: string;
  endDate: string;
  assistanceEndedOn: string;
  /** Whole months elapsed in this enrollment (start → end, or asOf while active). */
  monthsActive: number | null;
  /** startDate falls inside the asOf month. */
  isNewInMonth: boolean;
  migratedIn: boolean;
  migratedInFromGrantId: string;
  migratedOut: boolean;
  migratedOutToGrantId: string;
  customerActive: boolean;
  /** Anchor date used for customer tenure (first assistance date or earliest enrollment start). */
  customerSince: string;
  /** Whole months since the customer became active (to asOf while active, else to their last end date). */
  customerTenureMonths: number | null;
};

export type EnrollmentRowSummary = {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
  migratedIn: number;
  migratedOut: number;
  unknownPopulation: number;
  distinctCustomers: number;
  migratedCustomers: number;
  avgMonthsActive: number | null;
  byPopulation: Record<PopulationKey, { total: number; active: number; inactive: number; newThisMonth: number }>;
};

export type GrantGroup = {
  grantId: string;
  grantName: string;
  bucket: GrantBucket;
  summary: EnrollmentRowSummary;
  rows: EnrollmentReportRow[];
};

export type PopulationGroup = {
  population: PopulationKey;
  summary: EnrollmentRowSummary;
  rows: EnrollmentReportRow[];
};

const ISO10_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoOrEmpty(value: unknown): string {
  const s = String(value || "").slice(0, 10);
  return ISO10_RE.test(s) ? s : "";
}

/** Whole months elapsed between two ISO dates (floor). Null when either date is invalid. */
export function monthsBetweenISO(startISO: string, endISO: string): number | null {
  const start = isoOrEmpty(startISO);
  const end = isoOrEmpty(endISO);
  if (!start || !end) return null;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  let months = (ey - sy) * 12 + (em - sm);
  if (ed < sd) months -= 1;
  return Math.max(0, months);
}

export function populationKeyOf(raw: unknown): PopulationKey {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "youth") return "Youth";
  if (s === "individual") return "Individual";
  if (s === "family") return "Family";
  return "Unknown";
}

export function bucketForGrant(grant: Record<string, unknown> | undefined): GrantBucket {
  const explicitKind = String(grant?.kind || "").toLowerCase();
  if (explicitKind === "grant" || explicitKind === "program") return explicitKind as GrantBucket;

  const budget = (grant?.budget || {}) as Record<string, unknown>;
  const totals = (budget?.totals || {}) as Record<string, unknown>;
  const total = Number(budget?.total ?? totals?.total ?? budget?.startAmount ?? 0);
  return total <= 0 ? "program" : "grant";
}

export function enrollmentIsActive(e: Record<string, unknown>): boolean {
  const status = String(e?.status || "").toLowerCase();
  if (status === "active") return true;
  if (status === "closed" || status === "deleted") return false;
  return e?.active === true;
}

export function enrollmentIsDeleted(e: Record<string, unknown>): boolean {
  return String(e?.status || "").toLowerCase() === "deleted" || e?.deleted === true;
}

export function enrollmentStatusLabel(e: Record<string, unknown>): string {
  const status = String(e?.status || "").toLowerCase();
  if (status) return status;
  return enrollmentIsActive(e) ? "active" : "closed";
}

export function readCaseManagerForEnrollment(
  e: Record<string, unknown>,
  customer: Record<string, unknown> | undefined
): { id: string; name: string } {
  const enrollmentCmId = String(e?.caseManagerId || "").trim();
  const enrollmentCmName = String(e?.caseManagerName || "").trim();
  const customerCmId = String(customer?.caseManagerId || "").trim();
  const customerCmName = String(customer?.caseManagerName || "").trim();

  const id = enrollmentCmId || customerCmId;
  const name = enrollmentCmName || customerCmName || id || "Unassigned";
  return { id: id || "unassigned", name };
}

function customerIsActive(customer: Record<string, unknown> | undefined): boolean {
  if (!customer) return false;
  const status = String(customer?.status || "").toLowerCase();
  if (status === "active") return true;
  if (status === "inactive" || status === "deleted") return false;
  return customer?.active === true;
}

export type BuildRowsInput = {
  enrollments: Array<Record<string, unknown>>;
  customersById: Map<string, Record<string, unknown>>;
  grantsById: Map<string, Record<string, unknown>>;
  customerNameById: Map<string, string>;
  grantNameById: Map<string, string>;
  /** ISO date used as "today" for month math (YYYY-MM-DD). */
  asOf: string;
};

export function buildEnrollmentReportRows(input: BuildRowsInput): EnrollmentReportRow[] {
  const { enrollments, customersById, grantsById, customerNameById, grantNameById } = input;
  const asOf = isoOrEmpty(input.asOf);
  const asOfMonth = asOf.slice(0, 7);

  // Per-customer tenure anchors derived from all (non-deleted) enrollments.
  const earliestStartByCustomer = new Map<string, string>();
  const latestEndByCustomer = new Map<string, string>();
  const seenIds = new Set<string>();
  const deduped: Array<Record<string, unknown>> = [];

  for (const raw of enrollments) {
    if (!raw || enrollmentIsDeleted(raw)) continue;
    const id = String(raw?.id || "").trim();
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    deduped.push(raw);

    const customerId = String(raw?.customerId || raw?.clientId || "").trim();
    if (!customerId) continue;
    const start = isoOrEmpty(raw?.startDate);
    if (start) {
      const prev = earliestStartByCustomer.get(customerId);
      if (!prev || start < prev) earliestStartByCustomer.set(customerId, start);
    }
    const end = isoOrEmpty(raw?.endDate);
    if (end) {
      const prev = latestEndByCustomer.get(customerId);
      if (!prev || end > prev) latestEndByCustomer.set(customerId, end);
    }
  }

  const rows: EnrollmentReportRow[] = [];
  for (const raw of deduped) {
    const grantId = String(raw?.grantId || "").trim();
    if (!grantId) continue;
    const customerId = String(raw?.customerId || raw?.clientId || "").trim();
    const customer = customersById.get(customerId);
    const grant = grantsById.get(grantId);
    const cm = readCaseManagerForEnrollment(raw, customer);
    const active = enrollmentIsActive(raw);
    const startDate = isoOrEmpty(raw?.startDate);
    const endDate = isoOrEmpty(raw?.endDate);
    const grantClosed = ["closed", "deleted"].includes(String(grant?.status || "").toLowerCase()) || grant?.active === false;
    const monthsEnd = active || !endDate ? asOf : endDate;
    const migratedFrom = (raw?.migratedFrom || null) as Record<string, unknown> | null;
    const migratedTo = (raw?.migratedTo || null) as Record<string, unknown> | null;

    const assistance = (customer?.assistanceLength || {}) as Record<string, unknown>;
    const firstAssistance = isoOrEmpty(assistance?.firstDateOfAssistance);
    const earliestStart = earliestStartByCustomer.get(customerId) || "";
    const customerSince =
      firstAssistance && earliestStart
        ? (firstAssistance < earliestStart ? firstAssistance : earliestStart)
        : firstAssistance || earliestStart;
    const custActive = customerIsActive(customer);
    const tenureEnd = custActive ? asOf : latestEndByCustomer.get(customerId) || asOf;

    rows.push({
      enrollmentId: String(raw?.id || `${grantId}:${customerId}:${rows.length}`),
      customerId,
      customerName:
        customerNameById.get(customerId) ||
        String(raw?.customerName || raw?.clientName || customerId || "-"),
      grantId,
      grantName: grantNameById.get(grantId) || String(grant?.name || grantId),
      bucket: bucketForGrant(grant),
      caseManagerId: cm.id,
      caseManagerName: cm.name,
      population: populationKeyOf(customer?.population),
      active,
      status: enrollmentStatusLabel(raw),
      startDate,
      endDate,
      assistanceEndedOn: !active || grantClosed ? (endDate || isoOrEmpty(grant?.endDate)) : "",
      monthsActive: monthsBetweenISO(startDate, monthsEnd),
      isNewInMonth: !!asOfMonth && !!startDate && startDate.slice(0, 7) === asOfMonth,
      migratedIn: !!migratedFrom?.enrollmentId || !!migratedFrom?.grantId,
      migratedInFromGrantId: String(migratedFrom?.grantId || ""),
      migratedOut: !!migratedTo?.enrollmentId || !!migratedTo?.grantId,
      migratedOutToGrantId: String(migratedTo?.grantId || ""),
      customerActive: custActive,
      customerSince,
      customerTenureMonths: monthsBetweenISO(customerSince, tenureEnd),
    });
  }
  return rows;
}

function emptyPopulationCounts(): EnrollmentRowSummary["byPopulation"] {
  return {
    Youth: { total: 0, active: 0, inactive: 0, newThisMonth: 0 },
    Individual: { total: 0, active: 0, inactive: 0, newThisMonth: 0 },
    Family: { total: 0, active: 0, inactive: 0, newThisMonth: 0 },
    Unknown: { total: 0, active: 0, inactive: 0, newThisMonth: 0 },
  };
}

export function summarizeEnrollmentRows(rows: EnrollmentReportRow[]): EnrollmentRowSummary {
  const byPopulation = emptyPopulationCounts();
  const customers = new Set<string>();
  const migratedCustomers = new Set<string>();
  let active = 0;
  let newThisMonth = 0;
  let migratedIn = 0;
  let migratedOut = 0;
  let monthsSum = 0;
  let monthsCount = 0;

  for (const r of rows) {
    if (r.customerId) customers.add(r.customerId);
    if (r.active) active += 1;
    if (r.isNewInMonth) newThisMonth += 1;
    if (r.migratedIn) {
      migratedIn += 1;
      if (r.customerId) migratedCustomers.add(r.customerId);
    }
    if (r.migratedOut) {
      migratedOut += 1;
      if (r.customerId) migratedCustomers.add(r.customerId);
    }
    if (r.monthsActive != null) {
      monthsSum += r.monthsActive;
      monthsCount += 1;
    }
    const pop = byPopulation[r.population];
    pop.total += 1;
    if (r.active) pop.active += 1;
    else pop.inactive += 1;
    if (r.isNewInMonth) pop.newThisMonth += 1;
  }

  return {
    total: rows.length,
    active,
    inactive: rows.length - active,
    newThisMonth,
    migratedIn,
    migratedOut,
    unknownPopulation: byPopulation.Unknown.total,
    distinctCustomers: customers.size,
    migratedCustomers: migratedCustomers.size,
    avgMonthsActive: monthsCount ? Math.round((monthsSum / monthsCount) * 10) / 10 : null,
    byPopulation,
  };
}

export function groupRowsByGrant(rows: EnrollmentReportRow[]): GrantGroup[] {
  const byGrant = new Map<string, EnrollmentReportRow[]>();
  for (const r of rows) {
    byGrant.set(r.grantId, [...(byGrant.get(r.grantId) || []), r]);
  }
  const out: GrantGroup[] = [];
  for (const [grantId, groupRows] of byGrant) {
    const sorted = [...groupRows].sort((a, b) => a.customerName.localeCompare(b.customerName));
    out.push({
      grantId,
      grantName: groupRows[0].grantName,
      bucket: groupRows[0].bucket,
      summary: summarizeEnrollmentRows(sorted),
      rows: sorted,
    });
  }
  out.sort((a, b) => a.grantName.localeCompare(b.grantName));
  return out;
}

export function groupRowsByPopulation(rows: EnrollmentReportRow[]): PopulationGroup[] {
  return POPULATION_KEYS.map((population) => {
    const groupRows = rows
      .filter((r) => r.population === population)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
    return { population, summary: summarizeEnrollmentRows(groupRows), rows: groupRows };
  });
}

export type EnrollmentRowFilters = {
  bucket: "all" | GrantBucket;
  caseManagerId: string;
  status: "all" | "active" | "inactive";
  population: "all" | PopulationKey;
  newThisMonth: boolean;
  migratedOnly: boolean;
  query: string;
};

/** Base filters (scope the whole report): bucket, case manager, text query. */
export function applyBaseFilters(
  rows: EnrollmentReportRow[],
  filters: Pick<EnrollmentRowFilters, "bucket" | "caseManagerId" | "query">
): EnrollmentReportRow[] {
  const q = filters.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.bucket !== "all" && r.bucket !== filters.bucket) return false;
    if (filters.caseManagerId !== "all" && r.caseManagerId !== filters.caseManagerId) return false;
    if (q) {
      const haystack = `${r.customerName} ${r.grantName} ${r.caseManagerName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Metric-chip filters (narrow the visible rows): status, population, new-this-month, migrated. */
export function applyChipFilters(
  rows: EnrollmentReportRow[],
  filters: Pick<EnrollmentRowFilters, "status" | "population" | "newThisMonth" | "migratedOnly">
): EnrollmentReportRow[] {
  return rows.filter((r) => {
    if (filters.status === "active" && !r.active) return false;
    if (filters.status === "inactive" && r.active) return false;
    if (filters.population !== "all" && r.population !== filters.population) return false;
    if (filters.newThisMonth && !r.isNewInMonth) return false;
    if (filters.migratedOnly && !r.migratedIn && !r.migratedOut) return false;
    return true;
  });
}
