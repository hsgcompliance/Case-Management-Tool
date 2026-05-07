// web/src/hooks/usePayments.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Payments from "@client/payments";
import type { CustomerPaymentRow, PaymentViewRow, PaymentListFilters } from "@client/payments";
import Enrollments from "@client/enrollments";
import type { Enrollment } from "@client/enrollments";
import Tasks from "@client/tasks";
import { qk } from "./queryKeys";
import { customerEnrollmentsQueryKey } from "./useEnrollments";
import { RQ_DEFAULTS } from "./base";
import { useInvalidateMutation } from "./optimistic";
import { toISODate } from "@lib/date";

import type {
  PaymentsUpsertProjectionsReq,
  PaymentsUpsertProjectionsResp,
  PaymentsGenerateProjectionsReq,
  PaymentsGenerateProjectionsResp,
  PaymentsBulkCopyScheduleReq,
  PaymentsBulkCopyScheduleResp,
  PaymentsSpendReq,
  PaymentsSpendResp,
  PaymentsUpdateComplianceReq,
  PaymentsUpdateComplianceResp,
  ReqOf,
  RespOf,
  PaymentsRecalculateFutureReq,
  PaymentsRecalculateFutureResp,
  PaymentsAdjustProjectionsReq,
  PaymentsAdjustProjectionsResp,
  PaymentsAdjustSpendReq,
  PaymentsAdjustSpendResp,
  PaymentsRecalcGrantProjectedReq,
  PaymentProjection,
  TPayment,
  TPaymentProjectionInput,
  ReqOf as StrictReqOf,
} from "@types";

type EnrollmentContext = {
  enrollmentId?: string;
  customerId?: string | null;
  grantId?: string | null;
};

type PaymentPatch = (payment: TPayment) => TPayment;

export type PaymentsProjectionsAdjustInput = {
  enrollmentId: string;
  spendAdjustment?: {
    paymentId: string;
    newAmount?: number;
    lineItemId?: string;
    dueDate?: string;
    note?: string | string[];
    vendor?: string | null;
    comment?: string | null;
    reason?: string;
  };
  projectionAdjustment?: {
    edits?: Array<{
      paymentId: string;
      amount?: number;
      dueDate?: string;
      lineItemId?: string;
      type?: TPayment["type"];
      note?: string | string[];
      vendor?: string;
      comment?: string;
    }>;
    additions?: Array<{
      amount: number;
      dueDate: string;
      lineItemId: string;
      type: TPayment["type"];
      note?: string | string[];
      vendor?: string;
      comment?: string;
    }>;
    deleteIds?: string[];
    replaceUnpaid?: boolean;
  };
  options?: {
    updateGrantBudgets?: boolean;
    recalcGrantProjected?: boolean;
    recalcFuture?: boolean;
    reverseSpend?: boolean;
    activeOnly?: boolean;
  };
  recalcFutureInput?: {
    newMonthlyAmount: number;
    lineItemId?: string;
    effectiveFrom?: string;
    dryRun?: boolean;
  };
  deleteRows?: {
    paymentIds: string[];
    preservePaid?: boolean;
    updateBudgets?: boolean;
    removeSpends?: boolean;
    reverseLedger?: boolean;
  };
};

export type PaymentScheduleBuildInput = {
  enrollmentId: string;
  lineItemId?: string;
  startDate?: string;
  months?: number;
  monthlyAmount?: number;
  replaceUnpaid?: boolean;
  includeDeposit?: boolean;
  depositAmount?: number;
  depositDate?: string;
  monthlyPlans?: Array<{
    kind: "rent" | "utility";
    startDate: string;
    months: number;
    monthlyAmount: number;
    lineItemId: string;
    vendor?: string;
    comment?: string;
  }>;
  additions?: Array<{
    amount: number;
    dueDate: string;
    lineItemId: string;
    type: TPayment["type"];
    note?: string | string[];
    vendor?: string;
    comment?: string;
  }>;
  options?: {
    updateGrantBudgets?: boolean;
    recalcGrantProjected?: boolean;
    activeOnly?: boolean;
  };
  taskDefs?: unknown[];
  replaceTaskDefPrefixes?: string[];
};

