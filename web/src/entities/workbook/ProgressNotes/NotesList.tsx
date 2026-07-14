"use client";

// Progress-notes renderer. Long-form entries render as stacked cards rather than
// a wide table. Handles STACKED multi-variant sections: note rows + status-change
// banners are merged and ordered by sheet row, so payer ↔ non-payer transitions
// show an inline divider exactly where the sheet switches layouts.
//
// Presentation is config-driven: field roles (date / tier / summary / response)
// are derived from the resolved config, not hardcoded ids, so it adapts to both
// payer (full columns) and non-payer (simplified columns) sections.

import React from "react";
import { cellText } from "../shared";
import type { tss as TssNS } from "@hdb/contracts";

export function NotesList({
  entity,
  cfgEntity,
  onDeleteRow,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
  onDeleteRow?: (row: TssNS.TssExtractedRow, fingerprint: { date?: string; startTime?: string; endTime?: string; summary?: string }) => void;
}) {
  const fields = cfgEntity?.fields ?? [];
  const byId = (pred: (f: TssNS.TssSmartHeaderConfig) => boolean) => fields.find(pred)?.id;

  // Identify roles from the config rather than hardcoding ids.
  const dateId    = byId((f) => f.dataType === "date");
  const tierId    = byId((f) => f.optionSourceId === "serviceTier" || /tier/i.test(f.id));
  const summaryId = byId((f) => f.id === "summary") ?? byId((f) => f.dataType === "longText");
  const responseId = byId((f) => /response|progress/i.test(f.id) && f.id !== summaryId);

  // Remaining fields become a compact meta footer (label: value), excluding
  // the ones already shown and any empty values.
  const shown = new Set([dateId, tierId, summaryId, responseId].filter(Boolean) as string[]);
  const metaFields = fields.filter((f) => !shown.has(f.id) && f.dataType !== "computed");

  const labelOf = (id?: string) => fields.find((f) => f.id === id)?.display?.label
    ?? fields.find((f) => f.id === id)?.expected ?? "";

  // Merge note rows + status-change banners, ordered by sheet row (rowKey),
  // so stacked variant sections stay in order with their dividers inline.
  const sheetRow = (rowKey: string) => Number(/row-(\d+)/.exec(rowKey)?.[1] ?? 0);
  type Item =
    | { kind: "note"; sortRow: number; row: TssNS.TssExtractedRow }
    | { kind: "break"; sortRow: number; text: string; key: string };
  const items: Item[] = [
    ...(entity.rows ?? []).map((row) => ({ kind: "note" as const, sortRow: sheetRow(row.rowKey), row })),
    ...(entity.sectionBreaks ?? []).map((b) => ({ kind: "break" as const, sortRow: sheetRow(b.rowKey), text: b.text, key: b.rowKey })),
  ].sort((a, b) => a.sortRow - b.sortRow);

  return (
    <div className="space-y-2">
      {items.map((item) => {
        if (item.kind === "break") {
          return (
            <div key={item.key} className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-amber-200" />
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                {item.text}
              </span>
              <div className="h-px flex-1 bg-amber-200" />
            </div>
          );
        }
        const { row } = item;
        const date = cellText(row, dateId);
        const tier = cellText(row, tierId);
        const summary = cellText(row, summaryId);
        const response = cellText(row, responseId);
        const startTime = cellText(row, "startTime");
        const endTime = cellText(row, "endTime");
        return (
          <div key={row.rowKey} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{date || "—"}</div>
              <div className="flex items-center gap-2">
                {tier ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                    {tier}
                  </span>
                ) : null}
                {onDeleteRow ? (
                  <button
                    type="button"
                    className="rounded-md px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    onClick={() => onDeleteRow(row, { date, startTime, endTime, summary })}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
            {summary ? (
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{summary}</p>
            ) : null}
            {response ? (
              <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-500">
                <span className="font-medium text-slate-600">{labelOf(responseId)}: </span>{response}
              </p>
            ) : null}
            {metaFields.length ? (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                {metaFields.map((f) => {
                  const v = cellText(row, f.id);
                  if (!v) return null;
                  return (
                    <span key={f.id}>
                      <span className="text-slate-500">{f.display?.label ?? f.expected}:</span> {v}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
