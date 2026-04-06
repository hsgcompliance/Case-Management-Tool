// functions/src/features/payments/upsertProjections.ts
/**
 * Deterministic upsert of enrollment projections; adjusts grant budget.projected.
 * POST /paymentsUpsertProjections
 * Body: { enrollmentId: string, payments: Payment[] }
 */
import {
  db,
  FieldValue,
  secureHandler,
  computeBudgetTotals,
} from '../../core';
import type {Request, Response} from 'express';
import {
  ensurePaymentIds,
  assertOrgAccess,
  requireUid,
  getGrantWindowISO,
  isInGrantWindow,
  ensureMonthlySubtypeTag,
} from './utils';
import {
  PaymentsUpsertProjectionsBody,
  type TPaymentsUpsertProjectionsBody,
} from './schemas';
/** POST /paymentsUpsertProjections */
export async function paymentsUpsertProjectionsHandler(req: Request, res: Response) {
  const parsed = PaymentsUpsertProjectionsBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ok: false, error: parsed.error.message});

  const user: any = (req as any)?.user || {};
  let uid = '';
  try {
    uid = requireUid(user);
  } catch (e: any) {
    return res.status(401).json({ok: false, error: e?.message || 'auth_required'});
  }

  const {enrollmentId, payments} = parsed.data as TPaymentsUpsertProjectionsBody;

  try {
    const result = await db.runTransaction(async (trx) => {
      const eRef = db.collection('customerEnrollments').doc(enrollmentId);
      const eSnap = await trx.get(eRef);
      if (!eSnap.exists) throw new Error('Enrollment not found');

      const e: any = eSnap.data() || {};
      assertOrgAccess(user, e);

      const gRef = db.collection('grants').doc(String(e.grantId));
      const gSnap = await trx.get(gRef);
      if (!gSnap.exists) throw new Error('Grant not found');
      const grant: any = gSnap.data() || {};
      assertOrgAccess(user, grant);

      const win = getGrantWindowISO(grant);

      const oldPayments: any[] = Array.isArray(e.payments) ? e.payments : [];

      // Normalize subtype tagging BEFORE id assignment so subtype identity is explicit/stable.
      const normalized = (payments || []).map(ensureMonthlySubtypeTag);
      const withIdsRaw = ensurePaymentIds(normalized, oldPayments);

      const withIds = withIdsRaw.map((p: any) => {
        const dueDate = p?.dueDate || p?.date;
        return {
          ...p,
          ...(dueDate ? {dueDate: String(dueDate).slice(0, 10)} : {}),
          // keep legacy field out of stored canonical schedule
          ...(p?.date !== undefined ? {date: undefined} : {}),
        };
      });

      // projected totals by LI: ALL unpaid
      const sumUnpaidByLI = (arr: any[]) =>
        arr.reduce((m, p) => {
          if (!p?.paid) {
            const k = String(p?.lineItemId || '');
            m[k] = (m[k] || 0) + Number(p?.amount || 0);
          }
          return m;
        }, {} as Record<string, number>);

      // projected-in-window by LI: unpaid AND within grant window
      const sumUnpaidInWindowByLI = (arr: any[]) =>
        arr.reduce((m, p) => {
          if (!p?.paid && isInGrantWindow(p?.dueDate || p?.date, win)) {
            const k = String(p?.lineItemId || '');
            m[k] = (m[k] || 0) + Number(p?.amount || 0);
          }
          return m;
        }, {} as Record<string, number>);

      const oldUnpaid = sumUnpaidByLI(oldPayments);
      const newUnpaid = sumUnpaidByLI(withIds);

      const oldUnpaidWin = sumUnpaidInWindowByLI(oldPayments);
      const newUnpaidWin = sumUnpaidInWindowByLI(withIds);

      const lineItems: any[] = Array.isArray(grant?.budget?.lineItems) ?
        grant.budget.lineItems :
        [];
      const liById: Record<string, any> = Object.fromEntries(lineItems.map((li: any) => [String(li.id), li]));
      const touched = new Set([
        ...Object.keys(oldUnpaid),
        ...Object.keys(newUnpaid),
        ...Object.keys(oldUnpaidWin),
        ...Object.keys(newUnpaidWin),
      ]);

      const overCaps: Record<string, number> = {};

      for (const id of touched) {
        const li = liById[id];
        if (!li) throw new Error(`Unknown lineItemId: ${id}`);
        if (li.locked) throw new Error(`Line item locked: ${id}`);

        const prevProjected = Number(li.projected || 0);
        const delta = Number(newUnpaid[id] || 0) - Number(oldUnpaid[id] || 0);
        const nextProjected = Math.max(0, prevProjected + delta);

        const prevProjectedWin = Number(li.projectedInWindow || 0);
        const deltaWin = Number(newUnpaidWin[id] || 0) - Number(oldUnpaidWin[id] || 0);
        const nextProjectedWin = Math.max(0, prevProjectedWin + deltaWin);

        const cap = Number(li.amount || 0);
        const spent = Number(li.spent || 0);

        const overBy = Math.max(0, (spent + nextProjected) - cap);
        if (overBy > 0) overCaps[id] = overBy;

        li.projected = nextProjected;
        li.projectedInWindow = nextProjectedWin;

        if (overBy > 0) li.overCap = overBy;
        else delete li.overCap;
      }

      const baseTotals = computeBudgetTotals(lineItems as any[]);
      const projectedInWindow = lineItems.reduce(
          (s, i) => s + Number((i as any).projectedInWindow || 0),
          0,
      );
      const spentInWindow = lineItems.reduce(
          (s, i) => s + Number((i as any).spentInWindow || 0),
          0,
      );

      const existingTotals =
        grant?.budget?.totals && typeof grant.budget.totals === 'object' ?
          grant.budget.totals :
          {};

      const totals: any = {
        ...existingTotals,
        ...baseTotals,
        remaining: baseTotals.balance,
        projectedInWindow,
        spentInWindow,
        windowBalance: Number(baseTotals.total || 0) - spentInWindow,
        windowProjectedBalance:
          Number(baseTotals.total || 0) - (spentInWindow + projectedInWindow),
        projectedSpend: baseTotals.projectedSpend,
      };

      trx.update(gRef, {
        'budget.lineItems': lineItems,
        'budget.total': baseTotals.total,
        'budget.totals': totals,
        'budget.updatedAt': FieldValue.serverTimestamp(),
      });

      const overSet = new Set(Object.keys(overCaps).filter(Boolean));
      const annotated = withIds.map((p: any) => {
        if (!overSet.has(String(p.lineItemId || ''))) return p;
        const tags = Array.isArray(p.note) ? p.note.slice() : p.note ? [p.note] : [];
        if (!tags.find((t: any) => String(t).toLowerCase() === 'overcap')) tags.push('overCap');
        return {...p, note: tags.slice(0, 10)};
      });

      trx.update(eRef, {payments: annotated, updatedAt: FieldValue.serverTimestamp()});

      if (Object.keys(overCaps).length) {
        const flagRef = db.collection('auditFlags').doc();
        trx.set(flagRef, {
          context: 'paymentsUpsertProjections',
          enrollmentId,
          grantId: e.grantId,
          overCaps,
          byUid: uid,
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      return {
        id: enrollmentId,
        payments: annotated,
        orgId: e.orgId ? String(e.orgId) : null,
        grantId: e.grantId ? String(e.grantId) : null,
        customerId: e.customerId ? String(e.customerId) : null,
        customerName: e.customerName ? String(e.customerName) : null,
      };
    });

    // paymentQueue projection sync is handled by the onEnrollmentPaymentsChange trigger.

    return res.status(200).json({ok: true, ...result});
  } catch (err: any) {
    return res.status(500).json({ok: false, error: err?.message || String(err)});
  }
}

export const paymentsUpsertProjections = secureHandler(
    async (req, res): Promise<void> => {
      await paymentsUpsertProjectionsHandler(req as any, res as any);
    },
    {auth: 'user', methods: ['POST', 'OPTIONS']},
);