function paymentBuilderMetaFromInput(input: PaymentScheduleBuildInput): Record<string, unknown> {
  const monthlyPlans = Array.isArray(input.monthlyPlans) ? input.monthlyPlans : [];
  const additions = Array.isArray(input.additions) ? input.additions : [];
  const rentPlans = monthlyPlans
    .filter((p) => p?.kind === "rent")
    .map((p) => ({
      firstDue: toISO10(p.startDate),
      months: String(Math.max(0, Math.floor(Number(p.months || 0)))),
      monthly: String(Number(p.monthlyAmount || 0)),
      lineItemId: String(p.lineItemId || ""),
      ...(p.vendor ? { vendor: String(p.vendor) } : {}),
      ...(p.comment ? { comment: String(p.comment) } : {}),
    }));
  const utilPlans = monthlyPlans
    .filter((p) => p?.kind === "utility")
    .map((p) => ({
      firstDue: toISO10(p.startDate),
      months: String(Math.max(0, Math.floor(Number(p.months || 0)))),
      monthly: String(Number(p.monthlyAmount || 0)),
      lineItemId: String(p.lineItemId || ""),
      ...(p.vendor ? { vendor: String(p.vendor) } : {}),
      ...(p.comment ? { comment: String(p.comment) } : {}),
    }));

  const findSingle = (type: "deposit" | "prorated") =>
    additions.find((a) => String(a?.type || "").toLowerCase() === type);
  const deposit = findSingle("deposit");
  const prorated = findSingle("prorated");
  const services = additions
    .filter((a) => String(a?.type || "").toLowerCase() === "service")
    .map((a, idx) => ({
      id: `svc_${idx}_${Date.now().toString(36)}`,
      note: Array.isArray(a.note) ? String(a.note[0] || "") : String(a.note || ""),
      date: toISO10(a.dueDate),
      amount: String(Number(a.amount || 0)),
      lineItemId: String(a.lineItemId || ""),
      ...(a.vendor ? { vendor: String(a.vendor) } : {}),
      ...(a.comment ? { comment: String(a.comment) } : {}),
    }));

  return {
    version: 1,
    rentPlans,
    utilPlans,
    ...(deposit
      ? {
          deposit: {
            enabled: true,
            date: toISO10(deposit.dueDate),
            amount: String(Number(deposit.amount || 0)),
            lineItemId: String(deposit.lineItemId || ""),
            ...(deposit.vendor ? { vendor: String(deposit.vendor) } : {}),
            ...(deposit.comment ? { comment: String(deposit.comment) } : {}),
          },
        }
      : {}),
    ...(prorated
      ? {
          prorated: {
            enabled: true,
            date: toISO10(prorated.dueDate),
            amount: String(Number(prorated.amount || 0)),
            lineItemId: String(prorated.lineItemId || ""),
            ...(prorated.vendor ? { vendor: String(prorated.vendor) } : {}),
            ...(prorated.comment ? { comment: String(prorated.comment) } : {}),
          },
        }
      : {}),
    services,
  };
}

// ---------- queries ----------

/**
 * Read payments for an enrollment.
 * Current truth is enrollment.payments, so this hook centralizes that "payments live on enrollment" quirk.
 */
export function useEnrollmentPayments(enrollmentId?: string | null, opts?: { enabled?: boolean; staleTime?: number }) {
  const enabled = (opts?.enabled ?? true) && !!enrollmentId;

  return useQuery({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.payments.byEnrollment(String(enrollmentId || "")),
    queryFn: async () => {
      const enr = await Enrollments.getById(String(enrollmentId));
      return Array.isArray(enr?.payments) ? enr.payments : [];
    },
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
  });
}

export function useCustomerPayments(customerId?: string | null, opts?: { enabled?: boolean; limit?: number; staleTime?: number }) {
  const enabled = (opts?.enabled ?? true) && !!customerId;
  const limit = opts?.limit ?? 200;

  return useQuery<CustomerPaymentRow[]>({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.payments.byCustomer(String(customerId || ""), limit),
    queryFn: () => Payments.listByCustomer(String(customerId), limit),
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
  });
}

// ---------- helpers ----------

function enrollmentIdOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const maybe = (value as { enrollmentId?: unknown }).enrollmentId;
  return typeof maybe === "string" && maybe.trim() ? maybe : null;
}

function hasPaymentsArray(value: unknown): value is { ok?: boolean; payments: PaymentProjection[] } {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as { payments?: unknown }).payments);
}

function toISO10(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date || typeof value === "number") return toISODate(value);
  const s = String(value).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const normalized = toISODate(s);
  return normalized || s.slice(0, 10);
}

function withLineItemId(
  payment: TPayment,
  lineItemId: string,
  depositDate?: string,
): TPaymentProjectionInput {
  const type = String(payment?.type || "").toLowerCase();
  const fallbackDue = toISO10(
    payment?.dueDate || (payment as Record<string, unknown>)?.date || toISODate(new Date()),
  );
  const dueDate = type === "deposit" && depositDate ? toISO10(depositDate) : fallbackDue;

  return {
    ...payment,
    lineItemId,
    dueDate,
    paid: false,
    paidAt: null,
    paidFromGrant: false,
    note:
      type === "monthly"
        ? Array.isArray(payment.note) && payment.note.length
          ? payment.note
          : ["sub:rent"]
        : payment.note,
  } as TPaymentProjectionInput;
}

function withProjectionMeta(
  payment: TPayment,
  lineItemId: string,
  opts?: {
    dueDate?: string;
    note?: string | string[];
    vendor?: string;
    comment?: string;
  },
): TPaymentProjectionInput {
  const base = withLineItemId(payment, lineItemId, opts?.dueDate);
  return {
    ...base,
    ...(opts?.dueDate ? { dueDate: toISO10(opts.dueDate) } : {}),
    ...(opts?.note !== undefined ? { note: opts.note } : {}),
    ...(opts?.vendor !== undefined ? { vendor: opts.vendor } : {}),
    ...(opts?.comment !== undefined ? { comment: opts.comment } : {}),
  };
}

function toProjectionInput(payment: TPayment): TPaymentProjectionInput | null {
  const lineItemId = String(payment?.lineItemId || "").trim();
  const dueDate = String(payment?.dueDate || (payment as Record<string, unknown>)?.date || "").trim();
  const amount = Number(payment?.amount || 0);

  if (!lineItemId || !dueDate || amount <= 0) return null;

  return {
    ...payment,
    lineItemId,
    dueDate,
    amount,
  } as TPaymentProjectionInput;
}

function requireProjectionInput(payment: TPayment, reason: string): TPaymentProjectionInput {
  const out = toProjectionInput(payment);
  if (!out) throw new Error(reason);
  return out;
}

