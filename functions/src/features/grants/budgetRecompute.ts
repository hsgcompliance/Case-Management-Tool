// functions/src/features/grants/budgetRecompute.ts
//
// Recompute a single grant's stored budget totals + per-line-item spent/projected
// from the live ledger (spent) and pending paymentQueue (projected) and write them
// back to the grant doc.
//
// This is the same math the admin reconcile path uses
// (grants/http.ts → recomputeAndWriteBudget). It is extracted here so the
// paymentQueue bulk-post flow can refresh budgets ONCE per affected grant after a
// batch of posts, instead of leaving grant.budget.totals stale (postToLedger only
// writes the ledger + per-customer cap tracker, never the grant budget).
//
// Keep in sync with grants/http.ts recomputeAndWriteBudget if that math changes.

import { db, FieldValue, isoNow, normId, toBudgetCents, fromBudgetCents } from "../../core";
import { writeLedgerEntry } from "../ledger/service";
import { getGrantFinancialCapabilities } from "./schemas";
import { computeGrantLineItemOverCap } from "@hdb/contracts";

function docBelongsToGrant(
  row: Record<string, unknown>,
  grantId: string,
  grantOrg: string,
): boolean {
  if (String(row.grantId || "") !== grantId) return false;
  const rowOrg = normId(row.orgId);
  // Only reject on a positive org mismatch; legacy unscoped rows (no orgId) are
  // accepted because the grantId match already proves ownership.
  if (grantOrg && rowOrg && rowOrg !== grantOrg) return false;
  return true;
}

function isoDate10(value: unknown): string {
  return String(value ?? "").trim().slice(0, 10);
}

function rowBudgetDate(row: Record<string, unknown>): string {
  return isoDate10(row.dueDate || row.date || row.postedAt || row.createdAt || row.updatedAtISO || row.updatedAt);
}

