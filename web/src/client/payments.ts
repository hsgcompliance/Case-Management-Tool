//client/payments.ts
import api from './api';
import Enrollments, { type Enrollment } from './enrollments';
import Ledger from './ledger';
import PaymentQueue, { type PaymentQueueItem } from './paymentQueue';
import type {
  ReqOf, RespOf,
  PaymentsUpsertProjectionsReq, PaymentsUpsertProjectionsResp,
  PaymentsGenerateProjectionsReq, PaymentsGenerateProjectionsResp,
  PaymentsBulkCopyScheduleReq, PaymentsBulkCopyScheduleResp,
  PaymentsSpendReq, PaymentsSpendResp,
  PaymentsUpdateComplianceReq, PaymentsUpdateComplianceResp,
  PaymentsUpdateGrantBudgetReq, PaymentsUpdateGrantBudgetResp,
  PaymentsRecalcGrantProjectedReq, PaymentsRecalcGrantProjectedResp,
  PaymentsRecalculateFutureReq, PaymentsRecalculateFutureResp,
  PaymentsAdjustProjectionsReq, PaymentsAdjustProjectionsResp,
  PaymentsAdjustSpendReq, PaymentsAdjustSpendResp,
  TPayment,
  TLedgerEntry,
} from '@types';
// Intentional exception: runtime zod parsers from contracts for request validation.
import {
  PaymentsUpsertProjectionsBody,
  PaymentsGenerateProjectionsBody,
  PaymentsBulkCopyScheduleBody,
  PaymentsSpendBody,
  PaymentsUpdateComplianceBody,
  PaymentsDeleteRowsBody,
  PaymentsUpdateGrantBudgetBody,
  PaymentsRecalcGrantProjectedBody,
  PaymentsRecalculateFutureReq as PaymentsRecalculateFutureReqSchema,
  PaymentsAdjustProjectionsBody,
  PaymentsAdjustSpendBody,
} from '@hdb/contracts/payments';

export type CustomerPaymentRow = {
  enrollmentId: string;
  enrollment: Enrollment;
  payment: TPayment;
};

// ─── Unified payment view row ──────────────────────────────────────────────────
// Single shape covering both paid ledger entries and pending projections,
// suitable for a combined "all payments" UI table.

export type PaymentListFilters = {
  /** YYYY-MM — defaults to current month */
  month?: string;
  grantId?: string;
  customerId?: string;
  /** Max items to return per source (default 200) */
  limit?: number;
};

