"use client";

import React from "react";
import type { OrgConfigDoc } from "@client/orgs";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { toast } from "@lib/toast";
import { useOrgConfigDashboard } from "../orgConfigContext";
import {
  DEFAULT_REPORT_SOURCE_PROFILES,
  buildReconciliationPacket,
  matchProfileHeaders,
  normalizeReportProfiles,
  type ReconciliationPacket,
  type ReportFieldProfile,
  type ReportFieldType,
  type ReportSourceProfile,
} from "@features/report-reconciliation/reportProfiles";
import { parseReportFilePreview, type ParsedReportPreview } from "@features/report-reconciliation/reportFilePreview";

export type ReportMappingFilterState = { search: string; showInactive: boolean };
export type ReportMappingSelection = { profileId: string };

const REPORT_PROFILES_KEY = "reportProfiles";
const FIELD_TYPES: Array<{ value: ReportFieldType | ""; label: string }> = [
  { value: "", label: "Text" },
  { value: "identity", label: "Identity" },
  { value: "date", label: "Date" },
  { value: "money", label: "Money" },
  { value: "grant", label: "Grant/program" },
  { value: "vendor", label: "Vendor/payee" },
];

function getSystemConfigDoc(docs: OrgConfigDoc[]) {
  return docs.find((doc) => doc.id === "SystemConfig") ?? docs[0] ?? null;
}

function getProfiles(doc: OrgConfigDoc | null): ReportSourceProfile[] {
  return normalizeReportProfiles(doc?.value?.[REPORT_PROFILES_KEY]);
}

function matchesSearch(profile: ReportSourceProfile, filterState: ReportMappingFilterState) {
  if (!filterState.showInactive && profile.active === false) return false;
  const q = filterState.search.trim().toLowerCase();
  if (!q) return true;
  return `${profile.id} ${profile.label} ${profile.recordKind}`.toLowerCase().includes(q);
}

function slugifyProfileId(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `report_profile_${Date.now()}`;
}

function upsertProfile(profiles: ReportSourceProfile[], nextProfile: ReportSourceProfile) {
  const exists = profiles.some((profile) => profile.id === nextProfile.id);
  return exists ? profiles.map((profile) => (profile.id === nextProfile.id ? nextProfile : profile)) : [...profiles, nextProfile];
}

function parseAliasText(value: string) {
  return value.split(",").map((alias) => alias.trim()).filter(Boolean);
}

function serializeProfilesPatch(doc: OrgConfigDoc, profiles: ReportSourceProfile[]) {
  return {
    value: {
      ...(doc.value ?? {}),
      [REPORT_PROFILES_KEY]: profiles,
    },
  };
}

export const ReportMappingTopbar: DashboardToolDefinition<ReportMappingFilterState, ReportMappingSelection>["ToolTopbar"] = ({
  value,
  onChange,
}) => {
  const { docsByKind } = useOrgConfigDashboard();
  const systemConfig = getSystemConfigDoc(docsByKind.system);
  const profiles = getProfiles(systemConfig);
  const visibleCount = profiles.filter((profile) => matchesSearch(profile, value)).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="input h-8 w-64"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.currentTarget.value })}
        placeholder="Search report profiles..."
      />
      <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={value.showInactive}
          onChange={(event) => onChange({ ...value, showInactive: event.currentTarget.checked })}
        />
        Show inactive
      </label>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {visibleCount} of {profiles.length} profiles
      </span>
    </div>
  );
};

export const ReportMappingSidebar: DashboardToolDefinition<ReportMappingFilterState, ReportMappingSelection>["Sidebar"] = ({
  filterState,
  selection,
  onSelect,
}) => {
  const { docsByKind } = useOrgConfigDashboard();
  const profiles = getProfiles(getSystemConfigDoc(docsByKind.system)).filter((profile) => matchesSearch(profile, filterState));

  return (
    <div className="space-y-2 p-3">
      {profiles.map((profile) => {
        const active = selection?.profileId === profile.id;
        return (
          <button
            key={profile.id}
            type="button"
            className={[
              "w-full rounded-md border px-3 py-2 text-left text-sm",
              active
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
            ].join(" ")}
            onClick={() => onSelect({ profileId: profile.id })}
          >
            <span className="block font-semibold">{profile.label}</span>
            <span className="block truncate font-mono text-xs opacity-70">{profile.recordKind}</span>
            {profile.active === false ? <span className="mt-1 block text-xs opacity-70">Inactive</span> : null}
          </button>
        );
      })}
      {!profiles.length ? <div className="p-3 text-xs text-slate-500">No report profiles match this filter.</div> : null}
    </div>
  );
};

