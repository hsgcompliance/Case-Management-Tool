"use client";

import type { ExportColumn } from "@entities/ui/dashboardStyle/SmartExportButton";

export type GoogleSheetTab = {
  title: string;
  values: unknown[][];
};

function cell(value: unknown) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function exportColumnsToValues<T>(rows: T[], columns: ExportColumn<T>[]) {
  return [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => cell(column.value(row)))),
  ];
}

export async function createGoogleSheetWithTabs(opts: {
  accessToken: string;
  title: string;
  tabs: GoogleSheetTab[];
}) {
  const tabs = opts.tabs.length ? opts.tabs : [{ title: "Export", values: [] }];
  const spreadsheetResp = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: opts.title },
      sheets: tabs.map((tab) => ({ properties: { title: tab.title } })),
    }),
  });
  if (!spreadsheetResp.ok) {
    throw new Error(`Could not create Google Sheet (${spreadsheetResp.status}).`);
  }
  const spreadsheet = await spreadsheetResp.json() as { spreadsheetId?: string; spreadsheetUrl?: string };
  if (!spreadsheet.spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet id.");

  const valueResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: tabs.map((tab) => ({ range: `${tab.title}!A1`, values: tab.values })),
    }),
  });
  if (!valueResp.ok) {
    throw new Error(`Could not write Google Sheet values (${valueResp.status}).`);
  }
  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    spreadsheetUrl: spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`,
  };
}
