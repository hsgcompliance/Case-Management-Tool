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
import api from "@client/api";
import { useAuth } from "@app/auth/AuthProvider";
import { useGoogleIntegrationStatus, useGoogleIntegrationConnect } from "@hooks/useGoogleIntegrations";
import { useResolvedDriveConfig } from "@hooks/useResolvedDriveConfig";
import { qk } from "@hooks/queryKeys";
import {
  getGoogleDriveAccessToken,
  setGoogleDriveTokenPersistence,
} from "@lib/googleDriveAccessToken";
import { isGoogleReauthError, GOOGLE_REAUTH_ISSUE } from "@lib/googleAuthError";
import { toast } from "@lib/toast";
import { WorkbookSheetModal } from "./WorkbookSheetModal";
import { WorkbookLinkControls } from "./WorkbookLinkControls";
import type { WorkbookLinkIssue } from "./WorkbookLinkControls";
import { WorkbookStructuredView } from "./WorkbookStructuredView";
import { DriveAuthBanner } from "@entities/gdrive/DriveAuthBanner";
import { isScopeError, type ScopeErrorPayload } from "@entities/ui/PermissionErrorBanner";
import {
  WorkbookVariantDialog,
  type WorkbookTemplateVariant,
} from "./WorkbookVariantDialog";
import { WorkbookVariantToggle } from "./WorkbookVariantToggle";
import { ExternalServiceIcon } from "@entities/gdrive/FileTypeIcon";

type WorkbookView = "sheet" | "structured";

// ── Helpers ───────────────────────────────────────────────────────────────────

