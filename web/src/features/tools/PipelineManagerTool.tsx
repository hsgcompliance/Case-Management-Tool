"use client";
// web/src/features/tools/PipelineManagerTool.tsx
//
// Replaces BudgetMapTool as the single pipeline management surface.
// Shows a list of pipelines and an inline builder — no page navigation.
//
import React, { useState } from "react";
import { usePipelines, usePipelineDelete } from "@hooks/useBudgetPipeline";
import { PipelineBuilderPage } from "@features/budgetPipeline/PipelineBuilderPage";
import { toast } from "@lib/toast";
import type { TBudgetPipeline } from "@types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }); }
  catch { return iso; }
}

function StatusDot({ status }: { status: TBudgetPipeline["status"] }) {
  const cls: Record<string, string> = {
    active:   "bg-emerald-500",
    draft:    "bg-slate-300 dark:bg-slate-600",
    inactive: "bg-amber-400",
  };
  const label: Record<string, string> = { active: "Active", draft: "Draft", inactive: "Inactive" };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls[status] ?? "bg-slate-400"}`} />
      <span className="capitalize text-slate-600 dark:text-slate-400">{label[status] ?? status}</span>
    </span>
  );
}

// ─── List panel ───────────────────────────────────────────────────────────────

type ListPanelProps = {
  onNew: () => void;
  onEdit: (id: string) => void;
};

function ListPanel({ onNew, onEdit }: ListPanelProps) {
  const { data: pipelines = [], isLoading } = usePipelines();
  const del = usePipelineDelete();

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete pipeline "${name}"?`)) return;
    try {
      await del.mutateAsync(id);
      toast(`Deleted "${name}".`, { type: "success" });
    } catch {
      toast("Failed to delete.", { type: "error" });
    }
  }

  const active   = (pipelines as TBudgetPipeline[]).filter((p) => p.status === "active");
  const inactive = (pipelines as TBudgetPipeline[]).filter((p) => p.status !== "active");

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Budget Pipelines
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Incoming Jotform payment items are automatically classified to a grant + line item
              when they match an active pipeline&apos;s rules. First matching pipeline wins.
            </p>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="btn btn-sm btn-primary shrink-0"
          >
            + New Pipeline
          </button>
        </div>

        {/* How it works summary */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
          <p className="font-medium text-slate-700 dark:text-slate-300">How auto-allocation works</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>A Jotform CC or Invoice submission lands in the payment queue.</li>
            <li>Active pipelines run in creation order against the new item&apos;s fields.</li>
            <li>The first pipeline whose <strong>include rules</strong> match (and no <strong>exclude rules</strong> match) wins.</li>
            <li>That pipeline&apos;s Grant + Line Item are stamped onto the queue item.</li>
            <li>You review and post the item to the ledger from the Invoicing tool.</li>
          </ol>
        </div>

        {isLoading && (
          <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500 animate-pulse">
            Loading pipelines…
          </div>
        )}

        {!isLoading && (pipelines as TBudgetPipeline[]).length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-14 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">No pipelines yet.</p>
            <button type="button" onClick={onNew} className="btn btn-sm btn-primary">
              Create your first pipeline
            </button>
          </div>
        )}

        {/* Active pipelines */}
        {active.length > 0 && (
          <PipelineTable
            title="Active"
            rows={active}
            onEdit={onEdit}
            onDelete={handleDelete}
          />
        )}

        {/* Draft / inactive pipelines */}
        {inactive.length > 0 && (
          <PipelineTable
            title="Draft / Inactive"
            rows={inactive}
            onEdit={onEdit}
            onDelete={handleDelete}
            muted
          />
        )}
      </div>
    </div>
  );
}

type TableProps = {
  title: string;
  rows: TBudgetPipeline[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  muted?: boolean;
};

function PipelineTable({ title, rows, onEdit, onDelete, muted }: TableProps) {
  return (
    <div className="space-y-2">
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${muted ? "text-slate-400 dark:text-slate-500" : "text-slate-500 dark:text-slate-400"}`}>
        {title} ({rows.length})
      </h3>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Name</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Grant target</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Form filter</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Rules</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Updated</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {rows.map((p) => (
              <tr
                key={p.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => onEdit(p.id)}
              >
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                  {p.name}
                </td>
                <td className="px-4 py-3">
                  <StatusDot status={p.status} />
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono truncate max-w-[140px]">
                  {p.grantId
                    ? <>{p.grantId}{p.lineItemId ? <span className="text-slate-400"> → {p.lineItemId}</span> : null}</>
                    : <span className="text-slate-300 dark:text-slate-600 font-sans italic">any</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs truncate max-w-[120px]">
                  {p.sourceFormTitle ?? <span className="text-slate-300 dark:text-slate-600 italic">all forms</span>}
                </td>
                <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs tabular-nums">
                  {p.includeGroups.reduce((n, g) => n + g.conditions.length, 0)} include
                  {p.excludeGroups.length > 0 && ` · ${p.excludeGroups.reduce((n, g) => n + g.conditions.length, 0)} exclude`}
                </td>
                <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                  {fmtDate(p.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void onDelete(p.id, p.name); }}
                    className="text-xs text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type View =
  | { kind: "list" }
  | { kind: "builder"; pipelineId: string | null };

export function PipelineManagerMain() {
  const [view, setView] = useState<View>({ kind: "list" });

  if (view.kind === "builder") {
    return (
      <PipelineBuilderPage
        pipelineId={view.pipelineId}
        onBack={() => setView({ kind: "list" })}
        onSaved={(id) => setView({ kind: "builder", pipelineId: id })}
      />
    );
  }

  return (
    <ListPanel
      onNew={() => setView({ kind: "builder", pipelineId: null })}
      onEdit={(id) => setView({ kind: "builder", pipelineId: id })}
    />
  );
}
