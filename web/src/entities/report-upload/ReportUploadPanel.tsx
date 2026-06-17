"use client";

import React from "react";
import {
  collectReportGrantSignals,
  deriveHeadersAndRows,
  matchProfileHeaders,
  type FieldColumnOverrides,
  type ReconciliationPacket,
  type ReportSourceProfile,
} from "@features/report-reconciliation/reportProfiles";

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
};

export type ReportUpload = {
  id: string;
  fileName: string;
  sheetName?: string;
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
  onRemove: (id: string) => void;
  onClear: () => void;
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

function reportGrantRows(upload: ReportUpload, grants: ReportUploadGrant[]): { value: string; match: ReportUploadGrant | null }[] {
  const signals = collectReportGrantSignals(upload.packet);
  if (signals.length) {
    return signals.map((value) => ({ value, match: matchGrant(value, grants) }));
  }
  // Financial Edge & similar: the grant lives in the file name, not the rows.
  const seen = new Set<string>();
  const rows: { value: string; match: ReportUploadGrant | null }[] = [];
  for (const grant of grants) {
    if (wordTokens(grant.name).some((token) => norm(upload.fileName).includes(token))) {
      if (seen.has(grant.id)) continue;
      seen.add(grant.id);
      rows.push({ value: upload.fileName, match: grant });
    }
  }
  return rows;
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
  onConfigure,
  onRemove,
  onClear,
}: {
  uploads: ReportUpload[];
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!uploads.length) {
    return <div className="mt-3 text-center text-xs text-slate-400">No reports uploaded yet.</div>;
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded reports ({uploads.length})</div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onClear}>Clear all</button>
      </div>
      {uploads.map((upload) => {
        const profile = upload.profileCandidates[0]?.profile;
        const requiredMissing = upload.packet.summary.requiredMissingCount;
        return (
          <div key={upload.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{upload.fileName}</div>
              <div className="text-slate-500">
                {upload.packet.profileLabel || profile?.label || "Unknown type"} · {upload.packet.summary.totalRows} rows
                {requiredMissing ? <span className="ml-1 text-amber-600">· {requiredMissing} required unmapped</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => onConfigure(upload.id)}>Configure</button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => onRemove(upload.id)}>Remove</button>
            </div>
          </div>
        );
      })}
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

function ConfigureTab({
  uploads,
  profiles,
  grants,
  selectedId,
  onSelect,
  onUpdateConfig,
}: {
  uploads: ReportUpload[];
  profiles: ReportSourceProfile[];
  grants: ReportUploadGrant[];
  selectedId: string;
  onSelect: (id: string) => void;
  onUpdateConfig: ReportUploadPanelProps["onUpdateConfig"];
}) {
  const selected = uploads.find((upload) => upload.id === selectedId) ?? uploads[0] ?? null;
  if (!selected) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">Upload a report to configure its mapping.</div>;
  }

  const profile = profiles.find((item) => item.id === selected.config.profileId) ?? profiles[0];
  const { headers, dataRows } = deriveHeadersAndRows(selected.allRows, selected.config.headerRowIndex);
  const { matches, diagnostics } = matchProfileHeaders(profile, headers, selected.config.fieldOverrides);
  const missingRequired = diagnostics.filter((diagnostic) => diagnostic.code === "required_header_missing");
  const grantRows = reportGrantRows(selected, grants);

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

  return (
    <div className="space-y-3">
      {uploads.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {uploads.map((upload) => (
            <button
              key={upload.id}
              type="button"
              onClick={() => onSelect(upload.id)}
              className={[
                "max-w-[220px] truncate rounded border px-2 py-1 text-xs",
                upload.id === selected.id
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-300",
              ].join(" ")}
            >
              {upload.fileName}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Detected report type</div>
            <select
              className="input h-9 w-full px-2 py-1 text-sm leading-5"
              value={profile.id}
              onChange={(event) => onUpdateConfig(selected.id, { profileId: event.currentTarget.value })}
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
          </div>
          <HeaderRowPicker
            allRows={selected.allRows}
            headerRowIndex={selected.config.headerRowIndex}
            onChange={(index) => onUpdateConfig(selected.id, { headerRowIndex: index })}
          />
        </div>

        <div className="space-y-3">
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

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Grants parsed &amp; matched ({grantRows.length})</div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
              {grantRows.length ? grantRows.map((row, index) => (
                <div key={`${row.value}-${index}`} className="flex items-center gap-2 text-xs">
                  <div className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300" title={row.value}>{row.value}</div>
                  <div className="shrink-0">
                    {row.match ? (
                      <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{row.match.name}</span>
                    ) : (
                      <span className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">no grant match</span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-center text-[11px] text-slate-400">No grant/provider values detected in rows or file name.</div>
              )}
            </div>
          </div>
        </div>
      </div>
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
  onRemove,
  onClear,
}: ReportUploadPanelProps) {
  const [tab, setTab] = React.useState<"upload" | "configure">("upload");
  const [selectedId, setSelectedId] = React.useState("");

  const configure = (id: string) => {
    setSelectedId(id);
    setTab("configure");
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-800">
        {([
          ["upload", `Upload${uploads.length ? ` (${uploads.length})` : ""}`],
          ["configure", "Configure"],
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
          <UploadsList uploads={uploads} onConfigure={configure} onRemove={onRemove} onClear={onClear} />
        </div>
      ) : (
        <ConfigureTab
          uploads={uploads}
          profiles={profiles}
          grants={grants}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateConfig={onUpdateConfig}
        />
      )}
    </div>
  );
}

export default ReportUploadPanel;