function spendTsNum(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object") {
    const v = value as {
      toMillis?: () => number;
      toDate?: () => Date;
      _seconds?: number;
      seconds?: number;
    };
    if (typeof v.toMillis === "function") return Number(v.toMillis()) || 0;
    if (typeof v.toDate === "function") return v.toDate().getTime();
    if (Number.isFinite(Number(v._seconds))) return Number(v._seconds) * 1000;
    if (Number.isFinite(Number(v.seconds))) return Number(v.seconds) * 1000;
  }
  return 0;
}

function patchPaymentArray(
  payments: unknown,
  paymentId: string,
  patch: PaymentPatch,
): { next: unknown; changed: boolean } {
  if (!Array.isArray(payments) || !paymentId) return { next: payments, changed: false };
  let changed = false;
  const next = payments.map((p) => {
    const id = String((p as { id?: unknown } | null | undefined)?.id || "").trim();
    if (id !== paymentId) return p;
    changed = true;
    return patch((p || {}) as TPayment);
  });
  return { next, changed };
}

function patchEnrollmentLikePayments(
  value: unknown,
  enrollmentId: string,
  paymentId: string,
  patch: PaymentPatch,
): unknown {
  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const objId = String(obj.id || "").trim();
  if (objId && objId === enrollmentId) {
    const res = patchPaymentArray(obj.payments, paymentId, patch);
    if (!res.changed) return value;
    return { ...obj, payments: res.next };
  }

  if (Array.isArray(obj.items)) {
    let changed = false;
    const items = obj.items.map((item) => {
      const next = patchEnrollmentLikePayments(item, enrollmentId, paymentId, patch);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? { ...obj, items } : value;
  }

  return value;
}

function patchCustomerPaymentRows(
  rows: unknown,
  enrollmentId: string,
  paymentId: string,
  patch: PaymentPatch,
): unknown {
  if (!Array.isArray(rows)) return rows;
  let changed = false;
  const next = rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const r = row as Record<string, unknown>;
    const rowEnrollmentId = String(r.enrollmentId || "").trim();
    const payment = (r.payment || null) as TPayment | null;
    const rowPaymentId = String((payment as { id?: unknown } | null)?.id || "").trim();
    if (rowEnrollmentId !== enrollmentId || rowPaymentId !== paymentId) return row;

    changed = true;
    const nextPayment = patch((payment || {}) as TPayment);
    let nextEnrollment = r.enrollment;
    if (r.enrollment && typeof r.enrollment === "object") {
      nextEnrollment = patchEnrollmentLikePayments(r.enrollment, enrollmentId, paymentId, patch);
    }
    return { ...r, payment: nextPayment, enrollment: nextEnrollment };
  });
  return changed ? next : rows;
}

function paymentMutationPatches(
  qc: ReturnType<typeof useQueryClient>,
  args: {
    enrollmentId: string;
    paymentId: string;
    patch: PaymentPatch;
  },
) {
  const enrollmentId = String(args.enrollmentId || "").trim();
  const paymentId = String(args.paymentId || "").trim();
  if (!enrollmentId || !paymentId) return [];

  const patches: Array<{
    key: unknown[] | ReadonlyArray<unknown> | ReadonlyArray<unknown>[];
    update: (prev: unknown) => unknown;
  }> = [
    {
      key: qk.enrollments.detail(enrollmentId),
      update: (prev: unknown) => patchEnrollmentLikePayments(prev, enrollmentId, paymentId, args.patch),
    },
    {
      key: qk.payments.byEnrollment(enrollmentId),
      update: (prev: unknown) => patchPaymentArray(prev, paymentId, args.patch).next,
    },
  ];

  const enrollment = qc.getQueryData<Enrollment | null>(qk.enrollments.detail(enrollmentId));
  const customerId = String(enrollment?.customerId || "").trim();
  if (customerId) {
    const customerPaymentKeys = qc
      .getQueriesData({ queryKey: qk.payments.byCustomerPrefix(customerId) })
      .map(([key]) => key as unknown[])
      .filter((key) => Array.isArray(key) && key[0] === "payments" && key[1] === "byCustomer");

    if (customerPaymentKeys.length) {
      patches.push({
        key: customerPaymentKeys,
        update: (prev: unknown) => patchCustomerPaymentRows(prev, enrollmentId, paymentId, args.patch),
      });
    }

    const enrollmentListKeys = qc
      .getQueriesData({ queryKey: qk.enrollments.byCustomer(customerId) })
      .map(([key]) => key as unknown[])
      .filter((key) => Array.isArray(key) && key[0] === "enrollments" && key[1] === "byCustomer");

    if (enrollmentListKeys.length) {
      patches.push({
        key: enrollmentListKeys,
        update: (prev: unknown) => patchEnrollmentLikePayments(prev, enrollmentId, paymentId, args.patch),
      });
    }
  }

  return patches;
}

function buildProjectionPayload(
  existing: TPayment[],
  generated: TPaymentProjectionInput[],
  replaceUnpaid: boolean,
): TPaymentProjectionInput[] {
  const paidRows = existing
    .filter((p) => Boolean(p?.paid))
    .map(toProjectionInput)
    .filter((p): p is TPaymentProjectionInput => p !== null);
  if (replaceUnpaid) return [...paidRows, ...generated];
  const unpaidRows = existing
    .filter((p) => !Boolean(p?.paid))
    .map(toProjectionInput)
    .filter((p): p is TPaymentProjectionInput => p !== null);
  return [...paidRows, ...unpaidRows, ...generated];
}

