"use client";

import React from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("GlobalErrorBoundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              The app hit an unexpected error. Try reloading the page.
            </p>
            {error?.digest ? (
              <p className="mt-2 text-xs text-slate-500">Error ref: {error.digest}</p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button className="btn btn-sm" onClick={reset}>
                Retry
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
                Reload
              </button>
              <Link href="/" className="btn btn-secondary btn-sm">
                Home
              </Link>
            </div>
            <details className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm text-slate-700">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-700">
                {String(error?.message || "unknown_error")}
              </pre>
            </details>
          </div>
        </main>
      </body>
    </html>
  );
}
