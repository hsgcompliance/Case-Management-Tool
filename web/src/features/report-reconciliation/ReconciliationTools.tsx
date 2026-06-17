"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { usePaymentQueueItemsForMonths } from "@hooks/usePaymentQueue";
import { useLedgerEntriesForMonths } from "@hooks/useLedger";
import DatabaseFilterPanel from "@entities/database-filters/DatabaseFilterPanel";
import {
  DEFAULT_DATABASE_FILTER_CONFIG,
  applyDatabaseFilters,
  type DatabaseCollectionKey,
  type DatabaseFilterConfig,
} from "@entities/database-filters/databaseFilters";
import { qk } from "@hooks/queryKeys";
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
import {
  buildReconciliationCompare,
  type CompareCellStatus,
  type CompareMode,
  type EnrollmentCompareGranularity,
} from "./reconciliationCompare";

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
  preferredProfiles: string[];
  findingKinds: ReconciliationFindingKind[];
}> = {
  enrollment: {
    title: "Coordinated Entry / Enrollment Reconciliation",
    uploadLabel: "Add CE/HMIS Report",
    help: "Review HMIS Coordinated Entry by-name and enrollment evidence against dashboard customers, enrollments, entry/exit dates, and HMIS enrollment compliance.",
    preferredProfiles: ["coordinated_entry_by_name_list", "hmis_service_payment_report"],
    findingKinds: ["customer_missing", "customer_possible_match", "enrollment_missing", "entry_date_mismatch", "exit_date_mismatch", "enrollment_compliance_missing", "report_row_diagnostic"],
  },
  payment: {
    title: "Payment Reconciliation",
    uploadLabel: "Add Payment Report",
    help: "Review Financial Project Activity and HMIS Service Provided reports against dashboard payment queue and schedule rows.",
    preferredProfiles: ["financial_edge_project_activity", "rental_assistance_invoice_request", "hmis_service_payment_report", "caseworthy_service_report"],
    findingKinds: ["payment_missing_dashboard", "payment_possible_match", "payment_amount_mismatch", "grant_mapping_review", "report_row_diagnostic"],
  },
  identity: {
    title: "Customer Identity Review",
    uploadLabel: "Add Identity Source",
    help: "Review customer existence and identity links across HMIS IDs, dashboard customer IDs, names, DOBs, and future Caseworthy IDs.",
    preferredProfiles: ["coordinated_entry_by_name_list", "hmis_service_payment_report", "caseworthy_service_report"],
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
}: {
  findings: ReconciliationFinding[];
  selection: ReconciliationToolSelection;
  onSelect: (next: ReconciliationToolSelection) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
}) {
  if (!findings.length) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">No findings for this tool/filter.</div>;
  }
  return (
    <div className="space-y-2">
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
          </button>
        );
      })}
    </div>
  );
}

