"use client";

import React from "react";

export function ReconciliationsMain() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-4xl">🔄</div>
      <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Reconciliations</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        Manual reconciliation tools — data review, mismatch resolution, and audit exports.
        Coming soon.
      </p>
    </div>
  );
}
