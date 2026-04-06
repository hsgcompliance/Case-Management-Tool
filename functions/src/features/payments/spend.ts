// functions/src/features/payments/spend.ts
/**
 * Book a spend (or reversal) against a payment, rebalancing grant budget and writing ledger.
 * POST /paymentsSpend
 * Body: { enrollmentId, paymentId, note?, reverse?, vendor?, comment? }
 */
import {
  computeBudgetTotals,
  toMonthKey,
  db,
  FieldValue,
  Timestamp,
  withTxn,
  ensureIdempotent,
  makeIdempoKey,
  removeUndefinedDeep,
  secureHandler,
} from '../../core';
import type {Request, Response} from 'express';
import {writeLedgerEntry} from '../ledger/service';
import {PaymentsSpendBody, type TPaymentsSpendBody} from './schemas';
import {
  assertOrgAccess,
  requireUid,
  getGrantWindowISO,
  isInGrantWindow,
  primarySubtype,
} from './utils';

const monthKey = (iso: string) => toMonthKey(iso);

/** POST /paymentsSpend */
export async function paymentsSpendHandler(req: Request, res: Response) {
  const parsed = PaymentsSpendBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ok: false, error: parsed.error.message});
  }

  const body: TPaymentsSpendBody = parsed.data;
  const {enrollmentId, paymentId, note, reverse, vendor, comment} = body;

  const user: any = (req as any)?.user || {};
  let uid = '';
  try {
    uid = requireUid(user);
  } catch (e: any) {
    return res.status(401).json({ok: false, error: e?.message || 'auth_required'});
  }

  const externalIdempoRaw =
    String((req.headers['idempotency-key'] as any) || '').trim() || null;

  try {
    await withTxn(async (trx) => {
      // ---- load enrollment + payment ----
      const eRef = db.collection('customerEnrollments').doc(enrollmentId);
      const eSnap = await trx.get(eRef);
      if (!eSnap.exists) throw new Error('Enrollment not found');

      const e: any = eSnap.data() || {};
      assertOrgAccess(user, e);

      const paymentsArr: any[] = Array.isArray(e.payments) ? e.payments : [];
      const idx = paymentsArr.findIndex((p: any) => p?.id === paymentId);
      if (idx < 0) throw new Error('Payment not found');

      const p: any = paymentsArr[idx] || {};

      // If it's already in the desired state, noop (idempotent-at-state)
      if (!reverse && p.paid) return;
      if (reverse && !p.paid) return;

      const amt = Number(p.amount || 0);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Invalid amount');
      const amountCents = Math.round(amt * 100);

      const lineItemId = String(p.lineItemId || '');
      if (!lineItemId) throw new Error('Payment missing lineItemId');

      // ---- load grant + line item ----
      const grantId = String(e.grantId || '');
      const gRef = db.collection('grants').doc(grantId);
      const gSnap = await trx.get(gRef);
      if (!gSnap.exists) throw new Error('Grant not found');

      const grant: any = gSnap.data() || {};
      assertOrgAccess(user, grant);

      const win = getGrantWindowISO(grant);

      const lineItems: any[] = Array.isArray(grant?.budget?.lineItems) ?
        grant.budget.lineItems :
        [];

      const li = lineItems.find((x: any) => String(x?.id) === lineItemId);
      if (!li) throw new Error(`Line item missing: ${lineItemId}`);
      if (li.locked) throw new Error(`Line item locked: ${lineItemId}`);

      const dueDateISO = String(p.dueDate || p.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateISO)) {
        throw new Error('Payment missing valid dueDate (YYYY-MM-DD)');
      }
      const inWin = isInGrantWindow(dueDateISO, win);
      const dueMonth = monthKey(dueDateISO);

      // ---- adjust LI projected/spent ----
      // Policy: projected = all unpaid obligations
      if (!reverse) {
        li.projected = Math.max(0, Number(li.projected || 0) - amt);
        li.spent = Number(li.spent || 0) + amt;

        if (inWin) {
          li.projectedInWindow = Math.max(0, Number(li.projectedInWindow || 0) - amt);
          li.spentInWindow = Number(li.spentInWindow || 0) + amt;
        }
      } else {
        li.spent = Math.max(0, Number(li.spent || 0) - amt);
        li.projected = Math.max(0, Number(li.projected || 0) + amt);

        if (inWin) {
          li.spentInWindow = Math.max(0, Number(li.spentInWindow || 0) - amt);
          li.projectedInWindow = Math.max(0, Number(li.projectedInWindow || 0) + amt);
        }
      }

      // Over-cap bookkeeping per LI (based on TOTALS, not windowed)
      {
        const capNow = Number(li.amount || 0);
        const overNow = Math.max(
            0,
            (Number(li.spent || 0) + Number(li.projected || 0)) - capNow,
        );
        if (overNow > 0) li.overCap = overNow;
        else delete li.overCap;
      }

      // ---- recompute budget totals (after mutation) ----
      const baseTotals = computeBudgetTotals(lineItems as any[]);
      const projectedInWindow = lineItems.reduce(
          (s: number, i: any) => s + Number(i?.projectedInWindow || 0),
          0,
      );
      const spentInWindow = lineItems.reduce(
          (s: number, i: any) => s + Number(i?.spentInWindow || 0),
          0,
      );

      const totals = {
        ...baseTotals,
        // legacy compat: this path historically used remaining == balance
        remaining: baseTotals.balance,
        projectedInWindow,
        spentInWindow,
        windowBalance: Number(baseTotals.total || 0) - spentInWindow,
        windowProjectedBalance:
          Number(baseTotals.total || 0) - (spentInWindow + projectedInWindow),
        // projectedSpend = spent + projected (total allocated)
        projectedSpend: baseTotals.projectedSpend,
      } as any;

      // ---- update payment row notes + paid flags ----
      const paidAtISO = new Date().toISOString();
      const payments = paymentsArr.slice();

      const existingNotes = Array.isArray(p.note) ? p.note.slice() : p.note ? [p.note] : [];

      const incomingNotes = Array.isArray(note) ?
        note.map(String) :
        note != null ?
        [String(note)] :
        [];

      const add: string[] = [];
      for (const n of incomingNotes) {
        const t = String(n).trim();
        if (t) add.push(t);
      }
      if (vendor) add.push(`vendor:${vendor}`);
      if (comment) add.push(String(comment));

      const noteArr = Array.from(new Set([...existingNotes, ...add]))
          .map((x) => String(x).trim())
          .filter(Boolean)
          .slice(0, 10);

      if (!reverse) {
        payments[idx] = {
          ...p,
          paid: true,
          paidAt: paidAtISO,
          note: noteArr.length ? noteArr : p.note,
          vendor: vendor ?? p.vendor,
          comment: comment ?? p.comment,
        };
      } else {
        payments[idx] = {...p, paid: false, paidAt: null};
      }

      // ---- look up case manager id ----
      const customerId =
        String(e.customerId || '').trim() || null;

      const cRef = db.collection('customers').doc(String(e.customerId || ''));
      const cSnap = await trx.get(cRef);
      const cmUid = cSnap.exists ? (cSnap.data() as any)?.caseManagerId || null : null;

      // ---- compute idempotency key (deterministic + firestore-safe) ----
      const lastSpendQuery = eRef
          .collection('spends')
          .where('paymentId', '==', paymentId)
          .orderBy('ts', 'desc')
          .limit(1);

      const lastSpendSnap = await trx.get(lastSpendQuery);
      const lastEdgeId = lastSpendSnap.empty ? '0' : (lastSpendSnap.docs[0].id || '0');

      // Stable key for this logical action.
      // Includes lastEdgeId to separate cycles (pay -> reverse -> pay).
      const computedKey = makeIdempoKey([
        'paymentsSpend',
        enrollmentId,
        paymentId,
        reverse ? 'R' : 'P',
        amountCents,
        lastEdgeId,
      ]);

      // If caller supplies an idempotency key, incorporate it (but never use it raw as a doc id).
      // This avoids collisions across different actions even if a buggy client reuses the same header.
      const idemKey = externalIdempoRaw ?
        makeIdempoKey([computedKey, 'hdr', externalIdempoRaw]) :
        computedKey;

      const idem = await ensureIdempotent(trx, idemKey, {
        enrollmentId,
        paymentId,
        reverse: !!reverse,
        amountCents,
        lastEdgeId,
        externalIdempotencyKey: externalIdempoRaw ? externalIdempoRaw.slice(0, 200) : null,
      });
      if ((idem as any).already) return;

      // ---- derived labels / notes ----
      const customerNameAtSpend =
        e.customerName ||
        (cSnap.exists ?
          ((cSnap.data() as any)?.name ||
              [
                (cSnap.data() as any)?.firstName,
                (cSnap.data() as any)?.lastName,
              ]
                  .filter(Boolean)
                  .join(' ')) :
          '') ||
        customerId ||
        '';

      const grantNameAtSpend = e.grantName || grant?.name || grantId;
      const lineItemLabelAtSpend = String(
          li.label || li.name || li.title || li.code || li.id || '',
      );

      const paymentTypeLabel =
        (p.type === 'deposit' && 'Deposit') ||
        (p.type === 'prorated' && 'Prorated Rent') ||
        (p.type === 'service' && 'Support Service') ||
        (() => {
          const sub = primarySubtype(p); // rent|utility (monthly); for non-monthly we won't reach here
          return sub === 'utility' ? 'Utility Assistance' : 'Rental Assistance';
        })();

      const paymentLabelAtSpend =
        (dueDateISO ? `${dueDateISO} · ` : '') + paymentTypeLabel;

      const overByNow = !reverse ?
        Math.max(
            0,
            (Number(li.spent || 0) + Number(li.projected || 0)) - Number(li.amount || 0),
        ) :
        0;

      const compiledNote =
        [incomingNotes.join(', '), comment, vendor, overByNow ? `overCap:$${overByNow.toFixed(2)}` : null]
            .map((x) => String(x ?? '').trim())
            .filter(Boolean)
            .join(' * ') || null;

      if (!reverse && overByNow > 0) {
        const flagRef = db.collection('auditFlags').doc();
        trx.set(flagRef, {
          context: 'paymentsSpend',
          enrollmentId,
          grantId,
          lineItemId,
          overBy: overByNow,
          amount: amt,
          paymentId,
          ts: Timestamp.now(),
        });
      }

      // ---- reversal linkage (best-effort, from embedded array) ----
      const prevSpend = (Array.isArray(e.spends) ? e.spends : [])
          .slice()
          .reverse()
          .find((s: any) => s?.paymentId === paymentId && !s?.reversalOf);

      const snapNote =
        Array.isArray(p?.note) ?
          p.note.filter((v: any) => v != null && String(v).trim() !== '') :
          p?.note != null ?
          p.note :
          undefined;

      // ---- deterministic spend id (ties to idemKey) ----
      const tsNow = Timestamp.now();
      const spendId = `sp_${idemKey}`;

      const spendEntry = {
        id: spendId,
        source: 'enrollment' as const,

        grantId,
        grantNameAtSpend,
        enrollmentId,
        customerId,
        customerNameAtSpend,
        caseManagerId: cmUid ?? null,

        paymentId,
        paymentType: p.type || 'monthly',
        paymentLabelAtSpend,

        lineItemId,
        lineItemLabelAtSpend,

        amount: reverse ? -amt : amt,
        amountCents: reverse ? -amountCents : amountCents,

        note: compiledNote,
        ts: tsNow,
        dueDate: dueDateISO || null,
        dueMonth: /^\d{4}-\d{2}$/.test(dueMonth) ? dueMonth : null,
        ...(reverse && prevSpend ? {reversalOf: prevSpend.id} : {}),

        byUid: uid,
        byName: user?.name || user?.displayName || '',
        by: {
          uid,
          email: String(user?.email || '').toLowerCase(),
          name: user?.name || user?.displayName || '',
        },

        paymentSnapshot: {
          amount: amt,
          type: p.type,
          lineItemId: lineItemId ?? null,
          dueDate: dueDateISO || null,
          ...(snapNote !== undefined ? {note: snapNote} : {}),
          ...(vendor != null ? {vendor} : {}),
          ...(comment != null ? {comment} : {}),
        },

        idempotencyKey: idemKey,
      };

      const safeSpendEntry = removeUndefinedDeep(spendEntry);

      // spends[] array removed — no 50-item cap; full history lives in ledger +
      // the spends subcollection (still written below for reversal linkage / idempotency).

      const led = {
        id: safeSpendEntry.id,
        source: 'enrollment' as const,
        orgId: grant?.orgId ?? null,

        amountCents: safeSpendEntry.amountCents,
        amount: safeSpendEntry.amount,

        grantId,
        lineItemId: lineItemId ?? null,
        enrollmentId,
        paymentId,
        customerId,
        caseManagerId: cmUid ?? null,

        note: safeSpendEntry.note ?? null,
        vendor: vendor ?? p.vendor ?? null,
        comment: comment ?? p.comment ?? null,
        labels: [],

        ts: tsNow,
        dueDate: safeSpendEntry.dueDate ?? null,
        month:
          safeSpendEntry.dueMonth ||
          (safeSpendEntry.dueDate || '').slice(0, 7) ||
          new Date().toISOString().slice(0, 7),

        origin: {
          app: 'hdb' as const,
          baseId: paymentId,
          sourcePath: `customerEnrollments/${enrollmentId}/spends/${safeSpendEntry.id}`,
          idempotencyKey: idemKey,
        },

        grantNameAtSpend: safeSpendEntry.grantNameAtSpend ?? null,
        lineItemLabelAtSpend: safeSpendEntry.lineItemLabelAtSpend ?? null,
        customerNameAtSpend: safeSpendEntry.customerNameAtSpend ?? null,
        paymentLabelAtSpend: safeSpendEntry.paymentLabelAtSpend ?? null,

        compliance: {
          hmisComplete: !!(p.compliance?.hmisComplete),
          caseworthyComplete: !!(p.compliance?.caseworthyComplete),
        },

        createdAt: tsNow,
        updatedAt: tsNow,
      };

      writeLedgerEntry(trx, led);

      // ---- writes ----
      trx.update(gRef, {
        'budget.lineItems': lineItems,
        'budget.total': baseTotals.total,
        'budget.totals': totals,
        'budget.updatedAt': FieldValue.serverTimestamp(),
      });

      // Write payments (paid flag update) but NOT the spends[] array.
      // Full spend history lives in the ledger + spends subcollection.
      trx.update(eRef, {
        payments,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Spends subcollection: still written for reversal linkage and idempotency key lookup.
      trx.set(eRef.collection('spends').doc(safeSpendEntry.id), safeSpendEntry);

      if (cmUid && /^\d{4}-\d{2}$/.test(dueMonth)) {
        trx.set(
            db.doc(`cmMonth/${cmUid}_${dueMonth}`),
            {
              paymentsDue: FieldValue.increment(reverse ? 1 : -1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
        );
      }

      if (/^\d{4}-\d{2}$/.test(dueMonth)) {
        trx.set(
            db.doc(`grantMonth/${grantId}_${dueMonth}`),
            {
              grantId,
              month: dueMonth,
              spent: FieldValue.increment(reverse ? -amt : amt),
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
        );
      }
    }, 'paymentsSpend');

    // paymentQueue projection sync is now handled by the onEnrollmentPaymentsChange trigger,
    // which fires when the enrollment document is updated above.

    return res.status(200).json({ok: true});
  } catch (err: any) {
    console.error('[paymentsSpend] ERROR', err?.message, err);
    return res.status(500).json({ok: false, error: err?.message || String(err)});
  }
}

export const paymentsSpend = secureHandler(
    async (req, res): Promise<void> => {
      await paymentsSpendHandler(req as any, res as any);
    },
    {auth: 'user', methods: ['POST', 'OPTIONS']},
);
