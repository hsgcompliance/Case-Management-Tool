// functions/src/features/paymentQueue/service.ts
import {db, isoNow, removeUndefinedDeep} from '../../core';
import {writeLedgerEntry} from '../ledger/service';
import {recordCustomerSpend} from '../grants/lineItemCaps';
import {primarySubtype} from '../payments/utils';
import {
  type TPaymentQueueItem,
  type TPaymentQueueListBody,
  type TPaymentQueuePatchBody,
  type TPaymentQueuePostToLedgerBody,
  type TPaymentQueueReopenBody,
} from './schemas';

const COLLECTION = 'paymentQueue';
const FN = 'paymentQueueService';

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
  const items = docs.map(docToItem);

  return {items, count: items.length, hasMore};
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

  if (patch.grantId !== undefined) update.grantId = patch.grantId;
  if (patch.lineItemId !== undefined) update.lineItemId = patch.lineItemId;
  if (patch.customerId !== undefined) update.customerId = patch.customerId;
  if (patch.enrollmentId !== undefined) update.enrollmentId = patch.enrollmentId;
  if (patch.creditCardId !== undefined) update.creditCardId = patch.creditCardId;
  if (patch.invoiceStatus !== undefined) update.invoiceStatus = patch.invoiceStatus;
  if (patch.invoiceRef !== undefined) update.invoiceRef = patch.invoiceRef;
  if (patch.okUnassigned !== undefined) {
    update.okUnassigned = patch.okUnassigned;
    if (patch.okUnassigned) {
      update.okUnassignedAt = now;
      update.okUnassignedBy = actorUid ?? null;
    } else {
      update.okUnassignedAt = null;
      update.okUnassignedBy = null;
    }
  }

  await ref.update(removeUndefinedDeep(update) as any);
  const updated = await ref.get();
  return docToItem(updated);
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

  for (const raw of args.payments || []) {
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
    const existing = await ref.get();
    const prev = existing.exists ? (existing.data() as TPaymentQueueItem) : null;
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
  if (txResult && item.grantId && item.customerId && item.amount > 0) {
    recordCustomerSpend({
      grantId: item.grantId,
      customerId: item.customerId,
      lineItemId: item.lineItemId || null,
      amount: item.amount,
    }).catch(() => {/* non-fatal */});
  }

  return txResult;
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
      amountCents: -Math.abs(Number(original.amountCents || Math.round(item.amount * 100))),
      amount: -Math.abs(Number(original.amount || item.amount || 0)),
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

  if (txResult && item.grantId && item.customerId && item.amount > 0) {
    recordCustomerSpend({
      grantId: item.grantId,
      customerId: item.customerId,
      lineItemId: item.lineItemId || null,
      amount: -Math.abs(item.amount),
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
  const batch = db.batch();

  for (const {extracted, orgId} of items) {
    const ref = db.collection(COLLECTION).doc(extracted.id);
    const existing = await ref.get();
    const isNew = !existing.exists;
    const prev = isNew ? null : (existing.data() as TPaymentQueueItem);

    // Preserve downstream linking & workflow fields from existing doc
    const preserved = prev ?
      {
        paymentId: prev.paymentId ?? null,
        grantId: prev.grantId ?? null,
        dueDate: prev.dueDate ?? null,
        lineItemId: prev.lineItemId ?? null,
        customerId: prev.customerId ?? null,
        enrollmentId: prev.enrollmentId ?? null,
        creditCardId: prev.creditCardId ?? null,
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
        paymentId: null, grantId: null, dueDate: null, lineItemId: null, customerId: null, enrollmentId: null, creditCardId: null, ledgerEntryId: null, reversalEntryId: null,
        invoiceStatus: null, invoicedAt: null, invoicedBy: null, invoiceRef: null,
        okUnassigned: false, okUnassignedAt: null, okUnassignedBy: null,
        queueStatus: 'pending' as const,
        voidedAt: null, voidedBy: null, postedAt: null, postedBy: null,
        reopenedAt: null, reopenedBy: null, reopenReason: null,
        createdAtISO: now,
      };

    const doc: TPaymentQueueItem = {
      ...extracted,
      orgId,
      ...preserved,
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
