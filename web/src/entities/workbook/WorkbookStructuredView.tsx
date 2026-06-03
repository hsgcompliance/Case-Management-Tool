"use client";

// Read-only native render of extracted TSS workbook content (Slice A).
// Supports coverSheet (keyValueCard) + progressNotes (dataTable). Other entities
// report status (unsupported/missing_*) and are shown gently, never as failures.
//
// Presentation is driven by the resolved config (field labels/display) joined to
// the lean extract (fieldId → cell) by fieldId — the extract carries data only.

import React from "react";
import { useWorkbookData } from "@hooks/useWorkbookData";
import { useResolvedTssConfig } from "@hooks/useTssConfig";
import { useGoogleIntegrationConnect } from "@hooks/useGoogleIntegrations";
import { DriveAuthBanner } from "@entities/gdrive/DriveAuthBanner";
import { AddRowForm } from "./AddRowForm";
import type { tss as TssNS } from "@hdb/contracts";

// ── Status pill ────────────────────────────────────────────────────────────────

function StatusNote({ tone, children }: { tone: "slate" | "amber"; children: React.ReactNode }) {
  const cls = tone === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-slate-200 bg-slate-50 text-slate-500";
  return <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{children}</div>;
}

// ── keyValueCard renderer ───────────────────────────────────────────────────