async function resolveEnrollmentContext(
  qc: ReturnType<typeof useQueryClient>,
  enrollmentId?: string | null,
): Promise<EnrollmentContext> {
  if (!enrollmentId) return {};
  const id = String(enrollmentId);

  const cached = qc.getQueryData<Enrollment | null>(qk.enrollments.detail(id));
  const enrollment = cached ?? (await Enrollments.getById(id).catch(() => null));

  return {
    enrollmentId: id,
    customerId: enrollment?.customerId ? String(enrollment.customerId) : null,
    grantId: enrollment?.grantId ? String(enrollment.grantId) : null,
  };
}

async function invalidateEnrollmentContext(
  qc: ReturnType<typeof useQueryClient>,
  context: EnrollmentContext,
): Promise<void> {
  const work: Array<Promise<unknown>> = [
    qc.invalidateQueries({ queryKey: qk.enrollments.root }),
    qc.invalidateQueries({ queryKey: qk.payments.root }),
    qc.invalidateQueries({ queryKey: qk.inbox.root }),
    qc.invalidateQueries({ queryKey: qk.users.me() }),
  ];

  if (context.enrollmentId) {
    const enrollmentId = String(context.enrollmentId);
    work.push(qc.invalidateQueries({ queryKey: qk.enrollments.detail(enrollmentId) }));
    work.push(qc.invalidateQueries({ queryKey: qk.payments.byEnrollment(enrollmentId) }));
  }

  if (context.customerId) {
    const customerId = String(context.customerId);
    work.push(qc.invalidateQueries({ queryKey: qk.customers.detail(customerId) }));
    work.push(qc.invalidateQueries({ queryKey: customerEnrollmentsQueryKey(customerId) }));
    work.push(qc.invalidateQueries({ queryKey: qk.payments.byCustomerPrefix(customerId) }));
  }

  if (context.grantId) {
    const grantId = String(context.grantId);
    work.push(qc.invalidateQueries({ queryKey: qk.grants.root }));
    work.push(qc.invalidateQueries({ queryKey: qk.grants.detail(grantId) }));
  }

  await Promise.all(work);
}

async function invalidateFromEnrollment(
  qc: ReturnType<typeof useQueryClient>,
  enrollmentId?: string | null,
): Promise<void> {
  const context = await resolveEnrollmentContext(qc, enrollmentId);
  await invalidateEnrollmentContext(qc, context);
}

// ---------- mutations ----------

export function usePaymentsUpsertProjections() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.payments.root, qk.inbox.root, qk.users.me()],
    mutationFn: (args: { body: PaymentsUpsertProjectionsReq; idemKey?: string }) =>
      Payments.upsertProjections(args.body, args.idemKey) as Promise<PaymentsUpsertProjectionsResp>,
    onSuccess: async (_res, vars) => {
      await invalidateFromEnrollment(qc, enrollmentIdOf(vars.body));
    },
  });
}

export function usePaymentsGenerateProjections() {
  return useMutation({
    mutationFn: (body: PaymentsGenerateProjectionsReq) =>
      Payments.generateProjections(body) as Promise<PaymentsGenerateProjectionsResp>,
  });
}

export function usePaymentsBulkCopySchedule() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.payments.root, qk.inbox.root, qk.users.me()],
    mutationFn: (body: PaymentsBulkCopyScheduleReq) =>
      Payments.bulkCopySchedule(body) as Promise<PaymentsBulkCopyScheduleResp>,
    onSuccess: async (_res, body) => {
      const sourceId = String(body.sourceEnrollmentId || "");
      const sourceContext = await resolveEnrollmentContext(qc, sourceId);
      const targetContexts = await Promise.all(
        (body.targetEnrollmentIds || []).map((id) => resolveEnrollmentContext(qc, String(id || ""))),
      );
      await invalidateEnrollmentContext(qc, sourceContext);
      await Promise.all(targetContexts.map((ctx) => invalidateEnrollmentContext(qc, ctx)));
    },
  });
}

export function usePaymentsSpend() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.paymentQueue.root, qk.ledger.root],
    optimisticPatches: (args, queryClient) => {
      const body = args?.body;
      const enrollmentId = String(body?.enrollmentId || "").trim();
      const paymentId = String(body?.paymentId || "").trim();
      if (!enrollmentId || !paymentId) return [];
      const reverse = body?.reverse === true;
      const nowIso = new Date().toISOString();

      return paymentMutationPatches(queryClient, {
        enrollmentId,
        paymentId,
        patch: (payment) => ({
          ...payment,
          paid: !reverse,
          paidAt:
            reverse
              ? null
              : typeof (payment as Record<string, unknown>)?.paidAt === "string"
              ? String((payment as Record<string, unknown>).paidAt || "")
              : nowIso,
          ...(reverse ? {} : { paidFromGrant: Boolean((payment as Record<string, unknown>)?.paidFromGrant) }),
        }),
      });
    },
    mutationFn: (args: { body: PaymentsSpendReq; idemKey?: string }) =>
      Payments.spend(args.body, args.idemKey) as Promise<PaymentsSpendResp>,
    onSuccess: async (_res, vars) => {
      // Invalidate grant budget — spend.ts updates lineItems.spent transactionally
      // but the React grant cache won't refresh otherwise.
      await invalidateFromEnrollment(qc, enrollmentIdOf(vars.body));
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        qc.invalidateQueries({ queryKey: qk.ledger.root }),
        qc.invalidateQueries({ queryKey: qk.inbox.root }),
      ]);
    },
    onError: (_err, vars) => {
      // Rollback already restored snapshots; fetch authoritative state only on failure.
      void invalidateFromEnrollment(qc, enrollmentIdOf(vars.body));
    },
  });
}

