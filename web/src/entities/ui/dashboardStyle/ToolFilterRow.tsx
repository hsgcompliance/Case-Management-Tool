"use client";

/**
 * ToolFilterRow
 *
 * Compact single-line filter strip for use inside DashboardTool ToolTopbar components.
 * No sticky/floating behavior — designed for the inline topbar slot.
 *
 * Usage inside a DashboardToolDefinition.ToolTopbar:
 *   <ToolFilterRow resultLabel={`${count} results`} actions={<ExportButton />}>
 *     <FilterToggleGroup label="Status" value={...} options={...} onChange={...} />
 *     <CaseManagerSelect ... />
 *   </ToolFilterRow>
 */
import React from "react";

export interface ToolFilterRowProps {
  /** Filter controls — FilterToggleGroup, selects, date pickers, etc. */
  children?: React.ReactNode;
  /** Count / summary shown at the right end of the filter area */
  resultLabel?: string;
  /** Action buttons at the far right (Export, Clear, New, etc.) */
  actions?: React.ReactNode;
  className?: string;
}

export function ToolFilterRow({ children, resultLabel, actions, className }: ToolFilterRowProps) {
  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3 px-3 py-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Filter controls — grow to fill available space */}
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {children}
      </div>

      {resultLabel ? (
        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
          {resultLabel}
        </span>
      ) : null}

      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </div>
  );
}

export default ToolFilterRow;
