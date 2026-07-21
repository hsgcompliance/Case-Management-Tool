export type SpendingRecord = Record<string, unknown>;

function asRecord(value: unknown): SpendingRecord {
  return value && typeof value === "object" ? value as SpendingRecord : {};
}

export function paymentQueueIdFromLedger(entry: SpendingRecord): string {
  const origin = asRecord(entry.origin);
  const direct = String(origin.paymentQueueId || "").trim();
  if (direct) return direct;
  const sourcePath = String(origin.sourcePath || "").trim();
  const match = sourcePath.match(/^paymentQueue\/([^/]+)$/);
  return match?.[1] || "";
}

function centsOf(row: SpendingRecord): number {
  const cents = Number(row.amountCents);
  if (Number.isFinite(cents)) return Math.trunc(cents);
  const amount = Number(row.amount);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function reversalTargetId(entry: SpendingRecord): string {
  const origin = asRecord(entry.origin);
  const direct = String(entry.reversalOf || origin.reversalOf || "").trim();
  if (direct) return direct;
  const labels = Array.isArray(entry.labels) ? entry.labels : [];
  for (const label of labels) {
    const match = String(label || "").trim().match(/^reversalOf:(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

/** Ledger IDs that belong to a reversal pair: both the reversal and the spend it cancels. */
export function linkedReversalLedgerIds(ledgerEntries: SpendingRecord[]): Set<string> {
  const related = new Set<string>();
  const unmatchedPositiveByKey = new Map<string, string[]>();
  const ordered = [...ledgerEntries].sort((a, b) => {
    const time = (row: SpendingRecord) => String(row.createdAt || row.ts || row.updatedAt || row.date || "");
    return time(a).localeCompare(time(b)) || String(a.id || "").localeCompare(String(b.id || ""));
  });

  for (const entry of ordered) {
    const id = String(entry.id || "").trim();
    if (!id) continue;
    const target = reversalTargetId(entry);
    if (target) {
      related.add(id);
      related.add(target);
      continue;
    }
    const amount = centsOf(entry);
    const origin = asRecord(entry.origin);
    const enrollmentId = String(entry.enrollmentId || "").trim();
    const paymentId = String(entry.paymentId || origin.baseId || "").trim();
    if (!enrollmentId || !paymentId || amount === 0) continue;
    const key = `${enrollmentId}\u0000${paymentId}\u0000${Math.abs(amount)}`;
    const unmatched = unmatchedPositiveByKey.get(key) || [];
    if (amount > 0) {
      unmatched.push(id);
      unmatchedPositiveByKey.set(key, unmatched);
    } else {
      const cancelledId = unmatched.pop();
      related.add(id);
      if (cancelledId) related.add(cancelledId);
    }
  }
  return related;
}

export function buildQueueLedgerIndex(
  queueItems: SpendingRecord[],
  ledgerEntries: SpendingRecord[],
) {
  const queueById = new Map<string, SpendingRecord>();
  const ledgerById = new Map<string, SpendingRecord>();
  const ledgersByQueueId = new Map<string, SpendingRecord[]>();

  for (const item of queueItems) {
    const id = String(item.id || "").trim();
    if (id) queueById.set(id, item);
  }

  for (const entry of ledgerEntries) {
    const id = String(entry.id || "").trim();
    if (id) ledgerById.set(id, entry);
    const queueId = paymentQueueIdFromLedger(entry);
    if (!queueId) continue;
    const rows = ledgersByQueueId.get(queueId) || [];
    rows.push(entry);
    ledgersByQueueId.set(queueId, rows);
  }

  function ledgersForQueue(item: SpendingRecord): SpendingRecord[] {
    const queueId = String(item.id || "").trim();
    const linkedLedgerId = String(item.ledgerEntryId || "").trim();
    const linked = linkedLedgerId ? ledgerById.get(linkedLedgerId) : undefined;
    const byOrigin = queueId ? ledgersByQueueId.get(queueId) || [] : [];
    if (!linked) return byOrigin;
    return [linked, ...byOrigin.filter((entry) => String(entry.id || "") !== linkedLedgerId)];
  }

  function primaryLedgerForQueue(item: SpendingRecord): SpendingRecord | null {
    return ledgersForQueue(item)[0] || null;
  }

  function isLedgerRepresentedByQueue(entry: SpendingRecord): boolean {
    const queueId = paymentQueueIdFromLedger(entry);
    if (queueId && queueById.has(queueId)) return true;
    const entryId = String(entry.id || "").trim();
    if (!entryId) return false;
    for (const item of queueById.values()) {
      if (String(item.ledgerEntryId || "").trim() === entryId) return true;
    }
    return false;
  }

  return { ledgersForQueue, primaryLedgerForQueue, isLedgerRepresentedByQueue };
}

export function queueLedgerIssue(item: SpendingRecord, ledgers: SpendingRecord[]): string {
  if (ledgers.length > 1) return `Reconciliation: ${ledgers.length} ledger entries linked`;
  const ledger = ledgers[0];
  if (!ledger) return "";

  const queueStatus = String(item.queueStatus || "pending").toLowerCase();
  if (queueStatus !== "posted") return "Reconciliation: ledger exists while queue is open";

  const mismatches: string[] = [];
  if (centsOf(item) !== centsOf(ledger)) mismatches.push("amount");
  for (const field of ["grantId", "lineItemId"] as const) {
    if (String(item[field] || "") !== String(ledger[field] || "")) mismatches.push(field === "grantId" ? "grant" : "budget");
  }
  return mismatches.length ? `Reconciliation: ${mismatches.join(", ")} mismatch` : "";
}
