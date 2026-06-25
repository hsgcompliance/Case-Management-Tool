"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import FullPageModal from "@entities/ui/FullPageModal";
import type { ExportColumn } from "@entities/ui/dashboardStyle/SmartExportButton";
import { usePaymentQueueItemsForMonths } from "@hooks/usePaymentQueue";
import { useLedgerEntriesForMonths } from "@hooks/useLedger";
import { usePatchCustomers, useUpsertCustomers } from "@hooks/useCustomers";
import DatabaseFilterPanel from "@entities/database-filters/DatabaseFilterPanel";
import {
  DEFAULT_DATABASE_FILTER_CONFIG,
  applyDatabaseFilters,
  type DatabaseCollectionKey,
  type DatabaseFilterConfig,
} from "@entities/database-filters/databaseFilters";
import { qk } from "@hooks/queryKeys";
import { toast } from "@lib/toast";
import type { CustomersPatchReq, CustomersUpsertReq } from "@types";
import { type ReconciliationPacket } from "./reportProfiles";
import { ReportUploadPanel, type ReportUploadGrant } from "@entities/report-upload/ReportUploadPanel";
import {
  buildReconciliationReview,
  type ReconciliationFinding,
  type ReconciliationFindingKind,
  type ReconciliationReviewResult,
  type ReconciliationSourceSystem,
} from "./reconciliationReview";
import { useReconciliationWorkspace } from "./ReconciliationWorkspaceContext";
import ReviewExportDialog from "@entities/dialogs/export/ReviewExportDialog";
import {
  RECONCILIATION_EXPORT_COLUMNS,
  buildReviewSummaryRows,
  reconciliationFindingsToRows,
} from "./reconciliationExports";
import { buildActionPreviews, type ReconciliationActionPreview } from "./reconciliationActions";
import ReconciliationBulkCustomerPatchModal, { buildBulkHmisCustomerPatchRows } from "./ReconciliationBulkCustomerPatchModal";
import ReconciliationBulkCustomerImportModal, { buildBulkCustomerImportRows } from "./ReconciliationBulkCustomerImportModal";
import ReconciliationBulkEnrollmentModal, { buildBulkEnrollmentRows } from "./ReconciliationBulkEnrollmentModal";
import {
  buildReconciliationCompare,
  type CompareCellStatus,
  type CompareMode,
  type CompareRow,
  type EnrollmentCompareGranularity,
} from "./reconciliationCompare";
import { BudgetRollupPreviewPanel } from "@features/budget/BudgetRollupPreviewPanel";

export type ReconciliationToolKind = "enrollment" | "payment" | "identity";

export type ReconciliationToolFilterState = {
  severity: "all" | "error" | "warning" | "info";
  databaseFilters: DatabaseFilterConfig;
  sourceFiles: string[];
  sourceSystems: ReconciliationSourceSystem[];
  findingKinds: ReconciliationFindingKind[];
};

export type ReconciliationToolSelection = { findingId: string } | null;

const TOOL_CONFIG: Record<ReconciliationToolKind, {
  title: string;
  uploadLabel: string;
  help: string;
  findingFocus: string[];
  preferredProfiles: string[];
  findingKinds: ReconciliationFindingKind[];
}> = {
  enrollment: {
    title: "Coordinated Entry / Enrollment Reconciliation",
    uploadLabel: "Add CE/HMIS Report",
    help: "Review HMIS Coordinated Entry by-name and enrollment evidence against dashboard customers, enrollments, entry/exit dates, and HMIS enrollment compliance.",
    findingFocus: ["Missing dashboard enrollments", "Entry/exit date differences", "HMIS enrollment compliance flags", "Grant/provider mapping review"],
    preferredProfiles: ["coordinated_entry_by_name_list", "hmis_service_payment_report"],
    findingKinds: ["enrollment_missing", "entry_date_mismatch", "exit_date_mismatch", "enrollment_compliance_missing", "grant_mapping_review", "report_row_diagnostic"],
  },
  payment: {
    title: "Payment Reconciliation",
    uploadLabel: "Add Payment Report",
    help: "Review Financial Project Activity and HMIS Service Provided reports against dashboard payment queue and schedule rows.",
    findingFocus: ["Missing dashboard payment/ledger rows", "Ambiguous payment candidates", "Amount/date/month differences", "Grant/provider/payment-source mapping review"],
    preferredProfiles: ["financial_edge_project_activity", "rental_assistance_invoice_request", "hmis_service_payment_report", "caseworthy_service_detail", "caseworthy_service_total"],
    findingKinds: ["payment_missing_hmis", "payment_missing_dashboard", "payment_missing_financial_edge", "payment_possible_match", "payment_amount_mismatch", "grant_mapping_review", "report_row_diagnostic"],
  },
  identity: {
    title: "Customer Identity Review",
    uploadLabel: "Add Identity Source",
    help: "Review customer existence and identity links across HMIS IDs, dashboard customer IDs, names, DOBs, and future Caseworthy IDs.",
    findingFocus: ["Names/IDs present in reports but missing from dashboard", "Low-confidence customer matches", "HMIS/Caseworthy ID patch candidates", "Duplicate/same-name identity review"],
    preferredProfiles: ["coordinated_entry_by_name_list", "hmis_service_payment_report", "caseworthy_service_detail", "caseworthy_service_total"],
    findingKinds: ["customer_missing", "customer_possible_match", "report_row_diagnostic"],
  },
};

function severityClass(severity: ReconciliationFinding["severity"]) {
  if (severity === "error") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function packetMatchesTool(packet: ReconciliationPacket, config: (typeof TOOL_CONFIG)[ReconciliationToolKind]) {
  return config.preferredProfiles.includes(packet.profileId);
}

function monthRange(from: string, to: string) {
  if (!from && !to) return [];
  const start = from || to;
  const end = to || from;
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  if (!startYear || !startMonth || !endYear || !endMonth) return [];
  const out: string[] = [];
  let year = startYear;
  let month = startMonth;
  for (let guard = 0; guard < 60; guard += 1) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    if (year === endYear && month === endMonth) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (year > endYear || (year === endYear && month > endMonth)) break;
  }
  return out;
}

