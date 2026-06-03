"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Budget renderer (SCAFFOLD — next build-out)
// ─────────────────────────────────────────────────────────────────────────────
// Home for the "budget" entity (renderKind "budgetTable").
//
// The budget entity is NOT a header-row table — its config carries a rich
// `source.staticContent` describing sections (Monthly Income, Fixed Expenses,
// Flexible Expenses, Annual Expenses, Savings), subsections, item rows, total
// rows, and expected SUM formulas, with a fixed item column (A) and amount
// column (B). See TSS_BUDGET_ENTITY in contracts/src/tss.ts.
//
// To build out (future agent):
//   1. Backend (workbookExtractor.ts): add a budgetTable extractor that walks
//      staticContent.sections — anchor-match each section header, read item rows
//      (label col A, amount col B), capture section totals, and emit a structured
//      `entity.budget` payload (sections → items[] + totals + summary rows).
//      Add "budgetTable" to SUPPORTED_RENDER_KINDS.
//   2. Extend the contract: type `entity.budget` (currently z.unknown()).
//   3. Frontend: implement BudgetTable here — grouped sections with item/amount
//      rows, section subtotals, and the Income Remaining summary — then route
//      section === "budget" / renderKind "budgetTable" to it in
//      WorkbookStructuredView. Currency display via the "currency" dataType.
//
// See docs/active-projects.local/google-integrations/WORKBOOK_SYSTEM.md.

import React from "react";
import type { tss as TssNS } from "@hdb/contracts";

/**
 * Placeholder for the budget renderer. Budget extraction is not implemented yet
 * (budgetTable is unsupported in the extractor), so this is not wired into
 * WorkbookStructuredView — it renders nothing meaningful until the backend
 * emits a structured `entity.budget` payload.
 */
export function BudgetTable(_props: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
      Budget view coming soon — open the Sheet view for the budget.
    </div>
  );
}