function KeyValueCard({
  entity,
  cfgEntity,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
}) {
  const keyValues = cfgEntity?.source.keyValues ?? [];
  const values = entity.values ?? {};
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {keyValues.map((kv) => {
        const cell = values[kv.id];
        const display = cell?.displayValue ?? (cell?.value != null ? String(cell.value) : "");
        return (
          <div key={kv.id} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kv.label}</div>
            <div className="mt-0.5 truncate text-sm font-medium text-slate-900" title={display}>
              {display || <span className="text-slate-300">—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── dataTable renderer ──────────────────────────────────────────────────────

function DataTable({
  entity,
  cfgEntity,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
}) {
  const fields = cfgEntity?.fields ?? [];
  const rows = entity.rows ?? [];
  // Columns: prefer compactFields ordering when present, else all fields.
  const compact = cfgEntity?.display?.compactFields;
  const columns = compact?.length
    ? fields.filter((f) => compact.includes(f.id))
    : fields.filter((f) => !f.display?.hideInCompact);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((f) => (
              <th key={f.id} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                {f.display?.label ?? f.expected}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowKey} className="border-t border-slate-100 align-top hover:bg-slate-50">
              {columns.map((f) => {
                const cell = row.values[f.id];
                const display = cell?.displayValue ?? (cell?.value != null ? String(cell.value) : "");
                const multiline = f.display?.multiline;
                return (
                  <td
                    key={f.id}
                    className={`px-3 py-2 text-slate-700 ${multiline ? "whitespace-pre-wrap min-w-[200px]" : "whitespace-nowrap"}`}
                  >
                    {display || <span className="text-slate-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── notes-list renderer (progress notes) ────────────────────────────────────
// Long-form entries render far better as stacked cards than as a wide table.

function cellText(row: TssNS.TssExtractedRow, fieldId: string | undefined): string {
  if (!fieldId) return "";
  const cell = row.values[fieldId];
  return cell?.displayValue ?? (cell?.value != null ? String(cell.value) : "");
}

function NotesList({
  entity,
  cfgEntity,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
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
        return (
          <div key={row.rowKey} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{date || "—"}</div>
              {tier ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                  {tier}
                </span>
              ) : null}
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

// ── Per-entity block ─────────────────────────────────────────────────────────

function EntityBlock({
  entity,
  cfgEntity,
  customerId,
  config,
  onSaved,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
  customerId: string;
  config: TssNS.TssWorksheetConfig;
  onSaved: () => void;
}) {
  const [adding, setAdding] = React.useState(false);

  // Append is available for writable dataTable entities that resolved their
  // layout (extracted or empty — both have a known table to append into).
  const canAdd =
    !!cfgEntity &&
    cfgEntity.renderKind === "dataTable" &&
    cfgEntity.direction !== "worksheetToApp" &&
    (entity.status === "extracted" || entity.status === "empty");

  let body: React.ReactNode;

  switch (entity.status) {
    case "unsupported":
      body = <StatusNote tone="slate">Open the Sheet view to see this section.</StatusNote>;
      break;
    case "missing_sheet":
      body = <StatusNote tone="amber">This sheet wasn’t found in the workbook.</StatusNote>;
      break;
    case "missing_headers":
      body = <StatusNote tone="amber">Couldn’t locate this section’s columns in the sheet.</StatusNote>;
      break;
    case "error":
      body = <StatusNote tone="amber">Couldn’t read this section.</StatusNote>;
      break;
    case "empty":
      body = <StatusNote tone="slate">No entries yet.</StatusNote>;
      break;
    case "extracted":
      body = entity.renderKind === "keyValueCard"
        ? <KeyValueCard entity={entity} cfgEntity={cfgEntity} />
        : entity.renderKind === "dataTable"
          ? (entity.section === "notes"
              ? <NotesList entity={entity} cfgEntity={cfgEntity} />
              : <DataTable entity={entity} cfgEntity={cfgEntity} />)
          : <StatusNote tone="slate">Open the Sheet view to see this section.</StatusNote>;
      break;
    default:
      body = null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entity.label}</h5>
        {canAdd && !adding ? (
          <button
            type="button"
            className="rounded-md px-2 py-0.5 text-xs font-medium text-sky-600 hover:bg-sky-50"
            onClick={() => setAdding(true)}
          >
            + Add
          </button>
        ) : null}
      </div>
      {body}
      {canAdd && adding && cfgEntity ? (
        <AddRowForm
          customerId={customerId}
          entityId={entity.entityId}
          cfgEntity={cfgEntity}
          config={config}
          onSaved={() => { setAdding(false); onSaved(); }}
          onCancel={() => setAdding(false)}
        />
      ) : null}
    </section>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function WorkbookStructuredView({
  customerId,
  onOpenSheet,
}: {
  customerId: string;
  /** Switch back to the iframe/Sheet view (used as the fallback affordance). */
  onOpenSheet?: () => void;
}) {
  const dataQ = useWorkbookData(customerId);
  const { config } = useResolvedTssConfig();
  const driveConnect = useGoogleIntegrationConnect("googleDrive");

  if (dataQ.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        Reading workbook…
      </div>
    );
  }

  const result = dataQ.data;
  const issue = result?.issue ?? null;
  const extract = result?.extract ?? null;

  // Auth / scope / not-linked → banner + keep Sheet view available.
  if (issue) {
    return (
      <div className="space-y-3">
        <DriveAuthBanner
          issue={issue}
          onReauthorize={() => void driveConnect.mutateAsync().catch(() => null)}
          reauthorizing={driveConnect.isPending}
        />
        {onOpenSheet ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSheet}>
            View the sheet instead
          </button>
        ) : null}
      </div>
    );
  }

  if (!extract) return null;

  const cfgById = new Map(Object.values(config.entities).map((e) => [e.id, e]));
  // Section order: cover → notes → others (config section grouping is enough for slice A).
  const ordered = [...extract.entities].sort((a, b) => {
    const rank = (s: string) => (s === "cover" ? 0 : s === "notes" ? 1 : s === "housingPlan" ? 2 : 3);
    return rank(a.section) - rank(b.section);
  });

  return (
    <div className="space-y-5">
      {ordered.map((entity) => (
        <EntityBlock
          key={entity.entityId}
          entity={entity}
          cfgEntity={cfgById.get(entity.entityId)}
          customerId={customerId}
          config={config}
          onSaved={() => void dataQ.refetch()}
        />
      ))}

      <div className="flex items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        <span>
          Read from the sheet {new Date(extract.extractedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </span>
        <button
          type="button"
          className="text-sky-600 underline hover:text-sky-800"
          onClick={() => void dataQ.refetch()}
          disabled={dataQ.isFetching}
        >
          {dataQ.isFetching ? "Refreshing…" : "Refresh from Sheet"}
        </button>
      </div>
    </div>
  );
}