function ActionPreviewList({ actions }: { actions: ReconciliationActionPreview[] }) {
  if (!actions.length) return null;
  return (
    <div className="mt-4 rounded border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Available correction previews</div>
      <div className="space-y-2">
        {actions.map((action) => (
          <div key={action.id} className="rounded border border-white/70 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-950">
            <div className="font-semibold text-slate-800 dark:text-slate-100">{action.label}</div>
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

function fieldEntries(row: Record<string, unknown> | null | undefined, preferred: string[] = []) {
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
    if (entries.length >= 18) break;
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
        <span className={`rounded border px-2 py-1 text-xs ${severityClass(finding.severity)}`}>{finding.severity}</span>
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
      {finding.match?.criteria.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Match Criteria</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
            {finding.match.criteria.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      ) : null}
      {finding.proposedAction ? (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {finding.proposedAction}
        </div>
      ) : null}
      <ActionPreviewList actions={buildActionPreviews(finding)} />
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <KeyValueBlock title="Uploaded source row" row={finding.reportRecord?.raw} />
        <KeyValueBlock
          title="Normalized report row"
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
        <KeyValueBlock
          title="Matched customer doc"
          row={finding.matchedCustomer}
          preferred={["id", "firstName", "lastName", "fullName", "dob", "dateOfBirth", "hmisId", "HMISId", "caseworthyId", "active", "status", "caseManagerId", "assignedToUid"]}
        />
        <KeyValueBlock
          title="Matched enrollment doc"
          row={finding.matchedEnrollment}
          preferred={["id", "customerId", "grantId", "grantName", "programId", "programName", "status", "active", "entryDate", "startDate", "exitDate", "endDate"]}
        />
      </div>
      {finding.matchedPaymentCandidates?.length ? (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Matched payment candidates</div>
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
        </div>
      ) : null}
    </div>
  );
}

function BulkPreviewPanel({
  selectedFindings,
  onClear,
}: {
  selectedFindings: ReconciliationFinding[];
  onClear: () => void;
}) {
  const actions = React.useMemo(() => selectedFindings.flatMap(buildActionPreviews), [selectedFindings]);
  if (!selectedFindings.length) return null;
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-sky-900 dark:text-sky-100">Bulk correction preview</div>
          <div className="text-xs text-sky-700 dark:text-sky-300">{selectedFindings.length} findings selected - {actions.length} previewable actions</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled title="Writeback is approval-gated and not connected yet.">
            Apply selected
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>Clear</button>
        </div>
      </div>
      {actions.length ? <ActionPreviewList actions={actions.slice(0, 25)} /> : <div className="mt-2 text-xs text-sky-700 dark:text-sky-300">No selected findings have safe preview actions yet.</div>}
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

function CompareTable({
  packets,
  database,
  mode,
  enrollmentGranularity,
  showMissingSystemEnrollments,
  onModeChange,
  onEnrollmentGranularityChange,
  onShowMissingSystemEnrollmentsChange,
}: {
  packets: ReconciliationPacket[];
  database: ReturnType<typeof applyDatabaseFilters>;
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
  const [manualMatchedIds, setManualMatchedIds] = React.useState<Set<string>>(new Set());
  const visibleRows = React.useMemo(
    () => (showOnlyProblems ? rows.filter((row) => row.status !== "matched") : rows).slice(0, 500),
    [rows, showOnlyProblems],
  );

  if (!rows.length) return null;
  const modeTitle = mode === "payments" ? "Payment compare" : mode === "enrollments" ? "Enrollment compare" : "Customer exit compare";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{modeTitle}</div>
          <div className="text-xs text-slate-500">
            {mode === "payments" ? "One row per payment where possible; matched by name, date/month, and amount with partial-payment review signals." : null}
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
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-950">
            <tr>
              <th className="px-2 py-1">Match</th>
              <th className="px-2 py-1">Name</th>
              {mode === "enrollments" || mode === "customer_exits" ? <th className="px-2 py-1">CWID</th> : null}
              {mode === "enrollments" || mode === "customer_exits" ? <th className="px-2 py-1">HMIS ID</th> : null}
              {mode === "enrollments" ? <th className="px-2 py-1">Enrollment Name</th> : null}
              <th className="px-2 py-1">Date</th>
              {mode === "enrollments" ? <th className="px-2 py-1">End Date</th> : null}
              {mode === "payments" ? <th className="px-2 py-1">Payment amount</th> : null}
              {mode === "payments" ? <th className="px-2 py-1">Vendor</th> : null}
              {mode === "customer_exits" ? <th className="px-2 py-1">Action hint</th> : null}
              <th className="px-2 py-1">Manual match</th>
              {sources.map((source) => <th key={source.id} className="min-w-48 px-2 py-1">{source.label}</th>)}
              <th className="min-w-80 px-2 py-1">Match reasons</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                <td className="px-2 py-1"><CompareCellPill status={manualMatchedIds.has(row.id) ? "matched" : row.status} /></td>
                <td className="px-2 py-1 font-medium text-slate-800 dark:text-slate-100">{row.name}</td>
                {mode === "enrollments" || mode === "customer_exits" ? <td className="px-2 py-1">{row.fields.cwid || "-"}</td> : null}
                {mode === "enrollments" || mode === "customer_exits" ? <td className="px-2 py-1">{row.fields.hmisId || "-"}</td> : null}
                {mode === "enrollments" ? <td className="px-2 py-1">{row.fields.enrollmentName || "-"}</td> : null}
                <td className="px-2 py-1">{row.date}</td>
                {mode === "enrollments" ? <td className="px-2 py-1">{row.fields.endDate || "-"}</td> : null}
                {mode === "payments" ? <td className="px-2 py-1">{row.amount == null ? "-" : `$${row.amount.toFixed(2)}`}</td> : null}
                {mode === "payments" ? <td className="px-2 py-1">{row.fields.vendor || "-"}</td> : null}
                {mode === "customer_exits" ? <td className="px-2 py-1">{row.fields.actionHint || "-"}</td> : null}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    className={manualMatchedIds.has(row.id) ? "btn btn-secondary btn-xs" : "btn btn-ghost btn-xs"}
                    onClick={() => setManualMatchedIds((current) => {
                      const next = new Set(current);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      return next;
                    })}
                  >
                    {manualMatchedIds.has(row.id) ? "Matched" : "Mark"}
                  </button>
                </td>
                {sources.map((source) => {
                  const cell = row.cells.find((item) => item.sourceId === source.id);
                  return (
                    <td key={source.id} className="px-2 py-1">
                      {cell ? (
                        <div className="space-y-1">
                          <CompareCellPill status={cell.status} />
                          <div className="max-w-72 truncate text-slate-500" title={cell.value}>{cell.value}</div>
                        </div>
                      ) : "-"}
                    </td>
                  );
                })}
                <td className="max-w-96 px-2 py-1">{[manualMatchedIds.has(row.id) ? "Manual match selected in this review session." : row.matchStatus, ...row.matchReasons].filter(Boolean).join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > visibleRows.length ? <div className="mt-2 text-xs text-slate-400">Showing first {visibleRows.length} of {rows.length} compare rows.</div> : null}
    </div>
  );
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
  const filteredDatabase = React.useMemo(
    () => applyDatabaseFilters(filterState.databaseFilters, {
      customers: dashboard.customers as Array<Record<string, unknown>>,
      enrollments: dashboard.enrollments as Array<Record<string, unknown>>,
      grants: dashboard.grants as Array<Record<string, unknown>>,
      paymentQueueItems: paymentQueueItems as Array<Record<string, unknown>>,
      ledger: ledgerEntries as Array<Record<string, unknown>>,
    }),
    [dashboard.customers, dashboard.enrollments, dashboard.grants, filterState.databaseFilters, ledgerEntries, paymentQueueItems],
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
  const filteredFindings = React.useMemo(
    () => review.findings
      .filter((finding) => config.findingKinds.includes(finding.kind))
      .filter((finding) => filterState.severity === "all" || finding.severity === filterState.severity)
      .filter((finding) => !(filterState.sourceFiles ?? []).length || (filterState.sourceFiles ?? []).includes(finding.sourceFile))
      .filter((finding) => !(filterState.sourceSystems ?? []).length || (filterState.sourceSystems ?? []).includes(finding.sourceSystem))
      .filter((finding) => !(filterState.findingKinds ?? []).length || (filterState.findingKinds ?? []).includes(finding.kind)),
    [config.findingKinds, filterState.findingKinds, filterState.severity, filterState.sourceFiles, filterState.sourceSystems, review.findings],
  );
  const toolFindings = React.useMemo(
    () => review.findings.filter((finding) => config.findingKinds.includes(finding.kind)),
    [config.findingKinds, review.findings],
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
  const [refreshingCollection, setRefreshingCollection] = React.useState<DatabaseCollectionKey | null>(null);
  const [selectedFindingIds, setSelectedFindingIds] = React.useState<Set<string>>(new Set());
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
  const selectedFinding = React.useMemo(
    () => filteredFindings.find((finding) => finding.id === selection?.findingId) ?? filteredFindings[0] ?? null,
    [filteredFindings, selection?.findingId],
  );

  React.useEffect(() => {
    setCompareMode(defaultCompareMode(kind));
  }, [kind]);

  React.useEffect(() => {
    if (selectedFinding && selection?.findingId !== selectedFinding.id && !filteredFindings.some((finding) => finding.id === selection?.findingId)) {
      onSelect({ findingId: selectedFinding.id });
    }
  }, [filteredFindings, onSelect, selectedFinding, selection]);

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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExportOpen(true)} disabled={!filteredFindings.length}>
              Export
            </button>
            <DatabaseFilterPanel
              value={filterState.databaseFilters}
              onChange={(databaseFilters) => onFilterChange?.({ ...filterState, databaseFilters })}
              toolKind={kind}
              onRefreshCollection={(key) => void refreshCollection(key)}
              refreshingCollection={refreshingCollection}
            />
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

      <BulkPreviewPanel selectedFindings={selectedFindings} onClear={() => setSelectedFindingIds(new Set())} />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <FindingList
          findings={filteredFindings}
          selection={selection}
          onSelect={onSelect}
          selectedIds={selectedFindingIds}
          onToggleSelected={toggleSelectedFinding}
        />
        <FindingDetail finding={selectedFinding} />
      </div>

      <CompareTable
        packets={relevantPackets}
        database={database}
        mode={compareMode}
        enrollmentGranularity={enrollmentGranularity}
        showMissingSystemEnrollments={showMissingSystemEnrollments}
        onModeChange={setCompareMode}
        onEnrollmentGranularityChange={setEnrollmentGranularity}
        onShowMissingSystemEnrollmentsChange={setShowMissingSystemEnrollments}
      />

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
