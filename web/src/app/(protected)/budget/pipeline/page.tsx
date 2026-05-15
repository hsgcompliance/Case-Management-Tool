// src/app/(protected)/budget/pipeline/page.tsx
"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePipelines, usePipelineDelete } from "@hooks/useBudgetPipeline";
import { toast } from "@lib/toast";
import type { TBudgetPipeline } from "@types";

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

function StatusDot({ status }: { status: TBudgetPipeline["status"] }) {
  const cls: Record<string, string> = {
    active:   "bg-emerald-500",
    draft:    "bg-slate-400",
    inactive: "bg-amber-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${cls[status] ?? "bg-slate-400"}`} />;
}

export default function PipelineListPage() {
  const router = useRouter();
  const { data: pipelines = [], isLoading } = usePipelines();
  const del = usePipelineDelete();

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete pipeline "${name}"?`)) return;
    try {
      await del.mutateAsync(id);
      toast(`Deleted "${name}".`, { type: "success" });
    } catch {
      toast("Failed to delete pipeline.", { type: "error" });
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Budget Pipelines</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Rule-based pipelines that classify payment queue items to grant line items.
          </p>
        </div>
        <Link
          href="/budget/pipeline/new"
          className="btn btn-sm btn-primary"
        >
          + New Pipeline
        </Link>
      </div>

      {isLoading && (
        <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500">Loading…</div>
      )}

      {!isLoading && (pipelines as TBudgetPipeline[]).length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-16 text-center space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">No pipelines yet.</p>
          <Link href="/budget/pipeline/new" className="btn btn-sm btn-primary">
            Create your first pipeline
          </Link>
        </div>
      )}

      {(pipelines as TBudgetPipeline[]).length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Grant</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Form</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Rules</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Updated</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {(pipelines as TBudgetPipeline[]).map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  onClick={() => router.push(`/budget/pipeline/${p.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    {p.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={p.status} />
                      <span className="text-slate-600 dark:text-slate-400 capitalize">{p.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono">
                    {p.grantId ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[120px] truncate">
                    {p.sourceFormTitle ?? <span className="text-slate-300 dark:text-slate-600">All forms</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {p.includeGroups.length} include · {p.excludeGroups.length} exclude
                  </td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                    {fmtDate(p.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleDelete(p.id, p.name); }}
                      className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
