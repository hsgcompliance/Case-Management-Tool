"use client";

import React from "react";
import type { ReqOf, TPayment } from "@types";
import type { CustomerPaymentRow } from "@client/payments";
import { toApiError } from "@client/api";
import {
  useCustomerPayments,
  usePaymentsBuildSchedule,
  usePaymentsDeleteRows,
  usePaymentsProjectionsAdjust,
  usePaymentsSpend,
  usePaymentsUpdateCompliance,
  type PaymentScheduleBuildInput,
  type PaymentsProjectionsAdjustInput,
} from "@hooks/usePayments";
import { useCustomerEnrollments } from "@hooks/useEnrollments";
import PaymentPaidDialog from "@entities/dialogs/payments/PaymentPaidDialog";
import PaymentsDeleteDialog from "@entities/dialogs/payments/PaymentsDeleteDialog";
import PaymentScheduleBuilderDialog from "@entities/dialogs/payments/PaymentScheduleBuilderDialog";
import PaymentsProjectionsAdjustDialog from "@entities/dialogs/payments/PaymentsProjectionsAdjustDialog";
import { CustomerPaymentsTable } from "../components";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { safeISODate10 } from "@lib/date";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { toast } from "@lib/toast";

type SelectedPayment = {
  enrollmentId: string;
  paymentKey: string;
  payment: TPayment;
  row: CustomerPaymentRow;
};

function paymentDate(p: TPayment): string {
  const legacyDate = (p as Record<string, unknown>).date;
  return safeISODate10(p.dueDate || legacyDate) || "";
}

function paymentTypeKey(p: TPayment): string {
  const type = String(p?.type || "monthly").toLowerCase();
  if (type !== "monthly") return type;
  const notes = Array.isArray((p as any)?.note) ? (p as any).note : (p as any)?.note != null ? [(p as any).note] : [];
  const tags = notes.map((x: unknown) => String(x || "").toLowerCase());
  const isUtility = tags.some((t) => t === "sub:utility" || t === "utility" || t.startsWith("sub:utility") || t.startsWith("utility:"));
  return isUtility ? "monthly:utility" : "monthly:rent";
}

