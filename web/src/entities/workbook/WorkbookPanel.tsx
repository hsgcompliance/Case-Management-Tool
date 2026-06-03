"use client";

// WorkbookPanel — canonical customer workbook section.
//
// Composes WorkbookEmbed + WorkbookLinkControls + DriveAuthBanner.
// State machine:
//   linked     → WorkbookEmbed (with change/unlink actions in header)
//   not linked → WorkbookLinkControls (URL input + Drive folder candidates)
//   no folder  → WorkbookLinkControls (URL input only)
//
// This is the component to drop into customer detail panels.
// CustomerWorkbookPanel.tsx re-exports this for backwards compat.

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import { useGoogleIntegrationStatus, useGoogleIntegrationConnect } from "@hooks/useGoogleIntegrations";
import { qk } from "@hooks/queryKeys";
import {
  getGoogleDriveAccessToken,
  setGoogleDriveTokenPersistence,
} from "@lib/googleDriveAccessToken";
import { toast } from "@lib/toast";
import { WorkbookEmbed } from "./WorkbookEmbed";
import { WorkbookLinkControls } from "./WorkbookLinkControls";
import type { WorkbookLinkIssue } from "./WorkbookLinkControls";
import { WorkbookStructuredView } from "./WorkbookStructuredView";
import { DriveAuthBanner } from "@entities/gdrive/DriveAuthBanner";

type WorkbookView = "sheet" | "structured";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function resolveFolderAndWorkbook(model: Record<string, unknown>): {
  folderId: string;
  tssWorkbook: TssWorkbook | null;
} {
  const cDrive = model.customerDrive as CustomerDrive | null | undefined;
  const meta   = model.meta as Record<string, unknown> | null | undefined;
  const metaFolders = Array.isArray(meta?.driveFolders)
    ? (meta?.driveFolders as Array<Record<string, unknown>>)
    : [];

  // Keep this aligned with docs/active-projects.local/google-integrations:
  // customerDrive.folderId is the current primary pointer, with legacy meta
  // fields read only as fallbacks for migrated records.
  const folderId =
    String(cDrive?.folderId || "").trim() ||
    String(meta?.driveFolderId || "").trim() ||
    String(metaFolders[0]?.id || "").trim();

  const tssWorkbook = cDrive?.linkedWorkbooks?.tss ?? null;
  return { folderId, tssWorkbook };
}

function buildFolderUrl(id: string) {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
}

// ── Status chips ──────────────────────────────────────────────────────────────

