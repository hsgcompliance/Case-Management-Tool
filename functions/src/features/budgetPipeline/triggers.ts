// functions/src/features/budgetPipeline/triggers.ts
//
// Auto-allocates incoming paymentQueue items to a grant + line item by running
// all active pipelines in creation order.  First matching pipeline wins.
// Only fires when queueStatus === "pending" and grantId is still null.
//
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import {db, RUNTIME, isoNow} from '../../core';
import {type TBudgetPipeline} from './schemas';
import {matchesPipeline} from './service';

const COLLECTION = 'budgetPipelines';
const FN = 'onPaymentQueueItemCreate';

export const onPaymentQueueItemCreate = onDocumentCreated(
  {region: RUNTIME.region, document: 'paymentQueue/{id}'},
  async (e) => {
    const data = e.data?.data() as Record<string, unknown> | undefined;
    if (!data) return;

    // Only process pending, unassigned items
    if (data.queueStatus !== 'pending') return;
    if (data.grantId) return;
    if (!data.orgId) return;

    const orgId = String(data.orgId);
    const itemId = e.params.id;

    // Load active pipelines ordered by creation date (oldest = highest priority)
    const snap = await db
      .collection(COLLECTION)
      .where('orgId', '==', orgId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'asc')
      .get();

    if (snap.empty) return;

    const item = {...data, id: itemId};

    for (const pDoc of snap.docs) {
      const pipeline = pDoc.data() as TBudgetPipeline;

      if (!matchesPipeline(item, pipeline)) continue;

      // First match — patch grantId / lineItemId
      const patch: Record<string, unknown> = {
        updatedAtISO: isoNow(),
        'system.lastWriter': `${FN}:pipeline:${pDoc.id}`,
        'system.lastWriteAt': isoNow(),
      };
      if (pipeline.grantId) patch.grantId = pipeline.grantId;
      if (pipeline.lineItemId) patch.lineItemId = pipeline.lineItemId;

      if (patch.grantId || patch.lineItemId) {
        await e.data!.ref.update(patch);
        logger.info(`${FN}: allocated ${itemId} → grant=${pipeline.grantId ?? '—'} lineItem=${pipeline.lineItemId ?? '—'} via pipeline ${pDoc.id}`);
      }

      break; // first match wins
    }
  },
);