export type PaymentViewRow = {
  id: string;
  /** "payment" = from ledger (paid/posted); "projection" = from paymentQueue (unpaid) */
  kind: 'payment' | 'projection';

  // Financial
  amount: number;
  amountCents: number;
  /** True when amount is negative (reversal/adjustment) */
  isReversal: boolean;

  // Timing
  /** YYYY-MM-DD */
  dueDate: string | null;
  /** YYYY-MM */
  month: string;

  // Status + source
  /** paid | posted | pending | void | adjustment */
  status: 'paid' | 'posted' | 'pending' | 'void' | 'adjustment';
  /** enrollment | credit-card | invoice | projection | adjustment | manual | migration */
  source: string;

  // Classification
  grantId: string | null;
  lineItemId: string | null;
  enrollmentId: string | null;
  customerId: string | null;

  // Display
  /** Best available human label (paymentLabelAtSpend, descriptor, merchant, vendor) */
  label: string | null;
  merchant: string | null;
  vendor: string | null;
  customerName: string | null;
  grantName: string | null;
  lineItemLabel: string | null;
  note: string | string[] | null;

  // Cross-reference
  ledgerEntryId: string | null;
  queueItemId: string | null;
  paymentId: string | null;

  // Audit
  createdAt: string | null;
  postedAt: string | null;

  // Raw source items for drill-down and action menus
  _ledger?: TLedgerEntry;
  _queue?: PaymentQueueItem;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function ledgerToRow(entry: TLedgerEntry): PaymentViewRow {
  const amountCents = Number((entry as any).amountCents ?? 0);
  const amount = Number((entry as any).amount ?? amountCents / 100);
  const originSource = String((entry as any).origin?.paymentQueueSource ?? "");
  return {
    id: String(entry.id),
    kind: 'payment',
    amount,
    amountCents,
    isReversal: amount < 0,
    dueDate: (entry as any).dueDate ?? null,
    month: ((entry as any).month ?? ((entry as any).dueDate ?? '').slice(0, 7)) || currentMonth(),
    status: amount < 0 ? 'adjustment' : 'paid',
    source: originSource || String((entry as any).source ?? ''),
    grantId: (entry as any).grantId ?? null,
    lineItemId: (entry as any).lineItemId ?? null,
    enrollmentId: (entry as any).enrollmentId ?? null,
    customerId: (entry as any).customerId ?? null,
    label: (entry as any).paymentLabelAtSpend ?? (entry as any).vendor ?? (entry as any).comment ?? null,
    merchant: null,
    vendor: (entry as any).vendor ?? null,
    customerName: (entry as any).customerNameAtSpend ?? null,
    grantName: (entry as any).grantNameAtSpend ?? null,
    lineItemLabel: (entry as any).lineItemLabelAtSpend ?? null,
    note: (entry as any).note ?? null,
    ledgerEntryId: String(entry.id),
    queueItemId: null,
    paymentId: (entry as any).origin?.baseId ?? null,
    createdAt: (entry as any).createdAt ? String((entry as any).createdAt) : null,
    postedAt: null,
    _ledger: entry,
  };
}

function queueToRow(item: PaymentQueueItem): PaymentViewRow {
  const amount = Number(item.amount ?? 0);
  const amountCents = Math.round(amount * 100);
  const status =
    item.queueStatus === 'posted' ? 'posted'
    : item.queueStatus === 'void' ? 'void'
    : 'pending';
  return {
    id: item.id,
    kind: item.queueStatus === 'posted' ? 'payment' : 'projection',
    amount,
    amountCents,
    isReversal: false,
    dueDate: item.dueDate ?? null,
    month: (item.month ?? (item.dueDate ?? '').slice(0, 7)) || currentMonth(),
    status,
    source: item.source ?? 'projection',
    grantId: item.grantId ?? null,
    lineItemId: item.lineItemId ?? null,
    enrollmentId: item.enrollmentId ?? null,
    customerId: item.customerId ?? null,
    label: item.descriptor ?? item.merchant ?? item.purpose ?? item.note ?? null,
    merchant: item.merchant ?? null,
    vendor: null,
    customerName: null,
    grantName: null,
    lineItemLabel: null,
    note: item.note ?? item.notes ?? null,
    ledgerEntryId: item.ledgerEntryId ?? null,
    queueItemId: item.id,
    paymentId: item.paymentId ?? null,
    createdAt: item.createdAt ?? null,
    postedAt: item.postedAt ?? null,
    _queue: item,
  };
}

function sortByDueDate(rows: PaymentViewRow[]): PaymentViewRow[] {
  return rows.slice().sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  });
}

