"use client";

import React from "react";
import FullPageModal from "@entities/ui/FullPageModal";
import { toast } from "@lib/toast";
import {
  buildActionPreviews,
  BULK_PAYMENT_ACTION_KINDS,
  BULK_PAYMENT_ACTION_DEFAULT_OFF,
  type ReconciliationActionPreview,
} from "./reconciliationActions";
import { useReconciliationActionApply, type ReconciliationApplyResult } from "./useReconciliationActionApply";
import ReconciliationAdjustModal, { isAdjustableActionKind } from "./ReconciliationAdjustModal";
import type { ReconciliationFinding } from "./reconciliationReview";

type RowStatus = "pending" | "applying" | "success" | "recorded" | "failed";

type BulkApplyRow = {
  id: string;
  finding: ReconciliationFinding;
  action: ReconciliationActionPreview;
  status: RowStatus;
  resultMessage?: string;
};

function customerLabel(finding: ReconciliationFinding) {
  return finding.customerLabel || finding.customerId || "Unknown customer";
}

function groupKeyOf(row: BulkApplyRow): string | null {
  return row.action.pathGroup ? `${row.finding.id}::${row.action.pathGroup}` : null;
}

export function buildBulkApplyRows(findings: ReconciliationFinding[]): BulkApplyRow[] {
  const rows: BulkApplyRow[] = [];
  const seen = new Set<string>();
  for (const finding of findings) {
    for (const action of buildActionPreviews(finding)) {
      // Actions in a pathGroup include record-only choices (e.g. "create a
      // task" has no live write yet) alongside real writes — both need to
      // show up as selectable paths. Standalone actions still require
      // executable:true, same as before.
      if (!action.executable && !action.pathGroup) continue;
      if (!BULK_PAYMENT_ACTION_KINDS.has(action.kind)) continue;
      if (seen.has(action.id)) continue;
      seen.add(action.id);
      rows.push({ id: action.id, finding, action, status: "pending" });
    }
  }
  return rows;
}

/** Groups rows for rendering: pathGroup rows cluster together (choose one), everything else stays standalone. */
function groupRowsForDisplay(rows: BulkApplyRow[]): Array<BulkApplyRow[]> {
  const groups: Array<BulkApplyRow[]> = [];
  const byKey = new Map<string, BulkApplyRow[]>();
  for (const row of rows) {
    const key = groupKeyOf(row);
    if (!key) {
      groups.push([row]);
      continue;
    }
    const existing = byKey.get(key);
    if (existing) {
      existing.push(row);
    } else {
      const bucket = [row];
      byKey.set(key, bucket);
      groups.push(bucket);
    }
  }
  return groups;
}

