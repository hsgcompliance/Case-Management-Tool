import { contactCaseManagerIdsForCustomer } from "../../customers/contactCaseManagers";

export type CaseManagerReportStats = {
  activeCaseload: number;
  inactiveCustomers: number;
  newCustomersThisMonth: number;
  changedCustomersThisMonth: number;
  activeEnrollments: number;
  totalAllocation: number;
  tier1: number;
  tier2: number;
  tier3: number;
  untiered: number;
};

export function emptyCaseManagerReportStats(): CaseManagerReportStats {
  return {
    activeCaseload: 0,
    inactiveCustomers: 0,
    newCustomersThisMonth: 0,
    changedCustomersThisMonth: 0,
    activeEnrollments: 0,
    totalAllocation: 0,
    tier1: 0,
    tier2: 0,
    tier3: 0,
    untiered: 0,
  };
}

export function reportCustomerIsActive(customer: Record<string, unknown>): boolean {
  if (typeof customer.active === "boolean") return customer.active;
  const status = String(customer.status || "").toLowerCase();
  return !status || status === "active";
}

export function reportEnrollmentIsActive(enrollment: Record<string, unknown>): boolean {
  if (enrollment.deleted === true || String(enrollment.status || "").toLowerCase() === "deleted") return false;
  const status = String(enrollment.status || "").toLowerCase();
  if (status === "closed" || status === "inactive") return false;
  return enrollment.active === true || status === "active" || status === "open";
}

export function effectiveEnrollmentAllocation(enrollment: Record<string, unknown>): number {
  const allocation = enrollment.clientAllocation as Record<string, unknown> | null | undefined;
  const assigned = allocation?.amount == null ? null : Number(allocation.amount);
  if (assigned != null && Number.isFinite(assigned) && assigned >= 0) return assigned;

  return (Array.isArray(enrollment.payments) ? enrollment.payments : []).reduce((sum, raw) => {
    const payment = raw as Record<string, unknown>;
    if (payment.void === true) return sum;
    const amount = Number(payment.amount || 0);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
}

function enrollmentChangedInMonth(enrollment: Record<string, unknown>, month: string): boolean {
  const migratedFrom = enrollment.migratedFrom as Record<string, unknown> | null | undefined;
  const migratedTo = enrollment.migratedTo as Record<string, unknown> | null | undefined;
  const continuity = enrollment.continuity as Record<string, unknown> | null | undefined;
  return [
    enrollment.startDate,
    enrollment.endDate,
    migratedFrom?.cutover,
    migratedTo?.cutover,
    continuity?.cutoffDate,
  ].some((value) => String(value || "").slice(0, 7) === month);
}

export function buildCaseManagerReport(args: {
  caseManagerIds: string[];
  customers: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
  month: string;
}) {
  const statsByUid = new Map<string, CaseManagerReportStats>();
  const customersByUid = new Map<string, Array<Record<string, unknown>>>();
  const enrollmentsByCustomerId = new Map<string, Array<Record<string, unknown>>>();
  const customerById = new Map<string, Record<string, unknown>>();
  const newCustomerIdsByUid = new Map<string, Set<string>>();
  const changedCustomerIdsByUid = new Map<string, Set<string>>();

  const ensure = (uid: string) => {
    const current = statsByUid.get(uid);
    if (current) return current;
    const created = emptyCaseManagerReportStats();
    statsByUid.set(uid, created);
    return created;
  };

  args.caseManagerIds.filter(Boolean).forEach(ensure);

  for (const customer of args.customers) {
    const customerId = String(customer.id || "").trim();
    if (customerId) customerById.set(customerId, customer);
    const contactIds = contactCaseManagerIdsForCustomer(customer);
    for (const uid of contactIds) {
      const rows = customersByUid.get(uid) || [];
      rows.push(customer);
      customersByUid.set(uid, rows);
    }

    const primaryUid = String(customer.caseManagerId || "").trim();
    if (!primaryUid) continue;
    const stats = ensure(primaryUid);
    if (!reportCustomerIsActive(customer)) {
      stats.inactiveCustomers += 1;
      continue;
    }
    stats.activeCaseload += 1;
    const tier = Number(customer.tier);
    if (tier === 1) stats.tier1 += 1;
    else if (tier === 2) stats.tier2 += 1;
    else if (tier === 3) stats.tier3 += 1;
    else stats.untiered += 1;
  }

  for (const enrollment of args.enrollments) {
    if (enrollment.deleted === true || String(enrollment.status || "").toLowerCase() === "deleted") continue;
    const customerId = String(enrollment.customerId || enrollment.clientId || "").trim();
    if (!customerId) continue;
    const rows = enrollmentsByCustomerId.get(customerId) || [];
    rows.push(enrollment);
    enrollmentsByCustomerId.set(customerId, rows);

    const customer = customerById.get(customerId);
    const uid = String(enrollment.caseManagerId || customer?.caseManagerId || "").trim();
    if (!uid) continue;
    const stats = ensure(uid);
    if (reportEnrollmentIsActive(enrollment)) {
      stats.activeEnrollments += 1;
      stats.totalAllocation += effectiveEnrollmentAllocation(enrollment);
    }
    if (String(enrollment.startDate || "").slice(0, 7) === args.month) {
      const ids = newCustomerIdsByUid.get(uid) || new Set<string>();
      ids.add(customerId);
      newCustomerIdsByUid.set(uid, ids);
    }
    if (enrollmentChangedInMonth(enrollment, args.month)) {
      const ids = changedCustomerIdsByUid.get(uid) || new Set<string>();
      ids.add(customerId);
      changedCustomerIdsByUid.set(uid, ids);
    }
  }

  for (const [uid, stats] of statsByUid) {
    stats.newCustomersThisMonth = newCustomerIdsByUid.get(uid)?.size || 0;
    stats.changedCustomersThisMonth = changedCustomerIdsByUid.get(uid)?.size || 0;
  }

  return { statsByUid, customersByUid, enrollmentsByCustomerId };
}
