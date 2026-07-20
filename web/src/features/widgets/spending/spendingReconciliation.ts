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

function centsOf(row: SpendingRecord): number {
  const cents = Number(row.amountCents);
  if (Number.isFinite(cents)) return Math.trunc(cents);
  const amount = Number(row.amount);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
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
