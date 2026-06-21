"use client";

import React from "react";
import {
  collectReportGrantSignals,
  defaultExcludeRulesForProfile,
  deriveHeadersAndRows,
  filterReportRows,
  matchProfileHeaders,
  normalizeExcludeRules,
  normalizeReportRow,
  type FieldColumnOverrides,
  type ReconciliationPacket,
  type ReportExcludeOperator,
  type ReportExcludeRule,
  type ReportSourceProfile,
} from "@features/report-reconciliation/reportProfiles";
import {
  DEFAULT_FE_REFERENCE_PATTERNS,
  likelyBetterTool,
  parseFinancialEdgeReference,
} from "@features/report-reconciliation/reportParsingEngines";
import { rowsToCsv } from "@features/report-reconciliation/reportFilePreview";

/**
 * Reusable report upload + mapping-config entity.
 *
 * Presentational and prop-driven so it can be reused/fine-tuned independently of
 * any one reconciliation tool. It exposes two tabs:
 *  - "Upload": an always-visible drag-and-drop zone + the list of parsed reports.
 *  - "Configure": live mapping controls (report type, header row, field→column,
 *    and a parsed/matched grants table). Edits flow back through `onUpdateConfig`
 *    and re-map the packet live — there is no separate confirm step.
 */

export type ReportUploadConfig = {
  profileId: string;
  headerRowIndex: number;
  fieldOverrides: FieldColumnOverrides;
  excludeRules: ReportExcludeRule[];
  manualGrantSignals: string[];
};

export type ReportUpload = {
  id: string;
  fileName: string;
  sheetName?: string;
  workbookKey?: string;
  enabled?: boolean;
  sheetRole?: "data" | "helper";
  sheetReason?: string;
  /** Auto-detected report variant label (e.g. Caseworthy account-detail vs org-total). */
  reportVariant?: string;
  /** Parameter-block metadata captured from envelope reports (account/grant, date range, org…). */
  reportMetadata?: Record<string, string>;
  allRows: unknown[][];
  profileCandidates: { profile: ReportSourceProfile; score: number }[];
  config: ReportUploadConfig;
  packet: ReconciliationPacket;
};

export type ReportUploadGrant = { id: string; name: string };

