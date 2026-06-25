"use client";
// web/src/features/tools/PipelineManagerTool.tsx
//
// Replaces BudgetMapTool as the single pipeline management surface.
// Shows a list of pipelines and an inline builder — no page navigation.
//
import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePipelines, usePipelineDelete, usePipelineRollup, useReconcileGrant } from "@hooks/useBudgetPipeline";
import { PipelineBuilderPage } from "@features/budgetPipeline/PipelineBuilderPage";
import { toast } from "@lib/toast";
import type { TBudgetPipeline } from "@types";
import { HelpButton } from "@entities/help/HelpButton";
import { useAuth } from "@app/auth/AuthProvider";
import { isAdminLike } from "@lib/roles";
import PaymentQueue, { type PaymentQueueAdminSyncResp } from "@client/paymentQueue";
import type { BudgetPipelineRollupRow } from "@client/budgetPipeline";
import { BudgetRollupPreviewPanel } from "@features/budget/BudgetRollupPreviewPanel";

function fmtMoney(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

function enabledSchemaLabels(p: TBudgetPipeline): string {
  const schemas = Object.values((p as any).formSchemas ?? {}).filter((schema: any) => schema?.enabled !== false);
  if (schemas.length > 0) {
    return schemas.map((schema: any) => String(schema.sourceFormTitle || schema.sourceFormId).replace(/^Line Items /, "")).join(" + ");
  }
  return p.sourceFormTitle ?? "all forms";
}

function countRuleConditions(node: any): number {
  if (!node) return 0;
  if (node.type === "condition") return 1;
  return Array.isArray(node.children)
    ? node.children.reduce((total: number, child: any) => total + countRuleConditions(child), 0)
    : 0;
}

function schemaRuleSummary(p: TBudgetPipeline): string {
  const schemas = Object.values((p as any).formSchemas ?? {}).filter((schema: any) => schema?.enabled !== false);
  if (schemas.length > 0) {
    return schemas
      .map((schema: any) => {
        const label = String(schema.sourceFormTitle || "Form").replace(/^Line Items /, "");
        return `${label}: ${countRuleConditions(schema.includeTree)} in / ${countRuleConditions(schema.excludeTree)} out`;
      })
      .join(" · ");
  }
  return `${countRuleConditions((p as any).includeTree)} include · ${countRuleConditions((p as any).excludeTree)} exclude`;
}

// â”€â”€â”€ List panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ─── Admin maintenance: re-extract queue + re-allocate backlog ──────────────
//
// The pipeline matcher reads live transaction fields (tx:*) only from a queue
// item's `transactionFields`. Rows extracted before the transaction-window model
// shipped have that empty, so rules silently skip them (Preview shows nothing).
// This control re-extracts spending submissions (repopulating transactionFields)
// and re-runs active pipelines over the existing pending backlog — the auto
// allocator is create-only, so an update-style backfill doesn't re-fire it.

function QueueSyncPanel() {
  const { profile } = useAuth();
  const isAdmin = isAdminLike(profile);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "dry" | "apply">(null);
  const [result, setResult] = useState<(PaymentQueueAdminSyncResp & { mode: "dry" | "apply" }) | null>(null);

  if (!isAdmin) return null;

  async function run(dryRun: boolean) {
    if (
      !dryRun &&
      !confirm(
        "Re-extract all spending submissions and re-allocate the pending backlog onto grant line items?\n\n" +
          "This writes to the live payment queue. Existing classifications, posted/ledgered items, and manual edits are preserved.",
      )
    )
      return;
    setBusy(dryRun ? "dry" : "apply");
    try {
      const res = await PaymentQueue.adminSync({ dryRun, reallocate: true });
      setResult({ ...res, mode: dryRun ? "dry" : "apply" });
      if (!dryRun) {
        // Rare maintenance op — refresh everything that could reflect new classifications.
        await qc.invalidateQueries();
        toast(
          `Re-extracted ${res.jotformItemsWritten} item(s); allocated ${res.reallocMatched} of ${res.reallocScanned} pending.`,
          { type: "success" },
        );
      }
    } catch {
      toast("Payment-queue sync failed.", { type: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <details className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300 select-none">
        Admin maintenance · re-sync payment queue
      </summary>
      <div className="mt-3 space-y-3 text-xs text-slate-600 dark:text-slate-400">
        <p>
          Re-extract spending submissions (repopulates live transaction fields on older queue rows) and
          re-run active pipelines over the existing <strong>pending + unassigned</strong> backlog. Use a dry run
          first to preview counts. Safe: classifications, posted items, and manual edits are preserved.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-xs btn-secondary"
            disabled={busy !== null}
            onClick={() => void run(true)}
          >
            {busy === "dry" ? "Running dry run…" : "Dry run"}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-primary"
            disabled={busy !== null}
            onClick={() => void run(false)}
          >
            {busy === "apply" ? "Applying…" : "Backfill + re-allocate"}
          </button>
        </div>
        {result && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 tabular-nums">
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              {result.mode === "dry" ? "Dry run" : "Applied"} · {fmtDate(result.at)}
            </div>
            <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
              <li>Submissions scanned: {result.jotformScanned}</li>
              <li>Spending forms: {result.jotformProcessed}</li>
              <li>Items re-extracted: {result.jotformItemsWritten}</li>
              <li>Active pipelines: {result.reallocPipelinesActive}</li>
              <li>Pending scanned: {result.reallocScanned}</li>
              <li className="font-medium text-slate-700 dark:text-slate-300">
                {result.mode === "dry" ? "Would allocate" : "Allocated"}: {result.reallocMatched}
              </li>
            </ul>
            {result.errors.length > 0 && (
              <div className="mt-1 text-rose-600 dark:text-rose-400">
                {result.errors.length} error(s): {result.errors.slice(0, 3).join("; ")}
                {result.errors.length > 3 ? " …" : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

type ListPanelProps = {
  onNew: () => void;
  onEdit: (id: string) => void;
};

function ListPanel({ onNew, onEdit }: ListPanelProps) {
  const { data: pipelines = [], isLoading } = usePipelines();
  const del = usePipelineDelete();
  const { data: rollup } = usePipelineRollup();
  const reconcile = useReconcileGrant();
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [previewGrantId, setPreviewGrantId] = useState<string>("");

  const rollupByPipeline = useMemo(
    () => Object.fromEntries((rollup?.rows ?? []).map((r) => [r.pipelineId, r])) as Record<string, BudgetPipelineRollupRow>,
    [rollup],
  );

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete pipeline "${name}"?`)) return;
    try {
      await del.mutateAsync(id);
      toast(`Deleted "${name}".`, { type: "success" });
    } catch {
      toast("Failed to delete.", { type: "error" });
    }
  }

  async function handleReconcile(grantId: string | null, name: string) {
    if (!grantId) {
      toast("This pipeline has no grant target to reconcile.", { type: "error" });
      return;
    }
    setReconcilingId(grantId);
    try {
      await reconcile.mutateAsync(grantId);
      toast(`Reconciled grant budget for "${name}".`, { type: "success" });
    } catch {
      toast("Reconcile failed.", { type: "error" });
    } finally {
      setReconcilingId(null);
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
              Budget Pipelines <HelpButton pageKey="budgetPipeline" />
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Incoming Jotform payment items are automatically classified to a grant + line item
              when they match an active pipeline&apos;s rules. A pipeline can hold separate Credit Card and Invoice schemas under the same budget target. First matching pipeline wins.
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

        <QueueSyncPanel />

        <BudgetRollupPreviewPanel
          grantId={previewGrantId || active.find((p) => p.grantId)?.grantId || inactive.find((p) => p.grantId)?.grantId || null}
        />

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
            rollup={rollupByPipeline}
            onEdit={onEdit}
            onDelete={handleDelete}
            onReconcile={handleReconcile}
            onPreview={(grantId) => setPreviewGrantId(grantId || "")}
            reconcilingId={reconcilingId}
          />
        )}

        {/* Draft / inactive pipelines */}
        {inactive.length > 0 && (
          <PipelineTable
            title="Draft / Inactive"
            rows={inactive}
            rollup={rollupByPipeline}
            onEdit={onEdit}
            onDelete={handleDelete}
            onReconcile={handleReconcile}
            onPreview={(grantId) => setPreviewGrantId(grantId || "")}
            reconcilingId={reconcilingId}
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
  rollup: Record<string, BudgetPipelineRollupRow>;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onReconcile: (grantId: string | null, name: string) => void;
  onPreview: (grantId: string | null) => void;
  reconcilingId: string | null;
  muted?: boolean;
};

function PipelineTable({ title, rows, rollup, onEdit, onDelete, onReconcile, onPreview, reconcilingId, muted }: TableProps) {
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
              <th className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400" title="This pipeline's classified transactions: pending (projected) and posted (spent), vs the target line-item budget.">Budget rollup</th>
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
                  {enabledSchemaLabels(p)}
                </td>
                <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs tabular-nums">
                  {schemaRuleSummary(p)}
                </td>
                <td className="px-4 py-3 text-xs tabular-nums">
                  {(() => {
                    const r = rollup[p.id];
                    if (!r) return <span className="text-slate-300 dark:text-slate-600">—</span>;
                    return (
                      <div className="flex flex-col leading-tight">
                        <span className="text-amber-600 dark:text-amber-400" title={`${r.pendingCount} pending item(s)`}>
                          {fmtMoney(r.pendingAmount)} pending
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400" title={`${r.postedCount} posted item(s)`}>
                          {fmtMoney(r.postedAmount)} spent
                        </span>
                        {r.lineItemId ? (
                          <span className="text-slate-400 dark:text-slate-500" title="Authoritative line-item budget (all sources)">
                            of {fmtMoney(r.lineItemBudget)} budget
                          </span>
                        ) : null}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                  {fmtDate(p.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    disabled={!p.grantId || reconcilingId === p.grantId}
                    onClick={(e) => { e.stopPropagation(); void onReconcile(p.grantId, p.name); }}
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors disabled:opacity-40 disabled:hover:text-slate-400 mr-3"
                    title={p.grantId ? "Recompute this grant's projected/spent from queue + ledger" : "No grant target"}
                  >
                    {reconcilingId === p.grantId ? "Reconciling…" : "Reconcile"}
                  </button>
                  <button
                    type="button"
                    disabled={!p.grantId}
                    onClick={(e) => { e.stopPropagation(); onPreview(p.grantId); }}
                    className="mr-3 text-xs text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors disabled:opacity-40 disabled:hover:text-slate-400"
                    title={p.grantId ? "Preview grant line-item and split rollup" : "No grant target"}
                  >
                    Preview
                  </button>
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

// â”€â”€â”€ Main export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
