// functions/src/features/budgetPipeline/triggers.ts
//
// Auto-allocates incoming paymentQueue items to a grant + line item by running
// all active pipelines in creation order. First matching pipeline wins.

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { RUNTIME } from "../../core";
import { autoAllocatePaymentQueueItem } from "./service";

const FN = "onPaymentQueueItemCreate";

export const onPaymentQueueItemCreate = onDocumentCreated(
  { region: RUNTIME.region, document: "paymentQueue/{id}" },
  async (e) => {
    const data = e.data?.data() as Record<string, unknown> | undefined;
    if (!data) return;

    const itemId = e.params.id;
    const result = await autoAllocatePaymentQueueItem(itemId, data, { writer: FN });
    if (result.allocated) logger.info(`${FN}: allocated ${itemId} via pipeline ${result.pipelineId}`);
  },
);
