"use client";

import React from "react";
import Link from "next/link";

export type ScopeErrorPayload = {
  category?: string;
  missingPermissions?: string[];
  missingScopes?: string[];
  reconnectService?: "googleDrive" | "googleCalendar";
  hint?: string;
  error?: string;
};

/**
 * Shown when a Drive or Sheets API call returns category:"oauth_scope".
 * Names the specific blocked permission and offers a Re-authorize button
 * that re-opens the OAuth consent screen for the affected service.
 */
export function PermissionErrorBanner({
  payload,
  onReauthorize,
  reauthorizing = false,
}: {
  payload: ScopeErrorPayload;
  onReauthorize?: () => void;
  reauthorizing?: boolean;
}) {
  const permissions = payload.missingPermissions ?? [];
  const hasNamedPermissions = permissions.length > 0;
  const label =
    hasNamedPermissions
      ? permissions.join(" and ")
      : payload.reconnectService === "googleDrive"
        ? "Google Drive access"
        : "Google integration access";

  const hint =
    payload.hint ||
    `${label} ${permissions.length === 1 ? "was" : "were"} not granted during setup.`;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="font-semibold">
            {hasNamedPermissions
              ? `${label} not granted`
              : "Google permission required"}
          </div>
          <div className="text-amber-800">{hint}</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onReauthorize ? (
            <button
              type="button"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
              disabled={reauthorizing}
              onClick={onReauthorize}
            >
              {reauthorizing ? "Opening..." : "Re-authorize"}
            </button>
          ) : null}
          <Link href="/settings" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            Integration settings
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Returns true when an error response payload indicates a scope/permission error. */
export function isScopeError(payload: unknown): payload is ScopeErrorPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return p.category === "oauth_scope" || p.error === "oauth_scope_missing";
}
