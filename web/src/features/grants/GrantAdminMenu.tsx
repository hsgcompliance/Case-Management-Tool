"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@hooks/queryKeys";
import {
  useGrantAdminClearPayments,
  useGrantAdminClearEnrollments,
  useGrantAdminReconcileBudget,
} from "@hooks/useGrants";
import { useReconciliationAuditScan } from "@hooks/useReconciliationAudit";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import { fmtCurrencyUSD } from "@lib/formatters";
import type { ReconciliationAuditScanResp } from "@types";

interface Props {
  grantId: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function customerEnrollmentHref(customerId: string, enrollmentId?: string | null) {
  return enrollmentId ? `/customers/${customerId}?enrollmentId=${encodeURIComponent(enrollmentId)}` : `/customers/${customerId}`;
}

/** Opens the grant-scoped audit findings (duplicate enrollments + orphaned ledger/queue rows) as a standalone tab — same "open a read-only report" idiom used elsewhere in this app (see ReconciliationTools.tsx's openReviewHtml). */
function openGrantAuditReportTab(grantLabel: string, result: ReconciliationAuditScanResp) {
  const duplicateRows = result.duplicateFindings.map((finding) => `
    <section>
      <h2>${escapeHtml(finding.customerName || finding.customerId)}</h2>
      <div class="body">
        <table>
          <thead><tr><th>Enrollment</th><th>Status</th><th>Start</th><th>End</th><th>Paid</th><th>Pending</th></tr></thead>
          <tbody>
            ${finding.enrollments.map((enrollment) => `
              <tr>
                <td><a href="${escapeHtml(customerEnrollmentHref(finding.customerId, enrollment.id))}" target="_blank" rel="noreferrer">${escapeHtml(enrollment.id.slice(0, 8))}</a></td>
                <td>${escapeHtml(enrollment.status)}</td>
                <td>${escapeHtml(enrollment.startDate)}</td>
                <td>${escapeHtml(enrollment.endDate || "open")}</td>
                <td>${enrollment.paidCount} ($${enrollment.paidTotal.toFixed(2)})</td>
                <td>${enrollment.pendingQueueCount}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `).join("");

  const orphanRows = result.orphanFindings.map((finding) => `
    <tr>
      <td>${finding.customerId ? `<a href="${escapeHtml(customerEnrollmentHref(finding.customerId, finding.enrollmentId))}" target="_blank" rel="noreferrer">${escapeHtml(finding.customerName || finding.customerId)}</a>` : escapeHtml(finding.enrollmentId)}</td>
      <td>${escapeHtml(finding.enrollmentStatus)}</td>
      <td>${escapeHtml(finding.source)}</td>
      <td>${finding.source === "ledger" ? `$${(finding.netAmount ?? 0).toFixed(2)} unreversed` : "still pending"}</td>
      <td>${finding.rowIds.length}</td>
    </tr>
  `).join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Audit — ${escapeHtml(grantLabel)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
    header { border-bottom: 1px solid #cbd5e1; background: #fff; padding: 14px 18px; }
    h1 { margin: 0; font-size: 20px; }
    .sub { margin-top: 4px; color: #64748b; font-size: 13px; }
    main { padding: 16px; }
    section { margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; overflow: hidden; }
    h2 { margin: 0; border-bottom: 1px solid #e2e8f0; background: #f8fafc; padding: 9px 12px; font-size: 13px; }
    .body { padding: 12px; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { color: #475569; white-space: nowrap; }
    .empty { color: #94a3b8; font-size: 12px; padding: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>Reconciliation audit — ${escapeHtml(grantLabel)}</h1>
    <div class="sub">Scanned ${result.enrollmentsScanned} enrollment(s) for this grant · ${result.duplicateFindings.length} duplicate group(s) · ${result.orphanFindings.length} orphaned row(s)</div>
  </header>
  <main>
    <section><h2>Duplicate enrollment schedules</h2>${duplicateRows || `<div class="empty">None found.</div>`}</section>
    <section>
      <h2>Orphaned ledger / queue rows</h2>
      <div class="body">
        ${orphanRows ? `<table><thead><tr><th>Customer</th><th>Enrollment status</th><th>Source</th><th>Detail</th><th>Rows</th></tr></thead><tbody>${orphanRows}</tbody></table>` : `<div class="empty">None found.</div>`}
      </div>
    </section>
  </main>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function GrantAdminMenu({ grantId }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const clearPayments = useGrantAdminClearPayments();
  const clearEnrollments = useGrantAdminClearEnrollments();
  const reconcile = useGrantAdminReconcileBudget();
  const auditScan = useReconciliationAuditScan();

  const invalidateGrant = () => {
    qc.invalidateQueries({ queryKey: qk.grants.detail(grantId) });
    qc.invalidateQueries({ queryKey: qk.grants.root });
  };

  const handleClearPayments = async () => {
    if (window.prompt('This deletes enrollment-sourced ledger entries and projection queue items for this grant only.\n\nCC and invoice payments are preserved. Budget totals are recomputed from what remains.\n\nType DELETE to confirm') !== "DELETE") return;
    setOpen(false);
    setBusy(true);
    try {
      const resp = await clearPayments.mutateAsync(grantId) as any;
      const del = resp?.deleted ?? {};
      const skip = resp?.skipped ?? {};
      const skipNote = (skip.ledger || skip.paymentQueue)
        ? ` (${(skip.ledger ?? 0) + (skip.paymentQueue ?? 0)} CC/invoice entries preserved)`
        : "";
      toast(`Cleared ${del.ledger ?? 0} ledger + ${del.paymentQueue ?? 0} queue items. Budget reconciled.${skipNote}`, { type: "success" });
      invalidateGrant();
    } catch (e) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleClearEnrollments = async () => {
    if (window.prompt('This hard-deletes ALL active and inactive enrollments under this grant and removes their pending payment projections.\n\nType DELETE to confirm') !== "DELETE") return;
    setOpen(false);
    setBusy(true);
    try {
      const resp = await clearEnrollments.mutateAsync({ grantId }) as any;
      const cleared = resp?.cleared ?? {};
      const skip = resp?.skipped ?? {};
      const skipNote = skip.enrollments ? ` (${skip.enrollments} skipped — org mismatch)` : "";
      toast(`${cleared.enrollments ?? 0} enrollment(s) cleared, ${cleared.paymentQueue ?? 0} projection(s) removed.${skipNote}`, { type: "success" });
      invalidateGrant();
    } catch (e) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleAuditGrant = async () => {
    setOpen(false);
    setBusy(true);
    try {
      const resp = await auditScan.mutateAsync({ grantIds: [grantId] });
      const total = resp.duplicateFindings.length + resp.orphanFindings.length;
      toast(
        total
          ? `Found ${resp.duplicateFindings.length} duplicate enrollment group(s) and ${resp.orphanFindings.length} orphaned row(s) for this grant.`
          : "No duplicate enrollments or orphaned ledger/queue rows found for this grant.",
        { type: total ? "warning" : "success" },
      );
      if (total) {
        const label = resp.duplicateFindings[0]?.grantName || resp.orphanFindings[0]?.grantName || grantId;
        openGrantAuditReportTab(label, resp);
      }
    } catch (e) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleReconcile = async () => {
    setOpen(false);
    setBusy(true);
    try {
      const resp = await reconcile.mutateAsync(grantId) as any;
      const t = resp?.totals ?? {};
      const c = resp?.counts ?? {};
      const fmt = (n: number) => fmtCurrencyUSD(n);
      toast(
        `Budget reconciled from ${c.ledger ?? 0} ledger + ${c.paymentQueue ?? 0} queue items. Spent: ${fmt(t.spent)} · Projected: ${fmt(t.projected)} · Balance: ${fmt(t.balance)}`,
        { type: "success" },
      );
      invalidateGrant();
    } catch (e) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        disabled={busy}
        className="btn btn-ghost btn-sm gap-1 text-xs text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30"
        onClick={() => setOpen((v) => !v)}
        title="Admin tools"
      >
        {busy ? "Working..." : "Admin ▾"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-[14px] border border-orange-200 bg-white py-1.5 shadow-lg dark:border-orange-900/50 dark:bg-slate-900">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-orange-500">
            Admin Tools
          </div>

          <button
            type="button"
            className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-orange-50 dark:hover:bg-orange-950/20"
            onClick={handleClearPayments}
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Clear All Payments</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Delete ledger + queue, zero budget totals
            </span>
          </button>

          <button
            type="button"
            className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-orange-50 dark:hover:bg-orange-950/20"
            onClick={handleClearEnrollments}
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Clear All Enrollments</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Soft-delete enrollments + void projections
            </span>
          </button>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <button
            type="button"
            className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={handleReconcile}
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Reconcile Budget</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Recount ledger + projections → write budget totals
            </span>
          </button>

          <button
            type="button"
            className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={handleAuditGrant}
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Audit This Grant</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Scan this grant&apos;s enrollments for duplicates + orphaned ledger/queue rows
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default GrantAdminMenu;
