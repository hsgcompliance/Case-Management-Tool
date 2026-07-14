"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HousingPlan section renderers
// ─────────────────────────────────────────────────────────────────────────────
// Current state (2026-07-14):
//   • customerStrengths (summaryBox) — extracts fine; rendered by SummaryBoxEditor
//     in WorkbookStructuredView (not here).
//   • goals — rendered by GoalsList.tsx (cards + edit/delete).
//   • housingBarriers — still renders via the generic DataTable in
//     WorkbookStructuredView; the remaining build-out is a BarriersList with
//     per-row edit/delete, mirroring the GoalsList pattern
//     (deleteCustomerWorkbookRow already accepts any dataTable entityId).
//
// This component is an unused generic card renderer kept as the starting point
// for that BarriersList specialization.
//
// See docs/active-projects.local/google-integrations/WORKBOOK_SYSTEM.md.

import React from "react";
import { cellText } from "../shared";
import type { tss as TssNS } from "@hdb/contracts";

/**
 * Placeholder card renderer for housing-plan dataTable entities (goals/barriers).
 * Not yet wired into WorkbookStructuredView — the generic DataTable handles them
 * today. Specialize this into GoalsList / BarriersList during the build-out.
 */
export function HousingPlanSection({
  entity,
  cfgEntity,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
}) {
  const fields = cfgEntity?.fields ?? [];
  const titleId = cfgEntity?.display?.titleField ?? fields.find((f) => f.dataType === "longText")?.id;
  const rows = entity.rows ?? [];

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.rowKey} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-medium text-slate-900">{cellText(row, titleId) || "—"}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {fields.filter((f) => f.id !== titleId).map((f) => {
              const v = cellText(row, f.id);
              if (!v) return null;
              return (
                <span key={f.id}>
                  <span className="text-slate-400">{f.display?.label ?? f.expected}:</span> {v}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
