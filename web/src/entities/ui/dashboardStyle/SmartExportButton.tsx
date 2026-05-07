"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import { toISODate } from "@lib/date";

export type ExportColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => unknown;
};

type ExportScope = "all" | "active";

export interface SmartExportButtonProps<T> {
  allRows: T[];
  activeRows?: T[];
  columns: ExportColumn<T>[];
  filenameBase: string;
  buttonLabel?: string;
  className?: string;
}

function toCsvCell(value: unknown): string {
  if (value == null) return "";
  let raw = "";
  if (Array.isArray(value)) raw = value.join("; ");
  else if (typeof value === "object") raw = JSON.stringify(value);
  else raw = String(value);

  if (/["\r\n,]/.test(raw)) return `"${raw.replace(/"/g, "\"\"")}"`;
  return raw;
}

export function buildCsv<T>(rows: T[], columns: ExportColumn<T>[]) {
  const header = columns.map((c) => toCsvCell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => toCsvCell(c.value(row))).join(",")).join("\r\n");
  return `${header}\r\n${body}`;
}

export function downloadCsv(contents: string, filenameBase: string) {
  const safeBase = filenameBase.trim() || "export";
  const stamp = toISODate(new Date());
  const blob = new Blob(["\uFEFF", contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeBase}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SmartExportButton<T>({
  allRows,
  activeRows,
  columns,
  filenameBase,
  buttonLabel = "Export",
  className,
}: SmartExportButtonProps<T>) {
  const [open, setOpen] = React.useState(false);
  const active = activeRows ?? allRows;
  const [scope, setScope] = React.useState<ExportScope>("all");
  const rowsToExport = scope === "active" ? active : allRows;
  const noRows = rowsToExport.length === 0;

  return (
    <>
      <button type="button" className={className || "btn btn-ghost"} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Export Table"
        widthClass="max-w-lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn"
              disabled={noRows}
              onClick={() => {
                const csv = buildCsv(rowsToExport, columns);
                downloadCsv(csv, filenameBase);
                setOpen(false);
              }}
            >
              Download CSV
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="rounded border border-slate-200 p-3">
            <div className="font-medium text-slate-900">Rows to export</div>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="export-scope" checked={scope === "all"} onChange={() => setScope("all")} />
                <span>All Data ({allRows.length})</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="export-scope" checked={scope === "active"} onChange={() => setScope("active")} />
                <span>Active Filters ({active.length})</span>
              </label>
            </div>
          </div>
          <div className="text-xs text-slate-600">Exports include all configured columns and are downloaded as CSV.</div>
        </div>
      </Modal>
    </>
  );
}

export default SmartExportButton;
