// src/features/grants/tabs/ActivityTab.tsx
"use client";
import React from "react";
import { useGrantActivity } from "@hooks/useGrants";
import { fmtFromTsLike } from "@lib/date";

export function ActivityTab({ grantId }: { grantId: string }) {
  const { data = [] } = useGrantActivity(grantId, 50);
  const items = Array.isArray(data) ? data : [];

  const fmtCurrency = (n: number) =>
    Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  if (items.length === 0) return <div className="text-sm text-slate-600 dark:text-slate-400 mt-4">No spend activity yet.</div>;

  const net = items.reduce((acc: number, s: any) => acc + (Number(s.amount) || 0), 0);

  return (
    <div className="space-y-3 mt-4">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Line Item</th>
              <th>Enrollment</th>
              <th>Payment</th>
              <th>Note</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s: any) => (
              <tr key={s.id}>
                <td>{fmtFromTsLike(s.ts, s.dueDate ?? s.date)}</td>
                <td>
                  <span className={Number(s.amount) < 0 ? "text-red-600" : "text-slate-900 dark:text-slate-100"}>
                    {fmtCurrency(s.amount)}
                  </span>
                </td>
                <td>{s.lineItemLabelAtSpend ?? s.lineItemId ?? "—"}</td>
                <td>{s.enrollmentId || "—"}</td>
                <td>{s.paymentId || "—"}</td>
                <td>{Array.isArray(s.note) ? s.note.join(", ") : s.note || "—"}</td>
                <td>
                  {s.reversalOf ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">Reversal</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">Spend</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-4">
        <div>
          <span className="font-medium">Events:</span> {items.length}
        </div>
        <div>
          <span className="font-medium">Net Spend:</span> {fmtCurrency(net)}
        </div>
        <div className="text-slate-400 dark:text-slate-500">(Net = spends − reversals)</div>
      </div>
    </div>
  );
}
