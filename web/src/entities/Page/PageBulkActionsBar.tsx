"use client";

import React from "react";

type PageBulkActionsBarProps = {
  selectedCount: number;
  noun?: string;
  statusText?: React.ReactNode;
  onClear?: () => void;
  children?: React.ReactNode;
  className?: string;
};

export function PageBulkActionsBar({
  selectedCount,
  noun = "item",
  statusText,
  onClear,
  children,
  className = "",
}: PageBulkActionsBarProps) {
  const label = `${selectedCount} selected ${noun}${selectedCount === 1 ? "" : "s"}`;

  return (
    <div
      className={[
        "rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 shadow-sm backdrop-blur-sm",
        className,
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Bulk Actions
          </div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          {statusText ? <div className="mt-1 text-xs text-slate-600">{statusText}</div> : null}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          {children}
          {onClear ? (
            <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={onClear}>
              Clear Selection
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PageBulkActionsBar;