function rowInGrantWindow(row: Record<string, unknown>, grantData: Record<string, unknown>): boolean {
  const start = isoDate10(grantData.startDate);
  const end = isoDate10(grantData.endDate);
  if (!start && !end) return true;
  const date = rowBudgetDate(row);
  if (!date) return true;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function rowInSplitWindow(date: string, goal: Record<string, unknown>): boolean {
  const start = isoDate10(goal.startDate);
  const end = isoDate10(goal.endDate);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

function addSplitAmount(
  splitAcc: Record<string, Record<string, { spentCents: number; projectedCents: number }>>,
  lineItem: Record<string, unknown> | undefined,
  kind: "spent" | "projected",
  amountCents: number,
  date: string,
) {
  if (!lineItem || !amountCents || !date) return;
  const lineItemId = String(lineItem.id || "");
  const splitGoals = Array.isArray(lineItem.splitGoals) ? lineItem.splitGoals as Record<string, unknown>[] : [];
  if (!lineItemId || !splitGoals.length) return;
  for (const goal of splitGoals) {
    const goalId = String(goal.id || "");
    if (!goalId || !rowInSplitWindow(date, goal)) continue;
    const byGoal = splitAcc[lineItemId] ?? (splitAcc[lineItemId] = {});
    const acc = byGoal[goalId] ?? (byGoal[goalId] = { spentCents: 0, projectedCents: 0 });
    if (kind === "spent") acc.spentCents += amountCents;
    else acc.projectedCents += amountCents;
  }
}

function applySplitRollups(
  lineItem: Record<string, unknown>,
  splitAcc: Record<string, { spentCents: number; projectedCents: number }> | undefined,
) {
  const splitGoals = Array.isArray(lineItem.splitGoals) ? lineItem.splitGoals as Record<string, unknown>[] : [];
  if (!splitGoals.length) return lineItem;
  return {
    ...lineItem,
    splitGoals: splitGoals.map((goal) => {
      const acc = splitAcc?.[String(goal.id || "")] ?? { spentCents: 0, projectedCents: 0 };
      const amountCents = toBudgetCents(goal.amount);
      const spentCents = Math.max(0, acc.spentCents);
      const projectedCents = Math.max(0, acc.projectedCents);
      return {
        ...goal,
        spent: fromBudgetCents(spentCents),
        projected: fromBudgetCents(projectedCents),
        balance: fromBudgetCents(amountCents - spentCents),
        projectedBalance: fromBudgetCents(amountCents - spentCents - projectedCents),
      };
    }),
  };
}

export type GrantBudgetRecomputeResult = {
  grantId: string;
  recomputed: boolean;
  /** Reason when recomputed === false. */
  skipped?: "grant_not_found" | "not_spend_down_budget";
  totals?: Record<string, number>;
  /** paymentQueue docs found desynced (queueStatus stuck pending despite a valid, non-reversal ledger entry) and auto-flipped to posted this run. */
  queueDocsRepaired?: Array<{ queueId: string; ledgerEntryId: string }>;
};

/**
 * A paymentQueue doc with queueStatus still "pending" but a ledgerEntryId
 * already set is desynced: it double-counts (spent via the ledger row it
 * points to, projected via its own pending status) — the bug found via
 * report-reconciliation-workbench on 2026-07-22 (race between concurrent
 * paymentsSpend calls and the projection-sync trigger; see
 * payment-workflow-hardening/PROGRESS.md). A reversal ledger entry is never
 * valid backing — reversals mean the payment was undone, not posted, so they
 * are excluded rather than treated as confirmation.
 */
async function repairDesyncedQueueDocs(
  queueDocs: FirebaseFirestore.QueryDocumentSnapshot[],
): Promise<{ repaired: Array<{ queueId: string; ledgerEntryId: string }>; repairedIds: Set<string> }> {
  const candidates = queueDocs.filter((d) => {
    const row = d.data() as Record<string, unknown>;
    return row.queueStatus === "pending" && !!row.ledgerEntryId;
  });
  if (!candidates.length) return { repaired: [], repairedIds: new Set() };

  const ledgerIds = Array.from(new Set(candidates.map((d) => String((d.data() as Record<string, unknown>).ledgerEntryId))));
  const ledgerSnaps = await db.getAll(...ledgerIds.map((id) => db.collection("ledger").doc(id)));
  const ledgerById = new Map(ledgerSnaps.map((s) => [s.id, s.exists ? (s.data() as Record<string, unknown>) : null]));

  const repaired: Array<{ queueId: string; ledgerEntryId: string }> = [];
  const repairedIds = new Set<string>();
  const now = isoNow();
  let batch = db.batch();
  let batchCount = 0;

  for (const d of candidates) {
    const row = d.data() as Record<string, unknown>;
    const ledgerEntryId = String(row.ledgerEntryId || "");
    const ledger = ledgerById.get(ledgerEntryId);
    const validBacking = !!ledger && !ledger.reversalOf && Number(ledger.amountCents || 0) > 0;
    if (!validBacking) continue;

    repairedIds.add(d.id);
    repaired.push({ queueId: d.id, ledgerEntryId });
    batch.update(d.ref, {
      queueStatus: "posted",
      "system.lastWriter": "recomputeGrantBudgetFromLedger",
      "system.lastWriteAt": now,
      updatedAtISO: now,
    });
    batchCount += 1;
    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount) await batch.commit();
  return { repaired, repairedIds };
}

/**
 * Recompute and persist one grant's budget from ledger + pending queue.
 * No-ops (recomputed:false) for missing grants and non-spend-down (billing-mode)
 * grants so it is safe to call opportunistically after a bulk post.
 */
export async function recomputeGrantBudgetFromLedger(
  grantId: string,
): Promise<GrantBudgetRecomputeResult> {
  const id = String(grantId || "").trim();
  if (!id) return { grantId: id, recomputed: false, skipped: "grant_not_found" };

  const gSnap = await db.collection("grants").doc(id).get();
  if (!gSnap.exists) return { grantId: id, recomputed: false, skipped: "grant_not_found" };

  const grantData = gSnap.data() || {};
  if (!getGrantFinancialCapabilities(grantData).drawsDownBudget) {
    return { grantId: id, recomputed: false, skipped: "not_spend_down_budget" };
  }

  const grantOrg = normId(grantData.orgId);
  const budget = (grantData.budget || {}) as Record<string, unknown>;
  const total = Number(budget.total ?? 0);
  const lineItems = (Array.isArray(budget.lineItems) ? budget.lineItems : []) as Record<string, unknown>[];

  const [ledgerSnap, queueSnap] = await Promise.all([
    db.collection("ledger").where("grantId", "==", id).get(),
    db.collection("paymentQueue").where("grantId", "==", id).where("queueStatus", "==", "pending").get(),
  ]);

  const { repaired: queueDocsRepaired, repairedIds } = await repairDesyncedQueueDocs(queueSnap.docs);

  const lineItemById = new Map(lineItems.map((li) => [String(li.id || ""), li]));
  const splitAccByLineId: Record<string, Record<string, { spentCents: number; projectedCents: number }>> = {};
  const spentByLineCents: Record<string, number> = {};
  for (const d of ledgerSnap.docs) {
    const row = d.data() as Record<string, unknown>;
    if (!docBelongsToGrant(row, id, grantOrg)) continue;
    if (!rowInGrantWindow(row, grantData)) continue;
    const lineId = String(row.lineItemId || "") || "__none__";
    const amountCents = row.amountCents != null
      ? Math.round(Number(row.amountCents) || 0)
      : toBudgetCents(row.amount);
    if (amountCents) spentByLineCents[lineId] = (spentByLineCents[lineId] ?? 0) + amountCents;
    addSplitAmount(splitAccByLineId, lineItemById.get(lineId), "spent", amountCents, rowBudgetDate(row));
  }

  const projectedByLineCents: Record<string, number> = {};
  for (const d of queueSnap.docs) {
    if (repairedIds.has(d.id)) continue; // now posted + already counted via ledgerSnap above
    const row = d.data() as Record<string, unknown>;
    if (!docBelongsToGrant(row, id, grantOrg)) continue;
    if (!rowInGrantWindow(row, grantData)) continue;
    const source = String(row.source || "");
    if (!["projection", "invoice", "credit-card"].includes(source)) continue;
    const lineId = String(row.lineItemId || "") || "__none__";
    const amountCents = toBudgetCents(row.amount);
    if (amountCents) projectedByLineCents[lineId] = (projectedByLineCents[lineId] ?? 0) + amountCents;
    addSplitAmount(splitAccByLineId, lineItemById.get(lineId), "projected", amountCents, rowBudgetDate(row));
  }

  const updatedLineItems = lineItems.map((li) => {
    const liId = String(li.id || "");
    const spent = fromBudgetCents(spentByLineCents[liId] ?? 0);
    const projected = fromBudgetCents(projectedByLineCents[liId] ?? 0);
    const next: Record<string, unknown> = applySplitRollups({ ...li, spent, projected, spentInWindow: spent, projectedInWindow: projected }, splitAccByLineId[liId]);
    const overCap = computeGrantLineItemOverCap(grantData, next);
    if (overCap != null) next.overCap = overCap;
    else delete next.overCap;
    return next;
  });

  const totalCents = toBudgetCents(total);
  const totalSpentCents =
    updatedLineItems.reduce((a, li) => a + toBudgetCents(li.spent), 0) + (spentByLineCents["__none__"] ?? 0);
  const totalProjectedCents =
    updatedLineItems.reduce((a, li) => a + toBudgetCents(li.projected), 0) + (projectedByLineCents["__none__"] ?? 0);

  const newTotals: Record<string, number> = {
    total,
    spent: fromBudgetCents(totalSpentCents),
    projected: fromBudgetCents(totalProjectedCents),
    projectedSpend: fromBudgetCents(totalSpentCents + totalProjectedCents),
    balance: fromBudgetCents(totalCents - totalSpentCents),
    projectedBalance: fromBudgetCents(totalCents - totalSpentCents - totalProjectedCents),
    remaining: fromBudgetCents(totalCents - totalSpentCents),
    spentInWindow: fromBudgetCents(totalSpentCents),
    projectedInWindow: fromBudgetCents(totalProjectedCents),
    windowBalance: fromBudgetCents(totalCents - totalSpentCents),
    windowProjectedBalance: fromBudgetCents(totalCents - totalSpentCents - totalProjectedCents),
  };

  await db.collection("grants").doc(id).update({
    "budget.totals": { ...((budget.totals || {}) as Record<string, unknown>), ...newTotals },
    "budget.lineItems": updatedLineItems,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { grantId: id, recomputed: true, totals: newTotals, queueDocsRepaired };
}

/**
 * Record a manual spend adjustment against a grant line item to reconcile budget
 * drift (e.g. funds moved to an untracked category). Writes a durable, auditable
 * ledger entry (no customer) attributed to the line item, then recomputes the
 * grant budget so the line item's spent — and therefore the grant total — picks
 * it up. The entry survives every future reconcile because it is real ledger data.
 *
 * `amount` may be negative to walk an over-stated line item back down.
 */
export async function addLineItemSpendAdjustment(args: {
  grantId: string;
  lineItemId: string;
  amount: number;
  note?: string;
  date?: string;
  actorUid?: string | null;
}): Promise<{ ledgerEntryId: string; totals: Record<string, number> | null }> {
  const grantId = String(args.grantId || "").trim();
  const lineItemId = String(args.lineItemId || "").trim();
  const amount = Number(args.amount || 0);
  if (!grantId || !lineItemId) throw new Error("grant_and_line_item_required");
  if (!Number.isFinite(amount) || amount === 0) throw new Error("amount_must_be_nonzero");

  const gSnap = await db.collection("grants").doc(grantId).get();
  if (!gSnap.exists) throw new Error("grant_not_found");
  const grant = gSnap.data() || {};
  if (!getGrantFinancialCapabilities(grant).drawsDownBudget) throw new Error("grant_budget_action_not_enabled");

  const lineItems = (Array.isArray((grant as any)?.budget?.lineItems) ? (grant as any).budget.lineItems : []) as Record<string, unknown>[];
  const li = lineItems.find((x) => String(x?.id || "") === lineItemId);
  if (!li) throw new Error("line_item_not_found");
  if (li?.locked) throw new Error("line_item_locked");

  const now = isoNow();
  const dueDate = args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : now.slice(0, 10);
  const noteText = String(args.note || "").trim();
  const label = String(li?.label || lineItemId);

  const ledgerEntryId = await db.runTransaction(async (trx) => {
    const entry = writeLedgerEntry(trx, {
      orgId: (grant as any).orgId ?? null,
      source: "manual",
      amount,
      amountCents: Math.round(amount * 100),
      dueDate,
      grantId,
      lineItemId,
      customerId: null,
      enrollmentId: null,
      vendor: "Manual adjustment",
      description: noteText || `Manual budget adjustment — ${label}`,
      note: [noteText || "Manual budget adjustment (drift sync)"],
      comment: "Manual budget adjustment (drift sync)",
      lineItemLabelAtSpend: label,
      labels: ["manual-adjustment", "budget-drift"],
      origin: { app: "hdb", adjustment: true, by: args.actorUid ?? null, at: now },
    });
    return entry.id as string;
  });

  const res = await recomputeGrantBudgetFromLedger(grantId);
  return { ledgerEntryId, totals: res.totals ?? null };
}
