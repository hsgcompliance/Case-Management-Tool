import {
  __export
} from "./chunk-MLKGABMK.js";

// src/grantBudgetEligibility.ts
var grantBudgetEligibility_exports = {};
__export(grantBudgetEligibility_exports, {
  evaluateGrantBudgetEligibility: () => evaluateGrantBudgetEligibility,
  grantBudgetIsoDate: () => grantBudgetIsoDate,
  resolveGrantBudgetTransactionDate: () => resolveGrantBudgetTransactionDate
});
var REASON_LABELS = {
  eligible: "Eligible for grant totals.",
  "not-assigned-to-grant": "Transaction is not assigned to this grant.",
  "missing-transaction-date": "Transaction has no usable transaction date.",
  "before-grant-start": "Transaction is before the grant spending start date.",
  "after-grant-end": "Transaction is after the grant spending end date.",
  "missing-line-item-assignment": "Transaction is assigned to the grant but not to a budget line item.",
  "unknown-line-item": "Transaction line item does not exist in this grant budget.",
  "outside-spending-cycle": "Transaction is eligible for the grant but outside configured spending cycles.",
  voided: "Voided transactions do not contribute to grant totals.",
  "posted-queue-shadow": "Posted queue rows are represented by the authoritative ledger entry."
};
function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value && typeof value.toDate === "function") {
    const date2 = value.toDate();
    return Number.isNaN(date2.getTime()) ? null : date2;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function grantBudgetIsoDate(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(trimmed)) return trimmed.slice(0, 10);
  }
  const date = asDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}
function resolveGrantBudgetTransactionDate(row) {
  const fields = [
    ["transactionDate", row.transactionDate],
    ["dueDate", row.dueDate],
    ["date", row.date],
    ["paymentDate", row.paymentDate],
    ["serviceDate", row.serviceDate],
    ["postedAt", row.postedAt],
    ["createdAt", row.createdAt],
    ["ts", row.ts],
    ["updatedAtISO", row.updatedAtISO],
    ["updatedAt", row.updatedAt]
  ];
  for (const [source, value] of fields) {
    const date = grantBudgetIsoDate(value);
    if (date) return { date, source };
  }
  return { date: "", source: null };
}
function validOverride(value) {
  return !!value && value.approved === true && !!value.approvedBy.trim() && !!grantBudgetIsoDate(value.approvedAt) && !!value.reason.trim();
}
function correctionFor(reason) {
  if (reason === "not-assigned-to-grant") return "assign-grant";
  if (reason === "missing-line-item-assignment" || reason === "unknown-line-item") return "assign-line-item";
  if (reason === "missing-transaction-date") return "review-date";
  if (reason === "before-grant-start" || reason === "after-grant-end" || reason === "outside-spending-cycle") {
    return "reassign-transaction";
  }
  return "none";
}
function evaluateGrantBudgetEligibility(args) {
  const { transaction, grant } = args;
  const grantId = String(grant.id || "").trim();
  const assignedGrantId = String(transaction.grantId || "").trim();
  const lineItemId = String(transaction.lineItemId || "").trim();
  const assignedToGrant = !!grantId && assignedGrantId === grantId;
  const grantStartDate = grantBudgetIsoDate(grant.startDate);
  const grantEndDate = grantBudgetIsoDate(grant.endDate);
  const resolvedDate = resolveGrantBudgetTransactionDate(transaction);
  const lineItems = Array.isArray(grant.budget?.lineItems) ? grant.budget?.lineItems ?? [] : [];
  const lineItem = lineItems.find((candidate) => String(candidate?.id || "").trim() === lineItemId);
  const assignedToLineItem = !!lineItemId && !!lineItem;
  const requireLineItem = args.requireLineItem !== false;
  const queueStatus = String(transaction.queueStatus || "").trim().toLowerCase();
  let reason = "eligible";
  if (!assignedToGrant) reason = "not-assigned-to-grant";
  else if (queueStatus === "void") reason = "voided";
  else if (args.sourceType === "paymentQueue" && queueStatus === "posted") reason = "posted-queue-shadow";
  else if (!resolvedDate.date && (grantStartDate || grantEndDate)) reason = "missing-transaction-date";
  else if (grantStartDate && resolvedDate.date < grantStartDate) reason = "before-grant-start";
  else if (grantEndDate && resolvedDate.date > grantEndDate) reason = "after-grant-end";
  else if (requireLineItem && !lineItemId) reason = "missing-line-item-assignment";
  else if (requireLineItem && !lineItem) reason = "unknown-line-item";
  const overrideApplied = validOverride(args.override) && [
    "missing-transaction-date",
    "before-grant-start",
    "after-grant-end"
  ].includes(reason);
  const eligibleForGrantTotals = reason === "eligible" || overrideApplied;
  const cycles = Array.isArray(lineItem?.splitGoals) ? lineItem?.splitGoals ?? [] : [];
  const matchingCycle = eligibleForGrantTotals && resolvedDate.date ? cycles.find((cycle) => {
    const start = grantBudgetIsoDate(cycle.startDate);
    const end = grantBudgetIsoDate(cycle.endDate);
    return !!start && !!end && resolvedDate.date >= start && resolvedDate.date <= end;
  }) : void 0;
  const cycleReason = eligibleForGrantTotals && cycles.length > 0 && !matchingCycle ? "outside-spending-cycle" : reason;
  return {
    assignedToGrant,
    assignedToLineItem,
    eligibleForGrantTotals,
    eligibleForSpendingCycleTotals: eligibleForGrantTotals && (cycles.length === 0 || !!matchingCycle),
    transactionDate: resolvedDate.date,
    transactionDateSource: resolvedDate.source,
    grantStartDate,
    grantEndDate,
    lineItemId,
    spendingCycleId: matchingCycle ? String(matchingCycle.id || "").trim() || null : null,
    status: eligibleForGrantTotals ? "eligible" : "ineligible",
    reason: cycleReason,
    reasonLabel: REASON_LABELS[cycleReason],
    suggestedCorrectiveWorkflow: correctionFor(cycleReason),
    overrideApplied
  };
}

export {
  grantBudgetIsoDate,
  resolveGrantBudgetTransactionDate,
  evaluateGrantBudgetEligibility,
  grantBudgetEligibility_exports
};
