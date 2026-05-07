// functions/src/features/paymentQueue/service.ts
import {db, isoNow, removeUndefinedDeep} from '../../core';
import {writeLedgerEntry} from '../ledger/service';
import {recordCustomerSpend, recomputeCustomerSpendForGrant} from '../grants/lineItemCaps';
import {primarySubtype} from '../payments/utils';
import {
  type TPaymentQueueItem,
  type TPaymentQueueListBody,
  type TPaymentQueueBypassCloseBody,
  type TPaymentQueuePatchBody,
  type TPaymentQueuePostToLedgerBody,
  type TPaymentQueueReopenBody,
} from './schemas';

const COLLECTION = 'paymentQueue';
const FN = 'paymentQueueService';
const LOCAL_RECONCILE_FIELDS = [
  'amount',
  'amountAbs',
  'direction',
  'merchant',
  'expenseType',
  'program',
  'purpose',
  'notes',
  'note',
  'card',
  'cardBucket',
  'grantId',
  'lineItemId',
  'customerId',
  'enrollmentId',
  'creditCardId',
  'invoiceStatus',
  'invoiceRef',
] as const;

function applyLocalOverrides<T extends Record<string, unknown>>(extracted: T, prev: Record<string, unknown> | null): T {
  if (!prev) return extracted;
  const localFields = new Set(Array.isArray(prev.localModifiedFields) ? prev.localModifiedFields.map(String) : []);
  if (!localFields.size) return extracted;
  const next: Record<string, unknown> = {...extracted};
  for (const field of LOCAL_RECONCILE_FIELDS) {
    if (localFields.has(field) && Object.prototype.hasOwnProperty.call(prev, field)) {
      next[field] = prev[field];
    }
  }
  return next as T;
}

function docToItem(doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot): TPaymentQueueItem {
  return {...(doc.data() as TPaymentQueueItem), id: doc.id};
}

function projectionQueueDocId(enrollmentId: string, paymentId: string): string {
  return `projection_${String(enrollmentId || '').trim()}_${String(paymentId || '').trim()}`;
}

function paymentNoteText(payment: Record<string, unknown>): string {
  const raw = Array.isArray(payment.note) ? payment.note : payment.note != null ? [payment.note] : [];
  return raw.map((value) => String(value || '').trim()).filter(Boolean).join(' | ');
}

function projectionLabel(payment: Record<string, unknown>): string {
  const type = String(payment.type || 'monthly').trim().toLowerCase();
  if (type === 'deposit') return 'Deposit';
  if (type === 'prorated') return 'Prorated Rent';
  if (type === 'service') return 'Support Service';
  return primarySubtype(payment) === 'utility' ? 'Utility Assistance' : 'Rental Assistance';
}

type ProjectionQueueContext = {
  orgId: string | null;
  enrollmentId: string;
  grantId: string | null;
  customerId: string | null;
  customerName?: string | null;
};

type ProjectionQueueState = {
  queueStatus: 'pending' | 'posted';
  ledgerEntryId?: string | null;
  reversalEntryId?: string | null;
  postedAt?: string | null;
  postedBy?: string | null;
  reopenedAt?: string | null;
  reopenedBy?: string | null;
  reopenReason?: string | null;
};

