// functions/src/features/paymentQueue/triggers.ts
//
// Additive trigger — watches jotformSubmissions/{id} and syncs spending-form
// submissions into paymentQueue/.  Does NOT interfere with the existing inbox
// trigger (onJotformSubmissionCreate/Update/Delete in jotform/triggers.ts).

import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { RUNTIME } from "../../core";
import { isSpendingFormId, extractSpendItems } from "./extractor";
import { upsertPaymentQueueItems, voidPaymentQueueItems } from "./service";
import { recalcGrantProjectedForGrant } from "../payments/recalcGrantProjected";

const FN = "onPaymentQueueSync";
const FN_BUDGET = "onPaymentQueueBudgetProjection";
const BUDGET_SOURCES = new Set(["projection", "invoice", "credit-card"]);

function getOrgId(sub: any): string | null {
  return String(sub?.orgId || "").trim() || null;
}

async function syncSubmission(id: string, sub: any): Promise<void> {
  const formId = String(sub?.form_id || sub?.formId || "").trim();

  // Only process known spending forms — exit fast for everything else
  if (!isSpendingFormId(formId)) return;

  const active = sub?.active !== false && String(sub?.status || "active") !== "deleted";

  // Inactive/deleted: void all queue items for this submission
  if (!active) {
    const voided = await voidPaymentQueueItems(id);
    if (voided > 0) {
      logger.info(`${FN}_voided`, { id, formId, voided });
    }
    return;
  }

  // Extract spend line items
  const extracted = extractSpendItems(sub);

  if (extracted.length === 0) {
    logger.warn(`${FN}_no_items`, { id, formId });
    return;
  }

  const orgId = getOrgId(sub);
  const items = extracted.map((e) => ({ extracted: e, orgId }));

  await upsertPaymentQueueItems(items);

  const hasErrors = extracted.some((e) => e.extractionErrors.length > 0);
  logger.info(`${FN}_synced`, {
    id,
    formId,
    itemCount: extracted.length,
    orgId,
    hasErrors,
    path: extracted[0]?.extractionPath,
  });
}

/**
 * On new jotform submission → extract and write to paymentQueue.
 */
export const onPaymentQueueSyncCreate = onDocumentCreated(
  { region: RUNTIME.region, document: "jotformSubmissions/{id}" },
  async (event) => {
    const id = String(event.params.id);
    const sub = (event.data?.data() as any) || {};
    try {
      await syncSubmission(id, sub);
    } catch (err) {
      logger.error(`${FN}_create_error`, { id, err });
    }
  },
);

/**
 * On jotform submission update → re-extract and overwrite extracted fields
 * while preserving downstream linking (grantId, customerId, etc.).
 */
export const onPaymentQueueSyncUpdate = onDocumentUpdated(
  { region: RUNTIME.region, document: "jotformSubmissions/{id}" },
  async (event) => {
    const id = String(event.params.id);
    const sub = (event.data?.after?.data() as any) || {};
    try {
      await syncSubmission(id, sub);
    } catch (err) {
      logger.error(`${FN}_update_error`, { id, err });
    }
  },
);

/**
 * On jotform submission hard-delete → void all queue items (soft delete).
 */
export const onPaymentQueueSyncDelete = onDocumentDeleted(
  { region: RUNTIME.region, document: "jotformSubmissions/{id}" },
  async (event) => {
    const id = String(event.params.id);
    try {
      const voided = await voidPaymentQueueItems(id);
      logger.info(`${FN}_delete_voided`, { id, voided });
    } catch (err) {
      logger.error(`${FN}_delete_error`, { id, err });
    }
  },
);

function budgetProjectionSignature(row: any): string {
  if (!row) return "";
  return [
    String(row.source || "").toLowerCase(),
    String(row.queueStatus || "").toLowerCase(),
    String(row.grantId || ""),
    String(row.lineItemId || ""),
    String(row.customerId || ""),
    String(row.enrollmentId || ""),
    String(row.paymentId || row.submissionId || ""),
    String(row.amountCents ?? row.amount ?? ""),
    String(row.dueDate || row.createdAt || ""),
  ].join("|");
}

function affectedBudgetGrantIds(before: any, after: any): string[] {
  const ids = new Set<string>();
  for (const row of [before, after]) {
    if (!row) continue;
    const source = String(row.source || "").toLowerCase();
    if (!BUDGET_SOURCES.has(source)) continue;
    const grantId = String(row.grantId || "").trim();
    if (grantId) ids.add(grantId);
  }
  return Array.from(ids);
}

export const onPaymentQueueBudgetProjection = onDocumentWritten(
  { region: RUNTIME.region, document: "paymentQueue/{id}" },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (budgetProjectionSignature(before) === budgetProjectionSignature(after)) return;

    const grantIds = affectedBudgetGrantIds(before, after);
    if (!grantIds.length) return;

    for (const grantId of grantIds) {
      try {
        await recalcGrantProjectedForGrant({ grantId, activeOnly: true, source: 1 });
      } catch (err) {
        logger.error(`${FN_BUDGET}_error`, { grantId, queueId: String(event.params.id || ""), err });
      }
    }
  },
);