export function usePaymentsUpdateCompliance() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [],
    optimisticPatches: (body, queryClient) => {
      const enrollmentId = String(body?.enrollmentId || "").trim();
      const paymentId = String(body?.paymentId || "").trim();
      if (!enrollmentId || !paymentId) return [];
      const patch = (body?.patch || {}) as Record<string, unknown>;

      return paymentMutationPatches(queryClient, {
        enrollmentId,
        paymentId,
        patch: (payment) => {
          const currentCompliance =
            ((payment as Record<string, unknown>)?.compliance as Record<string, unknown> | null | undefined) || {};
          return {
            ...payment,
            compliance: {
              ...currentCompliance,
              ...patch,
            },
          } as TPayment;
        },
      });
    },
    mutationFn: (body: PaymentsUpdateComplianceReq) =>
      Payments.updateCompliance(body) as Promise<PaymentsUpdateComplianceResp>,
    onError: (_err, body) => {
      // Rollback already restored snapshots; fetch authoritative state only on failure.
      void invalidateFromEnrollment(qc, enrollmentIdOf(body));
    },
  });
}

export function usePaymentsDeleteRows() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [
      qk.enrollments.root,
      qk.payments.root,
      qk.inbox.root,
      qk.users.me(),
      qk.grants.root,
      qk.paymentQueue.root,
      qk.ledger.root,
    ],
    mutationFn: (body: ReqOf<"paymentsDeleteRows">) =>
      Payments.deleteRows(body) as Promise<RespOf<"paymentsDeleteRows">>,
    onSuccess: async (_res, body) => {
      await invalidateFromEnrollment(qc, body.enrollmentId);
      const enrollment = qc.getQueryData<Enrollment | null>(qk.enrollments.detail(String(body.enrollmentId || "")));
      const grantId = String(enrollment?.grantId || "");
      if (grantId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: qk.grants.root }),
          qc.invalidateQueries({ queryKey: qk.grants.detail(grantId) }),
        ]);
      }
    },
  });
}

export function usePaymentsRecalcFuture() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.payments.root, qk.inbox.root, qk.users.me(), qk.grants.root],
    mutationFn: (body: PaymentsRecalculateFutureReq) =>
      Payments.recalcFuture(body) as Promise<PaymentsRecalculateFutureResp>,
    onSuccess: async (_res, body) => {
      if ("enrollmentId" in body) {
        await invalidateFromEnrollment(qc, body.enrollmentId);
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.grants.root }),
        qc.invalidateQueries({ queryKey: qk.grants.detail(String(body.grantId || "")) }),
        qc.invalidateQueries({ queryKey: qk.enrollments.root }),
        qc.invalidateQueries({ queryKey: qk.payments.root }),
      ]);
    },
  });
}

export function usePaymentsAdjustProjections() {
  const qc = useQueryClient();

  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.payments.root, qk.inbox.root, qk.users.me()],
    mutationFn: (args: { body: PaymentsAdjustProjectionsReq; idemKey?: string }) =>
      Payments.adjustProjections(args.body, args.idemKey) as Promise<PaymentsAdjustProjectionsResp>,
    onSuccess: async (res, vars) => {
      const enrollmentId = String(vars.body.enrollmentId);

      // If server returns payments, eagerly patch caches (fast tab UX).
      if (hasPaymentsArray(res)) {
        const payments = res.payments;

        qc.setQueryData(qk.payments.byEnrollment(enrollmentId), payments);

        qc.setQueryData(qk.enrollments.detail(enrollmentId), (prev: Enrollment | null | undefined) =>
          prev ? { ...prev, payments } : prev,
        );
      }

      await invalidateFromEnrollment(qc, enrollmentId);
    },
  });
}

export function usePaymentsAdjustSpend() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.payments.root, qk.inbox.root, qk.users.me()],
    mutationFn: (args: { body: PaymentsAdjustSpendReq; idemKey?: string }) =>
      Payments.adjustSpend(args.body, args.idemKey) as Promise<PaymentsAdjustSpendResp>,
    onSuccess: async (_res, vars) => {
      await invalidateFromEnrollment(qc, vars.body.enrollmentId);
    },
  });
}