function buildProjectionQueueItem(args: {
  context: ProjectionQueueContext;
  payment: Record<string, unknown>;
  prev?: TPaymentQueueItem | null;
  state?: ProjectionQueueState;
  now: string;
}): TPaymentQueueItem {
  const {context, payment, prev, now} = args;
  const paymentId = String(payment.id || '').trim();
  const dueDate = String(payment.dueDate || payment.date || '').slice(0, 10);
  const docId = projectionQueueDocId(context.enrollmentId, paymentId);
  const noteText = paymentNoteText(payment);
  const typeLabel = projectionLabel(payment);
  const state = args.state ?? {
    queueStatus: 'pending' as const,
    ledgerEntryId: prev?.queueStatus === 'posted' ? prev.ledgerEntryId ?? null : null,
    reversalEntryId: prev?.reversalEntryId ?? null,
    postedAt: prev?.queueStatus === 'posted' ? prev.postedAt ?? null : null,
    postedBy: prev?.queueStatus === 'posted' ? prev.postedBy ?? null : null,
    reopenedAt: prev?.reopenedAt ?? null,
    reopenedBy: prev?.reopenedBy ?? null,
    reopenReason: prev?.reopenReason ?? null,
  };

  return {
    id: docId,
    baseId: docId,
    submissionId: paymentId,
    paymentId,
    formId: 'projection',
    formAlias: 'enrollment-projection',
    formTitle: 'Enrollment Projection',
    schemaVersion: 1,
    source: 'projection',
    orgId: context.orgId ?? null,
    createdAt: `${dueDate}T00:00:00`,
    dueDate,
    month: dueDate.slice(0, 7),
    amount: Number(payment.amount || 0),
    merchant: String(payment.vendor || context.customerName || typeLabel || paymentId),
    expenseType: String(payment.type || 'projection'),
    program: '',
    billedTo: '',
    project: '',
    purchasePath: '',
    card: '',
    cardBucket: '',
    txnNumber: null,
    purpose: String(payment.comment || noteText || typeLabel),
    paymentMethod: '',
    serviceType: String(payment.type || ''),
    otherService: '',
    serviceScope: '',
    wex: '',
    descriptor: typeLabel,
    customer: String(context.customerName || ''),
    customerKey: '',
    purchaser: '',
    email: '',
    isFlex: false,
    flexReasons: [],
    submissionIsFlex: false,
    files: [],
    files_txn: [],
    files_uploadAll: [],
    files_typed: {receipt: [], required: [], agenda: [], w9: []},
    notes: noteText,
    note: String(payment.comment || ''),
    rawStatus: state.queueStatus === 'posted' ? 'paid' : 'unpaid',
    rawAnswers: {},
    rawMeta: {
      id: paymentId,
      form_id: 'projection',
      status: state.queueStatus === 'posted' ? 'paid' : 'unpaid',
      created_at: dueDate,
      updated_at: now,
    },
    grantId: context.grantId ?? null,
    lineItemId: String(payment.lineItemId || '') || null,
    customerId: context.customerId ?? null,
    enrollmentId: context.enrollmentId,
    creditCardId: null,
    ledgerEntryId: state.ledgerEntryId ?? null,
    reversalEntryId: state.reversalEntryId ?? null,
    compliance: {
      hmisComplete: !!(payment.compliance as any)?.hmisComplete,
      caseworthyComplete: !!(payment.compliance as any)?.caseworthyComplete,
    } as any,
    invoiceStatus: null,
    invoicedAt: null,
    invoicedBy: null,
    invoiceRef: null,
    okUnassigned: false,
    okUnassignedAt: null,
    okUnassignedBy: null,
    extractionErrors: [],
    extractionPath: 'fallback',
    queueStatus: state.queueStatus,
    voidedAt: null,
    voidedBy: null,
    postedAt: state.postedAt ?? null,
    postedBy: state.postedBy ?? null,
    reopenedAt: state.reopenedAt ?? null,
    reopenedBy: state.reopenedBy ?? null,
    reopenReason: state.reopenReason ?? null,
    createdAtISO: prev?.createdAtISO ?? now,
    updatedAtISO: now,
    system: {
      lastWriter: 'syncEnrollmentProjectionQueueItems',
      lastWriteAt: now,
      extractionVersion: 1,
    },
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listPaymentQueueItems(
    orgId: string,
    body: TPaymentQueueListBody,
): Promise<{ items: TPaymentQueueItem[]; count: number; hasMore: boolean }> {
  return listVisiblePaymentQueueItemsForOrg(orgId, body);
}

export async function listVisiblePaymentQueueItemsForOrg(
    orgId: string,
    body: TPaymentQueueListBody,
): Promise<{ items: TPaymentQueueItem[]; count: number; hasMore: boolean }> {
  let q: FirebaseFirestore.Query = db.collection(COLLECTION).where('orgId', '==', orgId);

  if (body.source) q = q.where('source', '==', body.source);
  if (body.submissionId) q = q.where('submissionId', '==', body.submissionId);
  if (body.queueStatus) q = q.where('queueStatus', '==', body.queueStatus);
  if (body.okUnassigned !== undefined) q = q.where('okUnassigned', '==', body.okUnassigned);
  if (body.isFlex !== undefined) q = q.where('isFlex', '==', body.isFlex);
  if (body.unmatched) {
    // Unmatched = no grantId AND not explicitly ok'd
    q = q.where('grantId', '==', null).where('okUnassigned', '==', false);
  }

  // customerId and grantId filters use composite indexes keyed on dueDate — use dueDate ordering.
  // orgId-only / unmatched views use createdAt (submission queue ordering).
  if (body.customerId !== undefined) {
    q = q.where('customerId', '==', body.customerId);
    if (body.month) q = q.where('month', '==', body.month);
    // No orderBy — equality-only filters work without composite indexes.
    // Frontend sorts displayed rows by date/status.
    q = q.limit(body.limit + 1);
  } else if (body.grantId !== undefined) {
    q = q.where('grantId', '==', body.grantId);
    if (body.month) q = q.where('month', '==', body.month);
    q = q.limit(body.limit + 1);
  } else {
    if (body.month) q = q.where('month', '==', body.month);
    q = q.limit(body.limit + 1);
  }

  if (body.cursor) {
    const cursorSnap = await db.collection(COLLECTION).doc(body.cursor).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.get();
  const hasMore = snap.docs.length > body.limit;
  const docs = hasMore ? snap.docs.slice(0, body.limit) : snap.docs;
  let items = docs.map(docToItem);

  // Migration fallback: older queue docs may have been created before orgId was
  // stamped on paymentQueue. Only include unscoped rows when the source
  // submission/grant/customer/enrollment proves ownership by this org.
  if (items.length < body.limit) {
    let legacyQ: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (body.source) legacyQ = legacyQ.where('source', '==', body.source);
    if (body.submissionId) legacyQ = legacyQ.where('submissionId', '==', body.submissionId);
    if (body.queueStatus) legacyQ = legacyQ.where('queueStatus', '==', body.queueStatus);
    if (body.okUnassigned !== undefined) legacyQ = legacyQ.where('okUnassigned', '==', body.okUnassigned);
    if (body.isFlex !== undefined) legacyQ = legacyQ.where('isFlex', '==', body.isFlex);
    if (body.unmatched) legacyQ = legacyQ.where('grantId', '==', null).where('okUnassigned', '==', false);
    if (body.customerId !== undefined) legacyQ = legacyQ.where('customerId', '==', body.customerId);
    if (body.grantId !== undefined) legacyQ = legacyQ.where('grantId', '==', body.grantId);
    if (body.month) legacyQ = legacyQ.where('month', '==', body.month);
    legacyQ = legacyQ.limit(Math.min(1000, Math.max(body.limit * 3, body.limit + 1)));

    const legacySnap = await legacyQ.get();
    const verified: TPaymentQueueItem[] = [];
    const seen = new Set(items.map((item) => String(item.id || '')));
    for (const doc of legacySnap.docs) {
      const item = docToItem(doc);
      if (seen.has(String(item.id || ''))) continue;
      if (String(item.orgId || '') === orgId) {
        verified.push(item);
        seen.add(String(item.id || ''));
        continue;
      }
      if (item.orgId) continue;
      if (await unscopedQueueItemBelongsToOrg(item, orgId)) {
        verified.push(item);
        seen.add(String(item.id || ''));
      }
      if (items.length + verified.length > body.limit) break;
    }
    const merged = [...items, ...verified].slice(0, body.limit);
    return {items: merged, count: merged.length, hasMore: hasMore || items.length + verified.length > body.limit};
  }

  return {items, count: items.length, hasMore};
}

export async function unscopedQueueItemBelongsToOrg(item: TPaymentQueueItem, orgId: string): Promise<boolean> {
  const target = String(orgId || '').trim();
  if (!target) return false;

  const submissionIds = Array.from(new Set([
    String(item.submissionId || '').trim(),
    String(item.baseId || '').trim(),
  ].filter(Boolean)));
  for (const id of submissionIds) {
    const snap = await db.collection('jotformSubmissions').doc(id).get().catch(() => null);
    if (snap?.exists && String((snap.data() || {}).orgId || '').trim() === target) return true;
  }

  const refs: Array<[string, string]> = [
    ['grants', String(item.grantId || '').trim()],
    ['customers', String(item.customerId || '').trim()],
    ['customerEnrollments', String(item.enrollmentId || '').trim()],
  ];
  for (const [collection, id] of refs) {
    if (!id) continue;
    const snap = await db.collection(collection).doc(id).get().catch(() => null);
    if (snap?.exists && String((snap.data() || {}).orgId || '').trim() === target) return true;
  }

  return false;
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getPaymentQueueItem(id: string): Promise<TPaymentQueueItem | null> {
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return docToItem(snap);
}

// ─── Patch ────────────────────────────────────────────────────────────────────

export async function patchPaymentQueueItem(
    id: string,
    patch: TPaymentQueuePatchBody,
    actorUid?: string,
): Promise<TPaymentQueueItem | null> {
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const now = isoNow();
  const update: Record<string, unknown> = {'updatedAtISO': now, 'system.lastWriteAt': now, 'system.lastWriter': FN};
  const localFields: string[] = [];
  const mark = (field: string, value: unknown) => {
    update[field] = value;
    localFields.push(field);
  };

  if (patch.amount !== undefined) {
    const amount = Number(patch.amount || 0);
    mark('amount', amount);
    mark('amountAbs', patch.amountAbs !== undefined ? Number(patch.amountAbs || 0) : Math.abs(amount));
    if (patch.direction === undefined) mark('direction', amount < 0 ? 'return' : 'charge');
  }
  if (patch.amountAbs !== undefined && patch.amount === undefined) mark('amountAbs', Number(patch.amountAbs || 0));
  if (patch.direction !== undefined) mark('direction', patch.direction);
  if (patch.merchant !== undefined) mark('merchant', patch.merchant);
  if (patch.expenseType !== undefined) mark('expenseType', patch.expenseType);
  if (patch.program !== undefined) mark('program', patch.program);
  if (patch.purpose !== undefined) mark('purpose', patch.purpose);
  if (patch.notes !== undefined) mark('notes', patch.notes);
  if (patch.note !== undefined) mark('note', patch.note);
  if (patch.card !== undefined) mark('card', patch.card);
  if (patch.cardBucket !== undefined) mark('cardBucket', patch.cardBucket);
  if (patch.grantId !== undefined) mark('grantId', patch.grantId);
  if (patch.lineItemId !== undefined) mark('lineItemId', patch.lineItemId);
  if (patch.customerId !== undefined) mark('customerId', patch.customerId);
  if (patch.enrollmentId !== undefined) mark('enrollmentId', patch.enrollmentId);
  if (patch.creditCardId !== undefined) mark('creditCardId', patch.creditCardId);
  if (patch.invoiceStatus !== undefined) mark('invoiceStatus', patch.invoiceStatus);
  if (patch.invoiceRef !== undefined) mark('invoiceRef', patch.invoiceRef);
  if (patch.okUnassigned !== undefined) {
    mark('okUnassigned', patch.okUnassigned);
    if (patch.okUnassigned) {
      update.okUnassignedAt = now;
      update.okUnassignedBy = actorUid ?? null;
    } else {
      update.okUnassignedAt = null;
      update.okUnassignedBy = null;
    }
  }
  if (localFields.length) {
    const prev = snap.data() || {};
    update.localModified = true;
    update.localModifiedAt = now;
    update.localModifiedBy = actorUid ?? null;
    update.localModifiedFields = Array.from(new Set([...(Array.isArray((prev as any).localModifiedFields) ? (prev as any).localModifiedFields : []), ...localFields]));
    update.localModificationReason = patch.localModificationReason ? String(patch.localModificationReason).trim() : ((prev as any).localModificationReason ?? null);
  }

  await ref.update(removeUndefinedDeep(update) as any);
  const prevItem = snap.data() as TPaymentQueueItem;
  const changedBudgetFields = localFields.some((field) => ['amount', 'grantId', 'lineItemId', 'customerId'].includes(field));
  if (prevItem?.queueStatus === 'posted' && prevItem.ledgerEntryId && changedBudgetFields) {
    const ledgerUpdate: Record<string, unknown> = {
      updatedAt: now,
      'origin.localQueueCorrection': true,
      'origin.localQueueCorrectionAt': now,
      'origin.localQueueCorrectionBy': actorUid ?? null,
    };
    if (update.amount !== undefined) {
      ledgerUpdate.amount = update.amount;
      ledgerUpdate.amountCents = Math.round(Number(update.amount || 0) * 100);
    }
    if (update.grantId !== undefined) ledgerUpdate.grantId = update.grantId;
    if (update.lineItemId !== undefined) ledgerUpdate.lineItemId = update.lineItemId;
    if (update.customerId !== undefined) ledgerUpdate.customerId = update.customerId;
    await db.collection('ledger').doc(prevItem.ledgerEntryId).set(removeUndefinedDeep(ledgerUpdate) as any, {merge: true});
    const grantIds = Array.from(new Set([String(prevItem.grantId || ''), String(update.grantId || '')].filter(Boolean)));
    await Promise.all(grantIds.map((gid) => recomputeCustomerSpendForGrant({grantId: gid}).catch(() => null)));
  }
  const updated = await ref.get();
  return docToItem(updated);
}

export async function recomputePaymentQueueGrantAllocations(grantId: string, dryRun = false) {
  return recomputeCustomerSpendForGrant({grantId, dryRun});
}

async function assertQueueGrantLineItem(item: TPaymentQueueItem): Promise<void> {
  const grantId = String(item.grantId || '').trim();
  const lineItemId = String(item.lineItemId || '').trim();

  // Both are required before posting to ledger — an unclassified item cannot
  // update grant budget totals and will silently leave the grant balance wrong.
  if (!grantId || !lineItemId) throw new Error('grant_and_lineitem_required_before_posting');

  const grantSnap = await db.collection('grants').doc(grantId).get();
  if (!grantSnap.exists) throw new Error('grant_not_found');

  const grant = grantSnap.data() || {};
  if (item.orgId && String((grant as any).orgId || '') !== String(item.orgId || '')) {
    throw new Error('grant_org_mismatch');
  }

  const lineItems: any[] = Array.isArray((grant as any)?.budget?.lineItems) ?
    (grant as any).budget.lineItems :
    [];
  const matched = lineItems.find((li: any) => String(li?.id || '') === lineItemId);
  if (!matched) throw new Error('line_item_not_found');
  if (matched?.locked) throw new Error('line_item_locked');
}

// ─── Void ─────────────────────────────────────────────────────────────────────

/**
 * Soft-void a single item (or all items for a submission baseId).
 * Used when a jotform submission is deleted or manually voided.
 */
export async function voidPaymentQueueItems(
    baseId: string,
    actorUid?: string,
): Promise<number> {
  const snap = await db
      .collection(COLLECTION)
      .where('baseId', '==', baseId)
      .where('queueStatus', '!=', 'void')
      .get();

  if (snap.empty) return 0;

  const now = isoNow();
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      'queueStatus': 'void',
      'voidedAt': now,
      'voidedBy': actorUid ?? null,
      'updatedAtISO': now,
      'system.lastWriter': FN,
      'system.lastWriteAt': now,
    });
  }
  await batch.commit();
  return snap.docs.length;
}

export async function syncEnrollmentProjectionQueueItems(args: {
  orgId: string | null;
  enrollmentId: string;
  grantId: string | null;
  customerId: string | null;
  customerName?: string | null;
  payments: Array<Record<string, unknown>>;
}): Promise<void> {
  const enrollmentId = String(args.enrollmentId || '').trim();
  if (!enrollmentId) return;

  const now = isoNow();
  const currentIds = new Set<string>();
  const batch = db.batch();

  // Batch-read all projection docs for this enrollment's payments in one round-trip.
  const payments = (args.payments || []) as Array<Record<string, unknown>>;
  const potentialRefs = payments
    .map((p) => {
      const pid = String(p.id || '').trim();
      return pid ? db.collection(COLLECTION).doc(projectionQueueDocId(enrollmentId, pid)) : null;
    })
    .filter((r): r is FirebaseFirestore.DocumentReference => r !== null);
  const existingSnaps = potentialRefs.length > 0 ? await db.getAll(...potentialRefs) : [];
  const existingMap = new Map(existingSnaps.map((s) => [s.id, s]));

  for (const raw of payments) {
    const payment = raw as Record<string, unknown>;
    const paymentId = String(payment.id || '').trim();
    const dueDate = String(payment.dueDate || payment.date || '').slice(0, 10);
    const amount = Number(payment.amount || 0);

    if (!paymentId) continue;
    if (payment.void === true) continue;
    if (payment.paid === true) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const docId = projectionQueueDocId(enrollmentId, paymentId);
    currentIds.add(docId);

    const ref = db.collection(COLLECTION).doc(docId);
    const existing = existingMap.get(docId);
    const prev = existing?.exists ? (existing.data() as TPaymentQueueItem) : null;
    const doc = buildProjectionQueueItem({
      context: {
        orgId: args.orgId,
        enrollmentId,
        grantId: args.grantId,
        customerId: args.customerId,
        customerName: args.customerName,
      },
      payment,
      prev,
      now,
    });

    batch.set(ref, removeUndefinedDeep(doc) as any, {merge: false});
  }

  const existingSnap = await db
      .collection(COLLECTION)
      .where('enrollmentId', '==', enrollmentId)
      .where('source', '==', 'projection')
      .get();

  for (const doc of existingSnap.docs) {
    if (currentIds.has(doc.id)) continue;
    const current = doc.data() as TPaymentQueueItem;
    // Projection items are ephemeral index docs — delete stale ones instead of voiding.
    // The ledger entry is the permanent record when paid; keeping void projection items
    // just clutters the collection and complicates queries.
    if (current.queueStatus === 'posted') continue; // posted = paid, leave it alone
    batch.delete(doc.ref);
  }

  await batch.commit();
}

export async function upsertProjectionQueueSpendState(args: {
  orgId: string | null;
  enrollmentId: string;
  grantId: string | null;
  customerId: string | null;
  customerName?: string | null;
  payment: Record<string, unknown>;
  queueStatus: 'pending' | 'posted';
  ledgerEntryId?: string | null;
  reversalEntryId?: string | null;
  postedAt?: string | null;
  postedBy?: string | null;
  reopenedAt?: string | null;
  reopenedBy?: string | null;
  reopenReason?: string | null;
}): Promise<void> {
  const paymentId = String(args.payment?.id || '').trim();
  if (!args.enrollmentId || !paymentId) return;

  const now = isoNow();
  const ref = db.collection(COLLECTION).doc(projectionQueueDocId(args.enrollmentId, paymentId));
  const existing = await ref.get();
  const prev = existing.exists ? (existing.data() as TPaymentQueueItem) : null;
  const doc = buildProjectionQueueItem({
    context: {
      orgId: args.orgId,
      enrollmentId: args.enrollmentId,
      grantId: args.grantId,
      customerId: args.customerId,
      customerName: args.customerName,
    },
    payment: args.payment,
    prev,
    now,
    state: {
      queueStatus: args.queueStatus,
      ledgerEntryId: args.ledgerEntryId ?? null,
      reversalEntryId: args.reversalEntryId ?? (prev?.reversalEntryId ?? null),
      postedAt: args.postedAt ?? null,
      postedBy: args.postedBy ?? null,
      reopenedAt: args.reopenedAt ?? (prev?.reopenedAt ?? null),
      reopenedBy: args.reopenedBy ?? (prev?.reopenedBy ?? null),
      reopenReason: args.reopenReason ?? (prev?.reopenReason ?? null),
    },
  });
  doc.system = {
    ...doc.system,
    lastWriter: 'upsertProjectionQueueSpendState',
    lastWriteAt: now,
  };

  await ref.set(removeUndefinedDeep(doc) as any, {merge: false});
}

// ─── Post to Ledger ───────────────────────────────────────────────────────────

/**
 * Post a PaymentQueueItem to the ledger.
 * - Creates a ledger entry using `writeLedgerEntry()`.
 * - Marks the queue item as `queueStatus: "posted"`.
 * - Links `ledgerEntryId` on the queue item.
 *
 * Idempotent: if `ledgerEntryId` is already set, returns the existing entry.
 */
export async function postPaymentQueueToLedger(
    id: string,
    body: TPaymentQueuePostToLedgerBody,
    actorUid?: string,
): Promise<{ queueItem: TPaymentQueueItem; ledgerEntryId: string } | null> {
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const item = docToItem(snap);

  // Already posted — idempotent return
  if (item.queueStatus === 'posted' && item.ledgerEntryId) {
    return {queueItem: item, ledgerEntryId: item.ledgerEntryId};
  }

  if (item.queueStatus === 'void') {
    throw new Error(`PaymentQueueItem ${id} is voided; cannot post to ledger.`);
  }
  if (item.source === 'projection') {
    throw new Error('use_payments_spend_for_projection');
  }

  await assertQueueGrantLineItem(item);

  const now = isoNow();
  const actor = actorUid ?? body.postedBy ?? null;
  const labels = [
    item.source,
    item.cardBucket || null,
    item.isFlex ? 'flex' : null,
    'paymentQueue',
    item.source === 'invoice' ? 'invoice' : null,
    item.source === 'credit-card' ? 'credit-card' : null,
  ].filter(Boolean) as string[];
  const noteParts = [item.note, item.notes, item.purpose, item.descriptor].filter(Boolean).map(String);
  const commentParts = [item.expenseType, item.program, item.project].filter(Boolean).map(String);

  const txResult = await db.runTransaction(async (trx) => {
    const rawEntry: Record<string, unknown> = {
      id: body.ledgerEntryId || undefined,
      orgId: item.orgId,
      source: item.source === 'credit-card' ? 'card' : 'manual',
      amount: item.amount,
      amountCents: Math.round(item.amount * 100),
      dueDate: item.dueDate || item.createdAt.slice(0, 10),
      month: item.month,
      description: [item.merchant, item.expenseType, item.program].filter(Boolean).join(' — '),
      vendor: item.merchant,
      grantId: item.grantId ?? null,
      lineItemId: item.lineItemId ?? null,
      customerId: item.customerId ?? null,
      enrollmentId: item.enrollmentId ?? null,
      customerNameAtSpend: item.customer || null,
      lineItemLabelAtSpend: item.program || item.project || null,
      paymentLabelAtSpend: item.descriptor || item.formTitle || item.submissionId || null,
      creditCardId: item.creditCardId ?? null,
      note: noteParts.length ? noteParts : null,
      comment: commentParts.length ? commentParts.join(' | ') : null,
      labels,
      origin: {
        app: 'hdb',
        baseId: item.id,
        sourcePath: `paymentQueue/${item.id}`,
        paymentQueueId: item.id,
        paymentQueueSource: item.source,
        jotformSubmissionId: item.submissionId || null,
        direction: item.direction || null,
        amountFieldId: item.amountFieldId || null,
        extractionGroup: item.extractionGroup || null,
      },
    };

    const entry = writeLedgerEntry(trx, rawEntry);
    const ledgerEntryId = entry.id as string;

    trx.update(ref, removeUndefinedDeep({
      'queueStatus': 'posted',
      ledgerEntryId,
      'postedAt': now,
      'postedBy': actor,
      'reopenedAt': null,
      'reopenedBy': null,
      'reopenReason': null,
      'updatedAtISO': now,
      'system.lastWriter': FN,
      'system.lastWriteAt': now,
    }) as any);

    const updatedSnap = await trx.get(ref);
    return {queueItem: docToItem(updatedSnap), ledgerEntryId};
  });

  // Update per-customer cap tracking outside the ledger transaction (best-effort, non-blocking)
  if (txResult && item.grantId && item.customerId && item.amount !== 0) {
    recordCustomerSpend({
      grantId: item.grantId,
      customerId: item.customerId,
      lineItemId: item.lineItemId || null,
      amount: item.amount,
    }).catch(() => {/* non-fatal */});
  }

  return txResult;
}

export async function bypassClosePaymentQueueItems(
    body: TPaymentQueueBypassCloseBody,
    actorUid?: string,
): Promise<{ closed: string[]; skipped: Array<{ id: string; reason: string }> }> {
  const ids = Array.from(new Set(body.ids.map((id) => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) return {closed: [], skipped: []};

  const refs = ids.map((id) => db.collection(COLLECTION).doc(id));
  const snaps = await db.getAll(...refs);
  const now = isoNow();
  const actor = actorUid ?? body.postedBy ?? null;
  const reason = body.reason ? String(body.reason).trim() : null;
  const batch = db.batch();
  const closed: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  snaps.forEach((snap, index) => {
    const id = ids[index];
    if (!snap.exists) {
      skipped.push({id, reason: 'not_found'});
      return;
    }

    const item = docToItem(snap);
    if (item.source !== 'credit-card' && item.source !== 'invoice') {
      skipped.push({id, reason: 'unsupported_source'});
      return;
    }
    if (item.queueStatus === 'void') {
      skipped.push({id, reason: 'void'});
      return;
    }
    if (item.queueStatus === 'posted') {
      skipped.push({id, reason: 'already_posted'});
      return;
    }

    batch.update(snap.ref, removeUndefinedDeep({
      'queueStatus': 'posted',
      'postedAt': now,
      'postedBy': actor,
      'compliance.hmisComplete': true,
      'compliance.caseworthyComplete': true,
      'closedBypassLedger': true,
      'closedBypassLedgerAt': now,
      'closedBypassLedgerBy': actor,
      'closedBypassLedgerReason': reason,
      'updatedAtISO': now,
      'system.lastWriter': 'paymentQueueBypassClose',
      'system.lastWriteAt': now,
    }) as any);
    closed.push(id);
  });

  if (closed.length) await batch.commit();
  return {closed, skipped};
}

export async function reopenPaymentQueueItem(
    id: string,
    body: TPaymentQueueReopenBody,
    actorUid?: string,
): Promise<{ queueItem: TPaymentQueueItem; reversalEntryId: string } | null> {
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const item = docToItem(snap);
  if (item.queueStatus === 'void') {
    throw new Error(`PaymentQueueItem ${id} is voided; cannot reopen.`);
  }
  if (item.source === 'projection') {
    throw new Error('use_payments_spend_for_projection_reverse');
  }
  if (item.queueStatus !== 'posted' || !item.ledgerEntryId) {
    throw new Error('queue_item_not_posted');
  }

  const ledgerSnap = await db.collection('ledger').doc(item.ledgerEntryId).get();
  if (!ledgerSnap.exists) throw new Error('linked_ledger_not_found');
  const original = (ledgerSnap.data() || {}) as Record<string, unknown>;

  const now = isoNow();
  const actor = actorUid ?? body.reopenedBy ?? null;
  const reversalLabels = Array.from(
      new Set([
        ...((Array.isArray(original.labels) ? original.labels : []) as string[]),
        'paymentQueue',
        'reversal',
      ].filter(Boolean)),
  );

  const txResult = await db.runTransaction(async (trx) => {
    const reversal = writeLedgerEntry(trx, {
      id: body.reversalEntryId || undefined,
      source: String(original.source || '') || (item.source === 'credit-card' ? 'card' : 'manual'),
      orgId: original.orgId ?? item.orgId ?? null,
      amountCents: -Number(original.amountCents ?? Math.round(item.amount * 100)),
      amount: -Number(original.amount ?? item.amount ?? 0),
      grantId: original.grantId ?? item.grantId ?? null,
      lineItemId: original.lineItemId ?? item.lineItemId ?? null,
      creditCardId: original.creditCardId ?? item.creditCardId ?? null,
      enrollmentId: original.enrollmentId ?? item.enrollmentId ?? null,
      customerId: original.customerId ?? item.customerId ?? null,
      note: body.reason ?
        [String(original.note || '').trim(), `Reopen reason: ${String(body.reason).trim()}`].filter(Boolean) :
        original.note ?? null,
      vendor: original.vendor ?? item.merchant ?? null,
      comment: body.reason ? String(body.reason).trim() : original.comment ?? null,
      labels: reversalLabels,
      dueDate: original.dueDate ?? item.dueDate ?? item.createdAt.slice(0, 10),
      month: original.month ?? item.month,
      origin: {
        app: 'hdb',
        baseId: item.id,
        sourcePath: `paymentQueue/${item.id}`,
      },
      grantNameAtSpend: original.grantNameAtSpend ?? null,
      lineItemLabelAtSpend: original.lineItemLabelAtSpend ?? null,
      customerNameAtSpend: original.customerNameAtSpend ?? item.customer ?? null,
      paymentLabelAtSpend: original.paymentLabelAtSpend ?? item.descriptor ?? null,
      reversalOf: item.ledgerEntryId,
    });

    trx.update(ref, removeUndefinedDeep({
      'queueStatus': 'pending',
      'reversalEntryId': reversal.id,
      'reopenedAt': now,
      'reopenedBy': actor,
      'reopenReason': body.reason ? String(body.reason).trim() : null,
      'ledgerEntryId': null,
      'postedAt': null,
      'postedBy': null,
      'updatedAtISO': now,
      'system.lastWriter': FN,
      'system.lastWriteAt': now,
    }) as any);

    const updatedSnap = await trx.get(ref);
    return {queueItem: docToItem(updatedSnap), reversalEntryId: String(reversal.id || '')};
  });

  if (txResult && item.grantId && item.customerId && item.amount !== 0) {
    recordCustomerSpend({
      grantId: item.grantId,
      customerId: item.customerId,
      lineItemId: item.lineItemId || null,
      amount: -Number(item.amount || 0),
    }).catch(() => {/* non-fatal */});
  }

  return txResult;
}

// ─── Upsert (called by trigger) ───────────────────────────────────────────────

/**
 * Write or re-extract a set of PaymentQueueItems from a Jotform submission.
 * Preserves downstream linking fields (grantId, customerId, etc.) on re-extract.
 * Always overwrites extracted fields (amount, merchant, etc.).
 */
export async function upsertPaymentQueueItems(
    items: Array<{
    extracted: import('./extractor').ExtractedSpendItem;
    orgId: string | null;
  }>,
): Promise<void> {
  if (items.length === 0) return;

  const now = isoNow();

  // Batch-read all existing docs in a single round-trip instead of N sequential gets.
  const refs = items.map(({extracted}) => db.collection(COLLECTION).doc(extracted.id));
  const existingSnaps = await db.getAll(...refs);
  const existingMap = new Map(existingSnaps.map((s) => [s.id, s]));

  const batch = db.batch();

  for (const {extracted, orgId} of items) {
    const ref = db.collection(COLLECTION).doc(extracted.id);
    const existing = existingMap.get(extracted.id);
    const isNew = !existing?.exists;
    const prev = isNew ? null : (existing!.data() as TPaymentQueueItem);

    // Preserve downstream linking & workflow fields from existing doc
    const preserved = prev ?
      {
        paymentId: prev.paymentId ?? null,
        grantId: prev.grantId ?? null,
        dueDate: prev.dueDate ?? null,
        lineItemId: prev.lineItemId ?? null,
        customerId: prev.customerId ?? null,
        enrollmentId: prev.enrollmentId ?? null,
        creditCardId: prev.creditCardId ?? extracted.creditCardId ?? null,
        ledgerEntryId: prev.ledgerEntryId ?? null,
        reversalEntryId: prev.reversalEntryId ?? null,
        invoiceStatus: prev.invoiceStatus ?? null,
        invoicedAt: prev.invoicedAt ?? null,
        invoicedBy: prev.invoicedBy ?? null,
        invoiceRef: prev.invoiceRef ?? null,
        okUnassigned: prev.okUnassigned ?? false,
        okUnassignedAt: prev.okUnassignedAt ?? null,
        okUnassignedBy: prev.okUnassignedBy ?? null,
        queueStatus: prev.queueStatus ?? 'pending',
        voidedAt: prev.voidedAt ?? null,
        voidedBy: prev.voidedBy ?? null,
        postedAt: prev.postedAt ?? null,
        postedBy: prev.postedBy ?? null,
        reopenedAt: prev.reopenedAt ?? null,
        reopenedBy: prev.reopenedBy ?? null,
        reopenReason: prev.reopenReason ?? null,
        createdAtISO: prev.createdAtISO ?? now,
      } :
      {
        paymentId: null, grantId: null, dueDate: null, lineItemId: null, customerId: null, enrollmentId: null, creditCardId: extracted.creditCardId ?? null, ledgerEntryId: null, reversalEntryId: null,
        invoiceStatus: null, invoicedAt: null, invoicedBy: null, invoiceRef: null,
        okUnassigned: false, okUnassignedAt: null, okUnassignedBy: null,
        queueStatus: 'pending' as const,
        voidedAt: null, voidedBy: null, postedAt: null, postedBy: null,
        reopenedAt: null, reopenedBy: null, reopenReason: null,
        createdAtISO: now,
      };

    const extractedWithLocal = applyLocalOverrides(
        extracted as unknown as Record<string, unknown>,
        prev as unknown as Record<string, unknown> | null,
    ) as typeof extracted;

    const doc: TPaymentQueueItem = {
      ...extractedWithLocal,
      orgId,
      ...preserved,
      localModified: prev?.localModified ?? false,
      localModifiedAt: prev?.localModifiedAt ?? null,
      localModifiedBy: prev?.localModifiedBy ?? null,
      localModifiedFields: prev?.localModifiedFields ?? [],
      localModificationReason: prev?.localModificationReason ?? null,
      updatedAtISO: now,
      system: {
        lastWriter: 'onPaymentQueueSync',
        lastWriteAt: now,
        extractionVersion: extracted.schemaVersion,
      },
    };

    batch.set(ref, removeUndefinedDeep(doc) as any, {merge: false});
  }

  await batch.commit();
}