function StatusChip({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "slate" | "green" | "amber" | "blue";
}) {
  const cls = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue:  "border-sky-200 bg-sky-50 text-sky-700",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function StatusBar({
  folderId,
  hasWorkbook,
  serverConnected,
  serverStatus,
  tokenPresent,
  onConnect,
  connecting,
}: {
  folderId: string;
  hasWorkbook: boolean;
  serverConnected: boolean;
  serverStatus: string;
  tokenPresent: boolean;
  onConnect?: () => void;
  connecting?: boolean;
}) {
  // Connection: server (per-user OAuth) → local (temp browser token) → none.
  const connection: "server" | "local" | "none" | "loading" =
    serverStatus === "loading" ? "loading"
      : serverConnected ? "server"
      : tokenPresent ? "local"
      : "none";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusChip
        label={folderId ? "Folder linked" : "No folder"}
        tone={folderId ? "green" : "amber"}
      />
      <StatusChip
        label={hasWorkbook ? "Workbook linked" : "No workbook"}
        tone={hasWorkbook ? "green" : "amber"}
      />
      {connection === "server" ? (
        <StatusChip label="Connection: Server" tone="green" />
      ) : connection === "local" ? (
        <StatusChip label="Connection: Local" tone="blue" />
      ) : connection === "loading" ? (
        <StatusChip label="Connection: …" tone="slate" />
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <StatusChip label="No connection" tone="amber" />
          {onConnect ? (
            <button
              type="button"
              className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
              disabled={connecting}
              onClick={onConnect}
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          ) : null}
        </span>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export type WorkbookPanelProps = {
  customerId: string;
  model: Record<string, unknown>;
  isViewer?: boolean;
  enrollmentId?: string;
};

/**
 * Full workbook section for customer detail panels.
 * Composes embed, link controls, and Drive auth banners.
 */
export function WorkbookPanel({
  customerId,
  model,
  isViewer = false,
  enrollmentId,
}: WorkbookPanelProps) {
  const qc             = useQueryClient();
  const { signInWithGoogle } = useAuth();
  const driveStatusQ   = useGoogleIntegrationStatus("googleDrive", { staleTime: 60_000 });
  const driveConnect   = useGoogleIntegrationConnect("googleDrive");

  const { folderId, tssWorkbook } = resolveFolderAndWorkbook(model);
  const hasWorkbook = !!(tssWorkbook?.spreadsheetId);

  const [tokenPresent,        setTokenPresent]        = React.useState(() => !!getGoogleDriveAccessToken());
  const [connectingTemporary, setConnectingTemporary] = React.useState(false);
  const [changingWorkbook,    setChangingWorkbook]     = React.useState(false);
  const [authIssue,           setAuthIssue]            = React.useState<WorkbookLinkIssue | null>(null);
  // Sheet (iframe) is the default/trusted view; Structured is the native render.
  const [workbookView,        setWorkbookView]         = React.useState<WorkbookView>("sheet");

  const refreshToken = React.useCallback(() => setTokenPresent(!!getGoogleDriveAccessToken()), []);

  // Reset change-mode when workbook changes externally
  React.useEffect(() => {
    if (hasWorkbook) setChangingWorkbook(false);
  }, [hasWorkbook]);

  const connectTemporary = async () => {
    setConnectingTemporary(true);
    try {
      setGoogleDriveTokenPersistence("local");
      await signInWithGoogle();
      refreshToken();
      toast("Temporary Drive access connected.", { type: "success" });
    } catch {
      toast("Google sign-in failed.", { type: "error" });
    } finally {
      setConnectingTemporary(false);
    }
  };

  const invalidateCustomer = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.customers.detail(customerId) });
  }, [qc, customerId]);

  const driveStatus    = driveStatusQ.data as Record<string, unknown> | undefined;
  const serverConnected = !!(driveStatus?.permissionStatus === "connected" || driveStatus?.connected === true);
  const serverStatus    = driveStatusQ.isLoading ? "loading" : String(driveStatus?.permissionStatus ?? "disconnected");

  const openUrl = tssWorkbook?.spreadsheetUrl ||
    (tssWorkbook?.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${tssWorkbook.spreadsheetId}/edit`
      : undefined);

  const gid = tssWorkbook?.progressNotesGid ?? tssWorkbook?.defaultSheetGid;

  // ── Linked state ─────────────────────────────────────────────────────────
  if (hasWorkbook && !changingWorkbook) {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900">Customer Workbook</h4>
            {tssWorkbook!.spreadsheetName ? (
              <div className="mt-0.5 truncate text-xs text-slate-500">{tssWorkbook!.spreadsheetName}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* View toggle — Sheet (iframe, trusted default) ↔ Structured (native) */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 font-medium transition ${workbookView === "sheet" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setWorkbookView("sheet")}
              >
                Sheet
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 font-medium transition ${workbookView === "structured" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setWorkbookView("structured")}
              >
                Structured
              </button>
            </div>
            {folderId ? (
              <a href={buildFolderUrl(folderId)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                Folder ↗
              </a>
            ) : null}
            {openUrl ? (
              <a href={openUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">
                Open Sheet ↗
              </a>
            ) : null}
            {!isViewer ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setChangingWorkbook(true); setAuthIssue(null); }}
              >
                Change
              </button>
            ) : null}
          </div>
        </div>

        <StatusBar
          folderId={folderId}
          hasWorkbook={hasWorkbook}
          serverConnected={serverConnected}
          serverStatus={serverStatus}
          tokenPresent={tokenPresent}
          onConnect={() => void driveConnect.mutateAsync().catch(() => null)}
          connecting={driveConnect.isPending}
        />

        {authIssue && (
          <DriveAuthBanner
            issue={authIssue}
            serverConnected={serverConnected}
            serverStatus={serverStatus}
            temporaryTokenPresent={tokenPresent}
            onReauthorize={() => void driveConnect.mutateAsync().catch(() => null)}
            onConnectTemporary={() => void connectTemporary()}
            reauthorizing={driveConnect.isPending}
            connectingTemporary={connectingTemporary}
          />
        )}

        {workbookView === "structured" ? (
          <WorkbookStructuredView
            customerId={customerId}
            customerName={
              String((model.name as string) || "").trim() ||
              [model.firstName, model.lastName].filter(Boolean).join(" ").trim() ||
              undefined
            }
            onOpenSheet={() => setWorkbookView("sheet")}
          />
        ) : (
          <WorkbookEmbed
            spreadsheetId={tssWorkbook!.spreadsheetId!}
            gid={gid}
            spreadsheetName={tssWorkbook!.spreadsheetName ?? "Workbook"}
            spreadsheetUrl={openUrl}
          />
        )}
      </div>
    );
  }

  // ── Unlinked / changing state ─────────────────────────────────────────────
  const subtitle = changingWorkbook
    ? `Changing · ${tssWorkbook?.spreadsheetName ?? "current workbook"}`
    : folderId
      ? "Customer folder found — no workbook linked"
      : "No workbook linked";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900">Customer Workbook</h4>
          <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {folderId ? (
            <a href={buildFolderUrl(folderId)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              Folder ↗
            </a>
          ) : null}
          {changingWorkbook ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChangingWorkbook(false)}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <StatusBar
        folderId={folderId}
        hasWorkbook={hasWorkbook}
        serverConnected={serverConnected}
        serverStatus={serverStatus}
        tokenPresent={tokenPresent}
        onConnect={() => void driveConnect.mutateAsync().catch(() => null)}
        connecting={driveConnect.isPending}
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
        {authIssue && (
          <DriveAuthBanner
            issue={authIssue}
            serverConnected={serverConnected}
            serverStatus={serverStatus}
            temporaryTokenPresent={tokenPresent}
            onReauthorize={() => void driveConnect.mutateAsync().catch(() => null)}
            onConnectTemporary={() => void connectTemporary()}
            reauthorizing={driveConnect.isPending}
            connectingTemporary={connectingTemporary}
          />
        )}

        {!tokenPresent && !serverConnected && !authIssue ? (
          <DriveAuthBanner
            serverConnected={false}
            serverStatus={serverStatus}
            temporaryTokenPresent={false}
            onConnectTemporary={() => void connectTemporary()}
            onConnectPermanent={() => void driveConnect.mutateAsync().catch(() => null)}
            connectingTemporary={connectingTemporary}
            reauthorizing={driveConnect.isPending}
            issue={{ error: "drive_not_connected" }}
          />
        ) : null}

        <WorkbookLinkControls
          customerId={customerId}
          folderId={folderId || null}
          enrollmentId={enrollmentId}
          isViewer={isViewer}
          onLinked={invalidateCustomer}
          onAuthIssue={setAuthIssue}
        />
      </div>
    </div>
  );
}