function statusBadge(status: RowStatus) {
  switch (status) {
    case "applying":
      return <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">Applying…</span>;
    case "success":
      return <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Applied</span>;
    case "recorded":
      return <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">Recorded</span>;
    case "failed":
      return <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">Failed</span>;
    default:
      return <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">Pending</span>;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Opens a standalone tab (blob URL, same "raw page" idiom used elsewhere in
 * this tool — see openReviewHtml in ReconciliationTools.tsx) recording every
 * decision this submit made: which path was chosen per finding, what changed,
 * and the outcome. This is the audit trail that "informs DB reconciliation" —
 * a record of what was decided, independent of the live Firestore state.
 */
function openSubmissionSummaryTab(submittedRows: BulkApplyRow[]) {
  const rowsHtml = submittedRows.map((row) => `
    <tr class="filter-row ${row.status}">
      <td>${escapeHtml(customerLabel(row.finding))}</td>
      <td>${escapeHtml(row.finding.title || row.finding.kind.replace(/_/g, " "))}</td>
      <td>${escapeHtml(row.action.label)}</td>
      <td>${escapeHtml(row.action.currentValue)}</td>
      <td>${escapeHtml(row.action.proposedValue)}</td>
      <td><span class="pill">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.resultMessage || "")}</td>
      <td>${escapeHtml(row.finding.sourceFile)} row ${escapeHtml(row.finding.sourceRowNumber ?? "-")}</td>
    </tr>
  `).join("");

  const applied = submittedRows.filter((r) => r.status === "success").length;
  const recorded = submittedRows.filter((r) => r.status === "recorded").length;
  const failed = submittedRows.filter((r) => r.status === "failed").length;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reconciliation submission — ${new Date().toLocaleString()}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
    header { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid #cbd5e1; background: #fff; padding: 14px 18px; }
    h1 { margin: 0; font-size: 20px; }
    .sub { margin-top: 4px; color: #64748b; font-size: 13px; }
    .summary { display: flex; gap: 16px; margin-top: 10px; }
    .metric { border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; padding: 6px 10px; font-size: 12px; }
    .metric b { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; }
    .toolbar { margin-top: 12px; }
    input { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; min-width: 320px; }
    main { padding: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; background: #fff; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { color: #475569; white-space: nowrap; position: sticky; top: 128px; background: #f1f5f9; }
    .pill { display: inline-block; border-radius: 999px; border: 1px solid #cbd5e1; background: #f8fafc; padding: 2px 7px; font-size: 11px; text-transform: capitalize; }
    tr.success .pill { background: #dcfce7; border-color: #86efac; }
    tr.recorded .pill { background: #ede9fe; border-color: #c4b5fd; }
    tr.failed .pill { background: #fee2e2; border-color: #fca5a5; }
    .hidden-row { display: none; }
  </style>
</head>
<body>
  <header>
    <h1>Reconciliation submission — ${escapeHtml(new Date().toLocaleString())}</h1>
    <div class="sub">${submittedRows.length} row(s) submitted — one chosen path per finding, applied sequentially.</div>
    <div class="summary">
      <div class="metric"><b>Applied</b>${applied}</div>
      <div class="metric"><b>Recorded (no live write)</b>${recorded}</div>
      <div class="metric"><b>Failed</b>${failed}</div>
    </div>
    <div class="toolbar"><input id="filter" placeholder="Filter by customer, finding, action..." /></div>
  </header>
  <main>
    <table>
      <thead><tr><th>Customer</th><th>Finding</th><th>Chosen path</th><th>Current</th><th>Proposed</th><th>Outcome</th><th>Detail</th><th>Source</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </main>
  <script>
    const input = document.getElementById("filter");
    input.addEventListener("input", () => {
      const needle = input.value.trim().toLowerCase();
      document.querySelectorAll(".filter-row").forEach((row) => {
        row.style.display = !needle || row.textContent.toLowerCase().includes(needle) ? "" : "none";
      });
    });
  </script>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ReconciliationBulkApplyModal({
  isOpen,
  findings,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  findings: ReconciliationFinding[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const { apply, busy: dispatchBusy } = useReconciliationActionApply();
  const [rows, setRows] = React.useState<BulkApplyRow[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [running, setRunning] = React.useState(false);
  const [adjustingRow, setAdjustingRow] = React.useState<BulkApplyRow | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const nextRows = buildBulkApplyRows(findings);
    setRows(nextRows);

    const initial = new Set<string>();
    const decidedGroups = new Set<string>();
    for (const row of nextRows) {
      const key = groupKeyOf(row);
      if (key) {
        if (decidedGroups.has(key)) continue;
        decidedGroups.add(key);
        const groupRows = nextRows.filter((r) => groupKeyOf(r) === key);
        const chosen = groupRows.find((r) => r.action.recommended) ?? groupRows[0];
        // Even the recommended path in a group must still respect the
        // default-off list (e.g. extend_schedule is "recommended" for
        // schedule_gap, but it's also the least browser-verified live write
        // in this tool — it must not get silently pre-checked into a batch).
        if (chosen && !BULK_PAYMENT_ACTION_DEFAULT_OFF.has(chosen.action.kind)) initial.add(chosen.id);
      } else if (!BULK_PAYMENT_ACTION_DEFAULT_OFF.has(row.action.kind)) {
        initial.add(row.id);
      }
    }
    setSelectedIds(initial);
  }, [findings, isOpen]);

  if (!isOpen) return null;

  const rowGroups = groupRowsForDisplay(rows);
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const doneCount = rows.filter((row) => row.status === "success" || row.status === "recorded" || row.status === "failed").length;

  // Editing a row applies it immediately (same as the single-finding Adjust
  // modal) rather than staging an edited value for the sequential batch to
  // send later — so once it resolves, drop it out of the pending selection
  // and record its outcome the same way runBatch does for un-edited rows.
  const handleAdjustResult = (row: BulkApplyRow, result: ReconciliationApplyResult) => {
    const status: RowStatus = !result.ok ? "failed" : result.recorded ? "recorded" : "success";
    setRows((current) => current.map((r) => (r.id === row.id ? { ...r, status, resultMessage: result.message } : r)));
    if (result.ok) {
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  };

  const selectRow = (row: BulkApplyRow) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const key = groupKeyOf(row);
      if (key) {
        // Radio behavior: choosing one path for a finding clears the others.
        for (const other of rows) {
          if (other.id !== row.id && groupKeyOf(other) === key) next.delete(other.id);
        }
        if (next.has(row.id)) next.delete(row.id);
        else next.add(row.id);
      } else if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  };

  const runBatch = async () => {
    if (!selectedRows.length) {
      toast("Choose at least one action to submit.", { type: "warn" });
      return;
    }
    if (!window.confirm(`Submit ${selectedRows.length} chosen action${selectedRows.length === 1 ? "" : "s"}? This writes directly to Firestore where a live write applies.`)) return;

    setRunning(true);
    // Sequential, not parallel — concurrent writes to the same enrollment are
    // exactly what caused a real production race (see PROGRESS.md 2026-07-22);
    // several rows here can legitimately target the same enrollment (e.g. two
    // schedule_gap findings for rent vs utility on one customer).
    const finished: BulkApplyRow[] = [];
    for (const row of selectedRows) {
      setRows((current) => current.map((r) => (r.id === row.id ? { ...r, status: "applying" } : r)));
      const result = await apply(row.action, { skipConfirm: true });
      const status: RowStatus = !result.ok ? "failed" : result.recorded ? "recorded" : "success";
      const nextRow = { ...row, status, resultMessage: result.message };
      finished.push(nextRow);
      setRows((current) => current.map((r) => (r.id === row.id ? nextRow : r)));
    }
    setRunning(false);
    const applied = finished.filter((r) => r.status === "success").length;
    const recorded = finished.filter((r) => r.status === "recorded").length;
    const failed = finished.filter((r) => r.status === "failed").length;
    toast(`${applied} applied, ${recorded} recorded${failed ? `, ${failed} failed` : ""}.`, { type: failed ? "error" : "success" });
    openSubmissionSummaryTab(finished);
    onApplied();
  };

  const busy = running || dispatchBusy;

  return (
    <>
    <FullPageModal
      isOpen
      onClose={onClose}
      disableOverlayClose={busy}
      topBar={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Bulk Workspace</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">Bulk Apply Payment/Schedule Actions</div>
            <div className="mt-1 text-sm text-slate-500">
              Findings with two resolution paths (dashboard is wrong vs. report/data-entry hasn&apos;t caught up) show as a choice — pick one per row.
              {doneCount > 0 ? ` ${doneCount} of ${rows.length} done.` : ""}
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-end gap-3">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void runBatch()} disabled={busy || selectedRows.length === 0}>
              {busy ? "Submitting…" : `Submit ${selectedRows.length}`}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={running}>
              Close
            </button>
          </div>
        </div>
      }
      leftPane={
        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{selectedRows.length}</div>
            <div className="mt-1 text-sm text-slate-500">{rows.length} total action{rows.length === 1 ? "" : "s"} available from selected findings</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            &quot;Extend schedule&quot; and &quot;Void scheduled payment&quot; default to the recommended path shown, but review each one — they write directly to the schedule/queue.
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            Actions apply one at a time, in order. If one fails, the rest still run. Submitting opens a summary tab recording every decision and outcome, whether or not it wrote anything live (e.g. &quot;create task&quot; is recorded but not yet wired to a real write).
          </div>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto bg-slate-50 p-6">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-950">Action Preview</div>
                <div className="text-xs text-slate-500">Review current vs. proposed values before submitting.</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Use</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Path</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">Proposed</th>
                    <th className="px-3 py-2">Warning</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rowGroups.map((group) => {
                    const isChoice = group.length > 1;
                    return group.map((row, index) => (
                      <tr
                        key={row.id}
                        className={[
                          "border-t align-top",
                          isChoice ? "border-sky-100 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/10" : "border-slate-200",
                        ].join(" ")}
                      >
                        <td className="px-3 py-2">
                          <input
                            type={isChoice ? "radio" : "checkbox"}
                            name={isChoice ? groupKeyOf(row) ?? undefined : undefined}
                            checked={selectedIds.has(row.id)}
                            disabled={busy}
                            onChange={() => selectRow(row)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {index === 0 ? (
                            <>
                              <div className="font-medium text-slate-800">{customerLabel(row.finding)}</div>
                              <div className="text-slate-400">{row.finding.sourceFile} row {row.finding.sourceRowNumber ?? "-"}</div>
                            </>
                          ) : (
                            <div className="text-slate-400">↳ alternate path</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.action.label}
                          {row.action.recommended ? <span className="ml-1 rounded border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Recommended</span> : null}
                          {isAdjustableActionKind(row.action.kind) && row.status === "pending" ? (
                            <button
                              type="button"
                              className="ml-2 text-[11px] font-medium text-sky-600 underline hover:text-sky-700 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => setAdjustingRow(row)}
                            >
                              Edit
                            </button>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{row.action.currentValue}</td>
                        <td className="px-3 py-2">{row.action.proposedValue}</td>
                        <td className="max-w-64 px-3 py-2 text-amber-700">{row.action.warning || "-"}</td>
                        <td className="px-3 py-2">
                          {statusBadge(row.status)}
                          {row.status === "failed" && row.resultMessage ? <div className="mt-1 text-rose-700">{row.resultMessage}</div> : null}
                        </td>
                      </tr>
                    ));
                  })}
                  {!rows.length ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={7}>
                        Select findings with a payment/schedule action first (post to ledger, extend schedule, patch/void queue item, or a two-path finding like a missing report row).
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    />
    <ReconciliationAdjustModal
      action={adjustingRow?.action ?? null}
      apply={apply}
      busy={busy}
      onClose={() => setAdjustingRow(null)}
      onResult={(result) => {
        if (adjustingRow) handleAdjustResult(adjustingRow, result);
      }}
    />
    </>
  );
}
