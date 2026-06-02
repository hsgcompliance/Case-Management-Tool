"use client";

// Renders a Google Sheets iframe embed with loading skeleton and failed-state
// fallback. Has no auth awareness — auth banners belong in the parent panel.

import React from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEmbedUrl(spreadsheetId: string, gid?: string | number | null): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const gidStr = gid != null ? String(gid).trim() : "";
  return gidStr ? `${base}#gid=${gidStr}` : base;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
      <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function FailedState({
  openUrl,
  spreadsheetName,
  onRetry,
  children,
}: {
  openUrl: string;
  spreadsheetName: string;
  onRetry: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="text-sm text-amber-800">
        The workbook could not be displayed here. Open it in Google Sheets or update the workbook URL.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-sm btn-secondary"
        >
          Open {spreadsheetName} ↗
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          Try again
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export type WorkbookEmbedProps = {
  spreadsheetId: string;
  /** Numeric GID of the sheet tab to show. Omit to use the default tab. */
  gid?: string | number | null;
  spreadsheetName?: string;
  /** Full edit URL — used for the "Open" button when embed fails. */
  spreadsheetUrl?: string;
  /** Rendered below the failed-state message (e.g. a URL change form). */
  failedChildren?: React.ReactNode;
};

/**
 * Embeds a Google Sheets document in an iframe.
 *
 * Manages its own load/error state. When the iframe fails to load (blocked by
 * Google's X-Frame-Options in some contexts), shows a fallback with an
 * external-link button and a retry option.
 */
export function WorkbookEmbed({
  spreadsheetId,
  gid,
  spreadsheetName = "Workbook",
  spreadsheetUrl,
  failedChildren,
}: WorkbookEmbedProps) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [iframeKey, setIframeKey] = React.useState(0);

  // Reset when spreadsheetId changes (different workbook linked)
  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [spreadsheetId]);

  const openUrl =
    spreadsheetUrl ||
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const embedUrl = buildEmbedUrl(spreadsheetId, gid);

  const retry = () => {
    setFailed(false);
    setLoaded(false);
    setIframeKey((k) => k + 1);
  };

  if (failed) {
    return (
      <FailedState openUrl={openUrl} spreadsheetName={spreadsheetName} onRetry={retry}>
        {failedChildren}
      </FailedState>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      {!loaded && <LoadingSkeleton />}
      <iframe
        key={iframeKey}
        src={embedUrl}
        className={[
          "block w-full border-0 transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0 h-0",
        ].join(" ")}
        style={loaded ? { height: "70dvh", minHeight: 420 } : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        allow="clipboard-read; clipboard-write"
        title={spreadsheetName}
      />
      {loaded && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-3 py-2">
          <span className="text-xs text-slate-400">
            If the sheet doesn&apos;t load,{" "}
            <button
              type="button"
              className="text-sky-600 underline hover:text-sky-800"
              onClick={() => setFailed(true)}
            >
              switch to manual mode
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
