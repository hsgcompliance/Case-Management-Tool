"use client";

import React from "react";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { usePaymentQueueItemsForMonths } from "@hooks/usePaymentQueue";
import { type ReconciliationPacket } from "./reportProfiles";
import { ReportUploadPanel, type ReportUploadGrant } from "@entities/report-upload/ReportUploadPanel";
import {
  buildReconciliationReview,
  type ReconciliationFinding,
  type ReconciliationFindingKind,
  type ReconciliationReviewResult,
} from "./reconciliationReview";
import { useReconciliationWorkspace } from "./ReconciliationWorkspaceContext";
import ReviewExportDialog from "@entities/dialogs/export/ReviewExportDialog";
import {
  RECONCILIATION_EXPORT_COLUMNS,
  buildReviewSummaryRows,
  reconciliationFindingsToRows,
} from "./reconciliationExports";

export type ReconciliationToolKind = "enrollment" | "payment" | "identity";

export type ReconciliationToolFilterState = {
  severity: "all" | "error" | "warning" | "info";
  reportType: string;
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
    preferredProfiles: ["financial_edge_project_activity", "hmis_service_payment_report", "caseworthy_service_report"],
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

function FindingList({
  findings,
  selection,
  onSelect,
}: {
  findings: ReconciliationFinding[];
  selection: ReconciliationToolSelection;
  onSelect: (next: ReconciliationToolSelection) => void;
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
              <div className="font-semibold">{finding.title || finding.kind.replace(/_/g, " ")}</div>
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
          <div className="text-sm text-slate-500">{finding.sourceFile} - row {finding.sourceRowNumber ?? "-"}</div>
        </div>
        <span className={`rounded border px-2 py-1 text-xs ${severityClass(finding.severity)}`}>{finding.severity}</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
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
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Explanation</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {finding.explanation.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
      {finding.proposedAction ? (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {finding.proposedAction}
        </div>
      ) : null}
    </div>
  );
}

function useReviewForTool(kind: ReconciliationToolKind, severity: ReconciliationToolFilterState["severity"]) {
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
  const { data: paymentQueueItems = [], isLoading: paymentQueueLoading } = usePaymentQueueItemsForMonths(
    reportMonths,
    { enabled: kind === "payment" && reportMonths.length > 0, staleTime: 120_000 },
  );
  const review = React.useMemo<ReconciliationReviewResult>(
    () => buildReconciliationReview(relevantPackets, {
      customers: dashboard.customers as Array<Record<string, unknown>>,
      enrollments: dashboard.enrollments as Array<Record<string, unknown>>,
      grants: dashboard.grants as Array<Record<string, unknown>>,
      paymentQueueItems: paymentQueueItems as Array<Record<string, unknown>>,
    }),
    [dashboard.customers, dashboard.enrollments, dashboard.grants, paymentQueueItems, relevantPackets],
  );
  const filteredFindings = React.useMemo(
    () => review.findings
      .filter((finding) => config.findingKinds.includes(finding.kind))
      .filter((finding) => severity === "all" || finding.severity === severity),
    [config.findingKinds, review.findings, severity],
  );
  return {
    workspace,
    dashboard,
    paymentQueueItems,
    paymentQueueLoading,
    relevantPackets,
    review,
    filteredFindings,
  };
}

function ReconciliationToolMain({
  kind,
  filterState,
  selection,
  onSelect,
}: {
  kind: ReconciliationToolKind;
  filterState: ReconciliationToolFilterState;
  selection: ReconciliationToolSelection;
  onSelect: (next: ReconciliationToolSelection) => void;
}) {
  const config = TOOL_CONFIG[kind];
  const { workspace, dashboard, paymentQueueItems, paymentQueueLoading, relevantPackets, review, filteredFindings } = useReviewForTool(kind, filterState.severity);
  const [exportOpen, setExportOpen] = React.useState(false);
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
    if (!selection && selectedFinding) onSelect({ findingId: selectedFinding.id });
  }, [onSelect, selectedFinding, selection]);

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
        onRemove={workspace.removeUpload}
        onClear={workspace.clearUploads}
      />

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dashboard Data</div>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {dashboard.sharedDataLoading || paymentQueueLoading ? "Loading cached data..." : `${dashboard.customers.length} customers - ${dashboard.enrollments.length} enrollments - ${paymentQueueItems.length} payments`}
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

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <FindingList findings={filteredFindings} selection={selection} onSelect={onSelect} />
        <FindingDetail finding={selectedFinding} />
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
    </div>
  );
}

function ReconciliationTopbar({
  kind,
  value,
  onChange,
}: {
  kind: ReconciliationToolKind;
  value: ReconciliationToolFilterState;
  onChange: (next: ReconciliationToolFilterState) => void;
}) {
  const workspace = useReconciliationWorkspace();
  const config = TOOL_CONFIG[kind];
  const profiles = workspace.profiles.filter((profile) => config.preferredProfiles.includes(profile.id));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input h-9 min-w-64 px-2 py-1 text-sm leading-5" value={value.reportType} onChange={(event) => onChange({ ...value, reportType: event.currentTarget.value })}>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>{profile.label}</option>
        ))}
      </select>
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
  return {
    severity: "all",
    reportType: TOOL_CONFIG[kind].preferredProfiles[0],
  };
}