export function usePaymentsProjectionsAdjust() {
  const qc = useQueryClient();

  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.payments.root, qk.inbox.root, qk.users.me(), qk.grants.root],
    mutationFn: async (input: PaymentsProjectionsAdjustInput) => {
      const enrollmentId = String(input.enrollmentId || "").trim();
      if (!enrollmentId) throw new Error("enrollmentId is required");

      const enrollment = await Enrollments.getById(enrollmentId);
      if (!enrollment) throw new Error("Enrollment not found");

      const grantId = String(enrollment.grantId || "").trim();
      if (!grantId) throw new Error("Enrollment missing grantId");

      const options = {
        updateGrantBudgets: input.options?.updateGrantBudgets ?? true,
        recalcGrantProjected: input.options?.recalcGrantProjected ?? true,
        recalcFuture: input.options?.recalcFuture ?? false,
        reverseSpend: input.options?.reverseSpend ?? false,
        activeOnly: input.options?.activeOnly ?? true,
      };

      // 0) Explicit deletes (projections and/or paid payments)
      if (input.deleteRows?.paymentIds?.length) {
        const paymentIds = Array.from(
          new Set((input.deleteRows.paymentIds || []).map((x) => String(x || "").trim()).filter(Boolean)),
        );
        if (paymentIds.length) {
          await Payments.deleteRows({
            enrollmentId,
            paymentIds,
            preservePaid: input.deleteRows.preservePaid ?? false,
            updateBudgets: input.deleteRows.updateBudgets ?? (input.options?.updateGrantBudgets ?? true),
            removeSpends: input.deleteRows.removeSpends ?? true,
            reverseLedger: input.deleteRows.reverseLedger ?? true,
          } as StrictReqOf<"paymentsDeleteRows">);
          // refresh enrollment snapshot used below after delete
          const refreshed = await Enrollments.getById(enrollmentId);
          if (refreshed) {
            enrollment.payments = refreshed.payments;
            enrollment.spends = refreshed.spends;
          }
        }
      }

      // 1) Spend edit/reversal
      if (input.spendAdjustment && String(input.spendAdjustment.paymentId || "").trim()) {
        const paymentId = String(input.spendAdjustment.paymentId || "").trim();
        if (options.reverseSpend) {
          await Payments.spend({
            enrollmentId,
            paymentId,
            reverse: true,
          });
        } else {
          const patch: PaymentsAdjustSpendReq["patch"] = {
            ...(input.spendAdjustment.newAmount != null ? { amount: input.spendAdjustment.newAmount } : {}),
            ...(input.spendAdjustment.lineItemId ? { lineItemId: input.spendAdjustment.lineItemId } : {}),
            ...(input.spendAdjustment.dueDate ? { dueDate: input.spendAdjustment.dueDate } : {}),
            ...(input.spendAdjustment.note != null ? { note: input.spendAdjustment.note } : {}),
            ...(input.spendAdjustment.vendor !== undefined ? { vendor: input.spendAdjustment.vendor } : {}),
            ...(input.spendAdjustment.comment !== undefined ? { comment: input.spendAdjustment.comment } : {}),
          };

          await Payments.adjustSpend({
            enrollmentId,
            paymentId,
            patch,
            ...(input.spendAdjustment.reason ? { reason: input.spendAdjustment.reason } : {}),
          });
        }
      }

      // 2) Projection edits/additions
      const projectionEdits = input.projectionAdjustment?.edits ?? [];
      const projectionAdds = input.projectionAdjustment?.additions ?? [];
      const projectionDeleteIds = new Set(
        (input.projectionAdjustment?.deleteIds || []).map((id) => String(id || "").trim()).filter(Boolean),
      );

      if (projectionEdits.length > 0 || projectionAdds.length > 0 || projectionDeleteIds.size > 0) {
        const existing = Array.isArray(enrollment.payments) ? (enrollment.payments as TPayment[]) : [];
        const byId = new Map(
          existing
            .filter((p) => String(p?.id || "").trim())
            .map((p) => [String(p.id), p] as const),
        );

        const editedRows = projectionEdits.map((edit) => {
          const id = String(edit.paymentId || "").trim();
          const base = byId.get(id);
          if (!base) throw new Error(`Payment not found for edit: ${id || "unknown"}`);

          return requireProjectionInput(
            {
              ...base,
              ...(edit.amount != null ? { amount: edit.amount } : {}),
              ...(edit.dueDate ? { dueDate: edit.dueDate } : {}),
              ...(edit.lineItemId ? { lineItemId: edit.lineItemId } : {}),
              ...(edit.type ? { type: edit.type } : {}),
              ...(edit.note != null ? { note: edit.note } : {}),
              ...(edit.vendor != null ? { vendor: edit.vendor } : {}),
              ...(edit.comment != null ? { comment: edit.comment } : {}),
            },
            `Edited projection is missing required fields for ${id}`,
          );
        });

        const addedRows = projectionAdds.map((add, idx) =>
          requireProjectionInput(
            {
              type: add.type,
              amount: add.amount,
              dueDate: add.dueDate,
              lineItemId: add.lineItemId,
              note: add.note ?? null,
              vendor: add.vendor ?? null,
              comment: add.comment ?? null,
              paid: false,
              paidAt: null,
              paidFromGrant: false,
              id: `tmp_add_${idx}_${Date.now()}`,
            },
            "Added projection is missing required fields",
          ),
        );

        const replaceUnpaid = input.projectionAdjustment?.replaceUnpaid ?? true;
        const editedIds = new Set(editedRows.map((e) => String(e.id || "")));
        const existingProjectedKept = existing
          .filter((p) => !projectionDeleteIds.has(String(p?.id || "")))
          .filter((p) => {
            if (Boolean(p?.paid)) return true;
            if (editedIds.has(String(p?.id || ""))) return false;
            return replaceUnpaid;
          })
          .map((p) => requireProjectionInput(p, "Existing payment missing required projection fields"));

        const nextPayments = [
          ...existingProjectedKept,
          ...editedRows,
          ...addedRows,
        ];

        await Payments.upsertProjections({
          enrollmentId,
          payments: nextPayments,
        });
      }

      // 3) Optional future recalc
      if (options.recalcFuture) {
        const recalc = input.recalcFutureInput;
        if (!recalc || !Number.isFinite(Number(recalc.newMonthlyAmount)) || Number(recalc.newMonthlyAmount) <= 0) {
          throw new Error("recalcFutureInput.newMonthlyAmount is required when recalc future is enabled");
        }
        await Payments.recalcFuture({
          enrollmentId,
          newMonthlyAmount: Number(recalc.newMonthlyAmount),
          ...(recalc.lineItemId ? { lineItemId: recalc.lineItemId } : {}),
          ...(recalc.effectiveFrom ? { effectiveFrom: recalc.effectiveFrom } : {}),
          ...(recalc.dryRun !== undefined ? { dryRun: recalc.dryRun } : {}),
        });
      }

      // 4) Grant-level recompute options
      if (options.updateGrantBudgets) {
        await Payments.updateGrantBudget({
          grantId,
          activeOnly: options.activeOnly,
          source: 1,
        });
      }

      if (options.recalcGrantProjected) {
        await Payments.recalcGrantProjected({
          grantId,
          activeOnly: options.activeOnly,
          source: 1,
        });
      }

      return {
        enrollmentId,
        customerId: enrollment.customerId ? String(enrollment.customerId) : null,
        grantId,
      };
    },
    onSuccess: async (context) => {
      await Promise.all([
        invalidateEnrollmentContext(qc, context),
        qc.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        qc.invalidateQueries({ queryKey: qk.ledger.root }),
      ]);
    },
  });
}

