"use client";

import React from "react";
import FullPageModal from "@entities/ui/FullPageModal";
import { buildCsv, downloadCsv, type ExportColumn } from "@entities/ui/dashboardStyle/SmartExportButton";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";
import { toast } from "@lib/toast";
import { createGoogleSheetWithTabs, exportColumnsToValues } from "@entities/export/googleSheets";

export type ReviewExportDialogProps<T> = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  rows: T[];
  columns: ExportColumn<T>[];
  filenameBase: string;
  mainSheetTitle?: string;
  summaryRows?: unknown[][];
  extraCsvFiles?: Array<{ filenameBase: string; csv: string; label: string }>;
  extraSheetTabs?: Array<{ title: string; values: unknown[][] }>;
  onClose: () => void;
};

export function ReviewExportDialog<T>({
  isOpen,
  title,
  subtitle,
  rows,
  columns,
  filenameBase,
  mainSheetTitle = "Findings",
  summaryRows,
  extraCsvFiles,
  extraSheetTabs,
  onClose,
}: ReviewExportDialogProps<T>) {
  const [exportingSheet, setExportingSheet] = React.useState(false);
  const csv = React.useMemo(() => buildCsv(rows, columns), [columns, rows]);

  const download = React.useCallback(() => {
    downloadCsv(csv, filenameBase);
    for (const file of extraCsvFiles ?? []) downloadCsv(file.csv, file.filenameBase);
    toast(`Downloaded ${rows.length} export rows`, { type: "success" });
  }, [csv, extraCsvFiles, filenameBase, rows.length]);

  const exportSheet = React.useCallback(async () => {
    const accessToken = getGoogleDriveAccessToken();
    if (!accessToken) {
      toast("Connect temporary Google Drive access in Settings before exporting to Sheets.", { type: "warning" });
      return;
    }
    setExportingSheet(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const tabs = [
        { title: mainSheetTitle, values: exportColumnsToValues(rows, columns) },
        ...(extraSheetTabs ?? []),
        ...(summaryRows?.length ? [{ title: "Summary", values: summaryRows }] : []),
      ];
      const result = await createGoogleSheetWithTabs({
        accessToken,
        title: `${title} ${stamp}`,
        tabs,
      });
      window.open(result.spreadsheetUrl, "_blank", "noopener,noreferrer");
      toast("Created Google Sheet export", { type: "success" });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Could not export to Google Sheets.", { type: "error" });
    } finally {
      setExportingSheet(false);
    }
  }, [columns, extraSheetTabs, mainSheetTitle, rows, summaryRows, title]);

  return (
    <FullPageModal
      isOpen={isOpen}
      onClose={onClose}
      leftWidthClass="w-[320px]"
      topBar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-600">Export</div>
            <div className="text-xl font-semibold text-slate-950">{title}</div>
            {subtitle ? <div className="text-sm text-slate-500">{subtitle}</div> : null}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      }
      leftPane={
        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rows</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{rows.length}</div>
            <div className="text-sm text-slate-500">Current export set</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            CSV exports stay local. Google Sheets export requires the existing temporary Drive access path and opens the created Sheet in a new tab.
            {extraCsvFiles?.length ? ` This export downloads ${extraCsvFiles.length + 1} CSV files.` : ""}
          </div>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto bg-slate-50 p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="text-lg font-semibold text-slate-950">CSV</div>
              <p className="mt-1 text-sm text-slate-500">
                Download local CSV file{extraCsvFiles?.length ? "s" : ""} for audit review, filtering, or upload into another workbook.
              </p>
              <button type="button" className="btn btn-primary btn-sm mt-4" onClick={download} disabled={!rows.length}>
                {extraCsvFiles?.length ? `Download ${extraCsvFiles.length + 1} CSVs` : "Download CSV"}
              </button>
              {extraCsvFiles?.length ? (
                <div className="mt-3 text-xs text-slate-500">
                  Includes {extraCsvFiles.map((file) => file.label).join(", ")}.
                </div>
              ) : null}
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="text-lg font-semibold text-slate-950">Google Sheets</div>
              <p className="mt-1 text-sm text-slate-500">Create one workbook in My Drive and open it in a new browser tab.</p>
              <button type="button" className="btn btn-primary btn-sm mt-4" onClick={() => void exportSheet()} disabled={!rows.length || exportingSheet}>
                {exportingSheet ? "Creating Sheet..." : "Export To My Drive"}
              </button>
            </section>
          </div>
          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">Preview</div>
            <div className="max-h-[420px] overflow-auto rounded border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
              <pre>{csv.split(/\r?\n/).slice(0, 12).join("\n")}</pre>
            </div>
          </section>
        </div>
      }
    />
  );
}

export default ReviewExportDialog;