function ReportProfileEditor({
  profile,
  onChange,
}: {
  profile: ReportSourceProfile;
  onChange: (next: ReportSourceProfile) => void;
}) {
  const fieldEntries = React.useMemo(() => Object.entries(profile.fields), [profile.fields]);

  const updateField = React.useCallback(
    (fieldKey: string, patch: Partial<ReportFieldProfile>) => {
      const current = profile.fields[fieldKey] ?? { required: false, aliases: [] };
      onChange({
        ...profile,
        fields: {
          ...profile.fields,
          [fieldKey]: { ...current, ...patch },
        },
      });
    },
    [onChange, profile],
  );

  const addField = React.useCallback(() => {
    const key = window.prompt("Field key");
    if (!key) return;
    const fieldKey = key.trim();
    if (!fieldKey || profile.fields[fieldKey]) return;
    onChange({
      ...profile,
      fields: {
        ...profile.fields,
        [fieldKey]: { required: false, aliases: [fieldKey] },
      },
    });
  }, [onChange, profile]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Profile label
          <input
            className="input mt-1 w-full"
            value={profile.label}
            onChange={(event) => onChange({ ...profile, label: event.currentTarget.value })}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Record kind
          <input
            className="input mt-1 w-full font-mono"
            value={profile.recordKind}
            onChange={(event) => onChange({ ...profile, recordKind: event.currentTarget.value })}
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={profile.active !== false} onChange={(event) => onChange({ ...profile, active: event.currentTarget.checked })} />
        Active profile
      </label>

      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
        Source/report quirks
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          rows={3}
          value={profile.notes ?? ""}
          onChange={(event) => onChange({ ...profile, notes: event.currentTarget.value })}
        />
      </label>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Fields</div>
            <div className="text-xs text-slate-500">Required status, parser type, and accepted header aliases.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-xs" onClick={addField}>
            Add Field
          </button>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {fieldEntries.map(([fieldKey, field]) => (
            <div key={fieldKey} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(120px,180px)_120px_140px_minmax(240px,1fr)]">
              <div>
                <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{fieldKey}</div>
                <div className="text-xs text-slate-500">{field.aliases.length} aliases</div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={field.required} onChange={(event) => updateField(fieldKey, { required: event.currentTarget.checked })} />
                Required
              </label>
              <select
                className="input h-8 text-xs"
                value={field.type ?? ""}
                onChange={(event) => updateField(fieldKey, { type: (event.currentTarget.value || undefined) as ReportFieldType | undefined })}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type.value || "text"} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                className="input h-8 font-mono text-xs"
                value={field.aliases.join(", ")}
                onChange={(event) => updateField(fieldKey, { aliases: parseAliasText(event.currentTarget.value) })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeaderPreview({
  profile,
  profiles,
}: {
  profile: ReportSourceProfile;
  profiles: ReportSourceProfile[];
}) {
  const [text, setText] = React.useState("");
  const [filePreview, setFilePreview] = React.useState<ParsedReportPreview | null>(null);
  const [packet, setPacket] = React.useState<ReconciliationPacket | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const headers = React.useMemo(() => parseAliasText(text.replace(/\n/g, ",")), [text]);
  const activeHeaders = filePreview?.headers.length ? filePreview.headers : headers;
  const result = React.useMemo(() => matchProfileHeaders(profile, activeHeaders), [activeHeaders, profile]);

  const handleFile = React.useCallback(
    async (file: File | null) => {
      if (!file) return;
      setPreviewing(true);
      setPreviewError(null);
      setFilePreview(null);
      setPacket(null);
      try {
        const nextPreview = await parseReportFilePreview(file, profiles);
        setFilePreview(nextPreview);
        setText(nextPreview.headers.join(", "));
        setPacket(
          buildReconciliationPacket({
            profile,
            headers: nextPreview.headers,
            rows: nextPreview.sampleRows,
            sourceFile: nextPreview.fileName,
            headerRowIndex: nextPreview.headerRowIndex,
          }),
        );
      } catch (e: unknown) {
        setPreviewError(e instanceof Error ? e.message : "Unable to preview this file.");
      } finally {
        setPreviewing(false);
      }
    },
    [profile, profiles],
  );

  React.useEffect(() => {
    if (!filePreview) return;
    setPacket(
      buildReconciliationPacket({
        profile,
        headers: filePreview.headers,
        rows: filePreview.sampleRows,
        sourceFile: filePreview.fileName,
        headerRowIndex: filePreview.headerRowIndex,
      }),
    );
  }, [filePreview, profile]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Header / File Preview</div>
            <div className="text-xs text-slate-500">Preview stays in this browser session and is not saved to org config.</div>
          </div>
          <label className="btn btn-ghost btn-sm cursor-pointer">
            {previewing ? "Reading..." : "Choose CSV/TXT/XLSX"}
            <input
              className="sr-only"
              type="file"
              accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                void handleFile(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {previewError ? <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{previewError}</div> : null}
        {filePreview ? (
          <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-4">
            <div><span className="font-semibold">File:</span> {filePreview.fileName}</div>
            <div><span className="font-semibold">Type:</span> {filePreview.fileType.toUpperCase()}{filePreview.sheetName ? ` / ${filePreview.sheetName}` : ""}</div>
            <div><span className="font-semibold">Header row:</span> {filePreview.headerRowIndex + 1}</div>
            <div><span className="font-semibold">Rows:</span> {filePreview.totalRows}</div>
          </div>
        ) : null}
      <textarea
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
        rows={3}
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value);
          setFilePreview(null);
          setPacket(null);
        }}
        placeholder="Paste comma-separated headers..."
      />
      {activeHeaders.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {result.matches.map((match) => (
            <div key={match.fieldKey} className="rounded border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
              <span className="font-mono font-semibold">{match.fieldKey}</span>
              <span className={match.found ? "ml-2 text-emerald-700 dark:text-emerald-300" : "ml-2 text-red-600 dark:text-red-300"}>
                {match.found ? `matched ${match.sourceHeader}` : match.required ? "missing required header" : "not found"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-500">Paste only header names. Raw report rows should not be saved here.</div>
      )}
      {filePreview?.profileCandidates.length ? (
        <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Likely Source Profiles</div>
          <div className="grid gap-2 md:grid-cols-2">
            {filePreview.profileCandidates.slice(0, 4).map((candidate) => (
              <div key={candidate.profile.id} className="rounded border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
                <div className="font-semibold text-slate-800 dark:text-slate-100">{candidate.profile.label}</div>
                <div className="text-slate-500">
                  score {candidate.score} · required {candidate.requiredMatches}/{candidate.requiredTotal} · optional {candidate.optionalMatches}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      </div>

      {packet ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Normalized Packet Preview</div>
              <div className="text-xs text-slate-500">{packet.profileLabel} · {packet.summary.recordKind}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded border border-slate-200 px-2 py-1 dark:border-slate-800">{packet.summary.normalizedRows} sample rows</span>
              <span className="rounded border border-slate-200 px-2 py-1 dark:border-slate-800">{packet.summary.diagnosticCount} diagnostics</span>
              <span className="rounded border border-slate-200 px-2 py-1 dark:border-slate-800">{packet.summary.requiredMissingCount} missing required headers</span>
            </div>
          </div>
          {packet.diagnostics.length ? (
            <div className="mt-3 space-y-1">
              {packet.diagnostics.slice(0, 5).map((diagnostic, index) => (
                <div key={`${diagnostic.code}-${diagnostic.fieldKey || ""}-${index}`} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {diagnostic.message}
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-3 overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Identity</th>
                  <th className="px-3 py-2">Enrollment</th>
                  <th className="px-3 py-2">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {packet.records.slice(0, 8).map((record) => (
                  <tr key={`${record.sourceFile}-${record.sourceRowNumber}`}>
                    <td className="px-3 py-2 font-mono">{record.sourceRowNumber}</td>
                    <td className="px-3 py-2">
                      <div>{record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim() || "-"}</div>
                      <div className="text-slate-500">HMIS {record.customerIdentity.hmisId || "-"} · DOB {record.customerIdentity.dob || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{record.enrollmentEvidence.projectName || record.enrollmentEvidence.programId || "-"}</div>
                      <div className="text-slate-500">{record.enrollmentEvidence.entryDate || "-"} to {record.enrollmentEvidence.exitDate || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{record.paymentEvidence.amount == null ? "-" : record.paymentEvidence.amount}</div>
                      <div className="text-slate-500">{record.paymentEvidence.vendor || "-"} · {record.paymentEvidence.transactionDate || "-"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const ReportMappingMain: DashboardToolDefinition<ReportMappingFilterState, ReportMappingSelection>["Main"] = ({
  filterState,
  selection,
  onSelect,
}) => {
  const { docsByKind, patchConfigDoc, isLoading, isError, error } = useOrgConfigDashboard();
  const systemConfig = getSystemConfigDoc(docsByKind.system);
  const storedProfiles = React.useMemo(() => getProfiles(systemConfig), [systemConfig]);
  const visibleProfiles = React.useMemo(() => storedProfiles.filter((profile) => matchesSearch(profile, filterState)), [filterState, storedProfiles]);
  const selectedProfile = storedProfiles.find((profile) => profile.id === selection?.profileId) ?? visibleProfiles[0] ?? storedProfiles[0] ?? null;
  const [draft, setDraft] = React.useState<ReportSourceProfile | null>(selectedProfile);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!selection && selectedProfile) onSelect({ profileId: selectedProfile.id });
  }, [onSelect, selectedProfile, selection]);

  React.useEffect(() => {
    setDraft(selectedProfile);
  }, [selectedProfile]);

  const dirty = React.useMemo(() => JSON.stringify(draft) !== JSON.stringify(selectedProfile), [draft, selectedProfile]);

  const saveDraft = React.useCallback(async () => {
    if (!systemConfig || !draft) return;
    setSaving(true);
    try {
      await patchConfigDoc(systemConfig.id, serializeProfilesPatch(systemConfig, upsertProfile(storedProfiles, draft)));
      toast("Report profile saved.", { type: "success" });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to save report profile.", { type: "error" });
    } finally {
      setSaving(false);
    }
  }, [draft, patchConfigDoc, storedProfiles, systemConfig]);

  const createProfile = React.useCallback(() => {
    const label = window.prompt("Report profile name");
    if (!label) return;
    const id = slugifyProfileId(label);
    const next: ReportSourceProfile = {
      id,
      label: label.trim(),
      recordKind: id,
      active: true,
      schemaVersion: 1,
      fields: {
        sourceId: { required: false, aliases: ["ID", "Source ID"] },
        amount: { required: false, type: "money", aliases: ["Amount"] },
        date: { required: false, type: "date", aliases: ["Date"] },
      },
    };
    setDraft(next);
    onSelect({ profileId: next.id });
  }, [onSelect]);

  const resetDefaults = React.useCallback(async () => {
    if (!systemConfig) return;
    setSaving(true);
    try {
      await patchConfigDoc(systemConfig.id, serializeProfilesPatch(systemConfig, DEFAULT_REPORT_SOURCE_PROFILES));
      toast("Default report profiles restored.", { type: "success" });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to restore defaults.", { type: "error" });
    } finally {
      setSaving(false);
    }
  }, [patchConfigDoc, systemConfig]);

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;
  if (isError) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load org config."}</div>;
  if (!systemConfig) return <div className="py-12 text-center text-sm text-slate-400">No SystemConfig document found.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Admin Report Mapping</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Profiles are stored on SystemConfig.value.reportProfiles for reusable reconciliation tooling.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={createProfile}>
            New Profile
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={resetDefaults}>
            Restore Defaults
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || saving || !draft} onClick={saveDraft}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      {draft ? (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <ReportProfileEditor profile={draft} onChange={setDraft} />
          </div>
          <HeaderPreview profile={draft} profiles={storedProfiles} />
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
          No report profile selected.
        </div>
      )}
    </div>
  );
};
