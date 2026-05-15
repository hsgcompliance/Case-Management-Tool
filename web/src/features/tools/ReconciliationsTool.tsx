"use client";

import React from "react";

const RECONCILIATION_APP_URL =
  "https://script.google.com/a/macros/thehrdc.org/s/AKfycbwbMYmJwIwFakrLfp22CJpc6VVfAs8CfVjn7QtOnZA/dev";

export function ReconciliationsMain() {
  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Reconciliations</h2>
          <div className="text-xs text-slate-500 dark:text-slate-400">Google Apps Script workspace</div>
        </div>
        <a
          className="btn btn-xs btn-ghost"
          href={RECONCILIATION_APP_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open in Google
        </a>
      </div>
      <iframe
        title="Reconciliation app"
        src={RECONCILIATION_APP_URL}
        className="min-h-[720px] flex-1 border-0 bg-white"
        referrerPolicy="no-referrer-when-downgrade"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
