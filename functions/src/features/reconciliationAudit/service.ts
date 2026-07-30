// functions/src/features/reconciliationAudit/service.ts
//
// Phase 3 standalone audit scan (schedule-drift-reconciliation-tool.md §6):
// pure read-side, no uploaded report required.
//
// 1. Duplicate schedule scan — customer+grant groups with 2+ customerEnrollments
//    docs (any status, deleted included) whose date ranges overlap. Reuses the
//    same interval-overlap primitive already wired into enrollment creation/
//    reopen (see ../enrollments/overlap.ts) instead of a second implementation.
// 2. Orphan scan — ledger/paymentQueue rows still pointing at a deleted/closed
//    enrollment: unreversed ledger entries (net amount per paymentId is
//    nonzero) and paymentQueue rows still queueStatus:"pending".
//
// Enrollments under a closed/deleted grant are cascaded closed already and have
// nothing left to reconcile, so the org's open grants are resolved first and the
// customerEnrollments query is scoped to just those grantIds — closed-grant rows
// are never fetched. This keeps scan cost tied to the org's *active* footprint
// instead of growing with its full history as more grants close over time.
import { db, toDate, toDateOnly } from "../../core";
import { findOverlappingEnrollments } from "../enrollments/overlap";
import type {
  TReconciliationAuditDuplicateFinding,
  TReconciliationAuditEnrollmentSummary,
  TReconciliationAuditOrphanFinding,
  TReconciliationAuditScanResp,
} from "./schemas";

const ORPHAN_STATUSES = new Set(["deleted", "closed"]);
// Grants in these states are no longer live: their enrollments have already been
// cascaded closed, so there is nothing to reconcile — skip them entirely.
const SKIP_GRANT_STATUSES = new Set(["closed", "deleted"]);
const MAX_ENROLLMENTS = 5000;
const IN_CHUNK = 10;

