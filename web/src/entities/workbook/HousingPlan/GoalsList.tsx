"use client";

// Goals renderer for the structured view — stacked numbered cards mirroring the
// mobile app's Plan tab (GoalCard in mobile-web CustomerDetailPage), instead of
// a wide table. Notes reference goals by table position ("Goal #2"), so the
// number badge matters. Each card exposes Edit when the caller allows it.

import React from "react";
import { cellText } from "../shared";
import type { tss as TssNS } from "@hdb/contracts";

function goalStatusClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "open":    return "border-amber-200 bg-amber-50 text-amber-700";
    case "closed":  return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "on hold": return "border-slate-200 bg-slate-100 text-slate-600";
    default:        return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }
}

export function GoalsList({
  entity,
  onEditRow,
}: {
  entity: TssNS.TssExtractedEntity;
  /** When provided, each card shows an Edit action. */
  onEditRow?: (row: TssNS.TssExtractedRow) => void;
}) {
  const rows = entity.rows ?? [];

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const goal = cellText(row, "goalSmart");
        const objective = cellText(row, "objective");
        const status = cellText(row, "status");
        const responsible = cellText(row, "responsible");
        const targetDate = cellText(row, "targetDate");
        const tier = cellText(row, "serviceTier");
        return (
          <div key={row.rowKey} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-1 items-start gap-2 min-w-0">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                  {i + 1}
                </span>
                <p className="flex-1 whitespace-pre-wrap text-sm font-semibold leading-snug text-slate-900">
                  {goal || "—"}
                </p>
              </div>
              {status ? (
                <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${goalStatusClasses(status)}`}>
                  {status}
                </span>
              ) : null}
            </div>
            {objective ? <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">{objective}</p> : null}
            {(responsible || targetDate || tier) ? (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {responsible ? <span><span className="text-slate-400">Owner:</span> {responsible}</span> : null}
                {targetDate ? <span><span className="text-slate-400">Target:</span> {targetDate}</span> : null}
                {tier ? <span><span className="text-slate-400">Tier:</span> {tier}</span> : null}
              </div>
            ) : null}
            {onEditRow ? (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="rounded-md px-2 py-0.5 text-xs font-medium text-sky-600 hover:bg-sky-50"
                  onClick={() => onEditRow(row)}
                >
                  Edit
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
