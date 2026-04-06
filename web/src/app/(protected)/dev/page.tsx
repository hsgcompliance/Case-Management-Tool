 "use client";

import Link from "next/link";
import { useAuth } from "@app/auth/AuthProvider";
import { isSuperDevLike } from "@lib/roles";

export default function DevIndexPage() {
  const { profile } = useAuth();
  const canOrgManage = isSuperDevLike(profile as { topRole?: unknown; role?: unknown; roles?: unknown } | null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dev Pages</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Internal developer tools and diagnostics.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dev/functions"
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300"
          >
            Endpoints
          </Link>
          {canOrgManage ? (
            <Link
              href="/dev/org-manager"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              Org Manager
            </Link>
          ) : null}
          <Link
            href="/admin/debug"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Debug Tokens
          </Link>
        </div>
      </div>
    </div>
  );
}
