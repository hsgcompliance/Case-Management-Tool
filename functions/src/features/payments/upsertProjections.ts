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
  fromBudgetCents,
  sumBudgetField,
  toBudgetCents,
} from '../../core';
import type {Request, Response} from 'express';
import {computeGrantLineItemOverCap} from '@hdb/contracts';
import {
  ensurePaymentIds,
  assertOrgAccess,
  requireUid,
  getGrantWindowISO,
  isInGrantWindow,
  ensureMonthlySubtypeTag,
  carryRentCertState,
} from './utils';
import {
  PaymentsUpsertProjectionsBody,
  type TPaymentsUpsertProjectionsBody,
} from './schemas';

/**
 * Thrown when a schedule write would introduce a `monthly` (rent/utility) row
 * for a customer+grant+line-item+month that another enrollment already has a
 * live `monthly` row for. This is always a genuine duplicate — two rent
 * charges landing in the same month for the same grant — never a false
 * positive, unlike deposit/service/prorated rows which legitimately coexist
 * with rent in the same month. See root-cause doc for why this check exists:
 * docs/active-projects.local/report-reconciliation-workbench/root-cause-2026-07-21-duplicate-enrollment.md
 */
export class ScheduleMonthCollisionError extends Error {
  code = 409;
  conflicts: Array<{
    lineItemId: string;
    dueMonth: string;
    conflictEnrollmentId: string;
    conflictPaymentId: string;
    conflictAmount: number;
    conflictPaid: boolean;
  }>;
  constructor(conflicts: ScheduleMonthCollisionError['conflicts']) {
    super('monthly_schedule_collision');
    this.conflicts = conflicts;
  }
}

/** lineItemId -> set of YYYY-MM months carrying a live (non-void) `monthly` row. */
function monthlyMonthsByLineItem(payments: any[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const p of Array.isArray(payments) ? payments : []) {
    if (String(p?.type || '') !== 'monthly') continue;
    if (p?.void === true) continue;
    const lineItemId = String(p?.lineItemId || '').trim();
    const month = String(p?.dueDate || p?.date || '').slice(0, 7);
    if (!lineItemId || !/^\d{4}-\d{2}$/.test(month)) continue;
    const set = out.get(lineItemId) || new Set<string>();
    set.add(month);
    out.set(lineItemId, set);
  }
  return out;
}

/**
 * Finds (lineItemId, month) pairs that are newly carrying a `monthly` row in
 * `nextPayments` but did not in `prevPayments` — i.e. what this write is
 * actually introducing, not months that already existed on this enrollment
 * before this call touched anything.
 */
function newlyIntroducedMonthlyMonths(
  prevPayments: any[],
  nextPayments: any[],
): Array<{lineItemId: string; month: string}> {
  const prev = monthlyMonthsByLineItem(prevPayments);
  const next = monthlyMonthsByLineItem(nextPayments);
  const out: Array<{lineItemId: string; month: string}> = [];
  for (const [lineItemId, months] of next) {
    const prevMonths = prev.get(lineItemId);
    for (const month of months) {
      if (!prevMonths?.has(month)) out.push({lineItemId, month});
    }
  }
  return out;
}

/**
 * Cross-enrollment check: for each newly-introduced (lineItemId, month) pair,
 * does any OTHER enrollment for the same customer+grant already have a live
 * `monthly` row for that exact month? Reads inside the caller's transaction
 * so the check and the eventual write are atomic.
 */
async function findMonthlyCollisions(
  trx: FirebaseFirestore.Transaction,
  args: {enrollmentId: string; customerId: string; grantId: string; introduced: Array<{lineItemId: string; month: string}>},
): Promise<ScheduleMonthCollisionError['conflicts']> {
  if (!args.introduced.length || !args.customerId || !args.grantId) return [];

  const wanted = new Map<string, Set<string>>();
  for (const {lineItemId, month} of args.introduced) {
    const set = wanted.get(lineItemId) || new Set<string>();
    set.add(month);
    wanted.set(lineItemId, set);
  }

  const siblingsSnap = await trx.get(
    db.collection('customerEnrollments')
      .where('customerId', '==', args.customerId)
      .where('grantId', '==', args.grantId),
  );

  const conflicts: ScheduleMonthCollisionError['conflicts'] = [];
  for (const doc of siblingsSnap.docs) {
    if (doc.id === args.enrollmentId) continue;
    const payments: any[] = Array.isArray(doc.data()?.payments) ? doc.data()!.payments : [];
    for (const p of payments) {
      if (String(p?.type || '') !== 'monthly') continue;
      if (p?.void === true) continue;
      const lineItemId = String(p?.lineItemId || '').trim();
      const months = wanted.get(lineItemId);
      if (!months) continue;
      const month = String(p?.dueDate || p?.date || '').slice(0, 7);
      if (!months.has(month)) continue;
      conflicts.push({
        lineItemId,
        dueMonth: month,
        conflictEnrollmentId: doc.id,
        conflictPaymentId: String(p?.id || ''),
        conflictAmount: Number(p?.amount || 0),
        conflictPaid: p?.paid === true,
      });
    }
  }
  return conflicts;
}