export const Payments = {
  upsertProjections: (body: PaymentsUpsertProjectionsReq, idemKey?: string) =>
    api.callIdem(
      'paymentsUpsertProjections',
      PaymentsUpsertProjectionsBody.parse(body),
      idemKey,
    ) as Promise<PaymentsUpsertProjectionsResp>,

  generateProjections: (body: PaymentsGenerateProjectionsReq) =>
    api.post(
      'paymentsGenerateProjections',
      PaymentsGenerateProjectionsBody.parse(body),
    ) as Promise<PaymentsGenerateProjectionsResp>,

  bulkCopySchedule: (body: PaymentsBulkCopyScheduleReq) =>
    api.post(
      'paymentsBulkCopySchedule',
      PaymentsBulkCopyScheduleBody.parse(body),
    ) as Promise<PaymentsBulkCopyScheduleResp>,

  spend: (body: PaymentsSpendReq, idemKey?: string) =>
    api.callIdem(
      'paymentsSpend',
      PaymentsSpendBody.parse(body),
      idemKey,
    ) as Promise<PaymentsSpendResp>,

  updateCompliance: (body: PaymentsUpdateComplianceReq) =>
    api.post(
      'paymentsUpdateCompliance',
      PaymentsUpdateComplianceBody.parse(body),
    ) as Promise<PaymentsUpdateComplianceResp>,

  deleteRows: (body: ReqOf<"paymentsDeleteRows">) =>
    api.post(
      'paymentsDeleteRows',
      PaymentsDeleteRowsBody.parse(body),
    ) as Promise<RespOf<"paymentsDeleteRows">>,

  updateGrantBudget: (body: PaymentsUpdateGrantBudgetReq) =>
    api.post(
      'paymentsUpdateGrantBudget',
      PaymentsUpdateGrantBudgetBody.parse(body),
    ) as Promise<PaymentsUpdateGrantBudgetResp>,

  recalcGrantProjected: (body: PaymentsRecalcGrantProjectedReq) =>
    api.post(
      'paymentsRecalcGrantProjected',
      PaymentsRecalcGrantProjectedBody.parse(body),
    ) as Promise<PaymentsRecalcGrantProjectedResp>,

  recalcFuture: (body: PaymentsRecalculateFutureReq) =>
    api.post(
      'paymentsRecalculateFuture',
      PaymentsRecalculateFutureReqSchema.parse(body),
    ) as Promise<PaymentsRecalculateFutureResp>,

  adjustProjections: (body: PaymentsAdjustProjectionsReq, idemKey?: string) =>
    api.callIdem(
      'paymentsAdjustProjections',
      PaymentsAdjustProjectionsBody.parse(body),
      idemKey,
    ) as Promise<PaymentsAdjustProjectionsResp>,

  adjustSpend: (body: PaymentsAdjustSpendReq, idemKey?: string) =>
    api.callIdem(
      'paymentsAdjustSpend',
      PaymentsAdjustSpendBody.parse(body),
      idemKey,
    ) as Promise<PaymentsAdjustSpendResp>,

  // ─── Payment / projection list queries ──────────────────────────────────────

  /**
   * List paid ledger entries (actual spend).
   * Defaults: current month, all grants, all customers.
   */
  listLedger: async (filters: PaymentListFilters = {}): Promise<PaymentViewRow[]> => {
    const month = filters.month ?? currentMonth();
    const res = await Ledger.list({
      month,
      ...(filters.grantId ? { grantId: filters.grantId } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      limit: filters.limit ?? 200,
    });
    const entries: TLedgerEntry[] = Array.isArray(res?.entries) ? res.entries as TLedgerEntry[] : [];
    return entries.map(ledgerToRow);
  },

  /**
   * List pending projection queue items (enrollment unpaid schedule).
   * Defaults: current month, all grants, all customers.
   */
  listProjections: async (filters: PaymentListFilters = {}): Promise<PaymentViewRow[]> => {
    const month = filters.month ?? currentMonth();
    const res = await PaymentQueue.list({
      month,
      source: 'projection',
      queueStatus: 'pending',
      ...(filters.grantId ? { grantId: filters.grantId } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      limit: filters.limit ?? 200,
    });
    const items: PaymentQueueItem[] = Array.isArray(res?.items) ? res.items : [];
    return items.map(queueToRow);
  },

  /**
   * List both paid entries and pending projections in a single sorted array.
   * Sorted by dueDate ascending; null dates go last.
   * Defaults: current month, all grants, all customers.
   */
  listAll: async (filters: PaymentListFilters = {}): Promise<{
    rows: PaymentViewRow[];
    payments: PaymentViewRow[];
    projections: PaymentViewRow[];
    totals: { paidAmount: number; projectedAmount: number; netAmount: number; count: number };
  }> => {
    const [payments, projections] = await Promise.all([
      Payments.listLedger(filters),
      Payments.listProjections(filters),
    ]);
    const rows = sortByDueDate([...payments, ...projections]);
    const paidAmount = payments.filter(r => !r.isReversal).reduce((s, r) => s + r.amount, 0);
    const reversalAmount = payments.filter(r => r.isReversal).reduce((s, r) => s + r.amount, 0);
    const projectedAmount = projections.reduce((s, r) => s + r.amount, 0);
    return {
      rows,
      payments,
      projections,
      totals: {
        paidAmount,
        projectedAmount,
        netAmount: paidAmount + reversalAmount + projectedAmount,
        count: rows.length,
      },
    };
  },

  // ─── Legacy enrollment-based list ───────────────────────────────────────────
  // Derived client surface: payments currently live on enrollment docs.
  listByCustomer: async (customerId: string, limit = 200): Promise<CustomerPaymentRow[]> => {
    const enrollments = await Enrollments.list({ customerId, limit });
    const rows: CustomerPaymentRow[] = [];

    for (const enrollment of enrollments) {
      const payments = Array.isArray(enrollment?.payments) ? enrollment.payments : [];
      for (const payment of payments) {
        rows.push({
          enrollmentId: String(enrollment.id || ''),
          enrollment,
          payment: payment as TPayment,
        });
      }
    }

    return rows;
  },
};

export default Payments;
