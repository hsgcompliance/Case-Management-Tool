"use client";

import React from "react";
import type { CustomerPaymentRow } from "@client/payments";
import ActionMenu from "@entities/ui/ActionMenu";
import { PaymentTypeBadge } from "@entities/payments/PaymentTypeLabel";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { safeISODate10 } from "@lib/date";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";

type Props = {
  rows: CustomerPaymentRow[];
  onManage: (row: CustomerPaymentRow, key: string) => void;
  onAdjustSchedule?: (row: CustomerPaymentRow, key: string) => void;
  onDeleteRow?: (row: CustomerPaymentRow, key: string) => void;
  rowIssues?: Record<string, { label: string } | undefined>;
  rentCertStatuses?: Record<string, "none" | "due" | "completed" | undefined>;
  selectedKey?: string | null;
  renderSelectedRowDetail?: (row: CustomerPaymentRow, key: string) => React.ReactNode;
  onTogglePaid?: (row: CustomerPaymentRow, nextPaid: boolean) => void | Promise<void>;
  onToggleCompliance?: (
    row: CustomerPaymentRow,
    field: "hmisComplete" | "caseworthyComplete",
    nextValue: boolean,
  ) => void | Promise<void>;
  busyPaid?: boolean;
  busyCompliance?: boolean;
};

function paymentDate(p: unknown): string {
  const payment = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
  return safeISODate10(payment.dueDate || payment.date) || "";
}

function RentCertChip({ status }: { status: "none" | "due" | "completed" | undefined }) {
  const normalized = status || "none";
  const config =
    normalized === "completed"
      ? {
          label: "Rent Cert Completed",
          flag: "OK",
          className: "border-emerald-300 bg-emerald-50 text-emerald-800",
        }
      : normalized === "due"
      ? {
          label: "Rent Cert Due",
          flag: "!",
          className: "border-amber-300 bg-amber-50 text-amber-800",
        }
      : {
          label: "No Rent Cert Due",
          flag: "",
          className: "border-slate-200 bg-slate-50 text-slate-500",
        };

  return (
    <span
      title={config.label}
      className={[
        "inline-flex min-w-[9.75rem] items-center justify-between gap-2 rounded border px-2 py-1 text-xs font-semibold leading-none",
        config.className,
      ].join(" ")}
    >
      <span>{config.label}</span>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-current text-[10px] leading-none">
        {config.flag}
      </span>
    </span>
  );
}