export function PaymentsTab({ customerId }: { customerId: string }) {
  const { data: rows = [], isLoading } = useCustomerPayments(customerId);
  const { data: enrollments = [] } = useCustomerEnrollments(customerId, { enabled: !!customerId });
  const spend = usePaymentsSpend();
  const compliance = usePaymentsUpdateCompliance();
  const deleteRows = usePaymentsDeleteRows();
  const buildScheduleMutation = usePaymentsBuildSchedule();
  const adjustMutation = usePaymentsProjectionsAdjust();

  const [selected, setSelected] = React.useState<SelectedPayment | null>(null);
  const [paidDialogOpen, setPaidDialogOpen] = React.useState(false);
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [hmisComplete, setHmisComplete] = React.useState(false);
  const [caseworthyComplete, setCaseworthyComplete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [enrollmentFilterId, setEnrollmentFilterId] = React.useState<string>("all");

  const sorted = React.useMemo(() => {
    return rows.slice().sort((a: CustomerPaymentRow, b: CustomerPaymentRow) => {
      const ad = paymentDate(a.payment);
      const bd = paymentDate(b.payment);
      return ad.localeCompare(bd);
    });
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    if (enrollmentFilterId === "all") return sorted;
    return sorted.filter((r) => String(r.enrollmentId || "") === enrollmentFilterId);
  }, [sorted, enrollmentFilterId]);

  const totals = React.useMemo(() => {
    let total = 0;
    let paid = 0;
    let projectedUnpaid = 0;
    for (const row of filteredRows) {
      const amt = Number((row.payment as any)?.amount || 0);
      if (!Number.isFinite(amt)) continue;
      total += amt;
      if ((row.payment as any)?.paid) paid += amt;
      else projectedUnpaid += amt;
    }
    return { total, paid, projectedUnpaid };
  }, [filteredRows]);

  const byType = React.useMemo(() => {
    const m = new Map<string, { count: number; total: number; paid: number; unpaid: number }>();
    for (const row of filteredRows) {
      const key = paymentTypeKey(row.payment);
      const amt = Number((row.payment as any)?.amount || 0) || 0;
      const cur = m.get(key) || { count: 0, total: 0, paid: 0, unpaid: 0 };
      cur.count += 1;
      cur.total += amt;
      if ((row.payment as any)?.paid) cur.paid += amt;
      else cur.unpaid += amt;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }, [filteredRows]);

  const byLineItem = React.useMemo(() => {
    const m = new Map<string, { count: number; total: number; paid: number; unpaid: number }>();
    for (const row of filteredRows) {
      const key = String((row.payment as any)?.lineItemId || "").trim() || "(none)";
      const amt = Number((row.payment as any)?.amount || 0) || 0;
      const cur = m.get(key) || { count: 0, total: 0, paid: 0, unpaid: 0 };
      cur.count += 1;
      cur.total += amt;
      if ((row.payment as any)?.paid) cur.paid += amt;
      else cur.unpaid += amt;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }, [filteredRows]);

  const byEnrollment = React.useMemo(() => {
    const m = new Map<string, { label: string; count: number; total: number; paid: number; unpaid: number }>();
    for (const row of filteredRows) {
      const key = String(row.enrollmentId || "");
      const amt = Number((row.payment as any)?.amount || 0) || 0;
      const cur = m.get(key) || {
        label: formatEnrollmentLabel(row.enrollment as Record<string, unknown>, { fallback: key }),
        count: 0,
        total: 0,
        paid: 0,
        unpaid: 0,
      };
      cur.count += 1;
      cur.total += amt;
      if ((row.payment as any)?.paid) cur.paid += amt;
      else cur.unpaid += amt;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [filteredRows]);

  React.useEffect(() => {
    setError(null);
    setHmisComplete(Boolean(selected?.payment?.compliance?.hmisComplete));
    setCaseworthyComplete(Boolean(selected?.payment?.compliance?.caseworthyComplete));
  }, [selected]);

  const paymentId = selected?.payment?.id ? String(selected.payment.id) : "";
  const builderEnrollments = React.useMemo(() => {
    return enrollments.map((e) => {
      const status = String(e?.status || "").toLowerCase();
      const statusLabel: "open" | "closed" = status === "closed" || status === "deleted" ? "closed" : "open";
      const lineItemIds = Array.from(
        new Set(
          (Array.isArray(e?.payments) ? e.payments : [])
            .map((p) => String((p as Record<string, unknown>)?.lineItemId || "").trim())
            .filter(Boolean),
        ),
      );
      return {
        id: String(e.id || ""),
        label: formatEnrollmentLabel(e as Record<string, unknown>),
        grantId: String(e.grantId || ""),
        statusLabel,
        lineItemIds,
        scheduleMeta: (e as Record<string, unknown>).scheduleMeta,
      };
    });
  }, [enrollments]);

  const adjustEnrollments = React.useMemo(() => {
    return enrollments.map((e) => {
      const lineItemIds = Array.from(
        new Set(
          (Array.isArray(e?.payments) ? e.payments : [])
            .map((p) => String((p as Record<string, unknown>)?.lineItemId || "").trim())
            .filter(Boolean),
        ),
      );
      return {
        id: String(e.id || ""),
        label: formatEnrollmentLabel(e as Record<string, unknown>),
        grantId: String(e.grantId || ""),
        lineItemIds,
        payments: (Array.isArray(e.payments) ? e.payments : []) as TPayment[],
      };
    });
  }, [enrollments]);

  const markUnpaid = async () => {
    if (!selected?.enrollmentId || !paymentId) return;
    setError(null);
    try {
      await spend.mutateAsync({
        body: {
          enrollmentId: selected.enrollmentId,
          paymentId,
          reverse: true,
        },
      });
      setSelected(null);
      setPaidDialogOpen(false);
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update paid state.", { type: "error" });
    }
  };

  const markPaid = async (meta: { note?: string; vendor?: string; comment?: string }) => {
    if (!selected?.enrollmentId || !paymentId) return;
    setError(null);
    try {
      await spend.mutateAsync({
        body: {
          enrollmentId: selected.enrollmentId,
          paymentId,
          reverse: false,
          ...(meta.note ? { note: meta.note } : {}),
          ...(meta.vendor ? { vendor: meta.vendor } : {}),
          ...(meta.comment ? { comment: meta.comment } : {}),
        },
      });
      setSelected(null);
      setPaidDialogOpen(false);
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update paid state.", { type: "error" });
    }
  };

  const saveCompliance = async () => {
    if (!selected?.enrollmentId || !paymentId) return;
    setError(null);
    try {
      await compliance.mutateAsync({
        enrollmentId: selected.enrollmentId,
        paymentId,
        patch: { hmisComplete, caseworthyComplete },
      });
      setSelected(null);
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update compliance.", { type: "error" });
    }
  };

  const togglePaidInline = async (row: CustomerPaymentRow, nextPaid: boolean) => {
    const enrollmentId = String(row.enrollmentId || "").trim();
    const pid = String((row.payment as Record<string, unknown>)?.id || "").trim();
    if (!enrollmentId || !pid) return;
    setError(null);
    try {
      await spend.mutateAsync({
        body: {
          enrollmentId,
          paymentId: pid,
          reverse: !nextPaid,
        },
      });
      if (selected?.enrollmentId === enrollmentId && paymentId === pid) {
        setSelected(null);
        setPaidDialogOpen(false);
      }
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update paid state.", { type: "error" });
    }
  };

  const toggleComplianceInline = async (
    row: CustomerPaymentRow,
    field: "hmisComplete" | "caseworthyComplete",
    nextValue: boolean,
  ) => {
    const enrollmentId = String(row.enrollmentId || "").trim();
    const pid = String((row.payment as Record<string, unknown>)?.id || "").trim();
    if (!enrollmentId || !pid) return;
    const current = (row.payment as Record<string, unknown>)?.compliance as Record<string, unknown> | undefined;
    setError(null);
    try {
      await compliance.mutateAsync({
        enrollmentId,
        paymentId: pid,
        patch: {
          hmisComplete: field === "hmisComplete" ? nextValue : Boolean(current?.hmisComplete),
          caseworthyComplete: field === "caseworthyComplete" ? nextValue : Boolean(current?.caseworthyComplete),
        },
      });
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update compliance.", { type: "error" });
    }
  };

  const buildSchedule = async (payload: PaymentScheduleBuildInput) => {
    setError(null);
    try {
      await buildScheduleMutation.mutateAsync(payload);
      setBuilderOpen(false);
    } catch (e: unknown) {
      setError(toApiError(e).error || "Failed to build payment schedule.");
    }
  };

  const applyAdjustments = async (payload: PaymentsProjectionsAdjustInput) => {
    setError(null);
    try {
      await adjustMutation.mutateAsync(payload);
      setAdjustOpen(false);
    } catch (e: unknown) {
      setError(toApiError(e).error || "Failed to apply payment/projection adjustments.");
    }
  };

  const deletePayments = async (payload: ReqOf<"paymentsDeleteRows">) => {
    setError(null);
    try {
      await deleteRows.mutateAsync(payload);
      setDeleteOpen(false);
      setSelected(null);
      setPaidDialogOpen(false);
    } catch (e: unknown) {
      setError(toApiError(e).error || "Failed to delete payment rows.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-900">Payment Schedule</div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm"
            onClick={() => setAdjustOpen(true)}
            disabled={adjustMutation.isPending || adjustEnrollments.length === 0}
            title={adjustEnrollments.length === 0 ? "Create an enrollment first." : "Adjust payments and projections"}
          >
            {adjustMutation.isPending ? "Applying..." : "Adjust"}
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setBuilderOpen(true)}
            disabled={buildScheduleMutation.isPending || builderEnrollments.length === 0}
            title={builderEnrollments.length === 0 ? "Create an enrollment first." : "Build projected schedule rows"}
          >
            {buildScheduleMutation.isPending ? "Building..." : "Open Builder"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="field">
            <span className="label">Filter by Enrollment</span>
            <select
              className="input min-w-[18rem]"
              value={enrollmentFilterId}
              onChange={(e) => setEnrollmentFilterId(e.currentTarget.value)}
            >
              <option value="all">All enrollments</option>
              {builderEnrollments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-500">
            Showing {filteredRows.length} payment row{filteredRows.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Projected Total (Paid + Projected)</div>
            <div className="text-lg font-semibold text-slate-900">{fmtCurrencyUSD(totals.total)}</div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Paid Total</div>
            <div className="text-lg font-semibold text-emerald-700">{fmtCurrencyUSD(totals.paid)}</div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Projected (Unpaid) Total</div>
            <div className="text-lg font-semibold text-sky-700">{fmtCurrencyUSD(totals.projectedUnpaid)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {([
            { title: "By Line Item", rows: byLineItem.map((r) => ({ label: r.key, ...r })) },
            { title: "By Enrollment", rows: byEnrollment.map((r) => ({ label: r.label, ...r })) },
            { title: "By Type", rows: byType.map((r) => ({ label: r.key, ...r })) },
          ] as const).map((section) => (
            <div key={section.title} className="rounded border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                {section.title}
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Key</th>
                      <th className="px-3 py-1.5 text-right">Rows</th>
                      <th className="px-3 py-1.5 text-right">Total</th>
                      <th className="px-3 py-1.5 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length ? (
                      section.rows.map((r) => (
                        <tr key={`${section.title}:${r.label}`} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-800">{r.label}</td>
                          <td className="px-3 py-1.5 text-right text-slate-700">{r.count}</td>
                          <td className="px-3 py-1.5 text-right text-slate-800">{fmtCurrencyUSD(r.total)}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-700">{fmtCurrencyUSD(r.paid)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-slate-500">No rows.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-600">Loading payments...</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-sm text-slate-600">No payments found for this customer.</div>
      ) : (
        <CustomerPaymentsTable
          rows={filteredRows}
          selectedKey={selected?.paymentKey || null}
          renderSelectedRowDetail={() =>
            selected ? (
              <div>
                <div className="mb-2 text-sm font-medium text-slate-900">Payment Actions</div>
                <div className="mb-3 text-xs text-slate-600">
                  Due {fmtDateOrDash(paymentDate(selected.payment))} | Enrollment {selected.enrollmentId}
                </div>

                {error ? <div className="mb-2 text-sm text-red-700">{error}</div> : null}

                <div className="mb-3 flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hmisComplete}
                      onChange={(e) => setHmisComplete(e.currentTarget.checked)}
                    />
                    <span>HMIS complete</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={caseworthyComplete}
                      onChange={(e) => setCaseworthyComplete(e.currentTarget.checked)}
                    />
                    <span>Caseworthy complete</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="btn btn-sm"
                    onClick={() => setPaidDialogOpen(true)}
                  >
                    Mark paid
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void markUnpaid()}
                  >
                    Mark unpaid
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => void saveCompliance()}
                    disabled={compliance.isPending}
                  >
                    {compliance.isPending ? "Saving..." : "Save compliance"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-rose-700"
                    onClick={() => setDeleteOpen(true)}
                    disabled={deleteRows.isPending}
                  >
                    {deleteRows.isPending ? "Deleting..." : "Delete..."}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelected(null);
                      setPaidDialogOpen(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null
          }
          onTogglePaid={togglePaidInline}
          onToggleCompliance={toggleComplianceInline}
          busyPaid={spend.isPending}
          busyCompliance={compliance.isPending}
          onManage={(row, key) =>
            setSelected({
              enrollmentId: row.enrollmentId,
              paymentKey: key,
              payment: row.payment,
              row,
            })
          }
        />
      )}

      <PaymentPaidDialog
        open={paidDialogOpen}
        amount={Number(selected?.payment?.amount || 0)}
        dueDate={String(selected?.payment?.dueDate || "")}
        onCancel={() => setPaidDialogOpen(false)}
        onSave={(meta) => void markPaid(meta)}
      />

      <PaymentsDeleteDialog
        open={deleteOpen}
        busy={deleteRows.isPending}
        selected={
          selected
            ? {
                enrollmentId: selected.enrollmentId,
                paymentId: String(selected.payment?.id || ""),
                paid: !!selected.payment?.paid,
                amount: Number(selected.payment?.amount || 0),
                dueDate: String(selected.payment?.dueDate || ""),
              }
            : null
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={(payload) => void deletePayments(payload)}
      />

      <PaymentScheduleBuilderDialog
        open={builderOpen}
        busy={buildScheduleMutation.isPending}
        enrollments={builderEnrollments}
        onCancel={() => setBuilderOpen(false)}
        onBuild={(payload) => void buildSchedule(payload)}
      />

      <PaymentsProjectionsAdjustDialog
        open={adjustOpen}
        busy={adjustMutation.isPending}
        enrollments={adjustEnrollments}
        onCancel={() => setAdjustOpen(false)}
        onApply={(payload) => void applyAdjustments(payload)}
      />
    </div>
  );
}

export default PaymentsTab;
