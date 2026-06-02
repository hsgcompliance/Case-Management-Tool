"use client";

import React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import api from "@client/api";
import { useAuth } from "@app/auth/AuthProvider";
import { GDrive } from "@client/gdrive";
import { useGoogleIntegrationStatus } from "@hooks/useGoogleIntegrations";
import { qk } from "@hooks/queryKeys";
import {
  getGoogleDriveAccessToken,
  getGoogleDriveTokenPersistence,
  setGoogleDriveTokenPersistence,
} from "@lib/googleDriveAccessToken";
import { toast } from "@lib/toast";

// ── Local types ───────────────────────────────────────────────────────────────

type TssWorkbook = {
  spreadsheetId?: string | null;
  spreadsheetUrl?: string | null;
  spreadsheetName?: string | null;
  status?: string | null;
  defaultSheetGid?: string | number | null;
  progressNotesGid?: string | number | null;
};

type CustomerDrive = {
  folderId?: string | null;
  linkedWorkbooks?: { tss?: TssWorkbook | null } | null;
};

type FolderItem = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime?: string | null;
  isFolder: boolean;
  isSpreadsheet: boolean;
};

const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type WorkbookApiIssue = {
  error: string;
  code?: string;
  category?: string;
  authMode?: string;
  hint?: string;
  status?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEmbedUrl(spreadsheetId: string, gid?: string | number | null): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const gidStr = gid != null ? String(gid).trim() : "";
  return gidStr ? `${base}#gid=${gidStr}` : base;
}

function buildFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}