export type ReportUploadPanelProps = {
  uploads: ReportUpload[];
  profiles: ReportSourceProfile[];
  grants: ReportUploadGrant[];
  reading: boolean;
  error: string | null;
  onFiles: (files: FileList | File[] | null) => void;
  onUpdateConfig: (id: string, patch: Partial<ReportUploadConfig>) => void;
  onApplyConfigToWorkbook?: (id: string) => void;
  onSetUploadEnabled?: (id: string, enabled: boolean) => void;
  onSetWorkbookEnabled?: (workbookKey: string, enabledIds: Set<string>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  toolKind?: "enrollment" | "payment" | "identity";
  databaseConfig?: React.ReactNode;
};

const ACCEPT = ".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const norm = (value: unknown) =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const wordTokens = (value: unknown) => norm(value).split(" ").filter((token) => token.length >= 3);

function matchGrant(value: string, grants: ReportUploadGrant[]): ReportUploadGrant | null {
  const v = norm(value);
  if (!v) return null;
  const vTokens = wordTokens(value);
  let best: ReportUploadGrant | null = null;
  let bestScore = 0;
  for (const grant of grants) {
    const n = norm(grant.name);
    if (!n) continue;
    let score = 0;
    if (n === v) score = 100;
    else if (n.includes(v) || v.includes(n)) score = 70;
    else {
      const grantTokens = wordTokens(grant.name);
      score = vTokens.filter((token) => grantTokens.includes(token)).length * 25;
    }
    if (score > bestScore) {
      bestScore = score;
      best = grant;
    }
  }
  return bestScore >= 25 ? best : null;
}

function reportGrantRows(upload: ReportUpload, grants: ReportUploadGrant[]): { value: string; match: ReportUploadGrant | null; manual?: boolean }[] {
  const signals = collectReportGrantSignals(upload.packet);
  const manualSignals = (upload.config.manualGrantSignals ?? []).map((value) => value.trim()).filter(Boolean);
  if (signals.length) {
    const rows: { value: string; match: ReportUploadGrant | null; manual?: boolean }[] = signals.map((value) => ({ value, match: matchGrant(value, grants) }));
    rows.push(...manualSignals.map((value) => ({ value, match: matchGrant(value, grants), manual: true })));
    return rows;
  }
  // Financial Edge and workbook sheets often carry the grant in file/sheet/title context.
  const seen = new Set<string>();
  const rows: { value: string; match: ReportUploadGrant | null; manual?: boolean }[] = manualSignals.map((value) => ({ value, match: matchGrant(value, grants), manual: true }));
  const context = [
    upload.fileName,
    upload.sheetName || "",
    ...upload.allRows.slice(0, 3).map((row) => row.map((value) => String(value ?? "")).filter(Boolean).join(" ")),
  ].join(" ");
  for (const grant of grants) {
    if (wordTokens(grant.name).some((token) => norm(context).includes(token))) {
      if (seen.has(grant.id)) continue;
      seen.add(grant.id);
      rows.push({ value: context, match: grant });
    }
  }
  return rows;
}

function downloadRowsAsCsv(upload: ReportUpload) {
  const csv = rowsToCsv(upload.allRows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const baseName = `${upload.fileName.replace(/\.[^.]+$/, "")}-${upload.sheetName || "sheet"}`
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseName || "report-sheet"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Dropzone({ reading, onFiles }: { reading: boolean; onFiles: ReportUploadPanelProps["onFiles"] }) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        onFiles(event.dataTransfer?.files ?? null);
      }}
      className={[
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-7 text-center transition",
        dragOver
          ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
          : "border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/40",
      ].join(" ")}
    >
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {reading ? "Reading file…" : "Drag & drop reports here"}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        or <span className="font-semibold text-sky-600 dark:text-sky-400">click to browse</span> — CSV, TXT, or XLSX
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        multiple
        accept={ACCEPT}
        onChange={(event) => {
          onFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function UploadsList({
  uploads,
  selectedId,
  onConfigure,
  onRemove,
  onClear,
}: {
  uploads: ReportUpload[];
  selectedId: string;
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!uploads.length) {
    return <div className="mt-3 text-center text-xs text-slate-400">No reports uploaded yet.</div>;
  }
  const enabledCount = uploads.filter((upload) => upload.enabled !== false).length;
  const dataSheetCount = uploads.filter((upload) => upload.enabled !== false && upload.sheetRole !== "helper").length;
  const requiredMissingCount = uploads.reduce((total, upload) => total + (upload.enabled === false ? 0 : upload.packet.summary.requiredMissingCount), 0);
  const helperCount = uploads.filter((upload) => upload.sheetRole === "helper").length;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded reports ({uploads.length})</div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{enabledCount} enabled</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{dataSheetCount} data sheets</span>
            {helperCount ? <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{helperCount} helper/skipped</span> : null}
            {requiredMissingCount ? (
              <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800">{requiredMissingCount} required mappings missing</span>
            ) : (
              <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-700">required mappings ready</span>
            )}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onClear}>Clear all</button>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
        {uploads.map((upload) => {
          const profile = upload.profileCandidates[0]?.profile;
          const requiredMissing = upload.packet.summary.requiredMissingCount;
          const label = upload.sheetName || upload.fileName;
          const active = upload.id === selectedId;
          return (
            <div
              key={upload.id}
              className={[
                "group mb-[-1px] flex max-w-[260px] items-center gap-2 rounded-t-md border px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-900",
                active
                  ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-900"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
              ].join(" ")}
              title={`${upload.fileName}${upload.sheetName ? ` / ${upload.sheetName}` : ""}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onConfigure(upload.id)}
              >
                <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                <span className="block truncate text-slate-500">
                  {upload.enabled === false ? "Skipped" : (upload.packet.profileLabel || profile?.label || "Unknown type")} - {upload.packet.summary.totalRows} rows
                  {requiredMissing ? <span className="ml-1 text-amber-600">- {requiredMissing} required unmapped</span> : null}
                </span>
              </button>
              <button
                type="button"
                className="rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={() => onRemove(upload.id)}
                aria-label={`Remove ${label}`}
              >
                x
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderRowPicker({
  allRows,
  headerRowIndex,
  onChange,
}: {
  allRows: unknown[][];
  headerRowIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Header row</div>
      <div className="space-y-1">
        {allRows.slice(0, 8).map((row, index) => {
          const active = index === headerRowIndex;
          const text = (Array.isArray(row) ? row : []).map((value) => String(value ?? "").trim()).filter(Boolean).join(" · ");
          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange(index)}
              className={[
                "flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-xs",
                active
                  ? "border-sky-500 bg-sky-50 text-sky-900 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-300",
              ].join(" ")}
            >
              <span className="shrink-0 rounded bg-slate-200 px-1 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{index + 1}</span>
              <span className="truncate">{text || <span className="italic text-slate-400">(blank row)</span>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EXCLUDE_OPERATOR_LABELS: Record<ReportExcludeOperator, string> = {
  contains: "contains",
  not_contains: "does not contain",
  equals: "equals",
  not_equals: "does not equal",
  regex: "matches regex",
  not_regex: "does not match regex",
  is_blank: "is blank",
  is_not_blank: "is not blank",
  amount_zero_or_blank: "amount is blank or $0",
};

const EXCLUDE_OPERATORS = Object.keys(EXCLUDE_OPERATOR_LABELS) as ReportExcludeOperator[];

function ExcludeRulesEditor({
  profile,
  rules,
  onChange,
}: {
  profile: ReportSourceProfile;
  rules: ReportExcludeRule[];
  onChange: (rules: ReportExcludeRule[]) => void;
}) {
  const normalizedRules = normalizeExcludeRules(rules, defaultExcludeRulesForProfile(profile));
  const updateRule = (index: number, patch: Partial<ReportExcludeRule>) => {
    onChange(normalizedRules.map((rule, i) => i === index ? { ...rule, ...patch } : rule));
  };
  const addRule = () => {
    const firstField = Object.keys(profile.fields)[0] || "amount";
    onChange([
      ...normalizedRules,
      {
        id: `custom_exclude_${Date.now()}`,
        label: "Custom exclude",
        fieldKey: firstField,
        operator: "contains",
        value: "",
        enabled: true,
      },
    ]);
  };
  const fieldKeys = Object.keys(profile.fields);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exclude filters</div>
          <div className="text-[11px] text-slate-500">Rows matching any enabled rule are removed before reconciliation.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange(defaultExcludeRulesForProfile(profile))}>Reset defaults</button>
          <button type="button" className="btn btn-primary btn-xs" onClick={addRule}>Add filter</button>
        </div>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
        {normalizedRules.length ? normalizedRules.map((rule, index) => {
          const needsValue = !["is_blank", "is_not_blank", "amount_zero_or_blank"].includes(rule.operator);
          return (
            <div key={rule.id} className="grid gap-2 rounded border border-slate-200 p-2 text-xs dark:border-slate-800 lg:grid-cols-[auto_minmax(120px,1fr)_minmax(120px,1fr)_minmax(130px,1fr)_minmax(140px,1.2fr)_70px_auto]">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={rule.enabled !== false}
                  onChange={(event) => updateRule(index, { enabled: event.currentTarget.checked })}
                />
                <span>on</span>
              </label>
              <input
                className="input h-8 px-2 text-xs"
                value={rule.label}
                onChange={(event) => updateRule(index, { label: event.currentTarget.value })}
                aria-label="Filter label"
              />
              <select
                className="input h-8 px-2 text-xs"
                value={rule.fieldKey}
                onChange={(event) => updateRule(index, { fieldKey: event.currentTarget.value })}
              >
                {fieldKeys.map((fieldKey) => <option key={fieldKey} value={fieldKey}>{fieldKey}</option>)}
              </select>
              <select
                className="input h-8 px-2 text-xs"
                value={rule.operator}
                onChange={(event) => updateRule(index, { operator: event.currentTarget.value as ReportExcludeOperator })}
              >
                {EXCLUDE_OPERATORS.map((operator) => <option key={operator} value={operator}>{EXCLUDE_OPERATOR_LABELS[operator]}</option>)}
              </select>
              <input
                className="input h-8 px-2 text-xs"
                value={rule.value || ""}
                disabled={!needsValue}
                onChange={(event) => updateRule(index, { value: event.currentTarget.value })}
                placeholder={rule.operator.includes("regex") ? "regex pattern" : "value"}
              />
              <input
                className="input h-8 px-2 text-xs"
                value={rule.flags || ""}
                disabled={!rule.operator.includes("regex")}
                onChange={(event) => updateRule(index, { flags: event.currentTarget.value })}
                placeholder="flags"
              />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange(normalizedRules.filter((_, i) => i !== index))}>
                Remove
              </button>
            </div>
          );
        }) : (
          <div className="text-center text-[11px] text-slate-400">No exclude filters configured.</div>
        )}
      </div>
    </div>
  );
}

function AdvancedConfigPreview({
  upload,
  profile,
  headers,
  dataRows,
  rules,
  onClose,
}: {
  upload: ReportUpload;
  profile: ReportSourceProfile;
  headers: string[];
  dataRows: unknown[][];
  rules: ReportExcludeRule[];
  onClose: () => void;
}) {
  const [rowMode, setRowMode] = React.useState<"included" | "excluded">("included");
  const [viewMode, setViewMode] = React.useState<"raw" | "normalized">("raw");
  const filtered = React.useMemo(() => filterReportRows({
    profile,
    headers,
    rows: dataRows,
    headerRowIndex: upload.config.headerRowIndex,
    fieldOverrides: upload.config.fieldOverrides,
    excludeRules: rules,
  }), [dataRows, headers, profile, rules, upload.config.fieldOverrides, upload.config.headerRowIndex]);
  const visibleRows = (rowMode === "included" ? filtered.included : filtered.excluded).slice(0, 200);
  const normalizedRows = React.useMemo(() => visibleRows.map((row) => normalizeReportRow(profile, headers, row.row, {
    sourceFile: upload.fileName,
    sourceRowNumber: row.sourceRowNumber,
    sourceType: profile.id,
    sourceGrant: [...(upload.config.manualGrantSignals ?? []), upload.sheetName ? `${upload.fileName} / ${upload.sheetName}` : upload.fileName].filter(Boolean).join(" | "),
  }, upload.config.fieldOverrides)), [headers, profile, upload.config.fieldOverrides, upload.config.manualGrantSignals, upload.fileName, upload.sheetName, visibleRows]);
  const rawHeaders = headers.slice(0, 14);
  const normalizedHeaders = ["Row", "Name", "Client ID", "Date", "Amount", "Grant/Provider", "Reference", "Exclude reason"];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3 dark:border-slate-800">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Advanced config preview</div>
            <div className="truncate text-xs text-slate-500">{upload.fileName}{upload.sheetName ? ` / ${upload.sheetName}` : ""} - {profile.label}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3 text-xs dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={["btn btn-xs", rowMode === "included" ? "btn-primary" : "btn-ghost"].join(" ")} onClick={() => setRowMode("included")}>
              Included ({filtered.included.length})
            </button>
            <button type="button" className={["btn btn-xs", rowMode === "excluded" ? "btn-primary" : "btn-ghost"].join(" ")} onClick={() => setRowMode("excluded")}>
              Excluded ({filtered.excluded.length})
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={["btn btn-xs", viewMode === "raw" ? "btn-primary" : "btn-ghost"].join(" ")} onClick={() => setViewMode("raw")}>Raw upload rows</button>
            <button type="button" className={["btn btn-xs", viewMode === "normalized" ? "btn-primary" : "btn-ghost"].join(" ")} onClick={() => setViewMode("normalized")}>Normalized mapping rows</button>
          </div>
        </div>
        <div className="overflow-auto p-3">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                {(viewMode === "raw" ? ["Row", ...rawHeaders, "Exclude reason"] : normalizedHeaders).map((header) => (
                  <th key={header} className="border border-slate-200 px-2 py-1 dark:border-slate-800">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? visibleRows.map((filterRow, index) => {
                const normalized = normalizedRows[index];
                return (
                  <tr key={`${filterRow.sourceRowNumber}-${index}`} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-950 dark:even:bg-slate-900/50">
                    {viewMode === "raw" ? (
                      <>
                        <td className="border border-slate-200 px-2 py-1 font-mono text-[11px] dark:border-slate-800">{filterRow.sourceRowNumber}</td>
                        {rawHeaders.map((header, headerIndex) => (
                          <td key={`${header}-${headerIndex}`} className="max-w-[220px] truncate border border-slate-200 px-2 py-1 dark:border-slate-800" title={String(filterRow.row[headerIndex] ?? "")}>
                            {String(filterRow.row[headerIndex] ?? "")}
                          </td>
                        ))}
                        <td className="max-w-[260px] truncate border border-slate-200 px-2 py-1 text-amber-700 dark:border-slate-800" title={filterRow.matchedRuleLabels.join(", ")}>
                          {filterRow.matchedRuleLabels.join(", ")}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border border-slate-200 px-2 py-1 font-mono text-[11px] dark:border-slate-800">{filterRow.sourceRowNumber}</td>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">{normalized.customerIdentity.fullName || `${normalized.customerIdentity.firstName} ${normalized.customerIdentity.lastName}`.trim()}</td>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">{normalized.customerIdentity.hmisId || normalized.customerIdentity.caseworthyId}</td>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">{normalized.paymentEvidence.transactionDate || normalized.enrollmentEvidence.entryDate}</td>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">{normalized.paymentEvidence.amount ?? ""}</td>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">{normalized.paymentEvidence.grant || normalized.enrollmentEvidence.projectName}</td>
                        <td className="border border-slate-200 px-2 py-1 dark:border-slate-800">{normalized.paymentEvidence.reference}</td>
                        <td className="border border-slate-200 px-2 py-1 text-amber-700 dark:border-slate-800">{filterRow.matchedRuleLabels.join(", ")}</td>
                      </>
                    )}
                  </tr>
                );
              }) : (
                <tr>
                  <td className="border border-slate-200 px-3 py-8 text-center text-slate-400 dark:border-slate-800" colSpan={viewMode === "raw" ? rawHeaders.length + 2 : normalizedHeaders.length}>
                    No rows in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {visibleRows.length >= 200 ? <div className="mt-2 text-[11px] text-slate-500">Showing first 200 rows.</div> : null}
        </div>
      </div>
    </div>
  );
}

function WorkbookSheetSelector({
  uploads,
  selected,
  onSelect,
  onSetUploadEnabled,
  onSetWorkbookEnabled,
}: {
  uploads: ReportUpload[];
  selected: ReportUpload;
  onSelect: (id: string) => void;
  onSetUploadEnabled?: ReportUploadPanelProps["onSetUploadEnabled"];
  onSetWorkbookEnabled?: ReportUploadPanelProps["onSetWorkbookEnabled"];
}) {
  if (!selected.workbookKey) return null;
  const workbookSheets = uploads.filter((upload) => upload.workbookKey === selected.workbookKey);
  if (workbookSheets.length <= 1) return null;
  const enabledCount = workbookSheets.filter((upload) => upload.enabled !== false).length;
  const recommendedIds = new Set(workbookSheets.filter((upload) => upload.sheetRole !== "helper").map((upload) => upload.id));
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workbook sheets</div>
          <div className="text-[11px] text-slate-500">{enabledCount} of {workbookSheets.length} selected for reconciliation</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onSetWorkbookEnabled?.(selected.workbookKey || "", new Set(workbookSheets.map((upload) => upload.id)))}>
            Select all
          </button>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onSetWorkbookEnabled?.(selected.workbookKey || "", recommendedIds)}>
            Select detected data
          </button>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onSetWorkbookEnabled?.(selected.workbookKey || "", new Set())}>
            Select none
          </button>
        </div>
      </div>
      <div className="grid max-h-44 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {workbookSheets.map((upload) => (
          <div
            key={upload.id}
            className={[
              "flex min-w-0 items-start gap-2 rounded border bg-white px-2 py-1 text-xs dark:bg-slate-950",
              upload.id === selected.id ? "border-sky-400" : "border-slate-200 dark:border-slate-800",
            ].join(" ")}
            title={upload.sheetReason}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              aria-label={`Include ${upload.sheetName || upload.fileName} in reconciliation`}
              checked={upload.enabled !== false}
              onChange={(event) => onSetUploadEnabled?.(upload.id, event.currentTarget.checked)}
            />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(upload.id)}>
              <span className="block truncate font-medium text-slate-700 dark:text-slate-200">{upload.sheetName || upload.fileName}</span>
              <span className="block truncate text-[11px] text-slate-500">{upload.sheetRole === "helper" ? "helper" : "data"} - {upload.packet.summary.totalRows} rows</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigureTab({
  uploads,
  profiles,
  grants,
  selectedId,
  onSelect,
  onUpdateConfig,
  onApplyConfigToWorkbook,
  onSetUploadEnabled,
  onSetWorkbookEnabled,
  toolKind,
}: {
  uploads: ReportUpload[];
  profiles: ReportSourceProfile[];
  grants: ReportUploadGrant[];
  selectedId: string;
  onSelect: (id: string) => void;
  onUpdateConfig: ReportUploadPanelProps["onUpdateConfig"];
  onApplyConfigToWorkbook?: ReportUploadPanelProps["onApplyConfigToWorkbook"];
  onSetUploadEnabled?: ReportUploadPanelProps["onSetUploadEnabled"];
  onSetWorkbookEnabled?: ReportUploadPanelProps["onSetWorkbookEnabled"];
  toolKind?: ReportUploadPanelProps["toolKind"];
}) {
  const [sheetPage, setSheetPage] = React.useState(0);
  const [configTool, setConfigTool] = React.useState<"header" | "fields" | "grants" | "excludes">("fields");
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [manualGrantDraft, setManualGrantDraft] = React.useState("");
  const selected = uploads.find((upload) => upload.id === selectedId) ?? uploads[0] ?? null;
  if (!selected) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">Upload a report to configure its mapping.</div>;
  }

  const profile = profiles.find((item) => item.id === selected.config.profileId) ?? profiles[0];
  const { headers, dataRows } = deriveHeadersAndRows(selected.allRows, selected.config.headerRowIndex);
  const { matches, diagnostics } = matchProfileHeaders(profile, headers, selected.config.fieldOverrides);
  const missingRequired = diagnostics.filter((diagnostic) => diagnostic.code === "required_header_missing");
  const grantRows = reportGrantRows(selected, grants);
  const toolWarning = toolKind ? likelyBetterTool(selected.config.profileId, toolKind) : "";
  const excludeRules = normalizeExcludeRules(selected.config.excludeRules, defaultExcludeRulesForProfile(profile));
  const filterCounts = React.useMemo(() => {
    const filtered = filterReportRows({
      profile,
      headers,
      rows: dataRows,
      headerRowIndex: selected.config.headerRowIndex,
      fieldOverrides: selected.config.fieldOverrides,
      excludeRules,
    });
    return { included: filtered.included.length, excluded: filtered.excluded.length };
  }, [dataRows, excludeRules, headers, profile, selected.config.fieldOverrides, selected.config.headerRowIndex]);
  const visibleSheetTabs = React.useMemo(() => {
    const workbookSheets = selected.workbookKey ? uploads.filter((upload) => upload.workbookKey === selected.workbookKey) : uploads;
    const pageSize = 8;
    const maxPage = Math.max(0, Math.ceil(workbookSheets.length / pageSize) - 1);
    const page = Math.min(sheetPage, maxPage);
    return {
      page,
      maxPage,
      total: workbookSheets.length,
      rows: workbookSheets.slice(page * pageSize, page * pageSize + pageSize),
    };
  }, [sheetPage, selected.workbookKey, uploads]);

  const sampleValue = (columnIndex: number) => {
    for (const row of dataRows.slice(0, 5)) {
      const value = String((row as unknown[])[columnIndex] ?? "").trim();
      if (value) return value;
    }
    return "";
  };
  const setOverride = (fieldKey: string, raw: string) => {
    const next = { ...selected.config.fieldOverrides };
    if (raw === "auto") delete next[fieldKey];
    else next[fieldKey] = Number(raw);
    onUpdateConfig(selected.id, { fieldOverrides: next });
  };
  const addManualGrantSignal = () => {
    const value = manualGrantDraft.trim();
    if (!value) return;
    const current = selected.config.manualGrantSignals ?? [];
    if (!current.some((item) => norm(item) === norm(value))) {
      onUpdateConfig(selected.id, { manualGrantSignals: [...current, value] });
    }
    setManualGrantDraft("");
  };
  const referenceSamples = React.useMemo(() => {
    const referenceMatch = matches.find((match) => match.fieldKey === "reference");
    if (referenceMatch?.sourceIndex == null) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of dataRows) {
      const value = String((row as unknown[])[referenceMatch.sourceIndex] ?? "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
      if (out.length >= 5) break;
    }
    return out;
  }, [dataRows, matches]);

  return (
    <div className="space-y-3">
      <WorkbookSheetSelector
        uploads={uploads}
        selected={selected}
        onSelect={onSelect}
        onSetUploadEnabled={onSetUploadEnabled}
        onSetWorkbookEnabled={onSetWorkbookEnabled}
      />

      {visibleSheetTabs.total > 1 ? (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sheet config</div>
            {visibleSheetTabs.maxPage > 0 ? (
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <button type="button" className="btn btn-ghost btn-xs" disabled={visibleSheetTabs.page <= 0} onClick={() => setSheetPage((page) => Math.max(0, page - 1))}>Prev</button>
                <span>Page {visibleSheetTabs.page + 1} of {visibleSheetTabs.maxPage + 1}</span>
                <button type="button" className="btn btn-ghost btn-xs" disabled={visibleSheetTabs.page >= visibleSheetTabs.maxPage} onClick={() => setSheetPage((page) => Math.min(visibleSheetTabs.maxPage, page + 1))}>Next</button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
          {visibleSheetTabs.rows.map((upload) => (
            <button
              key={upload.id}
              type="button"
              onClick={() => onSelect(upload.id)}
              className={[
                "mb-[-1px] max-w-[220px] truncate rounded-t-md border px-2 py-1 text-xs",
                upload.id === selected.id
                  ? "border-slate-900 bg-white text-slate-900 dark:border-slate-100 dark:bg-slate-950 dark:text-slate-50"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-300",
              ].join(" ")}
            >
              {upload.enabled === false ? "(skipped) " : ""}{upload.sheetName || upload.fileName}
            </button>
          ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Detected report type</div>
            <select
              className="input h-9 w-full px-2 py-1 text-sm leading-5"
              value={profile.id}
              onChange={(event) => {
                const nextProfile = profiles.find((item) => item.id === event.currentTarget.value) ?? profile;
                onUpdateConfig(selected.id, {
                  profileId: nextProfile.id,
                  excludeRules: defaultExcludeRulesForProfile(nextProfile),
                });
              }}
            >
              {profiles.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            {selected.profileCandidates.length ? (
              <div className="mt-1 text-[11px] text-slate-500">
                Best guess: {selected.profileCandidates[0]?.profile.label} (score {selected.profileCandidates[0]?.score})
              </div>
            ) : null}
            {selected.reportMetadata && Object.values(selected.reportMetadata).some(Boolean) ? (
              <div className="mt-2 rounded border border-sky-200 bg-sky-50 p-2 text-[11px] dark:border-sky-900 dark:bg-sky-950/30">
                <div className="mb-1 font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Report parameters</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  {Object.entries(selected.reportMetadata).filter(([, value]) => value).map(([key, value]) => (
                    <React.Fragment key={key}>
                      <dt className="capitalize text-slate-500">{key}</dt>
                      <dd className="truncate text-slate-700 dark:text-slate-200" title={value}>{value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.workbookKey ? (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => onApplyConfigToWorkbook?.(selected.id)}>
                  Save config for all sheets
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => downloadRowsAsCsv(selected)}>
                Download sheet CSV
              </button>
              <button type="button" className="btn btn-primary btn-xs" onClick={() => setAdvancedOpen(true)}>
                Advanced config
              </button>
            </div>
            {toolWarning ? (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{toolWarning}</div>
            ) : null}
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Config tool</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {([
                  ["header", "Header row"],
                  ["fields", missingRequired.length ? `Field map (${missingRequired.length})` : "Field map"],
                  ["grants", `Grants (${grantRows.length})`],
                  ["excludes", `Exclude filters (${filterCounts.excluded})`],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={[
                      "rounded border px-2 py-1 text-left",
                      configTool === key
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-300",
                    ].join(" ")}
                    onClick={() => setConfigTool(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {filterCounts.included} included / {filterCounts.excluded} excluded after filters.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {configTool === "header" ? (
            <HeaderRowPicker
              allRows={selected.allRows}
              headerRowIndex={selected.config.headerRowIndex}
              onChange={(index) => onUpdateConfig(selected.id, { headerRowIndex: index })}
            />
          ) : null}

          {configTool === "fields" ? (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Field → column mapping</div>
              {missingRequired.length ? (
                <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">{missingRequired.length} required unmapped</span>
              ) : (
                <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">Required fields mapped</span>
              )}
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
              {matches.map((match) => {
                const field = profile.fields[match.fieldKey];
                const selectValue = selected.config.fieldOverrides[match.fieldKey] === undefined ? "auto" : String(selected.config.fieldOverrides[match.fieldKey]);
                const example = match.sourceIndex != null ? sampleValue(match.sourceIndex) : "";
                return (
                  <div key={match.fieldKey} className="flex items-center gap-2 text-xs">
                    <div className="w-32 shrink-0">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{match.fieldKey}</span>
                      {field?.required ? <span className="ml-1 text-red-500">*</span> : null}
                      {field?.type ? <span className="ml-1 text-[10px] text-slate-400">{field.type}</span> : null}
                    </div>
                    <select
                      className={["input h-8 flex-1 px-2 text-xs", match.required && !match.found ? "border-amber-400" : ""].join(" ")}
                      value={selectValue}
                      onChange={(event) => setOverride(match.fieldKey, event.currentTarget.value)}
                    >
                      <option value="auto">Auto{match.found ? ` → ${match.sourceHeader}` : " (no match)"}</option>
                      {headers.map((header, index) => (
                        <option key={index} value={index}>{header || `Column ${index + 1}`}</option>
                      ))}
                      <option value="-1">— Unmapped —</option>
                    </select>
                    <div className="w-24 shrink-0 truncate text-[11px] text-slate-400" title={example}>{example}</div>
                  </div>
                );
              })}
            </div>
          </div>
          ) : null}

          {configTool === "grants" ? (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Grants parsed &amp; matched ({grantRows.length})</div>
            <div className="mb-2 flex gap-2">
              <input
                className="input h-8 flex-1 px-2 text-xs"
                value={manualGrantDraft}
                onChange={(event) => setManualGrantDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addManualGrantSignal();
                  }
                }}
                placeholder="Add grant/provider context for this upload"
              />
              <button type="button" className="btn btn-primary btn-xs" onClick={addManualGrantSignal}>Add grant</button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
              {grantRows.length ? grantRows.map((row, index) => (
                <div key={`${row.value}-${index}`} className="flex items-center gap-2 text-xs">
                  <div className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300" title={row.value}>
                    {row.manual ? <span className="mr-1 rounded bg-sky-50 px-1 text-[10px] uppercase text-sky-700">manual</span> : null}
                    {row.value}
                  </div>
                  <div className="shrink-0">
                    {row.match ? (
                      <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{row.match.name}</span>
                    ) : (
                      <span className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">no grant match</span>
                    )}
                  </div>
                  {row.manual ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => onUpdateConfig(selected.id, {
                        manualGrantSignals: (selected.config.manualGrantSignals ?? []).filter((value) => value !== row.value),
                      })}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              )) : (
                <div className="text-center text-[11px] text-slate-400">No grant/provider values detected in rows or file name.</div>
              )}
            </div>
          </div>
          ) : null}

          {configTool === "excludes" ? (
            <ExcludeRulesEditor
              profile={profile}
              rules={excludeRules}
              onChange={(nextRules) => onUpdateConfig(selected.id, { excludeRules: nextRules })}
            />
          ) : null}

          {configTool === "fields" && selected.config.profileId === "financial_edge_project_activity" ? (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">FE reference extraction test</div>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
                {referenceSamples.length ? referenceSamples.map((reference) => {
                  const parsed = parseFinancialEdgeReference(reference, DEFAULT_FE_REFERENCE_PATTERNS);
                  return (
                    <div key={reference} className="text-xs">
                      <div className="truncate font-medium text-slate-700 dark:text-slate-200" title={reference}>{reference}</div>
                      <div className="mt-1 text-slate-500">
                        {parsed ? `${parsed.patternLabel}: ${Object.entries(parsed.fields).map(([key, value]) => `${key}=${value}`).join(" | ")}` : "No configured regex matched."}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center text-[11px] text-slate-400">Map a Reference column to test extraction against sample rows.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {advancedOpen ? (
        <AdvancedConfigPreview
          upload={selected}
          profile={profile}
          headers={headers}
          dataRows={dataRows}
          rules={excludeRules}
          onClose={() => setAdvancedOpen(false)}
        />
      ) : null}
    </div>
  );
}

export function ReportUploadPanel({
  uploads,
  profiles,
  grants,
  reading,
  error,
  onFiles,
  onUpdateConfig,
  onApplyConfigToWorkbook,
  onSetUploadEnabled,
  onSetWorkbookEnabled,
  onRemove,
  onClear,
  toolKind,
  databaseConfig,
}: ReportUploadPanelProps) {
  const [tab, setTab] = React.useState<"upload" | "configure" | "database">("upload");
  const [selectedId, setSelectedId] = React.useState("");

  React.useEffect(() => {
    if (!uploads.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!selectedId || !uploads.some((upload) => upload.id === selectedId)) {
      setSelectedId(uploads[0].id);
    }
  }, [selectedId, uploads]);

  const configure = (id: string) => {
    setSelectedId(id);
    setTab("configure");
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-800">
        {([
          ["upload", `Upload${uploads.length ? ` (${uploads.length})` : ""}`],
          ["configure", "Configure Upload"],
          ...(databaseConfig ? [["database", "Configure Database"] as const] : []),
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              "rounded-md px-3 py-1 font-medium transition",
              tab === key ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <div>
          <Dropzone reading={reading} onFiles={onFiles} />
          {error ? <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <UploadsList uploads={uploads} selectedId={selectedId} onConfigure={configure} onRemove={onRemove} onClear={onClear} />
        </div>
      ) : tab === "configure" ? (
        <ConfigureTab
          uploads={uploads}
          profiles={profiles}
          grants={grants}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateConfig={onUpdateConfig}
          onApplyConfigToWorkbook={onApplyConfigToWorkbook}
          onSetUploadEnabled={onSetUploadEnabled}
          onSetWorkbookEnabled={onSetWorkbookEnabled}
          toolKind={toolKind}
        />
      ) : (
        <div>{databaseConfig}</div>
      )}
    </div>
  );
}

export default ReportUploadPanel;
