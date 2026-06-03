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

// ── Per-entity block ─────────────────────────────────────────────────────────

function EntityBlock({
  entity,
  cfgEntity,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
}) {
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
          ? <DataTable entity={entity} cfgEntity={cfgEntity} />
          : <StatusNote tone="slate">Open the Sheet view to see this section.</StatusNote>;
      break;
    default:
      body = null;
  }

  return (
    <section className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entity.label}</h5>
      {body}
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
        <EntityBlock key={entity.entityId} entity={entity} cfgEntity={cfgById.get(entity.entityId)} />
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
