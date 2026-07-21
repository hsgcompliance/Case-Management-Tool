"use client";

import React from "react";
import { buildEnrollmentClosePreview } from "@hdb/contracts/enrollments";
import { Modal } from "@entities/ui/Modal";
import { fmtDateOrDash } from "@lib/formatters";
import { toISODate } from "@lib/date";

type EnrollmentLike = Record<string, unknown> & { id?: unknown };

function isOpenEnrollment(row: EnrollmentLike): boolean {
  const status = String(row.status || "").toLowerCase();
  return row.deleted !== true && status !== "deleted" && status !== "closed" && row.active !== false;
}

export function CustomerInactivePreviewDialog({
  open,
  customerName,
  enrollments,
  loading,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  customerName: string;
  enrollments: EnrollmentLike[];
  loading?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const today = React.useMemo(() => toISODate(new Date()), []);
  const rows = React.useMemo(
    () => enrollments.filter(isOpenEnrollment).map((enrollment) => {
      const payments = Array.isArray(enrollment.payments) ? enrollment.payments as Record<string, unknown>[] : [];
      return {
        enrollment,
        preview: buildEnrollmentClosePreview({ payments, fallbackDate: today }),
      };
    }),
    [enrollments, today],
  );
  const futureUnpaid = rows.reduce((sum, row) => sum + row.preview.futureUnpaidPayments.length, 0);

  return (
    <Modal
      isOpen={open}
      title={`Mark ${customerName || "customer"} inactive?`}
      onClose={onCancel}
      widthClass="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-sm" onClick={onConfirm} disabled={busy || loading}>
            {busy ? "Closing..." : "Close enrollments and mark inactive"}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="text-sm text-slate-600">Loading enrollment close preview...</div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            {rows.length} open enrollment{rows.length === 1 ? "" : "s"} will close. {futureUnpaid} future unpaid payment{futureUnpaid === 1 ? "" : "s"} will be removed and its pending projection voided.
          </div>
          {rows.length ? (
            <div className="max-h-72 space-y-2 overflow-auto">
              {rows.map(({ enrollment, preview }, index) => (
                <div key={String(enrollment.id || index)} className="rounded-lg border border-slate-200 p-3">
                  <div className="font-semibold text-slate-900">{String(enrollment.grantName || enrollment.name || enrollment.grantId || "Enrollment")}</div>
                  <div className="mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                    <span>Ends: {fmtDateOrDash(preview.closeDate)}</span>
                    <span>Last paid: {fmtDateOrDash(preview.lastPaidDate)}</span>
                    <span>Future unpaid voided: {preview.futureUnpaidPayments.length}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-slate-600">No open enrollments will be changed.</div>}
        </div>
      )}
    </Modal>
  );
}