function FindingList({
  findings,
  selection,
  onSelect,
  selectedIds,
  onToggleSelected,
  search,
  onSearchChange,
  onSelectAllVisible,
  onClearVisible,
}: {
  findings: ReconciliationFinding[];
  selection: ReconciliationToolSelection;
  onSelect: (next: ReconciliationToolSelection) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  search: string;
  onSearchChange: (next: string) => void;
  onSelectAllVisible: () => void;
  onClearVisible: () => void;
}) {
  const selectedVisibleCount = findings.filter((finding) => selectedIds.has(finding.id)).length;
  if (!findings.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <input
          className="input h-9 w-full text-sm"
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder="Search findings by name, HMIS ID, CWID, customer ID..."
        />
        <div className="mt-4 p-3 text-center text-sm text-slate-500">No findings for this tool/filter.</div>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
      <div className="sticky top-0 z-10 -mx-2 -mt-2 space-y-2 border-b border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
        <input
          className="input h-9 w-full text-sm"
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder="Search findings by name, HMIS ID, CWID, customer ID..."
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">{selectedVisibleCount} selected of {findings.length} visible</div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary btn-xs" onClick={onSelectAllVisible}>
              Select visible
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={onClearVisible}>
              Clear visible
            </button>
          </div>
        </div>
      </div>
      {findings.map((finding) => {
        const active = selection?.findingId === finding.id;
        return (
          <button
            key={finding.id}
            type="button"
            className={[
              "w-full rounded-lg border px-3 py-2 text-left text-sm",
              active ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950" : severityClass(finding.severity),
            ].join(" ")}
            onClick={() => onSelect({ findingId: finding.id })}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedIds.has(finding.id)}
                  onChange={(event) => {
                    event.stopPropagation();
                    onToggleSelected(finding.id);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
                <div className="font-semibold">{finding.title || finding.kind.replace(/_/g, " ")}</div>
              </div>
              <div className="text-xs opacity-75">{Math.round(finding.confidence * 100)}%</div>
            </div>
            <div className="mt-1 text-xs opacity-80">
              {finding.customerLabel || finding.customerId || "Unmatched"} - row {finding.sourceRowNumber ?? "-"}
            </div>
            <div className="mt-2">
              <span className="rounded border border-current px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-75">{issueBucketForFinding(finding)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ActionPreviewList({ actions, onApplied }: { actions: ReconciliationActionPreview[]; onApplied?: () => void }) {
  const patchCustomers = usePatchCustomers();
  const upsertCustomers = useUpsertCustomers();
  const queryClient = useQueryClient();
  const [runningId, setRunningId] = React.useState("");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.customers.root }),
      queryClient.invalidateQueries({ queryKey: qk.dashboard.root }),
    ]);
    onApplied?.();
  };

  const applyAction = async (action: ReconciliationActionPreview) => {
    if (!action.executable) return;
    setRunningId(action.id);
    try {
      if (action.kind === "push_hmis_id" || action.kind === "push_cw_id" || action.kind === "push_dob") {
        if (!action.targetId || !action.patch) throw new Error("Customer patch action is missing its target or patch.");
        await patchCustomers.mutateAsync({ id: action.targetId, patch: action.patch } as CustomersPatchReq);
        await refresh();
        toast(`${action.label} applied.`, { type: "success" });
      } else if (action.kind === "create_customer") {
        if (!action.create) throw new Error("Create customer action is missing its payload.");
        await upsertCustomers.mutateAsync([action.create] as CustomersUpsertReq);
        await refresh();
        toast("Customer created.", { type: "success" });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : `Failed to apply ${action.label}.`, { type: "error" });
    } finally {
      setRunningId("");
    }
  };

  if (!actions.length) return null;
  const busy = patchCustomers.isPending || upsertCustomers.isPending || Boolean(runningId);
  return (
    <div className="mt-4 rounded border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Database actions</div>
      <div className="space-y-2">
        {actions.map((action) => (
          <div key={action.id} className="rounded border border-white/70 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="font-semibold text-slate-800 dark:text-slate-100">{action.label}</div>
              {action.executable ? (
                <button type="button" className="btn btn-primary btn-xs" onClick={() => applyAction(action)} disabled={busy}>
                  {runningId === action.id ? "Applying..." : "Apply"}
                </button>
              ) : null}
            </div>
            <div className="mt-1 grid gap-1 sm:grid-cols-3">
              <div><span className="text-slate-400">Target:</span> {action.target}{action.targetId ? `/${action.targetId}` : ""}</div>
              <div><span className="text-slate-400">Current:</span> {action.currentValue}</div>
              <div><span className="text-slate-400">Proposed:</span> {action.proposedValue}</div>
            </div>
            {action.warning ? <div className="mt-1 text-amber-700 dark:text-amber-300">{action.warning}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(", ") : "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeHtml(value: unknown): string {
  return formatValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function reviewStatusForFinding(finding: ReconciliationFinding) {
  if (finding.kind === "payment_amount_mismatch" || finding.kind === "payment_possible_match") return "PARTIAL MATCH";
  if (finding.kind === "payment_missing_hmis") return "HMIS MISSING";
  if (finding.kind === "payment_missing_financial_edge") return "HMIS/CASEWORTHY ONLY";
  if (finding.kind === "payment_missing_dashboard") return finding.sourceSystem === "hmis" || finding.sourceSystem === "caseworthy" ? "HMIS/CASEWORTHY ONLY" : "FE ONLY";
  if (finding.kind === "customer_missing" || finding.kind === "enrollment_missing") return "NO DATABASE MATCH";
  if (finding.kind === "customer_possible_match") return "PARTIAL MATCH";
  if (finding.kind === "entry_date_mismatch" || finding.kind === "exit_date_mismatch") return "REVIEW";
  return finding.severity === "info" ? "MATCH" : "REVIEW";
}

function issueBucketForFinding(finding: ReconciliationFinding) {
  if (finding.kind.startsWith("payment_")) return "Payment error";
  if (finding.kind.startsWith("customer_")) return "HMIS identity error";
  if (finding.kind.includes("enrollment") || finding.kind.includes("entry_date") || finding.kind.includes("exit_date")) return "Enrollment error";
  if (finding.kind === "grant_mapping_review") return "Grant/provider mapping";
  return "Report format";
}

function normalizedFindingRow(finding: ReconciliationFinding): Record<string, unknown> | null {
  if (!finding.reportRecord) return null;
  return {
    sourceType: finding.reportRecord.sourceType,
    recordKind: finding.reportRecord.recordKind,
    sourceRowNumber: finding.reportRecord.sourceRowNumber,
    ...finding.reportRecord.customerIdentity,
    ...finding.reportRecord.enrollmentEvidence,
    ...finding.reportRecord.paymentEvidence,
  };
}

function htmlKeyValueRows(row: Record<string, unknown> | null | undefined, preferred: string[] = [], limit = 80) {
  const entries = fieldEntries(row, preferred, limit).slice(0, limit);
  if (!entries.length) return `<div class="empty">No data available.</div>`;
  return `<table class="kv"><tbody>${entries.map(([key, value]) => `
    <tr class="filter-row"><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>
  `).join("")}</tbody></table>`;
}

function htmlActionRows(actions: ReconciliationActionPreview[]) {
  if (!actions.length) return `<div class="empty">No safe database update preview is available for this row yet.</div>`;
  return `<table class="grid"><thead><tr><th>Target collection/doc</th><th>Action</th><th>Current</th><th>Proposed</th><th>Warning</th></tr></thead><tbody>${actions.map((action) => `
    <tr class="filter-row">
      <td>${escapeHtml(action.target)}${action.targetId ? `/${escapeHtml(action.targetId)}` : ""}</td>
      <td>${escapeHtml(action.label)}</td>
      <td>${escapeHtml(action.currentValue)}</td>
      <td>${escapeHtml(action.proposedValue)}</td>
      <td>${escapeHtml(action.warning || "")}</td>
    </tr>
  `).join("")}</tbody></table>`;
}

function htmlCompareCellRows(row: CompareRow, visibleSourceIds?: Set<string>) {
  const cells = row.cells.filter((cell) => !visibleSourceIds || visibleSourceIds.has(cell.sourceId));
  if (!cells.length) return `<div class="empty">No visible source cells.</div>`;
  return `<table class="grid"><thead><tr><th>Source</th><th>Status</th><th>Value</th><th>Detail</th></tr></thead><tbody>${cells.map((cell) => `
    <tr class="filter-row">
      <td>${escapeHtml(cell.sourceLabel)}</td>
      <td><span class="pill">${escapeHtml(cell.status)}</span></td>
      <td>${escapeHtml(cell.value)}</td>
      <td>${escapeHtml(cell.detail || "")}</td>
    </tr>
  `).join("")}</tbody></table>`;
}

function openReviewHtml(title: string, status: string, subtitle: string, sections: Array<{ title: string; html: string }>) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
    header { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid #cbd5e1; background: #fff; padding: 14px 18px; }
    h1 { margin: 0; font-size: 20px; }
    .sub { margin-top: 4px; color: #64748b; font-size: 13px; }
    .toolbar { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
    input { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; min-width: 320px; }
    main { padding: 16px; }
    .status { display: inline-flex; border-radius: 999px; border: 1px solid #94a3b8; background: #f1f5f9; padding: 4px 10px; font-size: 12px; font-weight: 700; letter-spacing: .06em; }
    .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    section { margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; overflow: hidden; }
    h2 { margin: 0; border-bottom: 1px solid #e2e8f0; background: #f8fafc; padding: 9px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #475569; }
    .body { padding: 12px; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { color: #475569; white-space: nowrap; }
    table.kv th { width: 220px; }
    .pill { display: inline-block; border-radius: 999px; border: 1px solid #cbd5e1; background: #f8fafc; padding: 2px 7px; font-size: 11px; }
    .empty { color: #94a3b8; font-size: 12px; }
    @media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } input { min-width: 0; width: 100%; } }
  </style>
</head>
<body>
  <header>
    <span class="status">${escapeHtml(status)}</span>
    <h1>${escapeHtml(title)}</h1>
    <div class="sub">${escapeHtml(subtitle)}</div>
    <div class="toolbar"><input id="filter" placeholder="Filter raw keys, values, sources, actions..." /></div>
  </header>
  <main>
    ${sections.map((section, index) => `
      <section class="${index < 2 ? "half" : ""}">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="body">${section.html}</div>
      </section>
    `).join("")}
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

function openFindingReviewTab(finding: ReconciliationFinding) {
  const actions = buildActionPreviews(finding);
  openReviewHtml(
    finding.title || finding.kind.replace(/_/g, " "),
    reviewStatusForFinding(finding),
    `${issueBucketForFinding(finding)} | ${finding.sourceSystemLabel} | ${finding.sourceFile} | row ${finding.sourceRowNumber ?? "-"}`,
    [
      {
        title: "Database updates needed",
        html: [
          finding.proposedAction ? `<p class="filter-row">${escapeHtml(finding.proposedAction)}</p>` : "",
          htmlActionRows(actions),
        ].filter(Boolean).join(""),
      },
      {
        title: "Why this matters",
        html: `<table class="grid"><tbody>${finding.explanation.map((line) => `<tr class="filter-row"><td>${escapeHtml(line)}</td></tr>`).join("")}</tbody></table>`,
      },
      {
        title: "Uploaded source row",
        html: htmlKeyValueRows(finding.reportRecord?.raw, [], 140),
      },
      {
        title: "Normalized row",
        html: htmlKeyValueRows(normalizedFindingRow(finding), ["sourceType", "recordKind", "firstName", "lastName", "fullName", "dob", "hmisId", "caseworthyId", "projectName", "entryDate", "exitDate", "amount", "transactionDate", "serviceMonth", "vendor", "reference"], 100),
      },
      {
        title: "Matched customer doc",
        html: htmlKeyValueRows(finding.matchedCustomer, ["id", "firstName", "lastName", "fullName", "dob", "dateOfBirth", "hmisId", "HMISId", "cwId", "CWID", "caseworthyId", "caseWorthyId", "active", "status", "caseManagerId", "assignedToUid"], 100),
      },
      {
        title: "Matched enrollment doc",
        html: htmlKeyValueRows(finding.matchedEnrollment, ["id", "customerId", "grantId", "grantName", "programId", "programName", "status", "active", "entryDate", "startDate", "exitDate", "endDate"], 100),
      },
      {
        title: "Payment / ledger candidates",
        html: finding.matchedPaymentCandidates?.length
          ? `<table class="grid"><thead><tr><th>ID</th><th>Source</th><th>Month</th><th>Amount</th><th>Status</th><th>Customer</th></tr></thead><tbody>${finding.matchedPaymentCandidates.map((row, index) => `<tr class="filter-row"><td>${escapeHtml(row.id ?? index)}</td><td>${escapeHtml(row.source)}</td><td>${escapeHtml(row.month ?? String(row.dueDate ?? row.date ?? "").slice(0, 7))}</td><td>${escapeHtml(row.amount ?? row.amountAbs ?? row.amountCents)}</td><td>${escapeHtml(row.queueStatus ?? row.paid)}</td><td>${escapeHtml(row.customerId ?? row.customerNameAtSpend ?? row.customer)}</td></tr>`).join("")}</tbody></table>`
          : `<div class="empty">No payment or ledger candidates attached to this finding.</div>`,
      },
    ],
  );
}

function reviewStatusForCompareRow(row: CompareRow, manualGroupId?: string) {
  if (manualGroupId) return "MANUAL MATCH";
  if (row.status === "matched") return "MATCH";
  if (row.status === "partial") return "PARTIAL MATCH";
  const present = row.cells.filter((cell) => cell.status !== "missing" && cell.status !== "not_scanned");
  const reportOnly = present.length && present.every((cell) => cell.sourceId.startsWith("report:"));
  const databaseOnly = present.length && present.every((cell) => cell.sourceId.startsWith("database:") || cell.sourceId === "paymentQueue" || cell.sourceId === "ledger" || cell.sourceId === "budgetProjected" || cell.sourceId === "budgetSpent");
  if (reportOnly) return row.mode === "payments" ? "REPORT ONLY" : "HMIS/CASEWORTHY ONLY";
  if (databaseOnly) return "DATABASE ONLY";
  return "REVIEW";
}

function openCompareRowReviewTab(row: CompareRow, visibleSourceIds: Set<string>, manualGroupId?: string) {
  const sourceRows = row.cells
    .filter((cell) => visibleSourceIds.has(cell.sourceId) && cell.row)
    .map((cell) => ({ label: cell.sourceLabel, row: cell.row as Record<string, unknown> }));
  openReviewHtml(
    `${row.mode.replace(/_/g, " ")} row - ${row.name || "unnamed"}`,
    reviewStatusForCompareRow(row, manualGroupId),
    `${row.matchStatus} | ${row.date || "-"}${row.amount == null ? "" : ` | $${row.amount.toFixed(2)}`}`,
    [
      {
        title: "Database action focus",
        html: htmlKeyValueRows({
          matchStatus: manualGroupId ? `Manual match ${manualGroupId}` : row.matchStatus,
          actionHint: row.fields.actionHint || (row.mode === "payments" ? "Review Caseworthy/HMIS service row against payment queue or ledger amount." : "Review dashboard customer/enrollment structure."),
          cwid: row.fields.cwid,
          hmisId: row.fields.hmisId,
          enrollmentName: row.fields.enrollmentName,
          date: row.date,
          endDate: row.fields.endDate,
          amount: row.amount == null ? "" : `$${row.amount.toFixed(2)}`,
          vendor: row.fields.vendor,
          status: row.fields.status || row.fields.activeState,
          paidFlag: row.fields.paidFlag,
          budgetState: row.fields.budgetState,
          sourceOfTruth: row.fields.sourceOfTruth,
        }, ["matchStatus", "actionHint", "sourceOfTruth", "cwid", "hmisId", "enrollmentName", "date", "endDate", "amount", "vendor", "status"], 40),
      },
      {
        title: "Side-by-side source match",
        html: htmlCompareCellRows(row, visibleSourceIds),
      },
      {
        title: "Match reasons",
        html: `<table class="grid"><tbody>${[manualGroupId ? `Manual match ${manualGroupId} selected in this review session.` : "", row.matchStatus, ...row.matchReasons].filter(Boolean).map((line) => `<tr class="filter-row"><td>${escapeHtml(line)}</td></tr>`).join("")}</tbody></table>`,
      },
      ...sourceRows.map((item) => ({
        title: `Raw row - ${item.label}`,
        html: htmlKeyValueRows(item.row, [], 140),
      })),
    ],
  );
}

function appScriptLikeStatus(row: CompareRow) {
  const flag = String(row.fields.sourceOfTruth || "").toLowerCase();
  if (flag.includes("hmis/caseworthy row has no matching fe")) return "HMIS ONLY";
  if (flag.includes("hmis") || flag.includes("dashboard") || flag.includes("fe row")) return "NO MATCH";
  if (row.status === "matched") return "MATCH";
  if (row.status === "partial" || row.status === "mismatch") return "PARTIAL MATCH";
  const present = row.cells.filter((cell) => cell.status !== "missing" && cell.status !== "not_scanned");
  if (present.some((cell) => /hmis|caseworthy/i.test(cell.sourceLabel)) && !present.some((cell) => /financial|edge|fe/i.test(cell.sourceLabel))) return "HMIS ONLY";
  return "NO MATCH";
}

function isHmisCompareCell(cell: CompareRow["cells"][number]) {
  const raw = cell.row || {};
  const keys = Object.keys(raw);
  return /hmis|caseworthy/i.test(cell.sourceLabel) ||
    keys.some((key) => /client id|first name|last name|service code|provider specific|group total cost/i.test(key));
}

function isFeCompareCell(cell: CompareRow["cells"][number]) {
  const raw = cell.row || {};
  const keys = Object.keys(raw);
  return /financial|edge|project activity|\bfe\b/i.test(cell.sourceLabel) ||
    keys.some((key) => /account|balance|reference|invoice|debit|credit|description/i.test(key));
}

function rawValue(row: Record<string, unknown> | undefined, aliases: string[]) {
  if (!row) return "";
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const exact = entries.find(([key]) => key.toLowerCase() === alias.toLowerCase());
    if (exact) return exact[1];
  }
  for (const alias of aliases) {
    const loose = entries.find(([key]) => key.toLowerCase().includes(alias.toLowerCase()));
    if (loose) return loose[1];
  }
  return "";
}

function compareRowsToAppScriptRows(rows: CompareRow[]) {
  return rows.map((row) => {
    const hmisCell = row.cells.find((cell) => cell.status !== "missing" && isHmisCompareCell(cell));
    const feCell = row.cells.find((cell) => cell.status !== "missing" && isFeCompareCell(cell));
    const h = hmisCell?.row as Record<string, unknown> | undefined;
    const fe = feCell?.row as Record<string, unknown> | undefined;
    const status = appScriptLikeStatus(row);
    return {
      id: row.id,
      grant: row.fields.grant || row.fields.enrollmentName || "",
      name: row.name || "",
      enrollment: row.fields.enrollmentName || row.fields.grant || "",
      hmisProviderId: rawValue(h, ["Provider Id", "Provider ID", "Provider Name", "Project Name", "providerId", "grant"]) || (hmisCell ? row.fields.grant : ""),
      hmisClientId: rawValue(h, ["Client ID", "Client Id", "ClientID", "clientId", "hmisId"]) || row.fields.hmisId || "",
      hmisFirstName: rawValue(h, ["First Name", "Given Name", "firstName"]),
      hmisLastName: rawValue(h, ["Last Name", "Surname", "lastName"]),
      hmisStartDate: rawValue(h, ["Service Start Date", "Start Date", "Date", "serviceStartDate"]) || (hmisCell ? row.date : ""),
      hmisServiceDescription: rawValue(h, ["Service Code Description", "Service Description", "Description", "serviceDescription"]),
      hmisProviderDesc: rawValue(h, ["Provider Specific Code", "Provider-Specific Code", "providerSpecificCode", "Service Code"]),
      hmisAmount: rawValue(h, ["Group Total Cost of Units", "Total Cost", "Cost", "Amount", "amount"]) || (hmisCell && row.amount != null ? row.amount : ""),
      match: status,
      feAmount: rawValue(fe, ["Balance", "Amount", "Transaction Amount", "Debit", "Credit", "amount"]) || (feCell && row.amount != null ? row.amount : ""),
      feInvoice: rawValue(fe, ["Invoice", "Account", "GL Account", "Account Code", "reference"]),
      feRefDesc: rawValue(fe, ["Reference", "Ref", "Description", "Vendor Invoice Description", "Memo", "Line Description"]) || (feCell ? row.fields.vendor : ""),
      feDate: rawValue(fe, ["Date", "Transaction Date", "Post Date", "GL Date", "Document Date"]) || (feCell ? row.date : ""),
      score: status === "MATCH" ? "1.00" : status === "PARTIAL MATCH" ? "0.70" : "",
      matchReason: [row.matchStatus, row.fields.sourceOfTruth, ...row.matchReasons].filter(Boolean).join(" | "),
      hidden: false,
    };
  });
}

function openAppScriptLikeReconciliationTab(title: string, rows: CompareRow[]) {
  const appRows = compareRowsToAppScriptRows(rows);
  const totals = appRows.reduce((acc, row) => {
    const h = Number(String(row.hmisAmount || "").replace(/[$,]/g, ""));
    const f = Number(String(row.feAmount || "").replace(/[$,]/g, ""));
    if (Number.isFinite(h)) acc.hmis += h;
    if (Number.isFinite(f)) acc.fe += f;
    acc.counts[row.match] = (acc.counts[row.match] || 0) + 1;
    return acc;
  }, { hmis: 0, fe: 0, counts: {} as Record<string, number> });
  const payload = JSON.stringify(appRows).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
    header { position: sticky; top: 0; z-index: 5; border-bottom: 1px solid #cbd5e1; background: #fff; padding: 14px 18px; }
    h1 { margin: 0 0 8px; font-size: 20px; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 8px; margin: 10px 0; }
    .metric { border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; padding: 8px; }
    .metric b { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; }
    .toolbar { display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 8px; align-items: end; }
    input, select { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px; width: 100%; box-sizing: border-box; }
    label { font-size: 11px; color: #475569; font-weight: 700; text-transform: uppercase; }
    button { border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; padding: 7px 10px; cursor: pointer; }
    main { padding: 16px; }
    table { border-collapse: collapse; width: max-content; min-width: 100%; font-size: 12px; background: #fff; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; white-space: nowrap; }
    th { position: sticky; top: 154px; z-index: 2; background: #e2e8f0; font-weight: 700; }
    .wrap { max-width: 320px; white-space: normal; }
    .MATCH { background: #dcfce7; }
    .PARTIAL-MATCH { background: #fef3c7; }
    .HMIS-ONLY { background: #dbeafe; }
    .NO-MATCH { background: #fee2e2; }
    .hidden-row { display: none; }
    .legend { margin-left: 8px; color: #64748b; font-size: 12px; }
    @media (max-width: 900px) { .summary, .toolbar { grid-template-columns: 1fr; } th { top: 260px; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="summary">
      <div class="metric"><b>HMIS Amount Total</b><span id="hmisTotal"></span></div>
      <div class="metric"><b>FE Amount Total</b><span id="feTotal"></span></div>
      <div class="metric"><b>Absolute Difference</b><span id="diffTotal"></span></div>
      <div class="metric"><b>Status</b><span id="balanceStatus"></span></div>
      <div class="metric"><b>Counts</b><span id="counts"></span></div>
    </div>
    <div class="toolbar">
      <div><label>Filter keys</label><select id="status"><option value="">All</option><option>MATCH</option><option>PARTIAL MATCH</option><option>HMIS ONLY</option><option>NO MATCH</option></select></div>
      <div><label>Search name</label><input id="name" placeholder="First, last, FE ref..." /></div>
      <div><label>Search enrollment fuzzy</label><input id="enrollment" placeholder="Grant, provider, service..." /></div>
      <div><label>General search</label><input id="search" placeholder="Any visible field..." /></div>
      <label style="display:flex;align-items:center;gap:8px;text-transform:none;font-weight:400;"><input id="unmatched" type="checkbox" style="width:auto;" /> Show unmatched only</label>
      <label style="display:flex;align-items:center;gap:8px;text-transform:none;font-weight:400;"><input id="showHidden" type="checkbox" style="width:auto;" /> Show hidden rows</label>
      <button id="clear" type="button">Clear filters</button>
      <span class="legend">Legend: MATCH = strong automatic match; PARTIAL MATCH = likely related but needs review; HMIS ONLY = HMIS row without accepted FE match; NO MATCH = FE row without accepted HMIS match.</span>
    </div>
  </header>
  <main>
    <div style="overflow:auto;">
      <table>
        <thead><tr>
          <th>HMIS Provider ID</th><th>HMIS Client Id</th><th>HMIS First Name</th><th>HMIS Last Name</th><th>HMIS Start Date</th><th>HMIS Service Code Description</th><th>HMIS Provider/Desc</th><th>HMIS Amount</th><th>MATCH?</th><th>FE Amount</th><th>FE Invoice</th><th>FE Ref/Desc</th><th>FE Date</th><th>Score</th><th>Match Reason</th><th>Hide</th>
        </tr></thead>
        <tbody id="body"></tbody>
      </table>
    </div>
  </main>
  <script>
    const rows = ${payload};
    const hidden = new Set();
    const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
    const body = document.getElementById("body");
    const fields = ["hmisProviderId","hmisClientId","hmisFirstName","hmisLastName","hmisStartDate","hmisServiceDescription","hmisProviderDesc","hmisAmount","match","feAmount","feInvoice","feRefDesc","feDate","score","matchReason"];
    function norm(v) { return String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
    function tokens(v) { return norm(v).split(" ").filter(t => t.length >= 2); }
    function fuzzyIncludes(hay, needle) {
      const need = tokens(needle);
      if (!need.length) return true;
      const h = norm(hay);
      return need.every(t => h.includes(t));
    }
    function num(v) {
      const n = Number(String(v ?? "").replace(/[$,]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    function recalc(visible) {
      const hmis = visible.reduce((s, r) => s + num(r.hmisAmount), 0);
      const fe = visible.reduce((s, r) => s + num(r.feAmount), 0);
      const diff = Math.abs(hmis) - Math.abs(fe);
      const counts = visible.reduce((acc, r) => (acc[r.match] = (acc[r.match] || 0) + 1, acc), {});
      document.getElementById("hmisTotal").textContent = money.format(hmis);
      document.getElementById("feTotal").textContent = money.format(fe);
      document.getElementById("diffTotal").textContent = money.format(diff);
      document.getElementById("balanceStatus").textContent = Math.abs(diff) <= 1 ? "BALANCED" : "REVIEW";
      document.getElementById("counts").textContent = "MATCH: " + (counts["MATCH"] || 0) + " | PARTIAL: " + (counts["PARTIAL MATCH"] || 0) + " | HMIS ONLY: " + (counts["HMIS ONLY"] || 0) + " | NO MATCH: " + (counts["NO MATCH"] || 0);
    }
    function apply() {
      const status = document.getElementById("status").value;
      const name = document.getElementById("name").value;
      const enrollment = document.getElementById("enrollment").value;
      const search = document.getElementById("search").value;
      const unmatched = document.getElementById("unmatched").checked;
      const showHidden = document.getElementById("showHidden").checked;
      const visible = rows.filter(r => {
        if (!showHidden && hidden.has(r.id)) return false;
        if (status && r.match !== status) return false;
        if (unmatched && (r.match === "MATCH")) return false;
        if (!fuzzyIncludes([r.hmisFirstName, r.hmisLastName, r.name, r.feRefDesc].join(" "), name)) return false;
        if (!fuzzyIncludes([r.grant, r.enrollment, r.hmisProviderId, r.hmisProviderDesc, r.hmisServiceDescription].join(" "), enrollment)) return false;
        if (!fuzzyIncludes(fields.map(f => r[f]).join(" "), search)) return false;
        return true;
      });
      body.innerHTML = visible.map(r => {
        const cls = r.match.replace(/\\s+/g, "-");
        return "<tr class='" + cls + "'>" + fields.map(f => "<td class='" + (f === "matchReason" || f === "feRefDesc" ? "wrap" : "") + "'>" + String(r[f] ?? "").replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + "</td>").join("") + "<td><button data-hide='" + r.id + "'>Hide</button></td></tr>";
      }).join("");
      recalc(visible);
    }
    document.querySelectorAll("input,select").forEach(el => el.addEventListener("input", apply));
    document.getElementById("clear").addEventListener("click", () => { document.querySelectorAll("input").forEach(i => { if (i.type === "checkbox") i.checked = false; else i.value = ""; }); document.getElementById("status").value = ""; apply(); });
    body.addEventListener("click", e => { const id = e.target && e.target.getAttribute && e.target.getAttribute("data-hide"); if (!id) return; hidden.add(id); apply(); });
    apply();
  </script>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function fieldEntries(row: Record<string, unknown> | null | undefined, preferred: string[] = [], limit = 18) {
  if (!row) return [];
  const seen = new Set<string>();
  const entries: Array<[string, unknown]> = [];
  for (const key of preferred) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      entries.push([key, row[key]]);
      seen.add(key);
    }
  }
  for (const entry of Object.entries(row)) {
    if (seen.has(entry[0])) continue;
    if (entries.length >= limit) break;
    entries.push(entry);
  }
  return entries.filter(([, value]) => value != null && formatValue(value) !== "-");
}

function KeyValueBlock({
  title,
  row,
  preferred = [],
}: {
  title: string;
  row?: Record<string, unknown> | null;
  preferred?: string[];
}) {
  const entries = fieldEntries(row, preferred);
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {entries.length ? (
        <div className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <React.Fragment key={key}>
              <div className="truncate font-medium text-slate-500" title={key}>{key}</div>
              <div className="min-w-0 break-words text-slate-800 dark:text-slate-100">{formatValue(value)}</div>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-400">No data available.</div>
      )}
    </div>
  );
}

function DetailSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </summary>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">{children}</div>
    </details>
  );
}

function FindingDetail({ finding }: { finding: ReconciliationFinding | null }) {
  if (!finding) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
        Select a finding to review details.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">{finding.title || finding.kind.replace(/_/g, " ")}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">{finding.kind.replace(/_/g, " ")}</div>
          <div className="text-sm text-slate-500">{finding.sourceSystemLabel} - {finding.sourceFile} - row {finding.sourceRowNumber ?? "-"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded border px-2 py-1 text-xs ${severityClass(finding.severity)}`}>{issueBucketForFinding(finding)}</span>
          <span className={`rounded border px-2 py-1 text-xs ${severityClass(finding.severity)}`}>{finding.severity}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openFindingReviewTab(finding)}>
            Open raw review tab
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source Type</div>
          <div>{finding.sourceProfileLabel || finding.sourceProfileId || finding.recordKind}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Match Confidence</div>
          <div>{Math.round(finding.confidence * 100)}%</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</div>
          <div>{finding.customerLabel || finding.customerId || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enrollment / Payment</div>
          <div>{finding.enrollmentId || finding.paymentId || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report Value</div>
          <div>{finding.reportValue || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dashboard Value</div>
          <div>{finding.dashboardValue || "-"}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">What changed</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {finding.explanation.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
      <div className="mt-4 space-y-3">
        {finding.match?.criteria.length ? (
          <DetailSection title="Match Criteria" defaultOpen>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
              {finding.match.criteria.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </DetailSection>
        ) : null}
        {finding.proposedAction ? (
          <DetailSection title="Actions" defaultOpen>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {finding.proposedAction}
            </div>
            <ActionPreviewList actions={buildActionPreviews(finding)} />
          </DetailSection>
        ) : (
          <ActionPreviewList actions={buildActionPreviews(finding)} />
        )}
      </div>
      <div className="mt-4 space-y-3">
        <DetailSection title="Matched Customer Doc" defaultOpen>
          <KeyValueBlock
            title="Customer fields"
            row={finding.matchedCustomer}
            preferred={["id", "firstName", "lastName", "fullName", "dob", "dateOfBirth", "hmisId", "HMISId", "cwId", "CWID", "caseworthyId", "caseWorthyId", "active", "status", "caseManagerId", "assignedToUid"]}
          />
        </DetailSection>
        <DetailSection title="Normalized Report Row" defaultOpen>
          <KeyValueBlock
            title="Normalized fields"
            row={finding.reportRecord ? {
              sourceType: finding.reportRecord.sourceType,
              recordKind: finding.reportRecord.recordKind,
              sourceRowNumber: finding.reportRecord.sourceRowNumber,
              ...finding.reportRecord.customerIdentity,
              ...finding.reportRecord.enrollmentEvidence,
              ...finding.reportRecord.paymentEvidence,
            } : null}
            preferred={["sourceType", "recordKind", "firstName", "lastName", "fullName", "dob", "hmisId", "caseworthyId", "projectName", "entryDate", "exitDate", "amount", "transactionDate", "serviceMonth", "vendor", "reference"]}
          />
        </DetailSection>
        <DetailSection title="Uploaded Source Row">
          <KeyValueBlock title="Source fields" row={finding.reportRecord?.raw} />
        </DetailSection>
        <DetailSection title="Matched Enrollment Doc">
          <KeyValueBlock
            title="Enrollment fields"
            row={finding.matchedEnrollment}
            preferred={["id", "customerId", "grantId", "grantName", "programId", "programName", "status", "active", "entryDate", "startDate", "exitDate", "endDate"]}
          />
        </DetailSection>
      </div>
      {finding.matchedPaymentCandidates?.length ? (
        <div className="mt-4">
          <DetailSection title="Matched Payment / Ledger Candidates" defaultOpen>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-1">ID</th>
                    <th className="px-2 py-1">Source</th>
                    <th className="px-2 py-1">Month</th>
                    <th className="px-2 py-1">Amount</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {finding.matchedPaymentCandidates.map((row, index) => (
                    <tr key={String(row.id ?? index)} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-2 py-1">{formatValue(row.id)}</td>
                      <td className="px-2 py-1">{formatValue(row.source)}</td>
                      <td className="px-2 py-1">{formatValue(row.month ?? String(row.dueDate ?? row.date ?? "").slice(0, 7))}</td>
                      <td className="px-2 py-1">{formatValue(row.amount ?? row.amountAbs ?? row.amountCents)}</td>
                      <td className="px-2 py-1">{formatValue(row.queueStatus ?? row.paid)}</td>
                      <td className="px-2 py-1">{formatValue(row.customerId ?? row.customerNameAtSpend ?? row.customer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>
        </div>
      ) : null}
    </div>
  );
}

type QueueRow = {
  id: string;
  finding: ReconciliationFinding;
  action?: ReconciliationActionPreview;
  label: string;
  target: string;
  proposed: string;
  current: string;
  confidence: number;
  blocked: boolean;
  warning?: string;
};

function buildQueueRows(findings: ReconciliationFinding[]): QueueRow[] {
  return findings.flatMap((finding) => {
    const actions = buildActionPreviews(finding);
    if (actions.length) {
      return actions.map((action) => ({
        id: action.id,
        finding,
        action,
        label: action.label,
        target: action.targetId ? `${action.target}/${action.targetId}` : action.target,
        proposed: action.proposedValue,
        current: action.currentValue,
        confidence: action.confidence,
        blocked: Boolean(action.warning),
        warning: action.warning,
      }));
    }
    return [{
      id: `${finding.id}:review-only`,
      finding,
      label: finding.proposedAction || "Review database structure before writeback",
      target: issueBucketForFinding(finding),
      proposed: finding.reportValue || finding.dashboardValue || finding.sourceSystemLabel,
      current: finding.dashboardValue || "(needs review)",
      confidence: finding.confidence,
      blocked: true,
      warning: "No safe direct write action is available yet; use raw review to confirm the database change needed.",
    }];
  });
}

function ActionQueuePanel({
  selectedFindings,
  customers,
  grants,
  enrollments,
  onClear,
  onApplyCustomerPatches,
  onCreateCustomers,
  onBulkEnroll,
}: {
  selectedFindings: ReconciliationFinding[];
  customers: Array<Record<string, unknown>>;
  grants: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
  onClear: () => void;
  onApplyCustomerPatches: () => void;
  onCreateCustomers: () => void;
  onBulkEnroll: () => void;
}) {
  const queueRows = React.useMemo(() => buildQueueRows(selectedFindings), [selectedFindings]);
  const hmisPatchRows = React.useMemo(() => buildBulkHmisCustomerPatchRows(selectedFindings), [selectedFindings]);
  const importRows = React.useMemo(() => buildBulkCustomerImportRows(selectedFindings, customers), [customers, selectedFindings]);
  const enrollmentRows = React.useMemo(
    () => buildBulkEnrollmentRows(
      selectedFindings,
      grants.map((grant) => ({
        id: String(grant.id ?? ""),
        name: String(grant.name ?? grant.grantName ?? grant.label ?? grant.title ?? grant.id ?? ""),
      })).filter((grant) => grant.id || grant.name),
      enrollments,
    ),
    [enrollments, grants, selectedFindings],
  );
  const hmisEligibleCount = hmisPatchRows.filter((row) => !row.blocked).length;
  const importEligibleCount = importRows.filter((row) => !row.blocked).length;
  const enrollmentEligibleCount = enrollmentRows.filter((row) => !row.blocked).length;
  const readyCount = queueRows.filter((row) => !row.blocked).length;
  const reviewCount = queueRows.length - readyCount;
  const byTarget = React.useMemo(() => {
    const map = new Map<string, QueueRow[]>();
    for (const row of queueRows) {
      const target = row.action?.target || row.target;
      map.set(target, [...(map.get(target) ?? []), row]);
    }
    return Array.from(map.entries());
  }, [queueRows]);
  if (!selectedFindings.length) return null;
  return (
    <div className="rounded-lg border border-sky-200 bg-white p-3 shadow-sm dark:border-sky-900 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Pending database update queue</div>
          <div className="text-xs text-slate-500">
            {selectedFindings.length} findings selected - {readyCount} ready action{readyCount === 1 ? "" : "s"} - {reviewCount} review-only row{reviewCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!enrollmentRows.length}
            title={enrollmentRows.length ? "Open enrollment create/date review for selected enrollment findings." : "No selected findings have enrollment create or date update actions."}
            onClick={onBulkEnroll}
          >
            Bulk enroll{enrollmentEligibleCount ? ` (${enrollmentEligibleCount})` : ""}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!importRows.length}
            title={importRows.length ? "Open customer create review for unmatched report rows." : "No selected findings have unmatched customer rows."}
            onClick={onCreateCustomers}
          >
            Create customers{importEligibleCount ? ` (${importEligibleCount})` : ""}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!hmisEligibleCount}
            title={hmisEligibleCount ? "Open HMIS ID customer patch review." : "No selected findings have eligible HMIS ID customer patches."}
            onClick={onApplyCustomerPatches}
          >
            Push HMIS IDs{hmisEligibleCount ? ` (${hmisEligibleCount})` : ""}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>Clear</button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr]">
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-2 font-semibold uppercase tracking-wide text-slate-500">Targets</div>
          <div className="space-y-1">
            {byTarget.map(([target, rows]) => (
              <div key={target} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 dark:bg-slate-950">
                <span className="truncate" title={target}>{target}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">{rows.length}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="max-h-72 overflow-auto rounded border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-2 py-1">State</th>
                <th className="px-2 py-1">Database action</th>
                <th className="px-2 py-1">Target</th>
                <th className="px-2 py-1">Current</th>
                <th className="px-2 py-1">Proposed</th>
                <th className="px-2 py-1">Review</th>
              </tr>
            </thead>
            <tbody>
              {queueRows.slice(0, 100).map((row) => (
                <tr key={row.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                  <td className="px-2 py-1">
                    <span className={row.blocked ? "rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-800" : "rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700"}>
                      {row.blocked ? "review" : "ready"}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{row.label}</div>
                    <div className="text-[11px] text-slate-400">{issueBucketForFinding(row.finding)} - {Math.round(row.confidence * 100)}%</div>
                    {row.warning ? <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{row.warning}</div> : null}
                  </td>
                  <td className="px-2 py-1">{row.target}</td>
                  <td className="px-2 py-1">{row.current}</td>
                  <td className="px-2 py-1">{row.proposed}</td>
                  <td className="px-2 py-1">
                    <button type="button" className="btn btn-secondary btn-xs" onClick={() => openFindingReviewTab(row.finding)}>
                      Raw review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {queueRows.length > 100 ? <div className="border-t border-slate-200 px-2 py-1 text-xs text-slate-400 dark:border-slate-800">Showing first 100 of {queueRows.length} queued rows.</div> : null}
        </div>
      </div>
    </div>
  );
}

function toggleValue<T extends string>(current: T[], value: T) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function defaultCompareMode(kind: ReconciliationToolKind): CompareMode {
  if (kind === "payment") return "payments";
  if (kind === "enrollment") return "enrollments";
  return "customer_exits";
}

function aggregationKey(kind: ReconciliationToolKind, finding: ReconciliationFinding) {
  if (kind === "payment") return "";
  const customerKey = finding.customerId || finding.customerLabel || finding.reportValue || "unmatched";
  if (kind === "identity") return [finding.kind, customerKey].join("::");
  if (kind === "enrollment") return [finding.kind, customerKey, finding.enrollmentId || finding.reportValue || finding.dashboardValue || ""].join("::");
  return "";
}

function aggregateFindingsForTool(kind: ReconciliationToolKind, findings: ReconciliationFinding[]) {
  if (kind === "payment") return findings;
  const byKey = new Map<string, ReconciliationFinding[]>();
  const passthrough: ReconciliationFinding[] = [];
  for (const finding of findings) {
    const key = aggregationKey(kind, finding);
    if (!key || finding.kind === "report_row_diagnostic") {
      passthrough.push(finding);
      continue;
    }
    byKey.set(key, [...(byKey.get(key) ?? []), finding]);
  }
  const aggregated = Array.from(byKey.values()).map((group) => {
    const primary = group.slice().sort((a, b) => b.confidence - a.confidence)[0];
    if (group.length === 1) return primary;
    const sourceFiles = Array.from(new Set(group.map((finding) => finding.sourceFile).filter(Boolean)));
    const sourceRows = group.map((finding) => finding.sourceRowNumber).filter((row) => row != null);
    return {
      ...primary,
      id: `${primary.id}::aggregated-${group.length}`,
      title: `${primary.title || primary.kind.replace(/_/g, " ")} (${group.length} rows)`,
      sourceFile: sourceFiles.length === 1 ? sourceFiles[0] : `${sourceFiles.length} source files`,
      sourceRowNumber: null,
      explanation: [
        ...primary.explanation,
        `Aggregated ${group.length} related ${kind} finding rows${sourceRows.length ? ` across source rows ${sourceRows.slice(0, 8).join(", ")}${sourceRows.length > 8 ? "..." : ""}` : ""}.`,
      ],
      confidence: Math.max(...group.map((finding) => finding.confidence)),
    } satisfies ReconciliationFinding;
  });
  return [...aggregated, ...passthrough].sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity] || (a.title || "").localeCompare(b.title || "");
  });
}

function findingSearchText(finding: ReconciliationFinding) {
  const record = finding.reportRecord;
  return [
    finding.title,
    finding.customerId,
    finding.customerLabel,
    finding.enrollmentId,
    finding.paymentId,
    finding.reportValue,
    finding.dashboardValue,
    finding.sourceFile,
    record?.customerIdentity.firstName,
    record?.customerIdentity.lastName,
    record?.customerIdentity.fullName,
    record?.customerIdentity.hmisId,
    record?.customerIdentity.caseworthyId,
    record?.customerIdentity.dob,
    record?.raw?.cwId,
    record?.raw?.CWID,
    record?.raw?.["CW ID"],
    finding.matchedCustomer?.id,
    finding.matchedCustomer?.hmisId,
    finding.matchedCustomer?.HMISId,
    finding.matchedCustomer?.cwId,
    finding.matchedCustomer?.caseworthyId,
  ].map((value) => String(value ?? "").toLowerCase()).join(" ");
}

function ReviewFilterPanel({
  findings,
  value,
  onChange,
}: {
  findings: ReconciliationFinding[];
  value: ReconciliationToolFilterState;
  onChange?: (next: ReconciliationToolFilterState) => void;
}) {
  const files = React.useMemo(() => Array.from(new Set(findings.map((finding) => finding.sourceFile).filter(Boolean))).sort(), [findings]);
  const systems = React.useMemo(() => Array.from(new Map(findings.map((finding) => [finding.sourceSystem, finding.sourceSystemLabel])).entries()), [findings]);
  const kinds = React.useMemo(() => Array.from(new Set(findings.map((finding) => finding.kind))).sort(), [findings]);
  const sourceFiles = value.sourceFiles ?? [];
  const sourceSystems = value.sourceSystems ?? [];
  const findingKinds = value.findingKinds ?? [];
  if (!findings.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Issue display filters</div>
          <div className="text-xs text-slate-500">Empty filter groups show all values.</div>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange?.({ ...value, sourceFiles: [], sourceSystems: [], findingKinds: [] })}>
          Clear issue filters
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Files</div>
          <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 dark:border-slate-800">
            {files.map((file) => (
              <label key={file} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={sourceFiles.includes(file)} onChange={() => onChange?.({ ...value, sourceFiles: toggleValue(sourceFiles, file) })} />
                <span className="truncate" title={file}>{file}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</div>
          <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 dark:border-slate-800">
            {systems.map(([system, label]) => (
              <label key={system} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={sourceSystems.includes(system)} onChange={() => onChange?.({ ...value, sourceSystems: toggleValue(sourceSystems, system) })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Issue types</div>
          <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 dark:border-slate-800">
            {kinds.map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={findingKinds.includes(kind)} onChange={() => onChange?.({ ...value, findingKinds: toggleValue(findingKinds, kind) })} />
                <span>{kind.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function compareCellStatusClass(status: CompareCellStatus) {
  if (status === "matched") return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900";
  if (status === "missing" || status === "unmatched") return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900";
  if (status === "mismatch" || status === "partial") return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900";
  return "bg-slate-50 text-slate-400 ring-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800";
}

function CompareCellPill({ status }: { status: CompareCellStatus }) {
  return <span className={`inline-flex min-w-16 justify-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ${compareCellStatusClass(status)}`}>{status.replace(/_/g, " ")}</span>;
}

type CompareExportRow = {
  mode: string;
  matchStatus: string;
  status: string;
  name: string;
  cwid: string;
  hmisId: string;
  enrollmentName: string;
  date: string;
  endDate: string;
  amount: string;
  vendor: string;
  actionHint: string;
  paidFlag: string;
  budgetState: string;
  sourceOfTruth: string;
  sourceValues: string;
  matchReasons: string;
};

const COMPARE_EXPORT_COLUMNS: ExportColumn<CompareExportRow>[] = [
  { key: "mode", label: "Mode", value: (row) => row.mode },
  { key: "status", label: "Status", value: (row) => row.status },
  { key: "matchStatus", label: "Match Status", value: (row) => row.matchStatus },
  { key: "name", label: "Name", value: (row) => row.name },
  { key: "cwid", label: "CWID", value: (row) => row.cwid },
  { key: "hmisId", label: "HMIS ID", value: (row) => row.hmisId },
  { key: "enrollmentName", label: "Enrollment Name", value: (row) => row.enrollmentName },
  { key: "date", label: "Date", value: (row) => row.date },
  { key: "endDate", label: "End Date", value: (row) => row.endDate },
  { key: "amount", label: "Amount", value: (row) => row.amount },
  { key: "vendor", label: "Vendor", value: (row) => row.vendor },
  { key: "actionHint", label: "Action Hint", value: (row) => row.actionHint },
  { key: "paidFlag", label: "Paid Flag", value: (row) => row.paidFlag },
  { key: "budgetState", label: "Budget State", value: (row) => row.budgetState },
  { key: "sourceOfTruth", label: "Source Of Truth Flag", value: (row) => row.sourceOfTruth },
  { key: "sourceValues", label: "Source Values", value: (row) => row.sourceValues },
  { key: "matchReasons", label: "Match Reasons", value: (row) => row.matchReasons },
];

function compareRowsToExportRows(rows: CompareRow[]): CompareExportRow[] {
  return rows.map((row) => ({
    mode: row.mode.replace(/_/g, " "),
    matchStatus: row.matchStatus,
    status: row.status.replace(/_/g, " "),
    name: row.name,
    cwid: row.fields.cwid || "",
    hmisId: row.fields.hmisId || "",
    enrollmentName: row.fields.enrollmentName || "",
    date: row.date,
    endDate: row.fields.endDate || "",
    amount: row.amount == null ? "" : row.amount.toFixed(2),
    vendor: row.fields.vendor || "",
    actionHint: row.fields.actionHint || "",
    paidFlag: row.fields.paidFlag || "",
    budgetState: row.fields.budgetState || "",
    sourceOfTruth: row.fields.sourceOfTruth || "",
    sourceValues: row.cells.map((cell) => `${cell.sourceLabel}: ${cell.status} ${cell.value}`).join(" | "),
    matchReasons: row.matchReasons.join(" | "),
  }));
}

function filterRowsToValues(title: string, value: unknown): unknown[][] {
  if (!value || typeof value !== "object") return [[title, ""]];
  const rows: unknown[][] = [[title, "field", "value"]];
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    rows.push(["", key, typeof raw === "object" && raw != null ? JSON.stringify(raw) : String(raw ?? "")]);
  }
  return rows;
}

function buildComparePromptRows(opts: {
  mode: CompareMode;
  packets: ReconciliationPacket[];
  database: ReturnType<typeof applyDatabaseFilters>;
  databaseFilters: DatabaseFilterConfig;
  sources: Array<{ id: string; label: string; kind: string }>;
  visibleSourceIds: Set<string>;
  filters: {
    showOnlyProblems: boolean;
    nameFilter: string;
    grantFilter: string;
    enrollmentGranularity: EnrollmentCompareGranularity;
    showMissingSystemEnrollments: boolean;
  };
}) {
  const now = new Date().toISOString();
  const visibleSources = opts.sources.filter((source) => opts.visibleSourceIds.has(source.id));
  const rows: unknown[][] = [
    ["section", "field", "value"],
    ["Export", "Generated at", now],
    ["Export", "Compare mode", opts.mode],
    ["Export", "Filtered rows only", "yes"],
    ["Export", "Problems only", opts.filters.showOnlyProblems ? "yes" : "no"],
    ["Export", "Name / ID filter", opts.filters.nameFilter],
    ["Export", "Grant / source filter", opts.filters.grantFilter],
    ["Export", "Enrollment granularity", opts.filters.enrollmentGranularity],
    ["Export", "Show dashboard-only enrollments", opts.filters.showMissingSystemEnrollments ? "yes" : "no"],
    ["Database config", "customers collection", `customers (${opts.database.customers.length} filtered docs)`],
    ["Database config", "customer enrollments collection", `customerEnrollments (${opts.database.enrollments.length} filtered docs)`],
    ["Database config", "grants collection", `grants (${opts.database.grants.length} filtered docs)`],
    ["Database config", "payment queue collection", `paymentQueue (${opts.database.paymentQueueItems.length} filtered docs)`],
    ["Database config", "ledger collection", `ledger (${opts.database.ledger.length} filtered docs)`],
    ["Database config", "budget rollup source", "grants/{grantId}.budget.lineItems projected/spent values"],
    ["Matching", "Primary payment match", "CWID/HMIS/name + month/date + amount"],
    ["Matching", "Amount mismatch", "CWID/HMIS/name + month/date can match while amount differs; FE remains source of truth."],
    ["Matching", "Fallback payment match", "amount + month + grant/category, then unique amount + month"],
    ["Matching", "Budget rollup match", "external HMIS/FE amount + grant/category against budget projected/spent line-item rollup"],
    ["Payment flag", "Rule", "FE rows are source of truth. Missing HMIS/Caseworthy or dashboard rows are actionable. HMIS/Caseworthy rows without FE are stale/cancelled-entry review."],
  ];
  for (const source of opts.sources) rows.push(["Source", source.id, `${source.label} (${source.kind})${opts.visibleSourceIds.has(source.id) ? "" : " hidden in review"}`]);
  for (const source of visibleSources) rows.push(["Visible source", source.id, source.label]);
  for (const packet of opts.packets) {
    rows.push(["Uploaded report", "source file", packet.sourceFile]);
    rows.push(["Uploaded report", "profile", `${packet.profileLabel} (${packet.profileId})`]);
    rows.push(["Uploaded report", "record kind", packet.summary.recordKind]);
    rows.push(["Uploaded report", "header row", String(packet.headerRowIndex + 1)]);
    rows.push(["Uploaded report", "headers", packet.headers.join(" | ")]);
    rows.push(["Uploaded report", "normalized rows", String(packet.summary.normalizedRows)]);
    rows.push(["Uploaded report", "diagnostics", String(packet.summary.diagnosticCount)]);
  }
  rows.push(...filterRowsToValues("Database filters: customers", opts.databaseFilters.customers));
  rows.push(...filterRowsToValues("Database filters: enrollments", opts.databaseFilters.enrollments));
  rows.push(...filterRowsToValues("Database filters: grants", opts.databaseFilters.grants));
  rows.push(...filterRowsToValues("Database filters: paymentQueue", opts.databaseFilters.paymentQueue));
  rows.push(...filterRowsToValues("Database filters: ledger", opts.databaseFilters.ledger));
  return rows;
}

type ScratchAddRow = {
  id: string;
  dueDate: string;
  type: string;
  amount: string;
  lineItem: string;
  comment: string;
};

function isoInputValue(value: string) {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || "";
}

function compareRowPaid(row: CompareRow) {
  const haystack = [
    row.fields.status,
    row.matchStatus,
    ...row.cells.map((cell) => `${cell.value} ${cell.detail || ""} ${formatValue(cell.row?.paid)} ${formatValue(cell.row?.queueStatus)} ${formatValue(cell.row?.status)}`),
  ].join(" ").toLowerCase();
  return /\bpaid\b|closed|posted/.test(haystack) && !/\bunpaid\b/.test(haystack);
}

function compareRowSourceLabel(row: CompareRow) {
  return row.cells
    .filter((cell) => cell.status !== "missing" && cell.status !== "not_scanned")
    .map((cell) => cell.sourceLabel)
    .join(" + ") || "No source";
}

function FloatingPaymentAdjustSheet({
  open,
  customerName,
  rows,
  onClose,
}: {
  open: boolean;
  customerName: string;
  rows: CompareRow[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 120, y: 96 });
  const [editedAmounts, setEditedAmounts] = React.useState<Record<string, string>>({});
  const [editedDates, setEditedDates] = React.useState<Record<string, string>>({});
  const [editedVendors, setEditedVendors] = React.useState<Record<string, string>>({});
  const [editedLineItems, setEditedLineItems] = React.useState<Record<string, string>>({});
  const [deletedRows, setDeletedRows] = React.useState<Record<string, boolean>>({});
  const [addRows, setAddRows] = React.useState<ScratchAddRow[]>([]);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) return;
    setEditedAmounts({});
    setEditedDates({});
    setEditedVendors({});
    setEditedLineItems({});
    setDeletedRows({});
    setAddRows([]);
  }, [open, customerName]);

  const beginDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button,input,select,textarea")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const base = position;
    const onMove = (moveEvent: PointerEvent) => {
      setPosition({
        x: Math.max(8, Math.min(window.innerWidth - 320, base.x + moveEvent.clientX - startX)),
        y: Math.max(8, Math.min(window.innerHeight - 120, base.y + moveEvent.clientY - startY)),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [position]);

  const addRow = React.useCallback(() => {
    setAddRows((current) => [
      ...current,
      { id: `scratch:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`, dueDate: "", type: "service", amount: "", lineItem: "", comment: "" },
    ]);
  }, []);

  const updateAddRow = React.useCallback((id: string, patch: Partial<ScratchAddRow>) => {
    setAddRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }, []);

  const editedCount = React.useMemo(() => {
    const editedIds = new Set([
      ...Object.keys(editedAmounts),
      ...Object.keys(editedDates),
      ...Object.keys(editedVendors),
      ...Object.keys(editedLineItems),
      ...Object.entries(deletedRows).filter(([, deleted]) => deleted).map(([id]) => id),
    ]);
    return editedIds.size + addRows.filter((row) => row.amount || row.dueDate || row.lineItem || row.comment).length;
  }, [addRows, deletedRows, editedAmounts, editedDates, editedLineItems, editedVendors]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed z-[10050] w-[min(1120px,calc(100vw-24px))] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-label="Payment adjust scratch sheet"
    >
      <div
        className="flex cursor-move select-none items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
        onPointerDown={beginDrag}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Payment adjust scratch sheet</div>
          <div className="truncate text-xs text-slate-500">{customerName || "Filtered customer"} - {rows.length} compare row{rows.length === 1 ? "" : "s"} - {editedCount} scratch edit{editedCount === 1 ? "" : "s"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-xs" onClick={addRow}>Add Row</button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              setEditedAmounts({});
              setEditedDates({});
              setEditedVendors({});
              setEditedLineItems({});
              setDeletedRows({});
              setAddRows([]);
            }}
          >
            Clear
          </button>
          <button type="button" className="btn btn-secondary btn-xs" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="max-h-[72vh] overflow-auto">
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Scratch-only sheet for cross-reference. It does not write payment changes yet.
        </div>
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-10 bg-white text-slate-500 shadow-[0_1px_0_rgb(226_232_240)] dark:bg-slate-950">
            <tr>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Source / Type</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">Adjust Amount</th>
              <th className="px-3 py-2 text-left">Vendor</th>
              <th className="px-3 py-2 text-center">Paid</th>
              <th className="px-3 py-2 text-left">Line Item / Grant</th>
              <th className="px-3 py-2 text-center">Delete</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => {
              const paid = compareRowPaid(row);
              const deleted = Boolean(deletedRows[row.id]);
              return (
                <tr key={row.id} className={["border-t border-slate-100 dark:border-slate-800", index % 2 ? "bg-slate-50/70 dark:bg-slate-900/50" : "", deleted ? "opacity-55" : ""].join(" ")}>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      className="w-36 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                      value={editedDates[row.id] ?? isoInputValue(row.date)}
                      onChange={(event) => setEditedDates((current) => ({ ...current, [row.id]: event.currentTarget.value }))}
                      disabled={deleted}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                    <div className="font-medium">{compareRowSourceLabel(row)}</div>
                    <div className="max-w-72 truncate text-[11px] text-slate-400" title={row.matchStatus}>{row.matchStatus}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-800 dark:text-slate-100">{row.amount == null ? "-" : `$${row.amount.toFixed(2)}`}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      className="w-28 rounded border border-slate-300 px-2 py-1 text-right dark:border-slate-700 dark:bg-slate-950"
                      value={editedAmounts[row.id] ?? ""}
                      placeholder={row.amount == null ? "" : row.amount.toFixed(2)}
                      onChange={(event) => setEditedAmounts((current) => ({ ...current, [row.id]: event.currentTarget.value }))}
                      disabled={deleted}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-40 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                      value={editedVendors[row.id] ?? row.fields.vendor ?? ""}
                      onChange={(event) => setEditedVendors((current) => ({ ...current, [row.id]: event.currentTarget.value }))}
                      disabled={deleted || paid}
                      placeholder={paid ? "-" : "Vendor"}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={paid} readOnly aria-label={paid ? "Paid" : "Unpaid"} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-56 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                      value={editedLineItems[row.id] ?? row.fields.grant ?? row.fields.enrollmentName ?? ""}
                      onChange={(event) => setEditedLineItems((current) => ({ ...current, [row.id]: event.currentTarget.value }))}
                      disabled={deleted}
                      placeholder="Line item / grant"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={deleted}
                      onChange={(event) => setDeletedRows((current) => ({ ...current, [row.id]: event.currentTarget.checked }))}
                      aria-label="Delete row"
                    />
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={8}>No payment compare rows for this customer filter.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">New Rows</div>
        <table className="min-w-full text-xs">
          <thead className="bg-white text-slate-500 dark:bg-slate-950">
            <tr>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Line Item</th>
              <th className="px-3 py-2 text-left">Comment</th>
              <th className="px-3 py-2 text-left"> </th>
            </tr>
          </thead>
          <tbody>
            {addRows.length ? addRows.map((row, index) => (
              <tr key={row.id} className={["border-t border-slate-100 dark:border-slate-800", index % 2 ? "bg-slate-50/70 dark:bg-slate-900/50" : ""].join(" ")}>
                <td className="px-3 py-2"><input type="date" className="w-36 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950" value={row.dueDate} onChange={(event) => updateAddRow(row.id, { dueDate: event.currentTarget.value })} /></td>
                <td className="px-3 py-2">
                  <select className="w-40 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950" value={row.type} onChange={(event) => updateAddRow(row.id, { type: event.currentTarget.value })}>
                    <option value="monthlyRent">Monthly Rent</option>
                    <option value="monthlyUtility">Monthly Utility</option>
                    <option value="deposit">Deposit</option>
                    <option value="prorated">Prorated</option>
                    <option value="service">Service</option>
                    <option value="arrears">Arrears</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-right"><input type="number" step="0.01" className="w-28 rounded border border-slate-300 px-2 py-1 text-right dark:border-slate-700 dark:bg-slate-950" value={row.amount} onChange={(event) => updateAddRow(row.id, { amount: event.currentTarget.value })} /></td>
                <td className="px-3 py-2"><input className="w-56 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950" value={row.lineItem} onChange={(event) => updateAddRow(row.id, { lineItem: event.currentTarget.value })} /></td>
                <td className="px-3 py-2"><input className="w-44 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950" value={row.comment} onChange={(event) => updateAddRow(row.id, { comment: event.currentTarget.value })} /></td>
                <td className="px-3 py-2"><button type="button" className="btn btn-ghost btn-xs" onClick={() => setAddRows((current) => current.filter((item) => item.id !== row.id))}>Delete</button></td>
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={6}>No new rows added.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>,
    document.body,
  );
}

function CompareTable({
  packets,
  database,
  databaseFilters,
  mode,
  enrollmentGranularity,
  showMissingSystemEnrollments,
  onModeChange,
  onEnrollmentGranularityChange,
  onShowMissingSystemEnrollmentsChange,
}: {
  packets: ReconciliationPacket[];
  database: ReturnType<typeof applyDatabaseFilters>;
  databaseFilters: DatabaseFilterConfig;
  mode: CompareMode;
  enrollmentGranularity: EnrollmentCompareGranularity;
  showMissingSystemEnrollments: boolean;
  onModeChange: (mode: CompareMode) => void;
  onEnrollmentGranularityChange: (value: EnrollmentCompareGranularity) => void;
  onShowMissingSystemEnrollmentsChange: (value: boolean) => void;
}) {
  const { sources, rows } = React.useMemo(() => buildReconciliationCompare(packets, database, {
    mode,
    enrollmentGranularity,
    showMissingSystemEnrollments,
  }), [database, enrollmentGranularity, mode, packets, showMissingSystemEnrollments]);
  const [showOnlyProblems, setShowOnlyProblems] = React.useState(false);
  const [matchMode, setMatchMode] = React.useState(false);
  const [pendingMatchRowId, setPendingMatchRowId] = React.useState<string | null>(null);
  const [manualMatches, setManualMatches] = React.useState<Map<string, string>>(new Map());
  const [manualMatchHistory, setManualMatchHistory] = React.useState<Array<{ groupId: string; rowIds: string[] }>>([]);
  const [nameFilter, setNameFilter] = React.useState("");
  const [grantFilter, setGrantFilter] = React.useState("");
  const [adjustCustomerName, setAdjustCustomerName] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [visibleSourceIds, setVisibleSourceIds] = React.useState<Set<string>>(new Set());
  const pageSize = 100;
  React.useEffect(() => {
    setVisibleSourceIds((current) => {
      const available = new Set(sources.map((source) => source.id));
      if (!current.size) return available;
      const next = new Set(Array.from(current).filter((id) => available.has(id)));
      return next.size ? next : available;
    });
  }, [sources]);
  const visibleSources = React.useMemo(
    () => sources.filter((source) => visibleSourceIds.has(source.id)),
    [sources, visibleSourceIds],
  );
  const toggleSource = React.useCallback((id: string) => {
    setVisibleSourceIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const filteredRows = React.useMemo(() => {
    const name = nameFilter.trim().toLowerCase();
    const grant = grantFilter.trim().toLowerCase();
    return rows.filter((row) => {
      const rowMatched = row.status === "matched" || manualMatches.has(row.id);
      if (showOnlyProblems && rowMatched) return false;
      if (name && !`${row.name} ${row.fields.cwid || ""} ${row.fields.hmisId || ""}`.toLowerCase().includes(name)) return false;
      if (grant) {
        const haystack = [
          row.fields.enrollmentName,
          row.fields.status,
          row.fields.activeState,
          row.fields.vendor,
          row.fields.grant,
          row.fields.actionHint,
          ...row.cells.map((cell) => `${cell.sourceLabel} ${cell.value} ${cell.detail || ""}`),
        ].join(" ").toLowerCase();
        if (!haystack.includes(grant)) return false;
      }
      return true;
    });
  }, [grantFilter, manualMatches, nameFilter, rows, showOnlyProblems]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = React.useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page],
  );
  const adjustRows = React.useMemo(() => {
    const name = adjustCustomerName.trim().toLowerCase();
    if (!name) return [];
    return rows.filter((row) => row.mode === "payments" && row.name.toLowerCase() === name);
  }, [adjustCustomerName, rows]);
  const promptRows = React.useMemo(() => buildComparePromptRows({
    mode,
    packets,
    database,
    databaseFilters,
    sources,
    visibleSourceIds,
    filters: {
      showOnlyProblems,
      nameFilter,
      grantFilter,
      enrollmentGranularity,
      showMissingSystemEnrollments,
    },
  }), [database, databaseFilters, enrollmentGranularity, grantFilter, mode, nameFilter, packets, showMissingSystemEnrollments, showOnlyProblems, sources, visibleSourceIds]);
  React.useEffect(() => {
    setPage(0);
  }, [mode, enrollmentGranularity, showMissingSystemEnrollments, showOnlyProblems, nameFilter, grantFilter]);
  React.useEffect(() => {
    const rowIds = new Set(rows.map((row) => row.id));
    setPendingMatchRowId((current) => current && rowIds.has(current) ? current : null);
    setManualMatches((current) => {
      const next = new Map(Array.from(current.entries()).filter(([rowId]) => rowIds.has(rowId)));
      return next.size === current.size ? current : next;
    });
    setManualMatchHistory((current) => current
      .map((group) => ({ ...group, rowIds: group.rowIds.filter((rowId) => rowIds.has(rowId)) }))
      .filter((group) => group.rowIds.length >= 2));
  }, [rows]);
  const undoLastManualMatch = React.useCallback(() => {
    setManualMatchHistory((current) => {
      const last = current[current.length - 1];
      if (!last) {
        setPendingMatchRowId(null);
        return current;
      }
      setManualMatches((matches) => {
        const next = new Map(matches);
        for (const rowId of last.rowIds) {
          if (next.get(rowId) === last.groupId) next.delete(rowId);
        }
        return next;
      });
      return current.slice(0, -1);
    });
  }, []);
  React.useEffect(() => {
    if (!matchMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoLastManualMatch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [matchMode, undoLastManualMatch]);
  const selectManualMatchRow = React.useCallback((rowId: string) => {
    if (!matchMode) return;
    setPendingMatchRowId((current) => {
      if (!current) return rowId;
      if (current === rowId) return null;
      const groupId = `manual:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
      const rowIds = [current, rowId];
      setManualMatches((matches) => {
        const next = new Map(matches);
        for (const id of rowIds) next.set(id, groupId);
        return next;
      });
      setManualMatchHistory((history) => [...history, { groupId, rowIds }]);
      return null;
    });
  }, [matchMode]);

  if (!rows.length) return null;
  const modeTitle = mode === "payments" ? "Payment compare" : mode === "enrollments" ? "Enrollment compare" : "Customer exit compare";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{modeTitle}</div>
          <div className="text-xs text-slate-500">
            {mode === "payments" ? "FE-led payment review: missing HMIS/dashboard rows and amount mismatches are prioritized; dashboard-only rows are hidden." : null}
            {mode === "enrollments" ? "One row per enrollment, or per service when service-level view is selected." : null}
            {mode === "customer_exits" ? "Coordinated-entry/customer rows for create/link/active-state review." : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input h-9 px-2 py-1 text-sm leading-5" value={mode} onChange={(event) => onModeChange(event.currentTarget.value as CompareMode)}>
            <option value="payments">Payments</option>
            <option value="enrollments">Enrollments</option>
            <option value="customer_exits">Customer exits</option>
          </select>
          {mode === "enrollments" ? (
            <>
              <select className="input h-9 px-2 py-1 text-sm leading-5" value={enrollmentGranularity} onChange={(event) => onEnrollmentGranularityChange(event.currentTarget.value as EnrollmentCompareGranularity)}>
                <option value="enrollment">1 row per enrollment</option>
                <option value="service">1 row per service</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={showMissingSystemEnrollments} onChange={(event) => onShowMissingSystemEnrollmentsChange(event.currentTarget.checked)} />
                Show dashboard-only enrollments
              </label>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={showOnlyProblems} onChange={(event) => setShowOnlyProblems(event.currentTarget.checked)} />
            Problems only
          </label>
          <button
            type="button"
            className={matchMode ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            onClick={() => {
              setMatchMode((current) => !current);
              setPendingMatchRowId(null);
            }}
          >
            {matchMode ? "Match mode on" : "Match mode"}
          </button>
          {manualMatchHistory.length ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={undoLastManualMatch}>
              Undo match
            </button>
          ) : null}
          {mode === "payments" ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAppScriptLikeReconciliationTab(`${modeTitle} Sheet View`, filteredRows)} disabled={!filteredRows.length}>
              Open sheet view
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExportOpen(true)} disabled={!filteredRows.length}>
            Export compare
          </button>
        </div>
      </div>
      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,240px)_minmax(0,240px)_1fr]">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-slate-500">Name / ID filter</span>
          <input className="input h-9 w-full px-2 py-1 text-sm leading-5" value={nameFilter} onChange={(event) => setNameFilter(event.currentTarget.value)} placeholder="Name, CWID, HMIS" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-slate-500">Grant / source filter</span>
          <input className="input h-9 w-full px-2 py-1 text-sm leading-5" value={grantFilter} onChange={(event) => setGrantFilter(event.currentTarget.value)} placeholder="Grant, provider, vendor" />
        </label>
        <div className="flex items-end justify-end gap-2 text-xs text-slate-500">
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setNameFilter(""); setGrantFilter(""); setShowOnlyProblems(false); }}>
            Clear filters
          </button>
          <span>{filteredRows.length} row{filteredRows.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      {matchMode ? (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          {pendingMatchRowId
            ? "Select the second row to create a manual match. Ctrl+Z undoes the last completed match."
            : "Select two compare rows to mark them as a manual match for this review session. Ctrl+Z undoes the last completed match."}
        </div>
      ) : null}
      {sources.length ? (
        <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible sources</div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setVisibleSourceIds(new Set(sources.map((source) => source.id)))}>Show all</button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setVisibleSourceIds(new Set())}>Hide all</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <label key={source.id} className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <input type="checkbox" checked={visibleSourceIds.has(source.id)} onChange={() => toggleSource(source.id)} />
                <span className="max-w-52 truncate" title={source.label}>{source.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="max-h-[68vh] overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-950">
            <tr>
              <th className="sticky left-0 z-20 min-w-24 bg-white px-2 py-1 dark:bg-slate-950">Match</th>
              <th className="sticky left-24 z-20 min-w-56 bg-white px-2 py-1 shadow-[1px_0_0_rgba(148,163,184,0.35)] dark:bg-slate-950">Name</th>
              {mode === "enrollments" || mode === "customer_exits" ? <th className="px-2 py-1">CWID</th> : null}
              {mode === "enrollments" || mode === "customer_exits" ? <th className="px-2 py-1">HMIS ID</th> : null}
              {mode === "enrollments" ? <th className="px-2 py-1">Enrollment Name</th> : null}
              <th className="px-2 py-1">Date</th>
              {mode === "enrollments" ? <th className="px-2 py-1">End Date</th> : null}
              {mode === "payments" ? <th className="px-2 py-1">Payment amount</th> : null}
              {mode === "payments" ? <th className="px-2 py-1">Vendor</th> : null}
              {mode === "payments" ? <th className="px-2 py-1">FE audit flag</th> : null}
              <th className="px-2 py-1">Status</th>
              {mode === "customer_exits" ? <th className="px-2 py-1">Action hint</th> : null}
              <th className="px-2 py-1">Manual match</th>
              <th className="px-2 py-1">Review</th>
              {visibleSources.map((source) => <th key={source.id} className="min-w-56 px-2 py-1">{source.label}</th>)}
              <th className="min-w-80 px-2 py-1">Match reasons</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const manualGroupId = manualMatches.get(row.id);
              const pending = pendingMatchRowId === row.id;
              return (
              <tr
                key={row.id}
                className={[
                  "border-t border-slate-200 align-top dark:border-slate-800",
                  matchMode ? "cursor-pointer hover:bg-sky-50/60 dark:hover:bg-sky-950/20" : "",
                  pending ? "bg-sky-50 dark:bg-sky-950/30" : "",
                ].join(" ")}
                onClick={() => selectManualMatchRow(row.id)}
              >
                <td className="sticky left-0 z-10 min-w-24 bg-white px-2 py-1 dark:bg-slate-950"><CompareCellPill status={manualGroupId ? "matched" : row.status} /></td>
                <td
                  className={[
                    "sticky left-24 z-10 min-w-56 bg-white px-2 py-1 font-medium text-slate-800 shadow-[1px_0_0_rgba(148,163,184,0.25)] dark:bg-slate-950 dark:text-slate-100",
                    mode === "payments" ? "cursor-pointer decoration-dotted hover:underline" : "",
                  ].join(" ")}
                  title={mode === "payments" ? "Double-click to filter this customer and open the payment adjust scratch sheet." : row.name}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (mode !== "payments" || !row.name || row.name === "-") return;
                    setNameFilter(row.name);
                    setAdjustCustomerName(row.name);
                    setPage(0);
                  }}
                >
                  {row.name}
                </td>
                {mode === "enrollments" || mode === "customer_exits" ? <td className="px-2 py-1">{row.fields.cwid || "-"}</td> : null}
                {mode === "enrollments" || mode === "customer_exits" ? <td className="px-2 py-1">{row.fields.hmisId || "-"}</td> : null}
                {mode === "enrollments" ? <td className="px-2 py-1">{row.fields.enrollmentName || "-"}</td> : null}
                <td className="px-2 py-1">{row.date}</td>
                {mode === "enrollments" ? <td className="px-2 py-1">{row.fields.endDate || "-"}</td> : null}
                {mode === "payments" ? <td className="px-2 py-1">{row.amount == null ? "-" : `$${row.amount.toFixed(2)}`}</td> : null}
                {mode === "payments" ? <td className="px-2 py-1">{row.fields.vendor || "-"}</td> : null}
                {mode === "payments" ? <td className="max-w-72 px-2 py-1 text-amber-700 dark:text-amber-300">{row.fields.sourceOfTruth || row.fields.paidFlag || "-"}</td> : null}
                <td className="px-2 py-1">{row.fields.status || row.fields.activeState || row.matchStatus || "-"}</td>
                {mode === "customer_exits" ? <td className="px-2 py-1">{row.fields.actionHint || "-"}</td> : null}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    className={pending ? "btn btn-primary btn-xs" : manualGroupId ? "btn btn-secondary btn-xs" : "btn btn-ghost btn-xs"}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectManualMatchRow(row.id);
                    }}
                    disabled={!matchMode}
                  >
                    {pending ? "Selected" : manualGroupId ? "Manual" : "Select"}
                  </button>
                </td>
                <td className="px-2 py-1">
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      openCompareRowReviewTab(row, visibleSourceIds, manualGroupId);
                    }}
                  >
                    Raw row
                  </button>
                </td>
                {visibleSources.map((source) => {
                  const cell = row.cells.find((item) => item.sourceId === source.id);
                  return (
                    <td key={source.id} className="px-2 py-1">
                      {cell ? (
                        <div className="space-y-1">
                          <CompareCellPill status={cell.status} />
                          <div className="max-w-80 truncate text-slate-500" title={cell.value}>{cell.value}</div>
                          {cell.detail ? <div className="max-w-80 truncate text-[11px] text-slate-400" title={cell.detail}>{cell.detail}</div> : null}
                        </div>
                      ) : "-"}
                    </td>
                  );
                })}
                <td className="max-w-96 px-2 py-1">{[manualGroupId ? `Manual match ${manualGroupId.split(":").slice(-1)[0]} selected in this review session.` : row.matchStatus, ...row.matchReasons].filter(Boolean).join("; ")}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          Showing {visibleRows.length ? page * pageSize + 1 : 0}-{page * pageSize + visibleRows.length} of {filteredRows.length} filtered compare rows.
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-xs" disabled={page <= 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Prev</button>
          <span>Page {page + 1} / {pageCount}</span>
          <button type="button" className="btn btn-ghost btn-xs" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</button>
        </div>
      </div>
      <ReviewExportDialog
        isOpen={exportOpen}
        title={`${modeTitle} Export`}
        subtitle={`${filteredRows.length} filtered compare rows ready for export`}
        rows={compareRowsToExportRows(filteredRows)}
        columns={COMPARE_EXPORT_COLUMNS}
        filenameBase={`${mode}-compare-rows`}
        mainSheetTitle="Compare"
        extraCsvFiles={[{
          filenameBase: `${mode}-compare-prompt`,
          label: "Prompt",
          csv: promptRows.map((row) => row.map((value) => {
            const raw = value == null ? "" : String(value);
            return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, "\"\"")}"` : raw;
          }).join(",")).join("\r\n"),
        }]}
        extraSheetTabs={[{ title: "Prompt", values: promptRows }]}
        onClose={() => setExportOpen(false)}
      />
      <FloatingPaymentAdjustSheet
        open={Boolean(adjustCustomerName)}
        customerName={adjustCustomerName}
        rows={adjustRows}
        onClose={() => setAdjustCustomerName("")}
      />
    </div>
  );
}

function CompareWorkspaceModal({
  isOpen,
  onClose,
  packets,
  database,
  databaseFilters,
  mode,
  enrollmentGranularity,
  showMissingSystemEnrollments,
  onModeChange,
  onEnrollmentGranularityChange,
  onShowMissingSystemEnrollmentsChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  packets: ReconciliationPacket[];
  database: ReturnType<typeof applyDatabaseFilters>;
  databaseFilters: DatabaseFilterConfig;
  mode: CompareMode;
  enrollmentGranularity: EnrollmentCompareGranularity;
  showMissingSystemEnrollments: boolean;
  onModeChange: (mode: CompareMode) => void;
  onEnrollmentGranularityChange: (value: EnrollmentCompareGranularity) => void;
  onShowMissingSystemEnrollmentsChange: (value: boolean) => void;
}) {
  if (!isOpen) return null;
  return (
    <FullPageModal
      isOpen
      onClose={onClose}
      leftWidthClass="w-[300px]"
      topBar={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Reconciliation Compare</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">Matched Rows</div>
            <div className="mt-1 text-sm text-slate-500">Dense side-by-side source comparison for uploaded reports and filtered dashboard records.</div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      }
      leftPane={
        <div className="space-y-4 p-5">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sources</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{packets.length}</div>
            <div className="mt-1 text-sm text-slate-500">uploaded report packet{packets.length === 1 ? "" : "s"}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Database Scope</div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <div>{database.customers.length} customers</div>
              <div>{database.enrollments.length} enrollments</div>
              <div>{database.paymentQueueItems.length} queue rows</div>
              <div>{database.ledger.length} ledger rows</div>
            </div>
          </div>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto bg-slate-50 p-4">
          <CompareTable
            packets={packets}
            database={database}
            databaseFilters={databaseFilters}
            mode={mode}
            enrollmentGranularity={enrollmentGranularity}
            showMissingSystemEnrollments={showMissingSystemEnrollments}
            onModeChange={onModeChange}
            onEnrollmentGranularityChange={onEnrollmentGranularityChange}
            onShowMissingSystemEnrollmentsChange={onShowMissingSystemEnrollmentsChange}
          />
        </div>
      }
    />
  );
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isBillableOrBudgetGrant(grant: Record<string, unknown>) {
  const budget = grant.budget && typeof grant.budget === "object" ? grant.budget as Record<string, unknown> : {};
  const totals = budget.totals && typeof budget.totals === "object" ? budget.totals as Record<string, unknown> : {};
  const lineItems = Array.isArray(budget.lineItems) ? budget.lineItems : [];
  const total = numberValue(budget.total ?? totals.total ?? grant.budgetTotal ?? grant.totalBudget);
  const projected = numberValue(totals.projected ?? totals.projectedTotal ?? totals.projectedSpend);
  const spent = numberValue(totals.spent ?? totals.spentTotal ?? totals.actualSpend);
  const hasBudget = lineItems.length > 0 || [total, projected, spent].some((value) => value != null && Math.abs(value) > 0);
  const label = [
    grant.cardType,
    grant.type,
    grant.kind,
    grant.grantType,
    grant.category,
    grant.name,
    grant.grantName,
    grant.label,
  ].map(textValue).join(" ").toLowerCase();
  return hasBudget || /\b(billable|budget)\b/.test(label);
}

function rowGrantId(row: Record<string, unknown>) {
  return textValue(row.grantId ?? row.grantID ?? row.programId ?? row.projectId);
}

function useReviewForTool(kind: ReconciliationToolKind, filterState: ReconciliationToolFilterState) {
  const config = TOOL_CONFIG[kind];
  const workspace = useReconciliationWorkspace();
  const dashboard = useDashboardSharedData();
  const relevantPackets = React.useMemo(
    () => workspace.packets.filter((packet) => packetMatchesTool(packet, config)),
    [config, workspace.packets],
  );
  // Only the payment tool needs ledger/queue rows, and only for the months its
  // uploaded reports actually cover — so we never request the whole queue.
  const reportMonths = React.useMemo(() => {
    if (kind !== "payment") return [];
    const set = new Set<string>();
    for (const packet of relevantPackets) {
      for (const record of packet.records) {
        const month = record.paymentEvidence.serviceMonth
          || (record.paymentEvidence.transactionDate ? record.paymentEvidence.transactionDate.slice(0, 7) : "");
        if (month) set.add(month);
      }
    }
    return Array.from(set);
  }, [kind, relevantPackets]);
  const paymentQueueMonths = React.useMemo(() => {
    const configured = monthRange(filterState.databaseFilters.paymentQueue.monthFrom, filterState.databaseFilters.paymentQueue.monthTo);
    return configured.length ? configured : reportMonths;
  }, [filterState.databaseFilters.paymentQueue.monthFrom, filterState.databaseFilters.paymentQueue.monthTo, reportMonths]);
  const ledgerMonths = React.useMemo(() => {
    const configured = monthRange(filterState.databaseFilters.ledger.monthFrom, filterState.databaseFilters.ledger.monthTo);
    return configured.length ? configured : reportMonths;
  }, [filterState.databaseFilters.ledger.monthFrom, filterState.databaseFilters.ledger.monthTo, reportMonths]);
  const paymentQueueQuery = React.useMemo(
    () => ({
      ...(filterState.databaseFilters.paymentQueue.queueStatus !== "any" ? { queueStatus: filterState.databaseFilters.paymentQueue.queueStatus } : {}),
      ...(filterState.databaseFilters.paymentQueue.source !== "any" ? { source: filterState.databaseFilters.paymentQueue.source } : {}),
      ...(filterState.databaseFilters.paymentQueue.matched === "unmatched" ? { unmatched: true } : {}),
      ...(filterState.databaseFilters.paymentQueue.okUnassigned !== "any" ? { okUnassigned: filterState.databaseFilters.paymentQueue.okUnassigned === "yes" } : {}),
      ...(filterState.databaseFilters.paymentQueue.isFlex !== "any" ? { isFlex: filterState.databaseFilters.paymentQueue.isFlex === "yes" } : {}),
    }),
    [
      filterState.databaseFilters.paymentQueue.queueStatus,
      filterState.databaseFilters.paymentQueue.source,
      filterState.databaseFilters.paymentQueue.matched,
      filterState.databaseFilters.paymentQueue.okUnassigned,
      filterState.databaseFilters.paymentQueue.isFlex,
    ],
  );
  const ledgerQuery = React.useMemo(
    () => ({
      ...(filterState.databaseFilters.ledger.source !== "any" ? { source: filterState.databaseFilters.ledger.source } : {}),
      ...(filterState.databaseFilters.ledger.grantId ? { grantId: filterState.databaseFilters.ledger.grantId } : {}),
    }),
    [filterState.databaseFilters.ledger.grantId, filterState.databaseFilters.ledger.source],
  );
  const eligiblePaymentGrants = React.useMemo(
    () => kind === "payment"
      ? (dashboard.grants as Array<Record<string, unknown>>).filter(isBillableOrBudgetGrant)
      : dashboard.grants as Array<Record<string, unknown>>,
    [dashboard.grants, kind],
  );
  const eligiblePaymentGrantIds = React.useMemo(
    () => new Set(eligiblePaymentGrants.map((grant) => textValue(grant.id)).filter(Boolean)),
    [eligiblePaymentGrants],
  );
  const { data: paymentQueueItems = [], isLoading: paymentQueueLoading } = usePaymentQueueItemsForMonths(
    paymentQueueMonths,
    paymentQueueQuery,
    { enabled: kind === "payment" && filterState.databaseFilters.paymentQueue.enabled && paymentQueueMonths.length > 0, staleTime: 120_000 },
  );
  const { data: ledgerEntries = [], isLoading: ledgerLoading } = useLedgerEntriesForMonths(
    ledgerMonths,
    ledgerQuery,
    { enabled: kind === "payment" && filterState.databaseFilters.ledger.enabled && ledgerMonths.length > 0, staleTime: 120_000 },
  );
  const filteredDatabase = React.useMemo(() => {
    const scopedPaymentQueueItems = kind === "payment"
      ? (paymentQueueItems as Array<Record<string, unknown>>).filter((row) => eligiblePaymentGrantIds.has(rowGrantId(row)))
      : paymentQueueItems as Array<Record<string, unknown>>;
    const scopedLedgerEntries = kind === "payment"
      ? (ledgerEntries as Array<Record<string, unknown>>).filter((row) => eligiblePaymentGrantIds.has(rowGrantId(row)))
      : ledgerEntries as Array<Record<string, unknown>>;
    return applyDatabaseFilters(filterState.databaseFilters, {
      customers: dashboard.customers as Array<Record<string, unknown>>,
      enrollments: dashboard.enrollments as Array<Record<string, unknown>>,
      grants: eligiblePaymentGrants,
      paymentQueueItems: scopedPaymentQueueItems,
      ledger: scopedLedgerEntries,
    });
  },
    [dashboard.customers, dashboard.enrollments, eligiblePaymentGrantIds, eligiblePaymentGrants, filterState.databaseFilters, kind, ledgerEntries, paymentQueueItems],
  );
  const review = React.useMemo<ReconciliationReviewResult>(
    () => buildReconciliationReview(relevantPackets, {
      customers: filteredDatabase.customers,
      enrollments: filteredDatabase.enrollments,
      grants: filteredDatabase.grants,
      paymentQueueItems: filteredDatabase.paymentQueueItems,
      ledger: filteredDatabase.ledger,
    }),
    [filteredDatabase, relevantPackets],
  );
  const toolFindings = React.useMemo(
    () => review.findings.filter((finding) => config.findingKinds.includes(finding.kind)),
    [config.findingKinds, review.findings],
  );
  const filteredFindings = React.useMemo(
    () => aggregateFindingsForTool(kind, toolFindings
      .filter((finding) => config.findingKinds.includes(finding.kind))
      .filter((finding) => filterState.severity === "all" || finding.severity === filterState.severity)
      .filter((finding) => !(filterState.sourceFiles ?? []).length || (filterState.sourceFiles ?? []).includes(finding.sourceFile))
      .filter((finding) => !(filterState.sourceSystems ?? []).length || (filterState.sourceSystems ?? []).includes(finding.sourceSystem))
      .filter((finding) => !(filterState.findingKinds ?? []).length || (filterState.findingKinds ?? []).includes(finding.kind))),
    [config.findingKinds, filterState.findingKinds, filterState.severity, filterState.sourceFiles, filterState.sourceSystems, kind, toolFindings],
  );
  return {
    workspace,
    dashboard,
    database: filteredDatabase,
    paymentQueueLoading,
    ledgerLoading,
    relevantPackets,
    review,
    toolFindings,
    filteredFindings,
  };
}

function ReconciliationToolMain({
  kind,
  filterState,
  onFilterChange,
  selection,
  onSelect,
}: {
  kind: ReconciliationToolKind;
  filterState: ReconciliationToolFilterState;
  onFilterChange?: (next: ReconciliationToolFilterState) => void;
  selection: ReconciliationToolSelection;
  onSelect: (next: ReconciliationToolSelection) => void;
}) {
  const config = TOOL_CONFIG[kind];
  const queryClient = useQueryClient();
  const { workspace, dashboard, database, paymentQueueLoading, ledgerLoading, relevantPackets, review, toolFindings, filteredFindings } = useReviewForTool(kind, filterState);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [bulkCustomerPatchOpen, setBulkCustomerPatchOpen] = React.useState(false);
  const [bulkCustomerImportOpen, setBulkCustomerImportOpen] = React.useState(false);
  const [bulkEnrollmentOpen, setBulkEnrollmentOpen] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [refreshingCollection, setRefreshingCollection] = React.useState<DatabaseCollectionKey | null>(null);
  const [selectedFindingIds, setSelectedFindingIds] = React.useState<Set<string>>(new Set());
  const [findingSearch, setFindingSearch] = React.useState("");
  const [rollupGrantId, setRollupGrantId] = React.useState("");
  const [compareMode, setCompareMode] = React.useState<CompareMode>(() => defaultCompareMode(kind));
  const [enrollmentGranularity, setEnrollmentGranularity] = React.useState<EnrollmentCompareGranularity>("enrollment");
  const [showMissingSystemEnrollments, setShowMissingSystemEnrollments] = React.useState(true);
  const exportRows = React.useMemo(
    () => reconciliationFindingsToRows(config.title, filteredFindings),
    [config.title, filteredFindings],
  );
  const exportSummaryRows = React.useMemo(() => buildReviewSummaryRows(review), [review]);
  const grantOptions = React.useMemo<ReportUploadGrant[]>(
    () => (dashboard.grants as Array<Record<string, unknown>>).map((grant) => ({
      id: String(grant.id ?? ""),
      name: String(grant.name ?? grant.grantName ?? grant.label ?? grant.title ?? grant.id ?? ""),
    })).filter((grant) => grant.id || grant.name),
    [dashboard.grants],
  );
  React.useEffect(() => {
    if (kind !== "payment") return;
    if (rollupGrantId && grantOptions.some((grant) => grant.id === rollupGrantId)) return;
    setRollupGrantId(grantOptions[0]?.id || "");
  }, [grantOptions, kind, rollupGrantId]);
  const selectedFinding = React.useMemo(
    () => filteredFindings.find((finding) => finding.id === selection?.findingId) ?? filteredFindings[0] ?? null,
    [filteredFindings, selection?.findingId],
  );
  const visibleFindings = React.useMemo(() => {
    const needle = findingSearch.trim().toLowerCase();
    if (!needle) return filteredFindings;
    return filteredFindings.filter((finding) => findingSearchText(finding).includes(needle));
  }, [filteredFindings, findingSearch]);
  const visibleSelectedFinding = React.useMemo(
    () => visibleFindings.find((finding) => finding.id === selection?.findingId) ?? visibleFindings[0] ?? null,
    [selection?.findingId, visibleFindings],
  );

  React.useEffect(() => {
    setCompareMode(defaultCompareMode(kind));
  }, [kind]);

  React.useEffect(() => {
    if (visibleSelectedFinding && selection?.findingId !== visibleSelectedFinding.id && !visibleFindings.some((finding) => finding.id === selection?.findingId)) {
      onSelect({ findingId: visibleSelectedFinding.id });
    }
  }, [onSelect, selection, visibleFindings, visibleSelectedFinding]);

  React.useEffect(() => {
    setSelectedFindingIds((current) => {
      const allowed = new Set(filteredFindings.map((finding) => finding.id));
      const next = new Set(Array.from(current).filter((id) => allowed.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredFindings]);

  const selectedFindings = React.useMemo(
    () => filteredFindings.filter((finding) => selectedFindingIds.has(finding.id)),
    [filteredFindings, selectedFindingIds],
  );
  const toggleSelectedFinding = React.useCallback((id: string) => {
    setSelectedFindingIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectAllVisibleFindings = React.useCallback(() => {
    setSelectedFindingIds((current) => new Set([...Array.from(current), ...visibleFindings.map((finding) => finding.id)]));
  }, [visibleFindings]);
  const clearVisibleFindings = React.useCallback(() => {
    const visibleIds = new Set(visibleFindings.map((finding) => finding.id));
    setSelectedFindingIds((current) => new Set(Array.from(current).filter((id) => !visibleIds.has(id))));
  }, [visibleFindings]);
  const refreshCollection = React.useCallback(async (key: DatabaseCollectionKey) => {
    setRefreshingCollection(key);
    try {
      if (key === "customers") await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.customers.root }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard.root }),
      ]);
      if (key === "enrollments") await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.enrollments.root }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard.root }),
      ]);
      if (key === "grants") await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.grants.root }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard.root }),
      ]);
      if (key === "paymentQueue") await queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root });
      if (key === "ledger") await queryClient.invalidateQueries({ queryKey: qk.ledger.root });
    } finally {
      setRefreshingCollection(null);
    }
  }, [queryClient]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{config.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{config.help}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {config.findingFocus.map((item) => (
                <span key={item} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCompareOpen(true)} disabled={!relevantPackets.length}>
              Open compare
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExportOpen(true)} disabled={!filteredFindings.length}>
              Export
            </button>
          </div>
        </div>
      </div>

      <ReportUploadPanel
        uploads={workspace.uploads}
        profiles={workspace.profiles}
        grants={grantOptions}
        reading={workspace.reading}
        error={workspace.error}
        onFiles={(files) => void workspace.addFiles(files)}
        onUpdateConfig={workspace.updateUploadConfig}
        onApplyConfigToWorkbook={workspace.applyUploadConfigToWorkbook}
        onSetUploadEnabled={workspace.setUploadEnabled}
        onSetWorkbookEnabled={workspace.setWorkbookEnabled}
        onRemove={workspace.removeUpload}
        onClear={workspace.clearUploads}
        toolKind={kind}
        databaseConfig={
          <DatabaseFilterPanel
            value={filterState.databaseFilters}
            onChange={(databaseFilters) => onFilterChange?.({ ...filterState, databaseFilters })}
            toolKind={kind}
            onRefreshCollection={(key) => void refreshCollection(key)}
            refreshingCollection={refreshingCollection}
            embedded
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dashboard Data</div>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {dashboard.sharedDataLoading || paymentQueueLoading || ledgerLoading ? "Loading filtered data..." : `${database.customers.length} customers - ${database.enrollments.length} enrollments - ${database.paymentQueueItems.length} queue - ${database.ledger.length} ledger`}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relevant Packets</div>
          <div className="mt-2 text-2xl font-semibold">{relevantPackets.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report Rows</div>
          <div className="mt-2 text-2xl font-semibold">{review.summary.reportRows}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Findings</div>
          <div className="mt-2 text-2xl font-semibold">{filteredFindings.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</div>
          <div className="mt-2 text-sm">Errors {review.summary.bySeverity.error} - Warnings {review.summary.bySeverity.warning}</div>
        </div>
      </div>

      <ReviewFilterPanel findings={toolFindings} value={filterState} onChange={onFilterChange} />

      {kind === "payment" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget rollup debug</div>
              <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Use this while reconciling payment reports to find missing line-item or cycle assignment.</div>
            </div>
            <select
              className="input h-9 min-w-64 text-sm"
              value={rollupGrantId}
              onChange={(event) => setRollupGrantId(event.currentTarget.value)}
            >
              {grantOptions.map((grant) => (
                <option key={grant.id || grant.name} value={grant.id}>{grant.name || grant.id}</option>
              ))}
            </select>
          </div>
          <BudgetRollupPreviewPanel grantId={rollupGrantId || null} compact />
        </div>
      ) : null}

      <ActionQueuePanel
        selectedFindings={selectedFindings}
        customers={database.customers}
        grants={database.grants}
        enrollments={database.enrollments}
        onClear={() => setSelectedFindingIds(new Set())}
        onApplyCustomerPatches={() => setBulkCustomerPatchOpen(true)}
        onCreateCustomers={() => setBulkCustomerImportOpen(true)}
        onBulkEnroll={() => setBulkEnrollmentOpen(true)}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <div className="max-h-[72vh] overflow-y-auto pr-1">
          <FindingList
            findings={visibleFindings}
            selection={selection}
            onSelect={onSelect}
            selectedIds={selectedFindingIds}
            onToggleSelected={toggleSelectedFinding}
            search={findingSearch}
            onSearchChange={setFindingSearch}
            onSelectAllVisible={selectAllVisibleFindings}
            onClearVisible={clearVisibleFindings}
          />
        </div>
        <FindingDetail finding={visibleSelectedFinding} />
      </div>

      <ReviewExportDialog
        isOpen={exportOpen}
        title={`${config.title} Findings`}
        subtitle={`${filteredFindings.length} filtered findings ready for export`}
        rows={exportRows}
        columns={RECONCILIATION_EXPORT_COLUMNS}
        filenameBase={`${kind}-reconciliation-findings`}
        summaryRows={exportSummaryRows}
        onClose={() => setExportOpen(false)}
      />

      <ReconciliationBulkCustomerPatchModal
        isOpen={bulkCustomerPatchOpen}
        findings={selectedFindings}
        onClose={() => setBulkCustomerPatchOpen(false)}
        onApplied={() => setSelectedFindingIds(new Set())}
      />

      <ReconciliationBulkCustomerImportModal
        isOpen={bulkCustomerImportOpen}
        findings={selectedFindings}
        customers={database.customers}
        onClose={() => setBulkCustomerImportOpen(false)}
        onApplied={() => setSelectedFindingIds(new Set())}
      />

      <ReconciliationBulkEnrollmentModal
        isOpen={bulkEnrollmentOpen}
        findings={selectedFindings}
        grants={grantOptions}
        enrollments={database.enrollments}
        onClose={() => setBulkEnrollmentOpen(false)}
        onApplied={() => setSelectedFindingIds(new Set())}
      />

      <CompareWorkspaceModal
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        packets={relevantPackets}
        database={database}
        databaseFilters={filterState.databaseFilters}
        mode={compareMode}
        enrollmentGranularity={enrollmentGranularity}
        showMissingSystemEnrollments={showMissingSystemEnrollments}
        onModeChange={setCompareMode}
        onEnrollmentGranularityChange={setEnrollmentGranularity}
        onShowMissingSystemEnrollmentsChange={setShowMissingSystemEnrollments}
      />
    </div>
  );
}

function ReconciliationTopbar({
  value,
  onChange,
}: {
  kind: ReconciliationToolKind;
  value: ReconciliationToolFilterState;
  onChange: (next: ReconciliationToolFilterState) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input h-9 px-2 py-1 text-sm leading-5" value={value.severity} onChange={(event) => onChange({ ...value, severity: event.currentTarget.value as ReconciliationToolFilterState["severity"] })}>
        <option value="all">All severities</option>
        <option value="error">Errors</option>
        <option value="warning">Warnings</option>
        <option value="info">Info</option>
      </select>
    </div>
  );
}

export const EnrollmentReconciliationTopbar: DashboardToolDefinition<ReconciliationToolFilterState, ReconciliationToolSelection>["ToolTopbar"] = (props) => <ReconciliationTopbar kind="enrollment" {...props} />;
export const PaymentReconciliationTopbar: DashboardToolDefinition<ReconciliationToolFilterState, ReconciliationToolSelection>["ToolTopbar"] = (props) => <ReconciliationTopbar kind="payment" {...props} />;
export const CustomerIdentityReviewTopbar: DashboardToolDefinition<ReconciliationToolFilterState, ReconciliationToolSelection>["ToolTopbar"] = (props) => <ReconciliationTopbar kind="identity" {...props} />;

export const EnrollmentReconciliationMain: DashboardToolDefinition<ReconciliationToolFilterState, ReconciliationToolSelection>["Main"] = (props) => <ReconciliationToolMain kind="enrollment" {...props} />;
export const PaymentReconciliationMain: DashboardToolDefinition<ReconciliationToolFilterState, ReconciliationToolSelection>["Main"] = (props) => <ReconciliationToolMain kind="payment" {...props} />;
export const CustomerIdentityReviewMain: DashboardToolDefinition<ReconciliationToolFilterState, ReconciliationToolSelection>["Main"] = (props) => <ReconciliationToolMain kind="identity" {...props} />;

export function createReconciliationFilterState(kind: ReconciliationToolKind): ReconciliationToolFilterState {
  const databaseFilters = {
    customers: { ...DEFAULT_DATABASE_FILTER_CONFIG.customers },
    enrollments: { ...DEFAULT_DATABASE_FILTER_CONFIG.enrollments },
    grants: { ...DEFAULT_DATABASE_FILTER_CONFIG.grants },
    paymentQueue: { ...DEFAULT_DATABASE_FILTER_CONFIG.paymentQueue },
    ledger: { ...DEFAULT_DATABASE_FILTER_CONFIG.ledger },
  };
  if (kind === "enrollment") {
    databaseFilters.paymentQueue.enabled = false;
    databaseFilters.ledger.enabled = false;
  }
  if (kind === "identity") {
    databaseFilters.enrollments.enabled = false;
    databaseFilters.grants.enabled = false;
    databaseFilters.paymentQueue.enabled = false;
    databaseFilters.ledger.enabled = false;
  }
  return {
    severity: "all",
    databaseFilters,
    sourceFiles: [],
    sourceSystems: [],
    findingKinds: [],
  };
}
