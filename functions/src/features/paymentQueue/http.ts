// functions/src/features/paymentQueue/http.ts
import {secureHandler, orgIdFromClaims, requireUid} from '../../core';
import { adminSyncPaymentQueueHandler } from './adminSyncPaymentQueue';
import {
  PaymentQueueListBody,
  PaymentQueuePatchBody,
  PaymentQueueBypassCloseBody,
  PaymentQueuePostToLedgerBody,
  PaymentQueueReopenBody,
  PaymentQueueVoidBody,
  PaymentQueueRecomputeGrantBody,
  PaymentQueueItemParams,
} from './schemas';
import {
  listPaymentQueueItems,
  getPaymentQueueItem,
  patchPaymentQueueItem,
  bypassClosePaymentQueueItems,
  postPaymentQueueToLedger,
  reopenPaymentQueueItem,
  voidPaymentQueueItems,
  recomputePaymentQueueGrantAllocations,
} from './service';

/* ============================================================================
   GET|POST /paymentQueueList
============================================================================ */

export const paymentQueueList = secureHandler(async (req, res): Promise<void> => {
  const src = req.method === 'GET' ? req.query : req.body;
  const body = PaymentQueueListBody.parse(src || {});
  const caller = (req as any).user || {};
  const callerOrg = orgIdFromClaims(caller);
  const orgId = (body.orgId as string | undefined) || callerOrg;

  if (!orgId) {
    res.status(400).json({ok: false, error: 'org_required'});
    return;
  }

  const result = await listPaymentQueueItems(orgId, body);
  res.json({ok: true, ...result});
}, {auth: 'user', memory: '512MiB', concurrency: 10});

/* ============================================================================
   GET /paymentQueueGet?id=…
============================================================================ */

export const paymentQueueGet = secureHandler(async (req, res): Promise<void> => {
  const {id} = PaymentQueueItemParams.parse(req.query);
  const item = await getPaymentQueueItem(id);
  if (!item) {
    res.status(404).json({ok: false, error: 'not_found'});
    return;
  }
  res.json({ok: true, item});
});

/* ============================================================================
   PATCH /paymentQueuePatch?id=…
============================================================================ */

export const paymentQueuePatch = secureHandler(async (req, res): Promise<void> => {
  const {id} = PaymentQueueItemParams.parse(req.query);
  const body = PaymentQueuePatchBody.parse(req.body || {});
  const uid = requireUid(req as any);

  const updated = await patchPaymentQueueItem(id, body, uid);
  if (!updated) {
    res.status(404).json({ok: false, error: 'not_found'});
    return;
  }
  res.json({ok: true, item: updated});
});

/* ============================================================================
   POST /paymentQueuePostToLedger?id=…
============================================================================ */

export const paymentQueuePostToLedger = secureHandler(async (req, res): Promise<void> => {
  const {id} = PaymentQueueItemParams.parse({...((req.body || {}) as any), ...((req.query || {}) as any)});
  const body = PaymentQueuePostToLedgerBody.parse(req.body || {});
  const uid = requireUid(req as any);

  try {
    const result = await postPaymentQueueToLedger(id, body, uid);
    if (!result) {
      res.status(404).json({ok: false, error: 'not_found'});
      return;
    }
    res.json({ok: true, ...result});
  } catch (err: any) {
    res.status(400).json({ok: false, error: err.message || 'post_to_ledger_failed'});
  }
});

/* ============================================================================
   POST /paymentQueueBypassClose
============================================================================ */

export const paymentQueueBypassClose = secureHandler(async (req, res): Promise<void> => {
  const body = PaymentQueueBypassCloseBody.parse(req.body || {});
  const uid = requireUid(req as any);
  const result = await bypassClosePaymentQueueItems(body, uid);
  res.json({ok: true, ...result});
}, {auth: 'user', methods: ['POST', 'OPTIONS']});

/* ============================================================================
   POST /paymentQueueReopen?id=…
============================================================================ */

export const paymentQueueReopen = secureHandler(async (req, res): Promise<void> => {
  const {id} = PaymentQueueItemParams.parse(req.query);
  const body = PaymentQueueReopenBody.parse(req.body || {});
  const uid = requireUid(req as any);

  try {
    const result = await reopenPaymentQueueItem(id, body, uid);
    if (!result) {
      res.status(404).json({ok: false, error: 'not_found'});
      return;
    }
    res.json({ok: true, ...result});
  } catch (err: any) {
    res.status(400).json({ok: false, error: err.message || 'reopen_failed'});
  }
});

/* ============================================================================
   POST /paymentQueueVoid?id=…  (voids a single item's entire submission group)
============================================================================ */

export const paymentQueueVoid = secureHandler(async (req, res): Promise<void> => {
  const {id} = PaymentQueueItemParams.parse(req.query);
  PaymentQueueVoidBody.parse(req.body || {});

  // Look up the item to get its baseId (void entire submission group)
  const item = await getPaymentQueueItem(id);
  if (!item) {
    res.status(404).json({ok: false, error: 'not_found'});
    return;
  }

  const uid = requireUid(req as any);
  const voided = await voidPaymentQueueItems(item.baseId, uid);
  res.json({ok: true, voided});
});

/* ============================================================================
   POST /paymentQueueAdminSync  (admin: backfill paymentQueue from enrollments + jotform)
============================================================================ */

export const paymentQueueAdminSync = secureHandler(async (req, res): Promise<void> => {
  await adminSyncPaymentQueueHandler(req as any, res as any);
}, { auth: 'admin', methods: ['POST', 'OPTIONS'] });

/* ============================================================================
   POST /paymentQueueRecomputeGrantAllocations  (admin: rebuild paid allocation)
============================================================================ */

export const paymentQueueRecomputeGrantAllocations = secureHandler(async (req, res): Promise<void> => {
  const body = PaymentQueueRecomputeGrantBody.parse(req.body || {});
  const result = await recomputePaymentQueueGrantAllocations(body.grantId, body.dryRun);
  res.json({ok: true, ...result});
}, { auth: 'admin', methods: ['POST', 'OPTIONS'] });
