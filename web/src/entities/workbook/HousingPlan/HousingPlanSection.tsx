"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HousingPlan section renderers (SCAFFOLD — next build-out)
// ─────────────────────────────────────────────────────────────────────────────
// Home for dedicated renderers of the "housingPlan" section entities:
//
//   • customerStrengths  — renderKind "summaryBox"  (Client Strengths + CM Summary)
//   • housingBarriers    — renderKind "dataTable"   (Barrier / Mitigation / Service Tier)
//   • goals              — renderKind "dataTable"   (SMART goal / objective / target date / status …)
//
// Current state:
//   - goals + housingBarriers are dataTables and ALREADY render via the generic
//     DataTable in WorkbookStructuredView (section !== "notes" path).
//   - customerStrengths is "summaryBox", which the extractor does NOT yet support
//     (SUPPORTED_RENDER_KINDS = keyValueCard, dataTable) → shows "unsupported".
//
// To build out (future agent):
//   1. Backend (functions/.../workbookExtractor.ts): add a summaryBox extractor
//      and include "summaryBox" in SUPPORTED_RENDER_KINDS so customerStrengths
//      extracts (it's an anchored 1–2 column block, not a header table).
//   2. Frontend: implement GoalsList (cards: SMART goal title, objective, target
//      date, status badge) and a StrengthsSummary renderer here, then route
//      section === "housingPlan" entities to them in WorkbookStructuredView's
//      EntityBlock "extracted" switch (mirroring how "notes" routes to NotesList).
//   3. Goals are bidirectional dataTables → the shared AddRowForm can power an
//      "+ Add goal" affordance once routed (same pattern as progress notes).
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