/**
 * Shared transaction core: replace an enrollment's projected payment schedule
 * and adjust the grant budget's projected totals accordingly.
 *
 * `buildNext(oldPayments, enrollment)` produces the FULL desired payments array
 * inside the transaction (replace-mode callers ignore `oldPayments`; append-mode
 * callers — e.g. the forms rent-cert apply — merge new rows into it). The array
 * then flows through the same normalize/id/rent-cert-carry pipeline as always.
 */
export async function runEnrollmentProjectionsUpsert(
  user: any,
  enrollmentId: string,
  buildNext: (oldPayments: any[], enrollment: any) => any[],
) {
  const uid = requireUid(user);

  return db.runTransaction(async (trx) => {
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

      const nextPayments = buildNext(oldPayments, e);

      // Normalize subtype tagging BEFORE id assignment so subtype identity is explicit/stable.
      const normalized = (nextPayments || []).map(ensureMonthlySubtypeTag);
      const withIdsRaw = ensurePaymentIds(normalized, oldPayments, enrollmentId);

      const withIds = carryRentCertState(withIdsRaw, oldPayments).map((p: any) => {
        const dueDate = p?.dueDate || p?.date;
        return {
          ...p,
          ...(dueDate ? {dueDate: String(dueDate).slice(0, 10)} : {}),
          // keep legacy field out of stored canonical schedule
          ...(p?.date !== undefined ? {date: undefined} : {}),
        };
      });

      // Block newly-introduced `monthly` (rent/utility) rows that land on the same
      // month as another enrollment's existing `monthly` row for this customer+grant.
      // Deposit/service/prorated/arrears rows are never checked — those legitimately
      // share a month with rent, including across enrollments (e.g. two separate
      // ESG Homeless Prevention episodes in one grant year). Only genuinely NEW
      // months introduced by this write are checked, so pre-existing collisions in
      // untouched months don't block unrelated edits (those surface via the
      // reconciliation-tool audit scan instead).
      const introducedMonthly = newlyIntroducedMonthlyMonths(oldPayments, withIds);
      if (introducedMonthly.length) {
        const conflicts = await findMonthlyCollisions(trx, {
          enrollmentId,
          customerId: String(e.customerId || ''),
          grantId: String(e.grantId || ''),
          introduced: introducedMonthly,
        });
        if (conflicts.length) throw new ScheduleMonthCollisionError(conflicts);
      }

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

        li.projected = nextProjected;
        li.projectedInWindow = nextProjectedWin;

        const overBy = computeGrantLineItemOverCap(grant, li);
        if (overBy != null) {
          overCaps[id] = overBy;
          li.overCap = overBy;
        }
        else delete li.overCap;
      }

      const baseTotals = computeBudgetTotals(lineItems as any[]);
      const projectedInWindow = sumBudgetField(lineItems, 'projectedInWindow');
      const spentInWindow = sumBudgetField(lineItems, 'spentInWindow');

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
        windowBalance: fromBudgetCents(toBudgetCents(baseTotals.total) - toBudgetCents(spentInWindow)),
        windowProjectedBalance:
          fromBudgetCents(toBudgetCents(baseTotals.total) - toBudgetCents(spentInWindow) - toBudgetCents(projectedInWindow)),
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
}

/** POST /paymentsUpsertProjections */
export async function paymentsUpsertProjectionsHandler(req: Request, res: Response) {
  const parsed = PaymentsUpsertProjectionsBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ok: false, error: parsed.error.message});

  const user: any = (req as any)?.user || {};
  try {
    requireUid(user);
  } catch (e: any) {
    return res.status(401).json({ok: false, error: e?.message || 'auth_required'});
  }

  const {enrollmentId, payments} = parsed.data as TPaymentsUpsertProjectionsBody;

  try {
    const result = await runEnrollmentProjectionsUpsert(user, enrollmentId, () => payments || []);
    return res.status(200).json({ok: true, ...result});
  } catch (err: any) {
    if (err instanceof ScheduleMonthCollisionError) {
      return res.status(409).json({
        ok: false,
        error: 'monthly_schedule_collision',
        conflicts: err.conflicts,
        recommendation:
          'Another enrollment already has a rent/utility payment scheduled for this month on this grant. ' +
          'Use the Adjust Schedule flow on that existing enrollment to change the amount instead of building ' +
          'or adding a new schedule row here — creating a second one will double-count against the grant budget.',
      });
    }
    return res.status(500).json({ok: false, error: err?.message || String(err)});
  }
}

export const paymentsUpsertProjections = secureHandler(
    async (req, res): Promise<void> => {
      await paymentsUpsertProjectionsHandler(req as any, res as any);
    },
    {auth: 'user', methods: ['POST', 'OPTIONS']},
);