type TssWorkbook = {
  spreadsheetId?: string | null;
  spreadsheetUrl?: string | null;
  spreadsheetName?: string | null;
  status?: string | null;
  defaultSheetGid?: string | number | null;
  progressNotesGid?: string | number | null;
  variant?: string | null;
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

// ── Create-from-template control ────────────────────────────────────────────────

function apiIssueOf(resp: unknown, fallback: string): WorkbookLinkIssue {
  const r = resp && typeof resp === "object" ? (resp as Record<string, unknown>) : {};
  return {
    error:              typeof r.error === "string" ? r.error : fallback,
    category:           typeof r.category === "string" ? r.category : undefined,
    hint:               typeof r.hint === "string" ? r.hint : undefined,
    missingPermissions: Array.isArray(r.missingPermissions) ? (r.missingPermissions as string[]) : undefined,
    reconnectService:   typeof r.reconnectService === "string" ? r.reconnectService : undefined,
  };
}

/**
 * "Create from TSS template" — copies the org's configured TSS workbook template
 * (payer / non-payer variant) into the customer's folder and links it. Shown only
 * when a folder is linked and the org has a usable tss_workbook template.
 */
function WorkbookTemplateCreate({
  customerId,
  enrollmentId,
  hasVariants,
  onLinked,
  onAuthIssue,
}: {
  customerId: string;
  enrollmentId?: string;
  hasVariants: boolean;
  onLinked: () => void;
  onAuthIssue?: (issue: WorkbookLinkIssue) => void;
}) {
  const [variant, setVariant] = React.useState<WorkbookTemplateVariant>("nonpayer");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const surfaceAuthIssue = React.useCallback((issue: WorkbookLinkIssue): boolean => {
    if (!onAuthIssue) return false;
    if (isGoogleReauthError(issue.error)) { onAuthIssue({ ...GOOGLE_REAUTH_ISSUE }); return true; }
    if (isScopeError(issue)) { onAuthIssue(issue as ScopeErrorPayload); return true; }
    return false;
  }, [onAuthIssue]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const tok = getGoogleDriveAccessToken();
      const resp = (await (api as any).postWith(
        "copyCustomerWorkbookFromTemplate",
        { customerId, variant, ...(enrollmentId ? { enrollmentId } : {}) },
        tok ? { "x-drive-access-token": tok } : undefined,
      )) as Record<string, unknown>;
      if (resp?.ok) {
        toast("TSS workbook created from template.", { type: "success" });
        setDialogOpen(false);
        onLinked();
      } else {
        const issue = apiIssueOf(resp, "Failed to create workbook from template");
        if (!surfaceAuthIssue(issue)) setError(issue.error || "Failed to create workbook from template");
      }
    } catch (e: unknown) {
      const issue = apiIssueOf(e, String((e as Error)?.message || "Failed to create workbook from template"));
      if (!surfaceAuthIssue(issue)) setError(issue.error || "Failed to create workbook from template");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-600">Create from TSS template</div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            Copies the template into this customer&apos;s Drive folder and links it as their workbook.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary shrink-0"
          disabled={busy}
          onClick={() => {
            if (hasVariants) setDialogOpen(true);
            else void run();
          }}
        >
          {busy ? "Creating..." : "Create new workbook from template"}
        </button>
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
      <div className="text-[11px] text-slate-400">
        Future App Script library work should add convert-to-payer and convert-to-non-payer actions for existing workbooks.
      </div>
      <WorkbookVariantDialog
        open={dialogOpen}
        variant={variant}
        busy={busy}
        onVariantChange={setVariant}
        onConfirm={() => void run()}
        onClose={() => setDialogOpen(false)}
      />
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

  // TSS template availability — drives the "Create from TSS template" action shown
  // when no workbook is linked. Only usable when the org's tss_workbook template
  // actually carries a source file id (env fallback is empty until configured).
  const { templates: driveTemplates } = useResolvedDriveConfig();
  const tssTemplate = React.useMemo(
    () => driveTemplates.find((t) => t.role === "tssWorkbook"),
    [driveTemplates],
  );
  const tssTemplateReady = !!(
    tssTemplate &&
    (tssTemplate.variants?.payer || tssTemplate.variants?.nonpayer || tssTemplate.fileId)
  );
  const tssTemplateHasVariants = !!(tssTemplate?.variants?.payer || tssTemplate?.variants?.nonpayer);

  const [tokenPresent,        setTokenPresent]        = React.useState(() => !!getGoogleDriveAccessToken());
  const [connectingTemporary, setConnectingTemporary] = React.useState(false);
  const [changingWorkbook,    setChangingWorkbook]     = React.useState(false);
  const [authIssue,           setAuthIssue]            = React.useState<WorkbookLinkIssue | null>(null);
  // Sheet (iframe) is the default/trusted view; Structured is the native render.
  const [workbookView,        setWorkbookView]         = React.useState<WorkbookView>("sheet");
  const [sheetModalOpen,      setSheetModalOpen]       = React.useState(false);

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
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Customer Workbook</h4>
              <WorkbookVariantToggle
                customerId={customerId}
                variant={tssWorkbook?.variant}
                isViewer={isViewer}
                onChanged={invalidateCustomer}
              />
            </div>
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
                <ExternalServiceIcon service="drive" />
                Folder
              </a>
            ) : null}
            {openUrl ? (
              <a href={openUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">
                <ExternalServiceIcon service="sheets" />
                Open Sheet
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
            onConnectPermanent={() => void driveConnect.mutateAsync().catch(() => null)}
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
            suggestedIdentity={{
              clientName:
                String((model.name as string) || "").trim() ||
                [model.firstName, model.lastName].filter(Boolean).join(" ").trim() ||
                undefined,
              dob: String((model.dob as string) || "").trim() || undefined,
              hmisCwId:
                String((model.cwId as string) || "").trim() ||
                String((model.hmisId as string) || "").trim() ||
                undefined,
            }}
            onOpenSheet={() => setWorkbookView("sheet")}
          />
        ) : (
          <>
            {/* Click-to-open card — opens the sheet in a frozen/detachable modal */}
            <button
              type="button"
              onClick={() => setSheetModalOpen(true)}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-left transition hover:border-sky-300 hover:bg-sky-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>📄</span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {tssWorkbook!.spreadsheetName ?? "Open the workbook sheet"}
                  </div>
                  <div className="text-xs text-slate-500">
                    Click to open — full screen, with a detachable window.
                  </div>
                </div>
              </div>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 group-hover:border-sky-300 group-hover:text-sky-700">
                <span className="inline-flex items-center gap-1.5">
                  <ExternalServiceIcon service="sheets" />
                  Open sheet
                </span>
              </span>
            </button>

            {sheetModalOpen ? (
              <WorkbookSheetModal
                spreadsheetId={tssWorkbook!.spreadsheetId!}
                gid={gid}
                spreadsheetName={tssWorkbook!.spreadsheetName ?? "Workbook"}
                openUrl={openUrl}
                onClose={() => setSheetModalOpen(false)}
                onSwitchToStructured={() => { setSheetModalOpen(false); setWorkbookView("structured"); }}
              />
            ) : null}
          </>
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
              <ExternalServiceIcon service="drive" />
              Folder
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
            onConnectPermanent={() => void driveConnect.mutateAsync().catch(() => null)}
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

        {!isViewer && folderId && tssTemplateReady ? (
          <WorkbookTemplateCreate
            customerId={customerId}
            enrollmentId={enrollmentId}
            hasVariants={tssTemplateHasVariants}
            onLinked={invalidateCustomer}
            onAuthIssue={setAuthIssue}
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