type EnrollmentRow = {
  id: string;
  customerId?: unknown;
  grantId?: unknown;
  status?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  payments?: Array<{ amount?: unknown; paid?: boolean | null; void?: boolean | null }> | null;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function summarizeEnrollment(row: EnrollmentRow, pendingQueueCount: number): TReconciliationAuditEnrollmentSummary {
  const payments = Array.isArray(row.payments) ? row.payments : [];
  const paid = payments.filter((p) => p?.paid === true && p?.void !== true);
  const paidTotal = paid.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
  return {
    id: row.id,
    status: textOrNull(row.status),
    startDate: toDateOnly(row.startDate as any) || null,
    endDate: toDateOnly(row.endDate as any) || null,
    paidCount: paid.length,
    paidTotal: Math.round(paidTotal * 100) / 100,
    pendingQueueCount,
  };
}

/** Groups enrollments by (customerId, grantId) and returns only the groups with a real date-range overlap. */
function findDuplicateGroups(rows: EnrollmentRow[]): Map<string, EnrollmentRow[]> {
  const groups = new Map<string, EnrollmentRow[]>();
  for (const row of rows) {
    const customerId = textOrNull(row.customerId);
    const grantId = textOrNull(row.grantId);
    if (!customerId || !grantId) continue;
    const key = `${customerId}::${grantId}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const flagged = new Map<string, EnrollmentRow[]>();
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const windowRows = list.map((row) => ({
      id: row.id,
      grantId: textOrNull(row.grantId),
      startDate: row.startDate,
      endDate: row.endDate,
    }));
    const overlaps = findOverlappingEnrollments(windowRows, (v) => toDate(v as any));
    if (!overlaps.length) continue;
    const ids = new Set<string>();
    for (const { a, b } of overlaps) {
      ids.add(a.id);
      ids.add(b.id);
    }
    flagged.set(
      key,
      list.filter((r) => ids.has(r.id)),
    );
  }
  return flagged;
}

/**
 * Resolves which grants the scan should touch, so closed/deleted grants never
 * enter the customerEnrollments query at all (as opposed to fetching every
 * enrollment row and filtering after the fact — as the org's history of closed
 * grants grows, that fetch-everything approach only gets more wasteful).
 * `requestedGrantIds` (from the caller's grantIds filter) is intersected with
 * the eligible set when present; otherwise every open grant for the org is used.
 */
async function resolveScanGrantIds(orgId: string, requestedGrantIds: string[] | null): Promise<string[]> {
  const grantsSnap = await db.collection("grants").where("orgId", "==", orgId).get();
  const eligible: string[] = [];
  for (const doc of grantsSnap.docs) {
    const status = String((doc.data() || {}).status || "");
    if (!SKIP_GRANT_STATUSES.has(status)) eligible.push(doc.id);
  }
  if (!requestedGrantIds) return eligible;
  const eligibleSet = new Set(eligible);
  return requestedGrantIds.filter((id) => eligibleSet.has(id));
}

async function countPendingQueueByEnrollment(enrollmentIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const idsChunk of chunk(enrollmentIds, IN_CHUNK)) {
    if (!idsChunk.length) continue;
    const snap = await db.collection("paymentQueue").where("enrollmentId", "in", idsChunk).get();
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      if (String(data.queueStatus || "") !== "pending") continue;
      const enrollmentId = String(data.enrollmentId || "");
      counts.set(enrollmentId, (counts.get(enrollmentId) || 0) + 1);
    }
  }
  return counts;
}

async function scanOrphans(orphanById: Map<string, EnrollmentRow>): Promise<TReconciliationAuditOrphanFinding[]> {
  const findings: TReconciliationAuditOrphanFinding[] = [];
  const orphanIds = Array.from(orphanById.keys());

  for (const idsChunk of chunk(orphanIds, IN_CHUNK)) {
    if (!idsChunk.length) continue;
    const [ledgerSnap, queueSnap] = await Promise.all([
      db.collection("ledger").where("enrollmentId", "in", idsChunk).get(),
      db.collection("paymentQueue").where("enrollmentId", "in", idsChunk).get(),
    ]);

    // Ledger: net amount per (enrollmentId, paymentId) — a properly reversed
    // pair (original + its exact-opposite reversal) nets to zero and is not
    // flagged; anything left over on a dead enrollment is real orphaned spend.
    const ledgerGroups = new Map<
      string,
      { enrollmentId: string; paymentId: string | null; netCents: number; ids: string[] }
    >();
    for (const doc of ledgerSnap.docs) {
      const data = doc.data() || {};
      const enrollmentId = String(data.enrollmentId || "");
      const paymentId = textOrNull(data.paymentId);
      const cents = Number.isFinite(Number(data.amountCents))
        ? Number(data.amountCents)
        : Math.round((Number(data.amount) || 0) * 100);
      const key = `${enrollmentId}::${paymentId || doc.id}`;
      const group = ledgerGroups.get(key) || { enrollmentId, paymentId, netCents: 0, ids: [] };
      group.netCents += cents;
      group.ids.push(doc.id);
      ledgerGroups.set(key, group);
    }
    for (const group of ledgerGroups.values()) {
      if (group.netCents === 0) continue;
      const enrollment = orphanById.get(group.enrollmentId);
      findings.push({
        type: "orphaned_ledger_or_queue",
        severity: "error",
        source: "ledger",
        enrollmentId: group.enrollmentId,
        enrollmentStatus: enrollment ? textOrNull(enrollment.status) : null,
        customerId: enrollment ? textOrNull(enrollment.customerId) : null,
        customerName: null,
        grantId: enrollment ? textOrNull(enrollment.grantId) : null,
        grantName: null,
        paymentId: group.paymentId,
        netAmount: Math.round(group.netCents) / 100,
        queueStatus: null,
        rowIds: group.ids,
      });
    }

    // paymentQueue: still-pending rows against a dead enrollment.
    const queueByEnrollment = new Map<string, string[]>();
    for (const doc of queueSnap.docs) {
      const data = doc.data() || {};
      if (String(data.queueStatus || "") !== "pending") continue;
      const enrollmentId = String(data.enrollmentId || "");
      const ids = queueByEnrollment.get(enrollmentId) || [];
      ids.push(doc.id);
      queueByEnrollment.set(enrollmentId, ids);
    }
    for (const [enrollmentId, ids] of queueByEnrollment) {
      const enrollment = orphanById.get(enrollmentId);
      findings.push({
        type: "orphaned_ledger_or_queue",
        severity: "error",
        source: "paymentQueue",
        enrollmentId,
        enrollmentStatus: enrollment ? textOrNull(enrollment.status) : null,
        customerId: enrollment ? textOrNull(enrollment.customerId) : null,
        customerName: null,
        grantId: enrollment ? textOrNull(enrollment.grantId) : null,
        grantName: null,
        paymentId: null,
        netAmount: null,
        queueStatus: "pending",
        rowIds: ids,
      });
    }
  }

  return findings;
}

async function attachNames(
  duplicateFindings: TReconciliationAuditDuplicateFinding[],
  orphanFindings: TReconciliationAuditOrphanFinding[],
): Promise<void> {
  const customerIds = new Set<string>();
  const grantIds = new Set<string>();
  for (const finding of duplicateFindings) {
    customerIds.add(finding.customerId);
    grantIds.add(finding.grantId);
  }
  for (const finding of orphanFindings) {
    if (finding.customerId) customerIds.add(finding.customerId);
    if (finding.grantId) grantIds.add(finding.grantId);
  }
  if (!customerIds.size && !grantIds.size) return;

  const [customerDocs, grantDocs] = await Promise.all([
    customerIds.size
      ? db.getAll(...Array.from(customerIds).map((id) => db.collection("customers").doc(id)))
      : Promise.resolve([] as FirebaseFirestore.DocumentSnapshot[]),
    grantIds.size
      ? db.getAll(...Array.from(grantIds).map((id) => db.collection("grants").doc(id)))
      : Promise.resolve([] as FirebaseFirestore.DocumentSnapshot[]),
  ]);

  const customerNameById = new Map<string, string>();
  for (const snap of customerDocs) {
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || String(data.fullName || snap.id);
    customerNameById.set(snap.id, name);
  }
  const grantNameById = new Map<string, string>();
  for (const snap of grantDocs) {
    if (!snap.exists) continue;
    const data = snap.data() || {};
    grantNameById.set(snap.id, String(data.name || snap.id));
  }

  for (const finding of duplicateFindings) {
    finding.customerName = customerNameById.get(finding.customerId) || null;
    finding.grantName = grantNameById.get(finding.grantId) || null;
  }
  for (const finding of orphanFindings) {
    if (finding.customerId) finding.customerName = customerNameById.get(finding.customerId) || null;
    if (finding.grantId) finding.grantName = grantNameById.get(finding.grantId) || null;
  }
}

export async function runReconciliationAuditScan(
  orgId: string,
  grantIds?: string[],
): Promise<TReconciliationAuditScanResp> {
  const requestedGrantIds = grantIds && grantIds.length ? Array.from(new Set(grantIds.map(String))) : null;
  // Closed/deleted grants have already had their enrollments cascaded closed —
  // resolve which grants are still eligible *before* touching customerEnrollments
  // so those rows are never fetched in the first place.
  const scanGrantIds = await resolveScanGrantIds(orgId, requestedGrantIds);

  const rows: EnrollmentRow[] = [];
  for (const idsChunk of chunk(scanGrantIds, IN_CHUNK)) {
    if (rows.length >= MAX_ENROLLMENTS) break;
    const snap = await db
      .collection("customerEnrollments")
      .where("orgId", "==", orgId)
      .where("grantId", "in", idsChunk)
      .limit(MAX_ENROLLMENTS - rows.length)
      .get();
    for (const doc of snap.docs) rows.push({ id: doc.id, ...(doc.data() as Record<string, unknown>) });
  }

  const duplicateGroups = findDuplicateGroups(rows);
  const duplicateEnrollmentIds = Array.from(new Set(Array.from(duplicateGroups.values()).flat().map((r) => r.id)));

  const orphanRows = rows.filter((row) => ORPHAN_STATUSES.has(String(row.status || "")));
  const orphanById = new Map(orphanRows.map((row) => [row.id, row]));

  const [pendingCountByEnrollment, orphanFindings] = await Promise.all([
    countPendingQueueByEnrollment(duplicateEnrollmentIds),
    scanOrphans(orphanById),
  ]);

  const duplicateFindings: TReconciliationAuditDuplicateFinding[] = [];
  for (const [key, list] of duplicateGroups) {
    const [customerId, grantId] = key.split("::");
    duplicateFindings.push({
      type: "duplicate_enrollment_schedule",
      severity: "error",
      customerId,
      customerName: null,
      grantId,
      grantName: null,
      enrollments: [...list]
        .sort((a, b) => (toDateOnly(a.startDate as any) || "").localeCompare(toDateOnly(b.startDate as any) || ""))
        .map((row) => summarizeEnrollment(row, pendingCountByEnrollment.get(row.id) || 0)),
    });
  }

  await attachNames(duplicateFindings, orphanFindings);

  return {
    ok: true,
    scannedAt: new Date().toISOString(),
    enrollmentsScanned: rows.length,
    duplicateFindings,
    orphanFindings,
  };
}
