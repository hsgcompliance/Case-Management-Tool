"use client";

// Canonical Drive auth-state banner.
// Handles every auth condition that can appear on Drive-using feature panels:
//   oauth_scope        — connected but missing specific permissions (Drive / Sheets)
//   not_connected      — permanent Drive not set up at all
//   needs_reconnect    — token revoked / expired
//   auth_mode_read_only — shared OAuth fallback active (write operations blocked)
//   temporary_missing  — temporary mode selected but no browser token yet
//   general            — any other Drive-related hint (hint text only)
//
// Does NOT handle Settings-page integration toggles — that stays in IntegrationToggle.

import React from "react";
import Link from "next/link";
import { PermissionErrorBanner, isScopeError } from "@entities/ui/PermissionErrorBanner";
import type { ScopeErrorPayload } from "@entities/ui/PermissionErrorBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DriveAuthIssue = {
  error?: string;
  category?: string;
  hint?: string;
  missingPermissions?: string[];
  missingScopes?: string[];
  reconnectService?: "googleDrive" | "googleCalendar";
  authMode?: string;
  code?: string;
  status?: string;
};

export type DriveAuthBannerProps = {
  /** API error object returned from a Drive or workbook endpoint. */
  issue?: DriveAuthIssue | null;
  /** Whether the permanent server-side Drive OAuth is connected. */
  serverConnected?: boolean;
  serverStatus?: string;
  /** Whether a temporary browser token is present. */
  temporaryTokenPresent?: boolean;
  temporaryPersistence?: string;
  // Actions
  onReauthorize?: () => void;
  onConnectPermanent?: () => void;
  onConnectTemporary?: () => void;
  reauthorizing?: boolean;
  connectingTemporary?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function needsConnection(issue: DriveAuthIssue): boolean {
  const hay = `${issue.error ?? ""} ${issue.code ?? ""} ${issue.category ?? ""} ${issue.status ?? ""}`.toLowerCase();
  return (
    hay.includes("not_connected") ||
    hay.includes("drive_not_connected") ||
    hay.includes("auth")
  );
}

function isReadOnly(issue: DriveAuthIssue): boolean {
  return (
    issue.category === "auth_mode_read_only" ||
    String(issue.error ?? "").includes("shared_oauth_read_only")
  );
}

function isNeedsReconnect(issue: DriveAuthIssue): boolean {
  return (
    issue.category === "needs_reconnect" ||
    String(issue.error ?? "").includes("needs_reconnect") ||
    String(issue.error ?? "").includes("token_revoked")
  );
}

// ── Sub-variants ──────────────────────────────────────────────────────────────

function BannerShell({
  tone,
  title,
  body,
  actions,
}: {
  tone: "amber" | "sky" | "red";
  title: string;
  body: string;
  actions?: React.ReactNode;
}) {
  const colors = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    sky:   "border-sky-200 bg-sky-50 text-sky-900",
    red:   "border-red-200 bg-red-50 text-red-900",
  }[tone];
  const bodyColor = {
    amber: "text-amber-800",
    sky:   "text-sky-800",
    red:   "text-red-800",
  }[tone];
  const btnColor = {
    amber: "border-amber-300 bg-white text-amber-900 hover:bg-amber-100",
    sky:   "border-sky-300 bg-white text-sky-900 hover:bg-sky-100",
    red:   "border-red-300 bg-white text-red-900 hover:bg-red-100",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2.5 text-xs ${colors}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="font-semibold">{title}</div>
          <div className={bodyColor}>{body}</div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {React.Children.map(actions, (child) =>
              React.isValidElement(child)
                ? React.cloneElement(child as React.ReactElement<{ className?: string }>, {
                    className: `${(child as React.ReactElement<{ className?: string }>).props.className ?? ""} rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${btnColor}`.trim(),
                  })
                : child
            )}
            <Link
              href="/settings"
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            >
              Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Drop-in Drive auth banner. Reads the issue payload and renders the correct
 * variant. Returns null when there is no actionable auth problem to show.
 */
export function DriveAuthBanner({
  issue,
  serverConnected,
  serverStatus,
  temporaryTokenPresent,
  onReauthorize,
  onConnectPermanent,
  onConnectTemporary,
  reauthorizing = false,
  connectingTemporary = false,
}: DriveAuthBannerProps) {

  // 1. Scope error — named permission blocked
  if (issue && isScopeError(issue)) {
    return (
      <PermissionErrorBanner
        payload={issue as ScopeErrorPayload}
        onReauthorize={onReauthorize}
        reauthorizing={reauthorizing}
      />
    );
  }

  // 2. Needs reconnect / revoked
  if (issue && isNeedsReconnect(issue)) {
    return (
      <BannerShell
        tone="amber"
        title="Google Drive needs reconnection"
        body={issue.hint ?? "Your Drive access has expired or been revoked. Reconnect to restore access."}
        actions={
          onConnectPermanent ? (
            <button type="button" disabled={reauthorizing} onClick={onConnectPermanent}>
              {reauthorizing ? "Connecting…" : "Reconnect Drive"}
            </button>
          ) : undefined
        }
      />
    );
  }

  // 3. Read-only / shared OAuth
  if (issue && isReadOnly(issue)) {
    return (
      <BannerShell
        tone="amber"
        title="Read-only Drive access"
        body="The current Drive connection is read-only. Connect Google Drive permanently to create folders, upload files, or write to sheets."
        actions={
          onConnectPermanent ? (
            <button type="button" disabled={reauthorizing} onClick={onConnectPermanent}>
              {reauthorizing ? "Connecting…" : "Connect Drive"}
            </button>
          ) : undefined
        }
      />
    );
  }

  // 4. Not connected / connection required
  if (issue && needsConnection(issue)) {
    return (
      <BannerShell
        tone="amber"
        title="Drive access needed"
        body={issue.hint ?? "Connect Google Drive to use this feature."}
        actions={
          <>
            {onConnectTemporary && !temporaryTokenPresent ? (
              <button type="button" disabled={connectingTemporary} onClick={onConnectTemporary}>
                {connectingTemporary ? "Connecting…" : "Connect now"}
              </button>
            ) : null}
            {onConnectPermanent ? (
              <button type="button" disabled={reauthorizing} onClick={onConnectPermanent}>
                {reauthorizing ? "Connecting…" : "Connect permanently"}
              </button>
            ) : null}
          </>
        }
      />
    );
  }

  // 5. No server connection and no token — soft nudge
  if (!serverConnected && !temporaryTokenPresent && serverStatus !== "loading") {
    if (!issue) return null; // no issue and no auth = let parent decide
    return (
      <BannerShell
        tone="amber"
        title="Drive access needs attention"
        body={issue.hint ?? issue.error ?? "Connect Drive temporarily or adjust your integration settings."}
        actions={
          <>
            {onConnectTemporary ? (
              <button type="button" disabled={connectingTemporary} onClick={onConnectTemporary}>
                {connectingTemporary ? "Connecting…" : "Connect now"}
              </button>
            ) : null}
          </>
        }
      />
    );
  }

  // 6. General hint-only issue
  if (issue?.hint || issue?.error) {
    return (
      <BannerShell
        tone="amber"
        title="Drive issue"
        body={issue.hint ?? issue.error ?? "An issue occurred with Drive access."}
      />
    );
  }

  return null;
}

/** True when an issue object indicates any Drive auth problem (not just scope). */
export function isDriveAuthIssue(issue: unknown): boolean {
  if (!issue || typeof issue !== "object") return false;
  const p = issue as DriveAuthIssue;
  return isScopeError(p) || needsConnection(p) || isReadOnly(p) || isNeedsReconnect(p);
}