function fmtModified(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function driveHeaders() {
  const accessToken = getGoogleDriveAccessToken();
  return accessToken ? { "x-drive-access-token": accessToken } : undefined;
}

function workbookCandidatesFromDriveList(resp: unknown): FolderItem[] {
  const files = Array.isArray((resp as { files?: unknown })?.files)
    ? ((resp as { files: Array<Record<string, unknown>> }).files)
    : [];
  return files
    .map((file) => {
      const mimeType = String(file.mimeType || "");
      return {
        id: String(file.id || ""),
        name: String(file.name || ""),
        mimeType,
        webViewLink: String(file.webViewLink || ""),
        modifiedTime: file.modifiedTime ? String(file.modifiedTime) : null,
        isFolder: mimeType === FOLDER_MIME,
        isSpreadsheet: mimeType === SPREADSHEET_MIME,
      };
    })
    .filter((item) => item.id && (item.isFolder || item.isSpreadsheet))
    .sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function apiIssue(resp: unknown, fallback: string): WorkbookApiIssue {
  const row = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
  return {
    error: String(row.error || fallback),
    code: typeof row.code === "string" ? row.code : undefined,
    category: typeof row.category === "string" ? row.category : undefined,
    authMode: typeof row.authMode === "string" ? row.authMode : undefined,
    hint: typeof row.hint === "string" ? row.hint : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
  };
}

function issueNeedsDriveConnection(issue: WorkbookApiIssue | null): boolean {
  if (!issue) return false;
  const haystack = `${issue.error} ${issue.code ?? ""} ${issue.category ?? ""} ${issue.status ?? ""}`.toLowerCase();
  return haystack.includes("not_connected") || haystack.includes("drive_not_connected") || haystack.includes("auth");
}

function resolveFolderAndWorkbook(model: Record<string, unknown>): {
  folderId: string;
  tssWorkbook: TssWorkbook | null;
} {
  const cDrive = model.customerDrive as CustomerDrive | null | undefined;
  const meta = model.meta as Record<string, unknown> | null | undefined;
  const metaFolders = Array.isArray(meta?.driveFolders)
    ? (meta?.driveFolders as Array<Record<string, unknown>>)
    : [];

  const folderId =
    String(cDrive?.folderId || "").trim() ||
    String(meta?.driveFolderId || "").trim() ||
    String(metaFolders[0]?.id || "").trim();

  const tssWorkbook = cDrive?.linkedWorkbooks?.tss ?? null;
  return { folderId, tssWorkbook };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PanelHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {subtitle ? (
          <div className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function StatePill({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes}`}>
      {label}
    </span>
  );
}

function WorkbookStateBar({
  folderId,
  hasWorkbook,
  tokenPresent,
  tokenPersistence,
  serverConnected,
  serverStatus,
  iframeState,
}: {
  folderId: string;
  hasWorkbook: boolean;
  tokenPresent: boolean;
  tokenPersistence: string;
  serverConnected: boolean;
  serverStatus: string;
  iframeState?: "loading" | "loaded" | "failed" | "not_started";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatePill label={folderId ? "Folder linked" : "No folder"} tone={folderId ? "green" : "amber"} />
      <StatePill label={hasWorkbook ? "Workbook linked" : "No workbook"} tone={hasWorkbook ? "green" : "amber"} />
      <StatePill
        label={tokenPresent ? `Temporary access: ${tokenPersistence}` : "No temporary access"}
        tone={tokenPresent ? "blue" : "slate"}
      />
      <StatePill
        label={serverConnected ? "Server Drive connected" : `Server Drive: ${serverStatus}`}
        tone={serverConnected ? "green" : serverStatus === "loading" ? "slate" : "amber"}
      />
      {iframeState ? (
        <StatePill
          label={`Frame: ${iframeState.replace("_", " ")}`}
          tone={iframeState === "failed" ? "amber" : iframeState === "loaded" ? "green" : "slate"}
        />
      ) : null}
    </div>
  );
}

function DriveAccessWarning({
  issue,
  tokenPresent,
  connecting,
  onTemporaryConnect,
}: {
  issue?: WorkbookApiIssue | null;
  tokenPresent: boolean;
  connecting: boolean;
  onTemporaryConnect: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">Drive access needs attention</div>
          <div className="mt-0.5 text-amber-800">
            {issue?.hint || issue?.error || "Connect Drive temporarily or adjust your integration settings."}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!tokenPresent ? (
            <button
              type="button"
              className="btn btn-sm border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              disabled={connecting}
              onClick={onTemporaryConnect}
            >
              {connecting ? "Connecting..." : "Connect now"}
            </button>
          ) : null}
          <Link href="/settings" className="btn btn-ghost btn-sm">
            Integration settings
          </Link>
        </div>
      </div>
      {issue?.code || issue?.authMode || issue?.category ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-800">
          {issue.code ? <span>code: <span className="font-mono">{issue.code}</span></span> : null}
          {issue.category ? <span>category: <span className="font-mono">{issue.category}</span></span> : null}
          {issue.authMode ? <span>auth: <span className="font-mono">{issue.authMode}</span></span> : null}
        </div>
      ) : null}
    </div>
  );
}

function UrlInputForm({
  value,
  onChange,
  onSave,
  saving,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-600">Enter Customer Workbook URL</div>
      <div className="flex gap-2">
        <input
          className="input min-w-0 flex-1 text-sm"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving && value.trim()) onSave();
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-primary shrink-0"
          disabled={saving || !value.trim()}
          onClick={onSave}
        >
          {saving ? "Saving..." : "Save Workbook Link"}
        </button>
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CustomerWorkbookPanel({
  customerId,
  model,
  isViewer = false,
  enrollmentId,
}: {
  customerId: string;
  model: Record<string, unknown>;
  isViewer?: boolean;
  enrollmentId?: string;
}) {
  const qc = useQueryClient();
  const { signInWithGoogle } = useAuth();
  const driveStatusQ = useGoogleIntegrationStatus("googleDrive", { staleTime: 60_000 });
  const { folderId, tssWorkbook } = resolveFolderAndWorkbook(model);
  const hasWorkbook = !!(tssWorkbook?.spreadsheetId);
  const [tokenPresent, setTokenPresent] = React.useState(() => !!getGoogleDriveAccessToken());
  const [connectingTemporary, setConnectingTemporary] = React.useState(false);

  // URL input state (used across states 1, 2, 4)
  const [urlInput, setUrlInput] = React.useState("");
  const [urlSaving, setUrlSaving] = React.useState(false);
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [lastIssue, setLastIssue] = React.useState<WorkbookApiIssue | null>(null);

  // Folder candidate listing (state 2)
  const [candidates, setCandidates] = React.useState<FolderItem[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = React.useState(false);
  const [candidatesError, setCandidatesError] = React.useState<string | null>(null);
  const [driveNotConnected, setDriveNotConnected] = React.useState(false);
  const [attachingId, setAttachingId] = React.useState<string | null>(null);

  // Iframe state (state 3 → 4)
  const [iframeLoaded, setIframeLoaded] = React.useState(false);
  const [iframeFailed, setIframeFailed] = React.useState(false);
  const [iframeKey, setIframeKey] = React.useState(0);

  // Change workbook mode (go back to state 2 from state 3)
  const [changingWorkbook, setChangingWorkbook] = React.useState(false);

  // Reset iframe when spreadsheetId changes
  React.useEffect(() => {
    setIframeLoaded(false);
    setIframeFailed(false);
  }, [tssWorkbook?.spreadsheetId]);

  const refreshTokenState = React.useCallback(() => {
    setTokenPresent(!!getGoogleDriveAccessToken());
  }, []);

  const connectTemporaryDrive = React.useCallback(async () => {
    setConnectingTemporary(true);
    try {
      setGoogleDriveTokenPersistence("local");
      await signInWithGoogle();
      refreshTokenState();
      toast("Temporary Drive access connected for this browser.", { type: "success" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Google sign-in failed.", { type: "error" });
    } finally {
      setConnectingTemporary(false);
    }
  }, [refreshTokenState, signInWithGoogle]);

  const invalidateCustomer = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.customers.detail(customerId) });
  }, [qc, customerId]);

  const tokenPersistence = getGoogleDriveTokenPersistence();
  const driveStatus = driveStatusQ.data;
  const serverConnected =
    !!driveStatus && typeof driveStatus === "object" &&
    ((driveStatus as Record<string, unknown>).permissionStatus === "connected" ||
      (driveStatus as Record<string, unknown>).connected === true);
  const serverStatus = driveStatusQ.isLoading
    ? "loading"
    : String((driveStatus as Record<string, unknown> | undefined)?.permissionStatus || "disconnected");

  const stateBar = (iframeState?: "loading" | "loaded" | "failed" | "not_started") => (
    <WorkbookStateBar
      folderId={folderId}
      hasWorkbook={hasWorkbook}
      tokenPresent={tokenPresent}
      tokenPersistence={tokenPersistence}
      serverConnected={serverConnected}
      serverStatus={serverStatus}
      iframeState={iframeState}
    />
  );

  const accessWarning = (issue?: WorkbookApiIssue | null) => (
    <DriveAccessWarning
      issue={issue ?? lastIssue}
      tokenPresent={tokenPresent}
      connecting={connectingTemporary}
      onTemporaryConnect={() => void connectTemporaryDrive()}
    />
  );

  const loadCandidates = React.useCallback(async () => {
    if (!folderId) return;
    setCandidatesLoading(true);
    setCandidatesError(null);
    setDriveNotConnected(false);
    setLastIssue(null);
    refreshTokenState();
    try {
      const resp = await GDrive.list({ folderId });
      if (resp?.ok) {
        setCandidates(workbookCandidatesFromDriveList(resp));
      } else {
        const issue = apiIssue(resp, "Failed to load folder contents");
        setLastIssue(issue);
        if (issueNeedsDriveConnection(issue)) setDriveNotConnected(true);
        setCandidatesError(issue.error);
      }
    } catch (e: any) {
      const issue = apiIssue(e, String(e?.message || "Failed to load folder contents"));
      setLastIssue(issue);
      setCandidatesError(issue.error);
    } finally {
      setCandidatesLoading(false);
    }
  }, [folderId, customerId, refreshTokenState]);

  // Auto-load candidates when folder exists but no workbook
  React.useEffect(() => {
    if (hasWorkbook && !changingWorkbook) return;
    if (!folderId) return;
    if (candidates !== null) return;
    void loadCandidates();
  }, [hasWorkbook, changingWorkbook, folderId, candidates, loadCandidates]);

  const saveWorkbookUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlError(null);
    setUrlSaving(true);
    try {
      const resp = (await api.postWith("attachCustomerWorkbookByUrl" as any, {
        customerId,
        workbookUrl: url,
        ...(enrollmentId ? { enrollmentId } : {}),
      } as any, driveHeaders())) as any;
      if (resp?.ok) {
        setUrlInput("");
        setChangingWorkbook(false);
        setLastIssue(null);
        invalidateCustomer();
      } else {
        const issue = apiIssue(resp, "Failed to link workbook");
        setLastIssue(issue);
        setUrlError(issue.error);
      }
    } catch (e: any) {
      const issue = apiIssue(e, String(e?.message || "Failed to link workbook"));
      setLastIssue(issue);
      setUrlError(issue.error);
    } finally {
      setUrlSaving(false);
    }
  };

  const attachCandidate = async (item: FolderItem) => {
    setAttachingId(item.id);
    setCandidatesError(null);
    try {
      const resp = (await api.postWith("attachCustomerWorkbookCandidate" as any, {
        customerId,
        spreadsheetId: item.id,
        spreadsheetName: item.name,
        ...(enrollmentId ? { enrollmentId } : {}),
      } as any, driveHeaders())) as any;
      if (resp?.ok) {
        setChangingWorkbook(false);
        setLastIssue(null);
        invalidateCustomer();
      } else {
        const issue = apiIssue(resp, "Failed to link workbook");
        setLastIssue(issue);
        setCandidatesError(issue.error);
      }
    } catch (e: any) {
      const issue = apiIssue(e, String(e?.message || "Failed to link workbook"));
      setLastIssue(issue);
      setCandidatesError(issue.error);
    } finally {
      setAttachingId(null);
    }
  };

  const urlInputSection = !isViewer ? (
    <UrlInputForm
      value={urlInput}
      onChange={setUrlInput}
      onSave={() => void saveWorkbookUrl()}
      saving={urlSaving}
      error={urlError}
    />
  ) : null;

  const candidatesSection = folderId ? (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Sheets and folders found in customer folder
      </div>

      {candidatesLoading ? (
        <div className="text-xs text-slate-400">Loading folder contents...</div>
      ) : driveNotConnected ? (
        accessWarning(lastIssue)
      ) : candidatesError ? (
        <div className="space-y-2">
          <div className="text-xs text-red-600">{candidatesError}</div>
          {issueNeedsDriveConnection(lastIssue) ? accessWarning(lastIssue) : null}
          <button
            type="button"
            className="text-xs text-sky-600 underline hover:text-sky-800"
            onClick={() => { setCandidates(null); void loadCandidates(); }}
          >
            Retry
          </button>
        </div>
      ) : candidates !== null && candidates.length === 0 ? (
        <div className="text-xs text-slate-400">
          No Google Sheets found in the linked customer folder.
        </div>
      ) : candidates !== null ? (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {candidates.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{item.name}</div>
                {item.modifiedTime ? (
                  <div className="text-xs text-slate-400">
                    Modified {fmtModified(item.modifiedTime)}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.isSpreadsheet && !isViewer ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={!!attachingId}
                    onClick={() => void attachCandidate(item)}
                  >
                    {attachingId === item.id ? "Linking..." : "Link Workbook"}
                  </button>
                ) : null}
                <a
                  href={item.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  {item.isFolder ? "Open Folder" : "Open"}
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  ) : null;

  // ── State 3: Workbook linked ──────────────────────────────────────────────

  if (hasWorkbook && !changingWorkbook) {
    const workbookName = tssWorkbook!.spreadsheetName || "Linked workbook";
    const openUrl =
      tssWorkbook!.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${tssWorkbook!.spreadsheetId}/edit`;
    const embedUrl = buildEmbedUrl(
      tssWorkbook!.spreadsheetId!,
      tssWorkbook!.progressNotesGid ?? tssWorkbook!.defaultSheetGid,
    );

    return (
      <div className="space-y-3">
        <PanelHeader
          title="Customer Workbook"
          subtitle={workbookName}
          actions={
            <>
              {folderId ? (
                <a
                  href={buildFolderUrl(folderId)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  Open Folder
                </a>
              ) : null}
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-secondary"
              >
                Open Sheet
              </a>
              {!isViewer ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setChangingWorkbook(true);
                    setCandidates(null);
                  }}
                >
                  Change
                </button>
              ) : null}
            </>
          }
        />
        {stateBar(iframeFailed ? "failed" : iframeLoaded ? "loaded" : "loading")}

        {/* State 4: iframe unavailable */}
        {iframeFailed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm text-amber-800">
              The workbook could not be displayed here. Open it in Google Sheets or update the
              workbook URL.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-secondary"
              >
                Open in Google Sheets
              </a>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setIframeFailed(false);
                  setIframeLoaded(false);
                  setIframeKey((k) => k + 1);
                }}
              >
                Try again
              </button>
            </div>
            {accessWarning(null)}
            {!isViewer ? (
              <div className="border-t border-amber-200 pt-3">{urlInputSection}</div>
            ) : null}
          </div>
        ) : (
          /* State 3: Iframe render */
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {!iframeLoaded ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-xs text-slate-400">Loading workbook...</span>
              </div>
            ) : null}
            <iframe
              key={iframeKey}
              src={embedUrl}
              className={[
                "block w-full border-0 transition-opacity duration-200",
                iframeLoaded ? "opacity-100" : "opacity-0 h-0",
              ].join(" ")}
              style={iframeLoaded ? { height: "70dvh", minHeight: 420 } : undefined}
              onLoad={() => setIframeLoaded(true)}
              onError={() => setIframeFailed(true)}
              allow="clipboard-read; clipboard-write"
              title={workbookName}
            />
            {iframeLoaded ? (
              <div className="flex items-center justify-between border-t border-slate-100 bg-white px-3 py-2">
                <span className="text-xs text-slate-400">
                  If the sheet doesn&apos;t load,{" "}
                  <button
                    type="button"
                    className="text-sky-600 underline hover:text-sky-800"
                    onClick={() => setIframeFailed(true)}
                  >
                    switch to manual mode
                  </button>
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // ── State 1: No folder, no workbook ──────────────────────────────────────

  if (!folderId && !changingWorkbook) {
    return (
      <div className="space-y-3">
        <PanelHeader title="Customer Workbook" />
        {stateBar("not_started")}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm text-slate-600">No customer workbook linked.</p>
          {!tokenPresent && !serverConnected ? accessWarning(null) : null}
          {urlInputSection}
        </div>
      </div>
    );
  }

  // ── State 2: Folder exists, no workbook (or changing workbook) ───────────

  const folderSubtitle = changingWorkbook
    ? `Changing workbook · ${tssWorkbook?.spreadsheetName || "Linked workbook"}`
    : "Customer folder found · No workbook linked";

  return (
    <div className="space-y-3">
      <PanelHeader
        title="Customer Workbook"
        subtitle={folderSubtitle}
        actions={
          <>
            {folderId ? (
              <a
                href={buildFolderUrl(folderId)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                Open Folder
              </a>
            ) : null}
            {!isViewer && folderId ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setCandidates(null); void loadCandidates(); }}
                disabled={candidatesLoading}
              >
                {candidatesLoading ? "Loading..." : "Refresh"}
              </button>
            ) : null}
            {changingWorkbook ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setChangingWorkbook(false)}
              >
                Cancel
              </button>
            ) : null}
          </>
        }
      />
      {stateBar("not_started")}

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
        {!tokenPresent && !serverConnected ? accessWarning(null) : null}
        {urlInputSection}
        {candidatesSection}
      </div>
    </div>
  );
}