export function usePaymentsBuildSchedule() {
  const qc = useQueryClient();

  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.enrollments.root, qk.payments.root, qk.inbox.root, qk.users.me(), qk.grants.root],
    mutationFn: async (input: PaymentScheduleBuildInput) => {
      const enrollmentId = String(input.enrollmentId || "").trim();
      if (!enrollmentId) throw new Error("enrollmentId is required");

      const enrollment = await Enrollments.getById(enrollmentId);
      if (!enrollment) throw new Error("Enrollment not found");

      const advancedMonthlyPlans = Array.isArray(input.monthlyPlans) ? input.monthlyPlans : [];
      const advancedAdditions = Array.isArray(input.additions) ? input.additions : [];
      const useAdvanced = advancedMonthlyPlans.length > 0 || advancedAdditions.length > 0;

      const generatedItems: TPaymentProjectionInput[] = [];

      if (useAdvanced) {
        for (const plan of advancedMonthlyPlans) {
          const lineItemId = String(plan.lineItemId || "").trim();
          if (!lineItemId) continue;
          const months = Number(plan.months || 0);
          const monthlyAmount = Number(plan.monthlyAmount || 0);
          const startDate = toISO10(plan.startDate);
          if (!startDate || !Number.isFinite(months) || months <= 0) continue;
          if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) continue;

          const resp = await Payments.generateProjections({
            startDate,
            months: Math.floor(months),
            monthlyAmount,
          });
          const items = Array.isArray(resp.items) ? resp.items : [];
          for (const item of items) {
            const type = String(item?.type || "").toLowerCase();
            const note =
              type === "monthly"
                ? [plan.kind === "utility" ? "utility" : "rent"]
                : item.note ?? undefined;
            generatedItems.push(
              withProjectionMeta(item, lineItemId, {
                note,
                ...(plan.vendor ? { vendor: plan.vendor } : {}),
                ...(plan.comment ? { comment: plan.comment } : {}),
              }),
            );
          }
        }

        for (const add of advancedAdditions) {
          const dueDate = toISO10(add.dueDate);
          const lineItemId = String(add.lineItemId || "").trim();
          const amount = Number(add.amount || 0);
          if (!dueDate || !lineItemId || !Number.isFinite(amount) || amount <= 0) continue;
          generatedItems.push({
            id: `tmp_build_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: add.type,
            amount,
            dueDate,
            lineItemId,
            note: add.note ?? null,
            vendor: add.vendor ?? null,
            comment: add.comment ?? null,
            paid: false,
            paidAt: null,
            paidFromGrant: false,
          } as TPaymentProjectionInput);
        }
      } else {
        const lineItemId = String(input.lineItemId || "").trim();
        if (!lineItemId) throw new Error("lineItemId is required");
        const generateReq: PaymentsGenerateProjectionsReq = {
          startDate: toISO10(input.startDate),
          months: Number(input.months),
          monthlyAmount: Number(input.monthlyAmount),
          ...(input.includeDeposit && Number(input.depositAmount || 0) > 0
            ? { deposit: Number(input.depositAmount) }
            : {}),
        };

        const generatedResp = await Payments.generateProjections(generateReq);
        const generatedItemsRaw = Array.isArray(generatedResp.items) ? generatedResp.items : [];
        generatedItems.push(
          ...generatedItemsRaw.map((p) =>
            withLineItemId(
              p,
              lineItemId,
              input.includeDeposit && input.depositDate ? input.depositDate : undefined,
            ),
          ),
        );
      }

      const existing = Array.isArray(enrollment.payments) ? (enrollment.payments as TPayment[]) : [];
      const replaceUnpaid = input.replaceUnpaid ?? true;
      const payloadPayments = buildProjectionPayload(existing, generatedItems, replaceUnpaid);

      await Payments.upsertProjections({
        enrollmentId,
        payments: payloadPayments,
      });

      await Enrollments.upsert({
        id: enrollmentId,
        scheduleMeta: paymentBuilderMetaFromInput(input) as unknown,
      } as unknown as Parameters<typeof Enrollments.upsert>[0]);

      const inputTaskDefs = Array.isArray(input.taskDefs) ? input.taskDefs.filter(Boolean) : [];
      const replaceTaskDefPrefixes = Array.isArray(input.replaceTaskDefPrefixes)
        ? input.replaceTaskDefPrefixes.map((p) => String(p || "").trim()).filter(Boolean)
        : [];
      if (inputTaskDefs.length || replaceTaskDefPrefixes.length) {
        const prevTaskMeta =
          enrollment && typeof (enrollment as Record<string, unknown>).taskScheduleMeta === "object"
            ? ((enrollment as Record<string, unknown>).taskScheduleMeta as Record<string, unknown>)
            : null;
        const prevDefs = Array.isArray(prevTaskMeta?.defs) ? prevTaskMeta!.defs : [];
        const keyOf = (d: unknown) => {
          const o = d && typeof d === "object" ? (d as Record<string, unknown>) : {};
          return String(o.id || `${o.name || ""}|${o.frequency || ""}|${o.startDate || ""}`);
        };
        const isReplacedDef = (d: unknown) => {
          const key = keyOf(d);
          return replaceTaskDefPrefixes.some((prefix) => key.startsWith(prefix));
        };
        const nextDefsByKey = new Map<string, unknown>();
        for (const d of prevDefs) {
          if (!isReplacedDef(d)) nextDefsByKey.set(keyOf(d), d);
        }
        for (const d of inputTaskDefs) nextDefsByKey.set(keyOf(d), d);
        const mergedTaskDefs = Array.from(nextDefsByKey.values());

        await Enrollments.upsert({
          id: enrollmentId,
          taskScheduleMeta: {
            version: 1,
            defs: mergedTaskDefs,
            savedAt: new Date().toISOString(),
          } as unknown,
        } as unknown as Parameters<typeof Enrollments.upsert>[0]);

        await Tasks.generateScheduleWrite({
          enrollmentId,
          mode: "replaceManaged",
          keepManual: true,
          preserveCompletedManaged: true,
          pinCompletedManaged: true,
          replaceTaskDefPrefixes,
          taskDefs: mergedTaskDefs as unknown as ReqOf<"tasksGenerateScheduleWrite">["taskDefs"],
        } as ReqOf<"tasksGenerateScheduleWrite">);
      }

      const grantId = enrollment.grantId ? String(enrollment.grantId) : null;
      const activeOnly = input.options?.activeOnly ?? true;
      if (grantId && (input.options?.updateGrantBudgets ?? true)) {
        await Payments.updateGrantBudget({ grantId, activeOnly, source: 1 });
      }
      if (grantId && (input.options?.recalcGrantProjected ?? true)) {
        await Payments.recalcGrantProjected({ grantId, activeOnly, source: 1 });
      }

      return {
        enrollmentId,
        customerId: enrollment.customerId ? String(enrollment.customerId) : null,
        grantId,
      };
    },
    onSuccess: async (context) => {
      await invalidateEnrollmentContext(qc, context);
    },
  });
}

// Grant-scoped endpoints
export function usePaymentsUpdateGrantBudget() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.grants.root],
    mutationFn: (body: PaymentsRecalcGrantProjectedReq) => Payments.updateGrantBudget(body),
    onSuccess: async (_res, body) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.grants.root }),
        qc.invalidateQueries({ queryKey: qk.grants.detail(String(body.grantId || "")) }),
      ]);
    },
  });
}

export function usePaymentsRecalcGrantProjected() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.grants.root],
    mutationFn: (body: PaymentsRecalcGrantProjectedReq) => Payments.recalcGrantProjected(body),
    onSuccess: async (_res, body) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.grants.root }),
        qc.invalidateQueries({ queryKey: qk.grants.detail(String(body.grantId || "")) }),
      ]);
    },
  });
}

export type { PaymentProjection, PaymentViewRow, PaymentListFilters };

// ─── Two-source payment list hooks ────────────────────────────────────────────

/**
 * Paid ledger entries for a given month/grant/customer.
 * Defaults: current month, all grants, all customers.
 */
export function useListPayments(
  filters: PaymentListFilters = {},
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<PaymentViewRow[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.payments.list(filters as Record<string, unknown>),
    queryFn: () => Payments.listLedger(filters),
  });
}

/**
 * Pending projection queue items (unpaid scheduled payments) for a given month/grant/customer.
 * Defaults: current month, all grants, all customers.
 */
export function useListProjections(
  filters: PaymentListFilters = {},
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<PaymentViewRow[]>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.payments.projections(filters as Record<string, unknown>),
    queryFn: () => Payments.listProjections(filters),
  });
}

/**
 * Combined paid + projected rows for a given month/grant/customer, sorted by dueDate.
 * Returns rows, split arrays, and running totals — ready for a payments table.
 * Defaults: current month, all grants, all customers.
 */
export function usePaymentLedgerAll(
  filters: PaymentListFilters = {},
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
    queryKey: qk.payments.all(filters as Record<string, unknown>),
    queryFn: () => Payments.listAll(filters),
    // Stable empty default so consumers can destructure safely before data loads
    placeholderData: {
      rows: [] as PaymentViewRow[],
      payments: [] as PaymentViewRow[],
      projections: [] as PaymentViewRow[],
      totals: { paidAmount: 0, projectedAmount: 0, netAmount: 0, count: 0 },
    },
  });
}
