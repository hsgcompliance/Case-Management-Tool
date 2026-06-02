"use client";

// Handles all workbook-linking UI:
//   - URL input form (paste a Sheets URL to link)
//   - Candidate list (spreadsheets found inside the customer's Drive folder)
//
// Calls the backend attach endpoints. Notifies parent via onLinked() on success.
// Has no knowledge of the iframe embed — that's WorkbookEmbed's job.

import React from "react";
import api from "@client/api";
import { GDrive } from "@client/gdrive";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";
import { FileTypeIcon, SHEETS_MIME, FOLDER_MIME } from "@entities/gdrive/FileTypeIcon";
import { isScopeError } from "@entities/ui/PermissionErrorBanner";
import type { ScopeErrorPayload } from "@entities/ui/PermissionErrorBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

type CandidateItem = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime?: string | null;
  isFolder: boolean;
  isSpreadsheet: boolean;
};

export type WorkbookLinkIssue = {
  error?: string;
  category?: string;
  hint?: string;
  missingPermissions?: string[];
  reconnectService?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function driveHeaders() {
  const token = getGoogleDriveAccessToken();
  return token ? { "x-drive-access-token": token } : undefined;
}

function parseCandidates(resp: unknown): CandidateItem[] {
  const files = Array.isArray((resp as { files?: unknown })?.files)
    ? ((resp as { files: Array<Record<string, unknown>> }).files)
    : [];
  return files
    .map((f) => {
      const mime = String(f.mimeType || "");
      return {
        id:           String(f.id || ""),
        name:         String(f.name || ""),
        mimeType:     mime,
        webViewLink:  String(f.webViewLink || ""),
        modifiedTime: f.modifiedTime ? String(f.modifiedTime) : null,
        isFolder:     mime === FOLDER_MIME,
        isSpreadsheet: mime === SHEETS_MIME,
      };
    })
    .filter((c) => c.id && (c.isFolder || c.isSpreadsheet))
    .sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function apiIssue(resp: unknown, fallback: string): WorkbookLinkIssue {
  const r = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
  return {
    error:              typeof r.error === "string" ? r.error : fallback,
    category:           typeof r.category === "string" ? r.category : undefined,
    hint:               typeof r.hint === "string" ? r.hint : undefined,
    missingPermissions: Array.isArray(r.missingPermissions) ? (r.missingPermissions as string[]) : undefined,
    reconnectService:   typeof r.reconnectService === "string" ? r.reconnectService : undefined,
  };
}

// ── URL input form ────────────────────────────────────────────────────────────

function UrlInputForm({
  value,
  onChange,
  onSave,
  saving,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  error?: WorkbookLinkIssue | null;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-600">Paste a Google Sheets URL to link</div>
      <div className="flex gap-2">
        <input
          className="input min-w-0 flex-1 text-sm"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving || disabled}
          onKeyDown={(e) => { if (e.key === "Enter" && !saving && value.trim()) onSave(); }}
        />
        <button
          type="button"
          className="btn btn-sm btn-primary shrink-0"
          disabled={saving || !value.trim() || disabled}
          onClick={onSave}
        >
          {saving ? "Linking…" : "Link"}
        </button>
      </div>
      {error?.error ? (
        <div className="text-xs text-red-600">{error.error}</div>
      ) : null}
    </div>
  );
}

// ── Candidate list ────────────────────────────────────────────────────────────

function CandidateList({
  candidates,
  loading,
  error,
  attachingId,
  isViewer,
  onAttach,
  onRetry,
}: {
  candidates: CandidateItem[] | null;
  loading: boolean;
  error?: WorkbookLinkIssue | null;
  attachingId: string | null;
  isViewer: boolean;
  onAttach: (item: CandidateItem) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        Scanning folder…
      </div>
    );
  }

  if (error?.error) {
    return (
      <div className="space-y-1">
        <div className="text-xs text-red-600">{error.error}</div>
        <button type="button" className="text-xs text-sky-600 underline hover:text-sky-800" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (candidates !== null && candidates.length === 0) {
    return (
      <div className="text-xs text-slate-400">No Google Sheets found in this folder.</div>
    );
  }

  if (!candidates) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        In the customer folder
      </div>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {candidates.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <FileTypeIcon mime={item.mimeType} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{item.name}</div>
                {item.modifiedTime && (
                  <div className="text-[11px] text-slate-400">Modified {fmtDate(item.modifiedTime)}</div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.isSpreadsheet && !isViewer ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!!attachingId}
                  onClick={() => onAttach(item)}
                >
                  {attachingId === item.id ? "Linking…" : "Link"}
                </button>
              ) : null}
              <a href={item.webViewLink} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                {item.isFolder ? "Open folder" : "Open"} ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export type WorkbookLinkControlsProps = {
  customerId: string;
  /** Customer's Drive folder ID — when present, candidates are loaded from it. */
  folderId?: string | null;
  enrollmentId?: string;
  isViewer?: boolean;
  /** Called after a successful link so the parent can refresh customer data. */
  onLinked: () => void;
  /** Called when an error is a Drive auth issue (parent can show DriveAuthBanner). */
  onAuthIssue?: (issue: WorkbookLinkIssue) => void;
};

/**
 * Renders the workbook-linking UI: URL input + folder candidate list.
 * Use inside WorkbookPanel (or directly) when no workbook is linked yet.
 */
export function WorkbookLinkControls({
  customerId,
  folderId,
  enrollmentId,
  isViewer = false,
  onLinked,
  onAuthIssue,
}: WorkbookLinkControlsProps) {
  const [urlInput,    setUrlInput]    = React.useState("");
  const [urlSaving,   setUrlSaving]   = React.useState(false);
  const [urlError,    setUrlError]    = React.useState<WorkbookLinkIssue | null>(null);

  const [candidates,       setCandidates]       = React.useState<CandidateItem[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = React.useState(false);
  const [candidatesError,   setCandidatesError]   = React.useState<WorkbookLinkIssue | null>(null);
  const [attachingId,       setAttachingId]       = React.useState<string | null>(null);

  const loadCandidates = React.useCallback(async () => {
    if (!folderId) return;
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const resp = await GDrive.list({ folderId });
      if ((resp as Record<string, unknown>)?.ok) {
        setCandidates(parseCandidates(resp));
      } else {
        const issue = apiIssue(resp, "Failed to load folder contents");
        setCandidatesError(issue);
        if (isScopeError(issue) && onAuthIssue) onAuthIssue(issue as ScopeErrorPayload);
      }
    } catch (e: unknown) {
      const issue = apiIssue(e, String((e as Error)?.message || "Failed to load folder"));
      setCandidatesError(issue);
    } finally {
      setCandidatesLoading(false);
    }
  }, [folderId, onAuthIssue]);

  // Auto-load candidates when a folder is present
  React.useEffect(() => {
    if (folderId && candidates === null) void loadCandidates();
  }, [folderId, candidates, loadCandidates]);

  const linkByUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlError(null);
    setUrlSaving(true);
    try {
      const resp = (await (api as any).postWith(
        "attachCustomerWorkbookByUrl",
        { customerId, workbookUrl: url, ...(enrollmentId ? { enrollmentId } : {}) },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (resp?.ok) {
        setUrlInput("");
        onLinked();
      } else {
        const issue = apiIssue(resp, "Failed to link workbook");
        setUrlError(issue);
        if (isScopeError(issue) && onAuthIssue) onAuthIssue(issue as ScopeErrorPayload);
      }
    } catch (e: unknown) {
      setUrlError(apiIssue(e, String((e as Error)?.message || "Failed to link workbook")));
    } finally {
      setUrlSaving(false);
    }
  };

  const linkCandidate = async (item: CandidateItem) => {
    setAttachingId(item.id);
    setCandidatesError(null);
    try {
      const resp = (await (api as any).postWith(
        "attachCustomerWorkbookCandidate",
        { customerId, spreadsheetId: item.id, spreadsheetName: item.name, ...(enrollmentId ? { enrollmentId } : {}) },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (resp?.ok) {
        onLinked();
      } else {
        const issue = apiIssue(resp, "Failed to link workbook");
        setCandidatesError(issue);
        if (isScopeError(issue) && onAuthIssue) onAuthIssue(issue as ScopeErrorPayload);
      }
    } catch (e: unknown) {
      setCandidatesError(apiIssue(e, String((e as Error)?.message || "Failed to link workbook")));
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {!isViewer && (
        <UrlInputForm
          value={urlInput}
          onChange={setUrlInput}
          onSave={() => void linkByUrl()}
          saving={urlSaving}
          error={urlError}
        />
      )}
      {folderId && (
        <CandidateList
          candidates={candidates}
          loading={candidatesLoading}
          error={candidatesError}
          attachingId={attachingId}
          isViewer={isViewer}
          onAttach={(item) => void linkCandidate(item)}
          onRetry={() => { setCandidates(null); void loadCandidates(); }}
        />
      )}
    </div>
  );
}
