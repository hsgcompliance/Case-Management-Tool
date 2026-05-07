// functions/src/features/grants/lineItemCaps.ts
//
// Per-customer spending cap tracking for grant budget line items.
//
// Collection: grantCustomerSpend/{grantId}_{customerId}
// Document shape:
//   { grantId, customerId, lineItemSpend: { [lineItemId]: number }, totalSpend: number, updatedAt }
//
// Called by postPaymentQueueToLedger (and optionally by a ledger trigger) to
// keep running totals in sync.  checkCap() is a pure helper with no side effects.

import { db, isoNow } from "../../core";

const COLLECTION = "grantCustomerSpend";

function docId(grantId: string, customerId: string): string {
  return `${grantId}_${customerId}`;
}

export type CapCheckResult = {
  /** True when the cap is enabled and would be exceeded by this spend */
  wouldExceed: boolean;
  /** Current cumulative spend for this customer on this line item (before this spend) */
  currentSpend: number;
  /** The cap value (null if no cap) */
  cap: number | null;
  /** Amount over cap if wouldExceed (0 otherwise) */
  overBy: number;
};

/**
 * Check whether adding `newAmount` for a customer on a specific line item
 * would exceed the per-customer cap defined on that line item.
 *
 * Pure function — no Firestore reads.  Call after fetching the grant doc
 * and the current spend tracker doc.
 */
export function checkCap(opts: {
  lineItem: { id?: string | null; perCustomerCap?: number | null; capEnabled?: boolean | null };
  currentLineItemSpend: number;
  newAmount: number;
}): CapCheckResult {
  const { lineItem, currentLineItemSpend, newAmount } = opts;
  const capEnabled = lineItem.capEnabled === true;
  const cap = capEnabled && lineItem.perCustomerCap != null ? Number(lineItem.perCustomerCap) : null;

  if (cap == null) {
    return { wouldExceed: false, currentSpend: currentLineItemSpend, cap: null, overBy: 0 };
  }

  const afterSpend = currentLineItemSpend + newAmount;
  const wouldExceed = afterSpend > cap;
  return {
    wouldExceed,
    currentSpend: currentLineItemSpend,
    cap,
    overBy: wouldExceed ? afterSpend - cap : 0,
  };
}

/** Read the current spend tracking doc for a customer on a grant. Returns null if not found. */
export async function getCustomerSpend(
  grantId: string,
  customerId: string,
): Promise<{ lineItemSpend: Record<string, number>; totalSpend: number } | null> {
  const snap = await db.collection(COLLECTION).doc(docId(grantId, customerId)).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  return {
    lineItemSpend: (d.lineItemSpend as Record<string, number>) || {},
    totalSpend: Number(d.totalSpend || 0),
  };
}

/**
 * Add a spend amount to the tracking doc for a customer on a grant line item.
 * Creates the doc if it doesn't exist.  Safe to call from a transaction or batch.
 */
export async function recordCustomerSpend(opts: {
  grantId: string;
  customerId: string;
  lineItemId: string | null | undefined;
  amount: number;
}): Promise<void> {
  const { grantId, customerId, lineItemId, amount } = opts;
  if (!grantId || !customerId || !amount) return;

  const ref = db.collection(COLLECTION).doc(docId(grantId, customerId));
  const now = isoNow();

  await db.runTransaction(async (trx) => {
    const snap = await trx.get(ref);
    const existing = snap.exists ? (snap.data() || {}) : {};
    const lineItemSpend: Record<string, number> = { ...(existing.lineItemSpend || {}) };

    if (lineItemId) {
      lineItemSpend[lineItemId] = (lineItemSpend[lineItemId] || 0) + amount;
    }

    const totalSpend = Object.values(lineItemSpend).reduce((s, v) => s + v, 0);

    trx.set(
      ref,
      {
        grantId,
        customerId,
        lineItemSpend,
        totalSpend,
        updatedAt: now,
        ...(snap.exists ? {} : { createdAt: now }),
      },
      { merge: true },
    );
  });
}

export async function recomputeCustomerSpendForGrant(opts: {
  grantId: string;
  dryRun?: boolean;
}): Promise<{ grantId: string; customers: number; ledgerRows: number; totals: Record<string, number>; dryRun: boolean }> {
  const grantId = String(opts.grantId || "").trim();
  if (!grantId) throw new Error("grant_required");

  const ledgerSnap = await db.collection("ledger").where("grantId", "==", grantId).get();
  const byCustomer = new Map<string, { lineItemSpend: Record<string, number>; ledgerRows: number }>();

  for (const doc of ledgerSnap.docs) {
    const row = doc.data() || {};
    const customerId = String(row.customerId || "").trim();
    const lineItemId = String(row.lineItemId || "").trim();
    if (!customerId || !lineItemId) continue;
    const amount = Number(row.amount || 0) || (Number(row.amountCents || 0) / 100);
    if (!amount) continue;
    const hit = byCustomer.get(customerId) || { lineItemSpend: {}, ledgerRows: 0 };
    hit.lineItemSpend[lineItemId] = (hit.lineItemSpend[lineItemId] || 0) + amount;
    hit.ledgerRows += 1;
    byCustomer.set(customerId, hit);
  }

  const totals = Array.from(byCustomer.entries()).reduce<Record<string, number>>((acc, [customerId, data]) => {
    acc[customerId] = Object.values(data.lineItemSpend).reduce((sum, value) => sum + value, 0);
    return acc;
  }, {});

  if (!opts.dryRun) {
    const existing = await db.collection(COLLECTION).where("grantId", "==", grantId).get();
    const batch = db.batch();
    for (const doc of existing.docs) batch.delete(doc.ref);
    const now = isoNow();
    for (const [customerId, data] of byCustomer.entries()) {
      batch.set(db.collection(COLLECTION).doc(docId(grantId, customerId)), {
        grantId,
        customerId,
        lineItemSpend: data.lineItemSpend,
        totalSpend: totals[customerId] || 0,
        ledgerRows: data.ledgerRows,
        recomputedAt: now,
        updatedAt: now,
      }, { merge: false });
    }
    await batch.commit();
  }

  return {
    grantId,
    customers: byCustomer.size,
    ledgerRows: Array.from(byCustomer.values()).reduce((sum, data) => sum + data.ledgerRows, 0),
    totals,
    dryRun: !!opts.dryRun,
  };
}

/**
 * Fetch the grant doc and check whether a spend for a customer on a specific
 * line item would exceed the cap.  Returns `null` if no cap is configured.
 */
export async function checkCapForSpend(opts: {
  grantId: string;
  customerId: string;
  lineItemId: string | null | undefined;
  amount: number;
}): Promise<CapCheckResult | null> {
  const { grantId, customerId, lineItemId, amount } = opts;

  const [grantSnap, spendData] = await Promise.all([
    db.collection("grants").doc(grantId).get(),
    getCustomerSpend(grantId, customerId),
  ]);

  if (!grantSnap.exists) return null;
  const grant = grantSnap.data() || {};
  const lineItems: any[] = (grant as any).budget?.lineItems || [];

  const lineItem = lineItemId
    ? lineItems.find((li: any) => li.id === lineItemId)
    : null;

  if (!lineItem || !lineItem.capEnabled || lineItem.perCustomerCap == null) return null;

  const currentLineItemSpend = spendData?.lineItemSpend?.[lineItemId!] || 0;
  return checkCap({ lineItem, currentLineItemSpend, newAmount: amount });
}
