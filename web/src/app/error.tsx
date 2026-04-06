//web/src/app/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AppError:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
        <h1 className="text-xl font-semibold text-rose-900">Application Error</h1>
        <p className="mt-2 text-sm text-rose-800">
          Something failed while rendering this page. You can retry or return home.
        </p>
        {error?.digest ? (
          <p className="mt-2 text-xs text-rose-700">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button className="btn btn-sm" onClick={reset}>
            Retry
          </button>
          <Link href="/" className="btn btn-secondary btn-sm">
            Go Home
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
            Hard Refresh
          </button>
        </div>
      </div>
    </main>
  );
}