export default function CustomerPaymentsTable({
  rows,
  onManage,
  onAdjustSchedule,
  onDeleteRow,
  rowIssues,
  rentCertStatuses,
  selectedKey = null,
  renderSelectedRowDetail,
  onTogglePaid,
  onToggleCompliance,
  busyPaid = false,
  busyCompliance = false,
}: Props) {
  const [paidOverrides, setPaidOverrides] = React.useState<Record<string, boolean | undefined>>({});
  const [complianceOverrides, setComplianceOverrides] = React.useState<
    Record<string, { hmisComplete?: boolean; caseworthyComplete?: boolean }>
  >({});

  React.useEffect(() => {
    // Clear optimistic overlays once canonical props catch up.
    setPaidOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of rows) {
        const p: any = row.payment || {};
        const key = `${row.enrollmentId}:${String(p.id || "")}`;
        if (!key) continue;
        if (Object.prototype.hasOwnProperty.call(next, key) && next[key] === Boolean(p.paid)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setComplianceOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of rows) {
        const p: any = row.payment || {};
        const key = `${row.enrollmentId}:${String(p.id || "")}`;
        if (!key || !next[key]) continue;
        const current = next[key];
        const hmisMatches =
          current.hmisComplete === undefined || current.hmisComplete === Boolean(p?.compliance?.hmisComplete);
        const cwMatches =
          current.caseworthyComplete === undefined || current.caseworthyComplete === Boolean(p?.compliance?.caseworthyComplete);
        if (hmisMatches && cwMatches) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rows]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left">Due</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Amount</th>
            <th className="px-3 py-2 text-left">Paid</th>
            <th className="px-3 py-2 text-left">Compliance</th>
            <th className="px-3 py-2 text-left">Rent Cert</th>
            <th className="px-3 py-2 text-left">Enrollment</th>
            <th className="px-3 py-2 text-left"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const p: any = row.payment || {};
            const key = `${row.enrollmentId}:${String(p.id || idx)}`;
            const issue = rowIssues?.[key];
            const isSelected = selectedKey === key;
            const optimisticPaid = Object.prototype.hasOwnProperty.call(paidOverrides, key)
              ? !!paidOverrides[key]
              : !!p.paid;
            const optimisticCompliance = complianceOverrides[key] || {};
            const optimisticHmis =
              optimisticCompliance.hmisComplete !== undefined
                ? !!optimisticCompliance.hmisComplete
                : !!p?.compliance?.hmisComplete;
            const optimisticCw =
              optimisticCompliance.caseworthyComplete !== undefined
                ? !!optimisticCompliance.caseworthyComplete
                : !!p?.compliance?.caseworthyComplete;
            return (
              <React.Fragment key={key}>
                <tr className={["border-t border-slate-200 odd:bg-white even:bg-slate-50/60", isSelected ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : ""].join(" ")}>
                  <td className="px-3 py-2 text-slate-800">
                    <span className="inline-flex items-center gap-2">
                      <span>{fmtDateOrDash(paymentDate(p))}</span>
                      {issue ? (
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-[11px] font-bold leading-none text-amber-800"
                          title={issue.label}
                          aria-label={issue.label}
                          onClick={() => onManage(row, key)}
                        >
                          !
                        </button>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2"><PaymentTypeBadge payment={p} /></td>
                  <td className="px-3 py-2 text-slate-800">{fmtCurrencyUSD(p.amount || 0)}</td>
                  <td className="px-3 py-2 text-slate-800">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={optimisticPaid}
                        disabled={!onTogglePaid || busyPaid}
                        onChange={(e) => {
                          const nextPaid = e.currentTarget.checked;
                          setPaidOverrides((prev) => ({ ...prev, [key]: nextPaid }));
                          Promise.resolve(onTogglePaid?.(row, nextPaid)).catch(() => {
                            setPaidOverrides((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            });
                          });
                        }}
                      />
                      <span>{optimisticPaid ? "yes" : "no"}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={optimisticHmis}
                          disabled={!onToggleCompliance || busyCompliance}
                          onChange={(e) => {
                            const nextValue = e.currentTarget.checked;
                            setComplianceOverrides((prev) => ({
                              ...prev,
                              [key]: { ...(prev[key] || {}), hmisComplete: nextValue },
                            }));
                            Promise.resolve(onToggleCompliance?.(row, "hmisComplete", nextValue)).catch(() => {
                              setComplianceOverrides((prev) => {
                                const base = { ...(prev[key] || {}) };
                                delete base.hmisComplete;
                                const next = { ...prev };
                                if (Object.keys(base).length) next[key] = base;
                                else delete next[key];
                                return next;
                              });
                            });
                          }}
                        />
                        <span>HMIS</span>
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={optimisticCw}
                          disabled={!onToggleCompliance || busyCompliance}
                          onChange={(e) => {
                            const nextValue = e.currentTarget.checked;
                            setComplianceOverrides((prev) => ({
                              ...prev,
                              [key]: { ...(prev[key] || {}), caseworthyComplete: nextValue },
                            }));
                            Promise.resolve(onToggleCompliance?.(row, "caseworthyComplete", nextValue)).catch(() => {
                              setComplianceOverrides((prev) => {
                                const base = { ...(prev[key] || {}) };
                                delete base.caseworthyComplete;
                                const next = { ...prev };
                                if (Object.keys(base).length) next[key] = base;
                                else delete next[key];
                                return next;
                              });
                            });
                          }}
                        />
                        <span>CW</span>
                      </label>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <RentCertChip status={rentCertStatuses?.[key]} />
                  </td>
                  <td className="px-3 py-2 text-base font-semibold leading-snug text-slate-900">
                    {formatEnrollmentLabel(row.enrollment, { fallback: String(row.enrollmentId || "") })}
                  </td>
                  <td className="px-3 py-2">
                    <ActionMenu
                      items={[
                        {
                          key: "manage",
                          label: isSelected ? "Manage (open)" : "Manage",
                          onSelect: () => onManage(row, key),
                        },
                        ...(onAdjustSchedule
                          ? [
                              {
                                key: "adjust",
                                label: "Adjust schedule",
                                onSelect: () => onAdjustSchedule(row, key),
                              },
                            ]
                          : []),
                        ...(onDeleteRow
                          ? [
                              {
                                key: "delete",
                                label: "Delete row",
                                danger: true,
                                onSelect: () => onDeleteRow(row, key),
                              },
                            ]
                          : []),
                      ]}                    />
                  </td>
                </tr>
                {isSelected && renderSelectedRowDetail ? (
                  <tr className="border-t border-sky-100 bg-sky-50/70">
                    <td className="px-3 py-3" colSpan={8}>
                      {renderSelectedRowDetail(row, key)}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
